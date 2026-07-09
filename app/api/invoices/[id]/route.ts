import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import { invalidateDashboard } from "../../../../lib/cache-helpers";
import { calculateInvoiceStatus } from "../../../../lib/invoice-utils";
import { updateInvoiceAfterPayment } from "../../../../lib/invoice-utils";
import { Prisma } from "@prisma/client";
import {
  formatPaymentCode,
  stampPaymentCode,
} from "../../../../lib/payment-code";
import {
  DEFAULT_LAYAWAY_FEE_RATES,
  calculateLayawayFeeFromItems,
  normalizeLayawayFeeRates,
} from "../../../../lib/layaway-fees";
import {
  calculateDepositFeeForItem,
  normalizeDepositFeeRules,
} from "../../../../lib/deposit-fees";
import {
  calculateRecalculationFeeAmount,
  getRecalculationFeeSettingSnapshot,
} from "../../../../lib/recalculation-fee";
import {
  canUseMigratedInvoiceEdit,
  getMigratedInvoiceEditSettingSnapshot,
} from "../../../../lib/migrated-invoice-edit";
import {
  isBeforeBusinessToday,
  isFutureBusinessDate,
  startOfBusinessDay,
} from "../../../../lib/business-date";
import { calculateRestockingFeeAmount } from "../../../../lib/restocking-fee";
import { buildLayawayInstallmentSchedule } from "../../../../lib/layaway-installments";
import { uploadToR2 } from "../../../../lib/r2-client";
import { allocatePaymentAmounts } from "../../../../lib/allocate-payment-amounts";

