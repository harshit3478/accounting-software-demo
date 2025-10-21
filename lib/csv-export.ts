/**
 * CSV Export Utilities for Invoice Management
 */

export interface InvoiceCSVData {
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueDate: string;
  createdAt: string;
  items: string;
  tax: number;
  discount: number;
}

/**
 * Escape CSV values to handle special characters
 */
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  // If the value contains comma, double quote, or newline, wrap it in quotes and escape inner quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Convert array of invoices to CSV string
 */
export function invoicesToCSV(invoices: InvoiceCSVData[]): string {
  if (invoices.length === 0) {
    return '';
  }

  // CSV Header
  const headers = [
    'Invoice Number',
    'Client Name',
    'Subtotal',
    'Tax',
    'Discount',
    'Amount',
    'Paid Amount',
    'Remaining',
    'Status',
    'Due Date',
    'Created Date',
    'Items',
  ];

  const headerRow = headers.map(escapeCSV).join(',');

  // CSV Data Rows
  const dataRows = invoices.map(invoice => {
    const remaining = invoice.amount - invoice.paidAmount;
    const itemsStr = invoice.items || 'N/A';
    
    return [
      escapeCSV(invoice.invoiceNumber),
      escapeCSV(invoice.clientName),
      escapeCSV(invoice.amount - invoice.tax + invoice.discount), // subtotal
      escapeCSV(invoice.tax),
      escapeCSV(invoice.discount),
      escapeCSV(invoice.amount),
      escapeCSV(invoice.paidAmount),
      escapeCSV(remaining),
      escapeCSV(invoice.status),
      escapeCSV(invoice.dueDate),
      escapeCSV(invoice.createdAt),
      escapeCSV(itemsStr),
    ].join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string = 'invoices.csv'): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Export invoices to CSV file
 */
export function exportInvoicesToCSV(
  invoices: InvoiceCSVData[],
  filename: string = `invoices-${new Date().toISOString().split('T')[0]}.csv`
): void {
  const csv = invoicesToCSV(invoices);
  if (csv) {
    downloadCSV(csv, filename);
  }
}
