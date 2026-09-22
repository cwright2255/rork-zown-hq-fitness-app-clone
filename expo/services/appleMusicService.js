import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Real, new: Apple Music integration, built on the @lomray/react-native-apple-music
// native module (Apple's own MusicKit framework). Every method is guarded to
// iOS only - MusicKit is a native, iOS-specific framework with no Android
// equivalent, so calling any of this on Android would fail. Unlike
// spotifyService.js, Apple's own MusicKit doesn't have a user-profile
// endpoint at all - it's built around playback/catalog access, not personal
// account data - so "connected" here means authorization succeeded, not
// that a profile was fetched.
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
    return Platform.OS === 'ios';
  }

  async _getNativeModule() {
    if (!this.isSupported()) {
      throw new Error('Apple Music is only available on iOS.');
    }
    // Lazy import: this native module must never be evaluated on Android,
    // even at import time, since it doesn't exist there.
    return require('@lomray/react-native-apple-music');
  }

  async loadStoredAuthState() {
    if (!this.isSupported()) return;
    try {
      const stored = await AsyncStorage.getItem('apple_music_authorized');
      this.isAuthorized = stored === 'true';
    } catch (error) {
      console.error('Failed to load stored Apple Music auth state:', error);
    }
  }

  async authenticate() {
    try {
      const { Auth } = await this._getNativeModule();
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
      const { Auth, isMusicSubscriptionError } = await this._getNativeModule();
      const subscription = await Auth.checkSubscription();
      return {
        canPlayCatalogContent: !!subscription.canPlayCatalogContent,
        canBecomeSubscriber: !!subscription.canBecomeSubscriber,
      };
    } catch (error) {
      const mod = await this._getNativeModule().catch(() => null);
      if (mod?.isMusicSubscriptionError && mod.isMusicSubscriptionError(error)) {
        console.warn('Apple Music subscription check failed:', error.code);
      } else {
        console.error('Apple Music subscription check failed:', error?.message ?? error);
      }
      return { canPlayCatalogContent: false, canBecomeSubscriber: false };
    }
  }

  async isAuthenticated() {
    if (!this.isSupported()) return false;
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
      const { Player, MusicKit } = await this._getNativeModule();
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
      const { Player } = await this._getNativeModule();
      await Player.pause();
    } catch (error) {
      console.error('Failed to pause Apple Music track:', error);
      throw error;
    }
  }

  async next() {
    try {
      const { Player } = await this._getNativeModule();
      await Player.skipToNextEntry();
    } catch (error) {
      console.error('Failed to skip to next Apple Music track:', error);
      throw error;
    }
  }

  async previous() {
    try {
      const { Player } = await this._getNativeModule();
      await Player.skipToPreviousEntry();
    } catch (error) {
      console.error('Failed to skip to previous Apple Music track:', error);
      throw error;
    }
  }

  async searchTracks(query, limit = 20) {
    if (!this.isSupported()) return [];
    try {
      const { MusicKit } = await this._getNativeModule();
      const results = await MusicKit.catalogSearch(query, ['songs']);
      const songs = results?.songs?.data || results?.songs || [];
      return songs.slice(0, limit);
    } catch (error) {
      console.error('Failed to search Apple Music catalog:', error);
      return [];
    }
  }

  async getCurrentlyPlaying() {
    if (!this.isSupported()) return null;
    try {
      const { Player } = await this._getNativeModule();
      const state = await Player.getCurrentState();
      return state || null;
    } catch (error) {
      console.error('Failed to get current Apple Music playback state:', error);
      return null;
    }
  }
}

export const appleMusicService = new AppleMusicService();
