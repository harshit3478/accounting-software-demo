/**
 * QuickBooks + processing fee test data
 *
 * Creates:
 * - Unmatched QuickBooks-synced payments (for Payments page / link flow)
 * - A customer with store credit from QB payment overage (for processing fee flow)
 *
 * Run: npx tsx prisma/seed-qb-processing-fee.ts
 * Requires: npx tsx prisma/seed.ts (admin user + payment methods)
 */
import { PrismaClient } from "@prisma/client";
import { stampPaymentCode } from "../lib/payment-code";

const prisma = new PrismaClient();

const CUSTOMER_EMAIL = "qb-demo@barleylux.com";
const CUSTOMER_NAME = "QuickBooks Demo Customer";

async function getRequiredPaymentMethods() {
  const cash = await prisma.paymentMethodEntry.findFirst({
    where: { name: "Cash" },
  });
  const zelle = await prisma.paymentMethodEntry.findFirst({
    where: { name: "Zelle" },
  });
  const boa = await prisma.paymentMethodEntry.findFirst({
    where: { name: "Bank of America" },
  });

  if (!cash || !zelle || !boa) {
    throw new Error(
      "Payment methods missing. Run: npx tsx prisma/seed.ts first",
    );
  }

  return { cash, zelle, boa };
}

async function ensureAdminUser() {
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) {
    throw new Error("Admin user missing. Run: npx tsx prisma/seed.ts first");
  }
  return admin;
}

async function ensureQbPayment(input: {
  quickbooksId: string;
  amount: number;
  methodId: number;
  userId: number;
  paymentDate: Date;
  notes: string;
  source?: string;
  invoiceId?: number | null;
  isMatched?: boolean;
}) {
  const existing = await prisma.payment.findUnique({
    where: { quickbooksId: input.quickbooksId },
  });
  if (existing) {
    console.log(`  ↷ Payment ${input.quickbooksId} already exists`);
    return existing;
  }

  const payment = await prisma.payment.create({
    data: {
      quickbooksId: input.quickbooksId,
      quickbooksSyncedAt: new Date(),
      amount: input.amount,
      methodId: input.methodId,
      userId: input.userId,
      paymentDate: input.paymentDate,
      notes: input.notes,
      source: input.source ?? "quickbooks_import",
      invoiceId: input.invoiceId ?? null,
      isMatched: input.isMatched ?? false,
    },
  });

  await stampPaymentCode(prisma, payment.id);
  console.log(`  ✓ Payment ${input.quickbooksId} — $${input.amount.toFixed(2)}`);
  return payment;
}

