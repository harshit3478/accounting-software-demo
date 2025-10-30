'use client';

import TableSkeleton from '../TableSkeleton';
import PaymentTableRow from './PaymentTableRow';
import type { Payment, PaymentSortField, SortDirection } from '../../hooks/usePayments';

interface PaymentTableProps {
  payments: Payment[];
  paginatedPayments: Payment[];
  isLoading: boolean;
  sortBy: PaymentSortField;
  sortDirection: SortDirection;
  onSort: (field: PaymentSortField) => void;
}

export default function PaymentTable({
  payments,
  paginatedPayments,
  isLoading,
  sortBy,
  sortDirection,
  onSort,
}: PaymentTableProps) {
  const getSortIcon = (field: PaymentSortField) => {
    if (sortBy !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return sortDirection === 'asc' ? <span className="text-blue-600">↑</span> : <span className="text-blue-600">↓</span>;
  };

  const SortableHeader = ({ field, children }: { field: PaymentSortField; children: React.ReactNode }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {getSortIcon(field)}
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
        </div>
        <TableSkeleton rows={10} />
      </div>
    );
  }

  if (paginatedPayments.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
        </div>
        <div className="p-12 text-center">
          <svg 
            className="mx-auto h-12 w-12 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
            ></path>
          </svg>
          <p className="text-gray-500 mt-4">No payments found</p>
          <p className="text-sm text-gray-400 mt-1">Record your first payment from an invoice</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
          <span className="text-sm text-gray-500">
            {payments.length} payment{payments.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="date">Date</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice
              </th>
              <SortableHeader field="client">Client</SortableHeader>
              <SortableHeader field="amount">Amount</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedPayments.map((payment) => (
              <PaymentTableRow key={payment.id} payment={payment} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
