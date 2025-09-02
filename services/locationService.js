import * as Location from 'expo-location';
import { Platform, Alert } from 'react-native';

class LocationService {
  constructor() {
    this.isTracking = false;
    this.coordinates = [];
    this.currentLocation = null;
    this.watchSubscription = null;
    this.listeners = [];
    this.totalDistance = 0;
    this.speeds = [];
  }

  async requestPermissions() {
    try {
      if (Platform.OS === 'web') {
        // For web, use browser geolocation API
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            console.log('Geolocation not supported on this browser');
            resolve(false);
            return;
          }
          
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            (error) => {
              console.error('Web geolocation error:', error);
              resolve(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
        });
      }
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async checkPermissions() {
    try {
      if (Platform.OS === 'web') {
        return null; // Web doesn't have the same permission structure
      }
      return await Location.getForegroundPermissionsAsync();
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return null;
    }
  }

  async startTracking() {
    if (this.isTracking) return true;

    try {
      if (Platform.OS === 'web') {
        return this.startWebTracking();
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.error('Location permission not granted');
        Alert.alert(
          'Location Permission Required',
          'Please enable location services to track your run. Go to Settings > Privacy & Security > Location Services and enable location access for this app.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Get initial location
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      
      this.currentLocation = initialLocation;
      this.coordinates = [{
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        timestamp: new Date().toISOString(),
        altitude: initialLocation.coords.altitude || undefined,
        speed: initialLocation.coords.speed || undefined,
      }];

      // Start watching location
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every second
          distanceInterval: 1, // Update every meter
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      this.isTracking = true;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert(
        'GPS Error',
        'Unable to start GPS tracking. Please check that location services are enabled and try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  async startWebTracking() {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      return false;
    }

    return new Promise((resolve) => {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude,
              speed: position.coords.speed,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
            },
            timestamp: position.timestamp,
          };
          
          this.handleLocationUpdate(location);
          
          if (!this.isTracking) {
            this.isTracking = true;
            this.notifyListeners();
            resolve(true);
          }
        },
        (error) => {
          console.error('Web geolocation error:', error);
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000,
        }
      );
      
      // Store watch ID for cleanup
      this.webWatchId = watchId;
    });
  }

  stopTracking() {
    if (Platform.OS === 'web' && this.webWatchId) {
      navigator.geolocation.clearWatch(this.webWatchId);
      this.webWatchId = null;
    } else if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    this.isTracking = false;
    this.notifyListeners();
  }

  handleLocationUpdate(location) {
    const newCoordinate = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: new Date().toISOString(),
      altitude: location.coords.altitude || undefined,
      speed: location.coords.speed || undefined,
    };

    // Calculate distance from previous point
    if (this.coordinates.length > 0) {
      const lastCoordinate = this.coordinates[this.coordinates.length - 1];
      const distance = this.calculateDistance(
        lastCoordinate.latitude,
        lastCoordinate.longitude,
        newCoordinate.latitude,
        newCoordinate.longitude
      );
      this.totalDistance += distance;
    }

    // Track speed
    if (location.coords.speed !== null && location.coords.speed !== undefined) {
      this.speeds.push(location.coords.speed);
      // Keep only last 10 speed readings for average
      if (this.speeds.length > 10) {
        this.speeds.shift();
      }
    }

    this.coordinates.push(newCoordinate);
    this.currentLocation = location;
    this.notifyListeners();
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  getState() {
    return {
      isTracking: this.isTracking,
      coordinates: this.coordinates,
      currentLocation: this.currentLocation,
      distance: this.totalDistance,
      speed: this.currentLocation?.coords.speed || 0,
      averageSpeed: this.speeds.length > 0 ? this.speeds.reduce((a, b) => a + b, 0) / this.speeds.length : 0,
    };
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  reset() {
    this.coordinates = [];
    this.totalDistance = 0;
    this.speeds = [];
    this.currentLocation = null;
    this.notifyListeners();
  }

  // Mock tracking for demo purposes
  startMockTracking() {
    this.isTracking = true;
    const startLat = 37.78825;
    const startLon = -122.4324;
    
    this.coordinates = [{
      latitude: startLat,
      longitude: startLon,
      timestamp: new Date().toISOString(),
    }];
    
    // Create a mock current location
    this.currentLocation = {
      coords: {
        latitude: startLat,
        longitude: startLon,
        altitude: null,
        accuracy: 5,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };
    
    // Simulate movement every 2 seconds
    const interval = setInterval(() => {
      if (!this.isTracking) {
        clearInterval(interval);
        return;
      }
      
      const lastCoord = this.coordinates[this.coordinates.length - 1];
      const newCoord = {
        latitude: lastCoord.latitude + (Math.random() - 0.5) * 0.0001,
        longitude: lastCoord.longitude + (Math.random() - 0.5) * 0.0001,
        timestamp: new Date().toISOString(),
      };
      
      // Update current location
      this.currentLocation = {
        coords: {
          latitude: newCoord.latitude,
          longitude: newCoord.longitude,
          altitude: null,
          accuracy: 5,
          heading: null,
          speed: 2.5, // Mock speed in m/s
        },
        timestamp: Date.now(),
      };
      
      const distance = this.calculateDistance(
        lastCoord.latitude,
        lastCoord.longitude,
        newCoord.latitude,
        newCoord.longitude
      );
      this.totalDistance += distance;
      
      this.coordinates.push(newCoord);
      this.notifyListeners();
    }, 2000);
  }

  async getLocationPermissionStatus() {
    try {
      if (Platform.OS === 'web') {
        // For web, we can't check permissions the same way
        return 'undetermined';
      }
      
      const { status } = await Location.getForegroundPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Error getting location permission status:', error);
      return 'undetermined';
    }
  }
}

export const locationService = new LocationService();
export default locationService;