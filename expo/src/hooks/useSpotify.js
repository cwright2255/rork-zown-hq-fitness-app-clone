import { useCallback } from 'react';
import { useSpotifyStore } from '../stores/spotifyStore';
import * as spotifyService from '../services/spotify';

export function useSpotify() {
  const {
    isConnected,
    tokens,
    playlists,
    currentTrack,
    isLoading,
    error,
    setTokens,
    setPlaylists,
    setLoading,
    setError,
    reset,
  } = useSpotifyStore();

  const authenticate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await spotifyService.authenticate();
      if (result) setTokens(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spotify auth failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setTokens, setLoading, setError]);

  const searchTracks = useCallback(
    async (q) => {
      if (!tokens) throw new Error('Not authenticated with Spotify');
      return spotifyService.searchTracks(tokens.accessToken, q);
    },
    [tokens],
  );

  const getUserPlaylists = useCallback(async () => {
    if (!tokens) throw new Error('Not authenticated with Spotify');
    setLoading(true);
    try {
      const lists = await spotifyService.getUserPlaylists(tokens.accessToken);
      setPlaylists(lists);
      return lists;
    } finally {
      setLoading(false);
    }
  }, [tokens, setPlaylists, setLoading]);

  const getPlaylistTracks = useCallback(
    async (playlistId) => {
      if (!tokens) throw new Error('Not authenticated with Spotify');
      return spotifyService.getPlaylistTracks(tokens.accessToken, playlistId);
    },
    [tokens],
  );

  const disconnect = useCallback(async () => {
    await spotifyService.clearTokens();
    reset();
  }, [reset]);

  return {
    isConnected,
    tokens,
    playlists,
    currentTrack,
    isLoading,
    error,
    authenticate,
    searchTracks,
    getUserPlaylists,
    getPlaylistTracks,
    disconnect,
  };
}
