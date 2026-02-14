/**
 * Post-import validation script
 *
 * Usage:
 *   npx tsx scripts/validate-import.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Post-Import Validation ===\n');

  // Counts
  const customerCount = await prisma.customer.count();
  const invoiceCount = await prisma.invoice.count();
  const paymentCount = await prisma.payment.count();
  const layawayPlanCount = await prisma.layawayPlan.count();
  const installmentCount = await prisma.layawayInstallment.count();
  const matchCount = await prisma.paymentInvoiceMatch.count();

  console.log('Record counts:');
  console.log(`  Customers: ${customerCount}`);
  console.log(`  Invoices: ${invoiceCount}`);
  console.log(`  Payments: ${paymentCount}`);
  console.log(`  Layaway Plans: ${layawayPlanCount}`);
  console.log(`  Layaway Installments: ${installmentCount}`);
  console.log(`  Payment-Invoice Matches: ${matchCount}`);

  // Source breakdown
  const invoicesBySource = await prisma.invoice.groupBy({
    by: ['source'],
    _count: true,
  });
  console.log('\nInvoices by source:');
  for (const s of invoicesBySource) {
    console.log(`  ${s.source}: ${s._count}`);
  }

  const paymentsBySource = await prisma.payment.groupBy({
    by: ['source'],
    _count: true,
  });
  console.log('\nPayments by source:');
  for (const s of paymentsBySource) {
    console.log(`  ${s.source}: ${s._count}`);
  }

  // Status distribution
  const statusDist = await prisma.invoice.groupBy({
    by: ['status'],
    _count: true,
  });
  console.log('\nInvoice status distribution:');
  for (const s of statusDist) {
    console.log(`  ${s.status}: ${s._count}`);
  }

  // Payment method distribution
  const methodDist = await prisma.payment.groupBy({
    by: ['methodId'],
    _count: true,
    _sum: { amount: true },
  });
  const allMethods = await prisma.paymentMethodEntry.findMany();
  const methodMap = new Map(allMethods.map(m => [m.id, m.name]));

  console.log('\nPayment method distribution:');
  for (const m of methodDist) {
    const name = methodMap.get(m.methodId) || `Unknown (${m.methodId})`;
    console.log(`  ${name}: ${m._count} payments, $${Number(m._sum.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  }

  // Unmatched payments
  const unmatchedPayments = await prisma.payment.count({
    where: { isMatched: false },
  });
  const matchedPayments = paymentCount - unmatchedPayments;
  console.log(`\nPayment matching:`);
  console.log(`  Matched: ${matchedPayments} (${((matchedPayments / paymentCount) * 100).toFixed(1)}%)`);
  console.log(`  Unmatched: ${unmatchedPayments} (${((unmatchedPayments / paymentCount) * 100).toFixed(1)}%)`);

  // Layaway stats
  if (layawayPlanCount > 0) {
    const cancelledPlans = await prisma.layawayPlan.count({ where: { isCancelled: true } });
    const paidInstallments = await prisma.layawayInstallment.count({ where: { isPaid: true } });
    console.log(`\nLayaway:`);
    console.log(`  Active plans: ${layawayPlanCount - cancelledPlans}`);
    console.log(`  Cancelled plans: ${cancelledPlans}`);
    console.log(`  Total installments: ${installmentCount}`);
    console.log(`  Paid installments: ${paidInstallments} (${((paidInstallments / installmentCount) * 100).toFixed(1)}%)`);
  }

  // Spot check: 5 random invoices
  console.log('\nSpot check (5 random invoices):');
  const sampleInvoices = await prisma.invoice.findMany({
    take: 5,
    orderBy: { id: 'desc' },
    include: {
      customer: true,
      payments: { include: { method: true } },
      layawayPlan: { include: { installments: true } },
    },
  });

  for (const inv of sampleInvoices) {
    const paidTotal = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    console.log(`  ${inv.invoiceNumber} | ${inv.clientName} | $${Number(inv.amount)} | Paid: $${paidTotal} | Status: ${inv.status} | Layaway: ${inv.isLayaway}`);
    if (inv.layawayPlan) {
      console.log(`    Plan: ${inv.layawayPlan.months}mo, ${inv.layawayPlan.paymentFrequency}, ${inv.layawayPlan.installments.length} installments`);
    }
  }

  // Check for data issues
  console.log('\nData integrity checks:');

  // Invoices with negative amounts
  const negativeInvoices = await prisma.invoice.count({
    where: { amount: { lt: 0 } },
  });
  console.log(`  Invoices with negative amount: ${negativeInvoices} ${negativeInvoices > 0 ? '⚠️' : '✓'}`);

  // Payments with negative amounts
  const negativePayments = await prisma.payment.count({
    where: { amount: { lt: 0 } },
  });
  console.log(`  Payments with negative amount: ${negativePayments} ${negativePayments > 0 ? '⚠️' : '✓'}`);

  // Orphaned payments (linked to non-existent invoice)
  const orphanedPayments = await prisma.payment.count({
    where: {
      invoiceId: { not: null },
      invoice: null,
    },
  });
  console.log(`  Orphaned payments: ${orphanedPayments} ${orphanedPayments > 0 ? '⚠️' : '✓'}`);

  // Duplicate external invoice numbers
  const extNums = await prisma.invoice.groupBy({
    by: ['externalInvoiceNumber'],
    _count: true,
    having: { externalInvoiceNumber: { _count: { gt: 1 } } },
  });
  console.log(`  Duplicate external invoice numbers: ${extNums.length} ${extNums.length > 0 ? '⚠️' : '✓'}`);

  console.log('\n=== Validation Complete ===');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Validation failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
