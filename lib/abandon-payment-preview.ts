import { formatPaymentCode } from "./payment-code";

export type AbandonPaymentPreviewInvoice = {
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  status: string;
  linkType: "direct" | "matched" | "store_credit_applied";
  linkedAmount: number;
};

export type AbandonPaymentPreview = {
  paymentId: number;
  paymentCode: string;
  paymentAmount: number;
  source: string | null;
  isStoreCreditPayment: boolean;
  customer: { id: number; name: string; storeCredit: number } | null;
  storeCredit: {
    originalCredit: number;
    appliedAmount: number;
    unspentAmount: number;
  } | null;
  linkedInvoices: AbandonPaymentPreviewInvoice[];
  affectedInvoiceCount: number;
  summary: string[];
};

type PreviewPayment = {
  id: number;
  paymentCode?: string | null;
  amount: { toNumber: () => number };
  source: string | null;
  invoiceId?: number | null;
  invoice?: {
    id: number;
    invoiceNumber: string;
    clientName: string;
    amount: { toNumber: () => number };
    paidAmount: { toNumber: () => number };
    status: string;
  } | null;
  paymentMatches: Array<{
    id: number;
    amount: { toNumber: () => number };
    invoice: {
      id: number;
      invoiceNumber: string;
      clientName: string;
      amount: { toNumber: () => number };
      paidAmount: { toNumber: () => number };
      status: string;
    };
  }>;
  creditTransactions: Array<{
    type: string;
    customerId: number;
    invoiceId?: number | null;
    paymentId?: number | null;
    amount: { toNumber: () => number };
    customer?: { id: number; name: string; storeCredit: { toNumber: () => number } };
  }>;
};

function serializeInvoiceLink(
  invoice: {
    id: number;
    invoiceNumber: string;
    clientName: string;
    amount: { toNumber: () => number };
    paidAmount: { toNumber: () => number };
    status: string;
  },
  linkType: AbandonPaymentPreviewInvoice["linkType"],
  linkedAmount: number,
): AbandonPaymentPreviewInvoice {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    amount: invoice.amount.toNumber(),
    paidAmount: invoice.paidAmount.toNumber(),
    status: invoice.status,
    linkType,
    linkedAmount,
  };
}

export function buildAbandonPaymentPreview(
  payment: PreviewPayment,
  storeCreditApplications: Array<{
    id: number;
    amount: { toNumber: () => number };
    invoice: {
      id: number;
      invoiceNumber: string;
      clientName: string;
      amount: { toNumber: () => number };
      paidAmount: { toNumber: () => number };
      status: string;
    };
  }>,
): AbandonPaymentPreview {
  const paymentCode = payment.paymentCode || formatPaymentCode(payment.id);
  const linkedInvoices: AbandonPaymentPreviewInvoice[] = [];
  const seenInvoiceIds = new Set<number>();

  const addInvoice = (entry: AbandonPaymentPreviewInvoice) => {
    if (seenInvoiceIds.has(entry.invoiceId)) {
      return;
    }
    seenInvoiceIds.add(entry.invoiceId);
    linkedInvoices.push(entry);
  };

  if (payment.invoice) {
    addInvoice(
      serializeInvoiceLink(
        payment.invoice,
        "direct",
        payment.amount.toNumber(),
      ),
    );
  }

  for (const match of payment.paymentMatches) {
    addInvoice(
      serializeInvoiceLink(match.invoice, "matched", match.amount.toNumber()),
    );
  }

  for (const applied of storeCreditApplications) {
    addInvoice(
      serializeInvoiceLink(
        applied.invoice,
        "store_credit_applied",
        applied.amount.toNumber(),
      ),
    );
  }

  const creditTxs = payment.creditTransactions || [];
  const creditRows = creditTxs.filter((tx) => tx.type === "credit");
  const appliedFromPayment = creditTxs
    .filter((tx) => tx.type === "debit" && tx.paymentId === payment.id)
    .reduce((sum, tx) => sum + tx.amount.toNumber(), 0);

  const originalCredit = creditRows.reduce(
    (sum, tx) => sum + tx.amount.toNumber(),
    0,
  );
  const unspentAmount = Math.max(0, originalCredit - appliedFromPayment);

  const customerRow = creditRows.find((tx) => tx.customer)?.customer;
  const customer = customerRow
    ? {
        id: customerRow.id,
        name: customerRow.name,
        storeCredit: customerRow.storeCredit.toNumber(),
      }
    : null;

  const isStoreCreditPayment =
    payment.source === "store_credit_excess" || originalCredit > 0;

  const summary: string[] = [];

  if (linkedInvoices.length > 0) {
    summary.push(
      `Remove this payment from ${linkedInvoices.length} linked invoice(s) and recalculate their balances.`,
    );
  }

  if (payment.paymentMatches.length > 0) {
    summary.push(
      `Delete ${payment.paymentMatches.length} payment match(es) on this payment.`,
    );
  }

  if (storeCreditApplications.length > 0) {
    summary.push(
      `Void ${storeCreditApplications.length} store credit application(s) on invoices.`,
    );
  }

  if (isStoreCreditPayment && unspentAmount > 0.01) {
    summary.push(
      `Reverse $${unspentAmount.toFixed(2)} unused store credit from the customer balance.`,
    );
  }

  if (isStoreCreditPayment && appliedFromPayment > 0.01) {
    summary.push(
      `$${appliedFromPayment.toFixed(2)} already applied to invoices will no longer count toward those invoice totals.`,
    );
  }

  if (summary.length === 0) {
    summary.push(
      "This payment is not linked to any invoice or store credit. It will be marked abandoned only.",
    );
  }

  return {
    paymentId: payment.id,
    paymentCode,
    paymentAmount: payment.amount.toNumber(),
    source: payment.source,
    isStoreCreditPayment,
    customer,
    storeCredit: isStoreCreditPayment
      ? {
          originalCredit,
          appliedAmount: appliedFromPayment,
          unspentAmount,
        }
      : null,
    linkedInvoices,
    affectedInvoiceCount: linkedInvoices.length,
    summary,
  };
}

export async function fetchStoreCreditApplicationsForPayment(
  tx: any,
  paymentId: number,
  paymentCode: string,
) {
  return tx.payment.findMany({
    where: {
      source: "store_credit_applied",
      isAbandoned: false,
      OR: [
        { notes: { contains: paymentCode } },
        { notes: { contains: `#${paymentId}` } },
      ],
    },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          amount: true,
          paidAmount: true,
          status: true,
        },
      },
    },
  });
}
