import { useCallback } from 'react';
import { useMemoizedSelector } from '@/utils/performanceOptimizations';

// Optimized store hook that prevents unnecessary re-renders
export function useOptimizedStore(useStore, selector, deps = []) {
  const memoizedSelector = useMemoizedSelector(selector, deps);
  return useStore(memoizedSelector);
}

// Shallow comparison for object selectors
export function shallowEqual(objA, objB) {
  if (objA === objB) return true;
  
  if (!objA || !objB) return false;
  
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  
  if (keysA.length !== keysB.length) return false;
  
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!objB.hasOwnProperty(key) || objA[key] !== objB[key]) {
      return false;
    }
  }
  
  return true;
}

// Create optimized selectors for common patterns
export const createOptimizedSelectors = () => ({
  // Select multiple fields with shallow comparison
  selectFields: (fields) => 
    (state) => {
      const result = {};
      fields.forEach(field => {
        result[field] = state[field];
      });
      return result;
    },
  
  // Select array length instead of full array
  selectArrayLength: (field) =>
    (state) => {
      const value = state[field];
      return Array.isArray(value) ? value.length : 0;
    },
  
  // Select computed values
  selectComputed: (computeFn) =>
    (state) => computeFn(state),
});

// Performance monitoring for store subscriptions
export function useStorePerformanceMonitor(storeName, selector) {
  return useCallback((state) => {
    if (__DEV__) {
      const start = performance.now();
      const result = selector(state);
      const end = performance.now();
      
      if (end - start > 1) {
        console.warn(`Slow selector in ${storeName}: ${end - start}ms`);
      }
      
      return result;
    }
    return selector(state);
  }, [storeName, selector]);
}