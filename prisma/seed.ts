import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Hash a default password for the admin
  const hashedPassword = await bcrypt.hash(
    process.env.SUPERADMIN_PASSWORD || "admin123",
    10
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
    { name: "Cash", icon: "banknote", color: "#D97706", isSystem: true, sortOrder: 1 },
    { name: "Zelle", icon: "smartphone", color: "#16A34A", isSystem: false, sortOrder: 2 },
    { name: "Bank of America", icon: "building-2", color: "#1D4ED8", isSystem: false, sortOrder: 3 },
    { name: "Layaway", icon: "clock", color: "#9333EA", isSystem: true, sortOrder: 4 },
  ];

  for (const pm of paymentMethods) {
    await prisma.paymentMethodEntry.upsert({
      where: { name: pm.name },
      update: {},
      create: pm,
    });
  }

  console.log("Seeded payment methods:", paymentMethods.map(p => p.name).join(", "));

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
