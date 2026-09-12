"use client";

import { parseShippingDiscountOffer } from "../../lib/unit-discount-client";

interface ShippingDiscountNoticeProps {
  offer: {
    name?: string;
    label: string;
    creditCap: number;
    creditAmount: number;
    invoiceTotal: number;
    shippingFee: number;
    unitName?: string;
  };
  className?: string;
}

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export default function ShippingDiscountNotice({
  offer,
  className = "mb-3",
}: ShippingDiscountNoticeProps) {
  const parsed = parseShippingDiscountOffer(offer) || offer;
  const title = parsed.name
    ? `${parsed.name}: ${formatCurrency(parsed.creditAmount)} shipping credit`
    : `${formatCurrency(parsed.creditAmount)} shipping credit applied`;

  return (
    <div
      className={`rounded-lg border border-sky-200 bg-sky-50 p-4 ${className}`}
    >
      <p className="text-sm font-semibold text-sky-900">{title}</p>
      <p className="mt-1 text-xs text-sky-800">
        {parsed.label}: credit capped at {formatCurrency(parsed.creditCap)}{" "}
        based on invoice total {formatCurrency(parsed.invoiceTotal)}. Actual
        credit is {formatCurrency(parsed.creditAmount)} of{" "}
        {formatCurrency(parsed.shippingFee)} shipping.
      </p>
      <p className="mt-1 text-xs text-sky-700">
        Applies to cash invoices with unit{" "}
        <span className="font-semibold">
          {parsed.unitName || "the selected unit"}
        </span>
        . Layaway invoices are excluded.
      </p>
    </div>
  );
}
