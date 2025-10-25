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
        method: true,
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

    // Generate payment methods breakdown over time
    const paymentMethodData: { [method: string]: { [date: string]: number } } = {
      cash: {},
      zelle: {},
      quickbooks: {},
      layaway: {}
    };

    dates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      Object.keys(paymentMethodData).forEach(method => {
        paymentMethodData[method][dateStr] = 0;
      });
    });

    payments.forEach(payment => {
      const dateStr = payment.paymentDate.toISOString().split('T')[0];
      const method = payment.method.toLowerCase();
      if (paymentMethodData[method] && paymentMethodData[method][dateStr] !== undefined) {
        paymentMethodData[method][dateStr] += payment.amount.toNumber();
      }
    });

    const paymentMethodsChartData = {
      dates: dates.map(d => formatDate(d)),
      cash: Object.values(paymentMethodData.cash),
      zelle: Object.values(paymentMethodData.zelle),
      quickbooks: Object.values(paymentMethodData.quickbooks),
      layaway: Object.values(paymentMethodData.layaway)
    };

    // Calculate totals for summary
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount.toNumber(), 0);
    const totalPayments = payments.reduce((sum, pay) => sum + pay.amount.toNumber(), 0);
    const paymentsByMethod = {
      cash: payments.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount.toNumber(), 0),
      zelle: payments.filter(p => p.method === 'zelle').reduce((sum, p) => sum + p.amount.toNumber(), 0),
      quickbooks: payments.filter(p => p.method === 'quickbooks').reduce((sum, p) => sum + p.amount.toNumber(), 0),
      layaway: payments.filter(p => p.method === 'layaway').reduce((sum, p) => sum + p.amount.toNumber(), 0)
    };

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
