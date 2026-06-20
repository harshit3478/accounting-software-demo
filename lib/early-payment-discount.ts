import prisma from "./prisma";
import { Prisma } from "@prisma/client";
import { stampPaymentCode } from "./payment-code";
import {
  calculateEarlyPaymentDiscountAmount,
  checkEarlyPaymentDiscountEligibility,
  daysBetween,
  EarlyPaymentDiscountSettingSnapshot,
  EarlyPaymentThreshold,
  isEarlyPaymentDiscountConfigured,
  roundMoney,
} from "./early-payment-discount-shared";

export type {
  EarlyPaymentDiscountSettingSnapshot,
  EarlyPaymentEligibilityInput,
  EarlyPaymentEligibilityResult,
  EarlyPaymentThreshold,
} from "./early-payment-discount-shared";

export {
  calculateEarlyPaymentDiscountAmount,
  checkEarlyPaymentDiscountEligibility,
  isEarlyPaymentDiscountConfigured,
  roundMoney,
};

const DEFAULT_SETTING: EarlyPaymentDiscountSettingSnapshot = {
  daysWindow: 0,
  discountPercent: 0,
  paymentThreshold: "full",
  isActive: false,
};

export async function getEarlyPaymentDiscountSettingSnapshot(): Promise<EarlyPaymentDiscountSettingSnapshot> {
  const model = (prisma as any)?.earlyPaymentDiscountSetting;
  if (!model) {
    return DEFAULT_SETTING;
  }

  const row = await model.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!row) {
    return DEFAULT_SETTING;
  }

  const threshold =
    row.paymentThreshold === "half"
      ? "half"
      : ("full" as EarlyPaymentThreshold);

  return {
    daysWindow: Number(row.daysWindow ?? 0),
    discountPercent: Number(row.discountPercent ?? 0),
    paymentThreshold: threshold,
    isActive: !!row.isActive,
  };
}

function getLatestPaymentDate(invoice: {
  payments: Array<{ paymentDate: Date; source?: string | null }>;
  paymentMatches?: Array<{ payment: { paymentDate: Date } | null }>;
}): Date | null {
  const dates: Date[] = [];

  for (const payment of invoice.payments) {
    if (payment.source === "store_credit_applied") continue;
    dates.push(new Date(payment.paymentDate));
  }

  for (const match of invoice.paymentMatches || []) {
    if (match.payment?.paymentDate) {
      dates.push(new Date(match.payment.paymentDate));
    }
  }

  if (dates.length === 0) return null;

  return dates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest,
  );
}

export async function creditEarlyDiscountOverpaymentAsStoreCredit(input: {
  customerId: number;
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  methodId: number;
  userId: number;
}): Promise<number> {
  const safeAmount = roundMoney(input.amount);
  if (safeAmount <= 0.01) {
    return 0;
  }

  await prisma.$transaction(async (tx) => {
    const creditPayment = await tx.payment.create({
      data: {
        invoiceId: null,
        amount: safeAmount,
        paymentDate: new Date(),
        methodId: input.methodId,
        notes: `Store credit from early payment discount on ${input.invoiceNumber}`,
        userId: input.userId,
        isMatched: false,
        source: "store_credit_excess",
      },
    });

    await stampPaymentCode(tx, creditPayment.id);

    await tx.customer.update({
      where: { id: input.customerId },
      data: {
        storeCredit: {
          increment: safeAmount,
        },
      },
    });

    await (tx as any).customerCreditTransaction.create({
      data: {
        customerId: input.customerId,
        amount: safeAmount,
        type: "credit",
        reason: `Early payment discount overpayment on ${input.invoiceNumber}`,
        paymentId: creditPayment.id,
        invoiceId: input.invoiceId,
        createdById: null,
      },
    });
  });

  return safeAmount;
}

export async function maybeApplyEarlyPaymentDiscount(
  tx: any,
  input: {
    invoice: {
      id: number;
      invoiceNumber: string;
      amount: Prisma.Decimal | number;
      paidAmount: Prisma.Decimal | number;
      earlyPaymentDiscount: Prisma.Decimal | number;
      status: string;
      isLayaway?: boolean;
      invoiceDate: Date;
      createdAt: Date;
      payments: Array<{ paymentDate: Date; source?: string | null }>;
      paymentMatches?: Array<{ payment: { paymentDate: Date } | null }>;
    };
    totalPaid: number;
    setting?: EarlyPaymentDiscountSettingSnapshot;
  },
): Promise<number | null> {
  const setting =
    input.setting ?? (await getEarlyPaymentDiscountSettingSnapshot());

  if (!isEarlyPaymentDiscountConfigured(setting)) {
    return null;
  }

  const invoice = input.invoice;
  if (invoice.isLayaway) {
    return null;
  }

  if (invoice.status === "abandoned" || invoice.status === "inactive") {
    return null;
  }

  const existingDiscount = Number(
    invoice.earlyPaymentDiscount?.toNumber?.() ??
      invoice.earlyPaymentDiscount ??
      0,
  );
  if (existingDiscount > 0) {
    return null;
  }

  const invoiceAmount = Number(
    invoice.amount?.toNumber?.() ?? invoice.amount ?? 0,
  );
  if (invoiceAmount <= 0) {
    return null;
  }

  const discountAmount = calculateEarlyPaymentDiscountAmount(
    invoiceAmount,
    setting.discountPercent,
  );
  if (discountAmount <= 0) {
    return null;
  }

  const thresholdAmount =
    setting.paymentThreshold === "half"
      ? roundMoney(invoiceAmount / 2)
      : roundMoney(Math.max(invoiceAmount - discountAmount, 0));

  if (input.totalPaid + 0.01 < thresholdAmount) {
    return null;
  }

  const invoiceStartDate = new Date(invoice.invoiceDate || invoice.createdAt);
  const latestPaymentDate = getLatestPaymentDate(invoice);
  if (!latestPaymentDate) {
    return null;
  }

  if (daysBetween(invoiceStartDate, latestPaymentDate) > setting.daysWindow) {
    return null;
  }

  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      earlyPaymentDiscount: discountAmount,
      amount: roundMoney(Math.max(invoiceAmount - discountAmount, 0)),
    },
  });

  return discountAmount;
}
