
'use client';

import { useState } from 'react';
import { Search, Filter, Calendar, ChevronDown, X, Plus, Download, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { format } from 'date-fns';
import type { InvoiceStatusFilter, InvoiceTypeFilter } from '../../hooks/useInvoices';

interface InvoiceToolbarProps {
  statusFilter: InvoiceStatusFilter;
  onStatusFilterChange: (filter: InvoiceStatusFilter) => void;
  typeFilter: InvoiceTypeFilter;
  onTypeFilterChange: (filter: InvoiceTypeFilter) => void;
  layawayOverdue: boolean;
  onLayawayOverdueChange: (overdue: boolean) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  dateRange: { start: string; end: string } | null;
  onDateRangeChange: (range: { start: string; end: string } | null) => void;
  onCreateClick: () => void;
  onExportClick: () => void;
  onImportClick: () => void;
}

export default function InvoiceToolbar({
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  layawayOverdue,
  onLayawayOverdueChange,
  searchTerm,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onCreateClick,
  onExportClick,
  onImportClick
}: InvoiceToolbarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    dateRange?.start ? new Date(dateRange.start) : undefined
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(
    dateRange?.end ? new Date(dateRange.end) : undefined
  );

  const handleApplyDateRange = () => {
    if (dateFrom && dateTo) {
      onDateRangeChange({
        start: format(dateFrom, 'yyyy-MM-dd'),
        end: format(dateTo, 'yyyy-MM-dd'),
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

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-16 z-40 shadow-sm">
      {/* Left Side: Search & Filters */}
      <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search invoices..." 
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-dashed">
                <Filter className="mr-2 h-4 w-4" />
                Status
                {statusFilter !== 'all' && (
                  <>
                    <span className="mx-2 h-4 w-[1px] bg-gray-200" />
                    <span className="text-blue-600 capitalize">{statusFilter}</span>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <div className="p-2">
                {['all', 'pending', 'paid', 'overdue', 'partial'].map((status) => (
                  <div
                    key={status}
                    className={`px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100 capitalize ${
                      statusFilter === status ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                    onClick={() => onStatusFilterChange(status as InvoiceStatusFilter)}
                  >
                    {status}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Type Filter Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-dashed">
                <Filter className="mr-2 h-4 w-4" />
                Type
                {typeFilter !== 'all' && (
                  <>
                    <span className="mx-2 h-4 w-[1px] bg-gray-200" />
                    <span className="text-blue-600 capitalize">{typeFilter}</span>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <div className="p-2">
                {['all', 'cash', 'layaway'].map((type) => (
                  <div
                    key={type}
                    className={`px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100 capitalize ${
                      typeFilter === type ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                    onClick={() => onTypeFilterChange(type as InvoiceTypeFilter)}
                  >
                    {type}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Layaway Overdue Button */}
          <Button
            variant={layawayOverdue ? "default" : "outline"}
            size="sm"
            onClick={() => onLayawayOverdueChange(!layawayOverdue)}
            className={`h-9 ${layawayOverdue ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-dashed'}`}
            title="Show Layaway invoices with 2 or more missed payment dates"
          >
           Overdue {'>'} 2
          </Button>

          {/* Date Range Picker */}
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-dashed">
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange ? (
                  `${format(new Date(dateRange.start), 'MMM d')} - ${format(new Date(dateRange.end), 'MMM d')}`
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

          {(statusFilter !== 'all' || typeFilter !== 'all' || layawayOverdue || dateRange || searchTerm) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-2 lg:px-3"
              onClick={() => {
                onStatusFilterChange('all');
                onTypeFilterChange('all');
                onLayawayOverdueChange(false);
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
        <Button variant="outline" size="sm" className="h-9" onClick={onImportClick}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onExportClick}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </div>
    </div>
  );
}
