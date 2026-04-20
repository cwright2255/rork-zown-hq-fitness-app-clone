import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spotifyService } from '@/services/spotifyService';









const defaultMusicPreferences = {
  preferredGenres: ['pop', 'rock', 'electronic'],
  energyLevel: 0.7,
  tempoRange: {
    min: 120,
    max: 160
  },
  explicitContent: false
};

export const useSpotifyStore = create()(
  persist(
    (set, get) => ({
      isConnected: false,
      isClientCredentialsReady: false,
      user,
      topTracks: [],
      workoutPlaylists: [],
      runningPlaylists: [],
      currentTrack,
      playbackState,
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
        console.log('Store: Starting Spotify implicit connection...');
        set({ isLoading: true });

        try {
          console.log('Store: Calling spotifyService.handleImplicitGrantCallback...');
          const success = await spotifyService.handleImplicitGrantCallback(urlFragment);
          console.log('Store: Callback result:', success);

          if (success) {
            console.log('Store: Getting current user from /me...');
            const user = await spotifyService.getCurrentUser();
            console.log('Store: User received:', user);

            if (!user) {
              console.error('Store: OAuth callback succeeded but /me profile fetch failed.');
              await spotifyService.clearToken();
              set({ isConnected: false, user, isLoading: false });
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
        await spotifyService.clearToken();
        set({
          isConnected: false,
          isClientCredentialsReady: false,
          user,
          topTracks: [],
          workoutPlaylists: [],
          runningPlaylists: [],
          currentTrack,
          playbackState
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
          const currentTrack = await spotifyService.getCurrentlyPlaying();
          set({ currentTrack });
        } catch (error) {
          console.error('Failed to update current track:', error);
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
        }
      },

      pauseTrack: async () => {
        try {
          await spotifyService.pause();
          get().updateCurrentTrack();
        } catch (error) {
          console.error('Failed to pause track:', error);
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
            }
          } else {
            console.log('Spotify: Not authenticated, trying client credentials...');
            const ccSuccess = await spotifyService.initializeClientCredentials();
            if (ccSuccess) {
              set({ isConnected: false, isClientCredentialsReady: true, user, isLoading: false });
              get().loadWorkoutPlaylists();
              get().loadRunningPlaylists();
            } else {
              set({ isConnected: false, isClientCredentialsReady: false, user, isLoading: false });
            }
          }
        } catch (error) {
          console.error('Failed to initialize Spotify:', error);
          const ccSuccess = await spotifyService.initializeClientCredentials();
          set({
            isConnected: false,
            isClientCredentialsReady: ccSuccess,
            user,
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