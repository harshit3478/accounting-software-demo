import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import prisma from "../../../../../lib/prisma";
import {
  parseInvoiceSpreadsheet,
  validateInvoiceSheetRows,
} from "../../../../../lib/invoice-bulk-sheet";
import {
  generateInvoiceNumber,
  calculateInvoiceStatus,
} from "../../../../../lib/invoice-utils";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

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

    if (invalidRows.length > 0 || duplicates.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed. All rows must be valid before upload.",
          validationErrors: invalidRows,
          duplicates,
        },
        { status: 400 },
      );
    }

    // Create all invoices in a transaction
    const createdInvoices = await prisma.$transaction(async (tx) => {
      const invoices = [];

      // Get starting invoice number
      const year = new Date().getFullYear();
      const lastInvoice = await tx.invoice.findFirst({
        where: {
          invoiceNumber: {
            startsWith: `INV-${year}-`,
          },
        },
        orderBy: {
          invoiceNumber: "desc",
        },
      });

      let nextNumber = 1;
      if (lastInvoice) {
        const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[2]);
        nextNumber = lastNumber + 1;
      }

      for (const row of rows) {
        const subtotal = Number(row.amount);
        const insuranceAmount = Number(row.insurance || 0);
        const shippingFee = Number(row.shipping || 0);
        const tax = 0;
        const discount = 0;
        const amount = subtotal + insuranceAmount + shippingFee;
        const dueDate = row.dueDate
          ? new Date(row.dueDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const isLayaway = row.isLayaway === true;
        const externalInvoiceNumber = row.externalInvoiceNumber?.trim() || null;

        // Generate sequential invoice number
        const invoiceNumber = `INV-${year}-${nextNumber.toString().padStart(4, "0")}`;
        nextNumber++;

        const description = row.description?.trim() || "Bulk imported item";
        const items = [
          {
            name: description,
            quantity: 1,
            price: subtotal,
            vca116g: Number(row.vca116g || 0),
            k18_121g: Number(row.k18_121g || 0),
            vca118g: Number(row.vca118g || 0),
          },
        ];

        // Calculate initial status
        const status = calculateInvoiceStatus(amount, 0, dueDate);

        // Create invoice
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            clientName: row.name,
            items,
            subtotal,
            tax,
            discount,
            shippingFee,
            insuranceAmount,
            amount,
            paidAmount: 0,
            dueDate,
            status,
            isLayaway,
            description: null,
            userId: user.id,
            externalInvoiceNumber,
            source: "xlsx_upload",
          },
        });

        invoices.push(invoice);
      }

      return invoices;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdInvoices.length} invoice(s)`,
      count: createdInvoices.length,
      invoiceIds: createdInvoices.map((inv) => inv.id),
    });
  } catch (error: any) {
    console.error("Bulk upload spreadsheet invoices error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
