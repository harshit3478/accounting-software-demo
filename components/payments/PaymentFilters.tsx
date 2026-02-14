'use client';

import type { PaymentMethodFilter, DateRange, PaymentMethodType } from '../../hooks/usePayments';
import DateRangePicker from '../DateRangePicker';

interface PaymentFiltersProps {
  filterMethod: PaymentMethodFilter;
  onFilterChange: (method: PaymentMethodFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange: DateRange | null;
  onDateRangeChange: (range: DateRange | null) => void;
  onExportPDF?: () => void;
  paymentMethods?: PaymentMethodType[];
}

export default function PaymentFilters({
  filterMethod,
  onFilterChange,
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onExportPDF,
  paymentMethods = [],
}: PaymentFiltersProps) {
  const filters: { value: PaymentMethodFilter; label: string; color: string }[] = [
    { value: 'all', label: 'All Payments', color: '#2563EB' },
    ...paymentMethods.map((m) => ({
      value: String(m.id) as PaymentMethodFilter,
      label: m.name,
      color: m.color,
    })),
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
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={filterMethod === filter.value ? { backgroundColor: filter.color } : undefined}
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
