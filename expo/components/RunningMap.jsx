import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { tokens } from '../../theme/tokens';
import Colors from '@/constants/colors';

let MapView, Polyline, Marker, PROVIDER_DEFAULT;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps.MapView;
    Polyline = Maps.Polyline;
    Marker = Maps.Marker;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  } catch (e) {
    console.warn('react-native-maps failed to load:', e);
  }
}

export default function RunningMap({
  coordinates = [],
  currentLocation,
  distance,
  pace,
  style
}) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [userMarker, setUserMarker] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Auto-center react-native-maps MapView when currentLocation changes
  useEffect(() => {
    if (Platform.OS !== 'web' && mapRef.current && currentLocation) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
  }, [currentLocation]);

  // Web Map (Leaflet) Initializers
  useEffect(() => {
    if (Platform.OS === 'web' && !map) {
      initializeWebMap();
    }
  }, [map]);

  useEffect(() => {
    if (Platform.OS === 'web' && map && coordinates.length > 0) {
      updateMapRoute();
    }
  }, [coordinates, map]);

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
        requestAnimationFrame(initializeWebMap);
        return;
      }
      const L = await import('leaflet');
      const mapInstance = L.map(el, {
        center: [37.7749, -122.4194],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        maxZoom: 19
      }).addTo(mapInstance);

      setMap(mapInstance);
      setIsMapLoaded(true);

      if (currentLocation) {
        mapInstance.setView([currentLocation.latitude, currentLocation.longitude], 16);
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
      if (routePath) {
        map.removeLayer(routePath);
      }
      const latLngs = coordinates.map((coord) => [coord.latitude, coord.longitude]);
      const newRoutePath = L.polyline(latLngs, {
        color: '#000000',
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1
      }).addTo(map);
      setRoutePath(newRoutePath);
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
      if (userMarker) {
        map.removeLayer(userMarker);
      }
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
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const newUserMarker = L.marker([currentLocation.latitude, currentLocation.longitude], { icon: currentLocationIcon }).addTo(map);
      setUserMarker(newUserMarker);

      if (coordinates.length <= 1) {
        map.setView([currentLocation.latitude, currentLocation.longitude], 16);
      }
    } catch (error) {
      console.error('Error updating current location marker:', error);
    }
  };

  const renderMapContent = () => {
    if (Platform.OS === 'web') {
      return (
        <>
          <View
            ref={mapRef}
            nativeID="running-map-container"
            style={styles.webMapDiv}
          />
          {!isMapLoaded && (
            <View style={styles.mapLoadingOverlay}>
              <Text style={styles.mapLoadingText}>Loading Web Map...</Text>
            </View>
          )}
        </>
      );
    }

    if (MapView) {
      const initialRegion = currentLocation ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      } : (coordinates.length > 0 ? {
        latitude: coordinates[coordinates.length - 1].latitude,
        longitude: coordinates[coordinates.length - 1].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      } : {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      return (
        <MapView
          ref={mapRef}
          style={[style, { height: 300, width: '100%' }]}
          provider={PROVIDER_DEFAULT}
          showsUserLocation={true}
          showsMyLocationButton={false}
          initialRegion={initialRegion}
        >
          {coordinates.length > 1 && (
            <Polyline
              coordinates={coordinates}
              strokeColor="#000000"
              strokeWidth={4}
            />
          )}
          {currentLocation && Marker && (
            <Marker coordinate={currentLocation}>
              <View style={styles.currentLocationDot} />
            </Marker>
          )}
        </MapView>
      );
    }

    // Beautiful static mock map fallback for environment where react-native-maps is missing
    return renderMobileGPSVisualization();
  };

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

    const pathPoints = coordinates.slice(-50);
    return (
      <View style={styles.routeVisualization}>
        <View style={styles.routePath}>
          {pathPoints.length > 1 && (
            <View style={styles.routePathContainer}>
              {pathPoints.slice(1).map((coord, index) => {
                const prevCoord = pathPoints[index];
                const latRange = Math.max(...pathPoints.map((p) => p.latitude)) - Math.min(...pathPoints.map((p) => p.latitude));
                const lonRange = Math.max(...pathPoints.map((p) => p.longitude)) - Math.min(...pathPoints.map((p) => p.longitude));

                const minLat = Math.min(...pathPoints.map((p) => p.latitude));
                const minLon = Math.min(...pathPoints.map((p) => p.longitude));

                const currentX = latRange > 0 ? 10 + (coord.longitude - minLon) / lonRange * 80 : 50;
                const currentY = lonRange > 0 ? 10 + (coord.latitude - minLat) / latRange * 80 : 50;
                const prevX = latRange > 0 ? 10 + (prevCoord.longitude - minLon) / lonRange * 80 : 50;
                const prevY = lonRange > 0 ? 10 + (prevCoord.latitude - minLat) / latRange * 80 : 50;

                const deltaX = currentX - prevX;
                const deltaY = currentY - prevY;
                const distanceVal = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

                return (
                  <View
                    key={`line-${index}`}
                    style={[
                      styles.routeLineSegment,
                      {
                        left: `${prevX}%`,
                        top: `${prevY}%`,
                        width: distanceVal * 4,
                        transform: [{ rotate: `${angle}deg` }]
                      }
                    ]}
                  />
                );
              })}
            </View>
          )}
        </View>

        {(coordinates.length > 0 || currentLocation) && (
          <View style={styles.currentLocationContainer}>
            <View style={styles.currentLocationPulse} />
            <View style={styles.currentLocationDot} />
            <Text style={styles.currentLocationText}>YOU ARE HERE</Text>
          </View>
        )}

        <View style={styles.mapBackground}>
          <View style={[styles.parkArea, { top: '20%', left: '10%', width: '30%', height: '25%' }]} />
          <View style={[styles.waterArea, { top: '60%', right: '15%', width: '25%', height: '15%' }]} />
          <View style={[styles.majorRoad, { top: '45%', left: 0, right: 0, height: 4 }]} />
          <View style={[styles.minorStreet, { top: '30%', left: '20%', right: '20%', height: 2 }]} />
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
    backgroundColor: '#0D1117',
    overflow: 'hidden',
    position: 'relative'
  },
  webMapDiv: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0D1117'
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
    backgroundColor: '#2a2a2a'
  },
  noDataText: {
    fontSize: 48,
    marginBottom: 16
  },
  noDataSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 8
  },
  noDataHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  routeVisualization: {
    flex: 1,
    backgroundColor: '#0D1117',
    position: 'relative',
    overflow: 'hidden'
  },
  routePath: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  routePathContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  routeLineSegment: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 1.5,
    opacity: 0.9,
  },
  currentLocationContainer: {
    position: 'absolute',
    bottom: '30%',
    right: '20%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  currentLocationPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.3)'
  },
  currentLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4
  },
  mapBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  parkArea: {
    position: 'absolute',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8
  },
  waterArea: {
    position: 'absolute',
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    borderRadius: 4
  },
  majorRoad: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  minorStreet: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0D1117',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  mapLoadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center'
  },
  currentLocationText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 4,
    textAlign: 'center',
  }
});
