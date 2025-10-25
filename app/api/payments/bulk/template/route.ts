import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/auth';

export async function GET() {
  try {
    await requireAuth();

    // Create CSV template content
    const headers = 'amount,paymentDate,method';
    const exampleRow = '1250.00,2025-01-15,zelle';
    const csvContent = `${headers}\n${exampleRow}`;

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
