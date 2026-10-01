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
    return this.playCollection(songId, 'song');
  }

  // Real, new: generalizes play() above to any MusicKit queue type.
  // Confirmed directly against the installed package's own source
  // (modules/music-kit.js + types/music-item.js) that setPlaybackQueue's
  // second argument is a real MusicItem enum with four values - 'song',
  // 'album', 'playlist', 'station' - all passed through verbatim to the
  // native module. Playing an 'album' or 'playlist' id hands MusicKit the
  // whole collection as its native queue, so it auto-advances through
  // every track on its own (confirmed against the native iOS source,
  // ios/QueueService.swift) - the same continuous-playback behavior
  // play(single song) never had, since a single song is a one-item queue
  // with nothing left once it ends.
  async playCollection(itemId, type = 'song') {
    try {
      if (itemId) {
        await MusicKit.setPlaybackQueue(itemId, type);
      }
      await Player.play();
    } catch (error) {
      console.error('Failed to play Apple Music collection:', error);
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

  // Real, new: album search. Confirmed directly against the package's own
  // README that catalogSearch accepts 'albums' as a search type alongside
  // 'songs' and returns items under results.albums, same shape pattern as
  // results.songs.
  async searchAlbums(query, limit = 20) {
    try {
      const results = await MusicKit.catalogSearch(query, ['albums']);
      const albums = results?.albums?.data || results?.albums || [];
      return albums.slice(0, limit);
    } catch (error) {
      console.error('Failed to search Apple Music albums:', error);
      return [];
    }
  }

  // Real, new: tracks by a specific artist, for an "Artist Mix" queue.
  // Confirmed directly against this package's own source (its full public
  // API surface: catalogSearch, setPlaybackQueue, library/playlist
  // lookups) and its GitHub repo that there is no method here for
  // stations, related artists, or recommendations of any kind - MusicItem
  // does have a 'station' type, but setPlaybackQueue(id, 'station') looks
  // up an existing catalog station BY ID (confirmed in the native iOS
  // source, ios/QueueService.swift: a direct catalogService.fetchStation
  // lookup), and nothing in this package can produce a station id from a
  // song or artist. Searching the artist's own catalog by name is the
  // closest honest substitute buildable with what this package actually
  // exposes.
  async searchArtistTracks(artistName, limit = 30) {
    try {
      const results = await MusicKit.catalogSearch(artistName, ['songs']);
      const songs = results?.songs?.data || results?.songs || [];
      return songs.slice(0, limit);
    } catch (error) {
      console.error('Failed to search Apple Music artist tracks:', error);
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

  // Real, new: subscribes to MusicKit's own native playback-state events
  // (confirmed real via the package's README: Player.addListener(
  // 'onPlaybackStateChange', ...)) rather than polling. Critically, this
  // is what makes reliable auto-advance possible at all here - confirmed
  // directly against types/playback-status.js that 'paused' (user hit
  // pause) and 'stopped' (queue ran out) are genuinely distinct native
  // states, so a 'stopped' event can be trusted as "this queue ended",
  // never confused with a manual pause.
  subscribeToPlaybackState(callback) {
    return Player.addListener('onPlaybackStateChange', callback);
  }
}

export const appleMusicService = new AppleMusicService();
