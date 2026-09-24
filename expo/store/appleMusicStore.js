import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appleMusicService } from '@/services/appleMusicService';

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
        await appleMusicService.disconnect();
        set({ isConnected: false, canPlayCatalogContent: false, currentTrack: null, isPlaying: false });
      },

      initializeAppleMusic: async () => {
        if (!appleMusicService.isSupported()) return;
        try {
          const authenticated = await appleMusicService.isAuthenticated();
          if (authenticated) {
            const subscription = await appleMusicService.checkSubscription();
            set({ isConnected: true, canPlayCatalogContent: subscription.canPlayCatalogContent });
          }
        } catch (error) {
          console.error('Failed to initialize Apple Music:', error);
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
