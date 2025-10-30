'use client';

import Link from 'next/link';

interface PaymentPageHeaderProps {
  unmatchedCount: number;
  totalToday: number;
  onRecordClick: () => void;
  onBulkUploadClick: () => void;
  onExportPDF?: () => void;
}

export default function PaymentPageHeader({
  unmatchedCount,
  totalToday,
  onRecordClick,
  onBulkUploadClick,
  onExportPDF,
}: PaymentPageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Payment Processing</h2>
            </div>
            {/* Payment Matching Link Icon */}
            <Link
              href="/payments/matching"
              className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors border border-purple-200"
              title="Payment Matching"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <span className="text-sm font-medium">Match Payments</span>
              {unmatchedCount > 0 && (
                <span className="bg-purple-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {unmatchedCount > 99 ? '99+' : unmatchedCount}
                </span>
              )}
            </Link>
          </div>
          <div className="flex items-center space-x-4">
           
             {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="px-4 py-3 text-sm font-medium text-gray-700  border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Export PDF
            </button>
          )}
            <button
              onClick={onBulkUploadClick}
              className="px-4 py-3 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              Bulk Upload
            </button>
            <button
              onClick={onRecordClick}
              className="px-4 py-3 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Record New Payment
            </button>
            <div className="text-right">
              <p className="text-sm text-gray-500">Processed Today</p>
              <p className="text-2xl font-bold text-gray-900">${totalToday.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
