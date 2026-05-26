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
      where: { months: rate.months },
      update: { ...rate },
      create: rate,
    });
  }

  console.log(
    "Seeded layaway fee settings:",
    layawayFeeRates.map((rate) => `${rate.months}m`).join(", "),
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
