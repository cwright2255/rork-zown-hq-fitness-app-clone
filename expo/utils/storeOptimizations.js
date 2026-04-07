import { useEffect, useRef } from 'react';

// Shallow comparison utility for store subscriptions
export const shallowEqual = (a, b) => {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key) || a[key] !== b[key]) {
      return false;
    }
  }
  
  return true;
};

// Optimized store selector hook
export const useStoreSelector = (store, selector, equalityFn = shallowEqual) => {
  const stateRef = useRef();
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
export const useDebouncedUpdate = (value, delay, callback) => {
  const timeoutRef = useRef();
  
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
export const batchStateUpdates = (updates) => {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
};

// Memory-efficient array operations
export const optimizeArrayForPerformance = (array, maxLength = 50) => {
  if (array.length <= maxLength) return array;
  return array.slice(-maxLength);
};

// Memoization cache for expensive calculations
const memoCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const memoizeWithTTL = (fn, keyGenerator, ttl = CACHE_TTL) => {
  return (...args) => {
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
  };
};

// Performance monitoring hook
export const usePerformanceMonitor = (componentName, enabled = __DEV__) => {
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
export const createOptimizedImageLoader = (maxRetries = 3) => {
  const loadImage = async (uri, retryCount = 0) => {
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
  scrollOffset,
  containerHeight,
  itemHeight,
  totalItems,
  overscan = 3
) => {
  const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems - 1,
    Math.ceil((scrollOffset + containerHeight) / itemHeight) + overscan
  );
  
  return { startIndex, endIndex };
};

// Throttled scroll handler
export const createThrottledScrollHandler = (handler, delay = 16) => {
  let lastCall = 0;
  
  return (event) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      handler(event);
      lastCall = now;
    }
  };
};