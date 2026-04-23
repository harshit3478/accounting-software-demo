import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import {
  putOrderToXps,
  updateShipmentWithXps,
  cancelShipmentWithXps,
  getShipmentFromXps,
} from "../../../../lib/xps";

function normalizeShipment(data: any) {
  const shipment = data?.shipment || data?.order || data || null;
  if (!shipment) return null;

  const trackingNumber =
    shipment.trackingNumber ||
    shipment.trackingNo ||
    shipment.tracking ||
    shipment.tracking_numbers?.[0] ||
    shipment.trackingNumbers?.[0] ||
    null;

  const orderStatus =
    shipment.orderStatus ||
    shipment.status ||
    shipment.fulfillmentStatus ||
    shipment.shippingStatus ||
    (shipment.voided
      ? "Voided"
      : trackingNumber
        ? "Shipped"
        : shipment.bookNumber
          ? "Booked"
          : "Pending");

  const carrier =
    shipment.carrierCode ||
    shipment.carrier ||
    shipment.shippingService ||
    null;

  const liveTrackingUrl = trackingNumber
    ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`
    : null;

  const destination = shipment.destination || shipment.receiver || null;
  const packages =
    shipment.packages?.length > 0
      ? shipment.packages
      : shipment.pieces?.length > 0
        ? shipment.pieces
        : shipment.items;

  return {
    ...shipment,
    trackingNumber,
    orderStatus,
    carrier,
    shippingService: shipment.shippingService || shipment.serviceCode || null,
    liveTrackingUrl,
    destination,
    packages: packages ?? shipment.packages,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoiceId");

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID required" },
        { status: 400 },
      );
    }

    const data = await getShipmentFromXps(invoiceId);
    return NextResponse.json(normalizeShipment(data));
  } catch (err: any) {
    console.error("Get shipment error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoiceId, address, packages } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 },
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(invoiceId) },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const res = await putOrderToXps(invoice, address || {}, packages || []);
    const shipment = normalizeShipment(res.raw);

    // Save the shipment ID (which corresponds to invoice.id in XPS) to the database
    // so the UI knows this invoice has a pending shipment.
    const updatedInvoice = await prisma.invoice.update({
      where: { id: Number(invoiceId) },
      data: {
        shipmentId: invoice.id.toString(),
        trackingNumber: shipment?.trackingNumber || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Order sent to XPS",
      xps: shipment || res,
      invoice: updatedInvoice,
    });
  } catch (err: any) {
    console.error("Create shipment error", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { shipmentId, invoiceId, address, packages } = body;

    let id = shipmentId;
    let invoice = null;
    if (!id) {
      if (!invoiceId)
        return NextResponse.json(
          { error: "shipmentId or invoiceId required" },
          { status: 400 },
        );
      invoice = await prisma.invoice.findUnique({
        where: { id: Number(invoiceId) },
      });
      if (!invoice)
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      id = invoice.shipmentId as string | undefined;
    }

    if (!id)
      return NextResponse.json(
        { error: "Shipment id not found for invoice" },
        { status: 400 },
      );

    if (!invoice) {
      invoice = await prisma.invoice.findFirst({ where: { shipmentId: id } });
    }

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found for shipment" },
        { status: 404 },
      );
    }

    // Reuse the PUT order logic to update details
    // Ensure we pass packages if provided, otherwise we might be overwriting with empty
    // Ideally the UI should always send full state on update.
    const res = await putOrderToXps(invoice, address || {}, packages || []);
    const shipment = normalizeShipment(res.raw);

    if (invoice) {
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          trackingNumber:
            shipment?.trackingNumber || invoice.trackingNumber || null,
        } as any,
      });
      return NextResponse.json({
        invoice: updatedInvoice,
        xps: shipment || res,
      });
    }

    return NextResponse.json({ xps: shipment || res });
  } catch (err: any) {
    console.error("Update shipment error", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 },
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
          { status: 400 },
        );
      invoice = await prisma.invoice.findUnique({
        where: { id: Number(invoiceId) },
      });
      if (!invoice)
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      id = invoice.shipmentId as string | undefined;
    }

    if (!id)
      return NextResponse.json(
        { error: "Shipment id not found for invoice" },
        { status: 400 },
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
      { status: 500 },
    );
  }
}
