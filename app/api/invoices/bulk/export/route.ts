import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import prisma from "../../../../../lib/prisma";
import {
  buildInvoiceSheetWorkbook,
  workbookToBuffer,
} from "../../../../../lib/invoice-bulk-sheet";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const invoiceIds = Array.isArray(body?.invoiceIds)
      ? body.invoiceIds
          .map((id: unknown) => Number(id))
          .filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    if (invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "At least one invoice must be selected" },
        { status: 400 },
      );
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        ...(user.role === "admin" ? {} : { userId: user.id }),
      },
      orderBy: { createdAt: "asc" },
    });

    if (invoices.length === 0) {
      return NextResponse.json(
        { error: "No invoices found for selected IDs" },
        { status: 404 },
      );
    }

    const rows = invoices.map((invoice) => {
      const items = Array.isArray(invoice.items)
        ? (invoice.items as Array<Record<string, unknown>>)
        : [];
      const firstItem = items[0] || {};
      const description = items
        .map((item) => String(item.name || "").trim())
        .filter(Boolean)
        .join("; ");

      return {
        name: invoice.clientName,
        description: description || String(firstItem.name || ""),
        vca116g: Number(firstItem.vca116g || 0),
        k18_121g: Number(firstItem.k18_121g || 0),
        vca118g: Number(firstItem.vca118g || 0),
        amount: Number(invoice.subtotal),
        insurance: Number(invoice.insuranceAmount || 0),
        shipping: Number(invoice.shippingFee || 0),
      };
    });

    const workbook = buildInvoiceSheetWorkbook(rows, {
      title: "GOLD CONECTION BY APPLE",
      subtitle: "INVOICE EXPORT",
    });
    const fileBuffer = workbookToBuffer(workbook);

    const timestamp = new Date().toISOString().split("T")[0];
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="invoices-export-${timestamp}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Bulk invoice export error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
