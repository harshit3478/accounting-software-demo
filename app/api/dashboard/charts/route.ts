import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';

interface DateRange {
  start: Date;
  end: Date;
}

function getDateRange(period: string, customStart?: string, customEnd?: string): DateRange {
  const end = new Date();
  let start = new Date();

  switch (period) {
    case '7':
      start.setDate(end.getDate() - 7);
      break;
    case '30':
      start.setDate(end.getDate() - 30);
      break;
    case '90':
      start.setDate(end.getDate() - 90);
      break;
    case 'custom':
      if (customStart && customEnd) {
        start = new Date(customStart);
        end.setTime(new Date(customEnd).getTime());
      }
      break;
    default:
      start.setDate(end.getDate() - 30);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';
    const customStart = searchParams.get('start');
    const customEnd = searchParams.get('end');

    const { start, end } = getDateRange(period, customStart || undefined, customEnd || undefined);

    // Fetch invoices within date range
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        amount: true,
        createdAt: true
      }
    });

    // Fetch payment methods
    const allMethods = await prisma.paymentMethodEntry.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });

    // Fetch payments within date range
    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        amount: true,
        methodId: true,
        paymentDate: true
      }
    });

    // Generate revenue chart data (invoices by day)
    const dates = getDatesInRange(start, end);
    const revenueData: { [key: string]: number } = {};
    
    dates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      revenueData[dateStr] = 0;
    });

    invoices.forEach(invoice => {
      const dateStr = invoice.createdAt.toISOString().split('T')[0];
      if (revenueData[dateStr] !== undefined) {
        revenueData[dateStr] += invoice.amount.toNumber();
      }
    });

    const revenueChartData = {
      dates: dates.map(d => formatDate(d)),
      values: Object.values(revenueData)
    };

    // Generate payment methods breakdown over time (dynamic)
    const methodMap = new Map(allMethods.map(m => [m.id, m]));
    const paymentMethodData: { [methodId: number]: { [date: string]: number } } = {};

    for (const m of allMethods) {
      paymentMethodData[m.id] = {};
      dates.forEach(date => {
        paymentMethodData[m.id][date.toISOString().split('T')[0]] = 0;
      });
    }

    payments.forEach(payment => {
      const dateStr = payment.paymentDate.toISOString().split('T')[0];
      if (paymentMethodData[payment.methodId]?.[dateStr] !== undefined) {
        paymentMethodData[payment.methodId][dateStr] += payment.amount.toNumber();
      }
    });

    // Build dynamic chart data keyed by method name
    const paymentMethodsChartData: any = {
      dates: dates.map(d => formatDate(d)),
      methods: allMethods.map(m => ({
        id: m.id,
        name: m.name,
        color: m.color,
        values: Object.values(paymentMethodData[m.id] || {}),
      })),
    };

    // Calculate totals for summary
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount.toNumber(), 0);
    const totalPayments = payments.reduce((sum, pay) => sum + pay.amount.toNumber(), 0);
    const paymentsByMethod: Record<string, number> = {};
    for (const m of allMethods) {
      paymentsByMethod[m.name.toLowerCase()] = payments
        .filter(p => p.methodId === m.id)
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
          days: dates.length
        }
      }
    });
  } catch (error: any) {
    console.error('Chart data error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
