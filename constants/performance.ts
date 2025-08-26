import React from 'react';

// Performance optimization constants and utilities

// Debounce utility for performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility for performance
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Performance constants
export const PERFORMANCE_CONSTANTS = {
  // Limits for data storage
  MAX_WORKOUTS_STORED: 10,
  MAX_COMPLETED_WORKOUTS: 20,
  MAX_RUN_HISTORY: 50,
  MAX_STREAK_DATES: 7,
  
  // Animation durations
  FAST_ANIMATION: 200,
  NORMAL_ANIMATION: 300,
  SLOW_ANIMATION: 500,
  
  // Debounce/throttle timings
  SEARCH_DEBOUNCE: 300,
  SCROLL_THROTTLE: 100,
  RESIZE_THROTTLE: 250,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 50,
  
  // Cache durations (in milliseconds)
  SHORT_CACHE: 5 * 60 * 1000, // 5 minutes
  MEDIUM_CACHE: 30 * 60 * 1000, // 30 minutes
  LONG_CACHE: 24 * 60 * 60 * 1000, // 24 hours
};

// Memory optimization utilities
export const optimizeArray = <T>(array: T[], maxLength: number): T[] => {
  return array.length > maxLength ? array.slice(-maxLength) : array;
};

export const optimizeObject = <T extends Record<string, any>>(
  obj: T,
  keepKeys: (keyof T)[]
): Partial<T> => {
  const optimized: Partial<T> = {};
  keepKeys.forEach(key => {
    if (obj[key] !== undefined) {
      optimized[key] = obj[key];
    }
  });
  return optimized;
};

// React performance utilities
export const createMemoizedComponent = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.memo(Component, (prevProps, nextProps) => {
    // Shallow comparison for most props
    const prevKeys = Object.keys(prevProps) as (keyof P)[];
    const nextKeys = Object.keys(nextProps) as (keyof P)[];
    
    if (prevKeys.length !== nextKeys.length) return false;
    
    return prevKeys.every(key => prevProps[key] === nextProps[key]);
  });
};

// Image optimization
export const getOptimizedImageUrl = (url: string, width?: number, height?: number): string => {
  if (!url) return url;
  
  // For Unsplash images, add optimization parameters
  if (url.includes('unsplash.com')) {
    const params = new URLSearchParams();
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    params.set('fit', 'crop');
    params.set('auto', 'format');
    
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.toString()}`;
  }
  
  return url;
};

// Storage optimization
export const compressStorageData = <T>(data: T): T => {
  if (Array.isArray(data)) {
    return data.slice(-PERFORMANCE_CONSTANTS.MAX_WORKOUTS_STORED) as T;
  }
  
  if (typeof data === 'object' && data !== null) {
    const compressed = { ...data };
    
    // Remove undefined values
    Object.keys(compressed).forEach(key => {
      if ((compressed as any)[key] === undefined) {
        delete (compressed as any)[key];
      }
    });
    
    return compressed;
  }
  
  return data;
};

// Lazy loading utility
export const createLazyLoader = <T>(
  loader: () => Promise<T>,
  fallback: T
) => {
  let cached: T | null = null;
  let loading = false;
  
  return async (): Promise<T> => {
    if (cached) return cached;
    if (loading) return fallback;
    
    loading = true;
    try {
      cached = await loader();
      return cached;
    } catch (error) {
      console.error('Lazy loading failed:', error);
      return fallback;
    } finally {
      loading = false;
    }
  };
};

// Virtual list utilities for large datasets
export const getVisibleItems = <T>(
  items: T[],
  scrollOffset: number,
  containerHeight: number,
  itemHeight: number
): { startIndex: number; endIndex: number; visibleItems: T[] } => {
  const startIndex = Math.floor(scrollOffset / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length - 1
  );
  
  return {
    startIndex,
    endIndex,
    visibleItems: items.slice(startIndex, endIndex + 1)
  };
};

// Memoization cache for expensive calculations
const memoCache = new Map<string, any>();

export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T => {
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (memoCache.has(key)) {
      return memoCache.get(key);
    }
    
    const result = fn(...args);
    memoCache.set(key, result);
    
    // Clean cache if it gets too large
    if (memoCache.size > 100) {
      const firstKey = memoCache.keys().next().value;
      memoCache.delete(firstKey);
    }
    
    return result;
  }) as T;
};

// Performance monitoring utilities
export const measurePerformance = <T>(
  name: string,
  fn: () => T
): T => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  if (__DEV__) {
    console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
  }
  
  return result;
};

// Batch updates utility
export const batchUpdates = <T>(
  updates: (() => void)[],
  callback?: () => void
): void => {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
    callback?.();
  });
};

// Component performance helpers
export const usePerformanceOptimizedState = <T>(
  initialValue: T,
  equalityFn?: (prev: T, next: T) => boolean
) => {
  const [state, setState] = React.useState(initialValue);
  
  const optimizedSetState = React.useCallback((newValue: T | ((prev: T) => T)) => {
    setState(prevState => {
      const nextState = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(prevState)
        : newValue;
      
      if (equalityFn ? equalityFn(prevState, nextState) : prevState === nextState) {
        return prevState;
      }
      
      return nextState;
    });
  }, [equalityFn]);
  
  return [state, optimizedSetState] as const;
};

// Intersection observer hook for lazy loading
export const useIntersectionObserver = (
  callback: (isIntersecting: boolean) => void,
  options?: IntersectionObserverInit
) => {
  const targetRef = React.useRef<HTMLElement>(null);
  
  React.useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => callback(entry.isIntersecting),
      options
    );
    
    observer.observe(target);
    
    return () => observer.disconnect();
  }, [callback, options]);
  
  return targetRef;
};