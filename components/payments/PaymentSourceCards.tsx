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
        className="relative rounded-lg border border-gray-100 bg-gray-50/50 -mx-1 px-1"
        aria-label="Payment methods — scroll horizontally to see all"
      >
        <div
          className="flex gap-2 overflow-x-auto pb-1 pt-0.5 snap-x snap-mandatory scroll-px-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300"
          tabIndex={0}
        >
          {paymentMethods.map((method) => {
            const methodId = String(method.id);
            const methodStats = displayStats.byMethod[method.id];
            const amount = methodStats?.amount || 0;
            const count = methodStats?.count || 0;

            return (
              <div
                key={method.id}
                role="button"
                tabIndex={-1}
                onClick={() => onFilterChange(methodId === filterMethod ? 'all' : methodId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onFilterChange(methodId === filterMethod ? 'all' : methodId);
                  }
                }}
                className={`flex-shrink-0 snap-start w-[118px] sm:w-[128px] flex items-stretch p-2 bg-white border rounded-md shadow-sm cursor-pointer transition-all ${
                  filterMethod === methodId
                    ? 'ring-2 ring-blue-500 border-blue-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className="p-1.5 rounded-md mr-2 text-base flex items-center justify-center flex-shrink-0 self-start"
                  style={{ backgroundColor: `${method.color}20`, color: method.color }}
                >
                  <LucideIcon name={method.icon} fallback={method.name} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight line-clamp-2"
                    title={method.name}
                  >
                    {method.name}
                  </p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <p className="text-sm font-bold text-gray-900 leading-tight tabular-nums truncate" title={`$${amount.toFixed(2)}`}>
                      ${amount.toFixed(2)}
                    </p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      ({count})
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
