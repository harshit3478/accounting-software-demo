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

function xpsIdsMatch(a: unknown, b: string): boolean {
  return a != null && String(a) === String(b);
}

function shipmentBelongsToOrder(shipment: any, invoiceId: string): boolean {
  if (xpsIdsMatch(shipment?.fulfillment?.orderId, invoiceId)) return true;
  const orderIds = shipment?.orderIds;
  if (Array.isArray(orderIds) && orderIds.some((id: unknown) => xpsIdsMatch(id, invoiceId))) {
    return true;
  }
  return false;
}

/** Prefer a non-voided shipment with a tracking number when multiple match. */
function pickShipmentForInvoice(shipments: any[], invoiceId: string): any | null {
  const matched = shipments.filter((s) => shipmentBelongsToOrder(s, invoiceId));
  if (matched.length === 0) return null;
  const score = (s: any) =>
    (s?.voided ? 0 : 4) +
    (s?.trackingNumber || s?.trackingNumbers?.[0] ? 2 : 0) +
    (s?.bookNumber ? 1 : 0);
  return [...matched].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Booked labels and tracking live on *shipments*, not on order records.
 * POST searchShipments accepts order id as keyword and returns trackingNumber, etc.
 * @see https://xpsshipper.com/restapi/docs/v1-ecommerce/endpoints/search-shipments/
 */
async function searchBookedShipmentsForOrder(
  invoiceId: string,
  base: string,
  key: string,
  customerId: string,
): Promise<any | null> {
  const url = `${base.replace(/\/+$/, "")}/customers/${customerId}/searchShipments`;
  console.log(`[XPS] searchShipments for order: ${invoiceId}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `RSIS ${key}`,
    },
    body: JSON.stringify({ keyword: String(invoiceId) }),
  });

  if (!res.ok) {
    console.error(`[XPS] searchShipments failed: ${res.status} ${res.statusText}`);
    try {
      console.error(`[XPS] Error body:`, await res.text());
    } catch {
      /* ignore */
    }
    return null;
  }

  const data = await res.json();
  const list = data?.shipments;
  if (!Array.isArray(list) || list.length === 0) return null;

  return pickShipmentForInvoice(list, String(invoiceId));
}

/**
 * Order search — useful for pending orders (address / items) before a label exists.
 * Direct GET /orders/{id} may be forbidden; keyword list is used instead.
 */
async function searchOrderByKeyword(
  invoiceId: string,
  base: string,
  key: string,
  customerId: string,
  integrationId: string,
): Promise<any | null> {
  const url = `${base.replace(/\/+$/, "")}/customers/${customerId}/integrations/${integrationId}/orders?keyword=${encodeURIComponent(String(invoiceId))}`;

  console.log(`[XPS] Fetching order via keyword search: ${url}`);

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
    const match = data.orders.find((order: any) => xpsIdsMatch(order.orderId, String(invoiceId)));
    if (match) return match;
  }

  console.log(`[XPS] Order ${invoiceId} not found in order search results`);
  return null;
}

export async function getShipmentFromXps(invoiceId: string) {
  const base = process.env.XPS_API_BASE || process.env.NEXT_PUBLIC_XPS_API_BASE;
  const key = process.env.XPS_API_KEY || process.env.NEXT_PUBLIC_XPS_API_KEY;
  const customerId = process.env.XPS_CUSTOMER_ID;
  const integrationId = process.env.XPS_INTEGRATION_ID;

  if (!base || !key || !customerId) {
    console.error("[XPS] Missing API base, key, or customer id");
    return null;
  }

  const baseNorm = base.replace(/\/+$/, "");

  const booked = await searchBookedShipmentsForOrder(
    invoiceId,
    baseNorm,
    key,
    customerId,
  );
  if (booked) return booked;

  if (!integrationId) {
    console.error("[XPS] Missing integration id for order fallback");
    return null;
  }

  return searchOrderByKeyword(invoiceId, baseNorm, key, customerId, integrationId);
}
