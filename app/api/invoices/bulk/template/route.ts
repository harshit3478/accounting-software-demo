import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/auth';

export async function GET() {
  try {
    await requireAuth();

    // Create CSV template content
    const headers = 'clientName,items,subtotal,tax,discount,dueDate,isLayaway,externalInvoiceNumber';
    const exampleRow1 = 'John Doe,"Widget x2 @ 250.00;Service x1 @ 0.00",500.00,50.00,25.00,2026-03-15,false,EXT-001';
    const exampleRow2 = 'Jane Smith,"Laptop x1 @ 1000.00;Mouse x2 @ 100.00",1200.00,120.00,0.00,2026-04-01,false,';
    const comment = '# Format: items should be "ItemName x Quantity @ UnitPrice" separated by semicolons. externalInvoiceNumber is optional.';
    const csvContent = `${headers}\n${exampleRow1}\n${exampleRow2}\n${comment}`;

    // Return as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="invoices-template.csv"'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
