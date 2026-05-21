"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";

interface InvoiceUnit {
  id: number;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  isSystem: boolean;
  sortOrder: number;
}

interface UnitsTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function UnitsTab({ showSuccess, showError }: UnitsTabProps) {
  const [units, setUnits] = useState<InvoiceUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<InvoiceUnit | null>(null);
  const [form, setForm] = useState({
    name: "",
    sortOrder: "0",
    isActive: true,
  });

  const fetchUnits = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/units?all=true");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch units");
      }
      const data = await res.json();
      setUnits(Array.isArray(data) ? data : []);
    } catch (error: any) {
      showError(error.message || "Failed to fetch units");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const resetForm = () => {
    setForm({ name: "", sortOrder: "0", isActive: true });
    setEditingUnit(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (unit: InvoiceUnit) => {
    setEditingUnit(unit);
    setForm({
      name: unit.name,
      sortOrder: String(unit.sortOrder ?? 0),
      isActive: !!unit.isActive,
    });
    setShowForm(true);
  };

  const saveUnit = async () => {
    if (!form.name.trim()) {
      showError("Unit name is required");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/units", {
        method: editingUnit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingUnit ? { id: editingUnit.id } : {}),
          name: form.name.trim(),
          sortOrder: Number(form.sortOrder || 0),
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save unit");
      }

      showSuccess(editingUnit ? "Unit updated" : "Unit created");
      setShowForm(false);
      resetForm();
      fetchUnits();
    } catch (error: any) {
      showError(error.message || "Failed to save unit");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteUnit = async (unit: InvoiceUnit) => {
    if (!confirm(`Delete unit "${unit.name}"?`)) return;
    try {
      const res = await fetch("/api/units", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unit.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete unit");
      }
      showSuccess("Unit deleted");
      fetchUnits();
    } catch (error: any) {
      showError(error.message || "Failed to delete unit");
    }
  };

  const toggleUnit = async (unit: InvoiceUnit) => {
    try {
      const res = await fetch("/api/units", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unit.id, isActive: !unit.isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update unit status");
      }
      showSuccess(
        `${unit.name} ${unit.isActive ? "deactivated" : "activated"}`,
      );
      fetchUnits();
    } catch (error: any) {
      showError(error.message || "Failed to update unit status");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Units</h2>
          <p className="text-gray-600 text-sm">
            Manage invoice quantity units. Grams stays as the default unit.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
        >
          <FiPlus className="mr-1.5" />
          Add Unit
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">
            {editingUnit ? `Edit "${editingUnit.name}"` : "Create Unit"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                placeholder="e.g. grams"
                disabled={editingUnit?.isSystem}
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
          </div>

          <div className="mt-3 flex items-center">
            <input
              id="unit-active"
              type="checkbox"
              checked={form.isActive}
              disabled={editingUnit?.isSystem}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="mr-2 w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="unit-active" className="text-sm text-gray-700">
              Active
            </label>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={saveUnit}
              disabled={isSaving || !form.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingUnit ? "Update" : "Create"}
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
          {units.map((unit) => (
            <div
              key={unit.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                unit.isActive
                  ? "border-gray-200 bg-white"
                  : "border-gray-100 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">{unit.name}</span>
                {unit.isDefault && (
                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                    Default
                  </span>
                )}
                {unit.isSystem && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                    System
                  </span>
                )}
                {!unit.isActive && (
                  <span className="text-xs px-2 py-0.5 bg-red-50 text-red-500 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(unit)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit"
                >
                  <FiEdit2 size={14} />
                </button>
                <button
                  onClick={() => toggleUnit(unit)}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                  title={unit.isActive ? "Deactivate" : "Activate"}
                >
                  {unit.isActive ? <FiX size={14} /> : <FiCheck size={14} />}
                </button>
                <button
                  onClick={() => deleteUnit(unit)}
                  disabled={unit.isSystem}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Delete"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {units.length === 0 && (
            <div className="text-sm text-gray-500 py-4">
              No units configured yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
