"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";

interface RecalculationFeeSetting {
  ratePercent: number;
  isActive: boolean;
}

interface RecalculationFeeTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const DEFAULT_SETTING: RecalculationFeeSetting = {
  ratePercent: 0,
  isActive: false,
};

export default function RecalculationFeeTab({
  showSuccess,
  showError,
}: RecalculationFeeTabProps) {
  const [setting, setSetting] =
    useState<RecalculationFeeSetting>(DEFAULT_SETTING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSetting = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/recalculation-fee");
        if (!res.ok) {
          const error = await res.json();
          throw new Error(
            error.error || "Failed to load recalculation fee setting",
          );
        }

        const data = await res.json();
        setSetting({
          ratePercent: Number(data?.ratePercent ?? 0),
          isActive: !!data?.isActive,
        });
      } catch (error: any) {
        showError(error.message || "Failed to load recalculation fee setting");
      } finally {
        setIsLoading(false);
      }
    };

    loadSetting();
  }, [showError]);

  const handleSave = async () => {
    if (!Number.isFinite(setting.ratePercent) || setting.ratePercent < 0) {
      showError("Recalculation fee rate must be a valid non-negative number");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/recalculation-fee", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          error.error || "Failed to save recalculation fee setting",
        );
      }

      const data = await res.json();
      setSetting({
        ratePercent: Number(data?.ratePercent ?? setting.ratePercent),
        isActive: !!data?.isActive,
      });
      showSuccess("Recalculation fee setting saved");
    } catch (error: any) {
      showError(error.message || "Failed to save recalculation fee setting");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Recalculating Fee
        </h2>
        <p className="text-gray-600 text-sm">
          Apply a percentage fee to the remaining layaway balance when the term
          length changes. Set the rate to 0 to disable it.
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
              Recalculation fee rate (%)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={setting.ratePercent}
              onChange={(e) =>
                setSetting((prev) => ({
                  ...prev,
                  ratePercent: Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500 mt-2">
              Fee is calculated from the remaining unpaid layaway balance.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Recalculation enabled
              </p>
              <p className="text-xs text-gray-500">
                Turn this on to apply the fee when a layaway term is changed.
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
