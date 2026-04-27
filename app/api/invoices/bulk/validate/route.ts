import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import {
  parseInvoiceSpreadsheet,
  validateInvoiceSheetRows,
} from "../../../../../lib/invoice-bulk-sheet";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const rows = await parseInvoiceSpreadsheet(file);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "Spreadsheet has no invoice rows",
        },
        { status: 400 },
      );
    }

    const { invalidRows, duplicates } = validateInvoiceSheetRows(rows);
    const isValid = invalidRows.length === 0 && duplicates.length === 0;

    return NextResponse.json({
      valid: isValid,
      totalRows: rows.length,
      validRows: rows.length - invalidRows.length,
      invalidRows,
      duplicates,
    });
  } catch (error: any) {
    console.error("Validate spreadsheet error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
