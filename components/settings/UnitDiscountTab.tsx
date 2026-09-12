"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { formatBusinessDate, getBusinessTodayString } from "../../lib/business-date";
import {
  DISCOUNT_KIND_SHIPPING_CREDIT,
  DISCOUNT_KIND_UNIT_PERCENT,
  UNIT_DISCOUNT_PAYMENT_WINDOW_DAYS,
  formatShippingThresholdSummary,
  getDiscountKind,
  type DiscountKind,
  type UnitDiscountSettingSnapshot,
} from "../../lib/unit-discount-client";

interface InvoiceUnit {
  id: number;
  name: string;
  isActive: boolean;
  isDefault: boolean;
}

interface ThresholdFormRow {
  minAmount: string;
  maxAmount: string;
  creditAmount: string;
  label: string;
}

interface UnitDiscountTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const FALLBACK_UNIT = "grams";

const DEFAULT_SHIPPING_THRESHOLDS: ThresholdFormRow[] = [
  {
    minAmount: "",
    maxAmount: "500",
    creditAmount: "6",
    label: "Free First Class Shipping",
  },
  {
    minAmount: "501",
    maxAmount: "",
    creditAmount: "14",
    label: "Free Priority Shipping",
  },
];

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
    kind: DISCOUNT_KIND_UNIT_PERCENT as DiscountKind,
    name: "",
    unitName: FALLBACK_UNIT,
    discountPercent: "",
    periodStart: getBusinessTodayString(),
    periodEnd: getBusinessTodayString(),
    thresholds: DEFAULT_SHIPPING_THRESHOLDS,
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
        throw new Error(error.error || "Failed to load discounts");
      }

      const settingsData = await settingsRes.json();
      setSettings(Array.isArray(settingsData) ? settingsData : []);

      if (unitsRes.ok) {
        const unitsData = await unitsRes.json();
        setUnits(Array.isArray(unitsData) ? unitsData : []);
      }
    } catch (error: any) {
      showError(error.message || "Failed to load discounts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({
      kind: DISCOUNT_KIND_UNIT_PERCENT,
      name: "",
      unitName: defaultUnitName,
      discountPercent: "",
      periodStart: getBusinessTodayString(),
      periodEnd: getBusinessTodayString(),
      thresholds: DEFAULT_SHIPPING_THRESHOLDS.map((row) => ({ ...row })),
    });
  };

  const updateThreshold = (
    index: number,
    field: keyof ThresholdFormRow,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      thresholds: prev.thresholds.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    }));
  };

  const handleCreate = async () => {
    if (!form.periodStart || !form.periodEnd) {
      showError("Invoice date period is required");
      return;
    }
    if (form.periodStart > form.periodEnd) {
      showError("Period start cannot be after period end");
      return;
    }

    const payload: Record<string, unknown> = {
      kind: form.kind,
      name: form.name.trim(),
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
    };

    if (form.kind === DISCOUNT_KIND_SHIPPING_CREDIT) {
      if (!form.unitName.trim()) {
        showError("Unit is required");
        return;
      }
      payload.unitName = form.unitName.trim();
      payload.thresholds = form.thresholds.map((row) => ({
        minAmount: row.minAmount === "" ? null : Number(row.minAmount),
        maxAmount: row.maxAmount === "" ? null : Number(row.maxAmount),
        creditAmount: Number(row.creditAmount),
        label: row.label.trim(),
      }));
    } else {
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
      payload.unitName = form.unitName.trim();
      payload.discountPercent = discountPercent;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/unit-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create discount");
      }

      showSuccess(
        form.kind === DISCOUNT_KIND_SHIPPING_CREDIT
          ? "Shipping promo added"
          : "Unit discount added",
      );
      setShowForm(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      showError(error.message || "Failed to create discount");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Unit Discount & Shipping Promos
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Configure cash-invoice promotions by invoice date and unit. Choose a
            unit percent discount, or a shipping credit with invoice-total
            thresholds. Shipping credits apply automatically to cash invoices
            that include the selected unit, are capped at the shipping fee, and
            never apply to layaway invoices. Existing configs cannot be edited.
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Discount type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  form.kind === DISCOUNT_KIND_UNIT_PERCENT
                    ? "border-blue-500 bg-white"
                    : "border-gray-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="discount-kind"
                  checked={form.kind === DISCOUNT_KIND_UNIT_PERCENT}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      kind: DISCOUNT_KIND_UNIT_PERCENT,
                    }))
                  }
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">
                    Unit percent
                  </span>
                  <span className="block text-xs text-gray-500">
                    Percentage off matching units if paid within{" "}
                    {UNIT_DISCOUNT_PAYMENT_WINDOW_DAYS} days.
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  form.kind === DISCOUNT_KIND_SHIPPING_CREDIT
                    ? "border-blue-500 bg-white"
                    : "border-gray-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="discount-kind"
                  checked={form.kind === DISCOUNT_KIND_SHIPPING_CREDIT}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      kind: DISCOUNT_KIND_SHIPPING_CREDIT,
                    }))
                  }
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">
                    Shipping credit
                  </span>
                  <span className="block text-xs text-gray-500">
                    Auto-apply a shipping credit for the selected unit from
                    invoice-total thresholds.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {form.kind === DISCOUNT_KIND_SHIPPING_CREDIT && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promo name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  placeholder="HK Live Free Shipping"
                />
              </div>
            )}

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
            {form.kind === DISCOUNT_KIND_UNIT_PERCENT && (
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
            )}

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
          </div>

          {form.kind === DISCOUNT_KIND_SHIPPING_CREDIT && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Invoice total thresholds
                  </p>
                  <p className="text-xs text-gray-500">
                    The system checks the invoice total before this credit,
                    then applies the matching shipping credit, capped at the
                    shipping fee.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      thresholds: [
                        ...prev.thresholds,
                        {
                          minAmount: "",
                          maxAmount: "",
                          creditAmount: "",
                          label: "",
                        },
                      ],
                    }))
                  }
                  className="px-3 py-1.5 text-xs bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 inline-flex items-center gap-1"
                >
                  <FiPlus size={12} />
                  Add threshold
                </button>
              </div>
              {form.thresholds.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">
                      Min total ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.minAmount}
                      onChange={(e) =>
                        updateThreshold(index, "minAmount", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                      placeholder="No min"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">
                      Max total ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.maxAmount}
                      onChange={(e) =>
                        updateThreshold(index, "maxAmount", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                      placeholder="No max"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">
                      Credit up to ($)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={row.creditAmount}
                      onChange={(e) =>
                        updateThreshold(index, "creditAmount", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                      placeholder="6.00"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <label className="block text-xs text-gray-600 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        updateThreshold(index, "label", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                      placeholder="Free First Class Shipping"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          thresholds: prev.thresholds.filter(
                            (_, rowIndex) => rowIndex !== index,
                          ),
                        }))
                      }
                      disabled={form.thresholds.length <= 1}
                      className="w-full p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                      title="Remove threshold"
                    >
                      <FiTrash2 size={14} className="mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500">
            {form.kind === DISCOUNT_KIND_SHIPPING_CREDIT
              ? "Applies only to cash invoices that include the selected unit and fall in the invoice date period. Layaway invoices are excluded. The matching credit is applied automatically and cannot exceed the shipping fee."
              : `Discount applies only if the cash invoice is fully paid within ${UNIT_DISCOUNT_PAYMENT_WINDOW_DAYS} days of its invoice date.`}
          </p>
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
        <p className="text-sm text-gray-500">No discounts configured.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 font-medium">Details</th>
                <th className="px-4 py-2 font-medium">Invoice period</th>
                <th className="px-4 py-2 font-medium">Applies</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => {
                const kind = getDiscountKind(setting);
                const isShipping = kind === DISCOUNT_KIND_SHIPPING_CREDIT;
                return (
                  <tr key={setting.id} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-gray-900">
                      {isShipping ? "Shipping credit" : "Unit percent"}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {setting.unitName || "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {isShipping ? (
                        <div>
                          {setting.name ? (
                            <p className="font-medium">{setting.name}</p>
                          ) : null}
                          <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                            {(setting.thresholds || []).map((threshold, index) => (
                              <li key={`${setting.id}-${index}`}>
                                {formatShippingThresholdSummary(threshold)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        `${Number(setting.discountPercent).toFixed(2)}%`
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {formatBusinessDate(setting.periodStart)} –{" "}
                      {formatBusinessDate(setting.periodEnd)}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {isShipping
                        ? "Cash invoices, automatic"
                        : `Cash invoices, pay within ${UNIT_DISCOUNT_PAYMENT_WINDOW_DAYS} days`}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
