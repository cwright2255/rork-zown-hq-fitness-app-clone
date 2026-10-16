# Spotify Integration Setup

This app uses Spotify's Client Credentials Flow to access public music data for workout playlists and music recommendations.

## Setup Instructions

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create App"
4. Fill in the app details:
   - **App Name**: Your fitness app name
   - **App Description**: Brief description of your app
   - **Website**: Your app's website (can be localhost for development)
   - **Redirect URI**: Add `zownhq://spotify-callback`
5. Accept the terms and create the app

### 2. Get Your Credentials

1. In your app dashboard, you'll see:
   - **Client ID**: Already configured in the code
   - **Client Secret**: Click "Show Client Secret" to reveal it

### 3. Save the Client Secret in Firebase

Never put the Client Secret in `.env` or in an `EXPO_PUBLIC_` variable: those are copied into the app, where anyone can read
them. Save it where only the cloud functions can read it. The app asks the `getSpotifyAppToken` function for its token.

```
firebase functions:secrets:set SPOTIFY_CLIENT_ID
firebase functions:secrets:set SPOTIFY_CLIENT_SECRET
firebase deploy --only functions
```

Paste the Client ID and the Client Secret from step 2 when asked.

### 4. Restart Development Server

After adding the environment variable, restart your development server:

```bash
npm start
# or
yarn start
# or
bun start
```

### 4. Deep-link Callback

User authentication uses the `zownhq://spotify-callback` deep link scheme — no external hosting is required. The scheme is registered in `app.json`. Rebuild the dev client after changes (`eas build --profile development`) for the scheme to take effect.

## What This Enables

### With Client Credentials Flow (automatic):
- ✅ Search for tracks, artists, albums, playlists
- ✅ Get public playlist information
- ✅ Get track recommendations
- ✅ Access public music data for workout suggestions

### With User Authentication (requires "Connect Spotify" button):
- ✅ User's personal playlists
- ✅ User's top tracks/artists
- ✅ Playback control (Premium required)
- ✅ Creating playlists in user's account
- ✅ Currently playing track

## Authentication Flows

The app supports two authentication methods:

1. **Client Credentials Flow** (automatic): For public data access
2. **Implicit Grant Flow** (user initiated): For personal data and playback control

## Security Notes

- Never commit your Client Secret to version control
- The `.env` file should be in your `.gitignore`
- Client Credentials Flow is safe for client-side apps as it only accesses public data
- For production apps, consider using a backend service to handle sensitive credentials

## Testing

Once configured, the app will automatically:

1. Obtain a Client Credentials token on startup
2. Refresh the token when it expires (every hour)
3. Use the token for all Spotify API requests

You should see "Client credentials token obtained successfully" in your console when it's working correctly.