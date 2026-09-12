import prisma from "./prisma";
import { Prisma } from "@prisma/client";
import {
  toBusinessDateStringFromInput,
} from "./business-date";
import { creditEarlyDiscountOverpaymentAsStoreCredit } from "./early-payment-discount";
import {
  calculateShippingDiscountOffer,
  calculateUnitDiscountOffer,
  getUnitDiscountPayByDate,
  normalizeUnitDiscountOfferJson,
  parseShippingDiscountOffer,
  parseShippingThresholds,
  parseUnitDiscountOffer,
  roundMoney,
  type ShippingDiscountOfferSnapshot,
  type UnitDiscountItemLike,
  type UnitDiscountOfferSnapshot,
  type UnitDiscountSettingSnapshot,
} from "./unit-discount-shared";

export type {
  DiscountKind,
  ShippingDiscountOfferSnapshot,
  ShippingDiscountThreshold,
  UnitDiscountBreakdownLine,
  UnitDiscountOfferSnapshot,
  UnitDiscountSettingSnapshot,
} from "./unit-discount-shared";

export {
  calculateShippingDiscountOffer,
  calculateUnitDiscountOffer,
  DISCOUNT_KIND_SHIPPING_CREDIT,
  DISCOUNT_KIND_UNIT_PERCENT,
  formatShippingThresholdSummary,
  getDiscountKind,
  getUnitDiscountDisplayState,
  liveTypeScopesOverlap,
  parseShippingDiscountOffer,
  parseShippingThresholds,
  parseUnitDiscountOffer,
  normalizeUnitDiscountOfferJson,
  roundMoney,
  validateShippingThresholds,
} from "./unit-discount-shared";

function serializeSetting(row: any): UnitDiscountSettingSnapshot {
  const liveType = row.liveType || null;
  return {
    id: Number(row.id),
    kind:
      row.kind === "shipping_credit" ? "shipping_credit" : "unit_percent",
    name: String(row.name || ""),
    unitName: String(row.unitName || ""),
    discountPercent: Number(
      row.discountPercent?.toNumber?.() ?? row.discountPercent ?? 0,
    ),
    periodStart: toBusinessDateStringFromInput(row.periodStart),
    periodEnd: toBusinessDateStringFromInput(row.periodEnd),
    isActive: !!row.isActive,
    liveTypeId: row.liveTypeId == null ? null : Number(row.liveTypeId),
    liveTypeName: liveType?.name ? String(liveType.name) : null,
    liveTypeCountry: liveType?.country ? String(liveType.country) : null,
    thresholds: parseShippingThresholds(row.thresholds),
  };
}

export async function getUnitDiscountSettings(options?: {
  activeOnly?: boolean;
}): Promise<UnitDiscountSettingSnapshot[]> {
  const model = (prisma as any)?.unitDiscountSetting;
  if (!model) return [];

  const rows = await model.findMany({
    where: options?.activeOnly ? { isActive: true } : undefined,
    include: {
      liveType: {
        select: { id: true, name: true, country: true },
      },
    },
    orderBy: [{ periodStart: "desc" }, { unitName: "asc" }, { id: "desc" }],
  }).catch(async () =>
    model.findMany({
      where: options?.activeOnly ? { isActive: true } : undefined,
      orderBy: [{ periodStart: "desc" }, { unitName: "asc" }, { id: "desc" }],
    }),
  );

  return Array.isArray(rows) ? rows.map(serializeSetting) : [];
}

export async function buildUnitDiscountOfferForInvoice(input: {
  items?: UnitDiscountItemLike[] | null;
  invoiceDate?: string | Date | null;
  isLayaway?: boolean;
}): Promise<UnitDiscountOfferSnapshot | null> {
  const settings = await getUnitDiscountSettings({ activeOnly: true });
  return calculateUnitDiscountOffer({
    items: input.items,
    invoiceDate: input.invoiceDate,
    isLayaway: input.isLayaway,
    settings,
  });
}

export async function buildShippingDiscountOfferForInvoice(input: {
  items?: UnitDiscountItemLike[] | null;
  invoiceDate?: string | Date | null;
  isLayaway?: boolean;
  shippingFee?: number | string | null;
  invoiceTotal?: number | string | null;
}): Promise<ShippingDiscountOfferSnapshot | null> {
  const settings = await getUnitDiscountSettings({ activeOnly: true });
  return calculateShippingDiscountOffer({
    items: input.items,
    invoiceDate: input.invoiceDate,
    isLayaway: input.isLayaway,
    shippingFee: input.shippingFee,
    invoiceTotal: input.invoiceTotal,
    settings,
  });
}

