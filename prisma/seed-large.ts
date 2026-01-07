
import { PrismaClient, InvoiceStatus, PaymentMethod } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Helper to get random item from array
const random = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper to generate random date within last year
const randomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Ensure Users Exist
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: hashedPassword,
      name: "Super Admin",
      role: "admin",
      privileges: { documents: { upload: true, delete: true, rename: true } },
    },
  });

  // 2. Clear existing data (Optional - comment out if you want to keep data)
  // await prisma.paymentInvoiceMatch.deleteMany();
  // await prisma.payment.deleteMany();
  // await prisma.invoice.deleteMany();
  // console.log("🧹 Cleared existing invoices and payments");

  // 3. Generate 200 Invoices
  const clientNames = ["John Doe", "Jane Smith", "Acme Corp", "Tech Solutions", "Global Imports", "Local Shop", "Alice Johnson", "Bob Brown"];
  const itemsList = [
    { name: "Web Design", price: 500 },
    { name: "SEO Service", price: 300 },
    { name: "Hosting", price: 100 },
    { name: "Consultation", price: 150 },
    { name: "Maintenance", price: 200 }
  ];

  const invoices = [];
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  const endDate = new Date();

  for (let i = 0; i < 200; i++) {
    const isLayaway = Math.random() > 0.5; // 50% chance
    const status = random([InvoiceStatus.paid, InvoiceStatus.pending, InvoiceStatus.overdue, InvoiceStatus.partial]);
    const client = random(clientNames);
    const createdAt = randomDate(startDate, endDate);
    const dueDate = new Date(createdAt);
    dueDate.setDate(dueDate.getDate() + 30);

    // Generate random items
    const numItems = Math.floor(Math.random() * 3) + 1;
    const currentItems = [];
    let subtotal = 0;

    for (let j = 0; j < numItems; j++) {
      const item = random(itemsList);
      const qty = Math.floor(Math.random() * 5) + 1;
      currentItems.push({ name: item.name, quantity: qty, price: item.price });
      subtotal += item.price * qty;
    }

    const tax = subtotal * 0.1;
    const totalAmount = subtotal + tax;
    
    let paidAmount = 0;
    if (status === InvoiceStatus.paid) paidAmount = totalAmount;
    else if (status === InvoiceStatus.partial) paidAmount = totalAmount * 0.5;
    else if (status === InvoiceStatus.pending || status === InvoiceStatus.overdue) paidAmount = 0;

    const invoice = await prisma.invoice.create({
      data: {
        userId: admin.id,
        invoiceNumber: `INV-${2024000 + i}`,
        clientName: client,
        items: currentItems,
        subtotal: subtotal,
        tax: tax,
        amount: totalAmount,
        paidAmount: paidAmount,
        dueDate: dueDate,
        status: status,
        isLayaway: isLayaway,
        createdAt: createdAt,
        updatedAt: createdAt, // Simulate old updates
      }
    });
    invoices.push(invoice);

    // 4. Generate Payments for Paid/Partial Invoices
    if (paidAmount > 0) {
      const method = random([PaymentMethod.cash, PaymentMethod.zelle, PaymentMethod.quickbooks]);
      
      const payment = await prisma.payment.create({
        data: {
          userId: admin.id,
          amount: paidAmount,
          method: method,
          paymentDate: randomDate(createdAt, new Date()),
          invoiceId: invoice.id,
          isMatched: true,
          notes: `Payment for ${invoice.invoiceNumber}`,
        }
      });

      await prisma.paymentInvoiceMatch.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: paidAmount,
          userId: admin.id
        }
      });
    }
  }

  console.log(`✅ Generated ${invoices.length} invoices with payments.`);
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
