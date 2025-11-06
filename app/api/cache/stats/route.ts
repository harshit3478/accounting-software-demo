import { NextResponse } from 'next/server';
import cache from '@/lib/cache';
import { requireAdmin } from '@/lib/auth';

/**
 * Cache Statistics Endpoint
 * 
 * GET /api/cache/stats - View cache performance metrics
 * DELETE /api/cache/stats - Clear entire cache (admin only)
 */

export async function GET() {
  try {
    await requireAdmin();

    const stats = cache.getStats();
    const hitRate = cache.getHitRate();

    return NextResponse.json({
      stats: {
        ...stats,
        hitRate: `${hitRate.toFixed(2)}%`,
        hitRateRaw: hitRate,
      },
      health: {
        status: hitRate > 70 ? 'excellent' : hitRate > 50 ? 'good' : 'poor',
        message:
          hitRate > 70
            ? 'Cache is performing well'
            : hitRate > 50
            ? 'Cache performance is acceptable'
            : 'Consider adjusting TTL values or cache strategy',
      },
      recommendations:
        hitRate < 50
          ? [
              'Increase cache TTL for stable data',
              'Review cache invalidation strategy',
              'Check if data is too volatile for caching',
            ]
          : [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();

    cache.clear();

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
