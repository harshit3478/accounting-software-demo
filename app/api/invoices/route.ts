import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth } from "../../../lib/auth";
import { LINKABLE_INVOICE_STATUSES } from "../../../lib/invoice-linkable-status";
import {
  generateInvoiceNumber,
  calculateInvoiceStatus,
} from "../../../lib/invoice-utils";
import {
  calculateInsuranceAmount,
  DEFAULT_INSURANCE_BANDS,
  type InsuranceBand,
} from "../../../lib/insurance";
import {
  DEFAULT_LAYAWAY_FEE_RATES,
  calculateLayawayFeeFromItems,
  normalizeLayawayFeeRates,
} from "../../../lib/layaway-fees";
import { buildLayawayInstallmentSchedule } from "../../../lib/layaway-installments";
import {
  calculateDepositFeeForItem,
  normalizeDepositFeeRules,
} from "../../../lib/deposit-fees";
import { invalidateDashboard } from "../../../lib/cache-helpers";
import { serializeInvoiceEditHistoryEntry } from "../../../lib/user-display";

async function getConfiguredInsuranceBands(): Promise<InsuranceBand[]> {
  const ruleModel = (prisma as any)?.insuranceRule;
  if (!ruleModel) {
    return DEFAULT_INSURANCE_BANDS;
  }

  try {
    const rows = await ruleModel.findMany({
      orderBy: [{ sortOrder: "asc" }, { maxValue: "asc" }],
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      return DEFAULT_INSURANCE_BANDS;
    }

    return rows.map((row: any) => ({
      maxValue: row.maxValue?.toNumber
        ? row.maxValue.toNumber()
        : Number(row.maxValue),
      clientShare: row.clientShare?.toNumber
        ? row.clientShare.toNumber()
        : Number(row.clientShare),
    }));
  } catch {
    return DEFAULT_INSURANCE_BANDS;
  }
}

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

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    // Pagination params
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Filter params
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const type = searchParams.get("type") || "all";
    const overdueDates = searchParams.get("overdueDates"); // "2" for > 2 due dates logic
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const showInactive = searchParams.get("showInactive") === "true";
    const customerId = searchParams.get("customerId");
    const shipment = searchParams.get("shipment") || "all";
    const liveType = searchParams.get("liveType") || "all";
    const abandonFee = searchParams.get("abandonFee") || "all";

    // Sort params
    const sortBy = searchParams.get("sortBy") || "invoiceNumber";
    const sortDirection = (searchParams.get("sortDirection") || "desc") as
      | "asc"
      | "desc";

    // Compatibility fallback when Prisma client/database is not yet migrated for "abandoned" status.
    let supportsAbandonedStatus = true;
    try {
      await (prisma as any).invoice.count({ where: { status: "abandoned" } });
    } catch {
      supportsAbandonedStatus = false;
    }

    if (status === "abandoned" && !supportsAbandonedStatus) {
      return NextResponse.json({
        invoices: [],
        pagination: {
          total: 0,
          pages: 0,
          page,
          limit,
        },
      });
    }

    // Build where clause
    const where: any = {};
    const showHeldInvoices = status === "hold";
    if (showHeldInvoices) {
      where.isHold = true;
    }

    // Status scope: "all" shows every billing status in one list
    if (showHeldInvoices) {
      // Hold is an overlay flag, not a billing status.
    } else if (status === "linkable" || status === "unpaid") {
      where.status = { in: [...LINKABLE_INVOICE_STATUSES] };
    } else if (
      status === "inactive" ||
      (status === "abandoned" && supportsAbandonedStatus)
    ) {
      where.status = status;
    } else if (status === "all" || showInactive) {
      // No status restriction — include pending, paid, abandoned, inactive, etc.
    } else if (
      status === "pending" ||
      status === "paid" ||
      status === "overdue" ||
      status === "partial"
    ) {
      where.status = status;
    } else {
      // Unknown status param: same as operational default (exclude inactive/abandoned)
      where.status = supportsAbandonedStatus
        ? { notIn: ["inactive", "abandoned"] }
        : { not: "inactive" };
    }

    // Search filter
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { clientName: { contains: search } },
      ];
    }

    // Customer filter — see all invoices for a specific client
    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    if (liveType !== "all") {
      const parsedLiveTypeId = parseInt(liveType, 10);
      if (Number.isFinite(parsedLiveTypeId)) {
        where.liveTypeId = parsedLiveTypeId;
      }
    }

    // Type filter
    if (type === "layaway") {
      where.isLayaway = true;
    } else if (type === "cash") {
      where.isLayaway = false;
    }

    // Abandoned invoice fee filter (retained deposit/restocking fee vs none)
    if (abandonFee === "with_fee" || abandonFee === "without_fee") {
      where.status = "abandoned";
      where.paidAmount =
        abandonFee === "with_fee" ? { gt: 0 } : { lte: 0 };
    }

    // Overdue Dates Logic (Layaway specific) — uses LayawayInstallment table
    if (overdueDates === "2") {
      where.isLayaway = true;
      if (status === "all") {
        where.status = supportsAbandonedStatus
          ? { notIn: ["paid", "inactive", "abandoned"] }
          : { notIn: ["paid", "inactive"] };
      }
      // Find invoices that have overdue unpaid installments
      where.layawayPlan = {
        isCancelled: false,
        installments: {
          some: {
            isPaid: false,
            dueDate: { lt: new Date() },
          },
        },
      };
    }

    // Date range filter
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    // Shipment filter (local shipmentId / trackingNumber)
    if (shipment === "none") {
      where.AND = [
        ...(where.AND || []),
        {
          AND: [
            { OR: [{ shipmentId: null }, { shipmentId: "" }] },
            { OR: [{ trackingNumber: null }, { trackingNumber: "" }] },
          ],
        },
      ];
    } else if (shipment === "awaiting_tracking") {
      where.AND = [
        ...(where.AND || []),
        {
          AND: [
            { shipmentId: { not: null } },
            { NOT: { shipmentId: "" } },
            {
              OR: [{ trackingNumber: null }, { trackingNumber: "" }],
            },
          ],
        },
      ];
    } else if (shipment === "tracked") {
      where.AND = [
        ...(where.AND || []),
        {
          AND: [
            { trackingNumber: { not: null } },
            { NOT: { trackingNumber: "" } },
          ],
        },
      ];
    }

    // Get total count for pagination
    const total = await (prisma as any).invoice.count({ where });

    const includeAny: any = {
      payments: { include: { method: true } },
      paymentMatches: true,
      terms: true,
      liveType: true,
      shippingFeeRule: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
        },
      },
      editHistory: {
        orderBy: { createdAt: "desc" },
        include: {
          editedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      layawayPlan: {
        include: { installments: { orderBy: { dueDate: "asc" } } },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    };

    // Build orderBy based on sort params
    let orderBy: any;
    switch (sortBy) {
      case "amount":
        orderBy = { amount: sortDirection };
        break;
      case "client":
        orderBy = { clientName: sortDirection };
        break;
      case "dueDate":
        orderBy = { dueDate: sortDirection };
        break;
      case "date":
        orderBy = [
          { invoiceDate: sortDirection },
          { invoiceNumber: sortDirection },
        ];
        break;
      case "invoiceNumber":
      default:
        orderBy = { invoiceNumber: sortDirection };
        break;
    }

    const invoices = await (prisma as any).invoice.findMany({
      where,
      include: includeAny,
      orderBy,
      skip,
      take: limit,
    });

    // Convert Decimal to number for JSON serialization
    const serializedInvoices = (invoices as any[]).map((invoice: any) => ({
      ...invoice,
      subtotal: invoice.subtotal?.toNumber
        ? invoice.subtotal.toNumber()
        : invoice.subtotal,
      tax: invoice.tax?.toNumber ? invoice.tax.toNumber() : invoice.tax,
      discount: invoice.discount?.toNumber
        ? invoice.discount.toNumber()
        : invoice.discount,
      shippingFee: invoice.shippingFee?.toNumber
        ? invoice.shippingFee.toNumber()
        : invoice.shippingFee,
      insuranceAmount: invoice.insuranceAmount?.toNumber
        ? invoice.insuranceAmount.toNumber()
        : invoice.insuranceAmount,
      insuranceBaseAmount: invoice.insuranceBaseAmount?.toNumber
        ? invoice.insuranceBaseAmount.toNumber()
        : invoice.insuranceBaseAmount,
      layawayFee: invoice.layawayFee?.toNumber
        ? invoice.layawayFee.toNumber()
        : invoice.layawayFee,
      amount: invoice.amount?.toNumber
        ? invoice.amount.toNumber()
        : invoice.amount,
      paidAmount: invoice.paidAmount?.toNumber
        ? invoice.paidAmount.toNumber()
        : invoice.paidAmount,
      customer: invoice.customer
        ? {
            ...invoice.customer,
            storeCredit: (invoice.customer as any).storeCredit?.toNumber
              ? (invoice.customer as any).storeCredit.toNumber()
              : ((invoice.customer as any).storeCredit ?? 0),
          }
        : null,
      termsSnapshot: invoice.termsSnapshot || null,
      liveTypeSnapshot: invoice.liveTypeSnapshot || null,
      liveType: invoice.liveType
        ? {
            ...invoice.liveType,
          }
        : null,
      payments: (invoice.payments || []).map((payment: any) => ({
        ...payment,
        amount: payment.amount?.toNumber
          ? payment.amount.toNumber()
          : payment.amount,
      })),
      layawayPlan: invoice.layawayPlan
        ? {
            ...invoice.layawayPlan,
            downPayment: invoice.layawayPlan.downPayment?.toNumber
              ? invoice.layawayPlan.downPayment.toNumber()
              : Number(invoice.layawayPlan.downPayment),
            installments: (invoice.layawayPlan.installments || []).map(
              (inst: any) => ({
                ...inst,
                amount: inst.amount?.toNumber
                  ? inst.amount.toNumber()
                  : Number(inst.amount),
                paidAmount:
                  inst.paidAmount != null
                    ? inst.paidAmount?.toNumber
                      ? inst.paidAmount.toNumber()
                      : Number(inst.paidAmount)
                    : null,
              }),
            ),
          }
        : null,
      isHold: !!invoice.isHold,
      editHistory: (invoice.editHistory || []).map((entry: any) =>
        serializeInvoiceEditHistoryEntry(entry),
      ),
    }));

    return NextResponse.json({
      invoices: serializedInvoices,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const {
      clientName,
      customerId,
      customerAddress,
      externalInvoiceNumber,
      source,
      items,
      subtotal,
      tax,
      discount,
      invoiceDate,
      dueDate,
      dueDateReason,
      description,
      isLayaway,
      layawayPlan,
      useDefaultTerms,
      termsId,
      newTerms,
      liveTypeId,
      shippingFee,
      shippingFeeRuleId,
      insuranceAmount,
      insuranceBaseAmount,
    } = await request.json();

    const normalizedClientName =
      typeof clientName === "string" ? clientName.trim() : "";
    const normalizedCustomerAddress =
      typeof customerAddress === "string" ? customerAddress.trim() : "";
    if (!normalizedClientName) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 },
      );
    }

    let resolvedCustomerId: number | null = null;
    if (customerId !== undefined && customerId !== null && customerId !== "") {
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

      resolvedCustomerId = existingCustomer.id;

      if (!existingCustomer.address?.trim()) {
        if (!normalizedCustomerAddress) {
          return NextResponse.json(
            { error: "Customer address is required" },
            { status: 400 },
          );
        }

        await prisma.customer.update({
          where: { id: resolvedCustomerId },
          data: { address: normalizedCustomerAddress },
        });
      }
    } else {
      const matchedByName = await prisma.customer.findFirst({
        where: { name: normalizedClientName },
        select: { id: true, address: true },
      });

      if (matchedByName) {
        resolvedCustomerId = matchedByName.id;
        if (!matchedByName.address?.trim()) {
          if (!normalizedCustomerAddress) {
            return NextResponse.json(
              { error: "Customer address is required" },
              { status: 400 },
            );
          }

          await prisma.customer.update({
            where: { id: resolvedCustomerId },
            data: { address: normalizedCustomerAddress },
          });
        }
      } else {
        const createdCustomer = await prisma.customer.create({
          data: {
            name: normalizedClientName,
            address: normalizedCustomerAddress || null,
          },
          select: { id: true },
        });
        resolvedCustomerId = createdCustomer.id;
      }
    }

    const invoiceDateValue = invoiceDate ? new Date(invoiceDate) : new Date();
    if (Number.isNaN(invoiceDateValue.getTime())) {
      return NextResponse.json(
        { error: "Invalid invoice date" },
        { status: 400 },
      );
    }

    const normalizedInvoiceDate = new Date(invoiceDateValue);
    normalizedInvoiceDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (normalizedInvoiceDate > today) {
      return NextResponse.json(
        { error: "Invoice date cannot be in the future" },
        { status: 400 },
      );
    }

    const dueDateValue = new Date(dueDate);
    if (Number.isNaN(dueDateValue.getTime())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const selectedDueDate = new Date(dueDateValue);
    selectedDueDate.setHours(0, 0, 0, 0);

    const requiresDueDateReason = selectedDueDate < today;
    const normalizedDueDateReason =
      typeof dueDateReason === "string" ? dueDateReason.trim() : "";

    if (requiresDueDateReason && !normalizedDueDateReason) {
      return NextResponse.json(
        { error: "Due date reason is required" },
        { status: 400 },
      );
    }

    // Generate unique invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Calculate total amount
    const taxAmount = tax || 0;
    const discountAmount = discount || 0;
    const shippingFeeAmount = shippingFee || 0;
    const preShippingTotal =
      parseFloat(subtotal) + parseFloat(taxAmount) - parseFloat(discountAmount);

    let normalizedInsuranceBaseAmount: number | null = null;
    if (
      insuranceBaseAmount !== undefined &&
      insuranceBaseAmount !== null &&
      insuranceBaseAmount !== ""
    ) {
      const parsedBase = Number(insuranceBaseAmount);
      if (!Number.isFinite(parsedBase) || parsedBase <= 0) {
        return NextResponse.json(
          { error: "Insurance applied-on amount must be greater than 0" },
          { status: 400 },
        );
      }

      if (parsedBase > preShippingTotal) {
        return NextResponse.json(
          {
            error:
              "Insurance applied-on amount cannot exceed invoice value before shipping",
          },
          { status: 400 },
        );
      }

      normalizedInsuranceBaseAmount = parsedBase;
    }

    const insuranceCalculationBase =
      normalizedInsuranceBaseAmount ?? preShippingTotal;
    const insuranceBands = await getConfiguredInsuranceBands();
    const insuranceFeeAmount =
      insuranceAmount !== undefined && insuranceAmount !== null
        ? Number(insuranceAmount)
        : calculateInsuranceAmount(insuranceCalculationBase, insuranceBands);
    const layawayFeeRates = await getConfiguredLayawayFeeRates();
    const depositFeeRules = await getConfiguredDepositFeeRules();
    const layawayMonths = Number(layawayPlan?.months || 0);
    const layawayFeeAmount = isLayaway
      ? calculateLayawayFeeFromItems(
          items as any,
          layawayMonths || 3,
          layawayFeeRates,
        )
      : 0;
    const normalizedItems = Array.isArray(items)
      ? items.map((item: any) => ({
          ...item,
          depositFee: calculateDepositFeeForItem(item, depositFeeRules),
        }))
      : items || null;
    const totalAmount =
      preShippingTotal +
      parseFloat(shippingFeeAmount) +
      insuranceFeeAmount +
      layawayFeeAmount;

    // Handle terms: either attach default, attach existing terms by id, or create new terms
    let attachedTermsId: number | null = null;
    let termsSnapshot: any = null;
    let resolvedLiveTypeId: number | null = null;
    let resolvedLiveTypeSnapshot: string | null = null;

    if (useDefaultTerms) {
      const defaultTerm = await (prisma as any).term.findFirst({
        where: { isDefault: true },
        orderBy: { updatedAt: "desc" },
      });
      if (defaultTerm) {
        attachedTermsId = defaultTerm.id;
        termsSnapshot = defaultTerm.lines;
      }
    } else if (termsId) {
      const found = await (prisma as any).term.findUnique({
        where: { id: termsId },
      });
      if (found) {
        attachedTermsId = found.id;
        termsSnapshot = found.lines;
      }
    } else if (Array.isArray(newTerms) && newTerms.length > 0) {
      // enforce max 5 lines
      const lines = newTerms.slice(0, 5);
      const createdTerm = await (prisma as any).term.create({
        data: { lines, createdBy: user.id },
      });
      attachedTermsId = createdTerm.id;
      termsSnapshot = createdTerm.lines;
    }

    if (liveTypeId !== undefined && liveTypeId !== null && liveTypeId !== "") {
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

    const invoiceSource = source || "manual";
    const invoice = await (prisma as any).invoice.create({
      data: {
        userId: user.id,
        invoiceNumber,
        clientName: normalizedClientName,
        items: normalizedItems,
        subtotal: parseFloat(subtotal),
        tax: parseFloat(taxAmount),
        discount: parseFloat(discountAmount),
        shippingFee: parseFloat(shippingFeeAmount),
        insuranceAmount: insuranceFeeAmount,
        layawayFee: layawayFeeAmount,
        amount: totalAmount,
        paidAmount: 0,
        invoiceDate: invoiceDateValue,
        dueDate: dueDateValue,
        dueDateReason: requiresDueDateReason ? normalizedDueDateReason : null,
        status: "pending",
        isLayaway: isLayaway || false,
        description,
        customerId: resolvedCustomerId,
        externalInvoiceNumber: externalInvoiceNumber || null,
        source: invoiceSource,
        termsId: attachedTermsId,
        termsSnapshot: termsSnapshot || null,
        liveTypeId: resolvedLiveTypeId,
        liveTypeSnapshot: resolvedLiveTypeSnapshot,
        shippingFeeRuleId: shippingFeeRuleId || null,
      },
    });

    await prisma.invoiceEditHistory.create({
      data: {
        invoiceId: invoice.id,
        editedById: user.id,
        reason: "Invoice created",
        changes: {
          source: { from: null, to: invoiceSource },
        },
      },
    });

    if (normalizedInsuranceBaseAmount !== null) {
      await prisma.$executeRaw`
        UPDATE invoices
        SET insuranceBaseAmount = ${normalizedInsuranceBaseAmount}
        WHERE id = ${invoice.id}
      `;
    }

    // Create layaway plan if applicable
    if (isLayaway && layawayPlan) {
      const planMonths = layawayPlan.months || 3;
      const planFrequency = layawayPlan.paymentFrequency || "monthly";
      const planDownPayment = parseFloat(layawayPlan.downPayment) || 0;
      const planNotes = layawayPlan.notes || null;

      const installments = buildLayawayInstallmentSchedule({
        invoiceDate: invoiceDateValue,
        frequency: planFrequency,
        months: planMonths,
        downPayment: planDownPayment,
        totalAmount,
      });

      await (prisma as any).layawayPlan.create({
        data: {
          invoiceId: invoice.id,
          months: planMonths,
          paymentFrequency: planFrequency,
          downPayment: planDownPayment,
          notes: planNotes,
          installments: {
            create: installments.map((inst) => ({
              dueDate: inst.dueDate,
              amount: inst.amount,
              label: inst.label,
              isPaid: false,
            })),
          },
        },
      });
    }

    // Convert Decimal to number for response
    const invAny: any = invoice;
    const serializedInvoice = {
      ...invAny,
      subtotal: invAny.subtotal?.toNumber
        ? invAny.subtotal.toNumber()
        : invAny.subtotal,
      tax: invAny.tax?.toNumber ? invAny.tax.toNumber() : invAny.tax,
      discount: invAny.discount?.toNumber
        ? invAny.discount.toNumber()
        : invAny.discount,
      shippingFee: invAny.shippingFee?.toNumber
        ? invAny.shippingFee.toNumber()
        : invAny.shippingFee,
      insuranceAmount: invAny.insuranceAmount?.toNumber
        ? invAny.insuranceAmount.toNumber()
        : invAny.insuranceAmount,
      layawayFee: invAny.layawayFee?.toNumber
        ? invAny.layawayFee.toNumber()
        : invAny.layawayFee,
      insuranceBaseAmount:
        normalizedInsuranceBaseAmount ??
        (invAny.insuranceBaseAmount?.toNumber
          ? invAny.insuranceBaseAmount.toNumber()
          : invAny.insuranceBaseAmount),
      amount: invAny.amount?.toNumber
        ? invAny.amount.toNumber()
        : invAny.amount,
      paidAmount: invAny.paidAmount?.toNumber
        ? invAny.paidAmount.toNumber()
        : invAny.paidAmount,
    };

    // Invalidate dashboard cache
    invalidateDashboard();

    return NextResponse.json(serializedInvoice);
  } catch (error: any) {
    console.error("Create invoice error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
