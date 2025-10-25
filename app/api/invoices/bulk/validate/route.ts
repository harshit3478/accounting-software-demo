import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/auth';
import Papa from 'papaparse';
import {
  validateInvoiceRow,
  detectInvoiceDuplicates,
  ValidationError,
  InvoiceRow
} from '../../../../../lib/csv-validation';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const parseResult = Papa.parse<InvoiceRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim()
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing error',
        details: parseResult.errors
      }, { status: 400 });
    }

    const rows = parseResult.data;
    
    if (rows.length === 0) {
      return NextResponse.json({
        error: 'CSV file is empty'
      }, { status: 400 });
    }

    // Validate each row
    const validationErrors: ValidationError[] = [];
    rows.forEach((row, index) => {
      const rowErrors = validateInvoiceRow(row, index + 2); // +2 because row 1 is header
      validationErrors.push(...rowErrors);
    });

    // Check for duplicates
    const duplicates = detectInvoiceDuplicates(rows);

    const isValid = validationErrors.length === 0 && duplicates.length === 0;

    // Group errors by row
    const errorsByRow: { [row: number]: string[] } = {};
    validationErrors.forEach(error => {
      if (!errorsByRow[error.row]) {
        errorsByRow[error.row] = [];
      }
      errorsByRow[error.row].push(error.field ? `${error.field}: ${error.error}` : error.error);
    });

    const invalidRows = Object.keys(errorsByRow).map(rowNum => ({
      row: parseInt(rowNum),
      errors: errorsByRow[parseInt(rowNum)]
    }));

    return NextResponse.json({
      valid: isValid,
      totalRows: rows.length,
      validRows: rows.length - invalidRows.length,
      invalidRows,
      duplicates: duplicates.map(dup => ({
        rows: dup.rows,
        reason: dup.reason
      }))
    });

  } catch (error: any) {
    console.error('Validate CSV error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
