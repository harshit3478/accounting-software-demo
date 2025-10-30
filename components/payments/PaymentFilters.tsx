'use client';

import type { PaymentMethodFilter, DateRange } from '../../hooks/usePayments';
import DateRangePicker from '../DateRangePicker';

interface PaymentFiltersProps {
  filterMethod: PaymentMethodFilter;
  onFilterChange: (method: PaymentMethodFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange: DateRange | null;
  onDateRangeChange: (range: DateRange | null) => void;
    onExportPDF?: () => void;
}

export default function PaymentFilters({
  filterMethod,
  onFilterChange,
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onExportPDF
}: PaymentFiltersProps) {
  const filters: { value: PaymentMethodFilter; label: string; colorClass: string }[] = [
    { value: 'all', label: 'All Payments', colorClass: 'bg-blue-600' },
    { value: 'cash', label: 'Cash', colorClass: 'bg-amber-600' },
    { value: 'zelle', label: 'Zelle', colorClass: 'bg-green-600' },
    { value: 'quickbooks', label: 'QuickBooks', colorClass: 'bg-blue-600' },
    { value: 'layaway', label: 'Layaway', colorClass: 'bg-purple-600' },
  ];

  return (
    <div className="mb-6 space-y-4">
      {/* Search and Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Payments
          </label>
          <div className="relative">
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by client, invoice, or notes..."
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
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

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <DateRangePicker
            value={dateRange || { startDate: '', endDate: '', preset: undefined }}
            onChange={onDateRangeChange}
          />
        </div>
      </div>

      {/* Method Filters */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Method
        </label>
        <div className="flex items-center space-x-3">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => onFilterChange(filter.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterMethod === filter.value
                  ? `${filter.colorClass} text-white`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {/* Place export pdf button here on right top corner */}
        
      </div>
    </div>
  );
}
