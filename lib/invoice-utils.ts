import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generates a unique invoice number in format: INV-YYYY-NNNN
 * Example: INV-2025-0001
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  
  // Get the last invoice number for this year
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `INV-${year}-`
      }
    },
    orderBy: {
      invoiceNumber: 'desc'
    }
  });

  let nextNumber = 1;
  
  if (lastInvoice) {
    // Extract the number part and increment
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  // Format with leading zeros (0001, 0002, etc.)
  const formattedNumber = nextNumber.toString().padStart(4, '0');
  
  return `INV-${year}-${formattedNumber}`;
}

/**
 * Calculate invoice status based on paid amount and due date
 */
export function calculateInvoiceStatus(
  amount: number,
  paidAmount: number,
  dueDate: Date
): 'paid' | 'pending' | 'overdue' | 'partial' {
  const now = new Date();
  
  if (paidAmount >= amount) {
    return 'paid';
  }
  
  if (paidAmount > 0 && paidAmount < amount) {
    return 'partial';
  }
  
  if (paidAmount === 0 && dueDate < now) {
    return 'overdue';
  }
  
  return 'pending';
}

/**
 * Update invoice status after payment
 */
export async function updateInvoiceAfterPayment(invoiceId: number) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: true,
      paymentMatches: true
    }
  });

  if (!invoice) return;

  // Calculate total paid amount from direct payments and payment matches
  const directPayments = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const matchedPayments = invoice.paymentMatches.reduce((sum, m) => sum + Number(m.amount), 0);
  const totalPaid = directPayments + matchedPayments;

  const newStatus = calculateInvoiceStatus(
    Number(invoice.amount),
    totalPaid,
    invoice.dueDate
  );

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: totalPaid,
      status: newStatus
    }
  });
}
