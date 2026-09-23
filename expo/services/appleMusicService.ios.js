import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth, MusicKit, Player, isMusicSubscriptionError } from '@lomray/react-native-apple-music';

// Real, new: Apple Music integration, built on the @lomray/react-native-apple-music
// native module (Apple's own MusicKit framework). This file only ever gets
// bundled into the iOS build - Metro's own platform-specific file
// resolution (the .ios.js suffix) means Android never even sees this
// import exist, which is what keeps this native-only code from being
// evaluated there at all.
//
// Real fix: this used to be a single, cross-platform file that loaded the
// package lazily (require(), then dynamic import()) specifically to avoid
// evaluating it on Android. Both approaches genuinely failed at runtime on
// iOS too, though - confirmed directly, twice, by diagnostic logging: the
// resolved module only ever had a lone, empty "default" key, never the
// real Auth/Player/MusicKit exports. Metro's own build-time transform
// pipeline is what reliably handles ESM packages like this one - it's just
// Metro's *runtime* require()/import() that couldn't resolve it. A static,
// top-level import is exactly what that pipeline is built for, and
// splitting into platform-specific files is what lets this be static
// safely, without risking the exact native-module-on-Android crash the
// lazy loading was originally protecting against.
//
// Unlike spotifyService.js, Apple's own MusicKit doesn't have a
// user-profile endpoint at all - it's built around playback/catalog
// access, not personal account data - so "connected" here means
// authorization succeeded, not that a profile was fetched.
//
// Also unlike Spotify's single play(uri) call, MusicKit splits "load a
// specific song" and "start playback" into two separate calls
// (MusicKit.setPlaybackQueue then Player.play) - play() below wraps both
// together so callers keep the same, one-call shape already established
// for Spotify.
class AppleMusicService {
  constructor() {
    this.isAuthorized = false;
  }

  isSupported() {
    return true;
  }

  async loadStoredAuthState() {
    try {
      const stored = await AsyncStorage.getItem('apple_music_authorized');
      this.isAuthorized = stored === 'true';
    } catch (error) {
      console.error('Failed to load stored Apple Music auth state:', error);
    }
  }

  async authenticate() {
    try {
      const status = await Auth.authorize();
      const authorized = status === 'authorized';
      this.isAuthorized = authorized;
      await AsyncStorage.setItem('apple_music_authorized', authorized.toString());
      return authorized;
    } catch (error) {
      console.error('Apple Music authorization failed:', error);
      return false;
    }
  }

  async checkSubscription() {
    try {
      const subscription = await Auth.checkSubscription();
      return {
        canPlayCatalogContent: !!subscription.canPlayCatalogContent,
        canBecomeSubscriber: !!subscription.canBecomeSubscriber,
      };
    } catch (error) {
      if (isMusicSubscriptionError && isMusicSubscriptionError(error)) {
        console.warn('Apple Music subscription check failed:', error.code);
      } else {
        console.error('Apple Music subscription check failed:', error?.message ?? error);
      }
      return { canPlayCatalogContent: false, canBecomeSubscriber: false };
    }
  }

  async isAuthenticated() {
    if (!this.isAuthorized) {
      await this.loadStoredAuthState();
    }
    return this.isAuthorized;
  }

  async disconnect() {
    this.isAuthorized = false;
    await AsyncStorage.removeItem('apple_music_authorized');
  }

  async play(songId) {
    try {
      if (songId) {
        await MusicKit.setPlaybackQueue(songId, 'song');
      }
      await Player.play();
    } catch (error) {
      console.error('Failed to play Apple Music track:', error);
      throw error;
    }
  }

  async pause() {
    try {
      await Player.pause();
    } catch (error) {
      console.error('Failed to pause Apple Music track:', error);
      throw error;
    }
  }

  async next() {
    try {
      await Player.skipToNextEntry();
    } catch (error) {
      console.error('Failed to skip to next Apple Music track:', error);
      throw error;
    }
  }

  async previous() {
    try {
      await Player.skipToPreviousEntry();
    } catch (error) {
      console.error('Failed to skip to previous Apple Music track:', error);
      throw error;
    }
  }

  async searchTracks(query, limit = 20) {
    try {
      const results = await MusicKit.catalogSearch(query, ['songs']);
      const songs = results?.songs?.data || results?.songs || [];
      return songs.slice(0, limit);
    } catch (error) {
      console.error('Failed to search Apple Music catalog:', error);
      return [];
    }
  }

  async getCurrentlyPlaying() {
    try {
      const state = await Player.getCurrentState();
      return state || null;
    } catch (error) {
      console.error('Failed to get current Apple Music playback state:', error);
      return null;
    }
  }
}

export const appleMusicService = new AppleMusicService();
