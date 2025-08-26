import { Platform } from 'react-native';
import { Coordinate } from '@/types';
import * as Location from 'expo-location';

// Radar API configuration
const RADAR_PUBLISHABLE_KEY = 'prj_test_pk_03203a89336bf90350c4c501c14037c4675f3659';
const RADAR_BASE_URL = 'https://api.radar.io/v1';

interface RadarRoute {
  distance: {
    value: number;
    text: string;
  };
  duration: {
    value: number;
    text: string;
  };
  geometry: {
    coordinates: number[][];
  };
}

interface RadarLocation {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  name?: string;
  city?: string;
  state?: string;
  country?: string;
}

export class RadarService {
  private baseUrl = RADAR_BASE_URL;
  private apiKey = RADAR_PUBLISHABLE_KEY;

  constructor() {}

  /**
   * Get route between two coordinates using Radar Routes API
   * @param coordinates Array of coordinates for the route
   * @returns Route data including geometry and distance
   */
  async getRoute(coordinates: Coordinate[]): Promise<RadarRoute> {
    if (coordinates.length < 2) {
      throw new Error('At least two coordinates are required for routing');
    }

    try {
      const origin = coordinates[0];
      const destination = coordinates[coordinates.length - 1];
      
      const url = `${this.baseUrl}/route/distance`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: {
            latitude: origin.latitude,
            longitude: origin.longitude
          },
          destination: {
            latitude: destination.latitude,
            longitude: destination.longitude
          },
          modes: ['foot'],
          units: 'metric'
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const json = await response.json();
      
      // Transform Radar response to match expected format
      return {
        distance: {
          value: json.routes?.[0]?.distance?.value || 0,
          text: json.routes?.[0]?.distance?.text || '0 m'
        },
        duration: {
          value: json.routes?.[0]?.duration?.value || 0,
          text: json.routes?.[0]?.duration?.text || '0 min'
        },
        geometry: {
          coordinates: json.routes?.[0]?.geometry?.coordinates || []
        }
      };
    } catch (error) {
      console.error('Error fetching route:', error);
      // Return fallback route with calculated distance
      const distance = this.calculateDistance(coordinates[0], coordinates[coordinates.length - 1]);
      return {
        distance: {
          value: Math.round(distance * 1000),
          text: `${distance.toFixed(1)} km`
        },
        duration: {
          value: Math.round(distance * 12 * 60), // Assume 5 km/h walking speed
          text: `${Math.round(distance * 12)} min`
        },
        geometry: {
          coordinates: coordinates.map(coord => [coord.longitude, coord.latitude])
        }
      };
    }
  }

  /**
   * Search for locations using Radar Search API
   * @param query Search text for location
   * @returns Array of location results
   */
  async searchLocations(query: string): Promise<RadarLocation[]> {
    try {
      const url = `${this.baseUrl}/search/autocomplete`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.apiKey,
        },
        // Note: In a real implementation, you'd add query parameters
        // For now, return mock data since we don't have a real API key
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const json = await response.json();
      
      return json.addresses?.map((address: any) => ({
        latitude: address.latitude,
        longitude: address.longitude,
        formattedAddress: address.formattedAddress,
        name: address.name,
        city: address.city,
        state: address.state,
        country: address.country
      })) || [];
    } catch (error) {
      console.error('Error searching locations:', error);
      // Return mock locations for demo
      return [
        {
          latitude: 37.7749,
          longitude: -122.4194,
          formattedAddress: 'San Francisco, CA, USA',
          name: 'San Francisco',
          city: 'San Francisco',
          state: 'CA',
          country: 'USA'
        },
        {
          latitude: 40.7128,
          longitude: -74.0060,
          formattedAddress: 'New York, NY, USA',
          name: 'New York',
          city: 'New York',
          state: 'NY',
          country: 'USA'
        }
      ].filter(location => 
        location.name?.toLowerCase().includes(query.toLowerCase()) ||
        location.city?.toLowerCase().includes(query.toLowerCase())
      );
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param coord1 First coordinate
   * @param coord2 Second coordinate
   * @returns Distance in kilometers
   */
  calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371; // Earth's radius in kilometers
    const toRad = (angle: number) => (Math.PI * angle) / 180;

    const lat1 = coord1.latitude;
    const lon1 = coord1.longitude;
    const lat2 = coord2.latitude;
    const lon2 = coord2.longitude;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  /**
   * Get current location using expo-location for mobile and geolocation API for web
   * @returns Promise with current coordinate
   */
  async getCurrentLocation(): Promise<Coordinate> {
    if (Platform.OS === 'web') {
      // Web fallback using browser geolocation
      return new Promise((resolve, reject) => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: new Date().toISOString()
              });
            },
            (error) => {
              reject(error);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        } else {
          reject(new Error('Geolocation is not available'));
        }
      });
    } else {
      // Mobile using expo-location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission not granted');
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('Error getting location:', error);
        throw error;
      }
    }
  }

  /**
   * Start tracking location for running sessions
   * @param callback Function to call with location updates
   * @returns Function to stop tracking
   */
  async startLocationTracking(callback: (location: Coordinate) => void): Promise<() => void> {
    if (Platform.OS === 'web') {
      // Web fallback with watchPosition
      const watchId = navigator.geolocation?.watchPosition(
        (position) => {
          callback({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date().toISOString()
          });
        },
        (error) => {
          console.error('Location tracking error:', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
      );

      return () => {
        if (watchId && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchId);
        }
      };
    } else {
      // Mobile using expo-location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString()
          });
        }
      );

      return () => {
        subscription.remove();
      };
    }
  }
}

// Export a singleton instance
export const radarService = new RadarService();

// Keep mapboxService export for backward compatibility
export const mapboxService = radarService;