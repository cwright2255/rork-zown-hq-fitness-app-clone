import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appleMusicService } from '@/services/appleMusicService';

// Real, new: holds the native event subscription (an EmitterSubscription,
// not data) at module scope rather than in persisted store state, same
// reasoning as spotifyStore.js's queueWatcherInterval - it needs to keep
// running regardless of which screen is mounted, and should only ever be
// subscribed once per app session.
let playbackSubscription = null;

// Real, new: mirrors store/spotifyStore.js's established shape (same
// playTrack/pauseTrack/nextTrack/previousTrack method names and re-throw
// behavior on play/pause failures) so existing UI built against the
// Spotify store's interface can, later, work against either store with
// minimal changes. Simpler than spotifyStore.js throughout, since
// MusicKit's own authorization flow has none of Spotify's OAuth
// complexity (no redirect URI, no code exchange).
export const useAppleMusicStore = create(
  persist(
    (set, get) => ({
      isConnected: false,
      canPlayCatalogContent: false,
      currentTrack: null,
      isPlaying: false,
      isLoading: false,
      // Real, new: same client-managed "up next" queue as spotifyStore.js,
      // not persisted (see partialize below) - this package's
      // setPlaybackQueue can only replace the whole native queue with one
      // song/album/playlist/station, confirmed directly against its source
      // (modules/music-kit.js) to have no incremental "add to queue" call
      // at all, so "play next" / "add to queue" has to be entirely
      // app-managed here, same as Spotify's queue ends up being by choice.
      queue: [],

      connectAppleMusic: async () => {
        set({ isLoading: true });
        try {
          const authorized = await appleMusicService.authenticate();
          if (authorized) {
            const subscription = await appleMusicService.checkSubscription();
            set({
              isConnected: true,
              canPlayCatalogContent: subscription.canPlayCatalogContent,
              isLoading: false,
            });
            get()._subscribeToPlayback();
            return true;
          }
          set({ isLoading: false });
          return false;
        } catch (error) {
          console.error('Failed to connect to Apple Music:', error);
          set({ isLoading: false });
          return false;
        }
      },

      disconnectAppleMusic: async () => {
        if (playbackSubscription) {
          playbackSubscription.remove();
          playbackSubscription = null;
        }
        await appleMusicService.disconnect();
        set({ isConnected: false, canPlayCatalogContent: false, currentTrack: null, isPlaying: false, queue: [] });
      },

      initializeAppleMusic: async () => {
        if (!appleMusicService.isSupported()) return;
        try {
          const authenticated = await appleMusicService.isAuthenticated();
          if (authenticated) {
            const subscription = await appleMusicService.checkSubscription();
            set({ isConnected: true, canPlayCatalogContent: subscription.canPlayCatalogContent });
            get()._subscribeToPlayback();
          }
        } catch (error) {
          console.error('Failed to initialize Apple Music:', error);
        }
      },

      // Real, new: subscribes once to MusicKit's native playback-state
      // events (see appleMusicService.ios.js's subscribeToPlaybackState
      // comment for why this is reliable rather than polling) and keeps
      // currentTrack/isPlaying live from it, same data updateCurrentTrack
      // already captures but pushed instead of polled.
      _subscribeToPlayback: () => {
        if (playbackSubscription || !appleMusicService.isSupported()) return;
        playbackSubscription = appleMusicService.subscribeToPlaybackState((state) => {
          get()._handlePlaybackStateChange(state);
        });
      },

      _handlePlaybackStateChange: (state) => {
        if (!state) return;
        set({
          currentTrack: state.currentSong || null,
          isPlaying: state.playbackStatus === 'playing',
        });

        // Real, new: 'stopped' (queue genuinely ran out) is a distinct
        // native status from 'paused' (user hit pause) - confirmed via
        // types/playback-status.js - so this only ever auto-advances on a
        // real end, never on a manual pause.
        if (state.playbackStatus === 'stopped' && get().queue.length > 0) {
          get().playNextFromQueue().catch((error) => {
            console.error('Failed to auto-advance Apple Music queue:', error);
          });
        }
      },

      updateCurrentTrack: async () => {
        if (!get().isConnected) return;
        try {
          const state = await appleMusicService.getCurrentlyPlaying();
          // Real fix: confirmed directly against the published package's
          // own type definitions (types/playback-state.d.ts, types/song.d.ts)
          // rather than guessing - IPlaybackState.currentSong is the real
          // field, an ISong with title/artistName/artworkUrl/id, a
          // completely different shape from Spotify's own track object.
          set({ currentTrack: state?.currentSong || null, isPlaying: state?.playbackStatus === 'playing' });
        } catch (error) {
          console.error('Failed to update current Apple Music track:', error);
        }
      },

      playTrack: async (songId) => {
        try {
          await appleMusicService.play(songId);
          setTimeout(() => { get().updateCurrentTrack(); }, 1000);
        } catch (error) {
          console.error('Failed to play Apple Music track:', error);
          throw error;
        }
      },

      pauseTrack: async () => {
        try {
          await appleMusicService.pause();
          get().updateCurrentTrack();
        } catch (error) {
          console.error('Failed to pause Apple Music track:', error);
          throw error;
        }
      },

      nextTrack: async () => {
        try {
          await appleMusicService.next();
          setTimeout(() => { get().updateCurrentTrack(); }, 1000);
        } catch (error) {
          console.error('Failed to skip to next Apple Music track:', error);
        }
      },

      previousTrack: async () => {
        try {
          await appleMusicService.previous();
          setTimeout(() => { get().updateCurrentTrack(); }, 1000);
        } catch (error) {
          console.error('Failed to skip to previous Apple Music track:', error);
        }
      },

      // Real, new: queue management, same shape and semantics as
      // spotifyStore.js's own addToQueue/playNext/clearQueue - "id" is the
      // shared key (matches what playTrack already takes), everything else
      // is display-only, the same normalized shape useActiveMusicPlayer
      // already returns from searchTracks.
      addToQueue: (track) => {
        set({ queue: [...get().queue, track] });
      },

      playNext: (track) => {
        set({ queue: [track, ...get().queue] });
      },

      clearQueue: () => {
        set({ queue: [] });
      },

      // Real, new: shifts the first entry off the queue and plays it -
      // the one piece of logic both the auto-advance handler and a manual
      // "skip forward" with something queued both need, kept in one place
      // so they can't drift apart.
      playNextFromQueue: async () => {
        const [next, ...rest] = get().queue;
        if (!next) return false;
        set({ queue: rest });
        await get().playTrack(next.id);
        return true;
      },

      // Real, new: play a whole album - also clears the queue, since
      // starting a new album is a deliberate "start fresh" action. Native
      // MusicKit auto-advances through every track in the album on its
      // own once queued (confirmed against the native iOS source,
      // ios/QueueService.swift), so no extra handling is needed here for
      // continuous playback through it.
      playAlbum: async (albumId) => {
        try {
          set({ queue: [] });
          await appleMusicService.playCollection(albumId, 'album');
          setTimeout(() => { get().updateCurrentTrack(); }, 1000);
        } catch (error) {
          console.error('Failed to play Apple Music album:', error);
          throw error;
        }
      },

      // Real, new: "station" substitute - see searchArtistTracks's own
      // comment in appleMusicService.ios.js for why this is a search-based
      // Artist Mix rather than a real MusicKit station (setPlaybackQueue's
      // 'station' type needs an existing catalog station id, which nothing
      // in this package can produce from a song or artist). Pulls the
      // artist's tracks, shuffles them into the queue, and starts the
      // first one.
      startArtistMix: async (artistName) => {
        try {
          const songs = await appleMusicService.searchArtistTracks(artistName);
          if (!songs.length) return false;

          const shuffled = [...songs].sort(() => Math.random() - 0.5);
          const [first, ...rest] = shuffled;
          const toQueueEntry = (s) => ({
            id: s.id,
            trackName: s.title,
            artistName: s.artistName || '',
            artworkUrl: s.artworkUrl || null,
          });

          set({ queue: rest.map(toQueueEntry) });
          await get().playTrack(first.id);
          return true;
        } catch (error) {
          console.error('Failed to start Apple Music artist mix:', error);
          return false;
        }
      },
    }),
    {
      name: 'apple-music-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isConnected: state.isConnected,
        canPlayCatalogContent: state.canPlayCatalogContent,
      }),
    }
  )
);
