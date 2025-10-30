'use client';

import TableSkeleton from '../TableSkeleton';
import InvoiceTableRow from './InvoiceTableRow';
import type { Invoice } from '../../hooks/useInvoices';

interface InvoiceTableProps {
  invoices: Invoice[];
  paginatedInvoices: Invoice[];
  isLoading: boolean;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onPay: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onCreateFirst: () => void;
  searchTerm: string;
  filter: string;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

export default function InvoiceTable({
  invoices,
  paginatedInvoices,
  isLoading,
  onView,
  onEdit,
  onPay,
  onDelete,
  onCreateFirst,
  searchTerm,
  filter,
  sortBy,
  onSortChange,
}: InvoiceTableProps) {
  const getSortIcon = (column: string) => {
    if (!sortBy.startsWith(column)) return null;
    return sortBy.endsWith('desc') ? '↓' : '↑';
  };

  const handleSort = (column: string) => {
    const currentColumn = sortBy.split('-')[0];
    if (currentColumn === column) {
      // Toggle direction
      onSortChange(sortBy.endsWith('desc') ? `${column}-asc` : `${column}-desc`);
    } else {
      // New column, default to desc
      onSortChange(`${column}-desc`);
    }
  };
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Invoice List</h3>
        </div>
        <TableSkeleton rows={10} />
      </div>
    );
  }

  if (paginatedInvoices.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Invoice List</h3>
        </div>
        <div className="text-center py-12">
          <svg 
            className="w-16 h-16 text-gray-400 mx-auto mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filter !== 'all' 
              ? 'Try adjusting your search or filter to find what you\'re looking for.'
              : 'Get started by creating your first invoice.'}
          </p>
          {!searchTerm && filter === 'all' && (
            <button
              onClick={onCreateFirst}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create Your First Invoice
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Invoice List
          {paginatedInvoices.length !== invoices.length && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({paginatedInvoices.length} of {invoices.length})
            </span>
          )}
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice #
              </th>
              <th 
                onClick={() => handleSort('client')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Client {getSortIcon('client')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('amount')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Amount {getSortIcon('amount')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paid
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedInvoices.map((invoice, index) => (
              <InvoiceTableRow
                key={invoice.id}
                invoice={invoice}
                index={index}
                onView={onView}
                onEdit={onEdit}
                onPay={onPay}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
