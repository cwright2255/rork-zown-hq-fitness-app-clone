import { create } from 'zustand';

interface SpotifyState {
  isConnected: boolean;
  tokens: SpotifyTokens | null;
  playlists: SpotifyPlaylist[];
  currentTrack: {
    id: string;
    name: string;
    artist: string;
    albumArtUrl?: string;
    isPlaying: boolean;
  } | null;
  isLoading: boolean;
  error: string | null;
  setTokens: (tokens: SpotifyTokens | null) => void;
  setPlaylists: (playlists) => void;
  setCurrentTrack: (track: SpotifyState['currentTrack']) => void;
  setLoading: (loading) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useSpotifyStore = create((set) => ({
  isConnected: false,
  tokens,
  playlists: [],
  currentTrack,
  isLoading: false,
  error,
  setTokens: (tokens) => set({ tokens, isConnected: !!tokens }),
  setPlaylists: (playlists) => set({ playlists, isLoading: false }),
  setCurrentTrack: (currentTrack) => set({ currentTrack }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () =>
    set({
      isConnected: false,
      tokens,
      playlists: [],
      currentTrack,
      isLoading: false,
      error,
    }),
}));
