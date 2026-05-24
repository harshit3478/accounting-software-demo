/**
 * Development seed — customers, invoices, payments, terms, insurance rules
 * Run: npx tsx prisma/seed-dev.ts
 */
import { PrismaClient, InvoiceStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── Insurance rules ─────────────────────────────────────────────────────────
  const insuranceRules = [
    { maxValue: 500, clientShare: 5, sortOrder: 1 },
    { maxValue: 1000, clientShare: 10, sortOrder: 2 },
    { maxValue: 2500, clientShare: 20, sortOrder: 3 },
    { maxValue: 5000, clientShare: 35, sortOrder: 4 },
    { maxValue: 10000, clientShare: 60, sortOrder: 5 },
  ];

  for (const rule of insuranceRules) {
    await prisma.insuranceRule.upsert({
      where: { maxValue: rule.maxValue },
      update: rule,
      create: rule,
    });
  }
  console.log("Seeded insurance rules");

  // ── Default terms ────────────────────────────────────────────────────────────
  const defaultTerms = await prisma.term.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: "Standard Terms",
      lines: [
        "All sales are final. No refunds or exchanges.",
        "Payment is due upon delivery unless a layaway plan is arranged.",
        "Items held on layaway must be paid in full within the agreed period.",
        "BARLEY LUX is not responsible for damage after pickup.",
        "Any disputes must be reported within 7 days of purchase.",
      ],
      isDefault: true,
      createdBy: 1,
    },
  });
  console.log("Seeded default terms:", defaultTerms.id);

  // ── Customers ────────────────────────────────────────────────────────────────
  const customersData = [
    {
      name: "Sarah Johnson",
      email: "sarah.johnson@email.com",
      phone: "214-555-0101",
      address: "4521 Oak Lane, Dallas, TX 75201",
    },
    {
      name: "Mohammed Al-Rashid",
      email: "m.alrashid@email.com",
      phone: "817-555-0202",
      address: "891 Elm Street, Fort Worth, TX 76104",
    },
    {
      name: "Jennifer Martinez",
      email: "j.martinez@email.com",
      phone: "972-555-0303",
      address: "2200 Cedar Dr, Irving, TX 75062",
    },
    {
      name: "David Chen",
      email: "david.chen@email.com",
      phone: "469-555-0404",
      address: "3310 Maple Ave, Plano, TX 75023",
    },
    {
      name: "Fatima Hassan",
      email: "fatima.hassan@email.com",
      phone: "214-555-0505",
      address: "560 Pine Blvd, Garland, TX 75040",
    },
    {
      name: "Robert Williams",
      email: "r.williams@email.com",
      phone: "817-555-0606",
      address: "7701 Birch St, Arlington, TX 76011",
    },
  ];

  const customers: any[] = [];
  for (const c of customersData) {
    const customer = await prisma.customer.create({ data: c });
    customers.push(customer);
  }
  console.log(`Seeded ${customers.length} customers`);

  // ── Payment methods ──────────────────────────────────────────────────────────
  const cashMethod = await prisma.paymentMethodEntry.findFirst({
    where: { name: "Cash" },
  });
  const zelleMethod = await prisma.paymentMethodEntry.findFirst({
    where: { name: "Zelle" },
  });
  const boaMethod = await prisma.paymentMethodEntry.findFirst({
    where: { name: "Bank of America" },
  });

  const methods = [cashMethod!, zelleMethod!, boaMethod!];

  // ── Invoices + Payments ──────────────────────────────────────────────────────
  let invoiceCounter = 1;

  function invoiceNum() {
    return `INV-2025-${String(invoiceCounter++).padStart(4, "0")}`;
  }

  function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  function daysFromNow(n: number) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  }

  // 1. Paid invoice — Sarah Johnson
  {
    const amount = 1850.0;
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNum(),
        clientName: customers[0].name,
        customerId: customers[0].id,
        userId: 1,
        subtotal: 1850,
        tax: 0,
        discount: 0,
        shippingFee: 0,
        insuranceAmount: 10,
        amount,
        paidAmount: amount,
        invoiceDate: daysAgo(30),
        dueDate: daysAgo(20),
        status: "paid",
        items: [{ name: "18K Gold Necklace 24g", quantity: 1, pricePerItem: 1850 }],
        termsSnapshot: defaultTerms.lines,
        source: "manual",
      },
    });
    const pm = await prisma.payment.create({
      data: {
        invoiceId: inv.id,
        amount,
        methodId: methods[0].id,
        paymentDate: daysAgo(20),
        userId: 1,
        source: "manual",
        notes: "Full payment received in cash",
        isMatched: true,
      },
    });
    await prisma.payment.update({
      where: { id: pm.id },
      data: { paymentCode: `PAY-${String(pm.id).padStart(6, "0")}` },
    });
    console.log("Created paid invoice:", inv.invoiceNumber);
  }

  // 2. Partial invoice — Mohammed Al-Rashid
  {
    const amount = 3200.0;
    const paid = 1000.0;
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNum(),
        clientName: customers[1].name,
        customerId: customers[1].id,
        userId: 1,
        subtotal: 3200,
        tax: 0,
        discount: 0,
        shippingFee: 0,
        insuranceAmount: 20,
        amount,
        paidAmount: paid,
        invoiceDate: daysAgo(15),
        dueDate: daysFromNow(15),
        status: "partial",
        items: [{ name: "18K Gold Bracelet 40g", quantity: 1, pricePerItem: 3200 }],
        termsSnapshot: defaultTerms.lines,
        source: "manual",
      },
    });
    const pm = await prisma.payment.create({
      data: {
        invoiceId: inv.id,
        amount: paid,
        methodId: methods[1].id,
        paymentDate: daysAgo(12),
        userId: 2,
        source: "manual",
        notes: "Partial payment via Zelle",
        isMatched: true,
      },
    });
    await prisma.payment.update({
      where: { id: pm.id },
      data: { paymentCode: `PAY-${String(pm.id).padStart(6, "0")}` },
    });
    console.log("Created partial invoice:", inv.invoiceNumber);
  }

  // 3. Overdue invoice — Jennifer Martinez
  {
    const amount = 950.0;
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNum(),
        clientName: customers[2].name,
        customerId: customers[2].id,
        userId: 2,
        subtotal: 950,
        tax: 0,
        discount: 50,
        shippingFee: 0,
        insuranceAmount: 5,
        amount,
        paidAmount: 0,
        invoiceDate: daysAgo(45),
        dueDate: daysAgo(15),
        status: "overdue",
        items: [{ name: "18K Gold Ring 12g", quantity: 1, pricePerItem: 1000 }],
        termsSnapshot: defaultTerms.lines,
        source: "manual",
      },
    });
    console.log("Created overdue invoice:", inv.invoiceNumber);
  }

  // 4. Pending invoice — David Chen
  {
    const amount = 2400.0;
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNum(),
        clientName: customers[3].name,
        customerId: customers[3].id,
        userId: 1,
        subtotal: 2400,
        tax: 0,
        discount: 0,
        shippingFee: 35,
        insuranceAmount: 20,
        amount,
        paidAmount: 0,
        invoiceDate: daysAgo(5),
        dueDate: daysFromNow(25),
        status: "pending",
        items: [{ name: "18K Gold Earrings 16g", quantity: 2, pricePerItem: 1200 }],
        termsSnapshot: defaultTerms.lines,
        source: "manual",
      },
    });
    console.log("Created pending invoice:", inv.invoiceNumber);
  }

  // 5. Paid invoice — Fatima Hassan (via Zelle)
  {
    const amount = 4750.0;
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNum(),
        clientName: customers[4].name,
        customerId: customers[4].id,
        userId: 1,
        subtotal: 4750,
        tax: 0,
        discount: 250,
        shippingFee: 0,
        insuranceAmount: 35,
        amount,
        paidAmount: amount,
        invoiceDate: daysAgo(60),
        dueDate: daysAgo(50),
        status: "paid",
        items: [{ name: "18K Gold Set (Necklace + Earrings) 60g", quantity: 1, pricePerItem: 5000 }],
        termsSnapshot: defaultTerms.lines,
        source: "manual",
      },
    });
    const pm = await prisma.payment.create({
      data: {
        invoiceId: inv.id,
        amount,
        methodId: methods[1].id,
        paymentDate: daysAgo(50),
        userId: 1,
        source: "manual",
        notes: "Full payment via Zelle transfer",
        isMatched: true,
      },
    });
    await prisma.payment.update({
      where: { id: pm.id },
      data: { paymentCode: `PAY-${String(pm.id).padStart(6, "0")}` },
    });
    console.log("Created paid invoice (Zelle):", inv.invoiceNumber);
  }

  // 6. Partial invoice — Robert Williams (bank transfer)
  {
    const amount = 1600.0;
    const paid = 800.0;
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNum(),
        clientName: customers[5].name,
        customerId: customers[5].id,
        userId: 2,
        subtotal: 1600,
        tax: 0,
        discount: 0,
        shippingFee: 0,
        insuranceAmount: 10,
        amount,
        paidAmount: paid,
        invoiceDate: daysAgo(8),
        dueDate: daysFromNow(22),
        status: "partial",
        items: [{ name: "18K Gold Bangle 20g", quantity: 1, pricePerItem: 1600 }],
        termsSnapshot: defaultTerms.lines,
        source: "manual",
      },
    });
    const pm = await prisma.payment.create({
      data: {
        invoiceId: inv.id,
        amount: paid,
        methodId: methods[2].id,
        paymentDate: daysAgo(6),
        userId: 2,
        source: "manual",
        notes: "Deposit via Bank of America transfer",
        isMatched: true,
      },
    });
    await prisma.payment.update({
      where: { id: pm.id },
      data: { paymentCode: `PAY-${String(pm.id).padStart(6, "0")}` },
    });
    console.log("Created partial invoice (BOA):", inv.invoiceNumber);
  }

  // 7. Two more recent paid invoices for dashboard activity
  for (let i = 0; i < 2; i++) {
    const customer = customers[i % customers.length];
    const amount = 1200 + i * 400;
    const daysBack = i + 1;
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNum(),
        clientName: customer.name,
        customerId: customer.id,
        userId: 1,
        subtotal: amount,
        tax: 0,
        discount: 0,
        shippingFee: 0,
        insuranceAmount: 5,
        amount,
        paidAmount: amount,
        invoiceDate: daysAgo(daysBack + 2),
        dueDate: daysAgo(daysBack),
        status: "paid",
        items: [{ name: "18K Gold Chain 15g", quantity: 1, pricePerItem: amount }],
        termsSnapshot: defaultTerms.lines,
        source: "manual",
      },
    });
    const pm = await prisma.payment.create({
      data: {
        invoiceId: inv.id,
        amount,
        methodId: methods[i % methods.length].id,
        paymentDate: daysAgo(daysBack),
        userId: 1,
        source: "manual",
        isMatched: true,
      },
    });
    await prisma.payment.update({
      where: { id: pm.id },
      data: { paymentCode: `PAY-${String(pm.id).padStart(6, "0")}` },
    });
  }

  console.log("Seeded 2 additional recent invoices");
  console.log("\n✅ Dev seed complete.");
  console.log("\nCredentials:");
  console.log("  Admin      → admin@example.com      / admin123");
  console.log("  Accountant → accountant@example.com / accountant123");
  console.log("  Staff      → staff@example.com      / staff123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
