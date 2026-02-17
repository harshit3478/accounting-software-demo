import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/auth';

export async function GET() {
  try {
    await requireAuth();

    // Create CSV template content with extended fields
    const headers = 'amount,paymentDate,method,notes,invoiceNumber,clientName';
    const exampleRow1 = '1250.00,2025-01-15,zelle,January payment,INV-2025-001,Acme Corp';
    const exampleRow2 = '850.00,2025-01-16,check,,,';
    const csvContent = `${headers}\n${exampleRow1}\n${exampleRow2}`;

    // Return as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="payments-template.csv"'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
