export interface InvoiceDisplayLike {
  isLayaway?: boolean;
  layawayFee?: number | null;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  shippingFee?: number | null;
  insuranceAmount?: number | null;
  amount?: number | null;
  liveTypeId?: number | null;
  liveTypeSnapshot?: string | null;
  liveType?: {
    name?: string | null;
    country?: string | null;
  } | null;
}

export function resolveInvoiceDate(
  invoiceDate?: string | null,
  createdAt?: string | null,
): string {
  return invoiceDate || createdAt || "";
}

export function shouldShowLayawayFee(invoice: InvoiceDisplayLike): boolean {
  return Boolean(invoice.isLayaway && getVisibleLayawayFee(invoice) > 0);
}

export function getVisibleLayawayFee(invoice: InvoiceDisplayLike): number {
  const storedLayawayFee = Number(invoice.layawayFee || 0);
  if (storedLayawayFee > 0) {
    return Number(storedLayawayFee.toFixed(2));
  }

  if (!invoice.isLayaway) {
    return 0;
  }

  const amount = Number(invoice.amount || 0);
  const subtotal = Number(invoice.subtotal || 0);
  const tax = Number(invoice.tax || 0);
  const discount = Number(invoice.discount || 0);
  const shippingFee = Number(invoice.shippingFee || 0);
  const insuranceAmount = Number(invoice.insuranceAmount || 0);

  const calculated =
    amount - subtotal - tax + discount - shippingFee - insuranceAmount;
  return calculated > 0 ? Number(calculated.toFixed(2)) : 0;
}

export function resolveLiveTypeLabel(
  invoice: InvoiceDisplayLike,
): string | null {
  const liveTypeName = invoice.liveType?.name?.trim();
  const liveTypeCountry = invoice.liveType?.country?.trim();

  if (liveTypeName && liveTypeCountry) {
    return `${liveTypeName} (${liveTypeCountry})`;
  }

  if (liveTypeName) {
    return liveTypeName;
  }

  if (invoice.liveTypeSnapshot?.trim()) {
    return invoice.liveTypeSnapshot.trim();
  }

  return null;
}
