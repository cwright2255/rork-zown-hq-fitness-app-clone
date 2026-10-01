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

  // Real, new: queue entries are normalized to {id, trackName, artistName,
  // artworkUrl} for display either way (same shape searchTracks already
  // returns), while each store keeps its own provider-correct key
  // internally (uri for Spotify, catalog id for Apple Music) to actually
  // resume playback - these two small helpers translate between the two
  // so the UI never needs to know which key is which.
  const normalizeQueueEntry = (q, idKey) => ({
    id: q[idKey],
    trackName: q.trackName,
    artistName: q.artistName,
    artworkUrl: q.artworkUrl,
  });
  const toProviderEntry = (track, idKey) => ({
    [idKey]: track.id,
    trackName: track.trackName,
    artistName: track.artistName,
    artworkUrl: track.artworkUrl,
  });

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
      // Real, new: manual "skip forward" now checks our own queue first -
      // without this it stayed wired to Spotify's native device-side skip,
      // which has nothing to skip TO when what's playing is a single
      // queued song (not an album/playlist context), so tapping it would
      // do nothing even with songs genuinely queued up in this app. Native
      // nextTrack is still the right fallback for an album/playlist
      // that's actually playing, where Spotify's own queue has more than
      // one real track in it.
      nextTrack: async () => {
        const advanced = await spotify.playNextFromQueue();
        if (!advanced) await spotify.nextTrack();
      },
      previousTrack: spotify.previousTrack,
      updateCurrentTrack: spotify.updateCurrentTrack,
      queue: spotify.queue.map((q) => normalizeQueueEntry(q, 'uri')),
      addToQueue: (track) => spotify.addToQueue(toProviderEntry(track, 'uri')),
      playNext: (track) => spotify.playNext(toProviderEntry(track, 'uri')),
      clearQueue: spotify.clearQueue,
      playAlbum: (album) => spotify.playAlbum(album.id),
      startArtistMix: (artistName) => spotify.startArtistMix(artistName),
      searchTracks: async (query) => {
        const results = await spotifyService.searchTracks(query);
        return results.map((t) => ({
          id: t.uri,
          trackName: t.name,
          artistName: t.artists?.map((a) => a.name).join(', ') || '',
          artworkUrl: t.album?.images?.[t.album.images.length - 1]?.url || null,
        }));
      },
      searchAlbums: async (query) => {
        const results = await spotifyService.searchAlbums(query);
        return results.map((a) => ({
          id: a.uri,
          albumName: a.name,
          artistName: a.artists?.map((ar) => ar.name).join(', ') || '',
          artworkUrl: a.images?.[0]?.url || null,
          trackCount: typeof a.total_tracks === 'number' ? a.total_tracks : null,
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
      // Real, new: same reasoning as the Spotify branch above - checks our
      // own queue before falling back to MusicKit's native skip, which has
      // nothing to skip to when a single song (not an album/playlist) is
      // what's actually queued natively.
      nextTrack: async () => {
        const advanced = await appleMusic.playNextFromQueue();
        if (!advanced) await appleMusic.nextTrack();
      },
      previousTrack: appleMusic.previousTrack,
      updateCurrentTrack: appleMusic.updateCurrentTrack,
      queue: appleMusic.queue.map((q) => normalizeQueueEntry(q, 'id')),
      addToQueue: (track) => appleMusic.addToQueue(toProviderEntry(track, 'id')),
      playNext: (track) => appleMusic.playNext(toProviderEntry(track, 'id')),
      clearQueue: appleMusic.clearQueue,
      playAlbum: (album) => appleMusic.playAlbum(album.id),
      startArtistMix: (artistName) => appleMusic.startArtistMix(artistName),
      searchTracks: async (query) => {
        const results = await appleMusicService.searchTracks(query);
        return results.map((t) => ({
          id: t.id,
          trackName: t.title,
          artistName: t.artistName || '',
          artworkUrl: t.artworkUrl || null,
        }));
      },
      searchAlbums: async (query) => {
        const results = await appleMusicService.searchAlbums(query);
        return results.map((a) => ({
          id: a.id,
          albumName: a.title,
          artistName: a.artistName || '',
          artworkUrl: a.artworkUrl || null,
          trackCount: typeof a.trackCount === 'number' ? a.trackCount : null,
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
    queue: [],
    addToQueue: () => {},
    playNext: () => {},
    clearQueue: () => {},
    playAlbum: async () => {},
    startArtistMix: async () => false,
    searchTracks: async () => [],
    searchAlbums: async () => [],
  };
}
