'use client';

import { useState } from 'react';
import type { InvoiceFilter } from '../../hooks/useInvoices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Separator } from '../ui/separator';
import { CalendarIcon, Search, X, Filter, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

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

export default function InvoiceFiltersNew({
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
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    dateRange?.start ? new Date(dateRange.start) : undefined
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(
    dateRange?.end ? new Date(dateRange.end) : undefined
  );

  const filters: { value: InvoiceFilter; label: string; color: string; count?: number }[] = [
    { value: 'all', label: 'All', color: 'default' },
    { value: 'pending', label: 'Pending', color: 'secondary' },
    { value: 'paid', label: 'Paid', color: 'default' },
    { value: 'overdue', label: 'Overdue', color: 'destructive' },
    { value: 'partial', label: 'Partial', color: 'default' },
    { value: 'layaway', label: 'Layaway', color: 'default' },
  ];

  const hasActiveFilters = filter !== 'all' || searchTerm !== '' || dateRange !== null;
  const activeFilterCount = [
    filter !== 'all' ? 1 : 0,
    searchTerm !== '' ? 1 : 0,
    dateRange !== null ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleClearFilters = () => {
    onFilterChange('all');
    onSearchChange('');
    onDateRangeChange?.(null);
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleApplyDateRange = () => {
    if (dateFrom && dateTo) {
      onDateRangeChange?.({
        start: format(dateFrom, 'yyyy-MM-dd'),
        end: format(dateTo, 'yyyy-MM-dd'),
      });
      setShowDatePicker(false);
    }
  };

  const handleClearDateRange = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    onDateRangeChange?.(null);
    setShowDatePicker(false);
  };

  return (
    <Card className="mb-6 border-l-4 border-l-blue-500 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-lg">Filters & Search</CardTitle>
              <CardDescription className="mt-1">
                {hasActiveFilters ? (
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {activeFilterCount} active
                    </Badge>
                    <span className="text-sm">
                      Showing {filteredCount} of {totalCount} invoices
                    </span>
                  </span>
                ) : (
                  `Search and filter from ${totalCount} invoices`
                )}
              </CardDescription>
            </div>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Filter Buttons */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onFilterChange(f.value)}
                className={`transition-all ${
                  filter === f.value
                    ? 'shadow-md scale-105'
                    : 'hover:scale-105'
                }`}
              >
                {f.label}
                {filter === f.value && f.value !== 'all' && (
                  <Badge variant="secondary" className="ml-2 bg-white/20">
                    ✓
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Search and Date Range Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Client name or invoice number..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Date Range</label>
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant={dateRange ? 'default' : 'outline'}
                  className={`w-full justify-start text-left font-normal ${
                    dateRange ? 'shadow-md' : ''
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange ? (
                    <>
                      {format(new Date(dateRange.start), 'MMM dd, yyyy')} -{' '}
                      {format(new Date(dateRange.end), 'MMM dd, yyyy')}
                    </>
                  ) : (
                    <span>Pick a date range</span>
                  )}
                  <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Select Date Range</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">From</label>
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">To</label>
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          disabled={(date) => dateFrom ? date < dateFrom : false}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearDateRange}
                      className="flex-1"
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApplyDateRange}
                      disabled={!dateFrom || !dateTo}
                      className="flex-1"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Separator />

        {/* Sort Dropdown */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full md:w-64 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="amount-desc">Amount (Highest First)</option>
            <option value="amount-asc">Amount (Lowest First)</option>
            <option value="client-asc">Client Name (A-Z)</option>
          </select>
        </div>

        {/* Active Date Range Info */}
        {dateRange && (
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
            <CalendarIcon className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-900 flex-1">
              Showing invoices from{' '}
              <span className="font-medium">{format(new Date(dateRange.start), 'MMM dd, yyyy')}</span> to{' '}
              <span className="font-medium">{format(new Date(dateRange.end), 'MMM dd, yyyy')}</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearDateRange}
              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
