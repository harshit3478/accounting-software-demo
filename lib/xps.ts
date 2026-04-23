export interface XpsAddress {
  name?: string;
  company?: string;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface XpsPackage {
  weight: string; // Numeric string
  length?: string;
  width?: string;
  height?: string;
  insuranceAmount?: string | null;
  declaredValue?: string | null;
}

export interface XpsOrderPayload {
  orderId: string;
  orderDate: string;
  orderNumber: string;
  fulfillmentStatus: string;
  shippingService?: string;
  shippingTotal?: string;
  orderGroup?: string;
  weightUnit: "lb" | "kg";
  dimUnit: "in" | "cm";
  dueByDate?: string;
  sender: {
    name: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
    email?: string;
  };
  receiver: {
    name: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
    email?: string;
  };
  items?: any[];
  packages?: XpsPackage[];
}

export async function putOrderToXps(
  invoice: any,
  address: XpsAddress,
  packages: XpsPackage[],
) {
  const base = process.env.XPS_API_BASE || process.env.NEXT_PUBLIC_XPS_API_BASE;
  const key = process.env.XPS_API_KEY || process.env.NEXT_PUBLIC_XPS_API_KEY;
  const customerId = process.env.XPS_CUSTOMER_ID;
  const integrationId = process.env.XPS_INTEGRATION_ID;

  if (!base || !key) {
    throw new Error("XPS API base URL or API key not configured");
  }
  if (!customerId || !integrationId) {
    throw new Error("XPS Customer ID or Integration ID not configured");
  }

  const normalizedPackages =
    Array.isArray(packages) && packages.length > 0
      ? packages
      : [{ weight: "1" }];
  const invoiceInsurance = Number(invoice?.insuranceAmount || 0);

  // Construct payload
  const payload: XpsOrderPayload = {
    orderId: invoice.id.toString(),
    orderDate: new Date().toISOString().split("T")[0],
    orderNumber: invoice.invoiceNumber,
    fulfillmentStatus: "pending",
    weightUnit: "lb", // Defaulting to lb, should be configurable
    dimUnit: "in", // Defaulting to in
    sender: {
      name: process.env.XPS_SENDER_NAME || "My Company",
      company: process.env.XPS_SENDER_NAME || "My Company",
      address1: process.env.XPS_SENDER_STREET || "123 Main St",
      address2: "",
      city: process.env.XPS_SENDER_CITY || "City",
      state: process.env.XPS_SENDER_STATE || "ST",
      zip: process.env.XPS_SENDER_ZIP || "00000",
      country: process.env.XPS_SENDER_COUNTRY || "US",
      phone: process.env.XPS_SENDER_PHONE,
    },
    receiver: {
      name: address.name || "Unknown",
      company: address.company || "",
      address1: address.street || "",
      address2: address.street2 || "",
      city: address.city || "",
      state: address.state || "",
      zip: address.postalCode || "",
      country: address.country || "US",
      phone: address.phone,
      email: address.email,
    },
    shippingService: "Ground",
    shippingTotal: invoice.amount ? invoice.amount.toString() : "0.00",
    dueByDate: invoice.dueDate
      ? new Date(invoice.dueDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    orderGroup: "Web Orders",
    items: Array.isArray(invoice.items)
      ? invoice.items.map((item: any, idx: number) => ({
          productId: (idx + 1).toString(),
          sku: (idx + 1).toString(),
          title: item.name || "Item",
          price: item.pricePerItem ? item.pricePerItem.toString() : "0",
          quantity: item.quantity ? Math.round(Number(item.quantity)) : 1,
          weight: "0",
          imgUrl: "",
          htsNumber: "",
          countryOfOrigin: "US",
          lineId: (idx + 1).toString(),
        }))
      : [
          {
            productId: "1",
            sku: "1",
            title: "General Item",
            price: invoice.amount ? invoice.amount.toString() : "0",
            quantity: 1,
            weight: packages[0]?.weight || "1",
            imgUrl: "",
            htsNumber: "",
            countryOfOrigin: "US",
            lineId: "1",
          },
        ],
    packages: normalizedPackages.map((p, idx) => ({
      ...p,
      insuranceAmount:
        p.insuranceAmount ?? (idx === 0 ? invoiceInsurance.toFixed(2) : "0"),
      declaredValue:
        p.declaredValue || (invoice.amount ? invoice.amount.toString() : "0"),
    })),
  };

  const url = `${base.replace(/\/+$/, "")}/customers/${customerId}/integrations/${integrationId}/orders/${invoice.id}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `RSIS ${key}`, // Correct auth format
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error || "XPS put order failed";
    throw new Error(msg);
  }

  return { success: true, raw: data };
}

// In XPS, PUT /orders will create or update the order.
// We reuse putOrderToXps logic by importing it or extracting the logic.
// However, since we need the invoice object to construct the payload,
// and this function signature only has shipmentId/address, we need to fetch the invoice first or change the signature.
// For now, we are handling the "Update" logic directly in the route handler by calling putOrderToXps again.
// So we can essentially alias this or leave it as a placeholder that explains the architecture.
export async function updateShipmentWithXps(
  shipmentId: string,
  address: XpsAddress,
  packages: XpsPackage[],
) {
  // This function is technically redundant as PUT order handles updates.
  // The API route calls putOrderToXps directly.
  return true;
}

export async function cancelShipmentWithXps(shipmentId: string) {
  // XPS doesn't have a direct "cancel order" API in the same way.
  // Usually you just archive it or void the label if printed.
  // For 'pending' orders, we might DELETE /orders/{orderId} if supported
  // But standard practice is just to ignore it or void label.

  const base = process.env.XPS_API_BASE || process.env.NEXT_PUBLIC_XPS_API_BASE;
  const key = process.env.XPS_API_KEY || process.env.NEXT_PUBLIC_XPS_API_KEY;
  const customerId = process.env.XPS_CUSTOMER_ID;
  const integrationId = process.env.XPS_INTEGRATION_ID;

  // Attempt to delete/cancel if API supports it, otherwise just return true
  // Docs: DELETE /customers/{customerId}/integrations/{integrationId}/orders/{orderId}
  const url = `${base?.replace(/\/+$/, "")}/customers/${customerId}/integrations/${integrationId}/orders/${shipmentId}`;

  try {
    await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `RSIS ${key}`,
      },
    });
    return true;
  } catch (e) {
    console.error("Failed to cancel XPS order", e);
    // We don't want to block our local cancel if remote fails
    return false;
  }
}

export type XpsInvoiceContext = {
  id: number;
  invoiceNumber: string;
  externalInvoiceNumber?: string | null;
};

function xpsIdsMatch(a: unknown, b: string): boolean {
  return a != null && String(a) === String(b);
}

function normRef(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

function collectSearchKeywords(ctx: XpsInvoiceContext): string[] {
  const out: string[] = [];
  const add = (s: string | null | undefined) => {
    const t = String(s ?? "").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(String(ctx.id));
  add(ctx.invoiceNumber);
  if (ctx.externalInvoiceNumber) add(ctx.externalInvoiceNumber);
  return out;
}

function refFieldsMatchInvoice(
  shipment: any,
  idStr: string,
  invoiceNumber: string,
  externalInvoiceNumber: string | null | undefined,
): boolean {
  const refs = [
    shipment?.shipmentReference,
    shipment?.shipperReference,
    shipment?.shipperReference2,
  ]
    .map(normRef)
    .filter(Boolean);
  if (refs.length === 0) return false;
  const candidates = [normRef(idStr), normRef(invoiceNumber)];
  if (externalInvoiceNumber) candidates.push(normRef(externalInvoiceNumber));
  return refs.some((r) => candidates.some((c) => c.length > 0 && r === c));
}

function shipmentBelongsToOrder(shipment: any, invoiceId: string): boolean {
  if (xpsIdsMatch(shipment?.fulfillment?.orderId, invoiceId)) return true;
  const orderIds = shipment?.orderIds;
  if (Array.isArray(orderIds) && orderIds.some((id: unknown) => xpsIdsMatch(id, invoiceId))) {
    return true;
  }
  return false;
}

function shipmentBelongsToInvoice(shipment: any, ctx: XpsInvoiceContext): boolean {
  const idStr = String(ctx.id);
  if (shipmentBelongsToOrder(shipment, idStr)) return true;
  if (xpsIdsMatch(shipment?.fulfillment?.orderId, ctx.invoiceNumber)) return true;
  if (
    refFieldsMatchInvoice(
      shipment,
      idStr,
      ctx.invoiceNumber,
      ctx.externalInvoiceNumber,
    )
  ) {
    return true;
  }
  return false;
}

function scoreShipment(s: any): number {
  return (
    (s?.voided ? 0 : 4) +
    (s?.trackingNumber || s?.trackingNumbers?.[0] ? 2 : 0) +
    (s?.bookNumber ? 1 : 0)
  );
}

/** Strict: linkage via fulfillment / orderIds / references / invoice # as order id. */
function pickShipmentStrict(shipments: any[], ctx: XpsInvoiceContext): any | null {
  const matched = shipments.filter((s) => shipmentBelongsToInvoice(s, ctx));
  if (matched.length === 0) return null;
  return [...matched].sort((a, b) => scoreShipment(b) - scoreShipment(a))[0];
}

/**
 * When XPS returns booked rows with fulfillment:null (common for UI-created labels),
 * accept a small result set with a single plausible tracking row.
 */
function pickShipmentLenient(shipments: any[], ctx: XpsInvoiceContext): any | null {
  const idStr = String(ctx.id);
  const nonVoid = shipments.filter((s) => !s?.voided);
  const withTrack = nonVoid.filter(
    (s) => s?.trackingNumber || s?.trackingNumbers?.[0],
  );
  if (shipments.length <= 3 && withTrack.length === 1) return withTrack[0];
  const refMatched = withTrack.filter((s) =>
    refFieldsMatchInvoice(s, idStr, ctx.invoiceNumber, ctx.externalInvoiceNumber),
  );
  if (refMatched.length === 1) return refMatched[0];
  if (shipments.length <= 5 && refMatched.length > 0) {
    return [...refMatched].sort((a, b) => scoreShipment(b) - scoreShipment(a))[0];
  }
  return null;
}

async function fetchSearchShipmentsForKeyword(
  keyword: string,
  base: string,
  key: string,
  customerId: string,
): Promise<any[]> {
  const url = `${base.replace(/\/+$/, "")}/customers/${customerId}/searchShipments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `RSIS ${key}`,
    },
    body: JSON.stringify({ keyword: String(keyword) }),
  });

  if (!res.ok) {
    console.error(
      `[XPS] searchShipments failed for keyword "${keyword}": ${res.status} ${res.statusText}`,
    );
    try {
      console.error(`[XPS] Error body:`, await res.text());
    } catch {
      /* ignore */
    }
    return [];
  }

  const data = await res.json();
  const list = data?.shipments;
  return Array.isArray(list) ? list : [];
}

