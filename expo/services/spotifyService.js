import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
  uri: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  tracks: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
  uri: string;
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email?: string;
  images: SpotifyImage[];
  followers: {
    href: string | null;
    total: number;
  };
  country?: string;
  explicit_content?: {
    filter_enabled: boolean;
    filter_locked: boolean;
  };
  external_urls: {
    spotify: string;
  };
  href: string;
  product?: string;
  type: string;
  uri: string;
}

class SpotifyService {
  private baseUrl = 'https://api.spotify.com/v1';
  private apiBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || '';
  public clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || 'cb884c0e045d4683bd3f0b38cb0e151e';
  private projectId = process.env.EXPO_PUBLIC_PROJECT_ID || 'n6dgejrmm3wincmkq5smp';
  private nativeRedirectUri = 'zownhq://spotify-callback';
  private hostedWebRedirectUri = 'zownhq://spotify-callback';
  private hostedNativeCallbackUri = 'zownhq://spotify-callback';
  private redirectUri = this.computeRedirectUri();
  private token: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private state: string | null = null;
  private codeVerifier: string | null = null;
  private isClientCredentialsFlow = false;

  constructor() {
    console.log('SpotifyService: Initializing...');
    console.log('SpotifyService: Client ID:', this.clientId);
    console.log('SpotifyService: Client Secret available:', !!this.getClientSecret());
    console.log('SpotifyService: Redirect URI:', this.redirectUri);
    void this.loadStoredToken();
    void this.autoInitialize();
  }

  private computeRedirectUri() {
    const explicitRedirect = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI || '';
    if (explicitRedirect) {
      console.log('SpotifyService: Using explicit redirect URI from env:', explicitRedirect);
      return explicitRedirect;
    }

    const hostedCallbackUri = 'zownhq://spotify-callback';

    if (Platform.OS !== 'web') {
      console.log('SpotifyService: Using native app scheme redirect URI:', hostedCallbackUri);
      return hostedCallbackUri;
    }

    console.log('SpotifyService: Using app scheme redirect URI:', hostedCallbackUri);
    return hostedCallbackUri;
  }

  private async autoInitialize() {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (this.token && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      console.log('SpotifyService: Existing token still valid, skipping auto-init');
      return;
    }
    
    console.log('SpotifyService: Initializing client credentials for public API access...');
    const success = await this.initializeClientCredentials();
    if (success) {
      console.log('SpotifyService: Client credentials initialized successfully!');
    } else {
      console.log('SpotifyService: Client credentials failed - check EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET');
    }
  }

  async ensureToken() {
    if (this.token && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return true;
    }
    console.log('SpotifyService: Token missing or expired, re-initializing...');
    return await this.initializeClientCredentials();
  }

  private getClientSecret() {
    return process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET || '';
  }

  private async loadStoredToken() {
    try {
      const [storedToken, storedRefreshToken, storedExpiresAt, isClientCreds] = await Promise.all([
        AsyncStorage.getItem('spotify_access_token'),
        AsyncStorage.getItem('spotify_refresh_token'),
        AsyncStorage.getItem('spotify_token_expires_at'),
        AsyncStorage.getItem('spotify_is_client_credentials')
      ]);
      
      if (storedToken) {
        this.token = storedToken;
        this.refreshToken = storedRefreshToken;
        this.tokenExpiresAt = storedExpiresAt ? parseInt(storedExpiresAt) : null;
        this.isClientCredentialsFlow = isClientCreds === 'true';
        
        // Check if token is expired and refresh if needed
        if (this.tokenExpiresAt && Date.now() > this.tokenExpiresAt) {
          if (this.isClientCredentialsFlow) {
            await this.refreshClientCredentialsToken();
          } else {
            await this.refreshAccessToken();
          }
        }
      }
    } catch (error) {
      console.error('Failed to load stored Spotify token:', error);
    }
  }

