import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Hash a default password for the admin
  const hashedPassword = await bcrypt.hash(
    process.env.SUPERADMIN_PASSWORD || "admin123",
    10,
  ); // Change this in production

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: process.env.SUPERADMIN_EMAIL || "admin@example.com",
      passwordHash: hashedPassword,
      name: "Super Admin",
      role: "admin",
      privileges: {
        documents: {
          upload: true,
          delete: true,
          rename: true,
        },
      },
    },
  });

  console.log("Created admin user:", admin);

  // Create a default accountant
  const accountantPassword = await bcrypt.hash("accountant123", 10);
  const accountant = await prisma.user.upsert({
    where: { email: "accountant@example.com" },
    update: {},
    create: {
      email: "accountant@example.com",
      passwordHash: accountantPassword,
      name: "Default Accountant",
      role: "accountant",
      privileges: {
        documents: {
          upload: false,
          delete: false,
          rename: false,
        },
      },
    },
  });

  console.log("Created accountant user:", accountant);

  // Create a default staff user (same default privileges as accountant)
  const staffPassword = await bcrypt.hash("staff123", 10);
  const staff = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      email: "staff@example.com",
      passwordHash: staffPassword,
      name: "Default Staff",
      role: "staff",
      privileges: {
        documents: {
          upload: false,
          delete: false,
          rename: false,
        },
      },
    },
  });

  console.log("Created staff user:", staff);

  // Seed default payment methods
  const paymentMethods = [
    {
      name: "Cash",
      icon: "banknote",
      color: "#D97706",
      isSystem: true,
      sortOrder: 1,
    },
    {
      name: "Zelle",
      icon: "smartphone",
      color: "#16A34A",
      isSystem: false,
      sortOrder: 2,
    },
    {
      name: "Bank of America",
      icon: "building-2",
      color: "#1D4ED8",
      isSystem: false,
      sortOrder: 3,
    },
  ];

  for (const pm of paymentMethods) {
    await prisma.paymentMethodEntry.upsert({
      where: { name: pm.name },
      update: {},
      create: pm,
    });
  }

  console.log(
    "Seeded payment methods:",
    paymentMethods.map((p) => p.name).join(", "),
  );

  const units = [
    {
      name: "grams",
      isActive: true,
      isDefault: true,
      isSystem: true,
      sortOrder: 1,
    },
  ];

  for (const unit of units) {
    await (prisma as any).invoiceUnit.upsert({
      where: { name: unit.name },
      update: { ...unit },
      create: unit,
    });
  }

  console.log("Seeded invoice units:", units.map((u) => u.name).join(", "));

  const layawayFeeRates = [
    {
      unitName: "grams",
      months: 1,
      ratePerGram: 3,
      isActive: true,
      sortOrder: 1,
    },
    {
      unitName: "grams",
      months: 2,
      ratePerGram: 4,
      isActive: true,
      sortOrder: 2,
    },
    {
      unitName: "grams",
      months: 3,
      ratePerGram: 5,
      isActive: true,
      sortOrder: 3,
    },
    {
      unitName: "grams",
      months: 4,
      ratePerGram: 8,
      isActive: true,
      sortOrder: 4,
    },
    {
      unitName: "grams",
      months: 5,
      ratePerGram: 9,
      isActive: true,
      sortOrder: 5,
    },
    {
      unitName: "grams",
      months: 6,
      ratePerGram: 10,
      isActive: true,
      sortOrder: 6,
    },
  ];

  for (const rate of layawayFeeRates) {
    await (prisma as any).layawayFeeSetting.upsert({
      where: {
        unitName_months: {
          unitName: rate.unitName,
          months: rate.months,
        },
      },
      update: { ...rate },
      create: rate,
    });
  }

  console.log(
    "Seeded layaway fee settings:",
    layawayFeeRates.map((rate) => `${rate.months}m`).join(", "),
  );

  // Fee settings used by local validation flows
  await prisma.lateFeeSetting.deleteMany({});
  await prisma.lateFeeSetting.create({
    data: {
      amount: 25,
      isActive: true,
    },
  });

  await prisma.recalculationFeeSetting.deleteMany({});
  await prisma.recalculationFeeSetting.create({
    data: {
      ratePercent: 12.5,
      isActive: true,
    },
  });

  await prisma.restockingFeeSetting.deleteMany({});
  await prisma.restockingFeeSetting.create({
    data: {
      amount: 15,
      isPercentage: true,
      isActive: true,
    },
  });

  const depositFeeRules = [
    {
      name: "Deposit Fee - Small Items",
      minAmount: 0,
      maxAmount: 299.99,
      fee: 15,
      isActive: true,
      sortOrder: 1,
    },
    {
      name: "Deposit Fee - Mid Items",
      minAmount: 300,
      maxAmount: 999.99,
      fee: 35,
      isActive: true,
      sortOrder: 2,
    },
    {
      name: "Deposit Fee - Large Items",
      minAmount: 1000,
      maxAmount: null,
      fee: 60,
      isActive: true,
      sortOrder: 3,
    },
  ];

  await prisma.depositFeeRule.deleteMany({});
  for (const rule of depositFeeRules) {
    await prisma.depositFeeRule.create({
      data: {
        name: rule.name,
        minAmount: rule.minAmount,
        maxAmount: rule.maxAmount,
        fee: rule.fee,
        isActive: rule.isActive,
        sortOrder: rule.sortOrder,
        createdBy: admin.id,
      },
    });
  }

  console.log(
    "Seeded fee settings:",
    "late fee, recalculation fee, restocking fee, deposit fee rules",
  );

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

  async function upsertCustomer(name: string, data: any) {
    const existing = await prisma.customer.findFirst({ where: { name } });

    if (existing) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: { name, ...data },
      });
    }

    return prisma.customer.create({
      data: { name, ...data },
    });
  }

  async function upsertInvoice(invoiceNumber: string, data: any) {
    return prisma.invoice.upsert({
      where: { invoiceNumber },
      update: data,
      create: {
        invoiceNumber,
        ...data,
      },
    });
  }

  async function ensurePayment(input: {
    invoiceId: number | null;
    amount: number;
    methodId: number;
    paymentDate: Date;
    userId: number;
    source: string;
    notes: string;
    isMatched?: boolean;
  }) {
    const existing = await prisma.payment.findFirst({
      where: {
        invoiceId: input.invoiceId,
        amount: input.amount,
        source: input.source,
        notes: input.notes,
      },
    });

    if (existing) {
      return existing;
    }

    const created = await prisma.payment.create({
      data: {
        invoiceId: input.invoiceId,
        amount: input.amount,
        methodId: input.methodId,
        paymentDate: input.paymentDate,
        userId: input.userId,
        source: input.source,
        notes: input.notes,
        isMatched: input.isMatched ?? true,
      },
    });

    return prisma.payment.update({
      where: { id: created.id },
      data: { paymentCode: `PAY-${String(created.id).padStart(6, "0")}` },
    });
  }

  const cashMethod = await prisma.paymentMethodEntry.findFirst({
    where: { name: "Cash" },
  });
  const zelleMethod = await prisma.paymentMethodEntry.findFirst({
    where: { name: "Zelle" },
  });

  if (!cashMethod || !zelleMethod) {
    throw new Error("Seeded payment methods were not found");
  }

  const restockingCustomer = await upsertCustomer("Fee Test - Restocking", {
    email: "fee.restocking@example.com",
    phone: "214-555-1010",
    address: "100 Validation Way, Dallas, TX 75201",
    notes: "Seeded customer for restocking fee validation",
  });

  const lateFeeCustomer = await upsertCustomer("Fee Test - Late Fee", {
    email: "fee.late@example.com",
    phone: "214-555-2020",
    address: "200 Validation Way, Dallas, TX 75201",
    notes: "Seeded customer for late fee and recalculation validation",
  });

  const depositCustomer = await upsertCustomer("Fee Test - Deposit", {
    email: "fee.deposit@example.com",
    phone: "214-555-3030",
    address: "300 Validation Way, Dallas, TX 75201",
    notes: "Seeded customer for deposit fee validation",
  });

  const restockingInvoice = await upsertInvoice("INV-2026-9001", {
    userId: admin.id,
    clientName: restockingCustomer.name,
    customerId: restockingCustomer.id,
    source: "manual",
    subtotal: 2450,
    tax: 0,
    discount: 0,
    shippingFee: 0,
    insuranceAmount: 0,
    layawayFee: 0,
    amount: 2450,
    paidAmount: 2450,
    invoiceDate: daysAgo(18),
    dueDate: daysAgo(8),
    status: "paid",
    isLayaway: false,
    isHold: false,
    description: "Seeded paid invoice for restocking fee testing",
    items: [
      { name: "Gold Chain 18g", quantity: 1, pricePerItem: 1450 },
      { name: "Silver Bangle 10g", quantity: 1, pricePerItem: 1000 },
    ],
  });

  const restockingPayment = await ensurePayment({
    invoiceId: restockingInvoice.id,
    amount: 2450,
    methodId: cashMethod.id,
    paymentDate: daysAgo(8),
    userId: accountant.id,
    source: "manual",
    notes: "Seeded payment for restocking fee case",
  });

  const layawayInvoice = await upsertInvoice("INV-2026-9002", {
    userId: admin.id,
    clientName: lateFeeCustomer.name,
    customerId: lateFeeCustomer.id,
    source: "manual",
    subtotal: 1800,
    tax: 0,
    discount: 0,
    shippingFee: 0,
    insuranceAmount: 0,
    layawayFee: 0,
    amount: 1800,
    paidAmount: 300,
    invoiceDate: daysAgo(150),
    dueDate: daysAgo(90),
    status: "partial",
    isLayaway: true,
    isHold: false,
    description:
      "Seeded layaway invoice for late fee and recalculation testing",
    items: [
      { name: "Layaway Ring", quantity: 1, pricePerItem: 600 },
      { name: "Layaway Bracelet", quantity: 1, pricePerItem: 600 },
      { name: "Layaway Necklace", quantity: 1, pricePerItem: 600 },
    ],
  });

  const layawayDownPayment = await ensurePayment({
    invoiceId: layawayInvoice.id,
    amount: 300,
    methodId: zelleMethod.id,
    paymentDate: daysAgo(150),
    userId: staff.id,
    source: "manual",
    notes: "Seeded layaway down payment",
  });

  const existingLayawayPlan = await prisma.layawayPlan.findUnique({
    where: { invoiceId: layawayInvoice.id },
    include: { installments: true },
  });

  if (!existingLayawayPlan) {
    const layawayPlan = await prisma.layawayPlan.create({
      data: {
        invoiceId: layawayInvoice.id,
        months: 3,
        paymentFrequency: "monthly",
        downPayment: 300,
        notes:
          "Seeded plan with one paid installment and overdue unpaid installments",
      },
    });

    const installments = [
      {
        dueDate: daysAgo(150),
        amount: 300,
        label: "Down Payment",
        isPaid: true,
        paidDate: daysAgo(150),
        paidAmount: 300,
        paymentId: layawayDownPayment.id,
      },
      {
        dueDate: daysAgo(120),
        amount: 500,
        label: "1st Payment",
        isPaid: false,
      },
      {
        dueDate: daysAgo(90),
        amount: 500,
        label: "2nd Payment",
        isPaid: false,
      },
      {
        dueDate: daysAgo(60),
        amount: 500,
        label: "3rd Payment",
        isPaid: false,
      },
    ];

    for (const installment of installments) {
      await prisma.layawayInstallment.create({
        data: {
          layawayPlanId: layawayPlan.id,
          dueDate: installment.dueDate,
          amount: installment.amount,
          label: installment.label,
          isPaid: installment.isPaid,
          paidDate: installment.paidDate || null,
          paidAmount: installment.paidAmount || null,
          paymentId: installment.paymentId || null,
        },
      });
    }
  }

  const depositInvoice = await upsertInvoice("INV-2026-9003", {
    userId: accountant.id,
    clientName: depositCustomer.name,
    customerId: depositCustomer.id,
    source: "manual",
    subtotal: 2400,
    tax: 0,
    discount: 0,
    shippingFee: 0,
    insuranceAmount: 0,
    layawayFee: 0,
    amount: 2400,
    paidAmount: 0,
    invoiceDate: daysAgo(7),
    dueDate: daysFromNow(14),
    status: "pending",
    isLayaway: false,
    isHold: false,
    description:
      "Seeded invoice with mixed item prices to validate deposit fee bands",
    items: [
      {
        name: "Deposit Fee Small Item",
        quantity: 1,
        pricePerItem: 150,
        depositFee: 15,
      },
      {
        name: "Deposit Fee Mid Item",
        quantity: 1,
        pricePerItem: 750,
        depositFee: 35,
      },
      {
        name: "Deposit Fee Large Item",
        quantity: 1,
        pricePerItem: 1500,
        depositFee: 60,
      },
    ],
  });

  const seedInvoices = [restockingInvoice, layawayInvoice, depositInvoice];

  console.log(
    "Seeded validation invoices:",
    seedInvoices.map((invoice) => invoice.invoiceNumber).join(", "),
  );
  console.log(
    "Seeded payments:",
    [restockingPayment, layawayDownPayment]
      .map((payment) => payment.paymentCode || `PAY-${payment.id}`)
      .join(", "),
  );

  // // Create default system folder for documents
  // const defaultFolder = await prisma.systemFolder.upsert({
  //   where: { id: 1 },
  //   update: {},
  //   create: {
  //     name: 'Business Documents',
  //     isDefault: true,
  //   },
  // });

  // console.log('Created default folder:', defaultFolder);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
