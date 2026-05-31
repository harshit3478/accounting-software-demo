"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";

interface RestockingFeeSetting {
  amount: number;
  isPercentage: boolean;
  isActive: boolean;
}

interface RestockingFeeTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const DEFAULT_SETTING: RestockingFeeSetting = {
  amount: 0,
  isPercentage: false,
  isActive: false,
};

export default function RestockingFeeTab({
  showSuccess,
  showError,
}: RestockingFeeTabProps) {
  const [setting, setSetting] = useState<RestockingFeeSetting>(DEFAULT_SETTING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSetting = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/restocking-fee");
        if (!res.ok) {
          const error = await res.json();
          throw new Error(
            error.error || "Failed to load restocking fee setting",
          );
        }

        const data = await res.json();
        setSetting({
          amount: Number(data?.amount ?? 0),
          isPercentage: !!data?.isPercentage,
          isActive: !!data?.isActive,
        });
      } catch (error: any) {
        showError(error.message || "Failed to load restocking fee setting");
      } finally {
        setIsLoading(false);
      }
    };

    loadSetting();
  }, [showError]);

  const handleSave = async () => {
    if (!Number.isFinite(setting.amount) || setting.amount < 0) {
      showError("Restocking fee must be a valid non-negative number");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/restocking-fee", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save restocking fee setting");
      }

      const data = await res.json();
      setSetting({
        amount: Number(data?.amount ?? setting.amount),
        isPercentage: !!data?.isPercentage,
        isActive: !!data?.isActive,
      });
      showSuccess("Restocking fee setting saved");
    } catch (error: any) {
      showError(error.message || "Failed to save restocking fee setting");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Restocking Fee</h2>
        <p className="text-gray-600 text-sm">
          Configure a single restocking fee for abandoned layaway invoices. The
          fee can be a fixed amount or a percentage of the invoice total.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4 max-w-lg">
          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-3 mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Restocking fee amount
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSetting((prev) => ({ ...prev, isPercentage: false }))
                  }
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    !setting.isPercentage
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Fixed
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSetting((prev) => ({ ...prev, isPercentage: true }))
                  }
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    setting.isPercentage
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={setting.amount}
              onChange={(e) =>
                setSetting((prev) => ({
                  ...prev,
                  amount: Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500 mt-2">
              This fee is deducted before the remaining abandoned amount is
              handled.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Restocking fee enabled
              </p>
              <p className="text-xs text-gray-500">
                Turn this on to show the restocking fee option when abandoning a
                layaway invoice.
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
