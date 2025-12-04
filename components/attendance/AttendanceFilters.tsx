"use client";

import { useState } from "react";

export interface DateRange {
  start: string;
  end: string;
}

interface AttendanceFiltersProps {
  onFilterChange: (range: DateRange | null, preset: string) => void;
}

export default function AttendanceFilters({
  onFilterChange,
}: AttendanceFiltersProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const presets = [
    { value: "thisWeek", label: "This Week" },
    { value: "lastWeek", label: "Last Week" },
    { value: "thisMonth", label: "This Month" },
    { value: "lastMonth", label: "Last Month" },
    { value: "last3Months", label: "Last 3 Months" },
    { value: "last6Months", label: "Last 6 Months" },
    { value: "thisYear", label: "This Year" },
    { value: "custom", label: "Custom Range" },
  ];

  function getDateRangeForPreset(preset: string): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = new Date(today);
    const end = new Date(today);

    switch (preset) {
      case "thisWeek": {
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday
        start.setDate(today.getDate() + diff);
        break;
      }
      case "lastWeek": {
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        start.setDate(today.getDate() + diff - 7);
        end.setDate(today.getDate() + diff - 1);
        break;
      }
      case "thisMonth": {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      }
      case "lastMonth": {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end.setDate(0); // Last day of previous month
        break;
      }
      case "last3Months": {
        start.setMonth(today.getMonth() - 3);
        break;
      }
      case "last6Months": {
        start.setMonth(today.getMonth() - 6);
        break;
      }
      case "thisYear": {
        start = new Date(today.getFullYear(), 0, 1);
        break;
      }
      default:
        return { start: "", end: "" };
    }

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  }

  function handlePresetChange(preset: string) {
    setSelectedPreset(preset);
    if (preset === "custom") {
      onFilterChange(null, preset);
    } else {
      const range = getDateRangeForPreset(preset);
      onFilterChange(range, preset);
    }
  }

  function handleApplyCustom() {
    if (customStart && customEnd) {
      onFilterChange({ start: customStart, end: customEnd }, "custom");
    }
  }

  function handleClearFilters() {
    setSelectedPreset("thisMonth");
    setCustomStart("");
    setCustomEnd("");
    const range = getDateRangeForPreset("thisMonth");
    onFilterChange(range, "thisMonth");
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetChange(preset.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  selectedPreset === preset.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {selectedPreset === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleApplyCustom}
              disabled={!customStart || !customEnd}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleClearFilters}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Reset to This Month
          </button>
        </div>
      </div>
    </div>
  );
}
