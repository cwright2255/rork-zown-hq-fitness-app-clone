import { create } from 'zustand';
import type { SpotifyPlaylist } from '../types/firestore';

interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

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
  setPlaylists: (playlists: SpotifyPlaylist[]) => void;
  setCurrentTrack: (track: SpotifyState['currentTrack']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useSpotifyStore = create<SpotifyState>((set) => ({
  isConnected: false,
  tokens: null,
  playlists: [],
  currentTrack: null,
  isLoading: false,
  error: null,
  setTokens: (tokens) => set({ tokens, isConnected: !!tokens }),
  setPlaylists: (playlists) => set({ playlists, isLoading: false }),
  setCurrentTrack: (currentTrack) => set({ currentTrack }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () =>
    set({
      isConnected: false,
      tokens: null,
      playlists: [],
      currentTrack: null,
      isLoading: false,
      error: null,
    }),
}));
