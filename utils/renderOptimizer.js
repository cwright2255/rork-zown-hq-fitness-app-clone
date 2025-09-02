import { useRef, useEffect } from 'react';

// Render optimization utilities
export class RenderOptimizer {
  // Debounce state updates to prevent excessive re-renders
  static debounceStateUpdate(setValue, delay = 300) {
    let timeoutId;
    
    return (value) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setValue(value), delay);
    };
  }

  // Throttle expensive operations
  static throttleOperation(operation, delay = 100) {
    let lastCall = 0;
    let timeoutId;
    
    return (...args) => {
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
    };
  }

  // Memoize expensive calculations
  static memoizeCalculation(calculation, keyExtractor) {
    const cache = new Map();
    
    return (input) => {
      const key = keyExtractor ? keyExtractor(input) : JSON.stringify(input);
      
      if (cache.has(key)) {
        return cache.get(key);
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

  // Shallow equality check
  static shallowEqual(a, b) {
    if (a.length !== b.length) return false;
    
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    
    return true;
  }

  // Virtual scrolling helper
  static calculateVisibleItems(
    scrollOffset,
    containerHeight,
    itemHeight,
    totalItems,
    overscan = 5
  ) {
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - overscan);
    const visibleItems = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const endIndex = Math.min(totalItems - 1, startIndex + visibleItems);
    
    return { startIndex, endIndex, visibleItems };
  }

  // Batch DOM updates
  static batchDOMUpdates(updates) {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  // Performance monitoring
  static measureRenderTime(componentName) {
    let startTime;
    
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
export function useRenderOptimization(componentName) {
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
export function useStableValue(value, compareFn) {
  const ref = useRef(value);
  const compare = compareFn || ((a, b) => a === b);
  
  if (!compare(value, ref.current)) {
    ref.current = value;
  }
  
  return ref.current;
}