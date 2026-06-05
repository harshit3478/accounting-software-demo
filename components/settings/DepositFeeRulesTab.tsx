"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";

interface DepositFeeRule {
  id: number;
  name: string;
  unitName: string;
  minUnit: number | null;
  maxUnit: number | null;
  fee: number;
  isActive: boolean;
  sortOrder: number;
  creator?: {
    id: number;
    name: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface InvoiceUnit {
  id: number;
  name: string;
  isActive: boolean;
  isDefault: boolean;
}

interface DepositFeeRulesTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const FALLBACK_UNIT = "grams";

export default function DepositFeeRulesTab({
  showSuccess,
  showError,
}: DepositFeeRulesTabProps) {
  const [rules, setRules] = useState<DepositFeeRule[]>([]);
  const [units, setUnits] = useState<InvoiceUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<DepositFeeRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    unitName: FALLBACK_UNIT,
    minUnit: "",
    maxUnit: "",
    fee: "0",
    sortOrder: "0",
    isActive: true,
  });

  const activeUnits = useMemo(
    () => units.filter((unit) => unit.isActive),
    [units],
  );
  const unitOptions = activeUnits.length > 0 ? activeUnits : units;
  const defaultUnitName = useMemo(() => {
    return (
      unitOptions.find((unit) => unit.isDefault)?.name ||
      unitOptions[0]?.name ||
      FALLBACK_UNIT
    );
  }, [unitOptions]);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/deposit-fee-rules");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch rules");
      }
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (error: any) {
      showError(error.message || "Failed to fetch rules");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/units?all=true");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch units");
      }
      const data = await res.json();
      setUnits(
        Array.isArray(data)
          ? data.map((unit: any) => ({
              id: Number(unit.id),
              name: String(unit.name || FALLBACK_UNIT),
              isActive: !!unit.isActive,
              isDefault: !!unit.isDefault,
            }))
          : [],
      );
    } catch (error: any) {
      showError(error.message || "Failed to fetch units");
    }
  };

  useEffect(() => {
    fetchUnits();
    fetchRules();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      unitName: defaultUnitName,
      minUnit: "",
      maxUnit: "",
      fee: "0",
      sortOrder: "0",
      isActive: true,
    });
    setEditingRule(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (rule: DepositFeeRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      unitName: rule.unitName || defaultUnitName,
      minUnit: rule.minUnit != null ? String(rule.minUnit) : "",
      maxUnit: rule.maxUnit != null ? String(rule.maxUnit) : "",
      fee: String(rule.fee),
      sortOrder: String(rule.sortOrder ?? 0),
      isActive: !!rule.isActive,
    });
    setShowForm(true);
  };

  const saveRule = async () => {
    if (!form.name.trim()) {
      showError("Rule name is required");
      return;
    }

    if (!form.unitName.trim()) {
      showError("Unit is required");
      return;
    }

    const payload = {
      ...(editingRule ? { id: editingRule.id } : {}),
      name: form.name.trim(),
      unitName: form.unitName.trim(),
      minUnit: form.minUnit === "" ? null : Number(form.minUnit),
      maxUnit: form.maxUnit === "" ? null : Number(form.maxUnit),
      fee: Number(form.fee),
      sortOrder: Number(form.sortOrder || 0),
      isActive: form.isActive,
    };

    if (!Number.isFinite(payload.fee) || payload.fee < 0) {
      showError("Fee must be a valid non-negative number");
      return;
    }

    if (
      payload.minUnit !== null &&
      payload.maxUnit !== null &&
      payload.minUnit > payload.maxUnit
    ) {
      showError("Minimum unit cannot be greater than maximum unit");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/deposit-fee-rules", {
        method: editingRule ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save rule");
      }

      showSuccess(editingRule ? "Rule updated" : "Rule created");
      setShowForm(false);
      resetForm();
      fetchRules();
    } catch (error: any) {
      showError(error.message || "Failed to save rule");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRule = async (rule: DepositFeeRule) => {
    if (!confirm(`Delete deposit rule "${rule.name}"?`)) return;

    try {
      const res = await fetch("/api/deposit-fee-rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete rule");
      }

      showSuccess("Rule deleted");
      fetchRules();
    } catch (error: any) {
      showError(error.message || "Failed to delete rule");
    }
  };

  const formatRange = (rule: DepositFeeRule) => {
    const min = rule.minUnit;
    const max = rule.maxUnit;
    const unit = rule.unitName || FALLBACK_UNIT;

    if (min == null && max == null) return `All ${unit} quantities`;
    if (min != null && max == null) return `${unit} >= ${min}`;
    if (min == null && max != null) return `${unit} <= ${max}`;

    return `${unit} ${(min as number)} - ${max}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Deposit Fee Rules
          </h2>
          <p className="text-gray-600 text-sm">
            Create unit quantity bands that automatically assign a per-item
            deposit fee during invoice entry.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
        >
          <FiPlus className="mr-1.5" />
          Add Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">
            {editingRule
              ? `Edit "${editingRule.name}"`
              : "Create Deposit Fee Rule"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Rule name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                placeholder="e.g. Standard Deposit"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Unit *</label>
              <select
                value={form.unitName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, unitName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              >
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.name}>
                    {unit.name}
                    {unit.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Min units
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minUnit}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, minUnit: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                placeholder="No minimum"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Max units
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.maxUnit}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, maxUnit: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                placeholder="No maximum"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Fee ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fee}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fee: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Sort order
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sortOrder: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                />
                Active
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={saveRule}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
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
      ) : rules.length === 0 ? (
        <p className="text-sm text-gray-500">No deposit fee rules found.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="p-3 rounded-lg border border-gray-200 bg-white"
            >
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Rule
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {rule.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatRange(rule)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Fee
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    ${rule.fee.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {rule.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => openEdit(rule)}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-1"
                  >
                    <FiEdit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => deleteRule(rule)}
                    className="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
                  >
                    <FiTrash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
