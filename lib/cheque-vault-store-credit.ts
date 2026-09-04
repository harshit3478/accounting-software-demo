import { Prisma } from "@prisma/client";
import { findCustomerByEmail } from "@/lib/customer-email";
import { roundMoney } from "@/lib/early-payment-discount-shared";
import { stampPaymentCode } from "@/lib/payment-code";

type CustomerEmailClient = Pick<Prisma.TransactionClient, "customer">;

export type ChequeVaultInvoiceCustomerRef = {
  customerId: number | null;
};

export class ChequeVaultCustomerResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChequeVaultCustomerResolutionError";
  }
}

export async function resolveChequeVaultCustomer(
  prismaClient: CustomerEmailClient,
  invoices: ChequeVaultInvoiceCustomerRef[],
  chequeCustomerEmail: string | null,
): Promise<number | null> {
  const customerIds = [
    ...new Set(
      invoices
        .map((invoice) => invoice.customerId)
        .filter((id): id is number => id != null),
    ),
  ];

  if (customerIds.length > 1) {
    throw new ChequeVaultCustomerResolutionError(
      "Linked invoices belong to different customers. Select which customer should receive the store credit.",
    );
  }

  if (customerIds.length === 1) {
    return customerIds[0];
  }

  if (chequeCustomerEmail) {
    const customer = await findCustomerByEmail(prismaClient, chequeCustomerEmail, {
      id: true,
    });
    return customer?.id ?? null;
  }

  return null;
}

export function getChequeVaultUnallocatedAmount(
  chequeAmount: number,
  allocations: { allocatedAmount: number | Prisma.Decimal }[],
): number {
  const totalAllocated = allocations.reduce(
    (sum, allocation) => sum + Number(allocation.allocatedAmount),
    0,
  );
  return roundMoney(chequeAmount - totalAllocated);
}

export function getChequeVaultRemainingStoreCreditAmount(
  chequeAmount: number,
  allocations: { allocatedAmount: number | Prisma.Decimal }[],
  storeCreditMoves: { amount: number | Prisma.Decimal }[],
): number {
  const unallocated = getChequeVaultUnallocatedAmount(chequeAmount, allocations);
  const alreadyMoved = storeCreditMoves.reduce(
    (sum, move) => sum + Number(move.amount),
    0,
  );
  return roundMoney(Math.max(unallocated - alreadyMoved, 0));
}

export async function recordChequeVaultExcessAsStoreCredit(
  tx: Prisma.TransactionClient,
  input: {
    chequeId: number;
    chequeNumber: string;
    chequeDate: Date;
    excessAmount: number;
    customerId: number;
    methodId: number;
    userId: number;
    movedByName: string;
    notes: string;
  },
): Promise<{ paymentId: number; paymentRef: string; moveId: number }> {
  const excessAmount = roundMoney(input.excessAmount);
  if (excessAmount <= 0.01) {
    throw new Error("Store credit amount must be greater than 0");
  }

  const notes = input.notes.trim();
  if (!notes) {
    throw new Error("Notes are required when moving amount to store credit");
  }

  const creditPayment = await tx.payment.create({
    data: {
      invoiceId: null,
      customerId: input.customerId,
      amount: excessAmount,
      paymentDate: input.chequeDate,
      methodId: input.methodId,
      notes: `Store credit from unallocated cheque vault #${input.chequeId} · Cheque #${input.chequeNumber} · Moved by ${input.movedByName} · ${notes}`,
      userId: input.userId,
      isMatched: false,
      source: "store_credit_excess",
    },
  });

  const paymentRef = await stampPaymentCode(tx, creditPayment.id);

  await tx.customer.update({
    where: { id: input.customerId },
    data: {
      storeCredit: {
        increment: new Prisma.Decimal(excessAmount),
      },
    },
  });

  await tx.customerCreditTransaction.create({
    data: {
      customerId: input.customerId,
      amount: excessAmount,
      type: "credit",
      reason: `Unallocated amount from cheque vault #${input.chequeId} · Cheque #${input.chequeNumber} · ${notes}`,
      paymentId: creditPayment.id,
      createdById: input.userId,
    },
  });

  const move = await tx.chequeVaultStoreCreditMove.create({
    data: {
      chequeVaultId: input.chequeId,
      customerId: input.customerId,
      amount: excessAmount,
      notes,
      paymentId: creditPayment.id,
      movedById: input.userId,
    },
  });

  return {
    paymentId: creditPayment.id,
    paymentRef,
    moveId: move.id,
  };
}
