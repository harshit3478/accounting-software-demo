export interface XpsAddress {
  name?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

export async function createShipmentWithXps(invoice: any, address: XpsAddress) {
  const base = process.env.XPS_API_BASE || process.env.NEXT_PUBLIC_XPS_API_BASE;
  const key = process.env.XPS_API_KEY || process.env.NEXT_PUBLIC_XPS_API_KEY;

  if (!base || !key) {
    throw new Error("XPS API base URL or API key not configured");
  }

  // Build a best-effort payload. XPS API details may differ; adapt as needed.
  const payload = {
    order_reference: invoice.invoiceNumber,
    recipient: {
      name: address.name,
      street: address.street,
      city: address.city,
      state: address.state,
      postal_code: address.postalCode,
      country: address.country,
      phone: address.phone,
    },
    parcels: [
      {
        quantity: 1,
        weight_kg: 1,
        value: Number(invoice.amount) || 0,
      },
    ],
    // include invoice payload for reference
    metadata: {
      invoiceId: invoice.id,
      clientName: invoice.clientName,
    },
  };

  const res = await fetch(`${base.replace(/\/+$/, "")}/shipments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data?.error || "XPS create shipment failed";
    throw new Error(msg);
  }

  // Try multiple common shapes for returned shipment and tracking
  const shipmentId =
    data?.id || data?.shipment_id || data?.shipmentId || data?.data?.id;
  const trackingNumber =
    data?.tracking_number ||
    data?.tracking ||
    data?.data?.tracking_number ||
    data?.data?.tracking;

  return { shipmentId, trackingNumber, raw: data };
}

export async function updateShipmentWithXps(
  shipmentId: string,
  address: XpsAddress
) {
  const base = process.env.XPS_API_BASE || process.env.NEXT_PUBLIC_XPS_API_BASE;
  const key = process.env.XPS_API_KEY || process.env.NEXT_PUBLIC_XPS_API_KEY;

  if (!base || !key) {
    throw new Error("XPS API base URL or API key not configured");
  }

  const payload = {
    recipient: {
      name: address.name,
      street: address.street,
      city: address.city,
      state: address.state,
      postal_code: address.postalCode,
      country: address.country,
      phone: address.phone,
    },
  };

  const res = await fetch(
    `${base.replace(/\/+$/, "")}/shipments/${encodeURIComponent(shipmentId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data?.error || "XPS update shipment failed";
    throw new Error(msg);
  }

  const returnedShipmentId =
    data?.id ||
    data?.shipment_id ||
    data?.shipmentId ||
    data?.data?.id ||
    shipmentId;
  const trackingNumber =
    data?.tracking_number ||
    data?.tracking ||
    data?.data?.tracking_number ||
    data?.data?.tracking;

  return { shipmentId: returnedShipmentId, trackingNumber, raw: data };
}

export async function cancelShipmentWithXps(shipmentId: string) {
  const base = process.env.XPS_API_BASE || process.env.NEXT_PUBLIC_XPS_API_BASE;
  const key = process.env.XPS_API_KEY || process.env.NEXT_PUBLIC_XPS_API_KEY;

  if (!base || !key) {
    throw new Error("XPS API base URL or API key not configured");
  }

  const res = await fetch(
    `${base.replace(/\/+$/, "")}/shipments/${encodeURIComponent(shipmentId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    }
  );

  const data = await (res.status === 204 ? Promise.resolve({}) : res.json());
  if (!res.ok && res.status !== 204) {
    const msg = data?.message || data?.error || "XPS cancel shipment failed";
    throw new Error(msg);
  }

  return { success: true, raw: data };
}
