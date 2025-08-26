# Spotify Callback Setup

## Overview
Since Spotify requires a `.com` domain for redirect URIs, we use `https://rork.com/spotify-callback` as our callback URL.

## Required Setup

### 1. Spotify App Configuration
In your Spotify app settings at https://developer.spotify.com/dashboard:

Add this redirect URI:
- `https://rork.com/spotify-callback`
- `myapp://spotify-callback` (for mobile deep linking)

### 2. Callback Page at rork.com
The following HTML page should be hosted at `https://rork.com/spotify-callback`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Spotify Callback</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
        <h2>Connecting to Spotify...</h2>
        <p>Please wait while we complete the authentication process.</p>
    </div>

    <script>
        // Extract the access token from URL fragment
        const urlFragment = window.location.hash;
        const urlParams = new URLSearchParams(window.location.search);
        
        console.log('Spotify callback page - URL fragment:', urlFragment);
        console.log('Spotify callback page - URL search:', window.location.search);
        
        // Check for errors
        const error = urlParams.get('error');
        if (error) {
            console.error('Spotify authentication error:', error);
            const errorDescription = urlParams.get('error_description') || 'Unknown error';
            console.error('Error description:', errorDescription);
            
            // Redirect back to app with error
            const appUrl = 'https://your-app-domain.com/spotify-callback?error=' + encodeURIComponent(error);
            window.location.href = appUrl;
            return;
        }
        
        // If we have a fragment (implicit grant flow)
        if (urlFragment) {
            // Redirect back to the app with the token in the URL
            const appUrl = 'https://your-app-domain.com/spotify-callback' + urlFragment;
            console.log('Redirecting to app with token:', appUrl);
            window.location.href = appUrl;
        } else {
            console.log('No URL fragment found, redirecting to app home');
            window.location.href = 'https://your-app-domain.com/';
        }
    </script>
</body>
</html>
```

### 3. Update App Domain
Replace `https://your-app-domain.com` in the callback page with your actual app domain.

## How It Works

1. User clicks "Connect Spotify" in the app
2. App redirects to Spotify authorization URL with `redirect_uri=https://rork.com/spotify-callback`
3. User authorizes the app on Spotify
4. Spotify redirects to `https://rork.com/spotify-callback` with access token in URL fragment
5. The callback page extracts the token and redirects back to your app
6. Your app's `/spotify-callback` route handles the token and completes authentication

## Testing

1. Make sure the callback page is live at `https://rork.com/spotify-callback`
2. Add the redirect URI to your Spotify app settings
3. Test the "Connect Spotify" flow in your app

## Security Notes

- The callback page should be served over HTTPS
- The access token is only passed through URL fragments, which are not sent to the server
- Consider adding additional validation in the callback page if needed