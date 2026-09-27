import type { Prisma, PrismaClient } from "@prisma/client";
import { formatUserDisplayName } from "./user-display";

const APPROVAL_NOTE = /^Cheque vault #(\d+) ·/;

export function chequeVaultIdFromApprovalPaymentNotes(
  notes: string | null | undefined,
): number | null {
  if (!notes) return null;
  const match = APPROVAL_NOTE.exec(notes);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function chequeVaultApprovalNotePrefix(chequeId: number): string {
  return `Cheque vault #${chequeId} ·`;
}

export function chequeVaultStoreCreditNotePrefix(chequeId: number): string {
  return `Store credit from unallocated cheque vault #${chequeId} ·`;
}

/**
 * The cheque is fully abandoned only when every payment created from it
 * is abandoned. A split cheque stays approved until the last piece is abandoned.
 */
export function rejectionReasonWithAbandoner(
  reason: string,
  abandonedByName: string,
): string {
  const trimmedReason = reason.trim();
  const name = abandonedByName.trim() || "Unknown";
  return `${trimmedReason} Payment abandoned by ${name}.`;
}

export function isChequeFullyAbandoned(input: {
  chequeStatus: string;
  payments: Array<{ isAbandoned: boolean }>;
}): boolean {
  if (input.chequeStatus !== "APPROVED") return false;
  if (input.payments.length === 0) return false;
  return input.payments.every((payment) => payment.isAbandoned);
}

export async function previewChequeRejectionOnAbandon(
  tx: Prisma.TransactionClient | PrismaClient,
  input: {
    paymentId: number;
    paymentSource: string | null;
    paymentNotes: string | null;
    abandonedByName: string;
  },
): Promise<string | null> {
  if (input.paymentSource !== "cheque_vault") return null;

  const chequeId = chequeVaultIdFromApprovalPaymentNotes(input.paymentNotes);
  if (!chequeId) return null;

  const cheque = await tx.chequeVault.findUnique({
    where: { id: chequeId },
    select: { id: true, status: true, chequeNumber: true },
  });
  if (!cheque) return null;

  const payments = await tx.payment.findMany({
    where: paymentsFromChequeWhere(chequeId),
    select: { id: true, isAbandoned: true },
  });

  const afterAbandon = payments.map((payment) => ({
    isAbandoned: payment.isAbandoned || payment.id === input.paymentId,
  }));

  if (
    !isChequeFullyAbandoned({
      chequeStatus: cheque.status,
      payments: afterAbandon,
    })
  ) {
    return null;
  }

  const name = input.abandonedByName.trim() || "Unknown";
  return `Cheque #${cheque.chequeNumber} will be rejected with this same reason, and it will show the payment was abandoned by ${name}.`;
}

function paymentsFromChequeWhere(chequeId: number) {
  return {
    OR: [
      {
        source: "cheque_vault",
        notes: { startsWith: chequeVaultApprovalNotePrefix(chequeId) },
      },
      {
        source: "store_credit_excess",
        notes: { startsWith: chequeVaultStoreCreditNotePrefix(chequeId) },
      },
    ],
  };
}

export async function rejectChequeVaultWhenPaymentFullyAbandoned(
  tx: Prisma.TransactionClient,
  input: {
    paymentSource: string | null;
    paymentNotes: string | null;
    reason: string;
    userId: number;
    abandonedByName: string;
  },
): Promise<{ rejectedChequeId: number | null }> {
  if (input.paymentSource !== "cheque_vault") {
    return { rejectedChequeId: null };
  }

  const chequeId = chequeVaultIdFromApprovalPaymentNotes(input.paymentNotes);
  if (!chequeId) {
    return { rejectedChequeId: null };
  }

  const reason = input.reason.trim();
  if (!reason) {
    return { rejectedChequeId: null };
  }

  const cheque = await tx.chequeVault.findUnique({
    where: { id: chequeId },
    select: { id: true, status: true },
  });

  if (!cheque) {
    return { rejectedChequeId: null };
  }

  const payments = await tx.payment.findMany({
    where: paymentsFromChequeWhere(chequeId),
    select: { isAbandoned: true },
  });

  if (!isChequeFullyAbandoned({ chequeStatus: cheque.status, payments })) {
    return { rejectedChequeId: null };
  }

  await tx.chequeVault.update({
    where: { id: chequeId },
    data: {
      status: "REJECTED",
      rejectionReason: rejectionReasonWithAbandoner(
        reason,
        input.abandonedByName,
      ),
      rejectedById: input.userId,
      rejectedAt: new Date(),
    },
  });

  await tx.chequeVaultInvoice.deleteMany({
    where: { chequeVaultId: chequeId },
  });

  return { rejectedChequeId: chequeId };
}
