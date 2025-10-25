import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '../../../../lib/prisma';
import { mapQuickBooksPaymentMethod } from '../../../../lib/quickbooks';

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const verifier = process.env.QUICKBOOKS_WEBHOOK_VERIFIER || '';
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
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    
    // Process each event in the webhook
    for (const event of payload.eventNotifications || []) {
      for (const entity of event.dataChangeEvent?.entities || []) {
        // Only process Payment entities
        if (entity.name === 'Payment' && entity.operation === 'Create') {
          await processPaymentCreation(entity, event);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processPaymentCreation(entity: any, event: any) {
  try {
    const realmId = event.realmId;
    
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
      return;
    }

    // Log the webhook event
    const webhookLog = await prisma.quickBooksWebhookLog.create({
      data: {
        connectionId: connection.id,
        eventType: 'Payment.Create',
        entityId: entity.id,
        entityName: entity.name,
        payload: event
      }
    });

    // Fetch full payment details from QuickBooks
    // Note: In production, you would use the QuickBooks API to fetch payment details
    // For now, we'll extract what we can from the webhook payload
    
    // Create payment in our system
    const paymentData = extractPaymentData(entity, event);
    
    const payment = await prisma.payment.create({
      data: {
        userId: connection.userId,
        amount: paymentData.amount,
        method: paymentData.method,
        paymentDate: paymentData.date,
        notes: paymentData.notes,
        quickbooksId: entity.id,
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

    console.log(`Created payment ${payment.id} from QuickBooks payment ${entity.id}`);
  } catch (error: any) {
    console.error('Error processing payment creation:', error);
    
    // Log error in webhook log if available
    // This helps with debugging
  }
}

function extractPaymentData(entity: any, event: any): {
  amount: number;
  method: 'cash' | 'zelle' | 'quickbooks' | 'layaway';
  date: Date;
  notes: string;
} {
  // Extract data from webhook payload
  // Note: Actual structure depends on QuickBooks API response
  const amount = parseFloat(entity.amount || '0');
  const methodStr = entity.paymentMethod || 'unknown';
  const date = entity.txnDate ? new Date(entity.txnDate) : new Date();
  
  // Extract customer/memo information
  const customerName = entity.customerName || event.customerRef?.name || 'Unknown Customer';
  const memo = entity.memo || '';
  const notes = `QuickBooks Payment - Customer: ${customerName}${memo ? ` - ${memo}` : ''}`;

  return {
    amount,
    method: mapQuickBooksPaymentMethod(methodStr),
    date,
    notes
  };
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'QuickBooks webhook endpoint is active'
  });
}
