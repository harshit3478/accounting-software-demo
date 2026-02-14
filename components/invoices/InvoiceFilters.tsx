'use client';

import { useState } from 'react';
import type { InvoiceFilter } from '../../hooks/useInvoices';
import DateRangePicker from '../DateRangePicker';

interface InvoiceFiltersProps {
  filter: InvoiceFilter;
  onFilterChange: (filter: InvoiceFilter) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  totalCount: number;
  filteredCount: number;
  dateRange?: { start: string; end: string } | null;
  onDateRangeChange?: (range: { start: string; end: string } | null) => void;
}

export default function InvoiceFilters({
  filter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  totalCount,
  filteredCount,
  dateRange,
  onDateRangeChange,
}: InvoiceFiltersProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const filters: { value: InvoiceFilter; label: string; color: string }[] = [
    { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
    { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
    { value: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800 hover:bg-red-200' },
    { value: 'partial', label: 'Partial', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
    { value: 'layaway', label: 'Layaway', color: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
    { value: 'inactive', label: 'Inactive', color: 'bg-gray-200 text-gray-600 hover:bg-gray-300' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? f.color.replace('hover:', '')
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search, Date Range, and Sort */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by client name or invoice number..."
                className="w-full px-4 py-2 pl-10 border text-gray-900 bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          <div className="flex gap-3">
            {onDateRangeChange && (
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    dateRange
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {dateRange ? 'Date Range Active' : 'Filter by Date'}
                </button>
                {showDatePicker && (
                  <div className="absolute right-0 mt-2 z-10">
                    <DateRangePicker
                      value={{
                        startDate: dateRange?.start || '',
                        endDate: dateRange?.end || '',
                        preset: 'custom'
                      }}
                      onChange={(range) => {
                        if (range.startDate && range.endDate) {
                          onDateRangeChange({ start: range.startDate, end: range.endDate });
                        } else {
                          onDateRangeChange(null);
                        }
                        setShowDatePicker(false);
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="sm:w-64">
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full px-4 py-2 border text-gray-900 bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="date-desc">Date (Newest First)</option>
                <option value="date-asc">Date (Oldest First)</option>
                <option value="amount-desc">Amount (Highest First)</option>
                <option value="amount-asc">Amount (Lowest First)</option>
                <option value="client-asc">Client Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Date Range Display */}
        {dateRange && (
          <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              Showing invoices from {new Date(dateRange.start).toLocaleDateString()} to {new Date(dateRange.end).toLocaleDateString()}
            </span>
            <button
              onClick={() => onDateRangeChange?.(null)}
              className="ml-auto text-indigo-600 hover:text-indigo-800"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Results Count */}
      {searchTerm && (
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredCount} of {totalCount} invoices
        </div>
      )}
    </div>
  );
}
