import { NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import {
  buildInvoiceSheetWorkbook,
  workbookToBuffer,
} from "../../../../../lib/invoice-bulk-sheet";

export async function GET() {
  try {
    await requireAuth();

    const workbook = buildInvoiceSheetWorkbook(
      [
        {
          name: "AELI TIU",
          email: "aeli.tiu@example.com",
          description: "CC RING",
          vca116g: 0,
          k18_121g: 3.36,
          vca118g: 0,
          amount: 407,
          insurance: 0,
          shipping: 0,
        },
        {
          name: "BELLE EBREO",
          email: "",
          description: "DIOR STUD LOOP E",
          vca116g: 0,
          k18_121g: 6.81,
          vca118g: 0,
          amount: 824,
          insurance: 10,
          shipping: 15,
        },
      ],
      {
        title: "GOLD CONECTION BY APPLE",
        subtitle: "SAMPLE BULK INVOICE SHEET",
      },
    );
    const fileBuffer: any = workbookToBuffer(workbook);

    // Return as downloadable file
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="invoices-template.xlsx"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
