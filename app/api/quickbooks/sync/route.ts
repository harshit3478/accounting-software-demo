import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';
import { createQuickBooksClient, mapQuickBooksPaymentMethod, refreshQuickBooksToken } from '../../../../lib/quickbooks';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Find user's QuickBooks connection
    const connection = await prisma.quickBooksConnection.findUnique({
      where: { userId: user.id }
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json(
        { error: 'QuickBooks not connected or inactive' },
        { status: 400 }
      );
    }

    // Get request options
    const body = await request.json().catch(() => ({}));
    const daysBack = body.daysBack || 30; // Default to last 30 days

    // Create QuickBooks client
    let qbo = await createQuickBooksClient(user.id);
    if (!qbo) {
      return NextResponse.json(
        { error: 'Failed to create QuickBooks client' },
        { status: 500 }
      );
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    console.log(`Syncing payments from QuickBooks since ${startDateStr}`);

    // Fetch payments from QuickBooks with retry logic for expired tokens
    let payments;
    try {
      payments = await fetchPaymentsFromQuickBooks(qbo, startDateStr);
    } catch (error: any) {
      // Check for authentication error (401)
      const isAuthError = 
        error?.statusCode === 401 || 
        error?.fault?.type === 'AUTHENTICATION' ||
        JSON.stringify(error).includes('AuthenticationFailed');

      if (isAuthError) {
        console.log('QuickBooks token expired during sync, refreshing and retrying...');
        try {
          // Force refresh token
          await refreshQuickBooksToken(user.id);
          
          // Re-create client with new token
          qbo = await createQuickBooksClient(user.id);
          if (!qbo) {
            throw new Error('Failed to recreate QuickBooks client after refresh');
          }
          
          // Retry fetch
          payments = await fetchPaymentsFromQuickBooks(qbo, startDateStr);
        } catch (retryError: any) {
          console.error('Retry failed after token refresh:', retryError);
          
          // Check if the refresh failed due to invalid grant/token
          // This happens when keys change (sandbox -> prod) but old token remains
          const failureBody = retryError.response?.body;
          const isInvalidGrant = 
            (typeof failureBody === 'string' && failureBody.includes('invalid_grant')) ||
            (failureBody?.error === 'invalid_grant');

          if (isInvalidGrant) {
            return NextResponse.json(
              { error: 'QuickBooks authentication failed. Please disconnect and reconnect your account.' },
              { status: 401 }
            );
          }

          throw error; // Throw original error if retry fails
        }
      } else {
        throw error;
      }
    }
    
    const results = {
      total: payments.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as any[]
    };

    // Process each payment
    for (const qbPayment of payments) {
      try {
        const qbPaymentId = qbPayment.Id;
        
        // Check if payment already exists
        const existingPayment = await prisma.payment.findUnique({
          where: { quickbooksId: qbPaymentId }
        });

        if (existingPayment) {
          // Update sync timestamp
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: { quickbooksSyncedAt: new Date() }
          });
          results.updated++;
          continue;
        }

        // Parse payment data
        const amount = parseFloat(qbPayment.TotalAmt || '0');
        const methodStr = qbPayment.PaymentMethodRef?.name || qbPayment.PaymentType || 'unknown';
        const date = qbPayment.TxnDate ? new Date(qbPayment.TxnDate) : new Date();
        
        // Extract customer and reference info
        const customerName = qbPayment.CustomerRef?.name || 'Unknown Customer';
        const refNumber = qbPayment.PaymentRefNum || qbPayment.DocNumber || '';
        const memo = qbPayment.PrivateNote || '';
        
        const notes = [
          `QuickBooks Payment (Manual Sync)`,
          `Customer: ${customerName}`,
          refNumber ? `Ref: ${refNumber}` : '',
          memo ? `Memo: ${memo}` : ''
        ].filter(Boolean).join(' - ');

        // Create payment in our system
        try {
          await prisma.payment.create({
            data: {
              userId: user.id,
              amount,
              method: mapQuickBooksPaymentMethod(methodStr),
              paymentDate: date,
              notes,
              quickbooksId: qbPaymentId,
              quickbooksSyncedAt: new Date(),
              isMatched: false,
              invoiceId: null
            }
          });
          results.created++;
        } catch (dbError: any) {
          // Handle duplicate (race condition or concurrent webhooks)
          if (dbError.code === 'P2002' && dbError.meta?.target?.includes('quickbooksId')) {
            results.skipped++;
          } else {
            throw dbError;
          }
        }
      } catch (error: any) {
        console.error(`Error processing payment ${qbPayment.Id}:`, error);
        results.errors.push({
          paymentId: qbPayment.Id,
          error: error.message
        });
      }
    }

    // Update lastSyncAt timestamp
    await prisma.quickBooksConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() }
    });

    console.log('Sync completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
      message: `Synced ${results.total} payments: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync payments' },
      { status: 500 }
    );
  }
}

async function fetchPaymentsFromQuickBooks(qbo: any, startDate: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    // Query payments from QuickBooks
    // We use findPayments with a raw WHERE clause string.
    // node-quickbooks appends this string to "select * from payment"
    const criteria = `WHERE TxnDate >= '${startDate}' MAXRESULTS 1000`;
    
    qbo.findPayments(criteria, (err: any, payments: any) => {
      if (err) {
        reject(err);
        return;
      }
      
      const paymentList = payments?.QueryResponse?.Payment || [];
      resolve(paymentList);
    });
  });
}

// GET endpoint to check sync status
export async function GET() {
  try {
    const user = await requireAuth();

    const connection = await prisma.quickBooksConnection.findUnique({
      where: { userId: user.id },
      select: {
        isActive: true,
        lastSyncAt: true,
        realmId: true
      }
    });

    if (!connection) {
      return NextResponse.json(
        { connected: false },
        { status: 200 }
      );
    }

    // Get payment counts
    const totalPayments = await prisma.payment.count({
      where: {
        userId: user.id,
        quickbooksId: { not: null }
      }
    });

    return NextResponse.json({
      connected: connection.isActive,
      lastSyncAt: connection.lastSyncAt,
      totalPayments,
      realmId: connection.realmId
    });
  } catch (error: any) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}