/** Dedupe by bookNumber across multiple keyword searches. */
async function searchBookedShipmentsMerged(
  ctx: XpsInvoiceContext,
  base: string,
  key: string,
  customerId: string,
): Promise<any[]> {
  const byBook = new Map<string, any>();
  const keywords = collectSearchKeywords(ctx);
  console.log(`[XPS] searchShipments keywords: ${keywords.join(", ")}`);

  let fallbackKey = 0;
  for (const kw of keywords) {
    const list = await fetchSearchShipmentsForKeyword(kw, base, key, customerId);
    for (const s of list) {
      const bn =
        s?.bookNumber != null && String(s.bookNumber).length > 0
          ? String(s.bookNumber)
          : `_row_${fallbackKey++}`;
      if (!byBook.has(bn)) byBook.set(bn, s);
    }
  }

  return [...byBook.values()];
}

function mergeOrderAndShipment(order: any | null, shipment: any | null): any | null {
  if (!order && !shipment) return null;
  if (!order) return shipment;
  if (!shipment) return order;

  const st =
    shipment.trackingNumber ||
    shipment.trackingNumbers?.[0] ||
    null;
  const ordRec = order.receiver || order.destination;
  const shipRec = shipment.receiver || shipment.destination;

  return {
    ...order,
    ...shipment,
    trackingNumber: st || order.trackingNumber,
    trackingNumbers: shipment.trackingNumbers || order.trackingNumbers,
    receiver: shipRec || ordRec,
    destination: order.destination || ordRec || shipRec,
    items: order.items ?? shipment.items,
    packages: order.packages?.length ? order.packages : shipment.packages,
    pieces: shipment.pieces || order.pieces,
  };
}

