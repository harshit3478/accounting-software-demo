'use client';

interface InvoicePageHeaderProps {
  stats: {
    total: number;
    paidThisMonth: number;
    overdue: number;
    pending: number;
    layaway: number;
    totalOutstanding: number;
  };
  onCreateClick: () => void;
  onBulkUploadClick: () => void;
  onExportClick: () => void;
  onExportPDF?: () => void;
}

export default function InvoicePageHeader({
  stats,
  onCreateClick,
  onBulkUploadClick,
  onExportClick,
  onExportPDF,
}: InvoicePageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats.total} total • {stats.pending} pending • {stats.overdue} overdue
            {stats.layaway > 0 && ` • ${stats.layaway} layaway`}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onExportClick}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Export PDF
            </button>
          )}
          <button
            onClick={onBulkUploadClick}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Bulk Upload
          </button>
          <button
            onClick={onCreateClick}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Create Invoice
          </button>
        </div>
      </div>
      
      {stats.totalOutstanding > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Total Outstanding:</span> ${stats.totalOutstanding.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
