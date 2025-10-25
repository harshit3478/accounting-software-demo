import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/auth';

export async function GET() {
  try {
    await requireAuth();

    // Create CSV template content
    const headers = 'clientName,items,subtotal,tax,discount,dueDate,isLayaway';
    const exampleRow1 = 'John Doe,"Widget x2;Service x1",500.00,50.00,25.00,2025-02-15,false';
    const exampleRow2 = 'Jane Smith,"Laptop x1;Mouse x2",1200.00,120.00,0.00,2025-03-01,false';
    const comment = '# Format: items should be "ItemName x Quantity" separated by semicolons';
    const csvContent = `${headers}\n${exampleRow1}\n${exampleRow2}`;

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
