# Spotify Integration Setup Guide

## Overview
This guide will help you set up Spotify integration for the Zown HQ fitness app. The integration allows users to connect their Spotify accounts to play music during workouts and get personalized recommendations.

## Prerequisites
1. A Spotify Developer account
2. A registered Spotify app

## Step 1: Spotify App Configuration

### 1.1 Create/Configure Spotify App
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app or select your existing app
3. Click "Edit Settings"

### 1.2 Configure Redirect URIs
Add the following redirect URI to your Spotify app settings:
```
zownhq://spotify-callback
```

**Important Notes:**
- The redirect URI must be EXACTLY as shown above
- This is the app's deep-link scheme registered in `app.json`

### 1.3 Get Your Credentials
- **Client ID**: Copy this from your Spotify app dashboard
- **Client Secret**: Stored server-side in Firebase Secret Manager (`SPOTIFY_CLIENT_SECRET`)

## Step 2: Update App Configuration

### 2.1 Set the Client ID in `.env`
```
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id_here
EXPO_PUBLIC_SPOTIFY_REDIRECT_URI=zownhq://spotify-callback
```

### 2.2 Set the Client Secret (server-side)
```
firebase functions:secrets:set SPOTIFY_CLIENT_SECRET
```

## Step 3: Test the Integration

### 3.1 Test the Connection Flow
1. Go to Settings → Music Integration
2. Click "Connect Spotify"
3. Complete the authorization flow
4. Verify the connection is successful

## Troubleshooting

### Common Issues

#### 1. "Invalid redirect URI" Error
- **Cause**: The redirect URI in your Spotify app settings doesn't match exactly
- **Solution**: Ensure the redirect URI is exactly `zownhq://spotify-callback`

#### 2. "Invalid client" Error
- **Cause**: Client ID or Client Secret is incorrect
- **Solution**: Double-check your credentials from the Spotify Developer Dashboard

#### 3. Deep link does not open the app
- **Cause**: The `zownhq` scheme is not registered on the device
- **Solution**: Rebuild the dev client after changes to `app.json` (`eas build --profile development`)

## Security Notes

1. **Client Secret**: Keep your client secret in Firebase Secret Manager — never expose it in client-side code
2. **State Parameter**: The integration uses a state parameter for CSRF protection
3. **PKCE**: Authorization Code flow with PKCE is used for user auth
4. **Token Storage**: Access tokens are stored securely using AsyncStorage

## Flow Diagram

```
User clicks "Connect Spotify"
         ↓
App generates auth URL with state + PKCE challenge
         ↓
User redirected to Spotify
         ↓
User authorizes the app
         ↓
Spotify redirects to zownhq://spotify-callback
         ↓
App exchanges code for tokens via backend proxy
         ↓
App stores tokens and updates UI
```
