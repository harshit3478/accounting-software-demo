'use client';

import { useState } from 'react';
import { MoreVertical, Printer, Eye, Link2, Edit3 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { generatePaymentReceiptPDF } from '../../lib/payment-receipt';
import type { Payment } from '../../hooks/usePayments';

interface PaymentTableRowProps {
  payment: Payment;
  onLink?: (payment: Payment) => void;
  onView?: (payment: Payment) => void;
  onEditNotes?: (payment: Payment) => void;
}

export default function PaymentTableRow({ payment, onLink, onView, onEditNotes }: PaymentTableRowProps) {
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMethodBadgeStyle = (method: Payment['method']) => {
    const color = method?.color || '#6B7280';
    return {
      backgroundColor: `${color}20`,
      color: color,
    };
  };

  const handlePrintReceipt = () => {
    setShowActionsMenu(false);
    generatePaymentReceiptPDF({
      id: payment.id,
      amount: payment.amount,
      date: payment.paymentDate,
      notes: payment.notes,
      method: payment.method,
      invoice: payment.invoice ? {
        invoiceNumber: payment.invoice.invoiceNumber,
        clientName: payment.invoice.clientName,
        amount: payment.invoice.amount,
        paidAmount: payment.invoice.amount // Assuming this is available
      } : payment.paymentMatches?.[0] ? {
        invoiceNumber: payment.paymentMatches[0].invoice.invoiceNumber,
        clientName: payment.paymentMatches[0].invoice.clientName,
        amount: payment.paymentMatches[0].invoice.amount,
        paidAmount: payment.paymentMatches[0].invoice.amount
      } : null
    });
  };

  const handleDoubleClick = () => {
    handlePrintReceipt();
  };

  const isUnmatched = !payment.invoice && (!payment.paymentMatches || payment.paymentMatches.length === 0);

  return (
    <tr className="hover:bg-gray-50 transition-colors" onDoubleClick={handleDoubleClick}>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatDate(payment.paymentDate)}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {payment.invoice ? (
          <span className="truncate">{payment.invoice.invoiceNumber}</span>
        ) : payment.paymentMatches && payment.paymentMatches.length > 0 ? (
          <div className="flex flex-col space-y-1">
            {payment.paymentMatches.map((match) => (
              <span key={match.id} className="text-blue-600 text-xs truncate">
                {match.invoice.invoiceNumber}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-400">No invoice</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {payment.invoice ? (
          <span className="break-words line-clamp-2" title={payment.invoice.clientName}>{payment.invoice.clientName}</span>
        ) : payment.paymentMatches && payment.paymentMatches.length > 0 ? (
          <div className="flex flex-col space-y-1">
            {payment.paymentMatches.map((match) => (
              <span key={match.id} className="break-words line-clamp-1 text-xs" title={match.invoice.clientName}>
                {match.invoice.clientName}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
        ${payment.amount.toFixed(2)}
      </td>
      <td className="px-4 py-3">
        <span
          className="px-2 py-1 rounded-full text-xs font-medium inline-block truncate max-w-full"
          style={getMethodBadgeStyle(payment.method)}
        >
          {payment.method?.name || 'Unknown'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        <span className="break-words line-clamp-2" title={payment.notes || undefined}>
          {payment.notes || <span className="text-gray-400">-</span>}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium">
        <Popover open={showActionsMenu} onOpenChange={setShowActionsMenu}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            <div className="flex flex-col">
              <button
                onClick={handlePrintReceipt}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </button>
              {onView && (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onView(payment);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
              )}
              {isUnmatched && onLink && (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onLink(payment);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                >
                  <Link2 className="h-4 w-4" />
                  Link to Invoice
                </button>
              )}
              {onEditNotes && (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onEditNotes(payment);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Notes
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </td>
    </tr>
  );
}
