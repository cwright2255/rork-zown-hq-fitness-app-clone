import { useEffect, useRef } from 'react';

// Shallow comparison utility for store subscriptions
export const shallowEqual = <T>(a: T, b: T): boolean => {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a as any);
  const keysB = Object.keys(b as any);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key) || (a as any)[key] !== (b as any)[key]) {
      return false;
    }
  }
  
  return true;
};

// Optimized store selector hook
export const useStoreSelector = <T, R>(
  store: () => T,
  selector: (state: T) => R,
  equalityFn: (a: R, b: R) => boolean = shallowEqual
) => {
  const stateRef = useRef<R>();
  const selectorRef = useRef(selector);
  const equalityFnRef = useRef(equalityFn);
  
  // Update refs
  selectorRef.current = selector;
  equalityFnRef.current = equalityFn;
  
  const state = store();
  const selectedState = selectorRef.current(state);
  
  if (!stateRef.current || !equalityFnRef.current(stateRef.current, selectedState)) {
    stateRef.current = selectedState;
  }
  
  return stateRef.current;
};

// Debounced state update utility
export const useDebouncedUpdate = <T>(
  value: T,
  delay: number,
  callback: (value: T) => void
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(value);
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, callback]);
};

// Batch state updates utility
export const batchStateUpdates = (updates: (() => void)[]) => {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
};

// Memory-efficient array operations
export const optimizeArrayForPerformance = <T>(
  array: T[],
  maxLength: number = 50
): T[] => {
  if (array.length <= maxLength) return array;
  return array.slice(-maxLength);
};

// Memoization cache for expensive calculations
const memoCache = new Map<string, { value: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const memoizeWithTTL = <T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string,
  ttl: number = CACHE_TTL
): T => {
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    const now = Date.now();
    
    const cached = memoCache.get(key);
    if (cached && (now - cached.timestamp) < ttl) {
      return cached.value;
    }
    
    const result = fn(...args);
    memoCache.set(key, { value: result, timestamp: now });
    
    // Clean expired entries
    if (memoCache.size > 100) {
      for (const [cacheKey, cacheValue] of memoCache.entries()) {
        if ((now - cacheValue.timestamp) > ttl) {
          memoCache.delete(cacheKey);
        }
      }
    }
    
    return result;
  }) as T;
};

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string, enabled: boolean = __DEV__) => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  
  useEffect(() => {
    if (!enabled) return;
    
    renderCountRef.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;
    
    if (timeSinceLastRender > 100) { // Only log slow renders
      console.log(
        `[Performance] ${componentName} - Render #${renderCountRef.current}, ` +
        `Time since last render: ${timeSinceLastRender}ms`
      );
    }
  });
  
  return {
    renderCount: renderCountRef.current,
    lastRenderTime: lastRenderTimeRef.current
  };
};

// Optimized image loading with retry logic
export const createOptimizedImageLoader = (maxRetries: number = 3) => {
  const loadImage = async (uri: string, retryCount: number = 0): Promise<string> => {
    try {
      // Simple validation for now
      if (!uri || typeof uri !== 'string') {
        throw new Error('Invalid URI');
      }
      
      return uri;
    } catch (error) {
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return loadImage(uri, retryCount + 1);
      }
      throw error;
    }
  };
  
  return loadImage;
};

// Virtual scrolling utilities
export const calculateVisibleRange = (
  scrollOffset: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 3
) => {
  const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems - 1,
    Math.ceil((scrollOffset + containerHeight) / itemHeight) + overscan
  );
  
  return { startIndex, endIndex };
};

// Throttled scroll handler
export const createThrottledScrollHandler = (
  handler: (event: any) => void,
  delay: number = 16
) => {
  let lastCall = 0;
  
  return (event: any) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      handler(event);
      lastCall = now;
    }
  };
};