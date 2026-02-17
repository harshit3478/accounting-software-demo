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
  }
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
      { align: "center" }
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
  doc.text(`Total Amount: $${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 90, yPos);
  yPos += 6;
  doc.text(`Total Paid: $${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, yPos);
  doc.text(`Outstanding: $${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 90, yPos);

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
    head: [["Invoice #", "Client Name", "Date", "Amount", "Paid", "Balance", "Status"]],
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
    doc.text(`${BUSINESS_CONFIG.name} - ${BUSINESS_CONFIG.tagline}`, 105, 284, { align: "center" });
    doc.text(`Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`, 105, 288, { align: "center" });
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const fileName = filters?.dateRange
    ? `invoice-statement-${filters.dateRange.start}-to-${filters.dateRange.end}.pdf`
    : `invoice-statement-${timestamp}.pdf`;

  doc.save(fileName);
}

export function generateSingleInvoicePDF(invoice: Invoice, mode: "download" | "print" = "print") {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  let y = drawBrandedHeader(doc);

  // INVOICE title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.charcoalRGB);
  doc.text("INVOICE", pageW - 20, y, { align: "right" });
  y += 10;

  // Invoice details (left side)
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, y);
  doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 20, y + 6);
  doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 20, y + 12);

  // Status badge (right side)
  const status = invoice.status.toUpperCase();
  if (status === "PAID") doc.setFillColor(34, 139, 34);
  else if (status === "OVERDUE") doc.setFillColor(220, 53, 69);
  else if (status === "PENDING") doc.setFillColor(255, 140, 0);
  else if (status === "PARTIAL") doc.setFillColor(59, 130, 246);
  else doc.setFillColor(100, 100, 100);

  doc.roundedRect(pageW - 60, y - 4, 40, 10, 2, 2, "F");
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(status, pageW - 40, y + 3, { align: "center" });

  y += 22;

  // Bill To section
  doc.setFillColor(...colors.creamRGB);
  doc.roundedRect(20, y, pageW - 40, 28, 2, 2, "F");

  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.charcoalRGB);
  doc.text("Bill To:", 25, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(invoice.clientName, 25, y);
  y += 5;

  // Customer details if available
  doc.setFontSize(8);
  doc.setTextColor(100);
  if (invoice.customer?.phone) {
    doc.text(invoice.customer.phone, 25, y);
    y += 4;
  }
  if (invoice.customer?.email) {
    doc.text(invoice.customer.email, 25, y);
    y += 4;
  }
  if (invoice.customer?.address) {
    doc.text(invoice.customer.address, 25, y);
    y += 4;
  }

  y = Math.max(y + 4, y + 2);
  y += 8;

  // Items table
  if (invoice.items && invoice.items.length > 0) {
    const itemsData = invoice.items.map((item) => [
      item.name,
      item.quantity.toString(),
      `$${item.price.toFixed(2)}`,
      `$${(item.quantity * item.price).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Item", "Quantity", "Price", "Amount"]],
      body: itemsData,
      theme: "striped",
      headStyles: {
        fillColor: colors.goldRGB,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: colors.creamRGB },
      columnStyles: {
        1: { halign: "center", cellWidth: 25 },
        2: { halign: "right", cellWidth: 30 },
        3: { halign: "right", cellWidth: 30 },
      },
      margin: { left: 20, right: 20 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Financial summary
  const summaryX = 120;
  doc.setFontSize(10);
  doc.setTextColor(...colors.charcoalRGB);

  if (invoice.subtotal !== undefined && invoice.subtotal !== invoice.amount) {
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", summaryX, y);
    doc.text(`$${(invoice.subtotal ?? invoice.amount).toFixed(2)}`, pageW - 20, y, { align: "right" });
    y += 6;

    if (invoice.tax && invoice.tax > 0) {
      doc.text("Tax:", summaryX, y);
      doc.text(`$${invoice.tax.toFixed(2)}`, pageW - 20, y, { align: "right" });
      y += 6;
    }
    if (invoice.discount && invoice.discount > 0) {
      doc.text("Discount:", summaryX, y);
      doc.text(`-$${invoice.discount.toFixed(2)}`, pageW - 20, y, { align: "right" });
      y += 6;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.text("Total:", summaryX, y);
  doc.text(`$${invoice.amount.toFixed(2)}`, pageW - 20, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.text("Paid:", summaryX, y);
  doc.text(`$${invoice.paidAmount.toFixed(2)}`, pageW - 20, y, { align: "right" });
  y += 3;

  doc.setDrawColor(...colors.goldRGB);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y, pageW - 20, y);
  y += 6;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const balance = invoice.amount - invoice.paidAmount;
  doc.text("Balance Due:", summaryX, y);
  doc.text(`$${balance.toFixed(2)}`, pageW - 20, y, { align: "right" });
  y += 12;

  // Layaway schedule (if applicable)
  if (invoice.isLayaway && invoice.layawayPlan) {
    const plan = invoice.layawayPlan;

    // Check if we need a new page
    if (y > 200) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(...colors.goldRGB);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageW - 20, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.charcoalRGB);
    doc.text("Layaway Schedule", 20, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Duration: ${plan.months} months | Frequency: ${plan.paymentFrequency} | Down Payment: $${plan.downPayment.toFixed(2)}`, 20, y);
    y += 8;

    if (plan.installments && plan.installments.length > 0) {
      const installmentData = plan.installments.map((inst) => [
        inst.label,
        new Date(inst.dueDate).toLocaleDateString(),
        `$${inst.amount.toFixed(2)}`,
        inst.isPaid ? "Paid" : "Pending",
        inst.isPaid && inst.paidDate ? new Date(inst.paidDate).toLocaleDateString() : "-",
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Installment", "Due Date", "Amount", "Status", "Paid Date"]],
        body: installmentData,
        theme: "striped",
        headStyles: {
          fillColor: colors.goldRGB,
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: colors.creamRGB },
        margin: { left: 20, right: 20 },
        didParseCell: function (data) {
          if (data.column.index === 3 && data.section === "body") {
            const val = data.cell.raw as string;
            if (val === "Paid") {
              data.cell.styles.textColor = [34, 139, 34];
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.textColor = [255, 140, 0];
            }
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // Payment history
  if (invoice.payments && invoice.payments.length > 0) {
    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(...colors.goldRGB);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageW - 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.charcoalRGB);
    doc.text("Payment History", 20, y);
    y += 6;

    const paymentData = invoice.payments.map((p) => [
      new Date(p.paymentDate).toLocaleDateString(),
      p.method?.name || "Unknown",
      `$${p.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Date", "Method", "Amount"]],
      body: paymentData,
      theme: "striped",
      headStyles: {
        fillColor: colors.goldRGB,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: colors.creamRGB },
      margin: { left: 20, right: 20 },
      columnStyles: {
        2: { halign: "right" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Terms & Conditions
  const terms = invoice.termsSnapshot;
  if (terms && terms.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(...colors.goldRGB);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageW - 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.charcoalRGB);
    doc.text("Terms & Conditions", 20, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    terms.forEach((line, idx) => {
      const text = `${idx + 1}. ${line}`;
      const splitted = doc.splitTextToSize(text, 170);
      doc.text(splitted, 20, y);
      y += splitted.length * 4 + 2;
    });
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...colors.goldRGB);
    doc.setLineWidth(0.5);
    doc.line(15, 278, pageW - 15, 278);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.goldRGB);
    doc.text("Thank you for choosing Barley Lux!", 105, 283, { align: "center" });
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`, 105, 288, { align: "center" });
  }

  if (mode === "print") {
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl as unknown as string, "_blank");
  } else {
    doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
  }
}
