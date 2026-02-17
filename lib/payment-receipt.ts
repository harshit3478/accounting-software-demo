import { jsPDF } from "jspdf";
import { BUSINESS_CONFIG } from "./business-config";

const { colors } = BUSINESS_CONFIG;

interface PaymentReceipt {
  id: number;
  amount: number;
  date: string;
  notes: string | null;
  method: { name: string; color: string } | string;
  invoice?: {
    invoiceNumber: string;
    clientName: string;
    amount: number;
    paidAmount: number;
  } | null;
}

function getMethodName(method: PaymentReceipt["method"]): string {
  return typeof method === "object" ? method.name : String(method);
}

export function generatePaymentReceiptPDF(payment: PaymentReceipt) {
  const doc = new jsPDF({ unit: "mm", format: [80, 160] });

  const pageW = 80;
  const centerX = pageW / 2;

  // Gold accent line at top
  doc.setDrawColor(...colors.goldRGB);
  doc.setLineWidth(1);
  doc.line(5, 5, pageW - 5, 5);

  // Business name
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.charcoalRGB);
  doc.text(BUSINESS_CONFIG.name, centerX, 13, { align: "center" });

  // Tagline
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(BUSINESS_CONFIG.tagline, centerX, 17, { align: "center" });

  // Gold line
  doc.setDrawColor(...colors.goldRGB);
  doc.setLineWidth(0.5);
  doc.line(5, 20, pageW - 5, 20);

  // Receipt title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.charcoalRGB);
  doc.text("PAYMENT RECEIPT", centerX, 27, { align: "center" });

  doc.setDrawColor(200);
  doc.line(5, 30, pageW - 5, 30);

  // Receipt details
  let y = 36;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.charcoalRGB);

  doc.text("Receipt #:", 5, y);
  doc.setFont("helvetica", "bold");
  doc.text(`PAY-${String(payment.id).padStart(5, "0")}`, pageW - 5, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.text("Date:", 5, y);
  doc.text(new Date(payment.date).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  }), pageW - 5, y, { align: "right" });
  y += 6;

  doc.text("Method:", 5, y);
  doc.setFont("helvetica", "bold");
  doc.text(getMethodName(payment.method), pageW - 5, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");

  // Invoice info
  if (payment.invoice) {
    doc.setDrawColor(...colors.goldRGB);
    doc.setLineWidth(0.3);
    doc.line(5, y, pageW - 5, y);
    y += 5;

    doc.setFontSize(8);
    doc.text("Invoice:", 5, y);
    doc.text(payment.invoice.invoiceNumber, pageW - 5, y, { align: "right" });
    y += 5;

    doc.text("Client:", 5, y);
    const clientName = payment.invoice.clientName.length > 20
      ? payment.invoice.clientName.substring(0, 18) + "..."
      : payment.invoice.clientName;
    doc.text(clientName, pageW - 5, y, { align: "right" });
    y += 5;

    doc.text("Invoice Total:", 5, y);
    doc.text(`$${payment.invoice.amount.toFixed(2)}`, pageW - 5, y, { align: "right" });
    y += 5;

    doc.text("Previously Paid:", 5, y);
    doc.text(`$${(payment.invoice.paidAmount - payment.amount).toFixed(2)}`, pageW - 5, y, { align: "right" });
    y += 5;

    const remaining = payment.invoice.amount - payment.invoice.paidAmount;
    doc.text("Remaining:", 5, y);
    doc.setFont("helvetica", "bold");
    doc.text(`$${remaining.toFixed(2)}`, pageW - 5, y, { align: "right" });
    y += 6;
  }

  // Amount paid section with gold accent
  doc.setDrawColor(...colors.goldRGB);
  doc.setLineWidth(0.5);
  doc.line(5, y, pageW - 5, y);
  y += 3;

  // Gold-tinted background for amount
  doc.setFillColor(255, 251, 235); // warm cream
  doc.setDrawColor(...colors.goldRGB);
  doc.setLineWidth(0.5);
  doc.roundedRect(5, y, pageW - 10, 16, 2, 2, "FD");

  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.goldRGB);
  doc.text("AMOUNT PAID", centerX, y, { align: "center" });
  y += 7;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.charcoalRGB);
  doc.text(`$${payment.amount.toFixed(2)}`, centerX, y, { align: "center" });
  y += 8;

  // Notes
  if (payment.notes) {
    y += 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    const noteLines = doc.splitTextToSize(`Note: ${payment.notes}`, pageW - 10);
    doc.text(noteLines, 5, y);
    y += noteLines.length * 4;
  }

  // Footer
  y += 6;
  doc.setDrawColor(...colors.goldRGB);
  doc.setLineWidth(0.3);
  doc.line(5, y, pageW - 5, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.goldRGB);
  doc.text("Thank you for choosing Barley Lux!", centerX, y, { align: "center" });
  y += 4;

  doc.setFontSize(7);
  doc.setTextColor(150);
  if (BUSINESS_CONFIG.website) {
    doc.text(BUSINESS_CONFIG.website, centerX, y, { align: "center" });
    y += 4;
  }
  doc.text(`Generated: ${new Date().toLocaleString()}`, centerX, y, { align: "center" });

  // Open as print preview
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}
