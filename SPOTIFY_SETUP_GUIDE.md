# Spotify Integration Setup Guide

## Overview
This guide will help you set up Spotify integration for the Zown HQ fitness app. The integration allows users to connect their Spotify accounts to play music during workouts and get personalized recommendations.

## Prerequisites
1. A Spotify Developer account
2. A registered Spotify app
3. Access to host a simple HTML file at your domain

## Step 1: Spotify App Configuration

### 1.1 Create/Configure Spotify App
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app or select your existing app
3. Click "Edit Settings"

### 1.2 Configure Redirect URIs
Add the following redirect URI to your Spotify app settings:
```
https://rork.com/spotify-callback.html
```

**Important Notes:**
- The redirect URI must be EXACTLY as shown above
- Spotify requires .com domains for redirect URIs
- The URL must be accessible and serve the callback HTML file

### 1.3 Get Your Credentials
- **Client ID**: Copy this from your Spotify app dashboard
- **Client Secret**: Copy this from your Spotify app dashboard (optional for implicit flow)

## Step 2: Host the Callback File

### 2.1 Create the Callback HTML File
Create a file named `spotify-callback.html` and host it at `https://rork.com/spotify-callback.html`

The file content is provided in `public/spotify-callback.html` in this project.

### 2.2 Verify the Callback URL
Make sure the URL `https://rork.com/spotify-callback.html` is accessible and returns the HTML content.

## Step 3: Update App Configuration

### 3.1 Update Client ID
In `services/spotifyService.ts`, update the client ID:
```typescript
public clientId = 'your_actual_client_id_here';
```

### 3.2 Update Client Secret (Optional)
For enhanced functionality, you can also set the client secret:
```typescript
private clientSecret = 'your_actual_client_secret_here';
```

## Step 4: Test the Integration

### 4.1 Use the Test Page
Navigate to `/spotify-test` in your app to test the integration:
1. Test Auth URL generation
2. Test callback handling
3. Check service status

### 4.2 Test the Connection Flow
1. Go to Settings → Music Integration
2. Click "Connect Spotify"
3. Complete the authorization flow
4. Verify the connection is successful

## Troubleshooting

### Common Issues

#### 1. "Invalid redirect URI" Error
- **Cause**: The redirect URI in your Spotify app settings doesn't match exactly
- **Solution**: Ensure the redirect URI is exactly `https://rork.com/spotify-callback.html`

#### 2. "Invalid client" Error
- **Cause**: Client ID or Client Secret is incorrect
- **Solution**: Double-check your credentials from the Spotify Developer Dashboard

#### 3. Popup Blocked
- **Cause**: Browser is blocking the popup window
- **Solution**: Allow popups for your domain or use the mobile redirect flow

#### 4. Callback File Not Found
- **Cause**: The callback HTML file is not accessible at the redirect URI
- **Solution**: Ensure the file is properly hosted and accessible

### Debug Information

Use the Spotify Test page (`/spotify-test`) to get detailed debug information:
- Service status
- Auth URL generation
- Callback handling simulation

## Alternative Setup (For Development)

If you can't host the callback file at `https://rork.com/spotify-callback.html`, you can:

1. Use a different domain you control
2. Update the redirect URI in both:
   - Spotify app settings
   - `services/spotifyService.ts`

Example for localhost development:
```typescript
private redirectUri = 'http://localhost:3000/spotify-callback.html';
```

## Security Notes

1. **Client Secret**: Keep your client secret secure and never expose it in client-side code
2. **State Parameter**: The integration uses a state parameter for CSRF protection
3. **Token Storage**: Access tokens are stored securely using AsyncStorage

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Use the test page for debugging
3. Verify all URLs are accessible
4. Double-check Spotify app settings

## Flow Diagram

```
User clicks "Connect Spotify"
         ↓
App generates auth URL with state
         ↓
User redirected to Spotify
         ↓
User authorizes the app
         ↓
Spotify redirects to callback URL
         ↓
Callback page processes token
         ↓
Token sent back to main app
         ↓
App stores token and updates UI
```

This setup ensures a secure and reliable Spotify integration for your fitness app.