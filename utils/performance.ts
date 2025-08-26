import React from 'react';
import { Platform } from 'react-native';

// Performance utilities for React Native

// Optimized image loading for React Native
export const getOptimizedImageProps = (uri: string, width?: number, height?: number) => {
  const optimizedUri = uri; // Use direct URI for now
  
  return {
    source: { uri: optimizedUri },
    style: width && height ? { width, height } : undefined,
    resizeMode: 'cover' as const,
    loadingIndicatorSource: { 
      uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' 
    },
    // Add cache policy for better performance
    cache: Platform.OS === 'ios' ? 'force-cache' : undefined,
  };
};

// React Native specific performance hooks
export const useOptimizedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T => {
  return React.useCallback(callback, deps);
};

export const useOptimizedMemo = <T>(
  factory: () => T,
  deps: React.DependencyList
): T => {
  return React.useMemo(factory, deps);
};

// Debounced state hook
export const useDebouncedState = <T>(
  initialValue: T,
  delay: number
): [T, T, (value: T) => void] => {
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
export const useThrottledCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastRun = React.useRef(Date.now());
  
  return React.useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]) as T;
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
export const optimizeDataForRendering = <T extends { id: string }>(
  data: T[],
  maxItems: number = 50
): T[] => {
  if (data.length <= maxItems) return data;
  
  // Keep most recent items
  return data.slice(-maxItems);
};

// Array optimization for performance
export const optimizeArrayForPerformance = <T>(
  array: T[],
  maxItems: number = 50
): T[] => {
  if (array.length <= maxItems) return array;
  
  // Keep most recent items
  return array.slice(-maxItems);
};

// Component performance wrapper
export const withPerformanceOptimization = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.memo(Component, (prevProps, nextProps) => {
    // Custom shallow comparison
    const prevKeys = Object.keys(prevProps) as (keyof P)[];
    const nextKeys = Object.keys(nextProps) as (keyof P)[];
    
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
  const updates = React.useRef<(() => void)[]>([]);
  
  const addUpdate = React.useCallback((update: () => void) => {
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
export const usePerformanceMonitor = (componentName: string) => {
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
export const useOptimizedScrollHandler = (
  onScroll: (event: any) => void,
  throttleMs: number = 16
) => {
  const lastScrollTime = React.useRef(0);
  
  return React.useCallback((event: any) => {
    const now = Date.now();
    if (now - lastScrollTime.current >= throttleMs) {
      onScroll(event);
      lastScrollTime.current = now;
    }
  }, [onScroll, throttleMs]);
};

// Lazy component loader
export const createLazyComponent = <P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>
) => {
  return React.lazy(importFn);
};

// Memory cleanup hook
export const useMemoryCleanup = (cleanupFn: () => void, deps: React.DependencyList) => {
  React.useEffect(() => {
    return cleanupFn;
  }, deps);
};

// Optimized state selector
export const useOptimizedSelector = <T, R>(
  selector: (state: T) => R,
  state: T,
  equalityFn?: (a: R, b: R) => boolean
): R => {
  const lastResult = React.useRef<R | undefined>(undefined);
  const lastState = React.useRef<T | undefined>(undefined);
  
  if (state !== lastState.current) {
    const newResult = selector(state);
    
    if (!lastResult.current || 
        (equalityFn ? !equalityFn(lastResult.current, newResult) : lastResult.current !== newResult)) {
      lastResult.current = newResult;
    }
    
    lastState.current = state;
  }
  
  return lastResult.current!;
};