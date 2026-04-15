"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";

interface ShippingFeeRule {
  id: number;
  name: string;
  minAmount: number | null;
  maxAmount: number | null;
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

interface ShippingFeeRulesTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function ShippingFeeRulesTab({
  showSuccess,
  showError,
}: ShippingFeeRulesTabProps) {
  const [rules, setRules] = useState<ShippingFeeRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<ShippingFeeRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    minAmount: "",
    maxAmount: "",
    fee: "0",
    sortOrder: "0",
    isActive: true,
  });

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/shipping-fee-rules");
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

  useEffect(() => {
    fetchRules();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      minAmount: "",
      maxAmount: "",
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

  const openEdit = (rule: ShippingFeeRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      minAmount: rule.minAmount != null ? String(rule.minAmount) : "",
      maxAmount: rule.maxAmount != null ? String(rule.maxAmount) : "",
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

    const payload = {
      ...(editingRule ? { id: editingRule.id } : {}),
      name: form.name.trim(),
      minAmount: form.minAmount === "" ? null : Number(form.minAmount),
      maxAmount: form.maxAmount === "" ? null : Number(form.maxAmount),
      fee: Number(form.fee),
      sortOrder: Number(form.sortOrder || 0),
      isActive: form.isActive,
    };

    if (!Number.isFinite(payload.fee) || payload.fee < 0) {
      showError("Fee must be a valid non-negative number");
      return;
    }

    if (
      payload.minAmount !== null &&
      payload.maxAmount !== null &&
      payload.minAmount > payload.maxAmount
    ) {
      showError("Minimum amount cannot be greater than maximum amount");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/shipping-fee-rules", {
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

  const deleteRule = async (rule: ShippingFeeRule) => {
    if (!confirm(`Delete shipping rule "${rule.name}"?`)) return;

    try {
      const res = await fetch("/api/shipping-fee-rules", {
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

  const formatRange = (rule: ShippingFeeRule) => {
    const min = rule.minAmount;
    const max = rule.maxAmount;

    if (min == null && max == null) return "All invoice amounts";
    if (min != null && max == null) return `Subtotal >= $${min.toFixed(2)}`;
    if (min == null && max != null) return `Subtotal <= $${max.toFixed(2)}`;

    return `Subtotal $${(min as number).toFixed(2)} - $${(max as number).toFixed(2)}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Shipping Fee Rules
          </h2>
          <p className="text-gray-600 text-sm">
            Admins and superadmins can create multiple shipping fee rules for
            invoice creation.
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
              : "Create Shipping Fee Rule"}
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
                placeholder="e.g. Standard Shipping"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Min subtotal ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minAmount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, minAmount: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                placeholder="No minimum"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Max subtotal ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.maxAmount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, maxAmount: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                placeholder="No maximum"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Shipping fee ($) *
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
                step="1"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sortOrder: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>
            <div className="flex items-center">
              <input
                id="shipping-rule-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="mr-2 w-4 h-4 text-blue-600 rounded"
              />
              <label
                htmlFor="shipping-rule-active"
                className="text-sm text-gray-700"
              >
                Active
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={saveRule}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingRule ? "Update" : "Create"}
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
      ) : (
        <div className="space-y-2">
          {rules.length === 0 ? (
            <p className="text-sm text-gray-500">
              No shipping fee rules configured yet.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-3 rounded-lg border ${
                  rule.isActive
                    ? "border-gray-200 bg-white"
                    : "border-gray-100 bg-gray-50 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{rule.name}</p>
                      {!rule.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatRange(rule)}
                    </p>
                    <p className="text-sm font-semibold text-blue-700 mt-1">
                      Fee: ${Number(rule.fee).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(rule)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <FiEdit2 size={14} />
                    </button>
                    <button
                      onClick={() => deleteRule(rule)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
