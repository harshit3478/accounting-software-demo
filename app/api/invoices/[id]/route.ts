import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import { invalidateDashboard } from "../../../../lib/cache-helpers";
import { calculateInvoiceStatus } from "../../../../lib/invoice-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const {
      clientName,
      customerId,
      items,
      subtotal,
      tax,
      discount,
      dueDate,
      description,
      isLayaway,
      editReason,
    } = await request.json();

    const reason = typeof editReason === "string" ? editReason.trim() : "";
    if (!reason) {
      return NextResponse.json(
        { error: "Edit reason is required" },
        { status: 400 },
      );
    }

    const { id } = await params;
    const invoiceId = parseInt(id);

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Calculate total amount
    const taxAmount = tax || 0;
    const discountAmount = discount || 0;
    const totalAmount =
      parseFloat(subtotal) + parseFloat(taxAmount) - parseFloat(discountAmount);

    const nextData = {
      clientName,
      items: items as any,
      subtotal: parseFloat(subtotal),
      tax: parseFloat(taxAmount),
      discount: parseFloat(discountAmount),
      amount: totalAmount,
      dueDate: new Date(dueDate),
      description,
      isLayaway: isLayaway || false,
      customerId: customerId !== undefined ? customerId || null : undefined,
    };

    const changes: Record<string, { from: any; to: any }> = {};
    const trackChange = (key: string, fromValue: any, toValue: any) => {
      const fromSerialized =
        fromValue instanceof Date ? fromValue.toISOString() : fromValue;
      const toSerialized =
        toValue instanceof Date ? toValue.toISOString() : toValue;
      if (JSON.stringify(fromSerialized) !== JSON.stringify(toSerialized)) {
        changes[key] = { from: fromSerialized, to: toSerialized };
      }
    };

    trackChange("clientName", existingInvoice.clientName, nextData.clientName);
    trackChange("items", existingInvoice.items, nextData.items);
    trackChange(
      "subtotal",
      existingInvoice.subtotal.toNumber(),
      nextData.subtotal,
    );
    trackChange("tax", existingInvoice.tax.toNumber(), nextData.tax);
    trackChange(
      "discount",
      existingInvoice.discount.toNumber(),
      nextData.discount,
    );
    trackChange("amount", existingInvoice.amount.toNumber(), nextData.amount);
    trackChange("dueDate", existingInvoice.dueDate, nextData.dueDate);
    trackChange(
      "description",
      existingInvoice.description || null,
      nextData.description || null,
    );
    trackChange("isLayaway", existingInvoice.isLayaway, nextData.isLayaway);
    trackChange(
      "customerId",
      existingInvoice.customerId || null,
      nextData.customerId || null,
    );

    const invoice = await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: nextData,
      });

      await (tx as any).invoiceEditHistory.create({
        data: {
          invoiceId,
          editedById: user.id,
          reason,
          changes: Object.keys(changes).length > 0 ? changes : null,
        },
      });

      return updated;
    });

    // Convert Decimal to number for response
    const serializedInvoice = {
      ...invoice,
      subtotal: invoice.subtotal.toNumber(),
      tax: invoice.tax.toNumber(),
      discount: invoice.discount.toNumber(),
      amount: invoice.amount.toNumber(),
      paidAmount: invoice.paidAmount.toNumber(),
    };

    // Invalidate dashboard cache
    invalidateDashboard();

    return NextResponse.json(serializedInvoice);
  } catch (error: any) {
    console.error("Update invoice error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body?.editReason === "string" ? body.editReason.trim() : "";
    if (!reason) {
      return NextResponse.json(
        { error: "Edit reason is required" },
        { status: 400 },
      );
    }

    const { id } = await params;
    const invoiceId = parseInt(id);

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const requestedTargetStatus = body?.targetStatus as
      | "inactive"
      | "abandoned"
      | "reactivate"
      | undefined;
    const paymentAction = body?.paymentAction as
      | "credit"
      | "transfer"
      | "none"
      | undefined;
    const targetInvoiceId =
      body?.targetInvoiceId === null ||
      body?.targetInvoiceId === undefined ||
      body?.targetInvoiceId === ""
        ? null
        : parseInt(String(body.targetInvoiceId), 10);

    let targetStatus:
      | "inactive"
      | "abandoned"
      | "paid"
      | "pending"
      | "overdue"
      | "partial";
    if (requestedTargetStatus === "reactivate") {
      targetStatus = calculateInvoiceStatus(
        existingInvoice.amount.toNumber(),
        existingInvoice.paidAmount.toNumber(),
        existingInvoice.dueDate,
      );
    } else if (
      requestedTargetStatus === "inactive" ||
      requestedTargetStatus === "abandoned"
    ) {
      targetStatus = requestedTargetStatus;
    } else {
      targetStatus =
        existingInvoice.status === "inactive" ||
        existingInvoice.status === "abandoned"
          ? calculateInvoiceStatus(
              existingInvoice.amount.toNumber(),
              existingInvoice.paidAmount.toNumber(),
              existingInvoice.dueDate,
            )
          : "abandoned";
    }

    let movedAmount = 0;
    let resolvedTargetInvoiceId: number | null = null;

    const updated = await prisma.$transaction(async (tx) => {
      if (targetStatus === "abandoned") {
        const directPayments = await tx.payment.findMany({
          where: { invoiceId },
          select: { id: true, amount: true },
        });

        const matchedPayments = await tx.paymentInvoiceMatch.findMany({
          where: { invoiceId },
          select: { id: true, paymentId: true, amount: true },
        });

        const directTotal = directPayments.reduce(
          (sum, p) => sum + p.amount.toNumber(),
          0,
        );
        const matchedTotal = matchedPayments.reduce(
          (sum, m) => sum + m.amount.toNumber(),
          0,
        );
        movedAmount = Math.round((directTotal + matchedTotal) * 100) / 100;

        if (movedAmount > 0.009) {
          if (!paymentAction || paymentAction === "none") {
            throw new Error(
              "This invoice has payments. Please choose how to handle them.",
            );
          }

          const affectedPaymentIds = new Set<number>([
            ...directPayments.map((p) => p.id),
            ...matchedPayments.map((m) => m.paymentId),
          ]);

          if (paymentAction === "credit") {
            if (!existingInvoice.customerId) {
              throw new Error(
                "Cannot move payments to credit because this invoice has no linked customer.",
              );
            }

            if (directPayments.length > 0) {
              await tx.payment.updateMany({
                where: { id: { in: directPayments.map((p) => p.id) } },
                data: { invoiceId: null },
              });
            }

            if (matchedPayments.length > 0) {
              await tx.paymentInvoiceMatch.deleteMany({
                where: { id: { in: matchedPayments.map((m) => m.id) } },
              });
            }

            await (tx as any).customer.update({
              where: { id: existingInvoice.customerId },
              data: {
                storeCredit: {
                  increment: movedAmount,
                },
              },
            });

            await (tx as any).customerCreditTransaction.create({
              data: {
                customerId: existingInvoice.customerId,
                amount: movedAmount,
                type: "credit",
                reason: `Payments moved from abandoned invoice ${existingInvoice.invoiceNumber}. ${reason}`,
                invoiceId,
                createdById: user.id,
              },
            });
          }

          if (paymentAction === "transfer") {
            if (!Number.isFinite(targetInvoiceId as number)) {
              throw new Error("Target invoice is required for transfer.");
            }

            const target = await tx.invoice.findUnique({
              where: { id: targetInvoiceId as number },
              select: { id: true, customerId: true, status: true },
            });

            if (!target) {
              throw new Error("Target invoice not found.");
            }
            if (target.id === invoiceId) {
              throw new Error(
                "Target invoice must be different from the abandoned invoice.",
              );
            }
            if (
              !existingInvoice.customerId ||
              target.customerId !== existingInvoice.customerId
            ) {
              throw new Error(
                "Target invoice must belong to the same customer.",
              );
            }
            if (target.status === "inactive" || target.status === "abandoned") {
              throw new Error(
                "Target invoice cannot be inactive or abandoned.",
              );
            }

            resolvedTargetInvoiceId = target.id;

            if (directPayments.length > 0) {
              await tx.payment.updateMany({
                where: { id: { in: directPayments.map((p) => p.id) } },
                data: { invoiceId: target.id, isMatched: true },
              });
            }

            for (const match of matchedPayments) {
              const existingTargetMatch =
                await tx.paymentInvoiceMatch.findUnique({
                  where: {
                    paymentId_invoiceId: {
                      paymentId: match.paymentId,
                      invoiceId: target.id,
                    },
                  },
                });

              if (existingTargetMatch) {
                await tx.paymentInvoiceMatch.update({
                  where: { id: existingTargetMatch.id },
                  data: {
                    amount: {
                      increment: match.amount,
                    },
                  },
                });
                await tx.paymentInvoiceMatch.delete({
                  where: { id: match.id },
                });
              } else {
                await tx.paymentInvoiceMatch.update({
                  where: { id: match.id },
                  data: { invoiceId: target.id },
                });
              }
            }
          }

          for (const pid of affectedPaymentIds) {
            const payment = await tx.payment.findUnique({
              where: { id: pid },
              include: { paymentMatches: true },
            });
            if (!payment) continue;

            const shouldBeMatched =
              !!payment.invoiceId || payment.paymentMatches.length > 0;
            if (payment.isMatched !== shouldBeMatched) {
              await tx.payment.update({
                where: { id: pid },
                data: { isMatched: shouldBeMatched },
              });
            }
          }
        }
      }

      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: targetStatus,
          ...(targetStatus === "abandoned" ? { paidAmount: 0 } : {}),
        },
      });

      await (tx as any).invoiceEditHistory.create({
        data: {
          invoiceId,
          editedById: user.id,
          reason,
          changes: {
            status: {
              from: existingInvoice.status,
              to: targetStatus,
            },
            ...(targetStatus === "abandoned"
              ? {
                  paymentDisposition: {
                    from: "linked-to-invoice",
                    to: paymentAction || "none",
                  },
                  movedAmount: {
                    from: 0,
                    to: movedAmount,
                  },
                  ...(resolvedTargetInvoiceId
                    ? {
                        targetInvoiceId: {
                          from: null,
                          to: resolvedTargetInvoiceId,
                        },
                      }
                    : {}),
                }
              : {}),
          },
        },
      });

      return inv;
    });

    if (resolvedTargetInvoiceId) {
      await updateInvoiceAfterPayment(resolvedTargetInvoiceId);
    }

    // Invalidate dashboard cache
    invalidateDashboard();

    return NextResponse.json({
      message:
        updated.status === "inactive"
          ? "Invoice deactivated successfully"
          : updated.status === "abandoned"
            ? movedAmount > 0.009
              ? resolvedTargetInvoiceId
                ? "Invoice marked as abandoned and payments moved to selected invoice"
                : "Invoice marked as abandoned and payments added to customer store credit"
              : "Invoice marked as abandoned"
            : "Invoice reactivated successfully",
      status: updated.status,
      movedAmount,
      targetInvoiceId: resolvedTargetInvoiceId,
    });
  } catch (error: any) {
    console.error("Delete invoice error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
