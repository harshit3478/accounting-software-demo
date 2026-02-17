/**
 * QuickBooks CSV Import Script
 *
 * Imports invoices, payments, customers, and layaway plans from a QuickBooks
 * General Ledger CSV export.
 *
 * Usage:
 *   npx tsx scripts/import-quickbooks.ts --csv=/path/to/accounting.csv --userId=1 [--dry-run] [--limit=100]
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import Papa from 'papaparse';

const prisma = new PrismaClient();

// CLI args
const args = process.argv.slice(2);
const getArg = (name: string) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

const csvPath = getArg('csv');
const userId = parseInt(getArg('userId') || '1');
const dryRun = args.includes('--dry-run');
const limitArg = getArg('limit');
const limit = limitArg ? parseInt(limitArg) : null;

if (!csvPath) {
  console.error('Usage: npx tsx scripts/import-quickbooks.ts --csv=<path> --userId=<id> [--dry-run] [--limit=N]');
  process.exit(1);
}

// Types
interface CSVRow {
  'Transaction ID': string;
  'Transaction Date': string;
  'Account Name': string;
  'Transaction Description': string;
  'Transaction Line Description': string;
  'Amount (One column)': string;
  'Debit Amount (Two Column Approach)': string;
  'Credit Amount (Two Column Approach)': string;
  'Other Accounts for this Transaction': string;
  'Customer': string;
  'Vendor': string;
  'Invoice Number': string;
  'Bill Number': string;
  'Notes / Memo': string;
  'Amount Before Sales Tax': string;
  'Sales Tax Amount': string;
  'Sales Tax Name': string;
  'Transaction Date Added': string;
  'Transaction Date Last Modified': string;
  'Account Group': string;
  'Account Type': string;
  'Account ID': string;
}

interface ParsedInvoice {
  txnId: string;
  customerName: string;
  externalInvoiceNumber: string;
  items: { name: string; quantity: number; price: number }[];
  amount: number;
  dueDate: Date;
  createdAt: Date;
  isLayaway: boolean;
  layawayMemo: string | null;
}

interface ParsedPayment {
  txnId: string;
  customerName: string;
  amount: number;
  paymentDate: Date;
  methodName: string;
  invoiceNumber: string | null;
  notes: string;
}

interface LayawayPlanData {
  months: number;
  paymentFrequency: string;
  downPayment: number;
  isCancelled: boolean;
  installments: { dueDate: Date; amount: number; label: string; isPaid: boolean; paidDate: Date | null; paidAmount: number | null }[];
}

// Parse layaway memo text into structured data
function parseLayawayMemo(memo: string): LayawayPlanData | null {
  if (!memo || !memo.includes('LAY-AWAY')) return null;

  let months = 1;
  let paymentFrequency = 'monthly';
  let downPayment = 0;
  let isCancelled = false;
  const installments: LayawayPlanData['installments'] = [];

  // Extract months
  const monthMatch = memo.match(/Month\(s\):\s*(\d+)/i);
  if (monthMatch) months = parseInt(monthMatch[1]);

  // Extract payment type
  const typeMatch = memo.match(/Payment Type:\s*(.+)/i);
  if (typeMatch) {
    const type = typeMatch[1].trim().toLowerCase();
    if (type.includes('cancel')) {
      isCancelled = true;
    }
    if (type.includes('bi-weekly') || type.includes('biweekly')) {
      paymentFrequency = 'bi-weekly';
    } else if (type.includes('weekly')) {
      paymentFrequency = 'weekly';
    } else {
      paymentFrequency = 'monthly';
    }
  }

  // Parse installment schedule lines
  // Pattern: MM/DD/YY - Label (Paid $XX.XX on MM/DD/YY) or MM/DD/YY - Label - $XX.XX
  const scheduleRegex = /(\d{2}\/\d{2}\/\d{2})\s*-\s*(.+?)(?:\(Paid\s+\$?([\d,.]+)\s+on\s+(\d{2}\/\d{2}\/\d{2})\)|[–-]\s*\$?([\d,.]+))/g;
  let match;

  while ((match = scheduleRegex.exec(memo)) !== null) {
    const dueDateStr = match[1];
    const label = match[2].trim();
    const paidAmountStr = match[3];
    const paidDateStr = match[4];
    const scheduledAmountStr = match[5];

    const dueDate = parseShortDate(dueDateStr);
    const isPaid = !!paidAmountStr;
    const paidAmount = paidAmountStr ? parseFloat(paidAmountStr.replace(',', '')) : null;
    const paidDate = paidDateStr ? parseShortDate(paidDateStr) : null;
    const amount = paidAmount || (scheduledAmountStr ? parseFloat(scheduledAmountStr.replace(',', '')) : 0);

    if (label.toLowerCase().includes('down payment')) {
      downPayment = amount;
    }

    installments.push({
      dueDate,
      amount,
      label: label.replace(/\s*$/, ''),
      isPaid,
      paidDate,
      paidAmount,
    });
  }

  if (installments.length === 0 && !isCancelled) {
    // No parseable schedule — still create a basic plan
    return { months, paymentFrequency, downPayment: 0, isCancelled, installments: [] };
  }

  return { months, paymentFrequency, downPayment, isCancelled, installments };
}

function parseShortDate(str: string): Date {
  // MM/DD/YY
  const parts = str.split('/');
  if (parts.length !== 3) return new Date();
  const month = parseInt(parts[0]) - 1;
  const day = parseInt(parts[1]);
  let year = parseInt(parts[2]);
  year = year < 50 ? 2000 + year : 1900 + year;
  return new Date(year, month, day);
}

function parseCSVDate(str: string): Date {
  if (!str) return new Date();
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Detect payment method from account name
function detectPaymentMethod(accountName: string): string {
  const lower = accountName.toLowerCase();
  if (lower.includes('cash on hand') || lower.includes('cash')) return 'Cash';
  if (lower.includes('wave') || lower.includes('zelle')) return 'Zelle';
  if (lower.includes('bank of america') || lower.includes('boa')) return 'Bank of America';
  if (lower.includes('layaway')) return 'Layaway';
  return 'Cash'; // default
}

async function main() {
  console.log('=== QuickBooks CSV Import ===');
  console.log(`CSV: ${csvPath}`);
  console.log(`User ID: ${userId}`);
  console.log(`Dry run: ${dryRun}`);
  if (limit) console.log(`Limit: ${limit} transactions`);
  console.log('');

  // Read and parse CSV
  const csvContent = fs.readFileSync(csvPath!, 'utf-8');
  const { data: rows } = Papa.parse<CSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  console.log(`Total CSV rows: ${rows.length}`);

  // Group rows by Transaction ID
  const txnGroups = new Map<string, CSVRow[]>();
  for (const row of rows) {
    const txnId = row['Transaction ID'];
    if (!txnId) continue;
    if (!txnGroups.has(txnId)) txnGroups.set(txnId, []);
    txnGroups.get(txnId)!.push(row);
  }

  console.log(`Unique transactions: ${txnGroups.size}`);

  // Classify transactions into invoices and payments
  const invoices: ParsedInvoice[] = [];
  const payments: ParsedPayment[] = [];
  const customerNames = new Set<string>();

  let processedCount = 0;

  for (const [txnId, txnRows] of txnGroups) {
    if (limit && processedCount >= limit) break;
    processedCount++;

    // Check if this is an invoice (has Sales account rows + AR debit)
    const salesRows = txnRows.filter(r => r['Account Name']?.includes('Sales'));
    const arDebitRow = txnRows.find(r =>
      r['Account Name'] === 'Accounts Receivable' &&
      parseFloat(r['Debit Amount (Two Column Approach)'] || '0') > 0
    );
    const arCreditRow = txnRows.find(r =>
      r['Account Name'] === 'Accounts Receivable' &&
      parseFloat(r['Credit Amount (Two Column Approach)'] || '0') > 0
    );

    if (salesRows.length > 0 && arDebitRow) {
      // This is an invoice
      const customer = arDebitRow['Customer'] || txnRows[0]['Customer'] || 'Unknown';
      customerNames.add(customer);

      const invoiceNum = arDebitRow['Invoice Number'] || '';
      const amount = parseFloat(arDebitRow['Debit Amount (Two Column Approach)'] || '0');
      const dateAdded = parseCSVDate(arDebitRow['Transaction Date Added']);
      const memo = arDebitRow['Notes / Memo'] || txnRows.find(r => r['Notes / Memo'])?.['Notes / Memo'] || '';

      // Parse line items from sales rows
      const items: { name: string; quantity: number; price: number }[] = [];
      for (const sr of salesRows) {
        const desc = sr['Transaction Line Description'] || sr['Transaction Description'] || '';
        // Format: "CustomerName - InvoiceNo - ItemName"
        const parts = desc.split(' - ');
        const itemName = parts.length >= 3 ? parts.slice(2).join(' - ') : desc;
        const lineAmount = Math.abs(parseFloat(sr['Amount (One column)'] || sr['Credit Amount (Two Column Approach)'] || '0'));

        items.push({
          name: itemName.trim() || 'Item',
          quantity: 1,
          price: lineAmount,
        });
      }

      const isLayaway = memo.toLowerCase().includes('lay-away') || memo.toLowerCase().includes('layaway');

      invoices.push({
        txnId,
        customerName: customer,
        externalInvoiceNumber: invoiceNum,
        items,
        amount,
        dueDate: dateAdded,
        createdAt: dateAdded,
        isLayaway,
        layawayMemo: isLayaway ? memo : null,
      });

    } else if (arCreditRow) {
      // This is a payment (AR credit + cash/bank debit)
      const customer = arCreditRow['Customer'] || txnRows[0]['Customer'] || 'Unknown';
      customerNames.add(customer);

      const amount = parseFloat(arCreditRow['Credit Amount (Two Column Approach)'] || '0');
      const invoiceNum = arCreditRow['Invoice Number'] || null;
      const dateAdded = parseCSVDate(arCreditRow['Transaction Date Added']);

      // Detect payment method from the other account
      const otherAccount = arCreditRow['Other Accounts for this Transaction'] || '';
      const methodName = detectPaymentMethod(otherAccount);

      const desc = arCreditRow['Transaction Description'] || '';

      payments.push({
        txnId,
        customerName: customer,
        amount,
        paymentDate: dateAdded,
        methodName,
        invoiceNumber: invoiceNum,
        notes: `QB Import: ${desc}`.substring(0, 500),
      });
    }
  }

  console.log(`\nParsed:`);
  console.log(`  Invoices: ${invoices.length}`);
  console.log(`  Payments: ${payments.length}`);
  console.log(`  Unique customers: ${customerNames.size}`);
  console.log(`  Layaway invoices: ${invoices.filter(i => i.isLayaway).length}`);

  if (dryRun) {
    console.log('\n--- DRY RUN --- No data will be written.');
    console.log('\nSample invoices (first 5):');
    for (const inv of invoices.slice(0, 5)) {
      console.log(`  ${inv.externalInvoiceNumber} | ${inv.customerName} | $${inv.amount} | Items: ${inv.items.length} | Layaway: ${inv.isLayaway}`);
    }
    console.log('\nSample payments (first 5):');
    for (const pay of payments.slice(0, 5)) {
      console.log(`  ${pay.invoiceNumber || 'N/A'} | ${pay.customerName} | $${pay.amount} | ${pay.methodName}`);
    }

    // Sample layaway parse
    const sampleLayaway = invoices.find(i => i.layawayMemo);
    if (sampleLayaway) {
      console.log('\nSample layaway memo parse:');
      const plan = parseLayawayMemo(sampleLayaway.layawayMemo!);
      console.log(`  Months: ${plan?.months}, Frequency: ${plan?.paymentFrequency}, Down: $${plan?.downPayment}`);
      console.log(`  Installments: ${plan?.installments.length || 0}`);
      if (plan?.installments.length) {
        for (const inst of plan.installments.slice(0, 3)) {
          console.log(`    ${inst.label} - $${inst.amount} due ${inst.dueDate.toLocaleDateString()} ${inst.isPaid ? '(PAID)' : ''}`);
        }
      }
    }

    await prisma.$disconnect();
    return;
  }

  // === ACTUAL IMPORT ===
  console.log('\nStarting import...');

  // Step 1: Create customers
  console.log('\n1. Creating customers...');
  const customerMap = new Map<string, number>(); // name -> id
  let customerCount = 0;

  for (const name of customerNames) {
    const existing = await prisma.customer.findFirst({ where: { name } });
    if (existing) {
      customerMap.set(name, existing.id);
    } else {
      const created = await prisma.customer.create({ data: { name } });
      customerMap.set(name, created.id);
      customerCount++;
    }
  }
  console.log(`  Created ${customerCount} customers (${customerNames.size - customerCount} already existed)`);

  // Step 2: Get payment methods
  const allMethods = await prisma.paymentMethodEntry.findMany();
  const methodMap = new Map(allMethods.map(m => [m.name.toLowerCase(), m.id]));

  // Ensure all needed methods exist
  for (const pay of payments) {
    const key = pay.methodName.toLowerCase();
    if (!methodMap.has(key)) {
      const created = await prisma.paymentMethodEntry.create({
        data: { name: pay.methodName, sortOrder: allMethods.length + methodMap.size + 1 },
      });
      methodMap.set(key, created.id);
      console.log(`  Created missing payment method: ${pay.methodName}`);
    }
  }

  // Step 3: Generate invoice numbers and create invoices
  console.log('\n2. Creating invoices...');
  let invoiceCount = 0;
  let layawayCount = 0;
  const invoiceNumberMap = new Map<string, number>(); // externalInvoiceNumber -> invoiceId

  // Get the current max invoice sequence number across all years
  const allInvNums = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: 'INV-' } },
    select: { invoiceNumber: true },
  });
  let nextInvNum = 1;
  for (const inv of allInvNums) {
    const parts = inv.invoiceNumber.split('-');
    const num = parseInt(parts[2] || '0');
    if (num >= nextInvNum) nextInvNum = num + 1;
  }

  let skippedInvoices = 0;
  let failedInvoices = 0;

  for (const inv of invoices) {
    // Skip if external number already imported
    if (inv.externalInvoiceNumber) {
      const existing = await prisma.invoice.findUnique({
        where: { externalInvoiceNumber: inv.externalInvoiceNumber },
      });
      if (existing) {
        invoiceNumberMap.set(inv.externalInvoiceNumber, existing.id);
        skippedInvoices++;
        continue;
      }
    }

    const year = inv.createdAt.getFullYear();
    const invoiceNumber = `INV-${year}-${nextInvNum.toString().padStart(4, '0')}`;
    nextInvNum++;

    const subtotal = inv.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    try {
      const created = await prisma.invoice.create({
        data: {
          userId,
          invoiceNumber,
          clientName: inv.customerName,
          customerId: customerMap.get(inv.customerName) || null,
          externalInvoiceNumber: inv.externalInvoiceNumber || null,
          source: 'quickbooks_import',
          items: inv.items,
          subtotal,
          tax: 0,
          discount: 0,
          amount: inv.amount,
          paidAmount: 0,
          dueDate: inv.dueDate,
          createdAt: inv.createdAt,
          status: 'pending',
          isLayaway: inv.isLayaway,
        },
      });

      if (inv.externalInvoiceNumber) {
        invoiceNumberMap.set(inv.externalInvoiceNumber, created.id);
      }
      invoiceCount++;

      // Create layaway plan if applicable
      if (inv.isLayaway && inv.layawayMemo) {
        const planData = parseLayawayMemo(inv.layawayMemo);
        if (planData) {
          await prisma.layawayPlan.create({
            data: {
              invoiceId: created.id,
              months: planData.months,
              paymentFrequency: planData.paymentFrequency,
              downPayment: planData.downPayment,
              isCancelled: planData.isCancelled,
              installments: {
                create: planData.installments.map(inst => ({
                  dueDate: inst.dueDate,
                  amount: inst.amount,
                  label: inst.label,
                  isPaid: inst.isPaid,
                  paidDate: inst.paidDate,
                  paidAmount: inst.paidAmount,
                })),
              },
            },
          });
          layawayCount++;
        }
      }
    } catch (err: any) {
      failedInvoices++;
      if (failedInvoices <= 10) {
        console.error(`  Failed invoice ${inv.externalInvoiceNumber || 'unknown'}: ${err.message}`);
      }
    }

    if ((invoiceCount + skippedInvoices) % 500 === 0) {
      console.log(`  ...${invoiceCount} created, ${skippedInvoices} skipped`);
    }
  }
  console.log(`  Created ${invoiceCount} invoices (${layawayCount} with layaway plans), ${skippedInvoices} skipped, ${failedInvoices} failed`);

  // Step 4: Create payments
  console.log('\n3. Creating payments...');
  let paymentCount = 0;
  let matchedCount = 0;

  let failedPayments = 0;

  for (const pay of payments) {
    const methodId = methodMap.get(pay.methodName.toLowerCase()) || methodMap.get('cash')!;

    // Try to match to invoice
    let invoiceId: number | null = null;
    if (pay.invoiceNumber && invoiceNumberMap.has(pay.invoiceNumber)) {
      invoiceId = invoiceNumberMap.get(pay.invoiceNumber)!;
      matchedCount++;
    }

    try {
      await prisma.payment.create({
        data: {
          userId,
          invoiceId,
          amount: pay.amount,
          paymentDate: pay.paymentDate,
          methodId,
          notes: pay.notes,
          isMatched: !!invoiceId,
          source: 'quickbooks_import',
        },
      });
      paymentCount++;
    } catch (err: any) {
      failedPayments++;
      if (failedPayments <= 10) {
        console.error(`  Failed payment for invoice ${pay.invoiceNumber || 'unknown'}: ${err.message}`);
      }
    }

    if (paymentCount % 1000 === 0) {
      console.log(`  ...${paymentCount} payments created`);
    }
  }
  console.log(`  Created ${paymentCount} payments (${matchedCount} matched to invoices), ${failedPayments} failed`);

  // Step 5: Update invoice paid amounts
  console.log('\n4. Updating invoice paid amounts...');
  const invoiceIds = [...new Set(invoiceNumberMap.values())];
  let updateCount = 0;

  for (const invId of invoiceIds) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invId },
      include: { payments: true, paymentMatches: true },
    });

    if (!invoice) continue;

    const directPayments = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const matchedPayments = invoice.paymentMatches.reduce((sum, m) => sum + Number(m.amount), 0);
    const totalPaid = directPayments + matchedPayments;
    const invoiceAmount = Number(invoice.amount);

    let status: 'paid' | 'pending' | 'overdue' | 'partial' = 'pending';
    const remaining = invoiceAmount - totalPaid;

    if (remaining <= 0.01) {
      status = 'paid';
    } else if (totalPaid > 0.01 && remaining > 0.01) {
      status = 'partial';
    } else if (totalPaid < 0.01 && invoice.dueDate < new Date()) {
      status = 'overdue';
    }

    await prisma.invoice.update({
      where: { id: invId },
      data: { paidAmount: totalPaid, status },
    });

    updateCount++;
    if (updateCount % 500 === 0) {
      console.log(`  ...${updateCount} invoices updated`);
    }
  }
  console.log(`  Updated ${updateCount} invoice statuses`);

  // Summary
  console.log('\n=== Import Complete ===');
  console.log(`Customers: ${customerCount} created`);
  console.log(`Invoices: ${invoiceCount} created (${layawayCount} layaway)`);
  console.log(`Payments: ${paymentCount} created (${matchedCount} matched)`);
  console.log(`Statuses updated: ${updateCount}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Import failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
