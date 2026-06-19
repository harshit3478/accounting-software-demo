"use client";

import { useEffect, useState } from "react";
import { FiPlay, FiSave } from "react-icons/fi";

interface DueReminderSetting {
  daysAfterDueDate: number;
  daysBetweenReminders: number;
  isActive: boolean;
}

interface DueReminderTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const DEFAULT_SETTING: DueReminderSetting = {
  daysAfterDueDate: 1,
  daysBetweenReminders: 7,
  isActive: false,
};

export default function DueReminderTab({
  showSuccess,
  showError,
}: DueReminderTabProps) {
  const [setting, setSetting] = useState<DueReminderSetting>(DEFAULT_SETTING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunSummary, setLastRunSummary] = useState<string | null>(null);

  useEffect(() => {
    const loadSetting = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/due-reminders");
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to load due reminder setting");
        }

        const data = await res.json();
        setSetting({
          daysAfterDueDate: Number(data?.daysAfterDueDate ?? 1),
          daysBetweenReminders: Number(data?.daysBetweenReminders ?? 7),
          isActive: !!data?.isActive,
        });
      } catch (error: any) {
        showError(error.message || "Failed to load due reminder setting");
      } finally {
        setIsLoading(false);
      }
    };

    loadSetting();
  }, [showError]);

  const handleSave = async () => {
    if (!Number.isFinite(setting.daysAfterDueDate) || setting.daysAfterDueDate < 0) {
      showError("Days after due date must be a valid non-negative number");
      return;
    }

    if (
      !Number.isFinite(setting.daysBetweenReminders) ||
      setting.daysBetweenReminders < 1
    ) {
      showError("Days between reminders must be at least 1");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/due-reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save due reminder setting");
      }

      const data = await res.json();
      setSetting({
        daysAfterDueDate: Number(data?.daysAfterDueDate ?? setting.daysAfterDueDate),
        daysBetweenReminders: Number(
          data?.daysBetweenReminders ?? setting.daysBetweenReminders,
        ),
        isActive: !!data?.isActive,
      });
      showSuccess("Due reminder settings saved");
    } catch (error: any) {
      showError(error.message || "Failed to save due reminder setting");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunNow = async () => {
    setIsRunning(true);
    setLastRunSummary(null);
    try {
      const res = await fetch("/api/due-reminders/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to run due reminders");
      }

      const summary = `Processed ${data.processed} invoices — ${data.sent} sent, ${data.skipped} skipped, ${data.failed} failed.`;
      setLastRunSummary(summary);
      showSuccess(summary);
    } catch (error: any) {
      showError(error.message || "Failed to run due reminders");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Automated Due Reminder Emails
        </h2>
        <p className="text-gray-600 text-sm">
          Send automatic payment reminder emails for overdue invoices. The 1st
          and 2nd reminders are standard payment notices. The 3rd reminder
          includes a restocking fee notification.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4 max-w-lg">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold mb-2">Reminder sequence</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>1st due: Payment reminder email</li>
              <li>2nd due: Payment reminder email</li>
              <li>3rd due: Payment reminder with restocking notification</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Days after due date (1st reminder)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={setting.daysAfterDueDate}
              onChange={(e) =>
                setSetting((prev) => ({
                  ...prev,
                  daysAfterDueDate: Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-2">
              How many days after the invoice due date before the first reminder
              is sent.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Days between reminders
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={setting.daysBetweenReminders}
              onChange={(e) =>
                setSetting((prev) => ({
                  ...prev,
                  daysBetweenReminders: Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-2">
              Waiting period between the 1st and 2nd reminder, and between the
              2nd and 3rd reminder.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Due reminders enabled
              </p>
              <p className="text-xs text-gray-500">
                Requires a customer email on the invoice. Reminders stop after
                the 3rd email or when the invoice is paid.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSetting((prev) => ({ ...prev, isActive: !prev.isActive }))
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

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 flex items-center gap-1"
            >
              <FiSave size={14} />
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleRunNow}
              disabled={isRunning}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm disabled:opacity-50 flex items-center gap-1"
            >
              <FiPlay size={14} />
              {isRunning ? "Running..." : "Run Reminders Now"}
            </button>
          </div>

          {lastRunSummary && (
            <p className="text-sm text-gray-600">{lastRunSummary}</p>
          )}

          <p className="text-xs text-gray-500">
            Schedule automatic runs by calling{" "}
            <code className="bg-gray-100 px-1 rounded">
              /api/cron/due-reminders
            </code>{" "}
            daily with{" "}
            <code className="bg-gray-100 px-1 rounded">
              Authorization: Bearer CRON_SECRET
            </code>
            .
          </p>
        </div>
      )}
    </div>
  );
}
