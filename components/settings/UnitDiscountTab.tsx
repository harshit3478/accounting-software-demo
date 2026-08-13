"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { formatBusinessDate, getBusinessTodayString } from "../../lib/business-date";
import type { UnitDiscountSettingSnapshot } from "../../lib/unit-discount-client";

interface InvoiceUnit {
  id: number;
  name: string;
  isActive: boolean;
  isDefault: boolean;
}

interface UnitDiscountTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const FALLBACK_UNIT = "grams";

export default function UnitDiscountTab({
  showSuccess,
  showError,
}: UnitDiscountTabProps) {
  const [settings, setSettings] = useState<UnitDiscountSettingSnapshot[]>([]);
  const [units, setUnits] = useState<InvoiceUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    unitName: FALLBACK_UNIT,
    discountPercent: "",
    periodStart: getBusinessTodayString(),
    periodEnd: getBusinessTodayString(),
    paymentDueDate: getBusinessTodayString(),
  });

  const activeUnits = useMemo(
    () => units.filter((unit) => unit.isActive),
    [units],
  );
  const unitOptions = activeUnits.length > 0 ? activeUnits : units;
  const defaultUnitName =
    unitOptions.find((unit) => unit.isDefault)?.name ||
    unitOptions[0]?.name ||
    FALLBACK_UNIT;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, unitsRes] = await Promise.all([
        fetch("/api/unit-discount"),
        fetch("/api/units?all=true"),
      ]);

      if (!settingsRes.ok) {
        const error = await settingsRes.json();
        throw new Error(error.error || "Failed to load unit discounts");
      }

      const settingsData = await settingsRes.json();
      setSettings(Array.isArray(settingsData) ? settingsData : []);

      if (unitsRes.ok) {
        const unitsData = await unitsRes.json();
        setUnits(Array.isArray(unitsData) ? unitsData : []);
      }
    } catch (error: any) {
      showError(error.message || "Failed to load unit discounts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({
      unitName: defaultUnitName,
      discountPercent: "",
      periodStart: getBusinessTodayString(),
      periodEnd: getBusinessTodayString(),
      paymentDueDate: getBusinessTodayString(),
    });
  };

  const handleCreate = async () => {
    const discountPercent = Number(form.discountPercent);
    if (!form.unitName.trim()) {
      showError("Unit is required");
      return;
    }
    if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
      showError("Discount percent must be greater than 0");
      return;
    }
    if (discountPercent > 100) {
      showError("Discount percent cannot exceed 100");
      return;
    }
    if (!form.periodStart || !form.periodEnd) {
      showError("Invoice date period is required");
      return;
    }
    if (form.periodStart > form.periodEnd) {
      showError("Period start cannot be after period end");
      return;
    }
    if (!form.paymentDueDate) {
      showError("Payment due date is required");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/unit-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitName: form.unitName.trim(),
          discountPercent,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          paymentDueDate: form.paymentDueDate,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create unit discount");
      }

      showSuccess("Unit discount added");
      setShowForm(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      showError(error.message || "Failed to create unit discount");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Unit Discount</h2>
          <p className="text-gray-600 text-sm mt-1">
            Percentage off cash invoices by unit when the invoice date falls in
            the configured period. The discount is applied only if the invoice
            is fully paid by the payment due date. Existing configs cannot be
            edited.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm inline-flex items-center gap-1"
        >
          <FiPlus size={14} />
          Add discount
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <select
                value={form.unitName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, unitName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
              >
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.name}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount percent (%)
              </label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={form.discountPercent}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    discountPercent: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice period start
              </label>
              <input
                type="date"
                value={form.periodStart}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, periodStart: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice period end
              </label>
              <input
                type="date"
                value={form.periodEnd}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, periodEnd: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment due date
              </label>
              <input
                type="date"
                value={form.paymentDueDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    paymentDueDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">
                Discount applies only if the cash invoice is fully paid on or
                before this date.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : settings.length === 0 ? (
        <p className="text-sm text-gray-500">No unit discounts configured.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 font-medium">Discount</th>
                <th className="px-4 py-2 font-medium">Invoice period</th>
                <th className="px-4 py-2 font-medium">Pay by</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.id} className="border-t border-gray-200">
                  <td className="px-4 py-2 text-gray-900">{setting.unitName}</td>
                  <td className="px-4 py-2 text-gray-900">
                    {Number(setting.discountPercent).toFixed(2)}%
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {formatBusinessDate(setting.periodStart)} –{" "}
                    {formatBusinessDate(setting.periodEnd)}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {formatBusinessDate(setting.paymentDueDate)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        setting.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {setting.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
