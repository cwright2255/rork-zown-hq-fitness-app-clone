import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Coordinate } from '@/types';
import Colors from '@/constants/colors';

// Ensure Colors.running exists
if (!Colors.running) {
  (Colors as any).running = {
    primary: '#007AFF',
    secondary: '#5AC8FA',
    distance: '#34C759',
    pace: '#FF9500',
    calories: '#FF3B30',
  };
}
if (!Colors.success) {
  (Colors as any).success = '#34C759';
}

interface RunningMapProps {
  coordinates: Coordinate[];
  currentLocation?: Coordinate;
  distance: number;
  pace: number;
  style?: any;
}

export default function RunningMap({ 
  coordinates, 
  currentLocation,
  distance, 
  pace, 
  style 
}: RunningMapProps) {
  const mapContainerRef = useRef<View>(null);
  const [map, setMap] = useState<any>(null);
  const [userMarker, setUserMarker] = useState<any>(null);
  const [routePath, setRoutePath] = useState<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Initialize map for web
  useEffect(() => {
    if (Platform.OS === 'web' && !map) {
      initializeWebMap();
    }
  }, [map]);

  // Update map when coordinates change
  useEffect(() => {
    if (Platform.OS === 'web' && map && coordinates.length > 0) {
      updateMapRoute();
    }
  }, [coordinates, map]);

  // Update current location marker
  useEffect(() => {
    if (Platform.OS === 'web' && map && currentLocation) {
      updateCurrentLocationMarker();
    }
  }, [currentLocation, map]);

  const initializeWebMap = async () => {
    try {
      const containerId = 'running-map-container';
      const el = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
      if (Platform.OS === 'web' && !el) {
        // Defer until the element exists in DOM
        requestAnimationFrame(initializeWebMap);
        return;
      }
      // Load Leaflet dynamically for web
      const L = await import('leaflet');
      
      // Initialize map
      const mapInstance = L.map(el as HTMLElement, {
        center: [37.7749, -122.4194],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Add tile layer (OpenStreetMap with better styling)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        maxZoom: 19,
      }).addTo(mapInstance);

      setMap(mapInstance);
      setIsMapLoaded(true);

      // If we have a current location, center the map there
      if (currentLocation) {
        mapInstance.setView([
          currentLocation.latitude,
          currentLocation.longitude
        ], 16);
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      setIsMapLoaded(false);
    }
  };

  const updateMapRoute = async () => {
    if (!map || coordinates.length === 0) return;

    try {
      const L = await import('leaflet');

      // Remove existing route
      if (routePath) {
        map.removeLayer(routePath);
      }

      // Create route from coordinates
      const latLngs = coordinates.map(coord => [coord.latitude, coord.longitude] as [number, number]);
      
      const newRoutePath = L.polyline(latLngs, {
        color: '#00ff88',
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1,
      }).addTo(map);

      setRoutePath(newRoutePath);

      // Fit map to route bounds if we have multiple points
      if (coordinates.length > 1) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch (error) {
      console.error('Error updating route:', error);
    }
  };

  const updateCurrentLocationMarker = async () => {
    if (!map || !currentLocation) return;

    try {
      const L = await import('leaflet');

      // Remove existing marker
      if (userMarker) {
        map.removeLayer(userMarker);
      }

      // Create custom icon for current location
      const currentLocationIcon = L.divIcon({
        className: 'current-location-marker',
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background: #007AFF;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(0, 122, 255, 0.5);
            animation: pulse 2s infinite;
          "></div>
          <style>
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0.7); }
              70% { box-shadow: 0 0 0 10px rgba(0, 122, 255, 0); }
              100% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0); }
            }
          </style>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const newUserMarker = L.marker([
        currentLocation.latitude,
        currentLocation.longitude
      ], { icon: currentLocationIcon }).addTo(map);

      setUserMarker(newUserMarker);

      // Center map on current location if this is the first location
      if (coordinates.length <= 1) {
        map.setView([
          currentLocation.latitude,
          currentLocation.longitude
        ], 16);
      }
    } catch (error) {
      console.error('Error updating current location marker:', error);
    }
  };

  // Render web map or fallback
  const renderMapContent = () => {
    if (Platform.OS === 'web') {
      return (
        <>
          <View
            ref={mapContainerRef}
            nativeID="running-map-container"
            testID="running-map-container"
            style={styles.webMapDiv}
          />
          {!isMapLoaded && (
            <View style={styles.mapLoadingOverlay}>
              <Text style={styles.mapLoadingText}>Loading Map...</Text>
            </View>
          )}
        </>
      );
    }

    return renderMobileGPSVisualization();
  };

  // Mobile GPS visualization fallback
  const renderMobileGPSVisualization = () => {
    if (coordinates.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>📍</Text>
          <Text style={styles.noDataSubtext}>Waiting for GPS signal...</Text>
          <Text style={styles.noDataHint}>Press START to begin tracking</Text>
        </View>
      );
    }

    // Create a more realistic GPS tracking visualization
    const pathPoints = coordinates.slice(-50);
    
    // If we have current location, use it for centering
    const centerLat = currentLocation ? currentLocation.latitude : (pathPoints.length > 0 ? pathPoints[pathPoints.length - 1].latitude : 37.7749);
    const centerLon = currentLocation ? currentLocation.longitude : (pathPoints.length > 0 ? pathPoints[pathPoints.length - 1].longitude : -122.4194);
    
    return (
      <View style={styles.routeVisualization}>
        {/* GPS Route Path */}
        <View style={styles.routePath}>
          {/* Draw the running route as a continuous path */}
          {pathPoints.length > 1 && (
            <View style={styles.routePathContainer}>
              {pathPoints.slice(1).map((coord, index) => {
                const prevCoord = pathPoints[index];
                
                // Calculate relative positions based on coordinate differences
                const latRange = Math.max(...pathPoints.map(p => p.latitude)) - Math.min(...pathPoints.map(p => p.latitude));
                const lonRange = Math.max(...pathPoints.map(p => p.longitude)) - Math.min(...pathPoints.map(p => p.longitude));
                
                const minLat = Math.min(...pathPoints.map(p => p.latitude));
                const minLon = Math.min(...pathPoints.map(p => p.longitude));
                
                // Normalize coordinates to screen space (10% to 90% of container)
                const currentX = latRange > 0 ? 10 + ((coord.longitude - minLon) / lonRange) * 80 : 50;
                const currentY = lonRange > 0 ? 10 + ((coord.latitude - minLat) / latRange) * 80 : 50;
                const prevX = latRange > 0 ? 10 + ((prevCoord.longitude - minLon) / lonRange) * 80 : 50;
                const prevY = lonRange > 0 ? 10 + ((prevCoord.latitude - minLat) / latRange) * 80 : 50;
                
                // Calculate line properties
                const deltaX = currentX - prevX;
                const deltaY = currentY - prevY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                
                return (
                  <View
                    key={`line-${index}`}
                    style={[
                      styles.routeLineSegment,
                      {
                        left: `${prevX}%`,
                        top: `${prevY}%`,
                        width: distance * 4,
                        transform: [{ rotate: `${angle}deg` }],
                      }
                    ]}
                  />
                );
              })}
            </View>
          )}
          
          {/* Route points */}
          {pathPoints.map((coord, index) => {
            const isStart = index === 0;
            const isEnd = index === pathPoints.length - 1;
            
            // Calculate position
            const latRange = Math.max(...pathPoints.map(p => p.latitude)) - Math.min(...pathPoints.map(p => p.latitude));
            const lonRange = Math.max(...pathPoints.map(p => p.longitude)) - Math.min(...pathPoints.map(p => p.longitude));
            
            const minLat = Math.min(...pathPoints.map(p => p.latitude));
            const minLon = Math.min(...pathPoints.map(p => p.longitude));
            
            const xPos = latRange > 0 ? 10 + ((coord.longitude - minLon) / lonRange) * 80 : 50;
            const yPos = lonRange > 0 ? 10 + ((coord.latitude - minLat) / latRange) * 80 : 50;
            
            // Only show start, end, and every 5th point to avoid clutter
            if (!isStart && !isEnd && index % 5 !== 0) return null;
            
            return (
              <View
                key={`${coord.latitude}-${coord.longitude}-${index}`}
                style={[
                  styles.routePoint,
                  isStart && styles.startPoint,
                  isEnd && styles.endPoint,
                  {
                    left: `${xPos}%`,
                    top: `${yPos}%`,
                  }
                ]}
              />
            );
          })}
        </View>
        
        {/* Current location indicator */}
        {(coordinates.length > 0 || currentLocation) && (
          <View style={styles.currentLocationContainer}>
            <View style={styles.currentLocationPulse} />
            <View style={styles.currentLocationDot} />
            <Text style={styles.currentLocationText}>YOU ARE HERE</Text>
          </View>
        )}
        
        {/* Map background elements for better visual */}
        <View style={styles.mapBackground}>
          {/* Simulated map elements */}
          <View style={[styles.parkArea, { top: '20%', left: '10%', width: '30%', height: '25%' }]} />
          <View style={[styles.waterArea, { top: '60%', right: '15%', width: '25%', height: '15%' }]} />
          <View style={[styles.majorRoad, { top: '45%', left: 0, right: 0, height: 4 }]} />
          <View style={[styles.minorStreet, { top: '30%', left: '20%', right: '20%', height: 2 }]} />
          <View style={[styles.buildingBlock, { top: '10%', right: '20%', width: '15%', height: '20%' }]} />
          <View style={[styles.buildingBlock, { top: '70%', left: '15%', width: '20%', height: '15%' }]} />
        </View>
      </View>
    );
  };



  return (
    <View style={[styles.mapContainer, style]} testID="running-map-root">
      {renderMapContent()}
    </View>
  );
}



