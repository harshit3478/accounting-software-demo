import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import {
  createShipmentWithXps,
  updateShipmentWithXps,
  cancelShipmentWithXps,
} from "../../../../lib/xps";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoiceId, address } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(invoiceId) },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const res = await createShipmentWithXps(invoice, address || {});

    const dataToUpdate: any = {
      shipmentId: res.shipmentId || null,
      trackingNumber: res.trackingNumber || null,
    };

    const updated = await prisma.invoice.update({
      where: { id: Number(invoiceId) },
      // cast to any because Prisma client types may need regenerate after schema change
      data: dataToUpdate,
    });

    return NextResponse.json({ invoice: updated, xps: res });
  } catch (err: any) {
    console.error("Create shipment error", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { shipmentId, invoiceId, address } = body;

    let id = shipmentId;
    let invoice = null;
    if (!id) {
      if (!invoiceId)
        return NextResponse.json(
          { error: "shipmentId or invoiceId required" },
          { status: 400 }
        );
      invoice = await prisma.invoice.findUnique({
        where: { id: Number(invoiceId) },
      });
      if (!invoice)
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      id = invoice.shipmentId as string | undefined;
    }

    if (!id)
      return NextResponse.json(
        { error: "Shipment id not found for invoice" },
        { status: 400 }
      );

    const res = await updateShipmentWithXps(id, address || {});

    const dataToUpdate: any = {
      trackingNumber: res.trackingNumber || null,
    };

    if (!invoice) {
      // find invoice by shipmentId
      invoice = await prisma.invoice.findFirst({ where: { shipmentId: id } });
    }

    if (invoice) {
      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: dataToUpdate as any,
      });
      return NextResponse.json({ invoice: updated, xps: res });
    }

    return NextResponse.json({ xps: res });
  } catch (err: any) {
    console.error("Update shipment error", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { shipmentId, invoiceId } = body;

    let id = shipmentId;
    let invoice = null;
    if (!id) {
      if (!invoiceId)
        return NextResponse.json(
          { error: "shipmentId or invoiceId required" },
          { status: 400 }
        );
      invoice = await prisma.invoice.findUnique({
        where: { id: Number(invoiceId) },
      });
      if (!invoice)
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      id = invoice.shipmentId as string | undefined;
    }

    if (!id)
      return NextResponse.json(
        { error: "Shipment id not found for invoice" },
        { status: 400 }
      );

    const res = await cancelShipmentWithXps(id);

    if (!invoice) {
      invoice = await prisma.invoice.findFirst({ where: { shipmentId: id } });
    }

    if (invoice) {
      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { shipmentId: null, trackingNumber: null } as any,
      });
      return NextResponse.json({ invoice: updated, xps: res });
    }

    return NextResponse.json({ xps: res });
  } catch (err: any) {
    console.error("Cancel shipment error", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
