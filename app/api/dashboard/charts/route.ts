import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import {
  endOfBusinessDay,
  formatBusinessDate,
  startOfBusinessDay,
  toBusinessDateString,
} from "../../../../lib/business-date";

interface DateRange {
  start: Date;
  end: Date;
}

function getDateRange(
  period: string,
  customStart?: string,
  customEnd?: string,
): DateRange {
  let end = endOfBusinessDay(new Date());
  let start = startOfBusinessDay(new Date());

  switch (period) {
    case "7":
      start = startOfBusinessDay(
        new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000),
      );
      break;
    case "30":
      start = startOfBusinessDay(
        new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000),
      );
      break;
    case "90":
      start = startOfBusinessDay(
        new Date(start.getTime() - 90 * 24 * 60 * 60 * 1000),
      );
      break;
    case "custom":
      if (customStart && customEnd) {
        start = startOfBusinessDay(customStart);
        end = endOfBusinessDay(customEnd);
      }
      break;
    default:
      start = startOfBusinessDay(
        new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000),
      );
  }

  return { start, end };
}

function formatDate(date: Date): string {
  return formatBusinessDate(date, { month: "short", day: "numeric" });
}

function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  let current = startOfBusinessDay(start);
  const endDay = startOfBusinessDay(end);

  while (current.getTime() <= endDay.getTime()) {
    dates.push(new Date(current));
    current = startOfBusinessDay(
      new Date(current.getTime() + 24 * 60 * 60 * 1000),
    );
  }

  return dates;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30";
    const customStart = searchParams.get("start");
    const customEnd = searchParams.get("end");

    const { start, end } = getDateRange(
      period,
      customStart || undefined,
      customEnd || undefined,
    );

    // Fetch invoices within date range
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
      },
    });

    // Fetch payment methods
    const allMethods = await prisma.paymentMethodEntry.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    // Fetch payments within date range
    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        amount: true,
        methodId: true,
        paymentDate: true,
      },
    });

    // Generate revenue chart data (invoices by day)
    const dates = getDatesInRange(start, end);
    const revenueData: { [key: string]: number } = {};

    dates.forEach((date) => {
      const dateStr = toBusinessDateString(date);
      revenueData[dateStr] = 0;
    });

    invoices.forEach((invoice) => {
      const dateStr = toBusinessDateString(invoice.createdAt);
      if (revenueData[dateStr] !== undefined) {
        revenueData[dateStr] += invoice.amount.toNumber();
      }
    });

    const revenueChartData = {
      dates: dates.map((d) => formatDate(d)),
      values: Object.values(revenueData),
    };

    // Generate payment methods breakdown over time (dynamic)
    const paymentMethodData: {
      [methodId: number]: { [date: string]: number };
    } = {};

    for (const m of allMethods) {
      paymentMethodData[m.id] = {};
      dates.forEach((date) => {
        paymentMethodData[m.id][toBusinessDateString(date)] = 0;
      });
    }

    payments.forEach((payment) => {
      const dateStr = toBusinessDateString(payment.paymentDate);
      if (paymentMethodData[payment.methodId]?.[dateStr] !== undefined) {
        paymentMethodData[payment.methodId][dateStr] +=
          payment.amount.toNumber();
      }
    });

    const dateKeys = dates.map((d) => toBusinessDateString(d));
    const enrichedMethods = allMethods.map((m) => {
      const values = dateKeys.map((ds) => paymentMethodData[m.id]?.[ds] ?? 0);
      const total = values.reduce((s, v) => s + v, 0);
      return {
        id: m.id,
        name: m.name,
        color: m.color,
        values,
        total,
      };
    });
    enrichedMethods.sort((a, b) => b.total - a.total);

    const MAX_SERIES = 8;
    let chartMethods: {
      id: number;
      name: string;
      color: string | null;
      values: number[];
    }[];

    if (enrichedMethods.length <= MAX_SERIES) {
      chartMethods = enrichedMethods.map(({ total: _t, ...r }) => r);
    } else {
      const keep = enrichedMethods.slice(0, MAX_SERIES - 1);
      const drop = enrichedMethods.slice(MAX_SERIES - 1);
      const otherValues = dateKeys.map((_, i) =>
        drop.reduce((s, m) => s + m.values[i], 0),
      );
      chartMethods = [
        ...keep.map(({ total: _t, ...r }) => r),
        {
          id: -1,
          name: "Other",
          color: "#9CA3AF",
          values: otherValues,
        },
      ];
    }

    const paymentMethodsChartData: any = {
      dates: dates.map((d) => formatDate(d)),
      methods: chartMethods,
    };

    // Calculate totals for summary
    const totalRevenue = invoices.reduce(
      (sum, inv) => sum + inv.amount.toNumber(),
      0,
    );
    const totalPayments = payments.reduce(
      (sum, pay) => sum + pay.amount.toNumber(),
      0,
    );
    const paymentsByMethod: Record<string, number> = {};
    for (const m of allMethods) {
      paymentsByMethod[m.name.toLowerCase()] = payments
        .filter((p) => p.methodId === m.id)
        .reduce((sum, p) => sum + p.amount.toNumber(), 0);
    }

    return NextResponse.json({
      revenueChart: revenueChartData,
      paymentMethodsChart: paymentMethodsChartData,
      summary: {
        totalRevenue,
        totalPayments,
        paymentsByMethod,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          days: dates.length,
        },
      },
    });
  } catch (error: any) {
    console.error("Chart data error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
