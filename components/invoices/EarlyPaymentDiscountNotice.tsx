"use client";

import type { EarlyPaymentEligibilityResult } from "../../lib/early-payment-discount-client";

interface EarlyPaymentDiscountNoticeProps {
  eligibility: EarlyPaymentEligibilityResult;
  displayRemaining?: number;
  grossRemaining?: number;
  className?: string;
}

export default function EarlyPaymentDiscountNotice({
  eligibility,
  displayRemaining,
  grossRemaining,
  className = "mb-3",
}: EarlyPaymentDiscountNoticeProps) {
  return (
    <div
      className={`rounded-lg border border-emerald-200 bg-emerald-50 p-4 ${className}`}
    >
      <p className="text-sm font-semibold text-emerald-900">
        Eligible for early payment discount
      </p>
      <p className="text-xs text-emerald-800 mt-1">
        This cash invoice qualifies for a {eligibility.discountPercent}% early
        payment discount (${eligibility.discountAmount.toFixed(2)}) when paid
        within {eligibility.daysWindow} days of the invoice date.
        {displayRemaining !== undefined && (
          <>
            {" "}
            Amount due after discount:{" "}
            <span className="font-semibold">
              ${displayRemaining.toFixed(2)}
            </span>
            {grossRemaining !== undefined &&
              grossRemaining + 0.01 > displayRemaining && (
                <span className="line-through text-emerald-700/70 ml-1">
                  ${grossRemaining.toFixed(2)}
                </span>
              )}
            .
          </>
        )}
        {eligibility.storeCreditAmount > 0.01 && (
          <>
            {" "}
            Paying above the discounted amount will add $
            {eligibility.storeCreditAmount.toFixed(2)} to store credit.
          </>
        )}
      </p>
    </div>
  );
}
