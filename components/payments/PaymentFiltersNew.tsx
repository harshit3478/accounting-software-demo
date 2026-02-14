'use client';

import { useState } from 'react';
import type { PaymentMethodFilter, DateRange } from '../../hooks/usePayments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Separator } from '../ui/separator';
import {
  CalendarIcon,
  Search,
  X,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import type { PaymentMethodType } from '../../hooks/usePayments';

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

export default function PaymentFiltersNew({
  filterMethod,
  onFilterChange,
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onExportPDF,
  paymentMethods = [],
}: PaymentFiltersProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    dateRange?.startDate ? new Date(dateRange.startDate) : undefined
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(
    dateRange?.endDate ? new Date(dateRange.endDate) : undefined
  );

  const filters: {
    value: PaymentMethodFilter;
    label: string;
    icon: React.ReactNode;
    colorClass: string;
  }[] = [
    {
      value: 'all',
      label: 'All Payments',
      icon: <Filter className="h-4 w-4" />,
      colorClass: 'default'
    },
    ...paymentMethods.map((m) => ({
      value: String(m.id) as PaymentMethodFilter,
      label: m.name,
      icon: m.icon ? <span className="text-sm">{m.icon}</span> : <Filter className="h-4 w-4" />,
      colorClass: 'default',
    })),
  ];

  const hasActiveFilters = 
    filterMethod !== 'all' || 
    searchQuery !== '' || 
    (dateRange && dateRange.preset !== 'all');
    
  const activeFilterCount = [
    filterMethod !== 'all' ? 1 : 0,
    searchQuery !== '' ? 1 : 0,
    (dateRange && dateRange.preset !== 'all') ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleClearFilters = () => {
    onFilterChange('all');
    onSearchChange('');
    onDateRangeChange({ startDate: '', endDate: '', preset: 'all' });
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleApplyDateRange = () => {
    if (dateFrom && dateTo) {
      onDateRangeChange({
        startDate: format(dateFrom, 'yyyy-MM-dd'),
        endDate: format(dateTo, 'yyyy-MM-dd'),
        preset: 'custom',
      });
      setShowDatePicker(false);
    }
  };

  const handleClearDateRange = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    onDateRangeChange({ startDate: '', endDate: '', preset: 'all' });
    setShowDatePicker(false);
  };

  const handlePresetDateRange = (preset: string) => {
    const today = new Date();
    const startDate = new Date();
    
    switch (preset) {
      case 'this-month':
        startDate.setDate(1);
        onDateRangeChange({
          preset,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd'),
        });
        break;
      case 'last-month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        onDateRangeChange({
          preset,
          startDate: format(lastMonth, 'yyyy-MM-dd'),
          endDate: format(lastMonthEnd, 'yyyy-MM-dd'),
        });
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        onDateRangeChange({
          preset,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd'),
        });
        break;
      case 'all':
        onDateRangeChange({ startDate: '', endDate: '', preset: 'all' });
        break;
    }
    setShowDatePicker(false);
  };

  const getDateRangeLabel = () => {
    if (!dateRange || dateRange.preset === 'all') {
      return 'All Time';
    }
    if (dateRange.preset === 'this-month') return 'This Month';
    if (dateRange.preset === 'last-month') return 'Last Month';
    if (dateRange.preset === 'this-year') return 'This Year';
    if (dateRange.startDate && dateRange.endDate) {
      return `${format(new Date(dateRange.startDate), 'MMM dd')} - ${format(new Date(dateRange.endDate), 'MMM dd, yyyy')}`;
    }
    return 'Pick a date range';
  };

  return (
    <Card className="mb-6 border-l-4 border-l-green-500 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-green-600" />
            <div>
              <CardTitle className="text-lg">Payment Filters</CardTitle>
              <CardDescription className="mt-1">
                {hasActiveFilters ? (
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {activeFilterCount} active
                    </Badge>
                    <span className="text-sm">Filtered results</span>
                  </span>
                ) : (
                  'Search and filter payment records'
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Payment Method Filter Buttons */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={filterMethod === f.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onFilterChange(f.value)}
                className={`transition-all ${
                  filterMethod === f.value
                    ? 'shadow-md scale-105'
                    : 'hover:scale-105'
                }`}
              >
                {f.icon}
                <span className="ml-2">{f.label}</span>
                {filterMethod === f.value && f.value !== 'all' && (
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
                placeholder="Client, invoice, or notes..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
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
                  variant={(dateRange && dateRange.preset !== 'all') ? 'default' : 'outline'}
                  className={`w-full justify-start text-left font-normal ${
                    (dateRange && dateRange.preset !== 'all') ? 'shadow-md' : ''
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {getDateRangeLabel()}
                  <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 space-y-4">
                  {/* Quick Presets */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Quick Select</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePresetDateRange('this-month')}
                      >
                        This Month
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePresetDateRange('last-month')}
                      >
                        Last Month
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePresetDateRange('this-year')}
                      >
                        This Year
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePresetDateRange('all')}
                      >
                        All Time
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Custom Range */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Custom Range</h4>
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
                      Apply Custom
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active Date Range Info */}
        {dateRange && dateRange.preset !== 'all' && dateRange.startDate && dateRange.endDate && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
            <CalendarIcon className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-900 flex-1">
              Showing payments from{' '}
              <span className="font-medium">{format(new Date(dateRange.startDate), 'MMM dd, yyyy')}</span> to{' '}
              <span className="font-medium">{format(new Date(dateRange.endDate), 'MMM dd, yyyy')}</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearDateRange}
              className="h-6 w-6 p-0 text-green-600 hover:text-green-800 hover:bg-green-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
