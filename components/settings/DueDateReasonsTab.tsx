"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";

interface DueDateReason {
  id: number;
  reason: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface DueDateReasonsTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function DueDateReasonsTab({
  showSuccess,
  showError,
}: DueDateReasonsTabProps) {
  const [reasons, setReasons] = useState<DueDateReason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingReason, setEditingReason] = useState<DueDateReason | null>(
    null,
  );
  const [form, setForm] = useState({
    reason: "",
    sortOrder: "0",
    isActive: true,
  });

  const fetchReasons = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/due-date-reasons");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch due date reasons");
      }
      const data = await res.json();
      setReasons(Array.isArray(data) ? data : []);
    } catch (error: any) {
      showError(error.message || "Failed to fetch due date reasons");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReasons();
  }, []);

  const resetForm = () => {
    setForm({ reason: "", sortOrder: "0", isActive: true });
    setEditingReason(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (reason: DueDateReason) => {
    setEditingReason(reason);
    setForm({
      reason: reason.reason,
      sortOrder: String(reason.sortOrder ?? 0),
      isActive: !!reason.isActive,
    });
    setShowForm(true);
  };

  const saveReason = async () => {
    if (!form.reason.trim()) {
      showError("Reason is required");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...(editingReason ? { id: editingReason.id } : {}),
        reason: form.reason.trim(),
        sortOrder: Number(form.sortOrder || 0),
        isActive: form.isActive,
      };

      const res = await fetch("/api/due-date-reasons", {
        method: editingReason ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save due date reason");
      }

      showSuccess(editingReason ? "Reason updated" : "Reason created");
      setShowForm(false);
      resetForm();
      fetchReasons();
    } catch (error: any) {
      showError(error.message || "Failed to save due date reason");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteReason = async (reason: DueDateReason) => {
    if (!confirm(`Delete reason \"${reason.reason}\"?`)) return;

    try {
      const res = await fetch("/api/due-date-reasons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reason.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete reason");
      }

      showSuccess("Reason deleted");
      fetchReasons();
    } catch (error: any) {
      showError(error.message || "Failed to delete reason");
    }
  };

  const toggleReason = async (reason: DueDateReason) => {
    try {
      const res = await fetch("/api/due-date-reasons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reason.id, isActive: !reason.isActive }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update reason status");
      }

      showSuccess(
        `${reason.reason} ${reason.isActive ? "deactivated" : "activated"}`,
      );
      fetchReasons();
    } catch (error: any) {
      showError(error.message || "Failed to update reason status");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Due Date Reasons
          </h2>
          <p className="text-gray-600 text-sm">
            Configure reason options shown when invoice due date is back-dated.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
        >
          <FiPlus className="mr-1.5" />
          Add Reason
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">
            {editingReason
              ? `Edit \"${editingReason.reason}\"`
              : "Create Due Date Reason"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">
                Reason *
              </label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                placeholder="e.g. Invoice was created late"
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
              id="due-date-reason-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="mr-2 w-4 h-4 text-blue-600 rounded"
            />
            <label
              htmlFor="due-date-reason-active"
              className="text-sm text-gray-700"
            >
              Active
            </label>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={saveReason}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingReason ? "Update" : "Create"}
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
          {reasons.length === 0 ? (
            <p className="text-sm text-gray-500">
              No due date reasons configured yet.
            </p>
          ) : (
            reasons.map((reason) => (
              <div
                key={reason.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  reason.isActive
                    ? "border-gray-200 bg-white"
                    : "border-gray-100 bg-gray-50 opacity-70"
                }`}
              >
                <div className="min-w-0 pr-3">
                  <p className="font-medium text-gray-900 truncate">
                    {reason.reason}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Sort order: {reason.sortOrder}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(reason)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                  >
                    <FiEdit2 size={14} />
                  </button>
                  <button
                    onClick={() => toggleReason(reason)}
                    className={`p-1.5 rounded ${
                      reason.isActive
                        ? "text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                        : "text-green-500 hover:text-green-700 hover:bg-green-50"
                    }`}
                    title={reason.isActive ? "Deactivate" : "Activate"}
                  >
                    {reason.isActive ? (
                      <FiX size={14} />
                    ) : (
                      <FiCheck size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => deleteReason(reason)}
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