function getLatestPaymentDate(invoice: {
  payments: Array<{ paymentDate: Date; source?: string | null }>;
  paymentMatches?: Array<{ payment: { paymentDate: Date } | null }>;
}): Date | null {
  const dates: Date[] = [];

  for (const payment of invoice.payments) {
    if (payment.source === "late_fee") continue;
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

export async function maybeApplyUnitDiscount(
  tx: any,
  input: {
    invoice: {
      id: number;
      invoiceNumber: string;
      amount: Prisma.Decimal | number;
      paidAmount: Prisma.Decimal | number;
      unitDiscountAmount?: Prisma.Decimal | number | null;
      unitDiscountOffer?: unknown;
      invoiceDate?: string | Date | null;
      status: string;
      isLayaway?: boolean;
      payments: Array<{ paymentDate: Date; source?: string | null }>;
      paymentMatches?: Array<{ payment: { paymentDate: Date } | null }>;
    };
    totalPaid: number;
  },
): Promise<number | null> {
  const invoice = input.invoice;
  if (invoice.isLayaway) return null;
  if (invoice.status === "abandoned" || invoice.status === "inactive") {
    return null;
  }

  const existingDiscount = Number(
    (invoice.unitDiscountAmount as any)?.toNumber?.() ??
      invoice.unitDiscountAmount ??
      0,
  );
  if (existingDiscount > 0) return null;

  const offer = parseUnitDiscountOffer(invoice.unitDiscountOffer);
  if (!offer) return null;

  const invoiceAmount = Number(
    (invoice.amount as any)?.toNumber?.() ?? invoice.amount ?? 0,
  );
  if (invoiceAmount <= 0 || offer.totalDiscount <= 0) return null;

  const discountedTotal = roundMoney(
    Math.max(invoiceAmount - offer.totalDiscount, 0),
  );
  if (input.totalPaid + 0.01 < discountedTotal) return null;

  const latestPaymentDate = getLatestPaymentDate(invoice);
  if (!latestPaymentDate) return null;

  const paymentDateStr = toBusinessDateStringFromInput(latestPaymentDate);
  const payByDate = getUnitDiscountPayByDate(invoice.invoiceDate);
  if (!paymentDateStr || !payByDate || paymentDateStr > payByDate) {
    return null;
  }

  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      unitDiscountAmount: offer.totalDiscount,
      amount: discountedTotal,
    },
  });

  return offer.totalDiscount;
}

export async function creditUnitDiscountOverpaymentAsStoreCredit(input: {
  customerId: number;
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  methodId: number;
  userId: number;
}): Promise<number> {
  return creditEarlyDiscountOverpaymentAsStoreCredit({
    ...input,
    notes: `Store credit from unit discount on ${input.invoiceNumber}`,
    reason: `Unit discount overpayment on ${input.invoiceNumber}`,
  });
}

export function toUnitDiscountOfferJson(
  offer: UnitDiscountOfferSnapshot | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (!offer) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(offer)) as unknown as Prisma.InputJsonValue;
}

export function toShippingDiscountOfferJson(
  offer: ShippingDiscountOfferSnapshot | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (!offer) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(offer)) as unknown as Prisma.InputJsonValue;
}

export function serializeUnitDiscountOfferField(
  offerValue: unknown,
  invoiceDate?: string | Date | null,
): UnitDiscountOfferSnapshot | null {
  return normalizeUnitDiscountOfferJson(offerValue, invoiceDate);
}

export function serializeShippingDiscountOfferField(
  offerValue: unknown,
): ShippingDiscountOfferSnapshot | null {
  return parseShippingDiscountOffer(offerValue);
}

export async function persistNormalizedUnitDiscountOffers(
  invoices: Array<{
    id: number;
    unitDiscountOffer?: unknown;
    invoiceDate?: string | Date | null;
    createdAt?: string | Date | null;
  }>,
): Promise<void> {
  const updates = invoices.flatMap((invoice) => {
    const invoiceDate = invoice.invoiceDate || invoice.createdAt;
    const normalized = normalizeUnitDiscountOfferJson(
      invoice.unitDiscountOffer,
      invoiceDate,
    );
    if (!normalized) return [];
    const current = parseUnitDiscountOffer(invoice.unitDiscountOffer);
    if (current?.paymentDueDate === normalized.paymentDueDate) return [];
    return [{ id: invoice.id, offer: normalized }];
  });
  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.map((row) =>
      (prisma as any).invoice.update({
        where: { id: row.id },
        data: { unitDiscountOffer: toUnitDiscountOfferJson(row.offer) },
      }),
    ),
  );
}
