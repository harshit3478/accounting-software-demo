'use client';

import { DollarSign, CreditCard, Banknote, Clock, Filter } from 'lucide-react';
import type { PaymentStats, PaymentMethodFilter } from '../../hooks/usePayments';

interface PaymentSourceCardsProps {
  stats: PaymentStats;
  filteredStats: PaymentStats;
  filterMethod: PaymentMethodFilter;
  onFilterChange: (method: PaymentMethodFilter) => void;
  showFiltered: boolean;
}

export default function PaymentSourceCards({
  stats,
  filteredStats,
  filterMethod,
  onFilterChange,
  showFiltered,
}: PaymentSourceCardsProps) {
  const displayStats = showFiltered ? filteredStats : stats;
  
  const paymentSources = [
    {
      id: 'zelle' as PaymentMethodFilter,
      name: 'Zelle',
      amount: displayStats.zelleToday,
      count: displayStats.zelleCount,
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-100'
    },
    {
      id: 'quickbooks' as PaymentMethodFilter,
      name: 'QuickBooks',
      amount: displayStats.quickbooksToday,
      count: displayStats.quickbooksCount,
      icon: CreditCard,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100'
    },
    {
      id: 'cash' as PaymentMethodFilter,
      name: 'Cash',
      amount: displayStats.cashToday,
      count: displayStats.cashCount,
      icon: Banknote,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100'
    },
    {
      id: 'layaway' as PaymentMethodFilter,
      name: 'Layaway',
      amount: displayStats.layawayToday,
      count: displayStats.layawayCount,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-100'
    }
  ];

  return (
    <div className="space-y-3">
      {showFiltered && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-md text-xs font-medium text-indigo-700 w-fit">
          <Filter className="w-3.5 h-3.5" />
          Showing filtered results
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {paymentSources.map((source) => (
          <div
            key={source.id}
            onClick={() => onFilterChange(source.id === filterMethod ? 'all' : source.id)}
            className={`flex items-center p-3 bg-white border rounded-lg shadow-sm cursor-pointer transition-all ${
              filterMethod === source.id 
                ? 'ring-2 ring-blue-500 border-blue-500' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`p-2 rounded-md ${source.bg} ${source.color} mr-3`}>
              <source.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {source.name}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-gray-900 leading-tight">
                  ${source.amount.toFixed(2)}
                </p>
                <span className="text-xs text-gray-400">
                  ({source.count})
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
