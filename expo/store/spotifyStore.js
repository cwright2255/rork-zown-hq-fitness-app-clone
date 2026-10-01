import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spotifyService } from '@/services/spotifyService';

// Real, new: queue auto-advance watcher. Lives at module scope (not in
// persisted store state) because it's a live setInterval handle, not data -
// it needs to survive regardless of which screen is mounted (music can
// keep playing while the user is deep in a workout screen with no music
// widget on screen at all), so it's started once on connect/init rather
// than tied to any one component's lifecycle. Spotify's Web API has no
// native "track ended" event (it's REST remote control, not a push-based
// SDK - confirmed by this file's own existing architecture, every call
// here is a plain fetch), so polling is the only option; gated inside
// _checkQueueAdvance so it's a cheap no-op whenever there's no queue to
// watch, rather than hitting the network every tick regardless.
let queueWatcherInterval = null;
const QUEUE_WATCH_INTERVAL_MS = 5000;
// Within this many ms of the track's own duration, a reported "not
// playing" is treated as "this track ended" rather than "user paused" -
// the one signal Spotify's REST state actually gives us to tell the two
// apart (confirmed: /me/player returns progress_ms and item.duration_ms,
// but no distinct "ended" vs "paused" status the way Apple MusicKit's
// native playbackStatus does).
const TRACK_END_THRESHOLD_MS = 3000;









const defaultMusicPreferences = {
  preferredGenres: ['pop', 'rock', 'electronic'],
  energyLevel: 0.7,
  tempoRange: {
    min: 120,
    max: 160
  },
  explicitContent: false
};

