'use client';

import type { Payment } from '../../hooks/usePayments';

interface PaymentTableRowProps {
  payment: Payment;
  onLink?: (payment: Payment) => void;
}

export default function PaymentTableRow({ payment, onLink }: PaymentTableRowProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMethodBadgeClass = (method: string) => {
    const classes = {
      cash: 'bg-amber-100 text-amber-800',
      zelle: 'bg-green-100 text-green-800',
      quickbooks: 'bg-blue-100 text-blue-800',
      layaway: 'bg-purple-100 text-purple-800',
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${classes[method as keyof typeof classes]}`;
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {formatDate(payment.paymentDate)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {payment.invoice ? (
          payment.invoice.invoiceNumber
        ) : payment.paymentMatches && payment.paymentMatches.length > 0 ? (
          <div className="flex flex-col space-y-1">
            {payment.paymentMatches.map((match) => (
              <span key={match.id} className="text-blue-600">
                {match.invoice.invoiceNumber}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-400">No invoice</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-[200px] truncate">
        {payment.invoice ? (
          <span title={payment.invoice.clientName}>{payment.invoice.clientName}</span>
        ) : payment.paymentMatches && payment.paymentMatches.length > 0 ? (
          <div className="flex flex-col space-y-1">
            {payment.paymentMatches.map((match) => (
              <span key={match.id} className="truncate" title={match.invoice.clientName}>
                {match.invoice.clientName}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
        ${payment.amount.toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={getMethodBadgeClass(payment.method)}>
          {payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
        {payment.notes || <span className="text-gray-400">-</span>}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        {!payment.isMatched && onLink && (
          <button
            onClick={() => onLink(payment)}
            className="text-indigo-600 hover:text-indigo-900"
          >
            Link
          </button>
        )}
      </td>
    </tr>
  );
}
