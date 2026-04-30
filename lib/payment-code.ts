export function formatPaymentCode(paymentId: number): string {
  return `PAY-${String(paymentId).padStart(6, "0")}`;
}

export async function stampPaymentCode(tx: any, paymentId: number) {
  const paymentCode = formatPaymentCode(paymentId);
  await tx.payment.update({
    where: { id: paymentId },
    data: { paymentCode },
  });
  return paymentCode;
}
