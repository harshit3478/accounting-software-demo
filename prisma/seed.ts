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
      name: 'Admin User',
      role: 'admin',
    },
  });

  console.log('Created admin user:', admin);

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