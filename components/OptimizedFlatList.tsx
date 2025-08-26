import React, { useMemo, useCallback } from 'react';
import { FlatList, FlatListProps, ListRenderItem } from 'react-native';
import { getOptimizedFlatListProps } from '@/utils/performance';

interface OptimizedFlatListProps<T> extends Omit<FlatListProps<T>, 'renderItem'> {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor?: (item: T, index: number) => string;
  itemHeight?: number;
}

function OptimizedFlatList<T extends { id?: string }>({
  data,
  renderItem,
  keyExtractor,
  itemHeight,
  ...props
}: OptimizedFlatListProps<T>) {
  // Memoize optimized props
  const optimizedProps = useMemo(() => getOptimizedFlatListProps(), []);
  
  // Memoize key extractor
  const memoizedKeyExtractor = useCallback(
    (item: T, index: number) => {
      if (keyExtractor) {
        return keyExtractor(item, index);
      }
      return item.id || index.toString();
    },
    [keyExtractor]
  );
  
  // Memoize getItemLayout if itemHeight is provided
  const getItemLayout = useMemo(() => {
    if (!itemHeight) return undefined;
    
    return (data: any, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    });
  }, [itemHeight]);
  
  // Memoize data to prevent unnecessary re-renders
  const memoizedData = useMemo(() => data, [data]);
  
  return (
    <FlatList
      {...optimizedProps}
      {...props}
      data={memoizedData}
      renderItem={renderItem}
      keyExtractor={memoizedKeyExtractor}
      getItemLayout={getItemLayout}

      // Additional performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      updateCellsBatchingPeriod={100}
      initialNumToRender={5}
      windowSize={5}
      // Prevent unnecessary re-renders
      extraData={undefined}
    />
  );
}

export default React.memo(OptimizedFlatList) as <T extends { id?: string }>(
  props: OptimizedFlatListProps<T>
) => React.ReactElement;