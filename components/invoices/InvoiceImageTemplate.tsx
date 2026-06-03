"use client";

import { BUSINESS_CONFIG } from "../../lib/business-config";
import {
  buildInvoicePdfSummaryRows,
  getInvoiceAmountDue,
  getInvoicePaymentsForPdf,
  getInvoicePdfPaymentLabel,
  getInvoiceTotalForDisplay,
  getRecalculationFeeDisplayEntries,
  getRemovedItemDepositFeeDisplayEntries,
  getVisibleLayawayFee,
  isAbandonedInvoice,
  resolveLiveTypeLabel,
  resolveInvoiceDate,
} from "../../lib/invoice-display";
import type { InvoiceItem } from "./types";

interface Payment {
  id: number;
  amount: number;
  source?: string;
  method:
    | { id: number; name: string; icon: string | null; color: string }
    | string;
  date: string;
  createdAt: string;
  notes?: string | null;
}

interface LayawayInstallment {
  id: number;
  dueDate: string;
  amount: number;
  label: string;
  isPaid: boolean;
  paidDate?: string | null;
  paidAmount?: number | null;
}

interface LayawayPlan {
  months: number;
  paymentFrequency: string;
  downPayment: number;
  installments: LayawayInstallment[];
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  items: InvoiceItem[] | null;
  subtotal: number;
  tax: number;
  discount: number;
  shippingFee?: number;
  insuranceAmount?: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  invoiceDate?: string | null;
  createdAt: string;
  layawayFee?: number;
  status: "paid" | "pending" | "overdue" | "partial" | "abandoned" | "inactive";
  isLayaway: boolean;
  description?: string | null;
  liveTypeId?: number | null;
  liveTypeSnapshot?: string | null;
  liveType?: {
    id: number;
    name: string;
    country: string;
    isActive: boolean;
    sortOrder: number;
  } | null;
  editHistory?: Array<{
    id: number;
    reason: string;
    createdAt: string;
    changes?: Record<string, any> | null;
  }> | null;
  customer?: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  layawayPlan?: LayawayPlan | null;
}

interface InvoiceImageTemplateProps {
  invoice: Invoice;
  payments: Payment[];
  abandonmentRefunds?: Payment[];
  terms?: string[] | null;
}

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function fmtDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtShortDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

