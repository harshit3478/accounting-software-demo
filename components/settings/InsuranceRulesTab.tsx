"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";

interface InsuranceRule {
  id: number;
  maxValue: number;
  clientShare: number;
  sortOrder: number;
}

interface InsuranceRulesTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function InsuranceRulesTab({
  showSuccess,
  showError,
}: InsuranceRulesTabProps) {
  const [rules, setRules] = useState<InsuranceRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/insurance-rules");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch insurance rules");
      }
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (error: any) {
      showError(error.message || "Failed to fetch insurance rules");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const updateShareValue = (id: number, value: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              clientShare:
                value.trim() === "" ? 0 : Number.parseFloat(value) || 0,
            }
          : rule,
      ),
    );
  };

  const saveRule = async (rule: InsuranceRule) => {
    if (!Number.isFinite(rule.clientShare) || rule.clientShare < 0) {
      showError("Client share must be a valid non-negative number");
      return;
    }

    setSavingId(rule.id);
    try {
      const res = await fetch("/api/insurance-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, clientShare: rule.clientShare }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update insurance rule");
      }

      showSuccess(`Updated amount for up to $${rule.maxValue.toFixed(2)}`);
      fetchRules();
    } catch (error: any) {
      showError(error.message || "Failed to update insurance rule");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Insurance Rules</h2>
        <p className="text-gray-600 text-sm">
          Default insurance bands are fixed. You can only edit the amount for
          each existing band.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.length === 0 ? (
            <p className="text-sm text-gray-500">No insurance rules found.</p>
          ) : (
            rules.map((rule, idx) => {
              const minValue = idx === 0 ? 0 : rules[idx - 1].maxValue;
              return (
                <div
                  key={rule.id}
                  className="p-3 rounded-lg border border-gray-200 bg-white"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Invoice Value Band
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        ${minValue.toFixed(2)} to ${rule.maxValue.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Client Share Amount ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rule.clientShare}
                        onChange={(e) =>
                          updateShareValue(rule.id, e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <button
                        onClick={() => saveRule(rule)}
                        disabled={savingId === rule.id}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <FiSave size={14} />
                        {savingId === rule.id ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
