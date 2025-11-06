/**
 * Simple In-Memory Cache for Frequently Accessed Data
 * 
 * This is a lightweight, in-process caching solution that serves as
 * an alternative to Redis for small datasets like user permissions,
 * system settings, and other frequently-accessed data.
 * 
 * Benefits:
 * - Zero external dependencies
 * - No network overhead
 * - Perfect for single-instance deployments
 * - Automatic TTL (Time To Live) management
 * - Memory-safe with size limits
 * 
 * Limitations:
 * - Not shared across multiple server instances
 * - Data lost on server restart
 * - Not suitable for large datasets (> 10MB)
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<any>>;
  private stats: CacheStats;
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) {
    // maxSize: Maximum number of entries (default 1000)
    // defaultTTL: Default time-to-live in milliseconds (default 5 minutes)
    this.cache = new Map();
    this.stats = {
      size: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
    };
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Set a value in the cache with optional TTL
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Enforce size limit
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
    this.stats.size = this.cache.size;
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache hit rate percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : (this.stats.hits / total) * 100;
  }

  /**
   * Private: Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.size = this.cache.size;
      console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Private: Evict oldest entry when cache is full
   */
  private evictOldest(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }
}

// Singleton instance
const cache = new InMemoryCache(
  parseInt(process.env.CACHE_MAX_SIZE || '1000'),
  parseInt(process.env.CACHE_DEFAULT_TTL || '300000')
);

export default cache;

// Export cache keys constants for consistency
export const CACHE_KEYS = {
  // User-related
  USER_BY_ID: (id: number) => `user:${id}`,
  USER_PERMISSIONS: (id: number) => `user:${id}:permissions`,
  ALL_USERS: 'users:all',

  // Dashboard metrics
  DASHBOARD_METRICS: (userId: number) => `dashboard:${userId}`,
  
  // Document tree (rarely changes, cache for 10 minutes)
  DOCUMENT_TREE: 'documents:tree',
  FOLDER_BREADCRUMB: (id: number) => `folder:${id}:breadcrumb`,
  
  // Invoice/Payment aggregates
  INVOICE_STATS: 'invoices:stats',
  PAYMENT_STATS: 'payments:stats',
};

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  SHORT: 60 * 1000,           // 1 minute
  MEDIUM: 5 * 60 * 1000,      // 5 minutes
  LONG: 10 * 60 * 1000,       // 10 minutes
  VERY_LONG: 30 * 60 * 1000,  // 30 minutes
};
