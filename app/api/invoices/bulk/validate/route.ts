import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import prisma from "../../../../../lib/prisma";
import {
  groupInvoiceSpreadsheetRows,
  parseInvoiceSpreadsheet,
  validateInvoiceSheetRows,
} from "../../../../../lib/invoice-bulk-sheet";
import { normalizeCustomerEmail } from "../../../../../lib/customer-email";

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

    const { invalidRows } = validateInvoiceSheetRows(rows);
    const groupedRows = groupInvoiceSpreadsheetRows(rows);
    const emailGroups = groupedRows.filter((group) => group.email);
    const uniqueEmails = [
      ...new Set(
        emailGroups
          .map((group) => normalizeCustomerEmail(group.email))
          .filter((email): email is string => !!email),
      ),
    ];

    const existingCustomers = uniqueEmails.length
      ? await prisma.customer.findMany({
          where: {
            email: {
              in: uniqueEmails,
            },
          },
          select: {
            email: true,
          },
        })
      : [];

    const existingEmailSet = new Set(
      existingCustomers
        .map((customer) => normalizeCustomerEmail(customer.email))
        .filter((email): email is string => !!email),
    );

    const missingEmailRows = groupedRows
      .filter((group) => !group.email)
      .map((group) => ({
        name: group.rows[0]?.name || "",
        rows: group.rows.map((row) => row.rowNumber),
        rowCount: group.rows.length,
      }));

    const missingCustomers = emailGroups
      .filter((group) => {
        const normalizedEmail = normalizeCustomerEmail(group.email);
        return normalizedEmail && !existingEmailSet.has(normalizedEmail);
      })
      .map((group) => ({
        email: group.email!,
        name: group.rows[0]?.name || "",
        rows: group.rows.map((row) => row.rowNumber),
        rowCount: group.rows.length,
      }));

    const liveTypeConflicts = emailGroups
      .map((group) => {
        const liveTypes = Array.from(
          new Set(
            group.rows.map(
              (row) => row.liveType?.trim().toLowerCase() || "__missing__",
            ),
          ),
        );

        if (liveTypes.length <= 1) {
          return null;
        }

        return {
          rows: group.rows.map((row) => row.rowNumber),
          email: group.email!,
          liveTypes,
        };
      })
      .filter(
        (
          conflict,
        ): conflict is {
          rows: number[];
          email: string;
          liveTypes: string[];
        } => conflict !== null,
      );

    const liveTypeConflictErrors = liveTypeConflicts.flatMap((conflict) =>
      conflict.rows.map((row) => ({
        row,
        errors: [
          `liveType: User has different live type for email ${conflict.email}`,
        ],
      })),
    );

    const validationErrors = [...invalidRows, ...liveTypeConflictErrors];

    const isValid = validationErrors.length === 0;

    return NextResponse.json({
      valid: isValid,
      totalRows: rows.length,
      validRows: rows.length - validationErrors.length,
      invalidRows: validationErrors,
      duplicates: [],
      missingEmailRows,
      missingCustomers,
    });
  } catch (error: any) {
    console.error("Validate spreadsheet error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