  private async storeToken(token, refreshToken?, expiresIn?, isClientCredentials = false) {
    try {
      await AsyncStorage.setItem('spotify_access_token', token);
      await AsyncStorage.setItem('spotify_is_client_credentials', isClientCredentials.toString());
      this.token = token;
      this.isClientCredentialsFlow = isClientCredentials;
      
      if (refreshToken) {
        await AsyncStorage.setItem('spotify_refresh_token', refreshToken);
        this.refreshToken = refreshToken;
      }
      
      if (expiresIn) {
        const expiresAt = Date.now() + (expiresIn * 1000);
        await AsyncStorage.setItem('spotify_token_expires_at', expiresAt.toString());
        this.tokenExpiresAt = expiresAt;
      }
    } catch (error) {
      console.error('Failed to store Spotify token:', error);
    }
  }

  private getSpotifyProxyCandidates(): string[] {
    const urls: string[] = [];

    if (Platform.OS === 'web') {
      urls.push('/api/spotify/token');

      if (typeof window !== 'undefined' && window.location?.origin) {
        urls.push(`${window.location.origin}/api/spotify/token`);
      }
    }

    if (this.apiBaseUrl) {
      urls.push(`${this.apiBaseUrl}/api/spotify/token`);
    }

    return Array.from(new Set(urls.filter(Boolean)));
  }

  private async requestSpotifyTokenViaProxy(payload: {
    grantType: 'client_credentials' | 'authorization_code' | 'refresh_token';
    code?: string;
    redirectUri?: string;
    codeVerifier?: string;
    refreshToken?: string;
  }) {
    const candidateUrls = this.getSpotifyProxyCandidates();

    if (candidateUrls.length === 0) {
      throw new Error('Spotify proxy is unavailable because no API base URL could be resolved');
    }

    console.log('SpotifyService: Requesting Spotify token via backend proxy...');
    console.log('SpotifyService: Proxy candidates:', candidateUrls);

    let lastError: Error | null = null;

    for (const url of candidateUrls) {
      try {
        console.log('SpotifyService: Trying Spotify proxy URL:', url);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('SpotifyService: Backend Spotify token proxy failed:', {
            url,
            status: response.status,
            errorData,
          });
          lastError = new Error(errorData.error || `Spotify proxy failed with status ${response.status}`);
          continue;
        }

        const data = await response.json() | SpotifyClientCredentialsResponse;
        console.log('SpotifyService: Spotify token proxy succeeded via:', url);
        return data;
      } catch (error) {
        console.error('SpotifyService: Spotify proxy network failure:', {
          url,
          error,
        });
        lastError = error instanceof Error ? error : new Error('Unknown Spotify proxy error');
      }
    }