async function main() {
  const admin = await ensureAdminUser();
  const methods = await getRequiredPaymentMethods();
  const now = new Date();

  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  console.log("\n1. Customer + invoices for processing fee testing...");

  let customer = await prisma.customer.findFirst({
    where: { email: CUSTOMER_EMAIL },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: CUSTOMER_NAME,
        email: CUSTOMER_EMAIL,
        phone: "214-555-0199",
        address: "100 Commerce St, Dallas, TX 75201",
        notes: "Seeded for QuickBooks processing fee testing",
        storeCredit: 0,
      },
    });
    console.log(`  ✓ Created customer: ${customer.name}`);
  } else {
    console.log(`  ↷ Customer exists: ${customer.name}`);
  }

  const ensureInvoice = async (input: {
    invoiceNumber: string;
    amount: number;
    paidAmount: number;
    status: "paid" | "partial" | "pending";
    invoiceDate: Date;
    dueDate: Date;
  }) => {
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber: input.invoiceNumber },
    });
    if (existing) {
      console.log(`  ↷ Invoice ${input.invoiceNumber} already exists`);
      return existing;
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: input.invoiceNumber,
        clientName: customer!.name,
        customerId: customer!.id,
        userId: admin.id,
        subtotal: input.amount,
        tax: 0,
        discount: 0,
        shippingFee: 0,
        insuranceAmount: 0,
        amount: input.amount,
        paidAmount: input.paidAmount,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        status: input.status,
        isLayaway: false,
        source: "quickbooks_import",
        externalInvoiceNumber: input.invoiceNumber.replace("INV-", "QB-"),
        items: [
          {
            name: "18K Gold Chain (QB import)",
            quantity: 1,
            price: input.amount,
          },
        ],
      },
    });
    console.log(`  ✓ Invoice ${invoice.invoiceNumber} — $${input.amount}`);
    return invoice;
  };

  const paidInvoice = await ensureInvoice({
    invoiceNumber: "INV-QB-2026-0001",
    amount: 2000,
    paidAmount: 2000,
    status: "paid",
    invoiceDate: daysAgo(14),
    dueDate: daysAgo(7),
  });

  const openInvoice = await ensureInvoice({
    invoiceNumber: "INV-QB-2026-0002",
    amount: 1500,
    paidAmount: 500,
    status: "partial",
    invoiceDate: daysAgo(10),
    dueDate: daysAgo(3),
  });

  console.log("\n2. Unmatched QuickBooks payments (Payments page)...");

  await ensureQbPayment({
    quickbooksId: "QB-SEED-PAY-001",
    amount: 500,
    methodId: methods.zelle.id,
    userId: admin.id,
    paymentDate: daysAgo(2),
    notes:
      "QuickBooks Payment (Manual Sync) - Customer: QuickBooks Demo Customer - Ref: ZEL-88421",
  });

  await ensureQbPayment({
    quickbooksId: "QB-SEED-PAY-002",
    amount: 1200,
    methodId: methods.boa.id,
    userId: admin.id,
    paymentDate: daysAgo(1),
    notes:
      "QuickBooks Payment (Manual Sync) - Customer: QuickBooks Demo Customer - Ref: WIRE-99201",
  });

  await ensureQbPayment({
    quickbooksId: "QB-SEED-PAY-003",
    amount: 350,
    methodId: methods.cash.id,
    userId: admin.id,
    paymentDate: now,
    notes:
      "QuickBooks Payment (Manual Sync) - Customer: Walk-in Client - Memo: Counter payment",
  });

  console.log("\n3. Store credit from QuickBooks overpayment (processing fee)...");

  const creditEntries = [
    {
      quickbooksId: "QB-SEED-CREDIT-001",
      amount: 85.5,
      reason: `QuickBooks payment overage captured as store credit from ${paidInvoice.invoiceNumber}`,
      invoiceId: paidInvoice.id,
      daysBack: 5,
    },
    {
      quickbooksId: "QB-SEED-CREDIT-002",
      amount: 42.25,
      reason: `QuickBooks payment overage captured as store credit from ${openInvoice.invoiceNumber}`,
      invoiceId: openInvoice.id,
      daysBack: 3,
    },
  ];

  let totalStoreCredit = 0;

  for (const entry of creditEntries) {
    let creditPayment = await prisma.payment.findUnique({
      where: { quickbooksId: entry.quickbooksId },
    });

    if (!creditPayment) {
      creditPayment = await prisma.payment.create({
        data: {
          quickbooksId: entry.quickbooksId,
          quickbooksSyncedAt: daysAgo(entry.daysBack),
          invoiceId: null,
          amount: entry.amount,
          paymentDate: daysAgo(entry.daysBack),
          methodId: methods.zelle.id,
          notes: `Store credit from QuickBooks excess payment on ${entry.invoiceNumber} | QuickBooks Payment (Manual Sync)`,
          userId: admin.id,
          isMatched: false,
          source: "store_credit_excess",
        },
      });
      await stampPaymentCode(prisma, creditPayment.id);
      console.log(
        `  ✓ Store credit payment ${entry.quickbooksId} — $${entry.amount.toFixed(2)}`,
      );
    } else {
      console.log(`  ↷ Store credit payment ${entry.quickbooksId} exists`);
    }

    const existingTx = await prisma.customerCreditTransaction.findFirst({
      where: {
        customerId: customer.id,
        paymentId: creditPayment.id,
        type: "credit",
      },
    });

    if (!existingTx) {
      await prisma.customerCreditTransaction.create({
        data: {
          customerId: customer.id,
          amount: entry.amount,
          type: "credit",
          reason: entry.reason,
          paymentId: creditPayment.id,
          invoiceId: entry.invoiceId,
          createdById: admin.id,
        },
      });
      console.log(`  ✓ Credit transaction — $${entry.amount.toFixed(2)}`);
    }

    totalStoreCredit += entry.amount;
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { storeCredit: totalStoreCredit },
  });

  console.log(
    `\n✅ QuickBooks seed complete.\n\nTest processing fee:\n  Settings → Customers → "${CUSTOMER_NAME}"\n  Store credit: $${totalStoreCredit.toFixed(2)}\n  Use "Processing Fee" on a credit row → apply to ${paidInvoice.invoiceNumber} or ${openInvoice.invoiceNumber}\n\nTest unmatched QB payments:\n  Payments page → filter unmatched → link QB-SEED-PAY-* payments\n`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
