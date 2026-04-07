import React, { useState, useCallback } from 'react';
import { Image, View, StyleSheet, ImageStyle, ViewStyle, ActivityIndicator } from 'react-native';
import { getOptimizedImageUrl } from '@/constants/performance';
import Colors from '@/constants/colors';

interface OptimizedImageProps {
  uri: string;
  width?: number;
  height?: number;
  style?: ImageStyle;
  containerStyle?: ViewStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(({
  uri,
  width,
  height,
  style,
  containerStyle,
  resizeMode = 'cover',
  placeholder,
  onLoad,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const optimizedUri = React.useMemo(() => 
    getOptimizedImageUrl(uri, width, height),
    [uri, width, height]
  );
  
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);
  
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);
  
  const imageStyle = React.useMemo(() => ([
    width && height ? { width, height } : {},
    style
  ]), [width, height, style]);
  
  if (hasError) {
    return (
      <View style={[styles.container, containerStyle, imageStyle]}>
        <View style={styles.errorContainer}>
          {placeholder || <View style={styles.errorPlaceholder} />}
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={{ uri: optimizedUri }}
        style={imageStyle}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onError={handleError}
        loadingIndicatorSource={{
          uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        }}
      />
      
      {isLoading && (
        <View style={[styles.loadingContainer, imageStyle]}>
          {placeholder || (
            <ActivityIndicator 
              size="small" 
              color={Colors.primary} 
            />
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.inactive,
  },
  errorPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: Colors.border,
    borderRadius: 4,
  },
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;