'use client';

import { useState } from 'react';

export interface DateRange {
  startDate: string;
  endDate: string;
  preset: string;
}

interface DateRangePickerProps {
  onChange: (range: DateRange) => void;
  value: DateRange;
}

export default function DateRangePicker({ onChange, value }: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);

  const getPresetDates = (preset: string): DateRange => {
    const today = new Date();
    const startDate = new Date();
    
    switch (preset) {
      case 'this-month':
        startDate.setDate(1);
        break;
      case 'last-month':
        startDate.setMonth(today.getMonth() - 1);
        startDate.setDate(1);
        return {
          preset,
          startDate: startDate.toISOString().split('T')[0],
          endDate: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]
        };
      case 'this-quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate.setMonth(quarter * 3);
        startDate.setDate(1);
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'all':
        return {
          preset,
          startDate: '',
          endDate: ''
        };
      default:
        return value;
    }

    return {
      preset,
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
  };

  const handlePresetClick = (preset: string) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(getPresetDates(preset));
  };

  const handleCustomChange = (field: 'startDate' | 'endDate', newValue: string) => {
    onChange({
      ...value,
      preset: 'custom',
      [field]: newValue
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick Filter Buttons */}
      <button
        onClick={() => handlePresetClick('all')}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
          value.preset === 'all'
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        All Time
      </button>
      <button
        onClick={() => handlePresetClick('this-month')}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
          value.preset === 'this-month'
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        This Month
      </button>
      <button
        onClick={() => handlePresetClick('last-month')}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
          value.preset === 'last-month'
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        Last Month
      </button>
      <button
        onClick={() => handlePresetClick('this-quarter')}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
          value.preset === 'this-quarter'
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        This Quarter
      </button>
      <button
        onClick={() => handlePresetClick('this-year')}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
          value.preset === 'this-year'
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        This Year
      </button>
      <button
        onClick={() => handlePresetClick('custom')}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
          value.preset === 'custom' || showCustom
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        Custom Range
      </button>

      {/* Custom Date Inputs */}
      {(showCustom || value.preset === 'custom') && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={value.startDate}
            onChange={(e) => handleCustomChange('startDate', e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={value.endDate}
            onChange={(e) => handleCustomChange('endDate', e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}
    </div>
  );
}
