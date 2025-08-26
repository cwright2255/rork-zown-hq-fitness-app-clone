import React, { useCallback, useMemo, useRef } from 'react';

// Debounce hook for search inputs and API calls
export const useDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]) as T;
};

// Throttle hook for scroll events and frequent updates
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastCall = useRef(0);
  
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      return callback(...args);
    }
  }, [callback, delay]) as T;
};

// Memoized selector hook for Zustand stores
export const useMemoizedSelector = <T, R>(
  selector: (state: T) => R,
  deps: any[] = []
): ((state: T) => R) => {
  return useMemo(() => selector, deps);
};

// Performance monitoring utilities
export const performanceMonitor = {
  startTimer: (label: string) => {
    if (__DEV__) {
      console.time(label);
    }
  },
  
  endTimer: (label: string) => {
    if (__DEV__) {
      console.timeEnd(label);
    }
  },
  
  measureRender: (componentName: string) => {
    if (__DEV__) {
      return {
        start: () => console.time(`${componentName} render`),
        end: () => console.timeEnd(`${componentName} render`)
      };
    }
    return { start: () => {}, end: () => {} };
  }
};

// Memory optimization utilities
export const memoryOptimizer = {
  // Clear large objects from memory
  clearLargeObjects: (objects: any[]) => {
    objects.forEach(obj => {
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          delete obj[key];
        });
      }
    });
  },
  
  // Optimize image loading
  optimizeImageUri: (uri: string, width?: number, height?: number) => {
    if (!uri) return uri;
    
    // Add image optimization parameters for supported services
    if (uri.includes('unsplash.com')) {
      const params = new URLSearchParams();
      if (width) params.append('w', width.toString());
      if (height) params.append('h', height.toString());
      params.append('fit', 'crop');
      params.append('auto', 'format');
      
      return `${uri}?${params.toString()}`;
    }
    
    return uri;
  }
};

// List optimization utilities
export const listOptimizer = {
  // Get optimized FlatList props
  getFlatListProps: (itemHeight?: number) => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 10,
    windowSize: 10,
    initialNumToRender: 5,
    updateCellsBatchingPeriod: 50,
    ...(itemHeight && {
      getItemLayout: (data: any, index: number) => ({
        length: itemHeight,
        offset: itemHeight * index,
        index,
      })
    })
  }),
  
  // Optimize data for rendering
  optimizeListData: <T>(data: T[], maxItems: number = 100): T[] => {
    return data.slice(0, maxItems);
  }
};

// Bundle size optimization
export const bundleOptimizer = {
  // Lazy load heavy components
  lazyLoad: (importFn: () => Promise<any>) => {
    return React.lazy(importFn);
  },
  
  // Code splitting utility
  splitComponent: <T>(
    component: React.ComponentType<T>
  ) => {
    return React.lazy(() => Promise.resolve({ default: component }));
  }
};