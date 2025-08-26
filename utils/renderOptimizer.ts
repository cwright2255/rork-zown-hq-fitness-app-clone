import { useCallback, useMemo, useRef, useEffect } from 'react';

// Render optimization utilities
export class RenderOptimizer {
  // Debounce state updates to prevent excessive re-renders
  static debounceStateUpdate<T>(
    setValue: (value: T) => void,
    delay: number = 300
  ): (value: T) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (value: T) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setValue(value), delay);
    };
  }

  // Throttle expensive operations
  static throttleOperation<T extends (...args: any[]) => any>(
    operation: T,
    delay: number = 100
  ): T {
    let lastCall = 0;
    let timeoutId: NodeJS.Timeout;
    
    return ((...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCall >= delay) {
        lastCall = now;
        return operation(...args);
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          operation(...args);
        }, delay - (now - lastCall));
      }
    }) as T;
  }

  // Memoize expensive calculations
  static memoizeCalculation<T, R>(
    calculation: (input: T) => R,
    keyExtractor?: (input: T) => string
  ): (input: T) => R {
    const cache = new Map<string, R>();
    
    return (input: T): R => {
      const key = keyExtractor ? keyExtractor(input) : JSON.stringify(input);
      
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      
      const result = calculation(input);
      cache.set(key, result);
      
      // Limit cache size
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }
      
      return result;
    };
  }

  // Optimize component re-renders
  static useStableCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: any[]
  ): T {
    const callbackRef = useRef(callback);
    const depsRef = useRef(deps);
    
    // Update callback if dependencies changed
    if (!this.shallowEqual(deps, depsRef.current)) {
      callbackRef.current = callback;
      depsRef.current = deps;
    }
    
    return useCallback((...args: Parameters<T>) => {
      return callbackRef.current(...args);
    }, []) as T;
  }

  // Shallow equality check
  private static shallowEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    
    return true;
  }

  // Virtual scrolling helper
  static calculateVisibleItems(
    scrollOffset: number,
    containerHeight: number,
    itemHeight: number,
    totalItems: number,
    overscan: number = 5
  ): { startIndex: number; endIndex: number; visibleItems: number } {
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - overscan);
    const visibleItems = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const endIndex = Math.min(totalItems - 1, startIndex + visibleItems);
    
    return { startIndex, endIndex, visibleItems };
  }

  // Batch DOM updates
  static batchDOMUpdates(updates: (() => void)[]): void {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  // Performance monitoring
  static measureRenderTime(componentName: string): {
    start: () => void;
    end: () => void;
  } {
    let startTime: number;
    
    return {
      start: () => {
        if (__DEV__) {
          startTime = performance.now();
        }
      },
      end: () => {
        if (__DEV__ && startTime) {
          const endTime = performance.now();
          const renderTime = endTime - startTime;
          
          if (renderTime > 16) { // More than one frame (60fps)
            console.warn(`Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
          }
        }
      }
    };
  }
}

// React hooks for render optimization
export function useRenderOptimization(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(0);
  
  useEffect(() => {
    renderCount.current += 1;
    const now = performance.now();
    
    if (__DEV__) {
      if (lastRenderTime.current > 0) {
        const timeSinceLastRender = now - lastRenderTime.current;
        
        if (timeSinceLastRender < 16) {
          console.warn(
            `Frequent re-renders in ${componentName}: ${renderCount.current} renders, ` +
            `${timeSinceLastRender.toFixed(2)}ms since last render`
          );
        }
      }
      
      lastRenderTime.current = now;
    }
  });
  
  return {
    renderCount: renderCount.current,
    measureRender: RenderOptimizer.measureRenderTime(componentName)
  };
}

// Hook for stable references
export function useStableValue<T>(value: T, compareFn?: (a: T, b: T) => boolean): T {
  const ref = useRef(value);
  const compare = compareFn || ((a, b) => a === b);
  
  if (!compare(value, ref.current)) {
    ref.current = value;
  }
  
  return ref.current;
}