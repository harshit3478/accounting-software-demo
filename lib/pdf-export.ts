import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BUSINESS_CONFIG } from "./business-config";
import {
  getRecalculationFeeDisplayEntries,
  getRemovedItemDepositFeeDisplayEntries,
  getVisibleLayawayFee,
  resolveInvoiceDate,
  resolveLiveTypeLabel,
} from "./invoice-display";

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  invoiceDate?: string | null;
  status: string;
  createdAt: string;
  layawayFee?: number;
  description?: string | null;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    unit?: string;
    depositFee?: number | null;
  }> | null;
  termsSnapshot?: string[] | null;
  // Enriched data for branded PDF
  customer?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  subtotal?: number;
  tax?: number;
  discount?: number;
  shippingFee?: number;
  insuranceAmount?: number;
  isLayaway?: boolean;
  layawayPlan?: {
    months: number;
    paymentFrequency: string;
    downPayment: number;
    installments: Array<{
      label: string;
      dueDate: string;
      amount: number;
      isPaid: boolean;
      paidDate?: string | null;
      paidAmount?: number | null;
    }>;
  } | null;
  payments?: Array<{
    amount: number;
    paymentDate: string;
    method?: { name: string } | null;
    source?: string;
  }> | null;
  liveTypeId?: number | null;
  liveTypeSnapshot?: string | null;
  liveType?: {
    name?: string | null;
    country?: string | null;
  } | null;
  editHistory?: Array<{
    id: number;
    reason: string;
    createdAt: string;
    changes?: Record<string, any> | null;
  }> | null;
}

const { colors } = BUSINESS_CONFIG;

function getPaymentSourceTotal(invoice: Invoice, source: string): number {
  return (invoice.payments || []).reduce(
    (sum, payment) =>
      payment.source === source ? sum + Number(payment.amount || 0) : sum,
    0,
  );
}

function getCurrentItemDepositFeeTotal(invoice: Invoice): number {
  return (invoice.items || []).reduce(
    (sum, item) => sum + Number(item.depositFee || 0),
    0,
  );
}

function drawCancelledWatermark(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.14 }));
  doc.setTextColor(220, 38, 38);
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(54);
  doc.text("CANCELLED", pageW / 2, pageH / 2, {
    align: "center",
    angle: -28,
  });
  doc.restoreGraphicsState();
}

function drawBrandedHeader(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const centerX = pageW / 2;

  // Gold accent line at top
  doc.setDrawColor(...colors.goldRGB);
  doc.setLineWidth(1.5);
  doc.line(15, 10, pageW - 15, 10);

  // Business name
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.charcoalRGB);
  doc.text(BUSINESS_CONFIG.name, centerX, 22, { align: "center" });

  // Tagline
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(BUSINESS_CONFIG.tagline, centerX, 28, { align: "center" });

  // Contact info
  const contactParts: string[] = [];
  if (BUSINESS_CONFIG.website) contactParts.push(BUSINESS_CONFIG.website);
  if (BUSINESS_CONFIG.phone) contactParts.push(BUSINESS_CONFIG.phone);
  if (BUSINESS_CONFIG.email) contactParts.push(BUSINESS_CONFIG.email);
  if (contactParts.length > 0) {
    doc.setFontSize(8);
    doc.text(contactParts.join("  |  "), centerX, 33, { align: "center" });
  }

  // Gold line below header
  doc.setDrawColor(...colors.goldRGB);
  doc.setLineWidth(0.5);
  doc.line(15, 36, pageW - 15, 36);

  return 42; // Return Y position after header
}

