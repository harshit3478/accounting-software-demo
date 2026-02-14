
'use client';

import { useState } from 'react';
import { Search, Filter, Calendar, ChevronDown, X, Plus, Download, Upload, RefreshCw, Link } from 'lucide-react';
import LucideIcon from '../LucideIcon';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { format } from 'date-fns';
import type { PaymentMethodFilter, DateRange, PaymentMethodType } from '../../hooks/usePayments';

interface PaymentToolbarProps {
  filterMethod: PaymentMethodFilter;
  onFilterChange: (method: PaymentMethodFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange: DateRange | null;
  onDateRangeChange: (range: DateRange | null) => void;
  onRecordClick: () => void;
  onExportClick: () => void;
  onImportClick: () => void;
  onSyncClick: () => void;
  isSyncing: boolean;
  onMatchClick: () => void;
  unmatchedCount: number;
  paymentMethods?: PaymentMethodType[];
}

export default function PaymentToolbar({
  filterMethod,
  onFilterChange,
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onRecordClick,
  onExportClick,
  onImportClick,
  onSyncClick,
  isSyncing,
  onMatchClick,
  unmatchedCount,
  paymentMethods = [],
}: PaymentToolbarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    dateRange?.startDate ? new Date(dateRange.startDate) : undefined
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(
    dateRange?.endDate ? new Date(dateRange.endDate) : undefined
  );

  const handleApplyDateRange = () => {
    if (dateFrom && dateTo) {
      onDateRangeChange({
        startDate: format(dateFrom, 'yyyy-MM-dd'),
        endDate: format(dateTo, 'yyyy-MM-dd'),
        preset: 'custom'
      });
      setShowDatePicker(false);
    }
  };

  const handleClearDateRange = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    onDateRangeChange(null);
    setShowDatePicker(false);
  };

  const getMethodLabel = (methodFilter: string) => {
    if (methodFilter === 'all') return 'All Methods';
    const method = paymentMethods.find(m => String(m.id) === methodFilter);
    return method?.name || methodFilter;
  };

  const getMethodIcon = (methodFilter: string) => {
    if (methodFilter === 'all') return <Filter className="h-4 w-4 mr-2" />;
    const method = paymentMethods.find(m => String(m.id) === methodFilter);
    if (method?.icon) return <LucideIcon name={method.icon} fallback={method.name} size={14} className="mr-2" />;
    return <Filter className="h-4 w-4 mr-2" />;
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-16 z-40 shadow-sm">
      {/* Left Side: Search & Filters */}
      <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search payments..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Method Filter Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-dashed">
                {getMethodIcon(filterMethod)}
                Method
                {filterMethod !== 'all' && (
                  <>
                    <span className="mx-2 h-4 w-[1px] bg-gray-200" />
                    <span className="text-blue-600">{getMethodLabel(filterMethod)}</span>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <div className="p-2">
                <div
                  className={`px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100 flex items-center ${
                    filterMethod === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                  }`}
                  onClick={() => onFilterChange('all')}
                >
                  All Methods
                </div>
                {paymentMethods.map((method) => {
                  const methodId = String(method.id);
                  return (
                    <div
                      key={method.id}
                      className={`px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100 flex items-center ${
                        filterMethod === methodId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                      onClick={() => onFilterChange(methodId)}
                    >
                      {method.icon && <LucideIcon name={method.icon} fallback={method.name} size={14} className="mr-2" />}
                      {method.name}
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Range Picker */}
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-dashed">
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange ? (
                  `${format(new Date(dateRange.startDate), 'MMM d')} - ${format(new Date(dateRange.endDate), 'MMM d')}`
                ) : (
                  'Date'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Start Date</p>
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">End Date</p>
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" size="sm" onClick={handleClearDateRange}>Clear</Button>
                <Button size="sm" onClick={handleApplyDateRange}>Apply</Button>
              </div>
            </PopoverContent>
          </Popover>

          {(filterMethod !== 'all' || dateRange || searchQuery) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-2 lg:px-3"
              onClick={() => {
                onFilterChange('all');
                onSearchChange('');
                onDateRangeChange(null);
              }}
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Right Side: Actions */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 relative" 
          onClick={onMatchClick}
        >
          <Link className="mr-2 h-4 w-4" />
          Match Payments
          {unmatchedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
              {unmatchedCount}
            </span>
          )}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9" 
          onClick={onSyncClick}
          disabled={isSyncing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync QB'}
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onImportClick}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onExportClick}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={onRecordClick}>
          <Plus className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </div>
    </div>
  );
}
