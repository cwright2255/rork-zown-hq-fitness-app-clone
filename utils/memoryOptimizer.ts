// Memory optimization utilities for React Native
export class MemoryOptimizer {
  private static imageCache = new Map<string, string>();
  private static maxCacheSize = 50;

  // Optimize image loading and caching
  static optimizeImageUri(uri: string, width?: number, height?: number): string {
    if (!uri) return uri;

    // Create cache key
    const cacheKey = `${uri}_${width || 'auto'}_${height || 'auto'}`;
    
    // Check cache first
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!;
    }

    let optimizedUri = uri;

    // Add optimization parameters for supported services
    if (uri.includes('unsplash.com')) {
      const params = new URLSearchParams();
      if (width) params.append('w', width.toString());
      if (height) params.append('h', height.toString());
      params.append('fit', 'crop');
      params.append('auto', 'format');
      params.append('q', '80'); // Quality optimization
      
      optimizedUri = `${uri}?${params.toString()}`;
    }

    // Cache the result
    this.cacheImageUri(cacheKey, optimizedUri);
    
    return optimizedUri;
  }

  // Cache management
  private static cacheImageUri(key: string, uri: string) {
    // Remove oldest entries if cache is full
    if (this.imageCache.size >= this.maxCacheSize) {
      const firstKey = this.imageCache.keys().next().value;
      if (firstKey !== undefined) {
        this.imageCache.delete(firstKey);
      }
    }
    
    this.imageCache.set(key, uri);
  }

  // Clear image cache
  static clearImageCache() {
    this.imageCache.clear();
  }

  // Memory cleanup for large objects
  static cleanupLargeObjects(objects: any[]) {
    objects.forEach(obj => {
      if (obj && typeof obj === 'object') {
        // Clear large arrays
        Object.keys(obj).forEach(key => {
          if (Array.isArray(obj[key]) && obj[key].length > 100) {
            obj[key] = obj[key].slice(0, 50); // Keep only first 50 items
          }
        });
      }
    });
  }

  // Optimize data structures for rendering
  static optimizeForRendering<T>(data: T[], maxItems: number = 100): T[] {
    if (!Array.isArray(data)) return data;
    
    // Limit data size for performance
    if (data.length > maxItems) {
      return data.slice(0, maxItems);
    }
    
    return data;
  }

  // Deep clone with memory optimization
  static optimizedClone<T>(obj: T, maxDepth: number = 3): T {
    if (maxDepth <= 0 || obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.optimizedClone(item, maxDepth - 1)) as unknown as T;
    }

    const cloned = {} as T;
    Object.keys(obj).forEach(key => {
      const value = (obj as any)[key];
      (cloned as any)[key] = this.optimizedClone(value, maxDepth - 1);
    });

    return cloned;
  }

  // Monitor memory usage (development only)
  static monitorMemoryUsage(componentName: string) {
    if (__DEV__ && (performance as any).memory) {
      const memory = (performance as any).memory;
      console.log(`[${componentName}] Memory Usage:`, {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + ' MB',
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + ' MB',
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
      });
    }
  }

  // Batch operations for better performance
  static batchOperations<T>(
    items: T[],
    operation: (item: T) => void,
    batchSize: number = 10
  ): Promise<void> {
    return new Promise((resolve) => {
      let index = 0;
      
      const processBatch = () => {
        const endIndex = Math.min(index + batchSize, items.length);
        
        for (let i = index; i < endIndex; i++) {
          operation(items[i]);
        }
        
        index = endIndex;
        
        if (index < items.length) {
          // Use setTimeout to yield control back to the main thread
          setTimeout(processBatch, 0);
        } else {
          resolve();
        }
      };
      
      processBatch();
    });
  }
}