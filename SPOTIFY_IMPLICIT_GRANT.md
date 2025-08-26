# Spotify Implicit Grant Flow Implementation

This implementation provides a complete Spotify Implicit Grant Flow integration for React Native apps using Expo.

## Overview

The Implicit Grant Flow is a simplified OAuth 2.0 flow that allows client-side applications to obtain access tokens directly from the authorization server without requiring a backend server. However, it has some security limitations:

- **Pros**: Simple to implement, no backend required
- **Cons**: Tokens cannot be refreshed, shorter token lifetime, less secure than Authorization Code with PKCE

## Setup Instructions

### 1. Spotify App Configuration

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app or select an existing one
3. Add redirect URIs:
   - For web development: `http://localhost:19006/spotify-callback`
   - For mobile development: `exp://192.168.1.100:8081/--/spotify-callback`
   - For production: Update with your actual domains

### 2. Environment Configuration

For Client Credentials Flow (optional, for public data):
```bash
EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

## Implementation

### Service Layer (`services/spotifyService.ts`)

The `SpotifyService` class provides:

- **Implicit Grant Flow**: `getAuthorizationUrl()` and `handleImplicitGrantCallback()`
- **Client Credentials Flow**: For public data access
- **Token Management**: Automatic token validation and expiration handling
- **API Methods**: Search, playlists, user data, playback control

Key methods:
```typescript
// Get authorization URL for user login
const authUrl = await spotifyService.getAuthorizationUrl();

// Handle callback with access token
const success = await spotifyService.handleImplicitGrantCallback(urlFragment);

// Check authentication status
const isAuth = await spotifyService.isAuthenticated();
const isImplicit = spotifyService.isUsingImplicitGrant();
const expiringSoon = spotifyService.isTokenExpiringSoon();
```

### Store Layer (`store/spotifyStore.ts`)

Zustand store with persistence for:

- Authentication state management
- User data and playlists
- Playback controls
- Music preferences

Key actions:
```typescript
const {
  connectSpotifyImplicit,
  getSpotifyAuthUrl,
  disconnectSpotify,
  isConnected,
  user,
  currentTrack
} = useSpotifyStore();
```

### Component Layer

#### SpotifyMusicPlayer Component
Ready-to-use music player with:
- Connection button for unauthenticated users
- Current track display
- Playback controls
- Workout recommendations

#### Spotify Integration Page
Comprehensive example showing:
- Connection status and user info
- Current track with controls
- Top tracks list
- Workout playlists
- Setup instructions

## Usage Examples

### Basic Connection Flow

```typescript
import { useSpotifyStore } from '@/store/spotifyStore';
import { Linking, Platform } from 'react-native';

const { getSpotifyAuthUrl, connectSpotifyImplicit, isConnected } = useSpotifyStore();

const handleConnect = async () => {
  const authUrl = await getSpotifyAuthUrl();
  
  if (Platform.OS === 'web') {
    // Web popup flow
    const popup = window.open(authUrl, 'spotify-auth', 'width=500,height=600');
    
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        const urlFragment = localStorage.getItem('spotify_callback_fragment');
        if (urlFragment) {
          localStorage.removeItem('spotify_callback_fragment');
          connectSpotifyImplicit(urlFragment);
        }
      }
    }, 1000);
  } else {
    // Mobile deep linking
    await Linking.openURL(authUrl);
  }
};
```

### Callback Handling

The callback page (`app/spotify-callback.tsx`) automatically:
1. Extracts the access token from URL fragment
2. Stores it securely
3. Redirects back to the app

For web popup flow, it stores the fragment in localStorage for the parent window.

### Playback Control

```typescript
const { playTrack, pauseTrack, currentTrack } = useSpotifyStore();

// Play a specific track
await playTrack('spotify:track:4iV5W9uYEdYUVa79Axb7Rh');

// Pause current playback
await pauseTrack();

// Get current track info
console.log(currentTrack?.name);
```

## Security Considerations

1. **Token Storage**: Tokens are stored in AsyncStorage with encryption
2. **State Parameter**: Random state parameter prevents CSRF attacks
3. **Token Expiration**: Automatic token validation and expiration handling
4. **Scope Limitation**: Request only necessary scopes

## Limitations

1. **No Token Refresh**: Implicit grant tokens cannot be refreshed
2. **Short Lifetime**: Tokens typically expire in 1 hour
3. **Client-Side Storage**: Tokens stored on client side (less secure)
4. **Premium Required**: Playback control requires Spotify Premium

## Migration to Authorization Code with PKCE

For production apps, consider migrating to Authorization Code with PKCE:

```typescript
// Use the PKCE method instead
const authUrl = await spotifyService.getAuthorizationUrlWithPKCE();
```

This provides:
- Longer token lifetime
- Refresh token support
- Better security
- Same user experience

## Testing

1. Visit `/spotify-integration` page in your app
2. Click "Connect Spotify"
3. Complete OAuth flow
4. Test playback controls (requires Spotify Premium)
5. View user data and playlists

## Troubleshooting

### Common Issues

1. **Redirect URI Mismatch**: Ensure redirect URIs in Spotify app match exactly
2. **Token Expired**: Tokens expire after 1 hour, user needs to re-authenticate
3. **Playback Errors**: Requires active Spotify Premium subscription
4. **CORS Issues**: Web development may require proxy or HTTPS

### Debug Information

Check the Spotify Integration page for:
- Connection status
- Token type (Client Credentials vs Implicit Grant)
- Token expiration warnings
- Setup instructions

## API Reference

### SpotifyService Methods

- `getAuthorizationUrl()`: Get OAuth authorization URL
- `handleImplicitGrantCallback(fragment)`: Process callback
- `isAuthenticated()`: Check if user is authenticated
- `getCurrentUser()`: Get user profile
- `getTopTracks()`: Get user's top tracks
- `getWorkoutPlaylists()`: Search workout playlists
- `play(uri?)`: Start playback
- `pause()`: Pause playback
- `next()`: Skip to next track
- `previous()`: Skip to previous track

### Store Actions

- `connectSpotifyImplicit(fragment)`: Connect using implicit flow
- `getSpotifyAuthUrl()`: Get authorization URL
- `disconnectSpotify()`: Disconnect and clear tokens
- `loadUserData()`: Load user profile and top tracks
- `playTrack(uri)`: Play specific track
- `updateCurrentTrack()`: Refresh current track info

## Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
- [Implicit Grant Flow Guide](https://developer.spotify.com/documentation/general/guides/authorization/implicit-grant/)
- [Authorization Scopes](https://developer.spotify.com/documentation/general/guides/authorization/scopes/)