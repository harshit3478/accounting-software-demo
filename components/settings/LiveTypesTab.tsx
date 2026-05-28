"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";

interface LiveTypeEntry {
  id: number;
  name: string;
  country: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface LiveTypesTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function LiveTypesTab({
  showSuccess,
  showError,
}: LiveTypesTabProps) {
  const [liveTypes, setLiveTypes] = useState<LiveTypeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingLiveType, setEditingLiveType] = useState<LiveTypeEntry | null>(
    null,
  );
  const [form, setForm] = useState({
    name: "",
    country: "",
    sortOrder: "0",
    isActive: true,
  });

  const fetchLiveTypes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/live-types?all=true");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch live types");
      }
      const data = await res.json();
      setLiveTypes(Array.isArray(data) ? data : []);
    } catch (error: any) {
      showError(error.message || "Failed to fetch live types");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveTypes();
  }, []);

  const resetForm = () => {
    setForm({ name: "", country: "", sortOrder: "0", isActive: true });
    setEditingLiveType(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (liveType: LiveTypeEntry) => {
    setEditingLiveType(liveType);
    setForm({
      name: liveType.name,
      country: liveType.country,
      sortOrder: String(liveType.sortOrder ?? 0),
      isActive: !!liveType.isActive,
    });
    setShowForm(true);
  };

  const saveLiveType = async () => {
    if (!form.name.trim()) {
      showError("Live type name is required");
      return;
    }
    if (!form.country.trim()) {
      showError("Country is required");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/live-types", {
        method: editingLiveType ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingLiveType ? { id: editingLiveType.id } : {}),
          name: form.name.trim(),
          country: form.country.trim(),
          sortOrder: Number(form.sortOrder || 0),
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save live type");
      }

      showSuccess(editingLiveType ? "Live type updated" : "Live type created");
      setShowForm(false);
      resetForm();
      fetchLiveTypes();
    } catch (error: any) {
      showError(error.message || "Failed to save live type");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLiveType = async (liveType: LiveTypeEntry) => {
    if (!confirm(`Delete live type \"${liveType.name}\"?`)) return;

    try {
      const res = await fetch("/api/live-types", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: liveType.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete live type");
      }

      showSuccess("Live type deleted");
      fetchLiveTypes();
    } catch (error: any) {
      showError(error.message || "Failed to delete live type");
    }
  };

  const toggleLiveType = async (liveType: LiveTypeEntry) => {
    try {
      const res = await fetch("/api/live-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: liveType.id, isActive: !liveType.isActive }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update live type status");
      }

      showSuccess(
        `${liveType.name} ${liveType.isActive ? "deactivated" : "activated"}`,
      );
      fetchLiveTypes();
    } catch (error: any) {
      showError(error.message || "Failed to update live type status");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            Live Types
          </h2>
          <p className="text-gray-600 text-sm">
            Configure invoice live types and the country attached to each
            option.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
        >
          <FiPlus className="mr-1.5" />
          Add Live Type
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">
            {editingLiveType
              ? `Edit "${editingLiveType.name}"`
              : "Create Live Type"}
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
                placeholder="e.g. Wholesale"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Country *
              </label>
              <input
                type="text"
                value={form.country}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, country: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                placeholder="e.g. USA"
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
              id="live-type-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="mr-2 w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="live-type-active" className="text-sm text-gray-700">
              Active
            </label>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={saveLiveType}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingLiveType ? "Update" : "Create"}
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
          {liveTypes.length === 0 ? (
            <p className="text-sm text-gray-500">
              No live types configured yet.
            </p>
          ) : (
            liveTypes.map((liveType) => (
              <div
                key={liveType.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  liveType.isActive
                    ? "border-gray-200 bg-white"
                    : "border-gray-100 bg-gray-50 opacity-60"
                }`}
              >
                <div className="min-w-0 pr-3">
                  <p className="font-medium text-gray-900 truncate">
                    {liveType.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {liveType.country} • Sort order: {liveType.sortOrder}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(liveType)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                  >
                    <FiEdit2 size={14} />
                  </button>
                  <button
                    onClick={() => toggleLiveType(liveType)}
                    className={`p-1.5 rounded ${
                      liveType.isActive
                        ? "text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                        : "text-green-500 hover:text-green-700 hover:bg-green-50"
                    }`}
                    title={liveType.isActive ? "Deactivate" : "Activate"}
                  >
                    {liveType.isActive ? (
                      <FiX size={14} />
                    ) : (
                      <FiCheck size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => deleteLiveType(liveType)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
