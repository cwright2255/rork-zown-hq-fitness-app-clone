import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
}

export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
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

export interface SpotifyAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface SpotifyClientCredentialsResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

class SpotifyService {
  private baseUrl = 'https://api.spotify.com/v1';
  public clientId = 'cb884c0e045d4683bd3f0b38cb0e151e';
  private projectId = process.env.EXPO_PUBLIC_PROJECT_ID || 'n6dgejrmm3wincmkq5smp';
  private redirectUri = Platform.OS === 'web' 
    ? `https://rork.app/p/${process.env.EXPO_PUBLIC_PROJECT_ID || 'n6dgejrmm3wincmkq5smp'}/spotify-callback` 
    : 'zown://spotify-callback';
  private token: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private state: string | null = null;
  private codeVerifier: string | null = null;
  private isClientCredentialsFlow = false;

  constructor() {
    console.log('SpotifyService: Initializing...');
    console.log('SpotifyService: Client ID:', this.clientId);
    console.log('SpotifyService: Redirect URI:', this.redirectUri);
    console.log('SpotifyService: Client Secret available:', !!this.getClientSecret());
    this.loadStoredToken();
    this.checkHtmlCallbackAuth();
  }

  private async checkHtmlCallbackAuth() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    
    try {
      const authCode = localStorage.getItem('spotify_auth_code');
      const authTimestamp = localStorage.getItem('spotify_auth_timestamp');
      
      if (authCode && authTimestamp) {
        const timestamp = parseInt(authTimestamp);
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        
        if (timestamp > fiveMinutesAgo) {
          console.log('SpotifyService: Found auth code from HTML callback, processing...');
          const state = localStorage.getItem('spotify_auth_state') || '';
          const url = `?code=${authCode}&state=${state}`;
          
          localStorage.removeItem('spotify_auth_code');
          localStorage.removeItem('spotify_auth_state');
          localStorage.removeItem('spotify_auth_timestamp');
          
          await this.handleAuthorizationCodeCallback(url);
        } else {
          localStorage.removeItem('spotify_auth_code');
          localStorage.removeItem('spotify_auth_state');
          localStorage.removeItem('spotify_auth_timestamp');
        }
      }
      
      const accessToken = localStorage.getItem('spotify_access_token');
      const tokenTimestamp = localStorage.getItem('spotify_auth_timestamp');
      
      if (accessToken && tokenTimestamp && !this.token) {
        const timestamp = parseInt(tokenTimestamp);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        if (timestamp > oneHourAgo) {
          console.log('SpotifyService: Found access token from HTML callback');
          const expiresIn = localStorage.getItem('spotify_expires_in') || '3600';
          await this.storeToken(accessToken, undefined, parseInt(expiresIn), false);
          
          localStorage.removeItem('spotify_access_token');
          localStorage.removeItem('spotify_token_type');
          localStorage.removeItem('spotify_expires_in');
          localStorage.removeItem('spotify_auth_timestamp');
        }
      }
    } catch (error) {
      console.error('SpotifyService: Error checking HTML callback auth:', error);
    }
  }

  private getClientSecret(): string {
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

  private async storeToken(token: string, refreshToken?: string, expiresIn?: number, isClientCredentials = false) {
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

  private async fetchWebApi(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<any> {
    // Check if token is expired and refresh if needed
    if (this.tokenExpiresAt && Date.now() > this.tokenExpiresAt) {
      if (this.isClientCredentialsFlow) {
        const refreshed = await this.refreshClientCredentialsToken();
        if (!refreshed) {
          throw new Error('Failed to refresh Spotify client credentials token');
        }
      } else if (this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          throw new Error('Failed to refresh Spotify user token');
        }
      } else {
        // Implicit grant flow - token expired and cannot be refreshed
        await this.clearToken();
        throw new Error('Spotify token expired. Please re-authenticate using getAuthorizationUrl().');
      }
    }

    if (!this.token) {
      // Try to get client credentials token if no token available
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
  async handleAuthorizationCodeCallback(url: string): Promise<boolean> {
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
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          code_verifier: storedCodeVerifier,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        console.error('Token exchange failed:', errorData);
        return false;
      }

      const tokenData = await tokenResponse.json();
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
  async handleImplicitGrantCallback(urlFragment: string): Promise<boolean> {
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

  // Legacy method for backward compatibility
  async authenticate(authCode: string, receivedState: string = ''): Promise<boolean> {
    // For implicit flow, we expect the full URL fragment, not just auth code
    return this.handleImplicitGrantCallback(authCode);
  }

  async isAuthenticated(): Promise<boolean> {
    return !!this.token;
  }

  // Check if using client credentials (public data only)
  isUsingClientCredentials(): boolean {
    return this.isClientCredentialsFlow;
  }

  // Check if using implicit grant flow (user auth but no refresh token)
  isUsingImplicitGrant(): boolean {
    return !this.isClientCredentialsFlow && !this.refreshToken && !!this.token;
  }

  // Check if token will expire soon (within 5 minutes)
  isTokenExpiringSoon(): boolean {
    if (!this.tokenExpiresAt) return false;
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return this.tokenExpiresAt < fiveMinutesFromNow;
  }

  // Switch to user authentication flow
  async switchToUserAuth(): Promise<void> {
    if (this.isClientCredentialsFlow) {
      await this.clearToken();
      // User would then need to authenticate via OAuth flow
    }
  }

  // Get setup instructions for Spotify integration
  getSetupInstructions(): string {
    const hasClientSecret = !!this.getClientSecret();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    
    return `
Spotify Integration Setup:

1. Go to https://developer.spotify.com/dashboard
2. Create or select your app
3. Click "Edit Settings"
4. Add these EXACT redirect URIs:
   - https://rork.app/p/n6dgejrmm3wincmkq5smp/spotify-callback
   - zown://spotify-callback

5. Save the settings

Current Status:
- Client ID: ${this.clientId} ✓
- Client Secret: ${hasClientSecret ? 'Configured ✓' : 'Not configured ⚠️'}
- Current Redirect URI: ${this.redirectUri} ✓
- Current Origin: ${currentOrigin}

${hasClientSecret ? 'Ready for both Client Credentials and User Authentication!' : 'Ready for User Authentication only. Set EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET for full functionality.'}

To connect:
1. Make sure redirect URIs are added to your Spotify app
2. Click "Connect Spotify" button
3. Authorize the app in Spotify
4. You'll be redirected back automatically

Note: User authentication works without client secret!
If you get "Invalid redirect URI" error, double-check the redirect URIs in your Spotify app settings.`;
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
  private async initializeClientCredentials(): Promise<boolean> {
    const clientSecret = this.getClientSecret();
    console.log('SpotifyService: Initializing client credentials...');
    console.log('SpotifyService: Client secret configured:', !!clientSecret && clientSecret !== 'your_client_secret_here');
    
    // Check if client secret is configured and different from client ID
    if (!clientSecret || clientSecret === '' || clientSecret === this.clientId) {
      console.log('Spotify client secret not configured. Using user authentication flow only.');
      return false;
    }
    
    try {
      const credentials = btoa(`${this.clientId}:${clientSecret}`);
      console.log('SpotifyService: Making client credentials request...');
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      console.log('SpotifyService: Client credentials response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('Client credentials authentication failed (expected without valid secret):', errorData);
        return false;
      }

      const data: SpotifyClientCredentialsResponse = await response.json();
      console.log('SpotifyService: Client credentials token received');
      await this.storeToken(data.access_token, undefined, data.expires_in, true);
      
      console.log('Client credentials token obtained successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize client credentials:', error);
      return false;
    }
  }

  // Refresh client credentials token
  private async refreshClientCredentialsToken(): Promise<boolean> {
    return await this.initializeClientCredentials();
  }

  // Refresh access token using refresh token (for user authentication)
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.warn('No refresh token available. Implicit Grant Flow tokens cannot be refreshed.');
      return false;
    }

    try {
      // In a real implementation, you would call your backend to refresh the token
      // For demo purposes, we'll simulate a successful refresh
      console.log('Refreshing Spotify token...');
      
      // Simulate token refresh
      const newToken = 'refreshed_token_' + Date.now();
      await this.storeToken(newToken, this.refreshToken, 3600); // 1 hour
      
      return true;
    } catch (error) {
      console.error('Failed to refresh Spotify token:', error);
      await this.clearToken();
      return false;
    }
  }

  // Generate code verifier for PKCE
  private generateCodeVerifier(): string {
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
  private async generateCodeChallenge(verifier: string): Promise<string> {
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
  async getTopTracks(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit: number = 20): Promise<SpotifyTrack[]> {
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
  async getTopArtists(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit: number = 20) {
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
  async getUserPlaylists(limit: number = 20): Promise<SpotifyPlaylist[]> {
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

  // Get workout playlists (search for workout-related playlists)
  async getWorkoutPlaylists(): Promise<SpotifyPlaylist[]> {
    try {
      const response = await this.fetchWebApi('search?q=workout%20fitness%20gym&type=playlist&limit=20');
      return response.playlists?.items || [];
    } catch (error) {
      console.error('Failed to get workout playlists:', error);
      return [];
    }
  }

  // Get running playlists
  async getRunningPlaylists(): Promise<SpotifyPlaylist[]> {
    try {
      const response = await this.fetchWebApi('search?q=running%20cardio%20jogging&type=playlist&limit=20');
      return response.playlists?.items || [];
    } catch (error) {
      console.error('Failed to get running playlists:', error);
      return [];
    }
  }

  // Get playlist tracks
  async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    try {
      const response = await this.fetchWebApi(`playlists/${playlistId}/tracks`);
      return response.items?.map((item: any) => item.track) || [];
    } catch (error) {
      console.error('Failed to get playlist tracks:', error);
      return [];
    }
  }

  // Search for tracks
  async searchTracks(query: string, limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      const response = await this.fetchWebApi(`search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);
      return response.tracks?.items || [];
    } catch (error) {
      console.error('Failed to search tracks:', error);
      return [];
    }
  }

  // Get current user profile (requires user authentication)
  async getCurrentUser(): Promise<SpotifyUser | null> {
    if (this.isClientCredentialsFlow) {
      console.warn('User profile requires user authentication. Please authenticate first.');
      // Return mock user for demo purposes when using client credentials
      return {
        id: 'demo_user',
        display_name: 'Demo User',
        images: [],
        followers: { 
          href: null,
          total: 0 
        },
        external_urls: {
          spotify: 'https://open.spotify.com/user/demo_user'
        },
        href: 'https://api.spotify.com/v1/users/demo_user',
        type: 'user',
        uri: 'spotify:user:demo_user'
      };
    }
    
    try {
      const user = await this.fetchWebApi('me');
      
      // Validate required fields
      if (!user.id || !user.type) {
        throw new Error('Invalid user data received from Spotify');
      }
      
      return user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      
      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes('token')) {
        throw error; // Re-throw auth errors
      }
      
      // Return mock user for demo purposes only
      return {
        id: 'demo_user',
        display_name: 'Demo User',
        images: [],
        followers: { 
          href: null,
          total: 0 
        },
        external_urls: {
          spotify: 'https://open.spotify.com/user/demo_user'
        },
        href: 'https://api.spotify.com/v1/users/demo_user',
        type: 'user',
        uri: 'spotify:user:demo_user'
      };
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
  async getCurrentlyPlaying(): Promise<SpotifyTrack | null> {
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
  async play(uri?: string) {
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
  async createWorkoutPlaylist(name: string, description: string, trackUris: string[]): Promise<SpotifyPlaylist | null> {
    if (this.isClientCredentialsFlow) {
      console.warn('Creating playlists requires user authentication. Please authenticate first.');
      return null;
    }
    
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      // Create playlist
      const playlist = await this.fetchWebApi(`users/${user.id}/playlists`, 'POST', {
        name,
        description,
        public: false,
      });

      // Add tracks to playlist
      if (trackUris.length > 0) {
        await this.fetchWebApi(`playlists/${playlist.id}/tracks`, 'POST', {
          uris: trackUris,
        });
      }

      return playlist;
    } catch (error) {
      console.error('Failed to create workout playlist:', error);
      return null;
    }
  }

  // Get recommendations based on workout type
  async getWorkoutRecommendations(workoutType: 'cardio' | 'strength' | 'yoga' | 'running'): Promise<SpotifyTrack[]> {
    try {
      let seedGenres: string[] = [];
      let targetEnergy = 0.5;
      let targetTempo = 120;

      switch (workoutType) {
        case 'cardio':
        case 'running':
          seedGenres = ['pop', 'dance', 'electronic'];
          targetEnergy = 0.8;
          targetTempo = 140;
          break;
        case 'strength':
          seedGenres = ['rock', 'hip-hop', 'electronic'];
          targetEnergy = 0.9;
          targetTempo = 130;
          break;
        case 'yoga':
          seedGenres = ['ambient', 'chill', 'new-age'];
          targetEnergy = 0.3;
          targetTempo = 80;
          break;
      }

      const response = await this.fetchWebApi(
        `recommendations?seed_genres=${seedGenres.join(',')}&target_energy=${targetEnergy}&target_tempo=${targetTempo}&limit=20`
      );

      return response.tracks || [];
    } catch (error) {
      console.error('Failed to get workout recommendations:', error);
      return [];
    }
  }

  // Get authorization URL for Authorization Code with PKCE Flow
  async getAuthorizationUrl(): Promise<string> {
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

    const paramsObj: Record<string, string> = {
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

  // Authenticate using popup window (for web)
  async authenticateWithPopup(): Promise<boolean> {
    if (Platform.OS !== 'web') {
      console.warn('Popup authentication is only available on web');
      return false;
    }

    return new Promise(async (resolve) => {
      try {
        const authUrl = await this.getAuthorizationUrl();
        console.log('Opening popup with URL:', authUrl);
        
        // Open popup window
        const popup = window.open(
          authUrl,
          'spotify-auth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        if (!popup) {
          console.error('Failed to open popup window');
          resolve(false);
          return;
        }

        // Listen for messages from the popup (for PKCE callback)
        const messageListener = async (event: MessageEvent) => {
          console.log('Received message from popup:', event.data);
          
          if (event.data.type === 'SPOTIFY_AUTH_CODE') {
            console.log('Authorization code received, exchanging for token...');
            window.removeEventListener('message', messageListener);
            
            try {
              const callbackUrl = event.data.url || `?code=${event.data.code}&state=${event.data.state}`;
              const success = await this.handleAuthorizationCodeCallback(callbackUrl);
              console.log('Token exchange result:', success);
              resolve(success);
            } catch (error) {
              console.error('Error exchanging code:', error);
              resolve(false);
            }
            return;
          }
          
          // Legacy support for implicit grant
          if (event.data.type === 'SPOTIFY_AUTH_SUCCESS') {
            console.log('Authentication successful (implicit grant)...');
            window.removeEventListener('message', messageListener);
            
            const tokenData = event.data.data;
            const urlFragment = `#access_token=${tokenData.access_token}&token_type=${tokenData.token_type}&expires_in=${tokenData.expires_in}&state=${tokenData.state}`;
            
            try {
              const success = await this.handleImplicitGrantCallback(urlFragment);
              resolve(success);
            } catch (error) {
              console.error('Error processing token:', error);
              resolve(false);
            }
            return;
          }
        };

        window.addEventListener('message', messageListener);

        // Poll for popup closure and URL changes
        const checkClosed = setInterval(async () => {
          if (popup.closed) {
            console.log('Popup was closed');
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            resolve(false);
          }
          
          // Try to read popup URL for code
          try {
            const popupUrl = popup.location.href;
            if (popupUrl && popupUrl.includes('code=')) {
              console.log('Detected authorization code in popup URL');
              clearInterval(checkClosed);
              window.removeEventListener('message', messageListener);
              popup.close();
              
              const success = await this.handleAuthorizationCodeCallback(popupUrl);
              resolve(success);
            }
          } catch {
            // Cross-origin - can't read URL, that's expected
          }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!popup.closed) {
            popup.close();
          }
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          console.log('Authentication timeout');
          resolve(false);
        }, 5 * 60 * 1000);

      } catch (error) {
        console.error('Error during popup authentication:', error);
        resolve(false);
      }
    });
  }

  // Get authorization URL for Authorization Code with PKCE Flow (alternative)
  async getAuthorizationUrlWithPKCE(): Promise<string> {
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
  getCallbackUrl(): string {
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