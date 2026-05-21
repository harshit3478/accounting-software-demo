"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiEdit2, FiX } from "react-icons/fi";

interface LayawayFeeRate {
  months: number;
  ratePerGram: number;
  isActive?: boolean;
  sortOrder?: number;
}

interface LayawayDefaults {
  defaultMonths: number;
  defaultFrequency: "monthly" | "bi-weekly" | "weekly";
  defaultDownPaymentPercent: number;
  minMonths: number;
  maxMonths: number;
  policyText: string;
}

const DEFAULT_SETTINGS: LayawayDefaults = {
  defaultMonths: 3,
  defaultFrequency: "monthly",
  defaultDownPaymentPercent: 20,
  minMonths: 1,
  maxMonths: 24,
  policyText: "",
};

const STORAGE_KEY = "layaway-defaults";

const FALLBACK_FEE_RATES: LayawayFeeRate[] = [
  { months: 1, ratePerGram: 3 },
  { months: 2, ratePerGram: 4 },
  { months: 3, ratePerGram: 5 },
  { months: 4, ratePerGram: 8 },
  { months: 5, ratePerGram: 9 },
  { months: 6, ratePerGram: 10 },
];

interface LayawaySettingsTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function LayawaySettingsTab({
  showSuccess,
}: LayawaySettingsTabProps) {
  const [settings, setSettings] = useState<LayawayDefaults>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [feeRates, setFeeRates] =
    useState<LayawayFeeRate[]>(FALLBACK_FEE_RATES);
  const [feeRatesLoading, setFeeRatesLoading] = useState(true);
  const [feeRatesSaving, setFeeRatesSaving] = useState(false);
  const [feeRatesChanged, setFeeRatesChanged] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const loadRates = async () => {
      setFeeRatesLoading(true);
      try {
        const res = await fetch("/api/layaway-fees");
        if (!res.ok) {
          throw new Error("Failed to load layaway fee rates");
        }

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const normalized = FALLBACK_FEE_RATES.map((fallback) => {
            const match = data.find(
              (rate: any) => Number(rate.months) === fallback.months,
            );
            return {
              months: fallback.months,
              ratePerGram: Number(match?.ratePerGram ?? fallback.ratePerGram),
              isActive: match?.isActive ?? true,
              sortOrder: match?.sortOrder ?? fallback.months,
            };
          });
          setFeeRates(normalized);
        }
      } catch {
        setFeeRates(FALLBACK_FEE_RATES);
      } finally {
        setFeeRatesLoading(false);
      }
    };

    loadRates();
  }, []);

  const updateField = <K extends keyof LayawayDefaults>(
    key: K,
    value: LayawayDefaults[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setHasChanges(false);
    showSuccess("Layaway defaults saved");
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
    setHasChanges(false);
    showSuccess("Layaway defaults reset");
  };

  const handleFeeRateChange = (months: number, value: string) => {
    const parsed = Number(value);
    setFeeRates((prev) =>
      prev.map((rate) =>
        rate.months === months
          ? {
              ...rate,
              ratePerGram: Number.isFinite(parsed) ? parsed : 0,
            }
          : rate,
      ),
    );
    setFeeRatesChanged(true);
  };

  const handleSaveFeeRates = async () => {
    setFeeRatesSaving(true);
    try {
      const res = await fetch("/api/layaway-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rates: [...feeRates]
            .sort((left, right) => left.months - right.months)
            .map((rate, index) => ({
              months: rate.months,
              ratePerGram: rate.ratePerGram,
              isActive: rate.isActive ?? true,
              sortOrder: rate.sortOrder ?? index + 1,
            })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save layaway fee rates");
      }

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setFeeRates(
          data
            .map((rate: any) => ({
              months: Number(rate.months),
              ratePerGram: Number(rate.ratePerGram),
              isActive: rate.isActive ?? true,
              sortOrder: Number(rate.sortOrder ?? rate.months),
            }))
            .sort((left, right) => left.months - right.months),
        );
      }

      setFeeRatesChanged(false);
      showSuccess("Layaway fee schedule saved");
    } catch (error: any) {
      showSuccess(error.message || "Failed to save layaway fee rates");
    } finally {
      setFeeRatesSaving(false);
    }
  };

  const sampleWeight = 1000;

  // Compute preview
  const sampleTotal = 1000;
  const dp = (sampleTotal * settings.defaultDownPaymentPercent) / 100;
  const remaining = sampleTotal - dp;
  let numInstallments: number;
  if (settings.defaultFrequency === "monthly")
    numInstallments = settings.defaultMonths;
  else if (settings.defaultFrequency === "bi-weekly")
    numInstallments = settings.defaultMonths * 2;
  else numInstallments = settings.defaultMonths * 4;
  const installmentAmt = numInstallments > 0 ? remaining / numInstallments : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Layaway Configuration
        </h2>
        <p className="text-sm text-gray-500">
          Set default values for layaway plans and edit the fixed fee schedule
          used for layaway invoices.
        </p>
      </div>

      {/* Default Plan Settings */}
      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
          Default Plan Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Duration (months)
            </label>
            <input
              type="number"
              min={settings.minMonths}
              max={settings.maxMonths}
              value={settings.defaultMonths}
              onChange={(e) =>
                updateField(
                  "defaultMonths",
                  Math.min(
                    settings.maxMonths,
                    Math.max(settings.minMonths, parseInt(e.target.value) || 1),
                  ),
                )
              }
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Payment Frequency
            </label>
            <select
              value={settings.defaultFrequency}
              onChange={(e) =>
                updateField(
                  "defaultFrequency",
                  e.target.value as LayawayDefaults["defaultFrequency"],
                )
              }
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="bi-weekly">Bi-Weekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Down Payment (%)
            </label>
            <input
              type="number"
              min="0"
              max="90"
              value={settings.defaultDownPaymentPercent}
              onChange={(e) =>
                updateField(
                  "defaultDownPaymentPercent",
                  Math.min(90, Math.max(0, parseFloat(e.target.value) || 0)),
                )
              }
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Percentage of invoice total used as default down payment
            </p>
          </div>
        </div>
      </div>

      {/* Duration Limits */}
      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
          Duration Limits
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Duration (months)
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={settings.minMonths}
              onChange={(e) =>
                updateField(
                  "minMonths",
                  Math.min(12, Math.max(1, parseInt(e.target.value) || 1)),
                )
              }
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Duration (months)
            </label>
            <input
              type="number"
              min="1"
              max="36"
              value={settings.maxMonths}
              onChange={(e) =>
                updateField(
                  "maxMonths",
                  Math.min(36, Math.max(1, parseInt(e.target.value) || 1)),
                )
              }
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Layaway Fee Schedule */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
              Layaway Fee Schedule
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Fixed 1-6 month rows. You can edit the rates, but cannot add or
              remove rows.
            </p>
          </div>
          <button
            onClick={handleSaveFeeRates}
            disabled={feeRatesSaving || feeRatesLoading || !feeRatesChanged}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <FiCheck />
            {feeRatesSaving ? "Saving..." : "Save Fee Schedule"}
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Month
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Rate / Gram
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Sample Fee on 1000g
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {feeRates
                .slice()
                .sort((left, right) => left.months - right.months)
                .map((rate) => (
                  <tr key={rate.months}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {rate.months} {rate.months === 1 ? "Month" : "Months"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-xs">
                        <span className="text-xs text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rate.ratePerGram}
                          onChange={(e) =>
                            handleFeeRateChange(rate.months, e.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="whitespace-nowrap text-xs text-gray-500">
                          per gram
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      ${(sampleWeight * rate.ratePerGram).toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FiEdit2 />
          <span>
            The fee is calculated as total grams multiplied by the rate for the
            selected layaway month.
          </span>
        </div>
      </div>

      {/* Policy Text */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
          Policy Text
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Layaway Policy (optional)
          </label>
          <textarea
            value={settings.policyText}
            onChange={(e) => updateField("policyText", e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. All layaway payments are non-refundable. Items will be held for the duration of the plan."
          />
          <p className="text-xs text-gray-500 mt-1">
            This text can be included on invoices with layaway plans
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          Preview (based on $1,000 invoice)
        </h3>
        <div className="space-y-2">
          {dp > 0 && (
            <div className="flex justify-between text-sm text-gray-700">
              <span>Down Payment ({settings.defaultDownPaymentPercent}%)</span>
              <span className="font-medium">${dp.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-700">
            <span>
              {numInstallments}{" "}
              {settings.defaultFrequency === "monthly"
                ? "monthly"
                : settings.defaultFrequency === "bi-weekly"
                  ? "bi-weekly"
                  : "weekly"}{" "}
              payment{numInstallments !== 1 ? "s" : ""}
            </span>
            <span className="font-medium">
              ${installmentAmt.toFixed(2)} each
            </span>
          </div>
          <div className="border-t border-gray-300 pt-2 flex justify-between text-sm font-semibold text-gray-900">
            <span>Total</span>
            <span>${sampleTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
