# Radar Service Migration

## Overview
The app has been migrated from Mapbox to Radar for location services and run tracking. This provides better integration with React Native and more accurate location tracking for fitness applications.

## Changes Made

### 1. Fixed TypeScript Errors
- Fixed `services/nutritionixService.ts` line 73 where `string | null` was not assignable to `string`
- Added proper null checks and type assertions

### 2. Migrated from Mapbox to Radar
- Replaced `services/mapboxService.ts` with `services/radarService.ts`
- Updated to use Radar API for:
  - Route calculation and distance tracking
  - Location search and geocoding
  - Real-time location tracking for running sessions

### 3. Enhanced Location Services
- Added proper Platform-specific implementations:
  - **Mobile**: Uses `expo-location` for high-accuracy GPS tracking
  - **Web**: Falls back to browser geolocation API
- Improved location tracking with configurable accuracy and intervals
- Added location permission handling

## Key Features

### RadarService Class
```typescript
// Get route between coordinates
await radarService.getRoute(coordinates);

// Search for locations
await radarService.searchLocations(query);

// Get current location
await radarService.getCurrentLocation();

// Start location tracking for runs
const stopTracking = await radarService.startLocationTracking(callback);
```

### Backward Compatibility
- Maintained `mapboxService` export for existing code
- All existing imports will continue to work

### Location Tracking for Running
- High-accuracy GPS tracking on mobile
- Configurable update intervals (1 second, 1 meter distance)
- Automatic fallback for web platforms
- Proper cleanup when stopping tracking

## API Configuration
To use with a real Radar API key:
1. Sign up at [radar.com](https://radar.com)
2. Get your publishable key
3. Replace `RADAR_PUBLISHABLE_KEY` in `services/radarService.ts`

## Benefits
- Better accuracy for fitness tracking
- Native React Native integration
- Reduced API costs compared to Mapbox
- Improved battery efficiency on mobile
- Better offline capabilities