    throw lastError ?? new Error('Spotify token proxy failed');
  }

  private async fetchWebApi(endpoint, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?) {
    if (!this.token || (this.tokenExpiresAt && Date.now() > this.tokenExpiresAt)) {
      console.log('SpotifyService: Token missing or expired, refreshing before API call...');
      if (this.isClientCredentialsFlow || !this.refreshToken) {
        const refreshed = await this.initializeClientCredentials();
        if (!refreshed) {
          throw new Error('Failed to get Spotify access token. Please try refreshing.');
        }
      } else if (this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          throw new Error('Failed to refresh Spotify user token');
        }
      }
    }

    if (!this.token) {
      const initialized = await this.initializeClientCredentials();
      if (!initialized || !this.token) {
        throw new Error('No Spotify access token available. Please authenticate first by clicking "Connect Spotify".');
      }
    }

    const res = await fetch(`${this.baseUrl}/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      method,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      
      switch (res.status) {
        case 401:
          // Token expired or invalid, try to refresh
          if (this.isClientCredentialsFlow) {
            const refreshed = await this.refreshClientCredentialsToken();
            if (refreshed) {
              // Retry the request with new token
              return this.fetchWebApi(endpoint, method, body);
            }
          }
          await this.clearToken();
          throw new Error('Spotify token expired or invalid');
        case 403:
          // Forbidden - bad OAuth request
          throw new Error('Bad OAuth request. Please re-authenticate.');
        case 429:
          // Rate limited
          const retryAfter = res.headers.get('Retry-After');
          throw new Error(`Rate limited. Retry after ${retryAfter} seconds.`);
        default:
          throw new Error(`Spotify API error: ${res.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
    }

    return await res.json();
  }

  // Handle PKCE authorization code callback
  async handleAuthorizationCodeCallback(url) {
    console.log('Handling Spotify callback with URL:', url);
    
    try {
      // Parse URL to get query params (code is in query string, not fragment)
      let code: string | null = null;
      let receivedState: string | null = null;
      let error: string | null = null;
      
      // Check if it's a full URL or just params
      if (url.includes('?')) {
        const urlObj = new URL(url);
        code = urlObj.searchParams.get('code');
        receivedState = urlObj.searchParams.get('state');
        error = urlObj.searchParams.get('error');
      } else if (url.includes('code=')) {
        const params = new URLSearchParams(url.replace('?', ''));
        code = params.get('code');
        receivedState = params.get('state');
        error = params.get('error');
      }

      console.log('Parsed callback params:', {
        code: code ? 'present' : 'missing',
        receivedState,
        error,
      });

      if (error) {
        console.error('Spotify authentication error:', error);
        return false;
      }

      // Get stored state and code verifier
      const storedState = await AsyncStorage.getItem('spotify_auth_state');
      const storedCodeVerifier = await AsyncStorage.getItem('spotify_code_verifier');

      if (storedState && storedState !== receivedState) {
        console.error('State mismatch during Spotify authentication');
        console.error('Expected:', storedState, 'Received:', receivedState);
        return false;
      }

      if (!code) {
        console.error('No authorization code received from Spotify');
        return false;
      }

      if (!storedCodeVerifier) {
        console.error('No code verifier found - PKCE flow broken');
        return false;
      }

      // Exchange code for token
      console.log('Exchanging authorization code for token...');
      const tokenData = await this.requestSpotifyTokenViaProxy({
        grantType: 'authorization_code',
        code,
        redirectUri: this.redirectUri,
        codeVerifier: storedCodeVerifier,
      });
      console.log('Token exchange successful');

      // Store the tokens
      await this.storeToken(
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.expires_in || 3600,
        false
      );

      // Clean up stored PKCE data
      await AsyncStorage.removeItem('spotify_code_verifier');
      await AsyncStorage.removeItem('spotify_auth_state');
      
      this.state = null;
      this.codeVerifier = null;
      console.log('Spotify authentication successful');
      return true;
    } catch (error) {
      console.error('Failed to handle Spotify callback:', error);
      return false;
    }
  }

  // Legacy method for backward compatibility with implicit grant
  async handleImplicitGrantCallback(urlFragment) {
    // Check if this is actually an authorization code callback
    if (urlFragment.includes('code=') || urlFragment.includes('?code=')) {
      return this.handleAuthorizationCodeCallback(urlFragment);
    }
    
    console.log('Handling Spotify implicit grant callback:', urlFragment);
    
    try {
      const params = new URLSearchParams(urlFragment.replace('#', ''));
      const accessToken = params.get('access_token');
      const tokenType = params.get('token_type');
      const expiresIn = params.get('expires_in');
      const error = params.get('error');

      if (error) {
        console.error('Spotify authentication error:', error);
        return false;
      }

      if (!accessToken || tokenType !== 'Bearer') {
        console.error('Invalid token response from Spotify');
        return false;
      }

      await this.storeToken(
        accessToken, 
        undefined,
        expiresIn ? parseInt(expiresIn) : 3600,
        false
      );
      
      console.log('Spotify authentication successful');
      return true;
    } catch (error) {
      console.error('Failed to handle Spotify callback:', error);
      return false;
    }
  }

  async authenticate(authCode, _receivedState = '') {
    return this.handleImplicitGrantCallback(authCode);
  }

  async isAuthenticated() {
    return !!this.token;
  }

  // Check if using client credentials (public data only)
  isUsingClientCredentials() {
    return this.isClientCredentialsFlow;
  }

  // Check if using implicit grant flow (user auth but no refresh token)
  isUsingImplicitGrant() {
    return !this.isClientCredentialsFlow && !this.refreshToken && !!this.token;
  }

  // Check if token will expire soon (within 5 minutes)
  isTokenExpiringSoon() {
    if (!this.tokenExpiresAt) return false;
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return this.tokenExpiresAt < fiveMinutesFromNow;
  }

  // Switch to user authentication flow
  async switchToUserAuth() {
    if (this.isClientCredentialsFlow) {
      await this.clearToken();
      // User would then need to authenticate via OAuth flow
    }
  }

  // Get setup instructions for Spotify integration
  getSetupInstructions() {
    const clientSecret = this.getClientSecret();
    const hasValidClientSecret = !!clientSecret && clientSecret.length > 10 && clientSecret !== this.clientId;
    
    return `
Spotify Integration (Client Credentials Flow):

This app uses Client Credentials flow which:
✓ Does NOT require redirect URIs
✓ Works immediately with valid credentials
✓ Allows searching tracks, playlists, and recommendations

Setup:
1. Go to https://developer.spotify.com/dashboard
2. Create or select your app
3. Copy your Client ID and Client Secret
4. Set EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET in your environment

Current Status:
- Client ID: ${this.clientId} ✓
- Client Secret: ${hasValidClientSecret ? 'Configured ✓' : 'Not configured or invalid ⚠️'}
- Token Status: ${this.token ? 'Active ✓' : 'Not available'}
- Flow Type: ${this.isClientCredentialsFlow ? 'Client Credentials' : 'User Auth'}

${hasValidClientSecret ? '✅ Ready! You can search playlists and get recommendations.' : '⚠️ Add your Client Secret to enable Spotify features.'}

Note: Client Credentials flow provides access to:
- Search tracks and playlists
- Browse featured playlists
- Get workout/running recommendations
- View public playlist details

It does NOT provide access to:
- User's personal playlists
- User's listening history
- Playback control`;
  }

  async clearToken() {
    try {
      await Promise.all([
        AsyncStorage.removeItem('spotify_access_token'),
        AsyncStorage.removeItem('spotify_refresh_token'),
        AsyncStorage.removeItem('spotify_token_expires_at'),
        AsyncStorage.removeItem('spotify_is_client_credentials')
      ]);
      this.token = null;
      this.refreshToken = null;
      this.tokenExpiresAt = null;
      this.isClientCredentialsFlow = false;
    } catch (error) {
      console.error('Failed to clear Spotify token:', error);
    }
  }

  // Initialize Client Credentials Flow for public data access
  // This is the PRIMARY authentication method - no redirect URIs needed
  async initializeClientCredentials() {
    const clientSecret = this.getClientSecret();
    console.log('SpotifyService: Initializing client credentials...');
    
    // Validate client secret
    if (!clientSecret || clientSecret.length < 10) {
      console.log('SpotifyService: Client secret not configured or too short');
      console.log('SpotifyService: Set EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET in your environment');
      return false;
    }
    
    if (clientSecret === this.clientId) {
      console.log('SpotifyService: Client secret cannot be the same as client ID');
      return false;
    }
    
    try {
      console.log('SpotifyService: Making client credentials request through backend proxy...');
      const data = await this.requestSpotifyTokenViaProxy({
        grantType: 'client_credentials',
      });
      console.log('SpotifyService: Token received, expires in', data.expires_in, 'seconds');
      
      await this.storeToken(data.access_token, undefined, data.expires_in, true);
      
      console.log('SpotifyService: Client credentials initialized successfully!');
      return true;
    } catch (error) {
      console.error('SpotifyService: Network error during client credentials:', error);
      console.error('SpotifyService: Proxy status snapshot:', {
        apiBaseUrl: this.apiBaseUrl,
        proxyCandidates: this.getSpotifyProxyCandidates(),
        platform: Platform.OS,
      });
      return false;
    }
  }

  // Refresh client credentials token
  private async refreshClientCredentialsToken() {
    return await this.initializeClientCredentials();
  }

  // Refresh access token using refresh token (for user authentication)
  private async refreshAccessToken() {
    if (!this.refreshToken) {
      console.warn('No refresh token available. Implicit Grant Flow tokens cannot be refreshed.');
      return false;
    }

    try {
      console.log('Refreshing Spotify token via backend proxy...');
      const data = await this.requestSpotifyTokenViaProxy({
        grantType: 'refresh_token',
        refreshToken: this.refreshToken,
      });

      await this.storeToken(
        data.access_token,
        data.refresh_token || this.refreshToken,
        data.expires_in || 3600,
        false
      );

      return true;
    } catch (error) {
      console.error('Failed to refresh Spotify token:', error);
      await this.clearToken();
      return false;
    }
  }

  // Generate code verifier for PKCE
  private generateCodeVerifier() {
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Generate code challenge from verifier
  private async generateCodeChallenge(verifier) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } else {
      // Fallback: use plain verifier (not recommended for production)
      return verifier;
    }
  }

  // Get user's top tracks (requires user authentication)
  async getTopTracks(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit = 20) {
    if (this.isClientCredentialsFlow) {
      console.warn('Top tracks require user authentication. Please authenticate first.');
      return [];
    }
    
    try {
      const response = await this.fetchWebApi(`me/top/tracks?time_range=${timeRange}&limit=${limit}`);
      return response.items || [];
    } catch (error) {
      console.error('Failed to get top tracks:', error);
      return [];
    }
  }

  // Get user's top artists (requires user authentication)
  async getTopArtists(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit = 20) {
    if (this.isClientCredentialsFlow) {
      console.warn('Top artists require user authentication. Please authenticate first.');
      return [];
    }
    
    try {
      const response = await this.fetchWebApi(`me/top/artists?time_range=${timeRange}&limit=${limit}`);
      return response.items || [];
    } catch (error) {
      console.error('Failed to get top artists:', error);
      return [];
    }
  }

  // Get user's playlists (requires user authentication)
  async getUserPlaylists(limit = 20) {
    if (this.isClientCredentialsFlow) {
      console.warn('User playlists require user authentication. Please authenticate first.');
      return [];
    }
    
    try {
      const response = await this.fetchWebApi(`me/playlists?limit=${limit}`);
      return response.items || [];
    } catch (error) {
      console.error('Failed to get user playlists:', error);
      return [];
    }
  }

  async getWorkoutPlaylists() {
    try {
      const queries = ['workout fitness gym', 'gym motivation', 'workout hits'];
      const query = queries[Math.floor(Math.random() * queries.length)];
      const response = await this.fetchWebApi(`search?q=${encodeURIComponent(query)}&type=playlist&limit=20`);
      return (response.playlists?.items || []).filter((p) => p !== null);
    } catch (error) {
      console.error('Failed to get workout playlists:', error);
      return [];
    }
  }

  async getRunningPlaylists() {
    try {
      const queries = ['running cardio jogging', 'running motivation', 'running hits'];
      const query = queries[Math.floor(Math.random() * queries.length)];
      const response = await this.fetchWebApi(`search?q=${encodeURIComponent(query)}&type=playlist&limit=20`);
      return (response.playlists?.items || []).filter((p) => p !== null);
    } catch (error) {
      console.error('Failed to get running playlists:', error);
      return [];
    }
  }

  // Get playlist tracks
  async getPlaylistTracks(playlistId) {
    try {
      const response = await this.fetchWebApi(`playlists/${playlistId}/items`);
      return response.items?.map((item) => item.track) || [];
    } catch (error) {
      console.error('Failed to get playlist tracks:', error);
      return [];
    }
  }

  // Search for tracks
  async searchTracks(query, limit = 20) {
    try {
      const response = await this.fetchWebApi(`search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);
      return response.tracks?.items || [];
    } catch (error) {
      console.error('Failed to search tracks:', error);
      return [];
    }
  }

  // Get current user profile (requires user authentication)
  async getCurrentUser() {
    if (this.isClientCredentialsFlow) {
      console.log('SpotifyService: Skipping /me profile fetch because token is client-credentials.');
      return null;
    }

    try {
      console.log('SpotifyService: Fetching current user profile from /v1/me...');
      const user = await this.fetchWebApi('me');

      if (!user || !user.id || !user.type) {
        console.error('SpotifyService: Invalid /me payload:', user);
        return null;
      }

      console.log('SpotifyService: Current user profile fetched:', user.display_name || user.id);
      return user;
    } catch (error) {
      console.error('SpotifyService: Failed to get current user profile from /me:', error);

      if (error instanceof Error && (error.message.includes('token') || error.message.includes('OAuth'))) {
        throw error;
      }

      return null;
    }
  }

  async validateUserSession() {
    try {
      const user = await this.getCurrentUser();
      const isValid = !!user?.id;
      console.log('SpotifyService: User session validation result:', isValid);
      return isValid;
    } catch (error) {
      console.error('SpotifyService: User session validation failed:', error);
      return false;
    }
  }

  // Check if user has required scopes
  checkUserScopes(): string[] {
    return [
      'user-read-private',
      'user-read-email',
      'user-top-read',
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-private',
      'playlist-modify-public',
      'user-read-currently-playing',
      'user-modify-playback-state',
      'user-read-playback-state',
    ];
  }

  // Get currently playing track (requires user authentication)
  async getCurrentlyPlaying() {
    if (this.isClientCredentialsFlow) {
      console.warn('Currently playing track requires user authentication. Please authenticate first.');
      return null;
    }
    
    try {
      const response = await this.fetchWebApi('me/player/currently-playing');
      return response?.item || null;
    } catch (error) {
      console.error('Failed to get currently playing track:', error);
      return null;
    }
  }

  // Control playback (requires Spotify Premium and user authentication)
  async play(uri?) {
    if (Platform.OS === 'web') {
      console.log('Playback control not available on web');
      return;
    }

    if (this.isClientCredentialsFlow) {
      console.warn('Playback control requires user authentication. Please authenticate first.');
      return;
    }

    try {
      const body = uri ? { uris: [uri] } : undefined;
      await this.fetchWebApi('me/player/play', 'PUT', body);
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  }

  async pause() {
    if (Platform.OS === 'web') {
      console.log('Playback control not available on web');
      return;
    }

    if (this.isClientCredentialsFlow) {
      console.warn('Playback control requires user authentication. Please authenticate first.');
      return;
    }

    try {
      await this.fetchWebApi('me/player/pause', 'PUT');
    } catch (error) {
      console.error('Failed to pause track:', error);
    }
  }

  async next() {
    if (Platform.OS === 'web') {
      console.log('Playback control not available on web');
      return;
    }

    if (this.isClientCredentialsFlow) {
      console.warn('Playback control requires user authentication. Please authenticate first.');
      return;
    }

    try {
      await this.fetchWebApi('me/player/next', 'POST');
    } catch (error) {
      console.error('Failed to skip to next track:', error);
    }
  }

  async previous() {
    if (Platform.OS === 'web') {
      console.log('Playback control not available on web');
      return;
    }

    if (this.isClientCredentialsFlow) {
      console.warn('Playback control requires user authentication. Please authenticate first.');
      return;
    }

    try {
      await this.fetchWebApi('me/player/previous', 'POST');
    } catch (error) {
      console.error('Failed to skip to previous track:', error);
    }
  }

  // Create a workout playlist (requires user authentication)
  async createWorkoutPlaylist(name, description, trackUris: string[]) {
    if (this.isClientCredentialsFlow) {
      console.warn('Creating playlists requires user authentication. Please authenticate first.');
      return null;
    }
    
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      // Create playlist
      const playlist = await this.fetchWebApi('me/playlists', 'POST', {
        name,
        description,
        public: false,
      });

      // Add tracks to playlist
      if (trackUris.length > 0) {
        await this.fetchWebApi(`playlists/${playlist.id}/items`, 'POST', {
          uris: trackUris,
        });
      }

      return playlist;
    } catch (error) {
      console.error('Failed to create workout playlist:', error);
      return null;
    }
  }

  async getWorkoutRecommendations(workoutType: 'cardio' | 'strength' | 'yoga' | 'running') {
    try {
      const queryMap = {
        cardio: ['cardio workout high energy', 'hiit workout music', 'dance workout hits', 'cardio pump playlist', 'gym cardio beats', 'high energy dance'],
        running: ['running workout pump up', 'running hits 2026', 'jog motivation beats', 'run tempo music', 'running pace beats', 'marathon training music'],
        strength: ['strength training gym power', 'weightlifting motivation', 'gym beast mode', 'heavy lifting playlist', 'powerlifting hype', 'gym pump up'],
        yoga: ['yoga meditation calm ambient', 'yoga flow music', 'peaceful meditation sounds', 'relaxing yoga', 'zen meditation', 'calm instrumental'],
      };

      const queries = queryMap[workoutType] || queryMap.cardio;
      const allTracks = [];
      const seenIds = new Set();

      const shuffled = [...queries].sort(() => Math.random() - 0.5);

      for (const searchQuery of shuffled) {
        if (allTracks.length >= 30) break;

        const offset = Math.floor(Math.random() * 10);
        console.log('[SpotifyService] Searching:', searchQuery, '| offset:', offset);

        try {
          const response = await this.fetchWebApi(
            `search?q=${encodeURIComponent(searchQuery)}&type=track&limit=30&offset=${offset}`
          );

          const tracks = (response.tracks?.items || []).filter((t) => t !== null);
          for (const track of tracks) {
            if (!seenIds.has(track.id)) {
              seenIds.add(track.id);
              allTracks.push(track);
            }
          }
          console.log('[SpotifyService] Found', allTracks.length, 'total tracks so far,', allTracks.filter(t => t.preview_url).length, 'with preview');
        } catch (searchError) {
          console.warn('[SpotifyService] Search failed for query:', searchQuery, searchError);
        }
      }

      const withPreview = allTracks.filter(t => t.preview_url);
      const withoutPreview = allTracks.filter(t => !t.preview_url);
      const sorted = [...withPreview, ...withoutPreview];

      const shuffledTracks = sorted.length > 0 
        ? [...withPreview.sort(() => Math.random() - 0.5), ...withoutPreview.sort(() => Math.random() - 0.5)]
        : [];

      console.log('[SpotifyService] Final:', shuffledTracks.length, 'tracks for', workoutType, '|', withPreview.length, 'with preview');
      return shuffledTracks.slice(0, 20);
    } catch (error) {
      console.error('Failed to get workout recommendations:', error);
      return [];
    }
  }

  // Get authorization URL for Authorization Code with PKCE Flow
  async getAuthorizationUrl() {
    console.log('Creating Spotify authorization URL with PKCE...');
    console.log('Client ID:', this.clientId);
    console.log('Redirect URI:', this.redirectUri);
    
    if (!this.clientId || typeof this.clientId !== 'string') {
      throw new Error(`Spotify client ID is not configured properly: ${typeof this.clientId} - ${this.clientId}`);
    }
    
    if (!this.redirectUri || typeof this.redirectUri !== 'string') {
      throw new Error(`Spotify redirect URI is not configured properly: ${typeof this.redirectUri} - ${this.redirectUri}`);
    }
    
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-top-read',
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-private',
      'playlist-modify-public',
      'user-read-currently-playing',
      'user-modify-playback-state',
      'user-read-playback-state',
    ].join(' ');

    // Generate random state for security
    this.state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Generate PKCE code verifier and challenge
    this.codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);
    
    // Store code verifier for later token exchange
    await AsyncStorage.setItem('spotify_code_verifier', this.codeVerifier);
    await AsyncStorage.setItem('spotify_auth_state', this.state);
    
    console.log('Generated state:', this.state);
    console.log('Generated code verifier (stored)');

    const paramsObj = {
      response_type: 'code',
      client_id: this.clientId,
      scope: scopes,
      redirect_uri: this.redirectUri,
      state: this.state,
      show_dialog: 'true',
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    };
    
    const params = new URLSearchParams(paramsObj);
    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    console.log('Generated auth URL:', authUrl);
    
    return authUrl;
  }

  async authenticateWithPopup() {
    if (Platform.OS !== 'web') {
      console.log('SpotifyService: Starting native auth session for Spotify...');
      try {
        const authUrl = await this.getAuthorizationUrl();
        console.log('SpotifyService: Native auth URL generated:', authUrl);
        console.log('SpotifyService: Native auth redirect URI:', this.redirectUri);

        const result = await WebBrowser.openAuthSessionAsync(authUrl, this.redirectUri);
        console.log('SpotifyService: Native auth session result:', JSON.stringify(result));

        if (result.type === 'success' && result.url) {
          const success = await this.handleAuthorizationCodeCallback(result.url);
          console.log('SpotifyService: Native auth callback handled:', success);
          return success;
        }

        if (result.type === 'cancel' || result.type === 'dismiss') {
          console.log('SpotifyService: Native auth session cancelled or dismissed');
          return false;
        }

        console.log('SpotifyService: Native auth session did not return success');
        return false;
      } catch (error) {
        console.error('SpotifyService: Native auth session failed:', error);
        return false;
      }
    }

    return new Promise((resolve) => {
      let resolved = false;
      let checkClosedInterval: ReturnType<typeof setInterval> | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let codeHandled = false;
      
      const cleanup = () => {
        if (checkClosedInterval) clearInterval(checkClosedInterval);
        if (timeoutId) clearTimeout(timeoutId);
        window.removeEventListener('message', messageListener);
      };
      
      const resolveOnce = (value) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(value);
        }
      };

      const extractAndHandleCode = async (url) => {
        if (codeHandled) return false;
        codeHandled = true;
        
        console.log('SpotifyService: Extracting auth data from URL:', url.substring(0, 100));
        
        try {
          if (url.includes('error=')) {
            const urlObj = new URL(url);
            const error = urlObj.searchParams.get('error');
            console.error('SpotifyService: Auth error in URL:', error);
            return false;
          }
          
          if (url.includes('code=')) {
            const success = await this.handleAuthorizationCodeCallback(url);
            console.log('SpotifyService: Code exchange result:', success);
            return success;
          }
          
          if (url.includes('access_token=')) {
            const hash = url.substring(url.indexOf('#'));
            const success = await this.handleImplicitGrantCallback(hash);
            return success;
          }
        } catch (error) {
          console.error('SpotifyService: Error handling auth data:', error);
          codeHandled = false;
        }
        
        return false;
      };
      
      const messageListener = async (event) => {
        if (!event.data || typeof event.data !== 'object') return;
        console.log('SpotifyService: Received message from popup:', event.data.type);
        
        if (event.data.type === 'SPOTIFY_AUTH_SUCCESS') {
          resolveOnce(true);
          return;
        }
        
        if (event.data.type === 'SPOTIFY_AUTH_ERROR') {
          console.error('SpotifyService: Auth error from popup:', event.data.error);
          resolveOnce(false);
          return;
        }
        
        if (event.data.type === 'SPOTIFY_AUTH_CODE') {
          const callbackUrl = event.data.url || `?code=${event.data.code}&state=${event.data.state}`;
          const success = await extractAndHandleCode(callbackUrl);
          resolveOnce(success);
          return;
        }
      };

      window.addEventListener('message', messageListener);

      void (async () => {
        try {
          const authUrl = await this.getAuthorizationUrl();
          console.log('SpotifyService: Opening popup for auth...');

          const popup = window.open(
            authUrl,
            'spotify-auth',
            'width=500,height=700,scrollbars=yes,resizable=yes,left=100,top=100'
          );

          if (!popup) {
            console.error('SpotifyService: Popup blocked by browser');
            resolveOnce(false);
            return;
          }

          checkClosedInterval = setInterval(() => {
            void (async () => {
              try {
                if (popup.closed) {
                  console.log('SpotifyService: Popup closed by user');
                  setTimeout(() => resolveOnce(false), 300);
                  return;
                }
              } catch {
              }

              try {
                const popupUrl = popup.location.href;
                if (!popupUrl || popupUrl === 'about:blank') return;

                const hasAuthData = popupUrl.includes('code=') || 
                                   popupUrl.includes('access_token=') || 
                                   popupUrl.includes('error=');

                if (hasAuthData && !codeHandled) {
                  console.log('SpotifyService: Detected auth data in popup URL');
                  popup.close();
                  const success = await extractAndHandleCode(popupUrl);
                  resolveOnce(success);
                }
              } catch {
              }
            })();
          }, 300);

          timeoutId = setTimeout(() => {
            try {
              if (!popup.closed) popup.close();
            } catch {
            }
            console.log('SpotifyService: Auth timeout after 5 minutes');
            resolveOnce(false);
          }, 5 * 60 * 1000);
        } catch (error) {
          console.error('SpotifyService: Error during popup auth:', error);
          resolveOnce(false);
        }
      })();
    });
  }

  // Get authorization URL for Authorization Code with PKCE Flow (alternative)
  async getAuthorizationUrlWithPKCE() {
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-top-read',
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-private',
      'playlist-modify-public',
      'user-read-currently-playing',
      'user-modify-playback-state',
      'user-read-playback-state',
    ].join(' ');

    this.state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: scopes,
      redirect_uri: this.redirectUri,
      state: this.state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  // Get the callback URL for deep linking setup
  getCallbackUrl() {
    return this.redirectUri;
  }
  
  // Get service status for debugging
  getServiceStatus() {
    const clientSecret = this.getClientSecret();
    return {
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      hasClientSecret: !!clientSecret && clientSecret.length > 0,
      hasToken: !!this.token,
      isClientCredentials: this.isClientCredentialsFlow,
      tokenExpiresAt: this.tokenExpiresAt,
    };
  }
}

export const spotifyService = new SpotifyService();