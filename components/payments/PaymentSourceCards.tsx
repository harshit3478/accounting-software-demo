'use client';

import { Filter } from 'lucide-react';
import LucideIcon from '../LucideIcon';
import type { PaymentStats, PaymentMethodFilter, PaymentMethodType } from '../../hooks/usePayments';

interface PaymentSourceCardsProps {
  stats: PaymentStats;
  filteredStats: PaymentStats;
  filterMethod: PaymentMethodFilter;
  onFilterChange: (method: PaymentMethodFilter) => void;
  showFiltered: boolean;
  paymentMethods: PaymentMethodType[];
}

export default function PaymentSourceCards({
  stats,
  filteredStats,
  filterMethod,
  onFilterChange,
  showFiltered,
  paymentMethods,
}: PaymentSourceCardsProps) {
  const displayStats = showFiltered ? filteredStats : stats;

  return (
    <div className="space-y-3">
      {showFiltered && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-md text-xs font-medium text-indigo-700 w-fit">
          <Filter className="w-3.5 h-3.5" />
          Showing filtered results
        </div>
      )}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(paymentMethods.length || 2, 4)}, minmax(0, 1fr))` }}
      >
        {paymentMethods.map((method) => {
          const methodId = String(method.id);
          const methodStats = displayStats.byMethod[method.id];
          const amount = methodStats?.amount || 0;
          const count = methodStats?.count || 0;

          return (
            <div
              key={method.id}
              onClick={() => onFilterChange(methodId === filterMethod ? 'all' : methodId)}
              className={`flex items-center p-3 bg-white border rounded-lg shadow-sm cursor-pointer transition-all ${
                filterMethod === methodId
                  ? 'ring-2 ring-blue-500 border-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div
                className="p-2 rounded-md mr-3 text-lg flex items-center justify-center"
                style={{ backgroundColor: `${method.color}20`, color: method.color }}
              >
                <LucideIcon name={method.icon} fallback={method.name} size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {method.name}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-bold text-gray-900 leading-tight">
                    ${amount.toFixed(2)}
                  </p>
                  <span className="text-xs text-gray-400">
                    ({count})
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
