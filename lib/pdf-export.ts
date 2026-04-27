import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BUSINESS_CONFIG } from "./business-config";

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
  createdAt: string;
  description?: string | null;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
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
  }> | null;
}

const { colors } = BUSINESS_CONFIG;

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
  if (biz.phone) {
    doc.text(biz.phone, R, bizY, { align: "right" });
    bizY += 5;
  }
  if (biz.email) {
    doc.text(biz.email, R, bizY, { align: "right" });
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
  const metaRows = [
    { label: "Invoice Number:", value: invoice.invoiceNumber },
    {
      label: "Invoice Date:",
      value: new Date(invoice.createdAt).toLocaleDateString("en-US", {
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
      return {
        raw: item.name,
        displayName: parts[0],
        subtitle: parts.slice(1).join(" "),
        qty: item.quantity,
        price: Number(item.price),
        amount: Number(item.quantity) * Number(item.price),
      };
    });

    autoTable(doc, {
      startY: y,
      head: [["Items", "Quantity", "Price", "Amount"]],
      body: bodyData.map((r) => [
        r.displayName,
        r.qty.toString(),
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
      bodyStyles: {
        fontSize: 9,
        fontStyle: "bold",
        textColor: [26, 26, 26],
        minCellHeight: bodyData.some((r) => r.subtitle) ? 12 : 8,
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { halign: "center", cellWidth: 25 },
        2: { halign: "right", cellWidth: 30 },
        3: { halign: "right", cellWidth: 30 },
      },
      margin: { left: L, right: 14 },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.2,
      // Draw subtitle below first line in items column
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const row = bodyData[data.row.index];
          if (row?.subtitle) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(120, 120, 120);
            doc.text(
              row.subtitle,
              data.cell.x + 2,
              data.cell.y + data.cell.padding("top") + 6,
            );
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

  // Each recorded payment
  if (invoice.payments && invoice.payments.length > 0) {
    invoice.payments.forEach((p) => {
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
  ].filter((row) => row.value !== 0);

  const summaryLabelX = 130;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(26, 26, 26);

  summaryRows.forEach((row) => {
    doc.text(row.label, summaryLabelX, y, { align: "right" });
    doc.text(`$${row.value.toFixed(2)}`, R, y, { align: "right" });
    y += 6;
  });

  // Separator line
  doc.setDrawColor(180, 180, 180);
  doc.line(summaryLabelX - 20, y, R, y);
  y += 6;

  // Amount Due (FINAL)
  // const amtDue = Number(invoice.amount) - Number(invoice.paidAmount);

  doc.setFont("helvetica", "bold");
  doc.text("Total:", summaryLabelX, y, { align: "right" });
  doc.text(`$${amtDue.toFixed(2)}`, R, y, { align: "right" });
  y += 10;

  // ── 8. NOTES / TERMS ──────────────────────────────────────────────────────
  const hasDescription = !!invoice.description;
  const hasLayaway = !!(invoice.isLayaway && invoice.layawayPlan);
  const hasTerms = defaultTermLines.length > 0;

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

    // Standard terms from DB (each line is a separate block)
    if (hasTerms) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      defaultTermLines.forEach((termLine) => {
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
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
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
