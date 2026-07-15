import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import prisma from "../../../../../lib/prisma";
import {
  validatePaymentRow,
  detectPaymentDuplicates,
  ValidationError,
} from "../../../../../lib/csv-validation";
import { parsePaymentSpreadsheet } from "../../../../../lib/payment-bulk-sheet";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const rows = await parsePaymentSpreadsheet(file);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "File is empty",
        },
        { status: 400 },
      );
    }

    const activeMethods = await prisma.paymentMethodEntry.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    const validMethodNames = activeMethods.map((method) => method.name);

    const validationErrors: ValidationError[] = [];
    rows.forEach((row, index) => {
      const rowErrors = validatePaymentRow(row, index + 2, validMethodNames);
      validationErrors.push(...rowErrors);
    });

    const duplicates = detectPaymentDuplicates(rows);

    const isValid = validationErrors.length === 0 && duplicates.length === 0;

    const errorsByRow: { [row: number]: string[] } = {};
    validationErrors.forEach((error) => {
      if (!errorsByRow[error.row]) {
        errorsByRow[error.row] = [];
      }
      errorsByRow[error.row].push(
        error.field ? `${error.field}: ${error.error}` : error.error,
      );
    });

    const invalidRows = Object.keys(errorsByRow).map((rowNum) => ({
      row: parseInt(rowNum),
      errors: errorsByRow[parseInt(rowNum)],
    }));

    return NextResponse.json({
      valid: isValid,
      totalRows: rows.length,
      validRows: rows.length - invalidRows.length,
      invalidRows,
      duplicates: duplicates.map((dup) => ({
        rows: dup.rows,
        reason: dup.reason,
      })),
    });
  } catch (error: any) {
    console.error("Validate payment spreadsheet error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
