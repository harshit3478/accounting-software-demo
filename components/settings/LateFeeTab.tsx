"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";

interface LateFeeSetting {
  amount: number;
  isActive: boolean;
}

interface LateFeeTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const DEFAULT_SETTING: LateFeeSetting = {
  amount: 0,
  isActive: false,
};

export default function LateFeeTab({
  showSuccess,
  showError,
}: LateFeeTabProps) {
  const [setting, setSetting] = useState<LateFeeSetting>(DEFAULT_SETTING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSetting = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/late-fee");
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to load late fee setting");
        }

        const data = await res.json();
        setSetting({
          amount: Number(data?.amount ?? 0),
          isActive: !!data?.isActive,
        });
      } catch (error: any) {
        showError(error.message || "Failed to load late fee setting");
      } finally {
        setIsLoading(false);
      }
    };

    loadSetting();
  }, [showError]);

  const handleSave = async () => {
    if (!Number.isFinite(setting.amount) || setting.amount < 0) {
      showError("Late fee amount must be a valid non-negative number");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/late-fee", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...setting,
          isActive: setting.amount > 0 ? true : setting.isActive,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save late fee setting");
      }

      const data = await res.json();
      setSetting({
        amount: Number(data?.amount ?? setting.amount),
        isActive: !!data?.isActive,
      });
      showSuccess("Late fee setting saved");
    } catch (error: any) {
      showError(error.message || "Failed to save late fee setting");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Late Fee</h2>
        <p className="text-gray-600 text-sm">
          Set a single late-fee amount for overdue layaway installment payments.
          Set the amount to 0 to disable it.
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
              Late fee amount ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={setting.amount}
              onChange={(e) => {
                const amount = Number(e.target.value);
                setSetting((prev) => ({
                  ...prev,
                  amount,
                  isActive: amount > 0 ? true : prev.isActive,
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500 mt-2">
              This amount will be added as a separate payment when an overdue
              installment is paid and the user agrees to the fee.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Late fee enabled
              </p>
              <p className="text-xs text-gray-500">
                Turn this on to prompt users when a late installment payment is
                linked.
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
