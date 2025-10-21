import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Hash a default password for the admin
  const hashedPassword = await bcrypt.hash('admin123', 10); // Change this in production

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: hashedPassword,
      name: 'Super Admin',
      role: 'admin',
      privileges: {
        documents: {
          upload: true,
          delete: true,
          rename: true,
        },
      },
    },
  });

  console.log('Created admin user:', admin);

  // Create a default accountant
  const accountantPassword = await bcrypt.hash('accountant123', 10);
  const accountant = await prisma.user.upsert({
    where: { email: 'accountant@example.com' },
    update: {},
    create: {
      email: 'accountant@example.com',
      passwordHash: accountantPassword,
      name: 'Default Accountant',
      role: 'accountant',
      privileges: {
        documents: {
          upload: false,
          delete: false,
          rename: false,
        },
      },
    },
  });

  console.log('Created accountant user:', accountant);

  // Create default system folder for documents
  const defaultFolder = await prisma.systemFolder.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Business Documents',
      isDefault: true,
    },
  });

  console.log('Created default folder:', defaultFolder);
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