/**
 * Order search — useful for pending orders (address / items) before a label exists.
 */
async function searchOrderByKeyword(
  keyword: string,
  base: string,
  key: string,
  customerId: string,
  integrationId: string,
): Promise<any | null> {
  const url = `${base.replace(/\/+$/, "")}/customers/${customerId}/integrations/${integrationId}/orders?keyword=${encodeURIComponent(String(keyword))}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `RSIS ${key}` },
  });

  if (!res.ok) {
    console.error(`[XPS] Order search failed: ${res.status} ${res.statusText}`);
    try {
      const errBody = await res.text();
      console.error(`[XPS] Error body:`, errBody);
    } catch {
      /* ignore */
    }
    return null;
  }

  const data = await res.json();
  if (data && Array.isArray(data.orders)) {
    const k = String(keyword);
    const match = data.orders.find(
      (order: any) =>
        xpsIdsMatch(order.orderId, k) ||
        (order.orderNumber && xpsIdsMatch(order.orderNumber, k)),
    );
    if (match) return match;
  }

  return null;
}

async function searchOrderForContext(
  ctx: XpsInvoiceContext,
  base: string,
  key: string,
  customerId: string,
  integrationId: string,
): Promise<any | null> {
  for (const kw of collectSearchKeywords(ctx)) {
    const order = await searchOrderByKeyword(
      kw,
      base,
      key,
      customerId,
      integrationId,
    );
    if (order) return order;
  }
  console.log(`[XPS] No order match for invoice ${ctx.id}`);
  return null;
}

function normalizeToContext(invoiceIdOrCtx: string | XpsInvoiceContext): XpsInvoiceContext {
  if (typeof invoiceIdOrCtx === "object" && invoiceIdOrCtx !== null) {
    return invoiceIdOrCtx;
  }
  const n = Number(invoiceIdOrCtx);
  return {
    id: Number.isFinite(n) ? n : 0,
    invoiceNumber: "",
    externalInvoiceNumber: null,
  };
}

/**
 * Resolves booked shipment (tracking) and/or pending order from XPS.
 * Pass full {@link XpsInvoiceContext} from DB so invoice # / external # can be searched.
 */
export async function getShipmentFromXps(invoiceIdOrCtx: string | XpsInvoiceContext) {
  const base = process.env.XPS_API_BASE || process.env.NEXT_PUBLIC_XPS_API_BASE;
  const key = process.env.XPS_API_KEY || process.env.NEXT_PUBLIC_XPS_API_KEY;
  const customerId = process.env.XPS_CUSTOMER_ID;
  const integrationId = process.env.XPS_INTEGRATION_ID;

  if (!base || !key || !customerId) {
    console.error("[XPS] Missing API base, key, or customer id");
    return null;
  }

  const baseNorm = base.replace(/\/+$/, "");
  const ctx = normalizeToContext(invoiceIdOrCtx);

  const merged = await searchBookedShipmentsMerged(ctx, baseNorm, key, customerId);
  let booked =
    pickShipmentStrict(merged, ctx) || pickShipmentLenient(merged, ctx);

  if (!integrationId) {
    console.error("[XPS] Missing integration id for order fallback");
    return booked;
  }

  const order = await searchOrderForContext(
    ctx,
    baseNorm,
    key,
    customerId,
    integrationId,
  );

  return mergeOrderAndShipment(order, booked);
}
