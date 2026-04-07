export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
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

export interface MusicPreferences {
  preferredGenres: string[];
  energyLevel: number;
  tempoRange: {
    min: number;
    max: number;
  };
  explicitContent: boolean;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
}

export type WorkoutType = 'cardio' | 'strength' | 'yoga' | 'running';

export interface SpotifyStoreState {
  isConnected: boolean;
  isClientCredentialsReady: boolean;
  user: SpotifyUser | null;
  topTracks: SpotifyTrack[];
  workoutPlaylists: SpotifyPlaylist[];
  runningPlaylists: SpotifyPlaylist[];
  currentTrack: SpotifyTrack | null;
  playbackState: SpotifyPlaybackState | null;
  musicPreferences: MusicPreferences;
  isLoading: boolean;
  isLoadingPlaylists: boolean;
  
  connectSpotify: (authCode: string) => Promise<boolean>;
  connectSpotifyImplicit: (urlFragment: string) => Promise<boolean>;
  getSpotifyAuthUrl: () => Promise<string>;
  disconnectSpotify: () => Promise<void>;
  loadUserData: () => Promise<void>;
  loadWorkoutPlaylists: () => Promise<void>;
  loadRunningPlaylists: () => Promise<void>;
  updateCurrentTrack: () => Promise<void>;
  updateMusicPreferences: (preferences: Partial<MusicPreferences>) => void;
  playTrack: (uri: string) => Promise<void>;
  pauseTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  createWorkoutPlaylist: (name: string, description: string, trackUris: string[]) => Promise<SpotifyPlaylist | null>;
  getRecommendationsForWorkout: (workoutType: WorkoutType) => Promise<SpotifyTrack[]>;
  initializeSpotify: () => Promise<void>;
  initializeClientCredentials: () => Promise<boolean>;
}
