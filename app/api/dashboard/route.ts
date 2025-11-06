import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireAuth } from '../../../lib/auth';
import cache from '../../../lib/cache';

export async function GET() {
  try {
    const user = await requireAuth();

    // Create cache key based on user role
    const cacheKey = user.role === 'admin' 
      ? 'dashboard:admin:metrics'
      : `dashboard:user:${user.id}:metrics`;

    // Try cache first
    const cachedMetrics = cache.get(cacheKey);
    if (cachedMetrics) {
      return NextResponse.json(cachedMetrics);
    }

    // Cache miss - compute from database
    const where = user.role === 'admin' ? {} : { userId: user.id };

    const invoices = await prisma.invoice.findMany({ where });
    const payments = await prisma.payment.findMany({ where });

    const outstanding = invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);

    const pending = invoices.filter(inv => inv.status === 'pending').length;
    const revenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const customers = new Set(invoices.map(inv => inv.clientName)).size;

    const metrics = {
      outstanding,
      pending,
      revenue,
      customers,
    };

    // Cache for 2 minutes
    cache.set(cacheKey, metrics, 2 * 60 * 1000);

    return NextResponse.json(metrics);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}