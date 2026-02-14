import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '../../../../lib/prisma';
import { createQuickBooksClient, mapQuickBooksPaymentMethod } from '../../../../lib/quickbooks';

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const verifier = process.env.QUICKBOOKS_WEBHOOK_VERIFIER || '';
  if (!verifier || verifier === 'your_webhook_verifier_token_here') {
    console.warn('QUICKBOOKS_WEBHOOK_VERIFIER not configured - skipping signature verification in development');
    return process.env.NODE_ENV === 'development';
  }
  
  const hash = crypto
    .createHmac('sha256', verifier)
    .update(payload)
    .digest('base64');
  
  return hash === signature;
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('intuit-signature');
    const rawBody = await request.text();
    
    // Verify signature
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      // For testing purposes, we might want to log the payload even if signature fails
      console.log('Webhook Payload (Signature Failed):', rawBody);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    console.log('Webhook Payload Received:', JSON.stringify(payload, null, 2));
    
    // Process each event in the webhook
    const results = [];
    for (const event of payload.eventNotifications || []) {
      for (const entity of event.dataChangeEvent?.entities || []) {
        // Only process Payment entities
        if (entity.name === 'Payment' && (entity.operation === 'Create' || entity.operation === 'Update')) {
          const result = await processPaymentEvent(entity, event);
          results.push(result);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      results 
    });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processPaymentEvent(entity: any, event: any) {
  const qbPaymentId = entity.id;
  const operation = entity.operation;

  try {
    const realmId = event.realmId;

    // Get all payment methods and create a mapping
    const allMethods = await prisma.paymentMethodEntry.findMany();
    const methodMap = new Map(allMethods.map(m => [m.name.toLowerCase(), m.id]));

    // Find the connection for this realm
    const connection = await prisma.quickBooksConnection.findFirst({
      where: {
        realmId,
        isActive: true
      },
      include: {
        user: true
      }
    });

    if (!connection) {
      console.error('No active connection found for realmId:', realmId);
      return { success: false, error: 'No active connection', qbPaymentId };
    }

    // Check if payment already exists (idempotency)
    const existingPayment = await prisma.payment.findUnique({
      where: { quickbooksId: qbPaymentId }
    });

    // Log the webhook event
    const webhookLog = await prisma.quickBooksWebhookLog.create({
      data: {
        connectionId: connection.id,
        eventType: `Payment.${operation}`,
        entityId: qbPaymentId,
        entityName: entity.name,
        payload: event,
        processed: false
      }
    });

    if (existingPayment) {
      // Payment already exists - update sync timestamp and mark log as processed
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { quickbooksSyncedAt: new Date() }
      });

      await prisma.quickBooksWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processed: true,
          processedAt: new Date(),
          createdPaymentId: existingPayment.id,
          errorMessage: 'Payment already exists - updated sync timestamp'
        }
      });

      console.log(`Payment ${existingPayment.id} already exists for QB payment ${qbPaymentId}`);
      return { success: true, action: 'updated', paymentId: existingPayment.id, qbPaymentId };
    }

    // Fetch full payment details from QuickBooks API
    let paymentData;
    try {
      const qbo = await createQuickBooksClient(connection.userId);
      if (qbo) {
        paymentData = await fetchPaymentFromQuickBooks(qbo, qbPaymentId);
      } else {
        console.warn('Could not create QuickBooks client, using webhook payload data');
        paymentData = extractPaymentDataFromWebhook(entity, event);
      }
    } catch (error: any) {
      console.warn('Failed to fetch from QuickBooks API, using webhook payload:', error.message);
      paymentData = extractPaymentDataFromWebhook(entity, event);
    }

    // Create payment in our system
    try {
      const methodId = methodMap.get(paymentData.methodName.toLowerCase()) || methodMap.get('cash')!;

      const payment = await prisma.payment.create({
        data: {
          userId: connection.userId,
          amount: paymentData.amount,
          methodId,
          paymentDate: paymentData.date,
          notes: paymentData.notes,
          quickbooksId: qbPaymentId,
          quickbooksSyncedAt: new Date(),
          isMatched: false, // Will need manual matching
          invoiceId: null // Not linked to any invoice yet
        }
      });

      // Update webhook log with created payment
      await prisma.quickBooksWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processed: true,
          processedAt: new Date(),
          createdPaymentId: payment.id
        }
      });

      console.log(`Created payment ${payment.id} from QuickBooks payment ${qbPaymentId}`);
      return { success: true, action: 'created', paymentId: payment.id, qbPaymentId };
      
    } catch (dbError: any) {
      // Handle duplicate key error (in case of race condition)
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('quickbooksId')) {
        console.log(`Duplicate detected for QB payment ${qbPaymentId}, treating as success`);
        
        await prisma.quickBooksWebhookLog.update({
          where: { id: webhookLog.id },
          data: {
            processed: true,
            processedAt: new Date(),
            errorMessage: 'Duplicate - handled by unique constraint'
          }
        });
        
        return { success: true, action: 'duplicate', qbPaymentId };
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error processing payment event:', error);
    return { success: false, error: error.message, qbPaymentId };
  }
}

async function fetchPaymentFromQuickBooks(qbo: any, paymentId: string): Promise<{
  amount: number;
  methodName: string;
  date: Date;
  notes: string;
}> {
  return new Promise((resolve, reject) => {
    qbo.getPayment(paymentId, (err: any, payment: any) => {
      if (err) {
        reject(err);
        return;
      }

      const amount = parseFloat(payment.TotalAmt || '0');
      const methodStr = payment.PaymentMethodRef?.name || payment.PaymentType || 'unknown';
      const date = payment.TxnDate ? new Date(payment.TxnDate) : new Date();

      // Extract customer and reference info
      const customerName = payment.CustomerRef?.name || 'Unknown Customer';
      const refNumber = payment.PaymentRefNum || payment.DocNumber || '';
      const memo = payment.PrivateNote || '';

      const notes = [
        `QuickBooks Payment`,
        `Customer: ${customerName}`,
        refNumber ? `Ref: ${refNumber}` : '',
        memo ? `Memo: ${memo}` : ''
      ].filter(Boolean).join(' - ');

      resolve({
        amount,
        methodName: mapQuickBooksPaymentMethod(methodStr),
        date,
        notes
      });
    });
  });
}

function extractPaymentDataFromWebhook(entity: any, event: any): {
  amount: number;
  methodName: string;
  date: Date;
  notes: string;
} {
  // Extract data from webhook payload (fallback when API call fails)
  const amount = parseFloat(entity.amount || '0');
  const methodStr = entity.paymentMethod || 'unknown';
  const date = entity.txnDate ? new Date(entity.txnDate) : new Date();

  // Extract customer/memo information
  const customerName = entity.customerName || event.customerRef?.name || 'Unknown Customer';
  const memo = entity.memo || '';
  const notes = `QuickBooks Payment - Customer: ${customerName}${memo ? ` - ${memo}` : ''} (from webhook)`;

  return {
    amount,
    methodName: mapQuickBooksPaymentMethod(methodStr),
    date,
    notes
  };
}

// Health check endpoint
export async function GET() {
  const verifierConfigured = process.env.QUICKBOOKS_WEBHOOK_VERIFIER && 
    process.env.QUICKBOOKS_WEBHOOK_VERIFIER !== 'your_webhook_verifier_token_here';
  
  return NextResponse.json({
    status: 'ok',
    message: 'QuickBooks webhook endpoint is active',
    verifierConfigured,
    environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox'
  });
}
