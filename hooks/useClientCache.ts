/**
 * Client-Side Cache Hook
 * 
 * Implements SWR-like caching for API requests on the frontend.
 * Reduces redundant API calls and provides instant UI updates.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache (persists across component remounts)
const cache = new Map<string, CacheEntry<any>>();

interface UseClientCacheOptions {
  staleTime?: number; // Time in ms before data is considered stale (default: 5 minutes)
  cacheTime?: number; // Time in ms before cache is cleared (default: 10 minutes)
  refetchOnMount?: boolean; // Refetch when component mounts (default: true if stale)
  refetchInterval?: number; // Auto-refetch interval in ms (default: null)
}

export function useClientCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseClientCacheOptions = {}
) {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
    refetchOnMount = true,
    refetchInterval = null,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isStale = useCallback(() => {
    const cached = cache.get(key);
    if (!cached) return true;
    return Date.now() - cached.timestamp > staleTime;
  }, [key, staleTime]);

  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setIsLoading(true);
      setIsValidating(true);

      try {
        const result = await fetcher();
        
        if (mountedRef.current) {
          setData(result);
          setError(null);
          
          // Update cache
          cache.set(key, {
            data: result,
            timestamp: Date.now(),
          });

          // Schedule cache cleanup
          setTimeout(() => {
            cache.delete(key);
          }, cacheTime);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err as Error);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setIsValidating(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, cacheTime] // Intentionally exclude fetcher to prevent infinite loops
  );

  const mutate = useCallback(
    async (newData?: T | ((current: T | null) => T)) => {
      // Optimistic update
      if (newData !== undefined) {
        const updatedData = typeof newData === 'function' 
          ? (newData as (current: T | null) => T)(data)
          : newData;
        
        setData(updatedData);
        cache.set(key, {
          data: updatedData,
          timestamp: Date.now(),
        });
      }

      // Revalidate
      await fetchData(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, data] // Intentionally exclude fetchData - it's stable enough
  );

  const invalidate = useCallback(() => {
    cache.delete(key);
    fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Intentionally exclude fetchData - it's stable enough

  useEffect(() => {
    mountedRef.current = true;

    // Check cache first
    const cached = cache.get(key);
    if (cached && !isStale()) {
      setData(cached.data);
      setIsLoading(false);
      
      // Still fetch in background if refetchOnMount is true
      if (refetchOnMount) {
        fetchData(true);
      }
    } else {
      fetchData(false);
    }

    // Setup auto-refetch interval
    if (refetchInterval && refetchInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData(true);
      }, refetchInterval);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only re-run when key changes, not when fetchData changes

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    invalidate,
  };
}

// Helper to invalidate cache by pattern
export function invalidateCachePattern(pattern: string) {
  const regex = new RegExp(pattern);
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
}

// Helper to clear all cache
export function clearCache() {
  cache.clear();
}

// Helper to get cache stats
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