export function generateInvoicesPDF(
  invoices: Invoice[],
  filters?: {
    dateRange?: { start: string; end: string } | null;
    statusFilter?: string;
    searchTerm?: string;
  },
) {
  const doc = new jsPDF();

  let yPos = drawBrandedHeader(doc);

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.charcoalRGB);
  doc.text("Invoice Statement", 105, yPos, { align: "center" });
  yPos += 6;

  // Generated date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, yPos, {
    align: "center",
  });
  yPos += 8;

  // Date range if applied
  if (filters?.dateRange) {
    doc.setFontSize(9);
    doc.setTextColor(...colors.goldRGB);
    doc.text(
      `Period: ${new Date(filters.dateRange.start).toLocaleDateString()} - ${new Date(filters.dateRange.end).toLocaleDateString()}`,
      105,
      yPos,
      { align: "center" },
    );
    yPos += 8;
  }

  // Summary box with gold accent
  doc.setFillColor(...colors.creamRGB);
  doc.roundedRect(15, yPos, 180, 28, 3, 3, "F");
  doc.setDrawColor(...colors.goldRGB);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, yPos, 180, 28, 3, 3, "S");

  yPos += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.charcoalRGB);
  doc.text("Summary", 20, yPos);

  yPos += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalOutstanding = totalAmount - totalPaid;

  doc.text(`Total Invoices: ${invoices.length}`, 20, yPos);
  doc.text(
    `Total Amount: $${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    90,
    yPos,
  );
  yPos += 6;
  doc.text(
    `Total Paid: $${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    20,
    yPos,
  );
  doc.text(
    `Outstanding: $${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    90,
    yPos,
  );

  yPos += 12;

  // Table with gold header
  const tableData = invoices.map((invoice) => [
    invoice.invoiceNumber,
    invoice.clientName,
    new Date(invoice.createdAt).toLocaleDateString(),
    `$${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `$${invoice.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `$${(invoice.amount - invoice.paidAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        "Invoice #",
        "Client Name",
        "Date",
        "Amount",
        "Paid",
        "Balance",
        "Status",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: colors.goldRGB,
      textColor: 255,
      fontStyle: "bold",
      halign: "left",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8, textColor: 50 },
    alternateRowStyles: { fillColor: colors.creamRGB },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 40 },
      2: { cellWidth: 22 },
      3: { halign: "right", cellWidth: 25 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 25 },
      6: { cellWidth: 22 },
    },
    margin: { left: 15, right: 15 },
    didParseCell: function (data) {
      if (data.column.index === 6 && data.section === "body") {
        const status = data.cell.raw as string;
        if (status.toLowerCase() === "paid") {
          data.cell.styles.textColor = [34, 139, 34];
          data.cell.styles.fontStyle = "bold";
        } else if (status.toLowerCase() === "overdue") {
          data.cell.styles.textColor = [220, 53, 69];
          data.cell.styles.fontStyle = "bold";
        } else if (status.toLowerCase() === "pending") {
          data.cell.styles.textColor = [255, 140, 0];
        }
      }
    },
  });

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...colors.goldRGB);
    doc.setLineWidth(0.5);
    doc.line(15, 280, doc.internal.pageSize.getWidth() - 15, 280);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      "Gold Connections By Apple is a DBA of Cooper Creek LLC",
      105,
      282,
      { align: "center" },
    );
    doc.text(`${BUSINESS_CONFIG.name} - ${BUSINESS_CONFIG.tagline}`, 105, 284, {
      align: "center",
    });
    doc.text(
      `Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`,
      105,
      288,
      { align: "center" },
    );
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const fileName = filters?.dateRange
    ? `invoice-statement-${filters.dateRange.start}-to-${filters.dateRange.end}.pdf`
    : `invoice-statement-${timestamp}.pdf`;

  doc.save(fileName);
}

