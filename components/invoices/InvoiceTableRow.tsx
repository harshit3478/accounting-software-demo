'use client';

import type { Invoice } from '../../hooks/useInvoices';

interface InvoiceTableRowProps {
  invoice: Invoice;
  index: number;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onPay: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

export default function InvoiceTableRow({
  invoice,
  index,
  onView,
  onEdit,
  onPay,
  onDelete,
}: InvoiceTableRowProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      paid: 'status-paid',
      pending: 'status-pending',
      overdue: 'status-overdue',
      partial: 'status-partial',
    };
    return `status-badge ${classes[status as keyof typeof classes]}`;
  };

  return (
    <tr 
      className={`hover:bg-gray-50 transition-colors animate-fade-in-left stagger-fast-${Math.min(index + 1, 8)}`}
    >
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button
          onClick={() => onView(invoice)}
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          {invoice.invoiceNumber}
        </button>
        {invoice.isLayaway && (
          <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
            Layaway
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {invoice.clientName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        ${invoice.amount.toLocaleString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        ${invoice.paidAmount.toLocaleString()}
        {invoice.status === 'partial' && (
          <div className="text-xs text-gray-500 mt-1">
            {Math.round((invoice.paidAmount / invoice.amount) * 100)}% paid
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(invoice.dueDate)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={getStatusBadge(invoice.status)}>
          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onEdit(invoice)}
            className="text-indigo-600 hover:text-indigo-900"
            title="Edit invoice"
          >
            Edit
          </button>
          <button
            onClick={() => onPay(invoice)}
            disabled={invoice.status === 'paid'}
            className="text-green-600 hover:text-green-900 disabled:text-green-400 disabled:cursor-not-allowed"
            title={invoice.status === 'paid' ? 'Already paid' : 'Record payment'}
          >
            {invoice.status === 'paid' ? 'Paid' : 'Pay'}
          </button>
          <button
            onClick={() => onDelete(invoice)}
            className="text-red-600 hover:text-red-900"
            title="Delete invoice"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
