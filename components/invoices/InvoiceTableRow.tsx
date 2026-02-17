"use client";

import { useState } from "react";
import { MoreVertical, Eye, Printer, Edit3, DollarSign, Link2, Package, XCircle, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import type { Invoice } from "../../hooks/useInvoices";

interface InvoiceTableRowProps {
  invoice: Invoice;
  index: number;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onPay: (invoice: Invoice) => void;
  onLink?: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onShip?: (invoice: Invoice) => void;
  onFilterByClient?: (customerId: number, clientName: string) => void;
  onPrintPDF?: (invoice: Invoice) => void;
}

export default function InvoiceTableRow({
  invoice,
  index,
  onView,
  onEdit,
  onPay,
  onLink,
  onDelete,
  onShip,
  onFilterByClient,
  onPrintPDF,
}: InvoiceTableRowProps) {
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      paid: "status-paid",
      pending: "status-pending",
      overdue: "status-overdue",
      partial: "status-partial",
      inactive: "status-inactive",
    };
    return `status-badge ${classes[status as keyof typeof classes]}`;
  };

  const canPay = invoice.status !== "paid" && invoice.status !== "inactive";

  return (
    <tr
      className={`hover:bg-gray-50 transition-colors animate-fade-in-left stagger-fast-${Math.min(
        index + 1,
        8
      )}`}
      onDoubleClick={() => onView(invoice)}
    >
      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
        <button
          onClick={() => onView(invoice)}
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          {invoice.invoiceNumber}
        </button>
        {invoice.isLayaway && (
          <span className="ml-1.5 text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
            Layaway
          </span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 max-w-[160px] truncate" title={invoice.clientName}>
        {invoice.customerId && onFilterByClient ? (
          <button
            onClick={() => onFilterByClient(invoice.customerId!, invoice.clientName)}
            className="text-gray-900 hover:text-blue-600 hover:underline transition-colors"
            title="View all invoices for this client"
          >
            {invoice.clientName}
          </button>
        ) : (
          invoice.clientName
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 max-w-[120px] truncate hidden xl:table-cell" title={invoice.items?.map(i => i.name).join(", ")}>
        {invoice.items && invoice.items.length > 0
          ? invoice.items.map(i => i.name).join(", ")
          : <span className="text-gray-400">-</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
        ${invoice.amount.toLocaleString()}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        ${invoice.paidAmount.toLocaleString()}
        {invoice.status === "partial" && (
          <div className="text-xs text-gray-500 mt-0.5">
            {Math.round((invoice.paidAmount / invoice.amount) * 100)}%
          </div>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
        {formatDate(invoice.createdAt)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
        {formatDate(invoice.dueDate)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={getStatusBadge(invoice.status)}>
          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
        </span>
      </td>
      <td className="px-3 py-3 text-right text-sm font-medium">
        <Popover open={showActionsMenu} onOpenChange={setShowActionsMenu}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            <div className="flex flex-col">
              <button
                onClick={() => {
                  setShowActionsMenu(false);
                  onView(invoice);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
              >
                <Eye className="h-4 w-4" />
                View Details
              </button>
              {onPrintPDF && (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onPrintPDF(invoice);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                >
                  <Printer className="h-4 w-4" />
                  Print PDF
                </button>
              )}
              <button
                onClick={() => {
                  setShowActionsMenu(false);
                  onEdit(invoice);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
              >
                <Edit3 className="h-4 w-4" />
                Edit Invoice
              </button>
              {canPay && (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onPay(invoice);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                >
                  <DollarSign className="h-4 w-4" />
                  Record Payment
                </button>
              )}
              {canPay && onLink && (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onLink(invoice);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                >
                  <Link2 className="h-4 w-4" />
                  Link Payment
                </button>
              )}
              <button
                onClick={() => {
                  setShowActionsMenu(false);
                  onShip?.(invoice);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
              >
                <Package className="h-4 w-4" />
                {invoice.shipmentId ? "Manage Shipment" : "Create Shipment"}
              </button>
              {invoice.status !== "inactive" ? (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onDelete(invoice);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md text-left"
                >
                  <XCircle className="h-4 w-4" />
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onDelete(invoice);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-md text-left"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reactivate
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </td>
    </tr>
  );
}
