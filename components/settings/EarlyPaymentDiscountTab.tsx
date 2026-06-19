"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";

type EarlyPaymentThreshold = "full" | "half";

interface EarlyPaymentDiscountSetting {
  daysWindow: number;
  discountPercent: number;
  paymentThreshold: EarlyPaymentThreshold;
  isActive: boolean;
}

interface EarlyPaymentDiscountTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const DEFAULT_SETTING: EarlyPaymentDiscountSetting = {
  daysWindow: 0,
  discountPercent: 0,
  paymentThreshold: "full",
  isActive: false,
};

export default function EarlyPaymentDiscountTab({
  showSuccess,
  showError,
}: EarlyPaymentDiscountTabProps) {
  const [setting, setSetting] =
    useState<EarlyPaymentDiscountSetting>(DEFAULT_SETTING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSetting = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/early-payment-discount");
        if (!res.ok) {
          const error = await res.json();
          throw new Error(
            error.error || "Failed to load early payment discount setting",
          );
        }

        const data = await res.json();
        setSetting({
          daysWindow: Number(data?.daysWindow ?? 0),
          discountPercent: Number(data?.discountPercent ?? 0),
          paymentThreshold:
            data?.paymentThreshold === "half" ? "half" : "full",
          isActive: !!data?.isActive,
        });
      } catch (error: any) {
        showError(
          error.message || "Failed to load early payment discount setting",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSetting();
  }, [showError]);

  const handleSave = async () => {
    if (!Number.isFinite(setting.daysWindow) || setting.daysWindow < 0) {
      showError("Days window must be a valid non-negative number");
      return;
    }

    if (!Number.isFinite(setting.discountPercent) || setting.discountPercent < 0) {
      showError("Discount percent must be a valid non-negative number");
      return;
    }

    if (setting.discountPercent > 100) {
      showError("Discount percent cannot exceed 100");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/early-payment-discount", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          error.error || "Failed to save early payment discount setting",
        );
      }

      const data = await res.json();
      setSetting({
        daysWindow: Number(data?.daysWindow ?? setting.daysWindow),
        discountPercent: Number(data?.discountPercent ?? setting.discountPercent),
        paymentThreshold:
          data?.paymentThreshold === "half" ? "half" : "full",
        isActive: !!data?.isActive,
      });
      showSuccess("Early payment discount setting saved");
    } catch (error: any) {
      showError(
        error.message || "Failed to save early payment discount setting",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Early Payment Discount
        </h2>
        <p className="text-gray-600 text-sm">
          Automatically apply a percentage discount when an invoice is paid
          within the configured number of days. Leave days or discount at 0 to
          disable.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4 max-w-lg">
          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment window (days)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={setting.daysWindow}
              onChange={(e) => {
                const daysWindow = Number(e.target.value);
                setSetting((prev) => ({
                  ...prev,
                  daysWindow,
                  isActive:
                    daysWindow > 0 && prev.discountPercent > 0
                      ? true
                      : prev.isActive,
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              placeholder="10"
            />
            <p className="text-xs text-gray-500 mt-2">
              Number of days from the invoice date during which early payment
              qualifies for the discount.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Discount percent (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={setting.discountPercent}
              onChange={(e) => {
                const discountPercent = Number(e.target.value);
                setSetting((prev) => ({
                  ...prev,
                  discountPercent,
                  isActive:
                    prev.daysWindow > 0 && discountPercent > 0
                      ? true
                      : prev.isActive,
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              placeholder="2"
            />
            <p className="text-xs text-gray-500 mt-2">
              Example: 2% off a $1,000 invoice gives a $20 early payment
              discount and a $980 total.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-3">
            <p className="text-sm font-medium text-gray-700">
              Minimum payment to qualify
            </p>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={setting.paymentThreshold === "full"}
                onChange={() =>
                  setSetting((prev) => ({
                    ...prev,
                    paymentThreshold: "full",
                  }))
                }
                className="mt-0.5"
              />
              Full payment — customer must pay the full invoice amount
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={setting.paymentThreshold === "half"}
                onChange={() =>
                  setSetting((prev) => ({
                    ...prev,
                    paymentThreshold: "half",
                  }))
                }
                className="mt-0.5"
              />
              Half payment — customer must pay at least 50% of the invoice
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Early payment discount enabled
              </p>
              <p className="text-xs text-gray-500">
                When disabled, no automatic discount is applied regardless of
                payment timing.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSetting((prev) => ({
                  ...prev,
                  isActive: !prev.isActive,
                }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                setting.isActive ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  setting.isActive ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 flex items-center gap-1"
          >
            <FiSave size={14} />
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
