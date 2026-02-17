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
  notes?: string;
  invoiceNumber?: string;
  clientName?: string;
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
 * Validate items format: "Item A x2 @ 10;Item B x1 @ 50"
 */
export function isValidItemsFormat(items: string): boolean {
  if (!items || items.trim() === '') return false;
  
  const itemsList = items.split(';');
  for (const item of itemsList) {
    const trimmed = item.trim();
    if (trimmed === '') continue;
    
    // Check if contains 'x' followed by number for quantity
    // Basic format: Name xQuantity [@ Price]
    // Regex: .+(x\s*\d+)(\s*@\s*\d+(\.\d+)?)?
    
    if (!trimmed.includes(' x')) return false;
    
    // Parse parts manually for validation
    const qtyParts = trimmed.split(' x');
    // widget @ 10 x 5 -> invalid.
    // widget x 5 @ 10 -> valid.
    
    // The last part might contain price if split by ' x' carefully?
    // Let's rely on a simpler check: must start with text, have ' x', and end with number or price
    
    // Split by '@' if present
    const priceParts = trimmed.split('@');
    let qtyPart = trimmed;
    
    if (priceParts.length > 2) return false; // multiple @
    if (priceParts.length === 2) {
        // Validation price part
        const price = parseFloat(priceParts[1]);
        if (isNaN(price) || price < 0) return false;
        qtyPart = priceParts[0].trim();
    }
    
    // Validate quantity part: "Item Name x 5"
    const finalParts = qtyPart.split(' x');
    if (finalParts.length < 2) return false; // Needs at least "Name" and "Qty"
    
    const qtyStr = finalParts[finalParts.length - 1].trim(); // Get the last part as quantity
    const quantity = parseInt(qtyStr);
    
    if (isNaN(quantity) || quantity <= 0) return false;
  }
  
  return true;
}

/**
 * Validate payment method
 */
export function isValidPaymentMethod(method: string, validMethods?: string[]): boolean {
  if (validMethods && validMethods.length > 0) {
    return validMethods.map(m => m.toLowerCase()).includes(method.toLowerCase());
  }
  // Fallback: accept any non-empty string (methods are now dynamic in the DB)
  return method.trim().length > 0;
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
      error: 'Invalid items format. Use: "Item A x2 @ 10; Item B x1 @ 5"'
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
      error: 'Payment method is required'
    });
  }
  
  // Optional Notes validation (just check length if provided)
  if (row.notes && row.notes.length > 1000) {
    errors.push({
      row: rowIndex,
      field: 'notes',
      error: 'Notes must be less than 1000 characters'
    });
  }
  
  // Invoice matching validation
  // If invoiceNumber is provided, clientName should also be provided for better matching
  if (row.invoiceNumber && !row.clientName) {
    errors.push({
      row: rowIndex,
      field: 'clientName',
      error: 'Client name is required when invoice number is provided'
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
    
    // Check for Price "@"
    let descriptionPart = trimmed;
    let priceItem = 0;
    
    if (trimmed.includes('@')) {
        const parts = trimmed.split('@');
        if (parts.length === 2) {
            priceItem = parseFloat(parts[1]);
            descriptionPart = parts[0].trim();
        }
    }
    
    // Split "Name x Qty"
    // Use lastIndexOf to handle names with 'x' (though our splitter expected ' x')
    // The validator enforces ' x'.
    const xIndex = descriptionPart.lastIndexOf(' x');
    
    if (xIndex !== -1) {
        const name = descriptionPart.substring(0, xIndex).trim();
        const qtyStr = descriptionPart.substring(xIndex + 2).trim();
        const quantity = parseInt(qtyStr);
        
        if (!isNaN(quantity)) {
            items.push({
                name: name, // Fixed: use 'name' instead of 'description' to match frontend/schema
                quantity: quantity,
                price: priceItem
            });
        }
    }
  }
  
  return items;
}