export async function generateSingleInvoicePDF(
  invoice: Invoice,
  mode: "download" | "print" = "print",
  printWindow?: Window | null,
): Promise<void> {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const L = 14; // left margin
  const R = pageW - 14; // right edge

  // ── 1. Load logo (preserve aspect ratio) ─────────────────────────────────
  let logoBase64: string | null = null;
  let logoW = 62; // mm — default width
  let logoH = 46; // mm — will be recalculated from natural dimensions
  try {
    const res = await fetch("/goldLogo.jpg.jpeg");
    const blob = await res.blob();
    logoBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    // Get natural image dimensions to preserve aspect ratio
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = logoBase64!;
    });
    if (dims.w > 0) logoH = logoW * (dims.h / dims.w);
  } catch {}

  // ── 2. Fetch default terms from DB ────────────────────────────────────────
  let defaultTermLines: string[] = [];
  try {
    const res = await fetch("/api/terms");
    const data = await res.json();
    if (Array.isArray(data)) {
      const def = data.find((t: any) => t.isDefault);
      if (def?.lines && Array.isArray(def.lines))
        defaultTermLines = def.lines as string[];
    }
  } catch {}

  const invoiceTermLines = Array.isArray(invoice.termsSnapshot)
    ? invoice.termsSnapshot.filter((line) => String(line || "").trim())
    : [];
  const effectiveTermLines =
    invoiceTermLines.length > 0 ? invoiceTermLines : defaultTermLines;

  // ── 3. HEADER: Logo (left) + INVOICE + Business info (right) ─────────────
  let y = 10;

  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", L, y, logoW, logoH);
  }

  // "INVOICE" large text
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text("INVOICE", R, y + 9, { align: "right" });

  // Business name (bold)
  const biz = BUSINESS_CONFIG;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text(biz.name, R, y + 20, { align: "right" });

  // Business address + contact
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  let bizY = y + 27;
  if (biz.address) {
    const parts = biz.address
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    parts.forEach((part) => {
      doc.text(part, R, bizY, { align: "right" });
      bizY += 5;
    });
    bizY += 2;
  }
  if (biz.websiteAdress) {
    doc.text(biz.websiteAdress, R, bizY, { align: "right" });
    bizY += 5;
  }

  y = Math.max(y + logoH + 4, bizY + 4);

  // ── 4. SEPARATOR LINE ─────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(L, y, R, y);
  y += 8;

  // ── 5. BILL TO (left) + INVOICE METADATA (right) ─────────────────────────
  const metaStartY = y;
  const rightColX = 105; // right column starts here

  // BILL TO label
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(150, 150, 150);
  doc.text("BILL TO", L, y);
  y += 6;

  // Client name
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text(invoice.clientName, L, y);
  y += 6;

  // Customer contact details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  if (invoice.customer?.address) {
    const addrLines = doc.splitTextToSize(invoice.customer.address, 80);
    doc.text(addrLines, L, y);
    y += addrLines.length * 5;
  }
  if (invoice.customer?.phone) {
    doc.text(invoice.customer.phone, L, y);
    y += 5;
  }
  if (invoice.customer?.email) {
    doc.text(invoice.customer.email, L, y);
    y += 5;
  }

  // Right column: invoice metadata
  const metaLabelX = rightColX + 55; // right-aligned labels end here
  let metaY = metaStartY + 6; // skip past the BILL TO label row
  const invoiceDate = resolveInvoiceDate(
    invoice.invoiceDate,
    invoice.createdAt,
  );
  const layawayFee = getVisibleLayawayFee(invoice);
  const removedItemDepositFeeEntries = getRemovedItemDepositFeeDisplayEntries(
    invoice.editHistory || [],
  );
  const totalDepositAmount = getCurrentItemDepositFeeTotal(invoice);
  const liveTypeLabel = resolveLiveTypeLabel(invoice);

  const metaRows = [
    { label: "Invoice Number:", value: invoice.invoiceNumber },
    {
      label: "Invoice Date:",
      value: new Date(invoiceDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    },
    {
      label: "Payment Due:",
      value: new Date(invoice.dueDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    },
    {
      label: "Invoice Type:",
      value: invoice.isLayaway ? "Layaway" : "Cash",
    },
    ...(liveTypeLabel ? [{ label: "Live Type:", value: liveTypeLabel }] : []),
  ];

  metaRows.forEach((row) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 26);
    doc.text(row.label, metaLabelX, metaY, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(row.value, R, metaY, { align: "right" });
    metaY += 6;
  });

  // const summaryRows = [
  //   { label: "Subtotal:", value: Number(invoice.subtotal || 0) },
  //   { label: "Tax:", value: Number(invoice.tax || 0) },
  //   { label: "Discount:", value: -Number(invoice.discount || 0) },
  //   { label: "Shipping Fee:", value: Number(invoice.shippingFee || 0) },
  //   { label: "Insurance:", value: Number(invoice.insuranceAmount || 0) },
  // ].filter((row) => row.value !== 0);

  // summaryRows.forEach((row) => {
  //   doc.setFontSize(9);
  //   doc.setFont("helvetica", "normal");
  //   doc.setTextColor(60, 60, 60);
  //   doc.text(row.label, rightColX, metaY, { align: "left" });
  //   const valueText =
  //     row.label === "Discount:"
  //       ? `-$${Math.abs(row.value).toFixed(2)}`
  //       : `$${row.value.toFixed(2)}`;
  //   doc.text(valueText, R, metaY, { align: "right" });
  //   metaY += 5;
  // });

  // Amount Due row with grey highlight
  const amtDue = Number(invoice.amount) - Number(invoice.paidAmount);
  doc.setFillColor(240, 240, 240);
  doc.rect(rightColX, metaY - 4, R - rightColX, 9, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text("Amount Due (USD):", metaLabelX, metaY + 1, { align: "right" });
  doc.text(`$${amtDue.toFixed(2)}`, R, metaY + 1, { align: "right" });
  metaY += 12;

  y = Math.max(y + 4, metaY + 4);

  // ── 6. ITEMS TABLE ────────────────────────────────────────────────────────
  if (invoice.items && invoice.items.length > 0) {
    // Build body — split item.name on '\n' to get name + subtitle
    const bodyData = invoice.items.map((item) => {
      const parts = item.name.split("\n");
      const displayName = [parts[0], parts.slice(1).join(" ")]
        .filter((part) => String(part || "").trim())
        .join("\n");
      return {
        displayName:
          Number(item.depositFee || 0) > 0
            ? `${displayName}\nDeposit fee: $${Number(item.depositFee || 0).toFixed(2)}`
            : displayName,
        qty: item.quantity,
        unit: item.unit || "grams",
        price: Number(item.price),
        amount: Number(item.quantity) * Number(item.price),
      };
    });

    autoTable(doc, {
      startY: y,
      head: [["Items", "Qty / Unit", "Price", "Amount"]],
      body: bodyData.map((r) => [
        r.displayName,
        `${r.qty} ${r.unit}`,
        `$${r.price.toFixed(2)}`,
        `$${r.amount.toFixed(2)}`,
      ]),
      theme: "plain",
      headStyles: {
        fillColor: [245, 200, 66],
        textColor: [26, 26, 26],
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: {
        fontSize: 8,
        valign: "middle",
        overflow: "linebreak",
      },
      bodyStyles: {
        fontSize: 9,
        fontStyle: "bold",
        textColor: [26, 26, 26],
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 80, halign: "left" },
        1: { cellWidth: 35, halign: "center" },
        2: { cellWidth: 33, halign: "right" },
        3: { cellWidth: 34, halign: "right" },
      },
      tableWidth: 182,
      margin: { left: L, right: 14 },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.2,
      didParseCell: (data) => {
        if (data.section === "head") {
          if (data.column.index === 0) data.cell.styles.halign = "left";
          if (data.column.index === 1) data.cell.styles.halign = "center";
          if (data.column.index === 2 || data.column.index === 3) {
            data.cell.styles.halign = "right";
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── 7. TOTALS ─────────────────────────────────────────────────────────────
  const totalsLabelX = 130;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(26, 26, 26);

  // Total
  // doc.text("Total:", totalsLabelX, y, { align: "right" });
  // doc.text(`$${Number(invoice.amount).toFixed(2)}`, R, y, { align: "right" });
  // y += 6;

  // Each recorded payment (sorted in ascending order by date)
  if (invoice.payments && invoice.payments.length > 0) {
    const sortedPayments = [...invoice.payments].sort(
      (a, b) =>
        new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime(),
    );
    sortedPayments.forEach((p) => {
      const dateStr = new Date(p.paymentDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const methodName = p.method?.name || "payment";
      const label = `Payment on ${dateStr} using ${methodName.toLowerCase()}:`;
      // Wrap long labels
      const labelLines = doc.splitTextToSize(label, totalsLabelX - L - 5);
      doc.text(labelLines, totalsLabelX, y, { align: "right" });
      doc.text(`$${Number(p.amount).toFixed(2)}`, R, y, { align: "right" });
      y += labelLines.length > 1 ? labelLines.length * 5 + 1 : 6;
    });
  }

  // Separator
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(totalsLabelX - 20, y, R, y);
  y += 6;

  // ── 7A. SUMMARY (AFTER TABLE) ─────────────────────────────

  const summaryRows = [
    { label: "Subtotal:", value: Number(invoice.subtotal || 0) },
    { label: "Shipping Fee:", value: Number(invoice.shippingFee || 0) },
    { label: "Insurance:", value: Number(invoice.insuranceAmount || 0) },
    { label: "Layaway Fee:", value: layawayFee },
    { label: "Total Deposit Amount:", value: totalDepositAmount },
    {
      label: "Late Fee:",
      value: getPaymentSourceTotal(invoice, "late_fee"),
    },
    {
      label: "Deposit Fee:",
      value: getPaymentSourceTotal(invoice, "deposit_fee"),
    },
    {
      label: "Restocking Fee:",
      value: getPaymentSourceTotal(invoice, "restocking_fee"),
    },
  ].filter((row) => row.value !== 0);

  const recalculationFeeEntries = getRecalculationFeeDisplayEntries(
    invoice.editHistory || [],
  );

  const summaryLabelX = 130;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(26, 26, 26);

  summaryRows.forEach((row) => {
    doc.text(row.label, summaryLabelX, y, { align: "right" });
    doc.text(`$${row.value.toFixed(2)}`, R, y, { align: "right" });
    y += 6;
  });

  recalculationFeeEntries.forEach((entry) => {
    const label = `${entry.label} (${new Date(entry.date).toLocaleDateString()})`;
    const labelLines = doc.splitTextToSize(label, R - L - 35);
    doc.text(labelLines, summaryLabelX, y, { align: "right" });
    doc.text(`$${entry.amount.toFixed(2)}`, R, y, { align: "right" });
    y += labelLines.length > 1 ? labelLines.length * 5 + 1 : 6;
  });

  removedItemDepositFeeEntries.forEach((entry) => {
    const label =
      entry.action === "skip"
        ? `${entry.label}: ${entry.reason}`
        : `${entry.label} (${new Date(entry.date).toLocaleDateString()})`;
    const labelLines = doc.splitTextToSize(label, R - L - 35);
    doc.text(labelLines, summaryLabelX, y, { align: "right" });
    doc.text(`$${entry.amount.toFixed(2)}`, R, y, { align: "right" });
    y += labelLines.length > 1 ? labelLines.length * 5 + 1 : 6;
  });

  // Separator line
  doc.setDrawColor(180, 180, 180);
  doc.line(summaryLabelX - 20, y, R, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Invoice Total:", summaryLabelX, y, { align: "right" });
  doc.text(`$${Number(invoice.amount).toFixed(2)}`, R, y, { align: "right" });
  y += 6;
  doc.text("Amount Due:", summaryLabelX, y, { align: "right" });
  doc.text(`$${amtDue.toFixed(2)}`, R, y, { align: "right" });
  y += 10;

  // ── 8. NOTES / TERMS ──────────────────────────────────────────────────────
  const hasDescription = !!invoice.description;
  const hasLayaway = !!(invoice.isLayaway && invoice.layawayPlan);
  const hasTerms = effectiveTermLines.length > 0;

  if (hasDescription || hasLayaway || hasTerms) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    // "Notes / Terms" heading
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 26);
    doc.text("Notes / Terms", L, y);
    y += 6;

    // Invoice description / notes
    if (invoice.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const descLines = doc.splitTextToSize(invoice.description, R - L);
      doc.text(descLines, L, y);
      y += descLines.length * 5 + 3;
    }

    // Layaway schedule
    if (hasLayaway) {
      const plan = invoice.layawayPlan!;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text("TERMS: LAY-AWAY", L, y);
      y += 5;
      doc.text(`Month(s): ${plan.months}`, L, y);
      y += 5;
      doc.text(`Payment Type: ${plan.paymentFrequency}`, L, y);
      y += 5;

      plan.installments.forEach((inst) => {
        if (y > 272) {
          doc.addPage();
          y = 20;
        }
        const d = new Date(inst.dueDate).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "2-digit",
        });
        const line = `${d} - ${inst.label} - $${Number(inst.amount).toFixed(2)}`;
        doc.text(line, L, y);
        y += 5;
      });
      y += 3;
    }

    // Standard terms from DB or invoice snapshot (each line is a separate block)
    if (hasTerms) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      effectiveTermLines.forEach((termLine) => {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        const wrapped = doc.splitTextToSize(String(termLine), R - L);
        if (y + wrapped.length * 4 > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(wrapped, L, y);
        y += wrapped.length * 4 + 3;
      });
    }
  }

  // ── 9. FOOTER (all pages) ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (invoice.status === "abandoned") {
      drawCancelledWatermark(doc);
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    // DBA line
    doc.text(
      "Gold Connections By Apple is a DBA of Cooper Creek LLC",
      pageW / 2,
      286,
      { align: "center" },
    );

    // Page counter
    doc.text(
      `Page ${i} of ${pageCount} for Invoice #${invoice.invoiceNumber}`,
      pageW / 2,
      291,
      { align: "center" },
    );
  }

  // ── 10. OUTPUT ────────────────────────────────────────────────────────────

  if (mode === "print") {
    const blobUrl = String(doc.output("bloburl"));
    if (printWindow) {
      printWindow.location.href = blobUrl;
    } else {
      window.open(blobUrl, "_blank");
    }
  } else {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${invoice.invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export function buildSingleInvoicePdfBuffer(
  invoice: Invoice,
  options?: {
    logoBase64?: string | null;
    defaultTermLines?: string[] | null;
  },
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const L = 14;
  const R = pageW - 14;
  const logoBase64 = options?.logoBase64 ?? null;
  const defaultTermLines = Array.isArray(options?.defaultTermLines)
    ? options?.defaultTermLines.filter((line) => String(line || "").trim())
    : [];
  const invoiceTermLines = Array.isArray(invoice.termsSnapshot)
    ? invoice.termsSnapshot.filter((line) => String(line || "").trim())
    : [];
  const effectiveTermLines =
    invoiceTermLines.length > 0 ? invoiceTermLines : defaultTermLines;

  let logoW = 62;
  let logoH = 46;
  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", L, 10, logoW, logoH);
  }

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text("INVOICE", R, 19, { align: "right" });

  const biz = BUSINESS_CONFIG;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text(biz.name, R, 30, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  let bizY = 37;
  if (biz.address) {
    const parts = biz.address
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    parts.forEach((part) => {
      doc.text(part, R, bizY, { align: "right" });
      bizY += 5;
    });
    bizY += 2;
  }
  if (biz.websiteAdress) {
    doc.text(biz.websiteAdress, R, bizY, { align: "right" });
    bizY += 5;
  }

  let y = Math.max(60, bizY + 4);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(L, y, R, y);
  y += 8;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(150, 150, 150);
  doc.text("BILL TO", L, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text(invoice.clientName, L, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  if (invoice.customer?.address) {
    const addrLines = doc.splitTextToSize(invoice.customer.address, 80);
    doc.text(addrLines, L, y);
    y += addrLines.length * 5;
  }
  if (invoice.customer?.phone) {
    doc.text(invoice.customer.phone, L, y);
    y += 5;
  }
  if (invoice.customer?.email) {
    doc.text(invoice.customer.email, L, y);
    y += 5;
  }

  const metaLabelX = 160;
  let metaY = 66;
  const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const invoiceDate = new Date(
    invoice.invoiceDate || invoice.createdAt,
  ).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const layawayFee = getVisibleLayawayFee(invoice);
  const removedItemDepositFeeEntries = getRemovedItemDepositFeeDisplayEntries(
    invoice.editHistory || [],
  );
  const totalDepositAmount = getCurrentItemDepositFeeTotal(invoice);
  const liveTypeLabel = resolveLiveTypeLabel(invoice);
  [
    ["Invoice Number:", invoice.invoiceNumber],
    ["Invoice Date:", invoiceDate],
    ["Payment Due:", dueDate],
    ["Invoice Type:", invoice.isLayaway ? "Layaway" : "Cash"],
    ...(liveTypeLabel ? [["Live Type:", liveTypeLabel]] : []),
  ].forEach(([label, value]) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 26);
    doc.text(label, metaLabelX, metaY, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(String(value), R, metaY, { align: "right" });
    metaY += 6;
  });

  const amtDue = Number(invoice.amount) - Number(invoice.paidAmount);
  doc.setFillColor(240, 240, 240);
  doc.rect(105, metaY - 4, R - 105, 9, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text("Amount Due (USD):", metaLabelX, metaY + 1, { align: "right" });
  doc.text(`$${amtDue.toFixed(2)}`, R, metaY + 1, { align: "right" });
  metaY += 12;

  y = Math.max(y + 4, metaY + 4);

  if (invoice.items && invoice.items.length > 0) {
    const bodyData = invoice.items.map((item) => {
      const parts = item.name.split("\n");
      const displayName = [parts[0], parts.slice(1).join(" ")]
        .filter((part) => String(part || "").trim())
        .join("\n");
      return {
        displayName:
          Number(item.depositFee || 0) > 0
            ? `${displayName}\nDeposit fee: $${Number(item.depositFee || 0).toFixed(2)}`
            : displayName,
        qty: item.quantity,
        unit: item.unit || "grams",
        price: Number(item.price),
        amount: Number(item.quantity) * Number(item.price),
      };
    });

    autoTable(doc, {
      startY: y,
      head: [["Items", "Qty / Unit", "Price", "Amount"]],
      body: bodyData.map((r) => [
        r.displayName,
        `${r.qty} ${r.unit}`,
        `$${r.price.toFixed(2)}`,
        `$${r.amount.toFixed(2)}`,
      ]),
      theme: "plain",
      headStyles: {
        fillColor: [245, 200, 66],
        textColor: [26, 26, 26],
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: {
        fontSize: 8,
        valign: "middle",
        overflow: "linebreak",
      },
      bodyStyles: {
        fontSize: 9,
        fontStyle: "bold",
        textColor: [26, 26, 26],
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 80, halign: "left" },
        1: { cellWidth: 35, halign: "center" },
        2: { cellWidth: 33, halign: "right" },
        3: { cellWidth: 34, halign: "right" },
      },
      tableWidth: 182,
      margin: { left: L, right: 14 },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.2,
      didParseCell: (data) => {
        if (data.section === "head") {
          if (data.column.index === 0) data.cell.styles.halign = "left";
          if (data.column.index === 1) data.cell.styles.halign = "center";
          if (data.column.index === 2 || data.column.index === 3) {
            data.cell.styles.halign = "right";
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (invoice.payments && invoice.payments.length > 0) {
    const sortedPayments = [...invoice.payments].sort(
      (a, b) =>
        new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime(),
    );
    sortedPayments.forEach((p) => {
      const dateStr = new Date(p.paymentDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const methodName = p.method?.name || "payment";
      const label = `Payment on ${dateStr} using ${methodName.toLowerCase()}:`;
      const labelLines = doc.splitTextToSize(label, 115);
      doc.text(labelLines, 130, y, { align: "right" });
      doc.text(`$${Number(p.amount).toFixed(2)}`, R, y, { align: "right" });
      y += labelLines.length > 1 ? labelLines.length * 5 + 1 : 6;
    });
  }

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(110, y, R, y);
  y += 6;

  const summaryRows = [
    { label: "Shipping Fee:", value: Number(invoice.shippingFee || 0) },
    { label: "Insurance:", value: Number(invoice.insuranceAmount || 0) },
    { label: "Layaway Fee:", value: layawayFee },
    { label: "Total Deposit Amount:", value: totalDepositAmount },
    {
      label: "Late Fee:",
      value: getPaymentSourceTotal(invoice, "late_fee"),
    },
    {
      label: "Deposit Fee:",
      value: getPaymentSourceTotal(invoice, "deposit_fee"),
    },
    {
      label: "Restocking Fee:",
      value: getPaymentSourceTotal(invoice, "restocking_fee"),
    },
  ].filter((row) => row.value !== 0);

  const recalculationFeeEntries = getRecalculationFeeDisplayEntries(
    invoice.editHistory || [],
  );

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(26, 26, 26);
  summaryRows.forEach((row) => {
    doc.text(row.label, 130, y, { align: "right" });
    doc.text(`$${row.value.toFixed(2)}`, R, y, { align: "right" });
    y += 6;
  });

  recalculationFeeEntries.forEach((entry) => {
    const label = `${entry.label} (${new Date(entry.date).toLocaleDateString()})`;
    const labelLines = doc.splitTextToSize(label, 115);
    doc.text(labelLines, 130, y, { align: "right" });
    doc.text(`$${entry.amount.toFixed(2)}`, R, y, { align: "right" });
    y += labelLines.length > 1 ? labelLines.length * 5 + 1 : 6;
  });

  removedItemDepositFeeEntries.forEach((entry) => {
    const label =
      entry.action === "skip"
        ? `${entry.label}: ${entry.reason}`
        : `${entry.label} (${new Date(entry.date).toLocaleDateString()})`;
    const labelLines = doc.splitTextToSize(label, 115);
    doc.text(labelLines, 130, y, { align: "right" });
    doc.text(`$${entry.amount.toFixed(2)}`, R, y, { align: "right" });
    y += labelLines.length > 1 ? labelLines.length * 5 + 1 : 6;
  });

  doc.setDrawColor(180, 180, 180);
  doc.line(110, y, R, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Invoice Total:", 130, y, { align: "right" });
  doc.text(`$${Number(invoice.amount).toFixed(2)}`, R, y, { align: "right" });
  y += 6;
  doc.text("Amount Due:", 130, y, { align: "right" });
  doc.text(`$${amtDue.toFixed(2)}`, R, y, { align: "right" });
  y += 10;

  const hasDescription = !!invoice.description;
  const hasLayaway = !!(invoice.isLayaway && invoice.layawayPlan);
  const hasTerms = effectiveTermLines.length > 0;

  if (hasDescription || hasLayaway || hasTerms) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 26);
    doc.text("Notes / Terms", L, y);
    y += 6;

    if (invoice.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const descLines = doc.splitTextToSize(invoice.description, R - L);
      doc.text(descLines, L, y);
      y += descLines.length * 5 + 3;
    }

    if (hasLayaway) {
      const plan = invoice.layawayPlan!;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text("TERMS: LAY-AWAY", L, y);
      y += 5;
      doc.text(`Month(s): ${plan.months}`, L, y);
      y += 5;
      doc.text(`Payment Type: ${plan.paymentFrequency}`, L, y);
      y += 5;
      plan.installments.forEach((inst) => {
        if (y > 272) {
          doc.addPage();
          y = 20;
        }
        const d = new Date(inst.dueDate).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "2-digit",
        });
        doc.text(
          `${d} - ${inst.label} - $${Number(inst.amount).toFixed(2)}`,
          L,
          y,
        );
        y += 5;
      });
      y += 3;
    }

    if (hasTerms) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      effectiveTermLines.forEach((termLine) => {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        const wrapped = doc.splitTextToSize(String(termLine), R - L);
        if (y + wrapped.length * 4 > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(wrapped, L, y);
        y += wrapped.length * 4 + 3;
      });
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (invoice.status === "abandoned") {
      drawCancelledWatermark(doc);
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Gold Connections By Apple is a DBA of Cooper Creek LLC",
      pageW / 2,
      286,
      { align: "center" },
    );
    doc.text(
      `Page ${i} of ${pageCount} for Invoice #${invoice.invoiceNumber}`,
      pageW / 2,
      291,
      { align: "center" },
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}
