"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";

interface MigratedInvoiceEditSetting {
  isActive: boolean;
}

interface MigratedInvoiceEditTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function MigratedInvoiceEditTab({
  showSuccess,
  showError,
}: MigratedInvoiceEditTabProps) {
  const [setting, setSetting] = useState<MigratedInvoiceEditSetting>({
    isActive: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSetting = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/migrated-invoice-edit");
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to load setting");
        }

        const data = await res.json();
        setSetting({ isActive: !!data?.isActive });
      } catch (error: any) {
        showError(
          error.message || "Failed to load migrated invoice edit setting",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSetting();
  }, [showError]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/migrated-invoice-edit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save setting");
      }

      const data = await res.json();
      setSetting({ isActive: !!data?.isActive });
      showSuccess("Migrated invoice edit setting saved");
    } catch (error: any) {
      showError(
        error.message || "Failed to save migrated invoice edit setting",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Migrated Invoice Edit
        </h2>
        <p className="text-gray-600 text-sm">
          Control whether permitted admins can use the migrated invoice edit
          checkbox when editing layaway invoices. Cash invoices are not
          affected. When enabled, those users can save layaway corrections
          without recalculating fees; edits are tagged in audit history.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4 max-w-lg">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Migrated invoice edit enabled
              </p>
              <p className="text-xs text-gray-500">
                When active, users with the Migrated Invoice Edit permission see
                the checkbox on the layaway invoice edit form only.
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
