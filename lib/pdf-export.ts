import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
  // Optional terms snapshot attached to the invoice (array of numbered lines)
  termsSnapshot?: string[] | null;
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

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Statement", 105, 20, { align: "center" });

  // Subtitle with date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, {
    align: "center",
  });

  let yPos = 40;

  // Date range if applied
  if (filters?.dateRange) {
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 200);
    doc.text(
      `Period: ${new Date(
        filters.dateRange.start
      ).toLocaleDateString()} - ${new Date(
        filters.dateRange.end
      ).toLocaleDateString()}`,
      105,
      yPos,
      { align: "center" }
    );
    yPos += 10;
  }

  // Summary section in a box
  doc.setTextColor(0);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, yPos, 180, 30, 3, 3, "F");
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(15, yPos, 180, 30, 3, 3, "S");

  yPos += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 20, yPos);

  yPos += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalOutstanding = totalAmount - totalPaid;

  doc.text(`Total Invoices: ${invoices.length}`, 20, yPos);
  doc.text(
    `Total Amount: $${totalAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    90,
    yPos
  );
  yPos += 6;
  doc.text(
    `Total Paid: $${totalPaid.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    20,
    yPos
  );
  doc.text(
    `Outstanding: $${totalOutstanding.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    90,
    yPos
  );

  yPos += 15;

  // Prepare table data
  const tableData = invoices.map((invoice) => [
    invoice.invoiceNumber,
    invoice.clientName,
    new Date(invoice.createdAt).toLocaleDateString(),
    `$${invoice.amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    `$${invoice.paidAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    `$${(invoice.amount - invoice.paidAmount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1),
  ]);

  // Generate professional table with autoTable
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
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
      halign: "left",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
      3: { halign: "right", cellWidth: 25 },
      4: { halign: "right", cellWidth: 25 },
      5: { halign: "right", cellWidth: 25 },
      6: { cellWidth: 25 },
    },
    margin: { left: 15, right: 15 },
    didParseCell: function (data) {
      // Color code status column
      if (data.column.index === 6 && data.section === "body") {
        const status = data.cell.raw as string;
        if (status.toLowerCase() === "paid") {
          data.cell.styles.textColor = [34, 139, 34]; // Green
          data.cell.styles.fontStyle = "bold";
        } else if (status.toLowerCase() === "overdue") {
          data.cell.styles.textColor = [220, 53, 69]; // Red
          data.cell.styles.fontStyle = "bold";
        } else if (status.toLowerCase() === "pending") {
          data.cell.styles.textColor = [255, 140, 0]; // Orange
        }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`,
      105,
      285,
      { align: "center" }
    );
  }

  // Download
  const timestamp = new Date().toISOString().split("T")[0];
  const fileName = filters?.dateRange
    ? `invoice-statement-${filters.dateRange.start}-to-${filters.dateRange.end}.pdf`
    : `invoice-statement-${timestamp}.pdf`;

  doc.save(fileName);
}

export function generateSingleInvoicePDF(invoice: Invoice) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 105, 20, { align: "center" });

  // Invoice details
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 40);
  doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 20, 47);
  doc.text(
    `Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`,
    20,
    54
  );

  // Client info
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 20, 70);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.clientName, 20, 77);

  // Items table
  const yPos = 95;

  if (invoice.items && invoice.items.length > 0) {
    const itemsData = invoice.items.map((item) => [
      item.name,
      item.quantity.toString(),
      `$${item.price.toFixed(2)}`,
      `$${(item.quantity * item.price).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Item", "Quantity", "Price", "Amount"]],
      body: itemsData,
      theme: "striped",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 10,
      },
      columnStyles: {
        1: { halign: "center", cellWidth: 25 },
        2: { halign: "right", cellWidth: 30 },
        3: { halign: "right", cellWidth: 30 },
      },
      margin: { left: 20, right: 20 },
    });
  }

  // Get the final Y position after the table
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 50;

  // Totals box
  const totalsY = finalY + 15;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 120, totalsY);
  doc.text(`$${invoice.amount.toFixed(2)}`, 170, totalsY, { align: "right" });

  doc.text("Paid:", 120, totalsY + 7);
  doc.text(`$${invoice.paidAmount.toFixed(2)}`, 170, totalsY + 7, {
    align: "right",
  });

  doc.setDrawColor(0);
  doc.line(120, totalsY + 10, 170, totalsY + 10);

  doc.setFontSize(14);
  doc.text("Balance Due:", 120, totalsY + 17);
  doc.text(
    `$${(invoice.amount - invoice.paidAmount).toFixed(2)}`,
    170,
    totalsY + 17,
    { align: "right" }
  );

  // Status badge
  doc.setFontSize(10);
  const status = invoice.status.toUpperCase();
  const statusY = totalsY + 27;

  if (status === "PAID") {
    doc.setFillColor(34, 139, 34);
  } else if (status === "OVERDUE") {
    doc.setFillColor(220, 53, 69);
  } else if (status === "PENDING") {
    doc.setFillColor(255, 140, 0);
  } else {
    doc.setFillColor(100, 100, 100);
  }

  doc.roundedRect(120, statusY - 5, 50, 10, 2, 2, "F");
  doc.setTextColor(255);
  doc.text(status, 145, statusY + 2, { align: "center" });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  // Render terms if present (place above footer)
  const terms = (invoice as any).termsSnapshot as string[] | undefined;
  if (terms && terms.length > 0) {
    let termY = totalsY + 40;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions", 20, termY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    termY += 6;
    terms.forEach((line, idx) => {
      // Wrap long lines if necessary
      const text = `${idx + 1}. ${line}`;
      const splitted = doc.splitTextToSize(text, 170);
      doc.text(splitted, 20, termY);
      termY += splitted.length * 5 + 2;
    });
  }

  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, {
    align: "center",
  });

  doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
}
