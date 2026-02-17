import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    
    // Use same filter params as main payments list
    const search = searchParams.get("search") || "";
    const method = searchParams.get("method") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let where: any = {};
    
    // Search filter
    if (search) {
      where.OR = [
        { notes: { contains: search } },
        { 
          invoice: { 
            OR: [
              { invoiceNumber: { contains: search } },
              { clientName: { contains: search } }
            ]
          } 
        }
      ];
    }

    // Method filter
    if (method !== "all") {
      const methodId = parseInt(method);
      if (!isNaN(methodId)) {
        where.methodId = methodId;
      }
    }

    // Date range filter
    if (startDate && endDate) {
      where.paymentDate = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    // Fetch all payments (no pagination for export)
    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            clientName: true
          }
        },
        method: {
          select: {
            name: true
          }
        },
        user: {
          select: {
            name: true
          }
        },
        paymentMatches: {
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
                clientName: true
              }
            }
          }
        }
      },
      orderBy: {
        paymentDate: 'desc'
      },
    });

    // Format data for CSV
    const csvData = payments.map(payment => {
      // Get invoice info (from direct link or first match)
      const invoiceNumber = payment.invoice?.invoiceNumber || 
                           payment.paymentMatches?.[0]?.invoice.invoiceNumber || 
                           null;
      const clientName = payment.invoice?.clientName || 
                        payment.paymentMatches?.[0]?.invoice.clientName || 
                        null;

      return {
        amount: payment.amount.toNumber(),
        paymentDate: payment.paymentDate.toISOString().split('T')[0],
        methodName: payment.method.name,
        notes: payment.notes,
        invoiceNumber,
        clientName,
        recordedBy: payment.user.name || 'Unknown',
        source: payment.source || 'manual',
        createdAt: payment.createdAt.toISOString().split('T')[0]
      };
    });

    // Generate CSV content
    const headers = [
      'Amount',
      'Payment Date',
      'Method',
      'Notes',
      'Invoice Number',
      'Client Name',
      'Recorded By',
      'Source',
      'Created Date'
    ];

    const csvRows = [
      headers.join(','),
      ...csvData.map(row => [
        row.amount.toFixed(2),
        row.paymentDate,
        escapeCSVValue(row.methodName),
        escapeCSVValue(row.notes || ''),
        escapeCSVValue(row.invoiceNumber || ''),
        escapeCSVValue(row.clientName || ''),
        escapeCSVValue(row.recordedBy),
        row.source,
        row.createdAt
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const filename = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error: any) {
    console.error('Export payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

// Helper function to escape CSV values
function escapeCSVValue(value: string): string {
  if (!value) return '';
  const stringValue = String(value);
  
  // If the value contains comma, double quote, or newline, wrap it in quotes and escape inner quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}