async function getConfiguredLayawayFeeRates() {
  const rateModel = (prisma as any)?.layawayFeeSetting;
  if (!rateModel) {
    return DEFAULT_LAYAWAY_FEE_RATES.map((rate) => ({
      ...rate,
      unitName: "grams",
    }));
  }

  try {
    const rows = await rateModel.findMany({
      orderBy: [{ sortOrder: "asc" }, { months: "asc" }],
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      return DEFAULT_LAYAWAY_FEE_RATES.map((rate) => ({
        ...rate,
        unitName: "grams",
      }));
    }

    return normalizeLayawayFeeRates(
      rows.map((row: any) => ({
        unitName: row.unitName || "grams",
        months: row.months,
        ratePerGram: row.ratePerGram?.toNumber
          ? row.ratePerGram.toNumber()
          : Number(row.ratePerGram),
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      })),
    );
  } catch {
    return DEFAULT_LAYAWAY_FEE_RATES;
  }
}

async function getConfiguredDepositFeeRules() {
  const ruleModel = (prisma as any)?.depositFeeRule;
  if (!ruleModel) {
    return [];
  }

  try {
    const rows = await ruleModel.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    return normalizeDepositFeeRules(
      rows.map((row: any) => ({
        unitName: row.unitName,
        ruleType: row.ruleType === "flat" ? "flat" : "range",
        minUnit: row.minUnit?.toNumber ? row.minUnit.toNumber() : row.minUnit,
        maxUnit: row.maxUnit?.toNumber ? row.maxUnit.toNumber() : row.maxUnit,
        fee: row.fee?.toNumber ? row.fee.toNumber() : Number(row.fee || 0),
        isPercentage: !!row.isPercentage,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      })),
    );
  } catch {
    return [];
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const {
      clientName,
      customerId,
      customerAddress,
      items,
      subtotal,
      tax,
      discount,
      shippingFee,
      insuranceAmount,
      invoiceDate,
      dueDate,
      dueDateReason,
      description,
      isLayaway,
      layawayPlan,
      termsId,
      newTerms,
      liveTypeId,
      isHold,
      editReason,
      recalculationFeeAction,
      removedItemDepositFeeAction,
      removedItemDepositFeeSkipReason,
      migratedInvoiceEdit,
    } = await request.json();

    const reason = typeof editReason === "string" ? editReason.trim() : "";
    if (!reason) {
      return NextResponse.json(
        { error: "Edit reason is required" },
        { status: 400 },
      );
    }
    const normalizedRecalculationFeeAction =
      recalculationFeeAction === "apply" || recalculationFeeAction === "skip"
        ? recalculationFeeAction
        : "none";
    const normalizedRemovedDepositFeeAction =
      removedItemDepositFeeAction === "apply" ||
      removedItemDepositFeeAction === "skip"
        ? removedItemDepositFeeAction
        : "none";
    const normalizedRemovedDepositFeeSkipReason =
      typeof removedItemDepositFeeSkipReason === "string"
        ? removedItemDepositFeeSkipReason.trim()
        : "";

    const { id } = await params;
    const invoiceId = parseInt(id, 10);

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invoiceIsLayaway =
      typeof isLayaway === "boolean" ? isLayaway : !!existingInvoice.isLayaway;
    const isMigratedInvoiceEdit =
      migratedInvoiceEdit === true && invoiceIsLayaway;

    if (migratedInvoiceEdit === true && !invoiceIsLayaway) {
      return NextResponse.json(
        {
          error: "Migrated invoice edit is only available for layaway invoices",
        },
        { status: 400 },
      );
    }

    if (isMigratedInvoiceEdit) {
      const migratedSetting = await getMigratedInvoiceEditSettingSnapshot();
      if (!canUseMigratedInvoiceEdit(user, migratedSetting)) {
        return NextResponse.json(
          { error: "Migrated invoice edit is not allowed" },
          { status: 403 },
        );
      }
    }

    const existingInvoiceAny = existingInvoice as any;
    const existingTermsId = existingInvoice.termsId ?? null;
    const existingTermsSnapshot = existingInvoiceAny.termsSnapshot ?? null;
    const existingLiveTypeId = existingInvoice.liveTypeId ?? null;
    const existingLiveTypeSnapshot =
      existingInvoiceAny.liveTypeSnapshot ?? null;
    const normalizedClientName =
      typeof clientName === "string"
        ? clientName.trim()
        : existingInvoice.clientName.trim();
    const normalizedCustomerAddress =
      typeof customerAddress === "string" ? customerAddress.trim() : "";

    if (!normalizedClientName) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 },
      );
    }

    if (customerId !== undefined && customerId !== null) {
      const parsedCustomerId = Number(customerId);
      if (!Number.isFinite(parsedCustomerId)) {
        return NextResponse.json(
          { error: "Invalid customer id" },
          { status: 400 },
        );
      }

      const existingCustomer = await prisma.customer.findUnique({
        where: { id: parsedCustomerId },
        select: { id: true, address: true },
      });

      if (!existingCustomer) {
        return NextResponse.json(
          { error: "Selected customer not found" },
          { status: 404 },
        );
      }

      if (!existingCustomer.address?.trim()) {
        if (!normalizedCustomerAddress) {
          return NextResponse.json(
            { error: "Customer address is required" },
            { status: 400 },
          );
        }

        await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: { address: normalizedCustomerAddress },
        });
      }
    }

    const invoiceDateValue = invoiceDate
      ? startOfBusinessDay(invoiceDate)
      : startOfBusinessDay(existingInvoice.createdAt);
    if (Number.isNaN(invoiceDateValue.getTime())) {
      return NextResponse.json(
        { error: "Invalid invoice date" },
        { status: 400 },
      );
    }

    if (isFutureBusinessDate(invoiceDateValue)) {
      return NextResponse.json(
        { error: "Invoice date cannot be in the future" },
        { status: 400 },
      );
    }

    let dueDateValue: Date;
    try {
      dueDateValue = startOfBusinessDay(dueDate);
    } catch {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const requiresDueDateReason = isBeforeBusinessToday(dueDateValue);

    const normalizedDueDateReason =
      typeof dueDateReason === "string" ? dueDateReason.trim() : "";
    if (requiresDueDateReason && !normalizedDueDateReason) {
      return NextResponse.json(
        { error: "Due date reason is required" },
        { status: 400 },
      );
    }

    // Calculate total amount
    const taxAmount = tax || 0;
    const discountAmount = discount || 0;
    const shippingFeeAmount =
      shippingFee !== undefined
        ? parseFloat(shippingFee)
        : existingInvoice.shippingFee.toNumber();
    const insuranceFeeAmount =
      insuranceAmount !== undefined && insuranceAmount !== null
        ? Number(insuranceAmount)
        : Number(existingInvoiceAny.insuranceAmount?.toNumber?.() ?? 0);
    const layawayFeeRates = await getConfiguredLayawayFeeRates();
    const layawayMonths = Number(layawayPlan?.months || 0);
    const existingLayawayFee = Number(
      existingInvoiceAny.layawayFee?.toNumber?.() ?? 0,
    );
    const layawayFeeAmount = isMigratedInvoiceEdit
      ? isLayaway
        ? existingLayawayFee
        : 0
      : isLayaway
        ? calculateLayawayFeeFromItems(
            items as any,
            layawayMonths || 3,
            layawayFeeRates,
          )
        : 0;
    const depositFeeRules = await getConfiguredDepositFeeRules();
    const existingItems = Array.isArray(existingInvoice.items)
      ? existingInvoice.items
      : [];

    const getItemKey = (item: any) =>
      [
        String(item?.name || "")
          .trim()
          .toLowerCase(),
        String(item?.unit || "")
          .trim()
          .toLowerCase(),
      ].join("|");

    const normalizedItems = Array.isArray(items)
      ? items.map((item: any, index: number) => {
          if (isMigratedInvoiceEdit) {
            const matchedExisting =
              existingItems[index] ??
              existingItems.find(
                (existingItem: any) =>
                  getItemKey(existingItem) === getItemKey(item),
              );
            return {
              ...item,
              depositFee: Number(
                (matchedExisting as any)?.depositFee ?? item.depositFee ?? 0,
              ),
            };
          }

          return {
            ...item,
            depositFee: calculateDepositFeeForItem(item, depositFeeRules),
          };
        })
      : items || null;

    const currentItemCounts = new Map<string, number>();
    if (Array.isArray(normalizedItems)) {
      for (const item of normalizedItems) {
        const key = getItemKey(item);
        currentItemCounts.set(key, (currentItemCounts.get(key) || 0) + 1);
      }
    }

    const removedDepositFeeItems = Array.isArray(existingInvoice.items)
      ? existingInvoice.items.filter((item: any) => {
          const key = getItemKey(item);
          const count = currentItemCounts.get(key) || 0;
          if (count > 0) {
            currentItemCounts.set(key, count - 1);
            return false;
          }
          return Number(item?.depositFee || 0) > 0;
        })
      : [];
    const removedItemDepositFeeAmount = Number(
      removedDepositFeeItems
        .reduce(
          (sum: number, item: any) => sum + Number(item?.depositFee || 0),
          0,
        )
        .toFixed(2),
    );

    if (
      !isMigratedInvoiceEdit &&
      removedItemDepositFeeAmount > 0 &&
      normalizedRemovedDepositFeeAction === "none"
    ) {
      return NextResponse.json(
        { error: "Choose whether to apply removed item deposit fee." },
        { status: 400 },
      );
    }

    if (
      !isMigratedInvoiceEdit &&
      removedItemDepositFeeAmount > 0 &&
      normalizedRemovedDepositFeeAction === "skip" &&
      !normalizedRemovedDepositFeeSkipReason
    ) {
      return NextResponse.json(
        { error: "Reason is required when skipping removed item deposit fee." },
        { status: 400 },
      );
    }

    const appliedRemovedItemDepositFee = isMigratedInvoiceEdit
      ? 0
      : normalizedRemovedDepositFeeAction === "apply"
        ? removedItemDepositFeeAmount
        : 0;

    const totalAmount =
      parseFloat(subtotal) +
      parseFloat(taxAmount) -
      parseFloat(discountAmount) +
      shippingFeeAmount +
      insuranceFeeAmount +
      layawayFeeAmount +
      appliedRemovedItemDepositFee;
    const paidAmount = Number(existingInvoiceAny.paidAmount?.toNumber?.() ?? 0);

    let resolvedTermsId: number | null = existingTermsId;
    let resolvedTermsSnapshot: any = existingTermsSnapshot;
    let resolvedLiveTypeId: number | null = existingLiveTypeId;
    let resolvedLiveTypeSnapshot: string | null = existingLiveTypeSnapshot;

    if (termsId !== undefined) {
      if (termsId === null) {
        resolvedTermsId = null;
        resolvedTermsSnapshot = null;
      } else {
        const parsedTermsId = Number(termsId);
        if (!Number.isFinite(parsedTermsId)) {
          return NextResponse.json(
            { error: "Invalid terms id" },
            { status: 400 },
          );
        }

        const found = await (prisma as any).term.findUnique({
          where: { id: parsedTermsId },
        });

        if (!found) {
          return NextResponse.json(
            { error: "Selected terms not found" },
            { status: 404 },
          );
        }

        resolvedTermsId = found.id;
        resolvedTermsSnapshot = found.lines;
      }
    } else if (Array.isArray(newTerms) && newTerms.length > 0) {
      const lines = newTerms
        .map((line: any) => String(line || "").trim())
        .filter(Boolean)
        .slice(0, 5);

      if (lines.length > 0) {
        const createdTerm = await (prisma as any).term.create({
          data: { lines, createdBy: user.id },
        });
        resolvedTermsId = createdTerm.id;
        resolvedTermsSnapshot = createdTerm.lines;
      }
    }

    if (liveTypeId !== undefined) {
      if (liveTypeId === null) {
        resolvedLiveTypeId = null;
        resolvedLiveTypeSnapshot = null;
      } else {
        const parsedLiveTypeId = Number(liveTypeId);
        if (!Number.isFinite(parsedLiveTypeId)) {
          return NextResponse.json(
            { error: "Invalid live type id" },
            { status: 400 },
          );
        }

        const foundLiveType = await (prisma as any).liveType.findUnique({
          where: { id: parsedLiveTypeId },
        });

        if (!foundLiveType) {
          return NextResponse.json(
            { error: "Selected live type not found" },
            { status: 404 },
          );
        }

        resolvedLiveTypeId = foundLiveType.id;
        resolvedLiveTypeSnapshot = `${foundLiveType.name} (${foundLiveType.country})`;
      }
    }

    let resolvedCustomerId: number | null =
      customerId !== undefined
        ? customerId || null
        : existingInvoice.customerId || null;

    if (
      resolvedCustomerId !== null &&
      resolvedCustomerId !== undefined &&
      Number.isFinite(Number(resolvedCustomerId))
    ) {
      const parsedCustomerId = Number(resolvedCustomerId);
      const existingCustomer = await prisma.customer.findUnique({
        where: { id: parsedCustomerId },
        select: { id: true },
      });

      if (!existingCustomer) {
        return NextResponse.json(
          { error: "Selected customer not found" },
          { status: 404 },
        );
      }

      resolvedCustomerId = parsedCustomerId;
    }

    if (resolvedCustomerId === null) {
      const matchedByName = await prisma.customer.findFirst({
        where: { name: normalizedClientName },
        select: { id: true },
      });

      if (matchedByName) {
        resolvedCustomerId = matchedByName.id;
      } else {
        const createdCustomer = await prisma.customer.create({
          data: { name: normalizedClientName },
          select: { id: true },
        });
        resolvedCustomerId = createdCustomer.id;
      }
    }

    const nextData = {
      clientName: normalizedClientName,
      items: normalizedItems as any,
      subtotal: parseFloat(subtotal),
      tax: parseFloat(taxAmount),
      discount: parseFloat(discountAmount),
      shippingFee: shippingFeeAmount,
      insuranceAmount: insuranceFeeAmount,
      layawayFee: layawayFeeAmount,
      amount: totalAmount,
      invoiceDate: invoiceDateValue,
      dueDate: dueDateValue,
      dueDateReason: requiresDueDateReason ? normalizedDueDateReason : null,
      description,
      isLayaway: isLayaway || false,
      isHold:
        typeof isHold === "boolean" ? isHold : !!existingInvoiceAny.isHold,
      termsId: resolvedTermsId,
      termsSnapshot: resolvedTermsSnapshot,
      liveTypeId: resolvedLiveTypeId,
      liveTypeSnapshot: resolvedLiveTypeSnapshot,
      customerId: resolvedCustomerId,
    };

    const changes: Record<string, any> = {};
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
    trackChange(
      "shippingFee",
      existingInvoice.shippingFee.toNumber(),
      nextData.shippingFee,
    );
    trackChange(
      "insuranceAmount",
      Number(existingInvoiceAny.insuranceAmount?.toNumber?.() ?? 0),
      nextData.insuranceAmount,
    );
    trackChange(
      "layawayFee",
      Number(existingInvoiceAny.layawayFee?.toNumber?.() ?? 0),
      nextData.layawayFee,
    );
    trackChange("amount", existingInvoice.amount.toNumber(), nextData.amount);
    if (!isMigratedInvoiceEdit && removedItemDepositFeeAmount > 0) {
      changes.removedItemDepositFee = {
        action: normalizedRemovedDepositFeeAction,
        amount:
          normalizedRemovedDepositFeeAction === "apply"
            ? removedItemDepositFeeAmount
            : 0,
        availableAmount: removedItemDepositFeeAmount,
        reason:
          normalizedRemovedDepositFeeAction === "skip"
            ? normalizedRemovedDepositFeeSkipReason
            : undefined,
        items: removedDepositFeeItems.map((item: any) => ({
          name: item?.name || "",
          quantity: Number(item?.quantity || 0),
          price: Number(item?.price || 0),
          unit: item?.unit || null,
          depositFee: Number(item?.depositFee || 0),
        })),
      };
    }
    trackChange(
      "invoiceDate",
      (existingInvoiceAny.invoiceDate as Date | null) ||
        existingInvoice.createdAt,
      nextData.invoiceDate,
    );
    trackChange("dueDate", existingInvoice.dueDate, nextData.dueDate);
    trackChange(
      "dueDateReason",
      (existingInvoiceAny.dueDateReason as string | null) || null,
      nextData.dueDateReason || null,
    );
    trackChange(
      "description",
      existingInvoice.description || null,
      nextData.description || null,
    );
    trackChange("isLayaway", existingInvoice.isLayaway, nextData.isLayaway);
    trackChange("isHold", !!existingInvoiceAny.isHold, nextData.isHold);
    trackChange("termsId", existingInvoice.termsId || null, nextData.termsId);
    trackChange("liveTypeId", existingLiveTypeId || null, nextData.liveTypeId);
    trackChange(
      "customerId",
      existingInvoice.customerId || null,
      nextData.customerId || null,
    );

    let invoice = await prisma.$transaction(
      async (tx) => {
        let updated = await tx.invoice.update({
          where: { id: invoiceId },
          data: nextData,
        });

        const recalcFeeSetting = await getRecalculationFeeSettingSnapshot();

        const normalizedLayawayPlan =
          layawayPlan && isLayaway
            ? {
                months: Math.max(1, Number(layawayPlan.months) || 3),
                paymentFrequency:
                  layawayPlan.paymentFrequency === "weekly" ||
                  layawayPlan.paymentFrequency === "bi-weekly"
                    ? layawayPlan.paymentFrequency
                    : "monthly",
                downPayment: Math.max(0, Number(layawayPlan.downPayment) || 0),
                notes:
                  typeof layawayPlan.notes === "string"
                    ? layawayPlan.notes.trim() || null
                    : null,
              }
            : null;

        if (
          normalizedLayawayPlan ||
          (!isLayaway && existingInvoice.isLayaway)
        ) {
          const existingPlan = await tx.layawayPlan.findUnique({
            where: { invoiceId },
            include: { installments: true },
          });

          const paidInstallments = (existingPlan?.installments || []).filter(
            (inst: any) => inst.isPaid,
          );
          const hasPaidInstallments = paidInstallments.length > 0;

          if (!isLayaway && existingPlan) {
            if (hasPaidInstallments) {
              throw new Error(
                "Cannot disable layaway after installment payments have been recorded.",
              );
            }

            await tx.layawayInstallment.deleteMany({
              where: { layawayPlanId: existingPlan.id },
            });
            await tx.layawayPlan.delete({ where: { invoiceId } });
          } else if (normalizedLayawayPlan) {
            const totalForPlan = Math.max(
              Number(updated.amount) - paidAmount,
              0,
            );
            const hasPaidExistingPlan = Boolean(
              existingPlan && hasPaidInstallments,
            );
            const paidRegularInstallmentCount = hasPaidExistingPlan
              ? paidInstallments.filter(
                  (inst: { label: string }) =>
                    !inst.label.toLowerCase().includes("down payment"),
                ).length
              : 0;
            const hasPaidDownPayment = hasPaidExistingPlan
              ? paidInstallments.some((inst: { label: string }) =>
                  inst.label.toLowerCase().includes("down payment"),
                )
              : false;
            const hasLayawayPlanConfigChanged = Boolean(
              existingPlan &&
                (existingPlan.months !== normalizedLayawayPlan.months ||
                  existingPlan.paymentFrequency !==
                    normalizedLayawayPlan.paymentFrequency ||
                  Number(existingPlan.downPayment) !==
                    normalizedLayawayPlan.downPayment ||
                  String(existingPlan.notes || "").trim() !==
                    String(normalizedLayawayPlan.notes || "").trim()),
            );
            const shouldApplyRecalculationFee =
              !isMigratedInvoiceEdit &&
              hasLayawayPlanConfigChanged &&
              normalizedRecalculationFeeAction === "apply" &&
              recalcFeeSetting.isActive &&
              recalcFeeSetting.amount > 0;

            const recalcFeeAmount = shouldApplyRecalculationFee
              ? calculateRecalculationFeeAmount(
                  totalForPlan,
                  recalcFeeSetting.amount,
                )
              : 0;
            if (recalcFeeAmount > 0) {
              const amountBeforeFee = updated.amount.toNumber();
              updated = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                  amount: {
                    increment: recalcFeeAmount,
                  },
                },
              });

              changes.amount = {
                from: amountBeforeFee,
                to: amountBeforeFee + recalcFeeAmount,
              };
              changes.recalculationFee = {
                amount: recalcFeeAmount,
              };
            }

            const planDownPayment = hasPaidExistingPlan
              ? Number(existingPlan!.downPayment)
              : normalizedLayawayPlan.downPayment;
            const planTotal = Number(updated.amount);
            const installments = buildLayawayInstallmentSchedule({
              invoiceDate: invoiceDateValue,
              frequency: normalizedLayawayPlan.paymentFrequency,
              months: normalizedLayawayPlan.months,
              downPayment: planDownPayment,
              totalAmount: planTotal,
              includeDownPayment: !hasPaidDownPayment,
              paidRegularInstallmentCount,
            });

            if (existingPlan) {
              await tx.layawayInstallment.deleteMany({
                where: {
                  layawayPlanId: existingPlan.id,
                  isPaid: false,
                },
              });

              await tx.layawayPlan.update({
                where: { invoiceId },
                data: {
                  months: normalizedLayawayPlan.months,
                  paymentFrequency: normalizedLayawayPlan.paymentFrequency,
                  downPayment: hasPaidExistingPlan
                    ? existingPlan.downPayment
                    : normalizedLayawayPlan.downPayment,
                  notes: normalizedLayawayPlan.notes,
                },
              });
            } else {
              await tx.layawayPlan.create({
                data: {
                  invoiceId,
                  months: normalizedLayawayPlan.months,
                  paymentFrequency: normalizedLayawayPlan.paymentFrequency,
                  downPayment: normalizedLayawayPlan.downPayment,
                  notes: normalizedLayawayPlan.notes,
                },
              });
            }

            const plan = await tx.layawayPlan.findUnique({
              where: { invoiceId },
              select: { id: true },
            });

            if (plan) {
              await tx.layawayInstallment.createMany({
                data: installments.map((inst) => ({
                  layawayPlanId: plan.id,
                  dueDate: inst.dueDate,
                  amount: inst.amount,
                  label: inst.label,
                  isPaid: false,
                })),
              });
            }
          }
        }

        return updated;
      },
      {
        timeout: 30000,
        maxWait: 5000,
      },
    );

    // Editing an invoice can change its amount (discount, items, fees, etc.),
    // which may make the already-recorded paidAmount fully cover the new total.
    // Status is otherwise only recomputed on payment changes, so recalculate it
    // here to avoid leaving the invoice stuck in a stale status (e.g. "partial"
    // when it is actually fully paid). Inactive/abandoned states are preserved.
    if (invoice.status !== "inactive" && invoice.status !== "abandoned") {
      const recalculatedStatus = calculateInvoiceStatus(
        invoice.amount.toNumber(),
        invoice.paidAmount.toNumber(),
        invoice.dueDate,
      );

      if (recalculatedStatus !== invoice.status) {
        invoice = await prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: recalculatedStatus },
        });
      }
    }

    const historyChanges: Record<string, any> = { ...changes };
    if (isMigratedInvoiceEdit) {
      historyChanges.migratedInvoiceEdit = true;
      historyChanges.editedBySnapshot = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    }

    await prisma.invoiceEditHistory.create({
      data: {
        invoiceId,
        editedById: user.id,
        reason: isMigratedInvoiceEdit
          ? `[Migrated invoice edit] ${reason}`
          : reason,
        changes:
          Object.keys(historyChanges).length > 0 ? historyChanges : undefined,
      },
    });

    // Convert Decimal to number for response
    const serializedInvoice = {
      ...invoice,
      subtotal: invoice.subtotal.toNumber(),
      tax: invoice.tax.toNumber(),
      discount: invoice.discount.toNumber(),
      shippingFee: invoice.shippingFee.toNumber(),
      insuranceAmount: Number(
        (invoice as any).insuranceAmount?.toNumber?.() ?? 0,
      ),
      layawayFee: Number((invoice as any).layawayFee?.toNumber?.() ?? 0),
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
      | "refund"
      | "none"
      | undefined;
    const feeAction = body?.feeAction as
      | "restocking"
      | "deposit"
      | "both"
      | "none"
      | undefined;
    const refundProofDataUrl =
      typeof body?.refundProofDataUrl === "string"
        ? body.refundProofDataUrl
        : "";
    const refundProofFileName =
      typeof body?.refundProofFileName === "string"
        ? body.refundProofFileName
        : "";
    const refundProofMimeType =
      typeof body?.refundProofMimeType === "string"
        ? body.refundProofMimeType
        : "";
    const targetInvoiceId =
      body?.targetInvoiceId === null ||
      body?.targetInvoiceId === undefined ||
      body?.targetInvoiceId === ""
        ? null
        : parseInt(String(body.targetInvoiceId), 10);
    const requestedFeeMethodId =
      body?.feeMethodId === null ||
      body?.feeMethodId === undefined ||
      body?.feeMethodId === ""
        ? null
        : parseInt(String(body.feeMethodId), 10);

    let targetStatus:
      | "inactive"
      | "abandoned"
      | "paid"
      | "pending"
      | "overdue"
      | "partial";
    if (requestedTargetStatus === "reactivate") {
      if (existingInvoice.status === "abandoned") {
        return NextResponse.json(
          { error: "Abandoned invoices cannot be reactivated." },
          { status: 400 },
        );
      }
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
    let feeAmount = 0;
    let resolvedTargetInvoiceId: number | null = null;
    let normalizedPaymentAction: "credit" | "transfer" | "refund" | "none" =
      paymentAction ?? "none";
    let normalizedFeeAction: "restocking" | "deposit" | "both" | "none" =
      feeAction ?? "none";
    let feePaymentId: number | null = null;
    let restockingFeePaymentId: number | null = null;
    let depositFeePaymentId: number | null = null;
    let restockingFeeAmount = 0;
    let depositFeeAmount = 0;
    let refundPaymentIds: number[] = [];

    const updated = await prisma.$transaction(
      async (tx) => {
        let refundProofUrl: string | null = null;
        let storedRefundProofFileName: string | null = null;

        if (targetStatus === "abandoned") {
          if (
            (normalizedFeeAction === "restocking" ||
              normalizedFeeAction === "both") &&
            !existingInvoice.isLayaway
          ) {
            throw new Error(
              "Restocking fee can only be applied to layaway invoices.",
            );
          }

          const directPayments = await tx.payment.findMany({
            where: { invoiceId },
            select: {
              id: true,
              amount: true,
              source: true,
              methodId: true,
            },
          });

          const realDirectPayments = directPayments.filter(
            (payment) => payment.source !== "store_credit_applied",
          );

          const matchedPayments = await tx.paymentInvoiceMatch.findMany({
            where: { invoiceId },
            select: { id: true, paymentId: true, amount: true },
          });

          const directTotal = realDirectPayments.reduce(
            (sum, p) => sum + p.amount.toNumber(),
            0,
          );
          const directPaymentIds = new Set(realDirectPayments.map((p) => p.id));
          const matchedPaymentsWithoutDirectOverlap = matchedPayments.filter(
            (match) => !directPaymentIds.has(match.paymentId),
          );
          const matchedTotal = matchedPaymentsWithoutDirectOverlap.reduce(
            (sum, m) => sum + m.amount.toNumber(),
            0,
          );
          const invoiceTotal = existingInvoice.amount.toNumber();
          const depositFeeTotal = Array.isArray(existingInvoice.items)
            ? existingInvoice.items.reduce((sum: number, item: any) => {
                const fee = Number(item?.depositFee || 0);
                return sum + (Number.isFinite(fee) ? fee : 0);
              }, 0)
            : 0;

          const restockingSetting = await (
            tx as any
          ).restockingFeeSetting.findFirst({
            where: { isActive: true },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            select: { amount: true, isPercentage: true, isActive: true },
          });

          const calculatedRestockingFee = calculateRestockingFeeAmount(
            invoiceTotal,
            {
              amount: Number(restockingSetting?.amount || 0),
              isPercentage: !!restockingSetting?.isPercentage,
              isActive: !!restockingSetting?.isActive,
            },
          );
          const calculatedDepositFee = Number(depositFeeTotal.toFixed(2));
          const paymentTotal =
            Math.round((directTotal + matchedTotal) * 100) / 100;

          if (normalizedFeeAction === "both") {
            const roundedRestockingFee =
              Math.round(calculatedRestockingFee * 100) / 100;
            const roundedDepositFee =
              Math.round(calculatedDepositFee * 100) / 100;

            if (paymentTotal > 0) {
              restockingFeeAmount = Math.min(
                roundedRestockingFee,
                paymentTotal,
              );
              const remainingAfterRestocking = Math.max(
                paymentTotal - restockingFeeAmount,
                0,
              );
              depositFeeAmount = Math.min(
                roundedDepositFee,
                remainingAfterRestocking,
              );
            } else {
              restockingFeeAmount = roundedRestockingFee;
              depositFeeAmount = roundedDepositFee;
            }

            feeAmount = restockingFeeAmount + depositFeeAmount;
          } else if (normalizedFeeAction === "restocking") {
            const roundedCalculatedFee =
              Math.round(calculatedRestockingFee * 100) / 100;
            feeAmount =
              paymentTotal > 0
                ? Math.min(roundedCalculatedFee, paymentTotal)
                : roundedCalculatedFee;
          } else if (normalizedFeeAction === "deposit") {
            const roundedCalculatedFee =
              Math.round(calculatedDepositFee * 100) / 100;
            feeAmount =
              paymentTotal > 0
                ? Math.min(roundedCalculatedFee, paymentTotal)
                : roundedCalculatedFee;
          } else {
            feeAmount = 0;
          }
          movedAmount = Math.max(
            Math.round((paymentTotal - feeAmount) * 100) / 100,
            0,
          );

          const sourceMethodId =
            (Number.isFinite(requestedFeeMethodId as number)
              ? requestedFeeMethodId
              : null) ||
            realDirectPayments[0]?.methodId ||
            (
              await tx.payment.findFirst({
                where: { id: matchedPayments[0]?.paymentId },
                select: { methodId: true },
              })
            )?.methodId ||
            (
              await tx.paymentMethodEntry.findFirst({
                where: { isActive: true },
                orderBy: [{ isSystem: "desc" }, { sortOrder: "asc" }],
                select: { id: true },
              })
            )?.id;

          if (normalizedPaymentAction === "refund") {
            if (movedAmount <= 0.009) {
              throw new Error(
                "No refundable payment balance remains after the selected fee.",
              );
            }
            if (!refundProofDataUrl) {
              throw new Error("Refund proof image is required.");
            }

            const match = refundProofDataUrl.match(
              /^data:([^;]+);base64,(.+)$/,
            );
            if (!match) {
              throw new Error("Refund proof image is invalid.");
            }

            const mimeType = refundProofMimeType.trim() || match[1];
            const fallbackExtension =
              mimeType === "image/png"
                ? "png"
                : mimeType === "image/webp"
                  ? "webp"
                  : mimeType === "image/gif"
                    ? "gif"
                    : "jpg";
            const safeFileName =
              refundProofFileName.trim() || `refund-proof.${fallbackExtension}`;
            const proofKey = `refund-proofs/${invoiceId}-${Date.now()}-${safeFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

            refundProofUrl = await uploadToR2(
              Buffer.from(match[2], "base64"),
              proofKey,
              mimeType,
            );
            storedRefundProofFileName = safeFileName;
          }

          if (normalizedPaymentAction === "refund" && paymentTotal <= 0.009) {
            throw new Error(
              "Refund is only available when the invoice has payments.",
            );
          }

          if (paymentTotal > 0.009) {
            if (
              !normalizedPaymentAction ||
              normalizedPaymentAction === "none"
            ) {
              throw new Error(
                "This invoice has payments. Please choose how to handle them.",
              );
            }

            const affectedPaymentIds = new Set<number>([
              ...realDirectPayments.map((p) => p.id),
              ...matchedPayments.map((m) => m.paymentId),
            ]);

            if (normalizedPaymentAction === "credit") {
              if (!existingInvoice.customerId) {
                throw new Error(
                  "Cannot move payments to credit because this invoice has no linked customer.",
                );
              }

              if (realDirectPayments.length > 0) {
                await tx.payment.updateMany({
                  where: { id: { in: realDirectPayments.map((p) => p.id) } },
                  data: {
                    invoiceId: null,
                    isAbandoned: true,
                    abandonedAt: new Date(),
                    abandonedBy: user.id,
                    abandonReason: `Payments moved to customer store credit from abandoned invoice ${existingInvoice.invoiceNumber}. ${reason}`,
                  },
                });
              }

              if (matchedPaymentsWithoutDirectOverlap.length > 0) {
                await tx.paymentInvoiceMatch.deleteMany({
                  where: {
                    id: {
                      in: matchedPaymentsWithoutDirectOverlap.map((m) => m.id),
                    },
                  },
                });
              }

              if (!sourceMethodId) {
                throw new Error(
                  "No active payment method available for store credit.",
                );
              }

              if (movedAmount > 0.009) {
                const creditPayment = await tx.payment.create({
                  data: {
                    invoiceId: null,
                    amount: new Prisma.Decimal(movedAmount),
                    paymentDate: new Date(),
                    methodId: sourceMethodId,
                    notes: `Store credit from abandoned invoice ${existingInvoice.invoiceNumber}${reason ? ` | ${reason}` : ""}`,
                    userId: user.id,
                    isMatched: false,
                    source: "store_credit_excess",
                  },
                });

                await stampPaymentCode(tx, creditPayment.id);

                await (tx as any).customer.update({
                  where: { id: existingInvoice.customerId },
                  data: {
                    storeCredit: { increment: new Prisma.Decimal(movedAmount) },
                  },
                });

                await (tx as any).customerCreditTransaction.create({
                  data: {
                    customerId: existingInvoice.customerId,
                    amount: new Prisma.Decimal(movedAmount),
                    type: "credit",
                    reason: `Payments moved from abandoned invoice ${existingInvoice.invoiceNumber}. ${reason}`,
                    paymentId: creditPayment.id,
                    invoiceId,
                    createdById: user.id,
                  },
                });
              }
            }

            if (normalizedPaymentAction === "transfer") {
              if (movedAmount <= 0.009) {
                if (realDirectPayments.length > 0) {
                  await tx.payment.updateMany({
                    where: { id: { in: realDirectPayments.map((p) => p.id) } },
                    data: {
                      invoiceId: null,
                      isAbandoned: true,
                      abandonedAt: new Date(),
                      abandonedBy: user.id,
                      abandonReason: `Payments retained as fee from abandoned invoice ${existingInvoice.invoiceNumber}. ${reason}`,
                    },
                  });
                }
                if (matchedPaymentsWithoutDirectOverlap.length > 0) {
                  await tx.paymentInvoiceMatch.deleteMany({
                    where: {
                      id: {
                        in: matchedPaymentsWithoutDirectOverlap.map(
                          (m) => m.id,
                        ),
                      },
                    },
                  });
                }
              } else {
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
                if (
                  target.status === "inactive" ||
                  target.status === "abandoned"
                ) {
                  throw new Error(
                    "Target invoice cannot be inactive or abandoned.",
                  );
                }

                resolvedTargetInvoiceId = target.id;

                if (realDirectPayments.length > 0) {
                  await tx.payment.updateMany({
                    where: { id: { in: realDirectPayments.map((p) => p.id) } },
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
            }

            if (normalizedPaymentAction === "refund") {
              const refundReason = `Payments refunded from abandoned invoice ${existingInvoice.invoiceNumber}. ${reason}`;
              const refundAllocationItems: Array<{
                id: number;
                amount: number;
              }> = [];

              for (const payment of realDirectPayments) {
                refundAllocationItems.push({
                  id: payment.id,
                  amount: payment.amount.toNumber(),
                });
              }

              const matchedAmountByPaymentId = new Map<number, number>();
              for (const match of matchedPaymentsWithoutDirectOverlap) {
                if (directPaymentIds.has(match.paymentId)) continue;
                matchedAmountByPaymentId.set(
                  match.paymentId,
                  (matchedAmountByPaymentId.get(match.paymentId) || 0) +
                    match.amount.toNumber(),
                );
              }
              for (const [paymentId, amount] of matchedAmountByPaymentId) {
                refundAllocationItems.push({ id: paymentId, amount });
              }

              const refundAllocations = allocatePaymentAmounts(
                refundAllocationItems,
                movedAmount,
              );

              const refundPaymentUpdate = {
                invoiceId: null,
                isMatched: false,
                isAbandoned: true,
                abandonedAt: new Date(),
                abandonedBy: user.id,
                abandonReason: refundReason,
                refundProofUrl,
                refundProofFileName: storedRefundProofFileName,
              };

              for (const payment of realDirectPayments) {
                const refundAmount = refundAllocations.get(payment.id) ?? 0;
                await tx.payment.update({
                  where: { id: payment.id },
                  data: {
                    ...refundPaymentUpdate,
                    amount: new Prisma.Decimal(refundAmount),
                  },
                });
              }

              if (matchedPaymentsWithoutDirectOverlap.length > 0) {
                await tx.paymentInvoiceMatch.deleteMany({
                  where: {
                    id: {
                      in: matchedPaymentsWithoutDirectOverlap.map((m) => m.id),
                    },
                  },
                });
              }

              for (const paymentId of matchedAmountByPaymentId.keys()) {
                const refundAmount = refundAllocations.get(paymentId) ?? 0;
                await tx.payment.update({
                  where: { id: paymentId },
                  data: {
                    ...refundPaymentUpdate,
                    amount: new Prisma.Decimal(refundAmount),
                  },
                });
              }

              refundPaymentIds = refundAllocationItems.map((item) => item.id);
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

              if (!payment.invoiceId && payment.paymentMatches.length === 0) {
                const abandonedAt = payment.abandonedAt || new Date();
                if (!payment.isAbandoned) {
                  await tx.payment.update({
                    where: { id: pid },
                    data: {
                      isAbandoned: true,
                      abandonedAt,
                      abandonedBy: user.id,
                      abandonReason:
                        normalizedPaymentAction === "refund"
                          ? `Payments refunded from abandoned invoice ${existingInvoice.invoiceNumber}. ${reason}`
                          : `Payments moved to customer store credit from abandoned invoice ${existingInvoice.invoiceNumber}. ${reason}`,
                      ...(normalizedPaymentAction === "refund"
                        ? {
                            refundProofUrl,
                            refundProofFileName: storedRefundProofFileName,
                          }
                        : {}),
                    },
                  });
                }
              }
            }
          }

          const createRetainedFeePayment = async (
            amount: number,
            source: "restocking_fee" | "deposit_fee",
            label: string,
          ) => {
            const feePayment = await tx.payment.create({
              data: {
                invoiceId,
                amount: new Prisma.Decimal(amount),
                paymentDate: new Date(),
                methodId: sourceMethodId!,
                notes: `${label} retained from abandoned invoice ${existingInvoice.invoiceNumber}${reason ? ` | ${reason}` : ""}`,
                userId: user.id,
                isMatched: true,
                source,
              },
            });

            await stampPaymentCode(tx, feePayment.id);
            return feePayment.id;
          };

          if (normalizedFeeAction !== "none" && feeAmount > 0.009) {
            if (
              paymentTotal <= 0.009 &&
              !Number.isFinite(requestedFeeMethodId as number)
            ) {
              throw new Error(
                "Payment method is required for the fee payment.",
              );
            }
            if (!sourceMethodId) {
              throw new Error(
                "No active payment method available for fee payment.",
              );
            }

            if (normalizedFeeAction === "both") {
              if (restockingFeeAmount > 0.009) {
                restockingFeePaymentId = await createRetainedFeePayment(
                  restockingFeeAmount,
                  "restocking_fee",
                  "Restocking fee",
                );
                feePaymentId = restockingFeePaymentId;
              }
              if (depositFeeAmount > 0.009) {
                depositFeePaymentId = await createRetainedFeePayment(
                  depositFeeAmount,
                  "deposit_fee",
                  "Deposit fee",
                );
                if (!feePaymentId) {
                  feePaymentId = depositFeePaymentId;
                }
              }
            } else {
              const feeLabel =
                normalizedFeeAction === "restocking"
                  ? "Restocking fee"
                  : "Deposit fee";
              feePaymentId = await createRetainedFeePayment(
                feeAmount,
                normalizedFeeAction === "restocking"
                  ? "restocking_fee"
                  : "deposit_fee",
                feeLabel,
              );
            }
          }
        }

        const inv = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: targetStatus,
            ...(targetStatus === "abandoned"
              ? { amount: 0, paidAmount: feeAmount }
              : {}),
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
                      to: normalizedPaymentAction,
                    },
                    movedAmount: {
                      from: 0,
                      to: movedAmount,
                    },
                    ...(feeAmount > 0
                      ? {
                          feeAmount: {
                            from: 0,
                            to: feeAmount,
                          },
                          feeType: {
                            from: null,
                            to: normalizedFeeAction,
                          },
                        }
                      : {}),
                    ...(feePaymentId
                      ? {
                          feePaymentId: {
                            from: null,
                            to: feePaymentId,
                          },
                          feePaymentCode: {
                            from: null,
                            to: formatPaymentCode(feePaymentId),
                          },
                        }
                      : {}),
                    ...(normalizedFeeAction === "both"
                      ? {
                          ...(restockingFeeAmount > 0
                            ? {
                                restockingFeeAmount: {
                                  from: 0,
                                  to: restockingFeeAmount,
                                },
                              }
                            : {}),
                          ...(depositFeeAmount > 0
                            ? {
                                depositFeeAmount: {
                                  from: 0,
                                  to: depositFeeAmount,
                                },
                              }
                            : {}),
                          ...(restockingFeePaymentId
                            ? {
                                restockingFeePaymentId: {
                                  from: null,
                                  to: restockingFeePaymentId,
                                },
                                restockingFeePaymentCode: {
                                  from: null,
                                  to: formatPaymentCode(restockingFeePaymentId),
                                },
                              }
                            : {}),
                          ...(depositFeePaymentId
                            ? {
                                depositFeePaymentId: {
                                  from: null,
                                  to: depositFeePaymentId,
                                },
                                depositFeePaymentCode: {
                                  from: null,
                                  to: formatPaymentCode(depositFeePaymentId),
                                },
                              }
                            : {}),
                        }
                      : {}),
                    ...(refundPaymentIds.length > 0
                      ? {
                          refundPaymentIds: {
                            from: [],
                            to: refundPaymentIds,
                          },
                          refundPaymentCodes: {
                            from: [],
                            to: refundPaymentIds.map((id) =>
                              formatPaymentCode(id),
                            ),
                          },
                        }
                      : {}),
                    ...(normalizedPaymentAction === "refund" && refundProofUrl
                      ? {
                          refundProof: {
                            url: refundProofUrl,
                            fileName: storedRefundProofFileName,
                          },
                        }
                      : {}),
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
      },
      {
        timeout: 20000,
        maxWait: 5000,
      },
    );

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
                : normalizedPaymentAction === "refund"
                  ? "Invoice marked as abandoned and payments refunded"
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
