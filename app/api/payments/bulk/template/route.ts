import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import prisma from "../../../../../lib/prisma";
import {
  buildPaymentCsvTemplate,
  buildPaymentSheetWorkbook,
  paymentWorkbookToBuffer,
} from "../../../../../lib/payment-bulk-sheet";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const format = request.nextUrl.searchParams.get("format")?.toLowerCase();
    const activeMethods = await prisma.paymentMethodEntry.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    const exampleMethods = activeMethods.map((method) => method.name);

    if (format === "csv") {
      const csvContent = buildPaymentCsvTemplate(exampleMethods);

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="payments-template.csv"',
        },
      });
    }

    const workbook = buildPaymentSheetWorkbook(exampleMethods);
    const fileBuffer: any = paymentWorkbookToBuffer(workbook);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="payments-template.xlsx"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
