import React from 'react';
import { Platform } from 'react-native';

// Performance utilities for React Native

// Optimized image loading for React Native
export const getOptimizedImageProps = (uri, width, height) => {
  const optimizedUri = uri; // Use direct URI for now
  
  return {
    source: { uri: optimizedUri },
    style: width && height ? { width, height } : undefined,
    resizeMode: 'cover',
    loadingIndicatorSource: { 
      uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' 
    },
    // Add cache policy for better performance
    cache: Platform.OS === 'ios' ? 'force-cache' : undefined,
  };
};

// React Native specific performance hooks
export const useOptimizedCallback = (callback, deps) => {
  return React.useCallback(callback, deps);
};

export const useOptimizedMemo = (factory, deps) => {
  return React.useMemo(factory, deps);
};

// Debounced state hook
export const useDebouncedState = (initialValue, delay) => {
  const [value, setValue] = React.useState(initialValue);
  const [debouncedValue, setDebouncedValue] = React.useState(initialValue);
  
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return [value, debouncedValue, setValue];
};

// Throttled callback hook
export const useThrottledCallback = (callback, delay) => {
  const lastRun = React.useRef(Date.now());
  
  return React.useCallback((...args) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]);
};

// Optimized FlatList props
export const getOptimizedFlatListProps = () => ({
  removeClippedSubviews: true,
  maxToRenderPerBatch: 5,
  updateCellsBatchingPeriod: 100,
  initialNumToRender: 5,
  windowSize: 5,
  getItemLayout: undefined, // Only use if you know exact item dimensions
});

// Optimized ScrollView props
export const getOptimizedScrollViewProps = () => ({
  removeClippedSubviews: true,
  maxToRenderPerBatch: 3,
  windowSize: 5,
  initialNumToRender: 2,
});

// Memory optimization for large datasets
export const optimizeDataForRendering = (data, maxItems = 50) => {
  if (data.length <= maxItems) return data;
  
  // Keep most recent items
  return data.slice(-maxItems);
};

// Array optimization for performance
export const optimizeArrayForPerformance = (array, maxItems = 50) => {
  if (array.length <= maxItems) return array;
  
  // Keep most recent items
  return array.slice(-maxItems);
};

// Component performance wrapper
export const withPerformanceOptimization = (Component) => {
  return React.memo(Component, (prevProps, nextProps) => {
    // Custom shallow comparison
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);
    
    if (prevKeys.length !== nextKeys.length) return false;
    
    return prevKeys.every(key => {
      const prevValue = prevProps[key];
      const nextValue = nextProps[key];
      
      // Handle arrays and objects
      if (Array.isArray(prevValue) && Array.isArray(nextValue)) {
        return prevValue.length === nextValue.length && 
               prevValue.every((item, index) => item === nextValue[index]);
      }
      
      return prevValue === nextValue;
    });
  });
};

// Batch state updates
export const useBatchedUpdates = () => {
  const updates = React.useRef([]);
  
  const addUpdate = React.useCallback((update) => {
    updates.current.push(update);
  }, []);
  
  const flushUpdates = React.useCallback(() => {
    requestAnimationFrame(() => {
      updates.current.forEach(update => update());
      updates.current = [];
    });
  }, []);
  
  return { addUpdate, flushUpdates };
};

// Performance monitoring
export const usePerformanceMonitor = (componentName) => {
  const renderCount = React.useRef(0);
  const lastRenderTime = React.useRef(Date.now());
  
  React.useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    if (__DEV__) {
      console.log(
        `[Performance] ${componentName} - Render #${renderCount.current}, ` +
        `Time since last render: ${timeSinceLastRender}ms`
      );
    }
  });
};

// Optimized scroll handler
export const useOptimizedScrollHandler = (onScroll, throttleMs = 16) => {
  const lastScrollTime = React.useRef(0);
  
  return React.useCallback((event) => {
    const now = Date.now();
    if (now - lastScrollTime.current >= throttleMs) {
      onScroll(event);
      lastScrollTime.current = now;
    }
  }, [onScroll, throttleMs]);
};

// Lazy component loader
export const createLazyComponent = (importFn) => {
  return React.lazy(importFn);
};

// Memory cleanup hook
export const useMemoryCleanup = (cleanupFn, deps) => {
  React.useEffect(() => {
    return cleanupFn;
  }, deps);
};

// Optimized state selector
export const useOptimizedSelector = (selector, state, equalityFn) => {
  const lastResult = React.useRef(undefined);
  const lastState = React.useRef(undefined);
  
  if (state !== lastState.current) {
    const newResult = selector(state);
    
    if (!lastResult.current || 
        (equalityFn ? !equalityFn(lastResult.current, newResult) : lastResult.current !== newResult)) {
      lastResult.current = newResult;
    }
    
    lastState.current = state;
  }
  
  return lastResult.current;
};