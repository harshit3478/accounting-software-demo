import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth } from "../../../lib/auth";
import {
  generateInvoiceNumber,
  calculateInvoiceStatus,
} from "../../../lib/invoice-utils";
import {
  calculateInsuranceAmount,
  DEFAULT_INSURANCE_BANDS,
  type InsuranceBand,
} from "../../../lib/insurance";
import { invalidateDashboard } from "../../../lib/cache-helpers";

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

    // Sort params
    const sortBy = searchParams.get("sortBy") || "date";
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

    // By default, exclude inactive/abandoned invoices unless explicitly requested
    if (
      status === "inactive" ||
      (status === "abandoned" && supportsAbandonedStatus)
    ) {
      where.status = status;
    } else if (showInactive) {
      // Show all including inactive/abandoned — no status filter applied here
    } else {
      // Default: exclude inactive/abandoned
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

    // Status filter (applied on top of inactive exclusion)
    if (status !== "all" && status !== "inactive" && status !== "abandoned") {
      where.status = status;
    }

    // Customer filter — see all invoices for a specific client
    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    // Type filter
    if (type === "layaway") {
      where.isLayaway = true;
    } else if (type === "cash") {
      where.isLayaway = false;
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
      shippingFeeRule: true,
      customer: true,
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
      default:
        orderBy = { createdAt: sortDirection };
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
      editHistory: (invoice.editHistory || []).map((entry: any) => ({
        ...entry,
        createdAt: entry.createdAt?.toISOString
          ? entry.createdAt.toISOString()
          : entry.createdAt,
      })),
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
      shippingFee,
      shippingFeeRuleId,
      insuranceAmount,
      insuranceBaseAmount,
    } = await request.json();

    const normalizedClientName =
      typeof clientName === "string" ? clientName.trim() : "";
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
        select: { id: true },
      });

      if (!existingCustomer) {
        return NextResponse.json(
          { error: "Selected customer not found" },
          { status: 404 },
        );
      }

      resolvedCustomerId = existingCustomer.id;
    } else {
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
    const totalAmount =
      preShippingTotal + parseFloat(shippingFeeAmount) + insuranceFeeAmount;

    // Handle terms: either attach default, attach existing terms by id, or create new terms
    let attachedTermsId: number | null = null;
    let termsSnapshot: any = null;

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

    const invoice = await (prisma as any).invoice.create({
      data: {
        userId: user.id,
        invoiceNumber,
        clientName: normalizedClientName,
        items: items || null,
        subtotal: parseFloat(subtotal),
        tax: parseFloat(taxAmount),
        discount: parseFloat(discountAmount),
        shippingFee: parseFloat(shippingFeeAmount),
        insuranceAmount: insuranceFeeAmount,
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
        source: source || "manual",
        termsId: attachedTermsId,
        termsSnapshot: termsSnapshot || null,
        shippingFeeRuleId: shippingFeeRuleId || null,
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

      const remaining = totalAmount - planDownPayment;
      let numInstallments: number;
      if (planFrequency === "monthly") numInstallments = planMonths;
      else if (planFrequency === "bi-weekly") numInstallments = planMonths * 2;
      else numInstallments = planMonths * 4; // weekly

      const installmentAmount =
        numInstallments > 0 ? remaining / numInstallments : 0;
      const planBaseDate = new Date(invoiceDateValue);

      const installments: { dueDate: Date; amount: number; label: string }[] =
        [];

      if (planDownPayment > 0) {
        installments.push({
          dueDate: planBaseDate,
          amount: planDownPayment,
          label: "Down Payment",
        });
      }

      for (let i = 1; i <= numInstallments; i++) {
        const instDate = new Date(planBaseDate);
        if (planFrequency === "monthly") {
          instDate.setMonth(instDate.getMonth() + i);
        } else if (planFrequency === "bi-weekly") {
          instDate.setDate(instDate.getDate() + i * 14);
        } else {
          instDate.setDate(instDate.getDate() + i * 7);
        }

        const suffix = i === 1 ? "st" : i === 2 ? "nd" : i === 3 ? "rd" : "th";
        installments.push({
          dueDate: instDate,
          amount: installmentAmount,
          label: `${i}${suffix} Payment`,
        });
      }

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
