import { useSpotifyStore } from '@/store/spotifyStore';
import { useAppleMusicStore } from '@/store/appleMusicStore';
import { spotifyService } from '@/services/spotifyService';
import { appleMusicService } from '@/services/appleMusicService';

// Real, new: this is the direct fix for "Spotify overrides the players
// instead of it being dynamic" - the widget, search screen, and active
// workout panel were each hard-wired to always read from useSpotifyStore()
// specifically, regardless of which service (if either) was genuinely
// connected. That was a deliberate, explicit scope decision when Apple
// Music's own connect flow was first built - this is the deferred second
// half of that work.
//
// Given the "only one player connected at a time" rule already built into
// Settings, at most one of spotify.isConnected / appleMusic.isConnected can
// ever genuinely be true at once - so which branch below runs is always
// unambiguous, never a real conflict to resolve.
//
// Spotify's own track/search-result shape and Apple Music's are completely
// different (confirmed directly against each package's real, published
// type definitions, not guessed) - name vs. title, artists[] vs. a single
// artistName string, album.images[] vs. a direct artworkUrl string. This
// hook is what translates both into one shape (trackName, artistName,
// artworkUrl) the UI can read the same way regardless of which service is
// actually active.
export function useActiveMusicPlayer() {
  const spotify = useSpotifyStore();
  const appleMusic = useAppleMusicStore();

  if (spotify.isConnected) {
    return {
      service: 'spotify',
      serviceLabel: 'Spotify',
      isConnected: true,
      canSearchCatalog: true,
      trackName: spotify.currentTrack?.name || null,
      artistName: spotify.currentTrack?.artists?.map((a) => a.name).join(', ') || null,
      artworkUrl: spotify.currentTrack?.album?.images?.[0]?.url || null,
      isPlaying: spotify.isPlaying,
      playTrack: spotify.playTrack,
      pauseTrack: spotify.pauseTrack,
      nextTrack: spotify.nextTrack,
      previousTrack: spotify.previousTrack,
      updateCurrentTrack: spotify.updateCurrentTrack,
      searchTracks: async (query) => {
        const results = await spotifyService.searchTracks(query);
        return results.map((t) => ({
          id: t.uri,
          trackName: t.name,
          artistName: t.artists?.map((a) => a.name).join(', ') || '',
          artworkUrl: t.album?.images?.[t.album.images.length - 1]?.url || null,
        }));
      },
    };
  }

  if (appleMusic.isConnected) {
    return {
      service: 'appleMusic',
      serviceLabel: 'Apple Music',
      isConnected: true,
      canSearchCatalog: appleMusic.canPlayCatalogContent,
      trackName: appleMusic.currentTrack?.title || null,
      artistName: appleMusic.currentTrack?.artistName || null,
      artworkUrl: appleMusic.currentTrack?.artworkUrl || null,
      isPlaying: appleMusic.isPlaying,
      playTrack: appleMusic.playTrack,
      pauseTrack: appleMusic.pauseTrack,
      nextTrack: appleMusic.nextTrack,
      previousTrack: appleMusic.previousTrack,
      updateCurrentTrack: appleMusic.updateCurrentTrack,
      searchTracks: async (query) => {
        const results = await appleMusicService.searchTracks(query);
        return results.map((t) => ({
          id: t.id,
          trackName: t.title,
          artistName: t.artistName || '',
          artworkUrl: t.artworkUrl || null,
        }));
      },
    };
  }

  // Neither service connected - safe no-ops. The UI already checks
  // isConnected before showing any playback controls at all, so these
  // should never genuinely get called, but staying silent here (rather
  // than throwing) avoids any risk of a new, unexpected crash if they ever
  // are.
  return {
    service: null,
    serviceLabel: null,
    isConnected: false,
    canSearchCatalog: false,
    trackName: null,
    artistName: null,
    artworkUrl: null,
    isPlaying: false,
    playTrack: async () => {},
    pauseTrack: async () => {},
    nextTrack: async () => {},
    previousTrack: async () => {},
    updateCurrentTrack: async () => {},
    searchTracks: async () => [],
  };
}