export const useSpotifyStore = create(
  persist(
    (set, get) => ({
      isConnected: false,
      isClientCredentialsReady: false,
      user: null,
      topTracks: [],
      workoutPlaylists: [],
      runningPlaylists: [],
      currentTrack: null,
      isPlaying: false,
      playbackState: null,
      progressMs: null,
      durationMs: null,
      // Real, new: client-managed "up next" queue - deliberately NOT
      // persisted (see partialize below). Spotify's own /me/player/queue
      // only ADDS to its live device-side queue and can't be read back or
      // reordered, so this app-level list is what "play next" / "add to
      // queue" and the auto-advance watcher both actually read from; it's
      // a queue of normalized {uri, trackName, artistName, artworkUrl}
      // entries, the same shape searchTracks() already returns.
      queue: [],
      musicPreferences: defaultMusicPreferences,
      isLoading: false,
      isLoadingPlaylists: false,

      connectSpotify: async (authCode) => {
        set({ isLoading: true });

        try {
          const success = await spotifyService.authenticate(authCode);

          if (success) {
            const user = await spotifyService.getCurrentUser();
            if (!user) {
              console.error('Store: Auth succeeded but Spotify profile /me was unavailable.');
              await spotifyService.clearToken();
              set({ isConnected: false, user, isLoading: false });
              return false;
            }

            set({
              isConnected: true,
              user,
              isLoading: false
            });

            get().loadUserData();
            get().loadWorkoutPlaylists();
            get().loadRunningPlaylists();
            get().startQueueWatcher();

            return true;
          }

          set({ isLoading: false });
          return false;
        } catch (error) {
          console.error('Failed to connect to Spotify:', error);
          set({ isLoading: false });
          return false;
        }
      },

      connectSpotifyImplicit: async (urlFragment) => {
        console.log('Store: Starting Spotify connection (implicit or active)...');
        set({ isLoading: true });

        try {
          let targetFragment = urlFragment;
          
          if (!targetFragment) {
            console.log('Store: No urlFragment provided, initiating WebBrowser OAuth session...');
            const authUrl = await spotifyService.getAuthorizationUrl();
            console.log('Store: Generated Auth URL:', authUrl);
            console.log('Store: Using Redirect URI:', spotifyService.redirectUri);
            
            const WebBrowser = require('expo-web-browser');
            const result = await WebBrowser.openAuthSessionAsync(authUrl, spotifyService.redirectUri);
            console.log('Store: WebBrowser result:', JSON.stringify(result));
            
            if (result.type === 'success' && result.url) {
              if (result.url.includes('access_token=')) {
                targetFragment = result.url.substring(result.url.indexOf('#'));
              } else if (result.url.includes('code=')) {
                console.log('Store: Swapping code via handleAuthorizationCodeCallback...');
                const success = await spotifyService.handleAuthorizationCodeCallback(result.url);
                if (success) {
                  const user = await spotifyService.getCurrentUser();
                  if (!user) {
                    console.error('Store: OAuth succeeded but /me was empty');
                    await spotifyService.clearToken();
                    set({ isConnected: false, user: null, isLoading: false });
                    return false;
                  }
                  set({ isConnected: true, user, isLoading: false });
                  get().loadUserData();
                  get().loadWorkoutPlaylists();
                  get().loadRunningPlaylists();
                  get().startQueueWatcher();
                  return true;
                }
                set({ isLoading: false });
                return false;
              } else {
                targetFragment = result.url;
              }
            } else {
              console.log('Store: Auth cancelled or dismissed');
              set({ isLoading: false });
              return false;
            }
          }

          console.log('Store: Calling handleImplicitGrantCallback with:', targetFragment);
          const success = await spotifyService.handleImplicitGrantCallback(targetFragment);
          console.log('Store: Callback result:', success);

          if (success) {
            console.log('Store: Getting current user from /me...');
            const user = await spotifyService.getCurrentUser();
            console.log('Store: User received:', user);

            if (!user) {
              console.error('Store: OAuth callback succeeded but /me profile fetch failed.');
              await spotifyService.clearToken();
              set({ isConnected: false, user: null, isLoading: false });
              return false;
            }

            set({
              isConnected: true,
              user,
              isLoading: false
            });

            console.log('Store: Loading initial data...');
            get().loadUserData();
            get().loadWorkoutPlaylists();
            get().loadRunningPlaylists();
            get().startQueueWatcher();

            return true;
          }

          console.log('Store: Connection failed');
          set({ isLoading: false });
          return false;
        } catch (error) {
          console.error('Store: Failed to connect to Spotify:', error);
          set({ isLoading: false });
          return false;
        }
      },

      getSpotifyAuthUrl: async () => {
        console.log('Store: Getting Spotify auth URL...');
        try {
          const url = await spotifyService.getAuthorizationUrl();
          console.log('Store: Auth URL received:', url);
          console.log('Store: Auth URL type:', typeof url);
          if (!url || typeof url !== 'string' || url.length === 0) {
            throw new Error(`Invalid authorization URL received: ${typeof url} - ${JSON.stringify(url)}`);
          }
          return url;
        } catch (error) {
          console.error('Store: Failed to get Spotify auth URL:', error);
          throw error;
        }
      },

      disconnectSpotify: async () => {
        get().stopQueueWatcher();
        await spotifyService.clearToken();
        set({
          isConnected: false,
          isClientCredentialsReady: false,
          user: null,
          topTracks: [],
          workoutPlaylists: [],
          runningPlaylists: [],
          currentTrack: null,
          playbackState: null,
          queue: []
        });
      },

      loadUserData: async () => {
        if (!get().isConnected) return;

        try {
          const [topTracks, user] = await Promise.all([
          spotifyService.getTopTracks('medium_term', 20),
          spotifyService.getCurrentUser()]
          );

          set({
            topTracks,
            user: user || get().user
          });
        } catch (error) {
          console.error('Failed to load user data:', error);
        }
      },

      loadWorkoutPlaylists: async () => {
        set({ isLoadingPlaylists: true });

        try {
          const workoutPlaylists = await spotifyService.getWorkoutPlaylists();
          set({
            workoutPlaylists,
            isLoadingPlaylists: false
          });
        } catch (error) {
          console.error('Failed to load workout playlists:', error);
          set({ isLoadingPlaylists: false });
        }
      },

      loadRunningPlaylists: async () => {
        try {
          const runningPlaylists = await spotifyService.getRunningPlaylists();
          set({ runningPlaylists });
        } catch (error) {
          console.error('Failed to load running playlists:', error);
        }
      },

      updateCurrentTrack: async () => {
        if (!get().isConnected) return;

        try {
          const playback = await spotifyService.getCurrentlyPlaying();
          set({
            currentTrack: playback?.item || null,
            isPlaying: !!playback?.is_playing,
            // Real, new: captured for the queue watcher below - Spotify's
            // /me/player response carries both on every call already, this
            // just keeps them in state instead of discarding them.
            progressMs: typeof playback?.progress_ms === 'number' ? playback.progress_ms : null,
            durationMs: typeof playback?.item?.duration_ms === 'number' ? playback.item.duration_ms : null,
          });
        } catch (error) {
          console.error('Failed to update current track:', error);
          if (error?.message?.includes('connection has expired')) {
            set({ isConnected: false, currentTrack: null, isPlaying: false });
          }
        }
      },

      updateMusicPreferences: (preferences) => {
        set({
          musicPreferences: {
            ...get().musicPreferences,
            ...preferences
          }
        });
      },

      playTrack: async (uri) => {
        try {
          await spotifyService.play(uri);
          setTimeout(() => {
            get().updateCurrentTrack();
          }, 1000);
        } catch (error) {
          console.error('Failed to play track:', error);
          // Real fix: re-throw so callers (the widget's own play button,
          // and the new music-search screen) can tell a play attempt
          // genuinely failed, rather than this always silently resolving
          // as if it succeeded even when Spotify rejected the request.
          throw error;
        }
      },

      pauseTrack: async () => {
        try {
          await spotifyService.pause();
          get().updateCurrentTrack();
        } catch (error) {
          console.error('Failed to pause track:', error);
          throw error;
        }
      },

      nextTrack: async () => {
        try {
          await spotifyService.next();
          setTimeout(() => {
            get().updateCurrentTrack();
          }, 1000);
        } catch (error) {
          console.error('Failed to skip to next track:', error);
        }
      },

      previousTrack: async () => {
        try {
          await spotifyService.previous();
          setTimeout(() => {
            get().updateCurrentTrack();
          }, 1000);
        } catch (error) {
          console.error('Failed to skip to previous track:', error);
        }
      },

      // Real, new: queue management. "uri" is the shared key across every
      // queue entry (matches what playTrack already takes), everything
      // else is display-only, same normalized shape useActiveMusicPlayer
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
      // the one piece of logic both the auto-advance watcher and a manual
      // "skip forward" with something queued both need, kept in one place
      // so they can't drift apart.
      playNextFromQueue: async () => {
        const [next, ...rest] = get().queue;
        if (!next) return false;
        // Real fix: found on review, before this ever shipped - the watcher
        // polls every 5s and this is genuinely async (playTrack awaits a
        // network call before state reflects the new track), so a tick
        // landing in that gap would still see the JUST-FINISHED track's old
        // progressMs sitting within TRACK_END_THRESHOLD_MS of its duration
        // and fire a second advance, skipping two songs for one ended
        // track. Clearing both synchronously, before the await, means any
        // tick that lands in that gap sees durationMs as null and bails at
        // _checkQueueAdvance's own type check instead of double-firing.
        set({ queue: rest, progressMs: null, durationMs: null });
        await get().playTrack(next.uri);
        return true;
      },

      // Real, new: play a whole album (or any context) instead of one
      // track - also clears the queue, since starting a new album is a
      // deliberate "start fresh" action, not a continuation of whatever
      // was queued before.
      playAlbum: async (contextUri) => {
        try {
          set({ queue: [] });
          await spotifyService.playContext(contextUri);
          setTimeout(() => {
            get().updateCurrentTrack();
          }, 1000);
        } catch (error) {
          console.error('Failed to play album:', error);
          throw error;
        }
      },

      // Real, new: "station" substitute - see searchArtistTracks's own
      // comment in spotifyService.js for why this is a search-based Artist
      // Mix rather than a real recommendation engine (Spotify's own
      // recommendations/related-artists endpoints are both dead for this
      // app's access tier). Pulls the artist's tracks, shuffles them into
      // the queue, and starts the first one.
      startArtistMix: async (artistName) => {
        try {
          const tracks = await spotifyService.searchArtistTracks(artistName);
          if (!tracks.length) return false;

          const shuffled = [...tracks].sort(() => Math.random() - 0.5);
          const [first, ...rest] = shuffled;
          const toQueueEntry = (t) => ({
            uri: t.uri,
            trackName: t.name,
            artistName: t.artists?.map((a) => a.name).join(', ') || '',
            artworkUrl: t.album?.images?.[t.album.images.length - 1]?.url || null,
          });

          set({ queue: rest.map(toQueueEntry) });
          await get().playTrack(first.uri);
          return true;
        } catch (error) {
          console.error('Failed to start artist mix:', error);
          return false;
        }
      },

      // Real, new: polls while connected (cheap no-op unless there is
      // something queued - see the module-level comment on
      // queueWatcherInterval for why this lives here instead of a
      // component). Spotify reports "not playing" identically whether the
      // user paused or the track genuinely ran out, so this only treats it
      // as "ended" when the last known position was within
      // TRACK_END_THRESHOLD_MS of the track's own duration - a real pause
      // happens mid-track and won't match that.
      startQueueWatcher: () => {
        if (queueWatcherInterval) return;
        queueWatcherInterval = setInterval(() => {
          get()._checkQueueAdvance();
        }, QUEUE_WATCH_INTERVAL_MS);
      },

      stopQueueWatcher: () => {
        if (queueWatcherInterval) {
          clearInterval(queueWatcherInterval);
          queueWatcherInterval = null;
        }
      },

      _checkQueueAdvance: async () => {
        const state = get();
        if (!state.isConnected || state.queue.length === 0) return;

        await state.updateCurrentTrack();
        const fresh = get();
        const { isPlaying, progressMs, durationMs, queue } = fresh;
        if (isPlaying || queue.length === 0) return;
        if (typeof progressMs !== 'number' || typeof durationMs !== 'number') return;
        if (durationMs - progressMs > TRACK_END_THRESHOLD_MS) return;

        try {
          await fresh.playNextFromQueue();
        } catch (error) {
          console.error('Failed to auto-advance queue:', error);
        }
      },

      createWorkoutPlaylist: async (name, description, trackUris) => {
        try {
          const playlist = await spotifyService.createWorkoutPlaylist(name, description, trackUris);

          if (playlist) {
            get().loadWorkoutPlaylists();
          }

          return playlist;
        } catch (error) {
          console.error('Failed to create workout playlist:', error);
          return null;
        }
      },

      getRecommendationsForWorkout: async (workoutType) => {
        try {
          return await spotifyService.getWorkoutRecommendations(workoutType);
        } catch (error) {
          console.error('Failed to get workout recommendations:', error);
          return [];
        }
      },

      initializeSpotify: async () => {
        try {
          console.log('Initializing Spotify store...');
          const hasToken = await spotifyService.ensureToken();
          const isAuthenticated = await spotifyService.isAuthenticated();
          console.log('Is authenticated:', isAuthenticated, 'hasToken:', hasToken);

          if (isAuthenticated) {
            const isClientCreds = spotifyService.isUsingClientCredentials();
            const user = isClientCreds ? null : await spotifyService.getCurrentUser();
            const hasValidUserProfile = !!user?.id;
            console.log('User loaded:', user?.display_name || user?.id, 'clientCreds:', isClientCreds, 'hasValidUserProfile:', hasValidUserProfile);

            if (!isClientCreds && !hasValidUserProfile) {
              console.error('Store: Existing OAuth token is present but /me profile is invalid. Falling back to client credentials.');
              await spotifyService.clearToken();
              const ccSuccess = await spotifyService.initializeClientCredentials();
              set({
                isConnected: false,
                isClientCredentialsReady: ccSuccess,
                user,
                isLoading: false
              });
              if (ccSuccess) {
                get().loadWorkoutPlaylists();
                get().loadRunningPlaylists();
              }
              return;
            }

            set({
              isConnected: !isClientCreds && hasValidUserProfile,
              isClientCredentialsReady: isClientCreds,
              user,
              isLoading: false
            });

            get().loadWorkoutPlaylists();
            get().loadRunningPlaylists();
            if (!isClientCreds && hasValidUserProfile) {
              get().loadUserData();
              get().startQueueWatcher();
            }
          } else {
            console.log('Spotify: Not authenticated, trying client credentials...');
            const ccSuccess = await spotifyService.initializeClientCredentials();
            if (ccSuccess) {
              set({ isConnected: false, isClientCredentialsReady: true, user: null, isLoading: false });
              get().loadWorkoutPlaylists();
              get().loadRunningPlaylists();
            } else {
              set({ isConnected: false, isClientCredentialsReady: false, user: null, isLoading: false });
            }
          }
        } catch (error) {
          console.error('Failed to initialize Spotify:', error);
          const ccSuccess = await spotifyService.initializeClientCredentials();
          set({
            isConnected: false,
            isClientCredentialsReady: ccSuccess,
            user: null,
            isLoading: false
          });
        }
      },

      initializeClientCredentials: async () => {
        try {
          console.log('Store: Initializing client credentials...');
          const success = await spotifyService.initializeClientCredentials();
          if (success) {
            console.log('Store: Client credentials ready');
            set({ isClientCredentialsReady: true });
            get().loadWorkoutPlaylists();
            get().loadRunningPlaylists();
          }
          return success;
        } catch (error) {
          console.error('Store: Failed to init client credentials:', error);
          return false;
        }
      }
    }),
    {
      name: 'spotify-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isConnected: state.isConnected,
        isClientCredentialsReady: state.isClientCredentialsReady,
        user: state.user,
        musicPreferences: state.musicPreferences
      })
    }
  )
);