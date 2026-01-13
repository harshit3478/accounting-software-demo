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

export async function putOrderToXps(invoice: any, address: XpsAddress, packages: XpsPackage[]) {
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

  // Construct payload
  const payload: XpsOrderPayload = {
    orderId: invoice.id.toString(),
    orderDate: new Date().toISOString().split('T')[0],
    orderNumber: invoice.invoiceNumber,
    fulfillmentStatus: "pending",
    weightUnit: "lb", // Defaulting to lb, should be configurable
    dimUnit: "in",    // Defaulting to in
    sender: {
      name: process.env.XPS_SENDER_NAME || "My Company",
      company: process.env.XPS_SENDER_NAME || "My Company",
      address1: process.env.XPS_SENDER_STREET || "123 Main St",
      address2: "",
      city: process.env.XPS_SENDER_CITY || "City",
      state: process.env.XPS_SENDER_STATE || "ST",
      zip: process.env.XPS_SENDER_ZIP || "00000",
      country: process.env.XPS_SENDER_COUNTRY || "US",
      phone: process.env.XPS_SENDER_PHONE
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
      email: address.email
    },
    shippingService: "Ground",
    shippingTotal: invoice.amount ? invoice.amount.toString() : "0.00",
    dueByDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
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
          lineId: (idx + 1).toString()
        }))
      : [{
          productId: "1",
          sku: "1",
          title: "General Item",
          price: invoice.amount ? invoice.amount.toString() : "0",
          quantity: 1,
          weight: packages[0]?.weight || "1",
          imgUrl: "",
          htsNumber: "",
          countryOfOrigin: "US",
          lineId: "1"
      }],
    packages: packages.map(p => ({
      ...p,
      insuranceAmount: p.insuranceAmount || "0",
      declaredValue: p.declaredValue || "0"
    }))
  };

  const url = `${base.replace(/\/+$/, "")}/customers/${customerId}/integrations/${integrationId}/orders/${invoice.id}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `RSIS ${key}`, // Correct auth format
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
export async function updateShipmentWithXps(shipmentId: string, address: XpsAddress, packages: XpsPackage[]) {
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
            "Authorization": `RSIS ${key}`
        }
      });
      return true;
  } catch (e) {
      console.error("Failed to cancel XPS order", e);
      // We don't want to block our local cancel if remote fails
      return false;
  }
}
