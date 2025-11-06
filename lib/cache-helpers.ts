/**
 * Cache Invalidation Helpers
 * 
 * Centralized functions for cache invalidation to maintain consistency
 * across the application.
 * 
 * Usage:
 * import { invalidateDashboard, invalidateDocuments } from '@/lib/cache-helpers';
 * 
 * // After creating/updating an invoice:
 * invalidateDashboard();
 * 
 * // After creating/deleting a folder:
 * invalidateDocuments();
 */

import cache, { CACHE_KEYS } from './cache';

/**
 * Invalidate all dashboard-related caches
 * Call after: invoice/payment creation, update, deletion
 */
export function invalidateDashboard() {
  cache.invalidatePattern('dashboard:.*');
  console.log('[Cache] Invalidated dashboard metrics');
}

/**
 * Invalidate document tree and breadcrumb caches
 * Call after: folder creation, rename, deletion, recovery
 */
export function invalidateDocuments() {
  cache.delete(CACHE_KEYS.DOCUMENT_TREE);
  cache.invalidatePattern('folder:.*:breadcrumb');
  console.log('[Cache] Invalidated document tree and breadcrumbs');
}

/**
 * Invalidate all user list cache
 * Call after: user creation, update, deletion
 */
export function invalidateUsers() {
  cache.delete(CACHE_KEYS.ALL_USERS);
  console.log('[Cache] Invalidated user list');
}

/**
 * Invalidate specific user's cached data
 * Call after: user update, permission change
 */
export function invalidateUser(userId: number) {
  cache.delete(CACHE_KEYS.USER_BY_ID(userId));
  cache.delete(CACHE_KEYS.USER_PERMISSIONS(userId));
  cache.delete(CACHE_KEYS.ALL_USERS);
  console.log(`[Cache] Invalidated caches for user ${userId}`);
}

/**
 * Invalidate invoice-related caches
 * Call after: invoice creation, update, deletion
 */
export function invalidateInvoices() {
  cache.invalidatePattern('invoices:.*');
  invalidateDashboard(); // Invoices affect dashboard metrics
  console.log('[Cache] Invalidated invoice caches');
}

/**
 * Invalidate payment-related caches
 * Call after: payment creation, update, deletion, matching
 */
export function invalidatePayments() {
  cache.invalidatePattern('payments:.*');
  invalidateDashboard(); // Payments affect dashboard metrics
  console.log('[Cache] Invalidated payment caches');
}

/**
 * Invalidate all caches (use sparingly)
 * Call after: major system changes, migrations, or manual admin action
 */
export function invalidateAll() {
  cache.clear();
  console.log('[Cache] Cleared entire cache');
}
