import React, { useCallback, useMemo, useRef } from 'react';

// Debounce hook for search inputs and API calls
export const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
};

// Throttle hook for scroll events and frequent updates
export const useThrottle = (callback, delay) => {
  const lastCall = useRef(0);
  
  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      return callback(...args);
    }
  }, [callback, delay]);
};

// Memoized selector hook for Zustand stores
export const useMemoizedSelector = (selector, deps = []) => {
  return useMemo(() => selector, deps);
};

// Performance monitoring utilities
export const performanceMonitor = {
  startTimer: (label) => {
    if (__DEV__) {
      console.time(label);
    }
  },
  
  endTimer: (label) => {
    if (__DEV__) {
      console.timeEnd(label);
    }
  },
  
  measureRender: (componentName) => {
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
  clearLargeObjects: (objects) => {
    objects.forEach(obj => {
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          delete obj[key];
        });
      }
    });
  },
  
  // Optimize image loading
  optimizeImageUri: (uri, width, height) => {
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
  getFlatListProps: (itemHeight) => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 10,
    windowSize: 10,
    initialNumToRender: 5,
    updateCellsBatchingPeriod: 50,
    ...(itemHeight && {
      getItemLayout: (data, index) => ({
        length: itemHeight,
        offset: itemHeight * index,
        index,
      })
    })
  }),
  
  // Optimize data for rendering
  optimizeListData: (data, maxItems = 100) => {
    return data.slice(0, maxItems);
  }
};

// Bundle size optimization
export const bundleOptimizer = {
  // Lazy load heavy components
  lazyLoad: (importFn) => {
    return React.lazy(importFn);
  },
  
  // Code splitting utility
  splitComponent: (component) => {
    return React.lazy(() => Promise.resolve({ default: component }));
  }
};