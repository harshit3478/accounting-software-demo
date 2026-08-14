"use client";

import { formatBusinessDate } from "../../lib/business-date";
import {
  UNIT_DISCOUNT_PAYMENT_WINDOW_DAYS,
  type UnitDiscountOfferSnapshot,
} from "../../lib/unit-discount-client";

interface UnitDiscountOfferNoticeProps {
  offer: UnitDiscountOfferSnapshot;
  applied?: boolean;
  className?: string;
}

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export default function UnitDiscountOfferNotice({
  offer,
  applied = false,
  className = "mb-3",
}: UnitDiscountOfferNoticeProps) {
  return (
    <div
      className={`rounded-lg border border-emerald-200 bg-emerald-50 p-4 ${className}`}
    >
      <p className="text-sm font-semibold text-emerald-900">
        {applied
          ? `${formatCurrency(offer.totalDiscount)} unit discount applied`
          : `${formatCurrency(offer.totalDiscount)} off this invoice`}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-emerald-800">
        {offer.breakdown.map((line) => (
          <li key={`${line.unitName}-${line.discountPercent}`}>
            {line.unitName}: {line.discountPercent}% of{" "}
            {formatCurrency(line.itemAmount)} = {formatCurrency(line.discountAmount)} off
          </li>
        ))}
      </ul>
      {!applied && (
        <p className="mt-2 text-xs text-emerald-800">
          If this invoice is fully paid within{" "}
          {UNIT_DISCOUNT_PAYMENT_WINDOW_DAYS} days (by{" "}
          <span className="font-semibold">
            {formatBusinessDate(offer.paymentDueDate)}
          </span>
          ), you save {formatCurrency(offer.totalDiscount)}.
        </p>
      )}
    </div>
  );
}
