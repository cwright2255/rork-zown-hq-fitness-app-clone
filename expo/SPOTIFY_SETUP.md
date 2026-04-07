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
   - **Redirect URI**: Add `https://rork.com/spotify-callback` and `myapp://spotify-callback`
5. Accept the terms and create the app

### 2. Get Your Credentials

1. In your app dashboard, you'll see:
   - **Client ID**: Already configured in the code
   - **Client Secret**: Click "Show Client Secret" to reveal it

### 3. Configure Environment Variables

Create a `.env` file in your project root (if it doesn't exist) and add:

```
EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=your_actual_client_secret_here
```

Replace `your_actual_client_secret_here` with the Client Secret from step 2.

### 4. Restart Development Server

After adding the environment variable, restart your development server:

```bash
npm start
# or
yarn start
# or
bun start
```

### 4. Set Up Callback Page (Required for User Authentication)

For user authentication features, you need to set up a callback page at `https://rork.com/spotify-callback`.

See `SPOTIFY_CALLBACK_SETUP.md` for detailed instructions.

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