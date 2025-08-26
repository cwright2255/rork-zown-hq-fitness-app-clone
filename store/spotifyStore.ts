import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotifyTrack, SpotifyPlaylist, SpotifyUser, SpotifyPlaybackState, WorkoutMusicPreferences } from '@/types/spotify';
import { SpotifyUser as ServiceSpotifyUser } from '@/services/spotifyService';
import { spotifyService } from '@/services/spotifyService';

interface SpotifyState {
  // Authentication
  isConnected: boolean;
  user: SpotifyUser | null;
  
  // Music data
  topTracks: SpotifyTrack[];
  workoutPlaylists: SpotifyPlaylist[];
  runningPlaylists: SpotifyPlaylist[];
  currentTrack: SpotifyTrack | null;
  playbackState: SpotifyPlaybackState | null;
  
  // Preferences
  musicPreferences: WorkoutMusicPreferences;
  
  // Loading states
  isLoading: boolean;
  isLoadingPlaylists: boolean;
  
  // Actions
  connectSpotify: (authCode: string) => Promise<boolean>;
  connectSpotifyImplicit: (urlFragment: string) => Promise<boolean>;
  getSpotifyAuthUrl: () => Promise<string>;
  disconnectSpotify: () => Promise<void>;
  loadUserData: () => Promise<void>;
  loadWorkoutPlaylists: () => Promise<void>;
  loadRunningPlaylists: () => Promise<void>;
  updateCurrentTrack: () => Promise<void>;
  updateMusicPreferences: (preferences: Partial<WorkoutMusicPreferences>) => void;
  
  // Playback controls
  playTrack: (uri?: string) => Promise<void>;
  pauseTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  
  // Playlist management
  createWorkoutPlaylist: (name: string, description: string, trackUris: string[]) => Promise<SpotifyPlaylist | null>;
  getRecommendationsForWorkout: (workoutType: 'cardio' | 'strength' | 'yoga' | 'running') => Promise<SpotifyTrack[]>;
  
  // Initialization
  initializeSpotify: () => Promise<void>;
}

const defaultMusicPreferences: WorkoutMusicPreferences = {
  preferredGenres: ['pop', 'rock', 'electronic'],
  energyLevel: 0.7,
  tempoRange: {
    min: 120,
    max: 160,
  },
  explicitContent: false,
};

export const useSpotifyStore = create<SpotifyState>()(
  persist(
    (set, get) => ({
      // Initial state
      isConnected: false,
      user: null,
      topTracks: [],
      workoutPlaylists: [],
      runningPlaylists: [],
      currentTrack: null,
      playbackState: null,
      musicPreferences: defaultMusicPreferences,
      isLoading: false,
      isLoadingPlaylists: false,
      
      // Connect to Spotify (legacy method)
      connectSpotify: async (authCode: string) => {
        set({ isLoading: true });
        
        try {
          const success = await spotifyService.authenticate(authCode);
          
          if (success) {
            const user = await spotifyService.getCurrentUser();
            set({ 
              isConnected: true, 
              user: user as SpotifyUser,
              isLoading: false 
            });
            
            // Load initial data
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
      
      // Connect to Spotify using Implicit Grant Flow
      connectSpotifyImplicit: async (urlFragment: string) => {
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
              user: user as SpotifyUser,
              isLoading: false 
            });
            
            console.log('Store: Loading initial data...');
            // Load initial data
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
      
      // Get Spotify authorization URL
      getSpotifyAuthUrl: async () => {
        console.log('Store: Getting Spotify auth URL...');
        try {
          const url = spotifyService.getAuthorizationUrl();
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
      
      // Disconnect from Spotify
      disconnectSpotify: async () => {
        await spotifyService.clearToken();
        set({
          isConnected: false,
          user: null,
          topTracks: [],
          workoutPlaylists: [],
          runningPlaylists: [],
          currentTrack: null,
          playbackState: null,
        });
      },
      
      // Load user data
      loadUserData: async () => {
        if (!get().isConnected) return;
        
        try {
          const [topTracks, user] = await Promise.all([
            spotifyService.getTopTracks('medium_term', 20),
            spotifyService.getCurrentUser(),
          ]);
          
          set({ 
            topTracks,
            user: (user as SpotifyUser) || get().user,
          });
        } catch (error) {
          console.error('Failed to load user data:', error);
        }
      },
      
      // Load workout playlists
      loadWorkoutPlaylists: async () => {
        if (!get().isConnected) return;
        
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
      
      // Load running playlists
      loadRunningPlaylists: async () => {
        if (!get().isConnected) return;
        
        try {
          const runningPlaylists = await spotifyService.getRunningPlaylists();
          set({ runningPlaylists });
        } catch (error) {
          console.error('Failed to load running playlists:', error);
        }
      },
      
      // Update current track
      updateCurrentTrack: async () => {
        if (!get().isConnected) return;
        
        try {
          const currentTrack = await spotifyService.getCurrentlyPlaying();
          set({ currentTrack });
        } catch (error) {
          console.error('Failed to update current track:', error);
        }
      },
      
      // Update music preferences
      updateMusicPreferences: (preferences) => {
        set({
          musicPreferences: {
            ...get().musicPreferences,
            ...preferences,
          },
        });
      },
      
      // Playback controls
      playTrack: async (uri) => {
        try {
          await spotifyService.play(uri);
          // Update current track after a short delay
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
          // Update current track after a short delay
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
          // Update current track after a short delay
          setTimeout(() => {
            get().updateCurrentTrack();
          }, 1000);
        } catch (error) {
          console.error('Failed to skip to previous track:', error);
        }
      },
      
      // Create workout playlist
      createWorkoutPlaylist: async (name, description, trackUris) => {
        try {
          const playlist = await spotifyService.createWorkoutPlaylist(name, description, trackUris);
          
          if (playlist) {
            // Refresh workout playlists
            get().loadWorkoutPlaylists();
          }
          
          return playlist;
        } catch (error) {
          console.error('Failed to create workout playlist:', error);
          return null;
        }
      },
      
      // Get recommendations for workout
      getRecommendationsForWorkout: async (workoutType) => {
        try {
          return await spotifyService.getWorkoutRecommendations(workoutType);
        } catch (error) {
          console.error('Failed to get workout recommendations:', error);
          return [];
        }
      },
      
      // Initialize Spotify connection on app start
      initializeSpotify: async () => {
        try {
          const isAuthenticated = await spotifyService.isAuthenticated();
          
          if (isAuthenticated) {
            const user = await spotifyService.getCurrentUser();
            set({ 
              isConnected: true, 
              user: user as SpotifyUser
            });
            
            // Load initial data
            get().loadUserData();
            get().loadWorkoutPlaylists();
            get().loadRunningPlaylists();
          }
        } catch (error) {
          console.error('Failed to initialize Spotify:', error);
          // Clear any invalid stored tokens
          await spotifyService.clearToken();
          set({ isConnected: false, user: null });
        }
      },
    }),
    {
      name: 'spotify-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isConnected: state.isConnected,
        user: state.user,
        musicPreferences: state.musicPreferences,
      }),
    }
  )
);