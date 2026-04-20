# Spotify Callback Setup

## Overview
Spotify authentication uses the native deep-link scheme `zownhq://spotify-callback`. No external HTML callback page needs to be hosted — the app intercepts the redirect directly.

## Required Setup

### 1. Spotify App Configuration
In your Spotify app settings at https://developer.spotify.com/dashboard, add this redirect URI:

```
zownhq://spotify-callback
```

### 2. Deep Link Registration
The `zownhq` scheme is registered in `expo/app.json` under `expo.scheme` and in the iOS/Android linking config. It maps to the `app/spotify-callback.jsx` route.

### 3. Environment Variables
```
EXPO_PUBLIC_SPOTIFY_REDIRECT_URI=zownhq://spotify-callback
```

## How It Works

1. User taps "Connect Spotify" in the app
2. App opens Spotify authorization URL with `redirect_uri=zownhq://spotify-callback` and PKCE challenge
3. User authorizes on Spotify
4. Spotify redirects to `zownhq://spotify-callback?code=...&state=...`
5. Expo Router routes the deep link to `app/spotify-callback.jsx`
6. The callback route exchanges the code for tokens (via the `refreshSpotifyToken` Firebase Function or backend proxy) and stores them

## Testing

1. Add the redirect URI to your Spotify app dashboard
2. Build a dev client with `eas build --profile development` (the scheme only works on a real build, not Expo Go for deep links from an external browser)
3. Test the "Connect Spotify" flow in your app

## Security Notes

- The client secret is stored in Firebase Secret Manager (`SPOTIFY_CLIENT_SECRET`) — never in client code
- The integration uses Authorization Code flow with PKCE for user auth
- A `state` parameter is used for CSRF protection
- Access tokens are stored securely via AsyncStorage
