import { create } from 'zustand';






















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
    error
  })
}));