const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  webMapDiv: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  mapHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  mapSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  mapContent: {
    flex: 1,
    position: 'relative',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
    backgroundColor: '#2a2a2a',
  },
  noDataText: {
    fontSize: 48,
    marginBottom: 16,
  },
  noDataSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 8,
  },
  noDataHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  routeContainer: {
    flex: 1,
    position: 'relative',
  },
  routeHeader: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  routeSubtitle: {
    fontSize: 11,
    color: '#666',
  },
  routeVisualization: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    position: 'relative',
    overflow: 'hidden',
  },
  routePath: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  routePathContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  routeLineSegment: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#00ff88',
    borderRadius: 1.5,
    opacity: 0.9,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 2,
  },
  routePoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 2,
  },
  startPoint: {
    backgroundColor: '#00ff88',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  endPoint: {
    backgroundColor: '#ff6b6b',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  currentPoint: {
    backgroundColor: '#ff6b6b',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  currentLocationContainer: {
    position: 'absolute',
    bottom: '30%',
    right: '20%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  currentLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  mapStats: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  debugContainer: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    zIndex: 5,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  debugInfo: {
    gap: 2,
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Map-like background patterns
  mapBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
  },
  mapBaseLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2a2a2a',
  },
  parkArea: {
    position: 'absolute',
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderRadius: 8,
  },
  waterArea: {
    position: 'absolute',
    backgroundColor: 'rgba(33, 150, 243, 0.4)',
    borderRadius: 4,
  },
  majorRoad: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  minorStreet: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buildingBlock: {
    position: 'absolute',
    backgroundColor: 'rgba(120, 120, 120, 0.2)',
    borderRadius: 2,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  mapLoadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  currentLocationText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  distanceMarkers: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  distanceMarker: {
    position: 'absolute',
    left: '20%',
    top: '20%',
    backgroundColor: 'rgba(0, 255, 136, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  distanceMarkerText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  parkPattern: {
    position: 'absolute',
  },
});