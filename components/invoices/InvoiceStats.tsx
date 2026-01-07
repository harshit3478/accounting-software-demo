'use client';

import { FileText, CheckCircle, AlertCircle, Clock, Filter } from 'lucide-react';

interface InvoiceStatsProps {
  stats: {
    total: number;
    paidThisMonth: number;
    overdue: number;
    pending: number;
    filteredTotal?: number;
    filteredPaidThisMonth?: number;
    filteredOverdue?: number;
    filteredPending?: number;
  };
  showFiltered?: boolean;
}

export default function InvoiceStats({ stats, showFiltered = false }: InvoiceStatsProps) {
  const isFiltered = showFiltered && (
    stats.filteredTotal !== undefined && 
    stats.filteredTotal !== stats.total
  );

  const displayStats = isFiltered ? {
    total: stats.filteredTotal!,
    paidThisMonth: stats.filteredPaidThisMonth!,
    overdue: stats.filteredOverdue!,
    pending: stats.filteredPending!,
  } : {
    total: stats.total,
    paidThisMonth: stats.paidThisMonth,
    overdue: stats.overdue,
    pending: stats.pending,
  };

  const cards = [
    {
      title: isFiltered ? 'Filtered Invoices' : 'Total Invoices',
      value: displayStats.total.toString(),
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100'
    },
    {
      title: isFiltered ? 'Filtered Paid' : 'Paid (Month)',
      value: `$${displayStats.paidThisMonth.toFixed(2)}`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100'
    },
    {
      title: isFiltered ? 'Filtered Overdue' : 'Overdue',
      value: displayStats.overdue.toString(),
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100'
    },
    {
      title: isFiltered ? 'Filtered Pending' : 'Pending',
      value: displayStats.pending.toString(),
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100'
    },
  ];

  return (
    <div className="space-y-3">
      {isFiltered && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-md text-xs font-medium text-indigo-700 w-fit">
          <Filter className="w-3.5 h-3.5" />
          Showing filtered results
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="flex items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-colors"
          >
            <div className={`p-2 rounded-md ${card.bg} ${card.color} mr-3`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {card.title}
              </p>
              <p className="text-lg font-bold text-gray-900 leading-tight">
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
