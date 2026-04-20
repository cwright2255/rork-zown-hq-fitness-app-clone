import React, { memo, useCallback, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { useThrottle } from '@/utils/performanceOptimizations';

const OptimizedScrollView = memo(({
  children,
  onScrollThrottled,
  throttleDelay = 16,
  enableOptimizations = true,
  onScroll,
  ...props
}) => {
  // Throttle scroll events to improve performance
  const throttledScrollHandler = useThrottle(
    useCallback((event) => {
      onScrollThrottled?.(event);
      onScroll?.(event);
    }, [onScrollThrottled, onScroll]),
    throttleDelay
  );

  // Memoize scroll view props
  const scrollViewProps = useMemo(() => ({
    ...props,
    onScroll: throttledScrollHandler,
    scrollEventThrottle: enableOptimizations ? 16 : props.scrollEventThrottle,
    removeClippedSubviews: enableOptimizations ? true : props.removeClippedSubviews,
    showsVerticalScrollIndicator: props.showsVerticalScrollIndicator ?? false,
    showsHorizontalScrollIndicator: props.showsHorizontalScrollIndicator ?? false
  }), [props, throttledScrollHandler, enableOptimizations]);

  return (
    <ScrollView {...scrollViewProps}>
      {children}
    </ScrollView>);

});

OptimizedScrollView.displayName = 'OptimizedScrollView';

export default OptimizedScrollView;