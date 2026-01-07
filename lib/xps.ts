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
      name: "My Company", // Should come from settings
      address1: "123 Main St", // Should come from settings
      city: "City",
      state: "ST",
      zip: "00000",
      country: "US"
    },
    receiver: {
      name: address.name || "Unknown",
      company: address.company,
      address1: address.street || "",
      address2: address.street2,
      city: address.city || "",
      state: address.state || "",
      zip: address.postalCode || "",
      country: address.country || "US",
      phone: address.phone,
      email: address.email
    },
    packages: packages
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

// Placeholder for future implementation
export async function createShipmentWithXps(invoice: any, address: XpsAddress) {
  throw new Error("Use putOrderToXps instead");
}

export async function updateShipmentWithXps(shipmentId: string, address: XpsAddress) {
  throw new Error("Not implemented");
}

export async function cancelShipmentWithXps(shipmentId: string) {
  throw new Error("Not implemented");
}
