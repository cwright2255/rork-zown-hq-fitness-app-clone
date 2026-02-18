import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spotifyService } from '@/services/spotifyService';
import { 
  SpotifyStoreState, 
  MusicPreferences, 
  SpotifyTrack, 
  SpotifyPlaylist, 
  SpotifyUser,
  WorkoutType 
} from '@/types/spotify';

const defaultMusicPreferences: MusicPreferences = {
  preferredGenres: ['pop', 'rock', 'electronic'],
  energyLevel: 0.7,
  tempoRange: {
    min: 120,
    max: 160,
  },
  explicitContent: false,
};

export const useSpotifyStore = create<SpotifyStoreState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      isClientCredentialsReady: false,
      user: null,
      topTracks: [],
      workoutPlaylists: [],
      runningPlaylists: [],
      currentTrack: null,
      playbackState: null,
      musicPreferences: defaultMusicPreferences,
      isLoading: false,
      isLoadingPlaylists: false,
      
      connectSpotify: async (authCode: string): Promise<boolean> => {
        set({ isLoading: true });
        
        try {
          const success = await spotifyService.authenticate(authCode);
          
          if (success) {
            const user = await spotifyService.getCurrentUser();
            set({ 
              isConnected: true, 
              user: user,
              isLoading: false 
            });
            
            get().loadUserData();
            get().loadWorkoutPlaylists();
            get().loadRunningPlaylists();
            
            return true;
          } else {
            set({ isLoading: false });
            return false;
          }
        } catch (error) {
          console.error('Failed to connect to Spotify:', error);
          set({ isLoading: false });
          return false;
        }
      },
      
      connectSpotifyImplicit: async (urlFragment: string): Promise<boolean> => {
        console.log('Store: Starting Spotify implicit connection...');
        set({ isLoading: true });
        
        try {
          console.log('Store: Calling spotifyService.handleImplicitGrantCallback...');
          const success = await spotifyService.handleImplicitGrantCallback(urlFragment);
          console.log('Store: Callback result:', success);
          
          if (success) {
            console.log('Store: Getting current user...');
            const user = await spotifyService.getCurrentUser();
            console.log('Store: User received:', user);
            
            set({ 
              isConnected: true, 
              user: user,
              isLoading: false 
            });
            
            console.log('Store: Loading initial data...');
            get().loadUserData();
            get().loadWorkoutPlaylists();
            get().loadRunningPlaylists();
            
            return true;
          } else {
            console.log('Store: Connection failed');
            set({ isLoading: false });
            return false;
          }
        } catch (error) {
          console.error('Store: Failed to connect to Spotify:', error);
          set({ isLoading: false });
          return false;
        }
      },
      
      getSpotifyAuthUrl: async (): Promise<string> => {
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
      
      disconnectSpotify: async (): Promise<void> => {
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
        });
      },
      
      loadUserData: async (): Promise<void> => {
        if (!get().isConnected) return;
        
        try {
          const [topTracks, user] = await Promise.all([
            spotifyService.getTopTracks('medium_term', 20),
            spotifyService.getCurrentUser(),
          ]);
          
          set({ 
            topTracks,
            user: user || get().user,
          });
        } catch (error) {
          console.error('Failed to load user data:', error);
        }
      },
      
      loadWorkoutPlaylists: async (): Promise<void> => {
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
      
      loadRunningPlaylists: async (): Promise<void> => {
        try {
          const runningPlaylists = await spotifyService.getRunningPlaylists();
          set({ runningPlaylists });
        } catch (error) {
          console.error('Failed to load running playlists:', error);
        }
      },
      
      updateCurrentTrack: async (): Promise<void> => {
        if (!get().isConnected) return;
        
        try {
          const currentTrack = await spotifyService.getCurrentlyPlaying();
          set({ currentTrack });
        } catch (error) {
          console.error('Failed to update current track:', error);
        }
      },
      
      updateMusicPreferences: (preferences: Partial<MusicPreferences>): void => {
        set({
          musicPreferences: {
            ...get().musicPreferences,
            ...preferences,
          },
        });
      },
      
      playTrack: async (uri: string): Promise<void> => {
        try {
          await spotifyService.play(uri);
          setTimeout(() => {
            get().updateCurrentTrack();
          }, 1000);
        } catch (error) {
          console.error('Failed to play track:', error);
        }
      },
      
      pauseTrack: async (): Promise<void> => {
        try {
          await spotifyService.pause();
          get().updateCurrentTrack();
        } catch (error) {
          console.error('Failed to pause track:', error);
        }
      },
      
      nextTrack: async (): Promise<void> => {
        try {
          await spotifyService.next();
          setTimeout(() => {
            get().updateCurrentTrack();
          }, 1000);
        } catch (error) {
          console.error('Failed to skip to next track:', error);
        }
      },
      
      previousTrack: async (): Promise<void> => {
        try {
          await spotifyService.previous();
          setTimeout(() => {
            get().updateCurrentTrack();
          }, 1000);
        } catch (error) {
          console.error('Failed to skip to previous track:', error);
        }
      },
      
      createWorkoutPlaylist: async (name: string, description: string, trackUris: string[]): Promise<SpotifyPlaylist | null> => {
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
      
      getRecommendationsForWorkout: async (workoutType: WorkoutType): Promise<SpotifyTrack[]> => {
        try {
          return await spotifyService.getWorkoutRecommendations(workoutType);
        } catch (error) {
          console.error('Failed to get workout recommendations:', error);
          return [];
        }
      },
      
      initializeSpotify: async (): Promise<void> => {
        try {
          console.log('Initializing Spotify store...');
          const isAuthenticated = await spotifyService.isAuthenticated();
          console.log('Is authenticated:', isAuthenticated);
          
          if (isAuthenticated) {
            const isClientCreds = spotifyService.isUsingClientCredentials();
            const user = await spotifyService.getCurrentUser();
            console.log('User loaded:', user?.display_name || user?.id, 'clientCreds:', isClientCreds);
            set({ 
              isConnected: !isClientCreds, 
              isClientCredentialsReady: isClientCreds,
              user: isClientCreds ? null : user,
              isLoading: false
            });
            
            get().loadWorkoutPlaylists();
            get().loadRunningPlaylists();
            if (!isClientCreds) {
              get().loadUserData();
            }
          } else {
            set({ isConnected: false, isClientCredentialsReady: false, user: null, isLoading: false });
          }
        } catch (error) {
          console.error('Failed to initialize Spotify:', error);
          await spotifyService.clearToken();
          set({ isConnected: false, isClientCredentialsReady: false, user: null, isLoading: false });
        }
      },
      
      initializeClientCredentials: async (): Promise<boolean> => {
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
      },
    }),
    {
      name: 'spotify-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isConnected: state.isConnected,
        isClientCredentialsReady: state.isClientCredentialsReady,
        user: state.user,
        musicPreferences: state.musicPreferences,
      }),
    }
  )
);