export default function InvoiceImageTemplate({
  invoice,
  payments,
  abandonmentRefunds = [],
  terms,
}: InvoiceImageTemplateProps) {
  const abandoned = isAbandonedInvoice(invoice);
  const amtDue = getInvoiceAmountDue(invoice);
  const invoiceTotal = getInvoiceTotalForDisplay(invoice);
  const paymentsToShow = getInvoicePaymentsForPdf({
    status: invoice.status,
    payments,
    abandonmentRefunds,
  });
  const abandonedSummaryRows = buildInvoicePdfSummaryRows(
    { ...invoice, payments: paymentsToShow },
    { includeSubtotal: true },
  );
  const biz = BUSINESS_CONFIG;
  const shippingFee = Number(invoice.shippingFee || 0);
  const insuranceAmount = Number(invoice.insuranceAmount || 0);
  const layawayFee = getVisibleLayawayFee(invoice);
  const currentItemDepositFeeTotal = (invoice.items || []).reduce(
    (sum, item) => sum + Number(item.depositFee || 0),
    0,
  );
  const removedItemDepositFeeEntries = getRemovedItemDepositFeeDisplayEntries(
    invoice.editHistory || [],
  );
  const invoiceDepositFeeTotal = currentItemDepositFeeTotal;
  const lateFeeTotal = payments.reduce(
    (sum, payment) =>
      payment.source === "late_fee" ? sum + Number(payment.amount || 0) : sum,
    0,
  );
  const depositFeeTotal = payments.reduce(
    (sum, payment) =>
      payment.source === "deposit_fee"
        ? sum + Number(payment.amount || 0)
        : sum,
    0,
  );
  const restockingFeeTotal = payments.reduce(
    (sum, payment) =>
      payment.source === "restocking_fee"
        ? sum + Number(payment.amount || 0)
        : sum,
    0,
  );
  const recalculationFeeEntries = getRecalculationFeeDisplayEntries(
    invoice.editHistory || [],
  );
  const invoiceDate = resolveInvoiceDate(
    invoice.invoiceDate,
    invoice.createdAt,
  );
  const liveTypeLabel = resolveLiveTypeLabel(invoice);

  const hasDescription = !!invoice.description;
  const hasLayaway = !!(invoice.isLayaway && invoice.layawayPlan);
  const hasTerms = !!(terms && terms.length > 0);
  const hasNotesSection = hasDescription || hasLayaway || hasTerms;

  return (
    <div
      style={{
        width: "800px",
        backgroundColor: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#1a1a1a",
        fontSize: "13px",
        lineHeight: 1.5,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {invoice.status === "abandoned" && (
        <div
          style={{
            position: "absolute",
            top: "42%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-28deg)",
            fontSize: "86px",
            fontWeight: 800,
            letterSpacing: "8px",
            color: "rgba(220, 38, 38, 0.14)",
            border: "8px solid rgba(220, 38, 38, 0.12)",
            padding: "12px 28px",
            zIndex: 0,
            pointerEvents: "none",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Cancelled
        </div>
      )}
      {/* ── HEADER: Logo (left) + INVOICE + Biz info (right) ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "36px 48px 28px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/goldLogo.jpg.jpeg"
            alt={biz.name}
            style={{ height: "90px", width: "auto", display: "block" }}
          />
        </div>

        {/* INVOICE + Business info */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "36px",
              fontWeight: 900,
              color: "#1a1a1a",
              letterSpacing: "1px",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            INVOICE
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#1a1a1a",
            }}
          >
            {biz.name}
          </div>
          {biz.address && (
            <div
              style={{ fontSize: "12px", color: "#555555", marginTop: "3px" }}
            >
              {biz.address.split(",").map((part, i) => (
                <div key={i}>{part.trim()}</div>
              ))}
            </div>
          )}
          {biz.phone && (
            <div
              style={{ fontSize: "12px", color: "#555555", marginTop: "2px" }}
            >
              {biz.phone}
            </div>
          )}
          {biz.email && (
            <div
              style={{ fontSize: "12px", color: "#555555", marginTop: "2px" }}
            >
              {biz.email}
            </div>
          )}
        </div>
      </div>

      {/* ── SEPARATOR LINE ── */}
      <div
        style={{ height: "1px", backgroundColor: "#cccccc", margin: "0 48px" }}
      />

      {/* ── BILL TO (left) + INVOICE METADATA (right) ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "24px 48px",
          gap: "32px",
        }}
      >
        {/* BILL TO */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#999999",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "8px",
            }}
          >
            BILL TO
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a" }}>
            {invoice.clientName}
          </div>
          {invoice.customer?.address && (
            <div
              style={{
                fontSize: "12px",
                color: "#555555",
                marginTop: "4px",
                whiteSpace: "pre-line",
              }}
            >
              {invoice.customer.address}
            </div>
          )}
          {invoice.customer?.email && (
            <div
              style={{ fontSize: "12px", color: "#555555", marginTop: "4px" }}
            >
              {invoice.customer.email}
            </div>
          )}
          {invoice.customer?.phone && (
            <div
              style={{ fontSize: "12px", color: "#555555", marginTop: "2px" }}
            >
              {invoice.customer.phone}
            </div>
          )}
        </div>

        {/* Invoice metadata */}
        <div style={{ minWidth: "260px" }}>
          {/* Invoice Number */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid #eeeeee",
            }}
          >
            <span
              style={{ fontSize: "12px", fontWeight: 700, color: "#1a1a1a" }}
            >
              Invoice Number:
            </span>
            <span style={{ fontSize: "12px", color: "#333333" }}>
              {invoice.invoiceNumber}
            </span>
          </div>
          {/* Invoice Date */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid #eeeeee",
            }}
          >
            <span
              style={{ fontSize: "12px", fontWeight: 700, color: "#1a1a1a" }}
            >
              Invoice Date:
            </span>
            <span style={{ fontSize: "12px", color: "#333333" }}>
              {fmtDate(invoiceDate)}
            </span>
          </div>
          {/* Payment Due */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid #eeeeee",
            }}
          >
            <span
              style={{ fontSize: "12px", fontWeight: 700, color: "#1a1a1a" }}
            >
              Payment Due:
            </span>
            <span style={{ fontSize: "12px", color: "#333333" }}>
              {fmtDate(invoice.dueDate)}
            </span>
          </div>
          {/* Invoice Type */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              backgroundColor: invoice.isLayaway ? "#fff7ed" : "#f0fdf4",
              borderRadius: "6px",
              marginTop: "6px",
              border: invoice.isLayaway
                ? "1px solid #fdba74"
                : "1px solid #86efac",
            }}
          >
            <span
              style={{ fontSize: "12px", fontWeight: 700, color: "#1a1a1a" }}
            >
              Invoice Type:
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: invoice.isLayaway ? "#9a3412" : "#166534",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {invoice.isLayaway ? "Layaway" : "Cash"}
            </span>
          </div>
          {liveTypeLabel && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid #eeeeee",
              }}
            >
              <span
                style={{ fontSize: "12px", fontWeight: 700, color: "#1a1a1a" }}
              >
                Live Type:
              </span>
              <span style={{ fontSize: "12px", color: "#333333" }}>
                {liveTypeLabel}
              </span>
            </div>
          )}
          {/* Amount Due — highlighted */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              backgroundColor: "#f0f0f0",
              borderRadius: "4px",
              marginTop: "6px",
            }}
          >
            <span
              style={{ fontSize: "12px", fontWeight: 700, color: "#1a1a1a" }}
            >
              Amount Due (USD):
            </span>
            <span
              style={{ fontSize: "14px", fontWeight: 800, color: "#1a1a1a" }}
            >
              {fmt(amtDue)}
            </span>
          </div>
        </div>
      </div>

      {/* ── ITEMS TABLE ── */}
      {invoice.items && invoice.items.length > 0 && (
        <div style={{ padding: "0 48px 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#F5C842" }}>
                {[
                  { label: "Items", align: "left" as const },
                  { label: "Qty / Unit", align: "center" as const, w: "110px" },
                  { label: "Price", align: "right" as const, w: "110px" },
                  { label: "Amount", align: "right" as const, w: "110px" },
                ].map(({ label, align, w }) => (
                  <th
                    key={label}
                    style={{
                      padding: "10px 14px",
                      textAlign: align,
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#1a1a1a",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      width: w,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => {
                const parts = item.name.split("\n");
                const mainName = parts[0];
                const subtitle = parts.slice(1).join(" ");
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid #eeeeee",
                    }}
                  >
                    <td
                      style={{
                        padding: "11px 14px",
                        fontSize: "13px",
                        color: "#1a1a1a",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{mainName}</div>
                      {Number(item.depositFee || 0) > 0 && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#9a6b00",
                            fontWeight: 600,
                            marginTop: "2px",
                          }}
                        >
                          Deposit fee: {fmt(Number(item.depositFee || 0))}
                        </div>
                      )}
                      {subtitle && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#777777",
                            fontWeight: 400,
                            marginTop: "2px",
                          }}
                        >
                          {subtitle}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "11px 14px",
                        fontSize: "13px",
                        color: "#1a1a1a",
                        textAlign: "center",
                      }}
                    >
                      {item.quantity} {item.unit || "grams"}
                    </td>
                    <td
                      style={{
                        padding: "11px 14px",
                        fontSize: "13px",
                        color: "#1a1a1a",
                        textAlign: "right",
                      }}
                    >
                      {fmt(item.price)}
                    </td>
                    <td
                      style={{
                        padding: "11px 14px",
                        fontSize: "13px",
                        color: "#1a1a1a",
                        textAlign: "right",
                        fontWeight: 700,
                      }}
                    >
                      {fmt(item.quantity * item.price)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TOTALS ── */}
      <div
        style={{
          padding: "0 48px 28px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <div style={{ width: "320px" }}>
          {abandoned ? (
            abandonedSummaryRows.map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "#333333" }}>{row.label}</span>
                <span style={{ fontWeight: 600 }}>{fmt(row.value)}</span>
              </div>
            ))
          ) : (
            <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "#333333" }}>Subtotal:</span>
            <span style={{ fontWeight: 600 }}>{fmt(invoice.subtotal)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "#333333" }}>Tax:</span>
            <span style={{ fontWeight: 600 }}>{fmt(invoice.tax)}</span>
          </div>
          {invoice.discount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>Discount:</span>
              <span style={{ fontWeight: 600 }}>-{fmt(invoice.discount)}</span>
            </div>
          )}
          {shippingFee > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>Shipping Fee:</span>
              <span style={{ fontWeight: 600 }}>{fmt(shippingFee)}</span>
            </div>
          )}
          {insuranceAmount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>Insurance:</span>
              <span style={{ fontWeight: 600 }}>{fmt(insuranceAmount)}</span>
            </div>
          )}
          {layawayFee > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>Layaway Fee:</span>
              <span style={{ fontWeight: 600 }}>{fmt(layawayFee)}</span>
            </div>
          )}
          {invoiceDepositFeeTotal > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>Total Deposit Amount:</span>
              <span style={{ fontWeight: 600 }}>
                {fmt(invoiceDepositFeeTotal)}
              </span>
            </div>
          )}
          {lateFeeTotal > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>Late Fee:</span>
              <span style={{ fontWeight: 600 }}>{fmt(lateFeeTotal)}</span>
            </div>
          )}
          {depositFeeTotal > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>Deposit Fee:</span>
              <span style={{ fontWeight: 600 }}>{fmt(depositFeeTotal)}</span>
            </div>
          )}
          {removedItemDepositFeeEntries.map((entry) => (
            <div
              key={`${entry.date}-${entry.label}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>
                {entry.action === "skip"
                  ? `${entry.label}: ${entry.reason}`
                  : `${entry.label} (${fmtDate(entry.date)})`}
              </span>
              <span style={{ fontWeight: 600 }}>{fmt(entry.amount)}</span>
            </div>
          ))}
          {restockingFeeTotal > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>Restocking Fee:</span>
              <span style={{ fontWeight: 600 }}>
                {fmt(restockingFeeTotal)}
              </span>
            </div>
          )}
          {recalculationFeeEntries.map((entry) => (
            <div
              key={`${entry.date}-${entry.label}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#333333" }}>
                {entry.label} ({fmtDate(entry.date)})
              </span>
              <span style={{ fontWeight: 600 }}>{fmt(entry.amount)}</span>
            </div>
          ))}
            </>
          )}
          <div
            style={{
              height: "1px",
              backgroundColor: "#cccccc",
              margin: "8px 0",
            }}
          />
          {/* Total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "#333333" }}>
              {abandoned ? "Invoice Total:" : "Total:"}
            </span>
            <span style={{ fontWeight: 600 }}>{fmt(invoiceTotal)}</span>
          </div>

          {/* Each payment */}
          {[...paymentsToShow]
            .sort(
              (a, b) =>
                new Date(a.date || a.createdAt).getTime() -
                new Date(b.date || b.createdAt).getTime(),
            )
            .map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    fontSize: "12px",
                  }}
                >
                  <span
                    style={{ color: "#555555", flex: 1, paddingRight: "8px" }}
                  >
                    {getInvoicePdfPaymentLabel(p)}
                  </span>
                  <span style={{ color: "#333333", whiteSpace: "nowrap" }}>
                    {fmt(p.amount)}
                  </span>
                </div>
              ))}

          {/* Separator */}
          <div
            style={{
              height: "1px",
              backgroundColor: "#cccccc",
              margin: "8px 0",
            }}
          />

          {/* Amount Due */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            <span>Amount Due (USD):</span>
            <span>{fmt(amtDue)}</span>
          </div>
        </div>
      </div>

      {/* ── NOTES / TERMS ── */}
      {hasNotesSection && (
        <div style={{ padding: "0 48px 28px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#1a1a1a",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "12px",
              paddingBottom: "6px",
              borderBottom: "2px solid #1a1a1a",
            }}
          >
            Notes / Terms
          </div>

          {/* Description */}
          {hasDescription && (
            <div
              style={{
                fontSize: "12px",
                color: "#555555",
                marginBottom: "10px",
              }}
            >
              {invoice.description}
            </div>
          )}

          {/* Layaway schedule */}
          {hasLayaway && (
            <div
              style={{
                fontSize: "12px",
                color: "#333333",
                marginBottom: "10px",
              }}
            >
              <div style={{ marginBottom: "4px" }}>
                <strong>TERMS: LAY-AWAY</strong>{" "}
                <span style={{ color: "#555555" }}>
                  &nbsp;&nbsp;Month(s): {invoice.layawayPlan!.months}
                  &nbsp;&nbsp;&nbsp;Payment Type:{" "}
                  {invoice.layawayPlan!.paymentFrequency}
                </span>
              </div>
              {invoice.layawayPlan!.installments.map((inst, i) => (
                <div key={i} style={{ padding: "2px 0", color: "#555555" }}>
                  {fmtShortDate(inst.dueDate)} - {inst.label} -{" "}
                  {fmt(inst.amount)}
                </div>
              ))}
            </div>
          )}

          {/* Standard terms from DB */}
          {hasTerms && (
            <div
              style={{ marginTop: hasDescription || hasLayaway ? "10px" : 0 }}
            >
              {terms!.map((line, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: "11px",
                    color: "#555555",
                    marginBottom: "4px",
                    lineHeight: 1.4,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FOOTER ── */}
      <div
        style={{
          padding: "16px 48px",
          borderTop: "1px solid #dddddd",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          alignItems: "center",
        }}
      >
        <div
          style={{ fontSize: "11px", color: "#999999", textAlign: "center" }}
        >
          Gold Connections By Apple is a DBA of Cooper Creek LLC
        </div>
        <div
          style={{ fontSize: "11px", color: "#999999", textAlign: "center" }}
        >
          Invoice #{invoice.invoiceNumber}
        </div>
        <div
          style={{ fontSize: "11px", color: "#999999", textAlign: "center" }}
        >
          Generated on{" "}
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>
    </div>
  );
}
