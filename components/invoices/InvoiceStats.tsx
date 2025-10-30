'use client';

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
      color: 'bg-blue-50 border-blue-200',
      icon: '📄',
    },
    {
      title: isFiltered ? 'Filtered Paid' : 'Paid This Month',
      value: `$${displayStats.paidThisMonth.toFixed(2)}`,
      color: 'bg-green-50 border-green-200',
      icon: '💰',
    },
    {
      title: isFiltered ? 'Filtered Overdue' : 'Overdue',
      value: displayStats.overdue.toString(),
      color: 'bg-red-50 border-red-200',
      icon: '⚠️',
    },
    {
      title: isFiltered ? 'Filtered Pending' : 'Pending',
      value: displayStats.pending.toString(),
      color: 'bg-yellow-50 border-yellow-200',
      icon: '⏳',
    },
  ];

  return (
    <>
      {isFiltered && (
        <div className="mb-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
          📊 Showing statistics for filtered results
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`${card.color} border rounded-lg p-6 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className="text-3xl">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
