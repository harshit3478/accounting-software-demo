export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  status: 'paid' | 'pending' | 'overdue' | 'partial' | 'inactive';
  dueDate: string;
  isLayaway: boolean;
  items: InvoiceItem[];
  tax: number;
  discount: number;
  subtotal: number;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  payments: Array<{
    id: number;
    amount: number;
    method: string;
    date: string;
  }>;
}

export interface InvoiceFormData {
  clientName: string;
  dueDate: string;
  items: InvoiceItem[];
  tax: number;
  discount: number;
  isLayaway: boolean;
}
