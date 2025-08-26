import { useCallback, useMemo } from 'react';
import { useMemoizedSelector } from '@/utils/performanceOptimizations';

// Optimized store hook that prevents unnecessary re-renders
export function useOptimizedStore<T, R>(
  useStore: (selector: (state: T) => R) => R,
  selector: (state: T) => R,
  deps: any[] = []
) {
  const memoizedSelector = useMemoizedSelector(selector, deps);
  return useStore(memoizedSelector);
}

// Shallow comparison for object selectors
export function shallowEqual(objA: any, objB: any): boolean {
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
export const createOptimizedSelectors = <T>() => ({
  // Select multiple fields with shallow comparison
  selectFields: <K extends keyof T>(fields: K[]) => 
    (state: T): Pick<T, K> => {
      const result = {} as Pick<T, K>;
      fields.forEach(field => {
        result[field] = state[field];
      });
      return result;
    },
  
  // Select array length instead of full array
  selectArrayLength: <K extends keyof T>(field: K) =>
    (state: T): number => {
      const value = state[field];
      return Array.isArray(value) ? value.length : 0;
    },
  
  // Select computed values
  selectComputed: <R>(computeFn: (state: T) => R) =>
    (state: T): R => computeFn(state),
});

// Performance monitoring for store subscriptions
export function useStorePerformanceMonitor<T>(
  storeName: string,
  selector: (state: T) => any
) {
  return useCallback((state: T) => {
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