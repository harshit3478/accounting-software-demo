"use client";

import { useState } from "react";
import {
  MoreVertical,
  Eye,
  Printer,
  Edit3,
  DollarSign,
  Link2,
  Package,
  XCircle,
  RotateCcw,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import type { Invoice } from "../../hooks/useInvoices";
import { formatBusinessDate } from "../../lib/business-date";

interface InvoiceTableRowProps {
  invoice: Invoice;
  index: number;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onPay: (invoice: Invoice) => void;
  onLink?: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onToggleHold?: (invoice: Invoice) => void;
  onShip?: (invoice: Invoice) => void;
  onFilterByClient?: (customerId: number, clientName: string) => void;
  onPrintPDF?: (invoice: Invoice) => void;
  isSelected?: boolean;
  onToggleSelect?: (invoiceId: number) => void;
}

export default function InvoiceTableRow({
  invoice,
  index,
  onView,
  onEdit,
  onPay,
  onLink,
  onDelete,
  onToggleHold,
  onShip,
  onFilterByClient,
  onPrintPDF,
  isSelected,
  onToggleSelect,
}: InvoiceTableRowProps) {
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const formatDate = (dateString: string) => formatBusinessDate(dateString);

  const getStatusBadge = (status: string) => {
    const classes = {
      paid: "status-paid",
      pending: "status-pending",
      overdue: "status-overdue",
      partial: "status-partial",
      abandoned: "status-abandoned",
      inactive: "status-inactive",
    };
    return `status-badge ${classes[status as keyof typeof classes]}`;
  };

  const canPay =
    invoice.status !== "paid" &&
    invoice.status !== "inactive" &&
    invoice.status !== "abandoned" &&
    !invoice.isHold;

  const trk = invoice.trackingNumber?.trim();
  const sid = invoice.shipmentId?.trim();
  const shipTitle = trk
    ? `Tracking: ${trk}`
    : sid
      ? `Queued (shipment ${sid})`
      : "No shipment";
  const shipLabel = trk
    ? trk.length > 11
      ? `${trk.slice(0, 9)}…`
      : trk
    : sid
      ? "Queued"
      : "—";

  return (
    <tr
      className={`hover:bg-gray-50 transition-colors animate-fade-in-left stagger-fast-${Math.min(
        index + 1,
        8,
      )}`}
      onDoubleClick={() => onView(invoice)}
    >
      <td className="px-3 py-3 whitespace-nowrap text-sm">
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={() => onToggleSelect?.(invoice.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select invoice ${invoice.invoiceNumber}`}
        />
      </td>
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
        {invoice.isHold && (
          <span className="ml-1.5 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
            Hold
          </span>
        )}
      </td>
      <td
        className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 max-w-[160px] truncate"
        title={invoice.clientName}
      >
        {invoice.customerId && onFilterByClient ? (
          <button
            onClick={() =>
              onFilterByClient(invoice.customerId!, invoice.clientName)
            }
            className="text-gray-900 hover:text-blue-600 hover:underline transition-colors"
            title="View all invoices for this client"
          >
            {invoice.clientName}
          </button>
        ) : (
          invoice.clientName
        )}
      </td>
      <td
        className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell max-w-[160px] truncate"
        title={
          invoice.liveType?.name
            ? `${invoice.liveType.name} (${invoice.liveType.country})`
            : invoice.liveTypeSnapshot || ""
        }
      >
        {invoice.liveType?.name ? (
          <span>
            {invoice.liveType.name}
            <span className="text-xs text-gray-400 ml-1">
              ({invoice.liveType.country})
            </span>
          </span>
        ) : invoice.liveTypeSnapshot ? (
          invoice.liveTypeSnapshot
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td
        className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 max-w-[120px] truncate hidden xl:table-cell"
        title={invoice.items?.map((i) => i.name).join(", ")}
      >
        {invoice.items && invoice.items.length > 0 ? (
          invoice.items.map((i) => i.name).join(", ")
        ) : (
          <span className="text-gray-400">-</span>
        )}
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
        {formatDate(invoice.invoiceDate || invoice.createdAt)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
        {formatDate(invoice.dueDate)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={getStatusBadge(invoice.status)}>
          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {invoice.isHold ? (
          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            On Hold
          </span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </td>
      <td
        className="px-2 sm:px-3 py-3 text-xs text-gray-700 max-w-[3rem] sm:max-w-[130px]"
        title={shipTitle}
      >
        <div className="flex items-center justify-center sm:justify-start min-w-0">
          <Package
            className={`h-4 w-4 sm:hidden ${
              trk
                ? "text-emerald-600"
                : sid
                  ? "text-amber-600"
                  : "text-gray-300"
            }`}
            aria-hidden
          />
          <span className="hidden sm:inline truncate tabular-nums">
            {shipLabel}
          </span>
        </div>
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
              {onToggleHold && (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onToggleHold(invoice);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left ${
                    invoice.isHold
                      ? "text-emerald-700 hover:bg-emerald-50"
                      : "text-amber-700 hover:bg-amber-50"
                  }`}
                >
                  {invoice.isHold ? (
                    <PlayCircle className="h-4 w-4" />
                  ) : (
                    <PauseCircle className="h-4 w-4" />
                  )}
                  {invoice.isHold ? "Remove Hold" : "Hold Invoice"}
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
              {invoice.status !== "inactive" &&
                invoice.status !== "abandoned" && (
                  <button
                    onClick={() => {
                      setShowActionsMenu(false);
                      onDelete(invoice);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md text-left"
                  >
                    <XCircle className="h-4 w-4" />
                    Mark Abandoned
                  </button>
                )}
              {invoice.status === "inactive" && (
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
