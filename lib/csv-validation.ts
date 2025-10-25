/**
 * CSV Validation Utilities for Bulk Upload
 */

export interface ValidationError {
  row: number;
  field?: string;
  error: string;
}

export interface DuplicateGroup {
  rows: number[];
  reason: string;
}

export interface InvoiceRow {
  clientName: string;
  items: string;
  subtotal: string;
  tax: string;
  discount: string;
  dueDate: string;
  isLayaway: string;
}

export interface PaymentRow {
  amount: string;
  paymentDate: string;
  method: string;
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDate(dateString: string): boolean {
  if (!dateString) return false;
  
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate items format: "Item A x2;Item B x1"
 */
export function isValidItemsFormat(items: string): boolean {
  if (!items || items.trim() === '') return false;
  
  const itemsList = items.split(';');
  for (const item of itemsList) {
    const trimmed = item.trim();
    if (trimmed === '') continue;
    
    // Check if contains 'x' followed by number
    if (!trimmed.includes(' x')) return false;
    
    const parts = trimmed.split(' x');
    if (parts.length !== 2) return false;
    
    const quantity = parseInt(parts[1]);
    if (isNaN(quantity) || quantity <= 0) return false;
  }
  
  return true;
}

/**
 * Validate payment method
 */
export function isValidPaymentMethod(method: string): boolean {
  const validMethods = ['cash', 'zelle', 'quickbooks', 'layaway'];
  return validMethods.includes(method.toLowerCase());
}

/**
 * Validate invoice row
 */
export function validateInvoiceRow(row: InvoiceRow, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Client Name validation
  if (!row.clientName || row.clientName.trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'clientName',
      error: 'Client name is required'
    });
  }
  
  // Items validation
  if (!row.items || row.items.trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'items',
      error: 'Items are required'
    });
  } else if (!isValidItemsFormat(row.items)) {
    errors.push({
      row: rowIndex,
      field: 'items',
      error: 'Invalid items format. Use: "Item A x2;Item B x1"'
    });
  }
  
  // Subtotal validation
  const subtotal = parseFloat(row.subtotal);
  if (isNaN(subtotal) || subtotal <= 0) {
    errors.push({
      row: rowIndex,
      field: 'subtotal',
      error: 'Subtotal must be a positive number'
    });
  }
  
  // Tax validation
  const tax = parseFloat(row.tax);
  if (isNaN(tax) || tax < 0) {
    errors.push({
      row: rowIndex,
      field: 'tax',
      error: 'Tax must be a number >= 0'
    });
  }
  
  // Discount validation
  const discount = parseFloat(row.discount);
  if (isNaN(discount) || discount < 0) {
    errors.push({
      row: rowIndex,
      field: 'discount',
      error: 'Discount must be a number >= 0'
    });
  }
  
  // Due Date validation
  if (!isValidDate(row.dueDate)) {
    errors.push({
      row: rowIndex,
      field: 'dueDate',
      error: 'Invalid date format. Use: YYYY-MM-DD'
    });
  }
  
  // Is Layaway validation
  const isLayawayLower = row.isLayaway.toLowerCase();
  if (isLayawayLower !== 'true' && isLayawayLower !== 'false') {
    errors.push({
      row: rowIndex,
      field: 'isLayaway',
      error: 'isLayaway must be true or false'
    });
  }
  
  return errors;
}

/**
 * Validate payment row
 */
export function validatePaymentRow(row: PaymentRow, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Amount validation
  const amount = parseFloat(row.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push({
      row: rowIndex,
      field: 'amount',
      error: 'Amount must be a positive number'
    });
  }
  
  // Payment Date validation
  if (!isValidDate(row.paymentDate)) {
    errors.push({
      row: rowIndex,
      field: 'paymentDate',
      error: 'Invalid date format. Use: YYYY-MM-DD'
    });
  }
  
  // Payment Method validation
  if (!isValidPaymentMethod(row.method)) {
    errors.push({
      row: rowIndex,
      field: 'method',
      error: 'Method must be one of: cash, zelle, quickbooks, layaway'
    });
  }
  
  return errors;
}

/**
 * Detect duplicate invoices in the upload
 */
export function detectInvoiceDuplicates(rows: InvoiceRow[]): DuplicateGroup[] {
  const duplicates: DuplicateGroup[] = [];
  const seen = new Map<string, number[]>();
  
  rows.forEach((row, index) => {
    // Create a key from client name + subtotal + due date
    const key = `${row.clientName.toLowerCase().trim()}_${row.subtotal}_${row.dueDate}`;
    
    if (seen.has(key)) {
      seen.get(key)!.push(index + 2); // +2 because row 1 is header, array is 0-indexed
    } else {
      seen.set(key, [index + 2]);
    }
  });
  
  // Find groups with more than one row
  seen.forEach((rowNumbers, key) => {
    if (rowNumbers.length > 1) {
      duplicates.push({
        rows: rowNumbers,
        reason: 'Same client name, subtotal, and due date'
      });
    }
  });
  
  return duplicates;
}

/**
 * Detect duplicate payments in the upload
 */
export function detectPaymentDuplicates(rows: PaymentRow[]): DuplicateGroup[] {
  const duplicates: DuplicateGroup[] = [];
  const seen = new Map<string, number[]>();
  
  rows.forEach((row, index) => {
    // Create a key from amount + payment date + method
    const key = `${row.amount}_${row.paymentDate}_${row.method.toLowerCase()}`;
    
    if (seen.has(key)) {
      seen.get(key)!.push(index + 2); // +2 because row 1 is header, array is 0-indexed
    } else {
      seen.set(key, [index + 2]);
    }
  });
  
  // Find groups with more than one row
  seen.forEach((rowNumbers, key) => {
    if (rowNumbers.length > 1) {
      duplicates.push({
        rows: rowNumbers,
        reason: 'Same amount, payment date, and method'
      });
    }
  });
  
  return duplicates;
}

/**
 * Parse items string into JSON array for database storage
 */
export function parseItemsToJSON(itemsString: string): any[] {
  const items: any[] = [];
  const itemsList = itemsString.split(';');
  
  for (const item of itemsList) {
    const trimmed = item.trim();
    if (trimmed === '') continue;
    
    const parts = trimmed.split(' x');
    if (parts.length === 2) {
      items.push({
        description: parts[0].trim(),
        quantity: parseInt(parts[1]),
        price: 0 // Will be calculated from subtotal
      });
    }
  }
  
  return items;
}
