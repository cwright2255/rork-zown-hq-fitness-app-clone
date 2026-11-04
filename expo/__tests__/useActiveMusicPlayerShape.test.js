// What the music hook (store/useActiveMusicPlayer.js) hands to the screens: one shape for Spotify and for Apple Music. The hook reads each
// music store through a selector now (activeWorkoutRenderCount.test.js counts the redraws it saves), so this checks the other half: that the
// song's name, artist and picture, the queue and the controls the screens get are still the right ones.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {}, auth: {}, storage: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/services/spotifyService', () => ({ spotifyService: { searchTracks: jest.fn(async () => []), searchAlbums: jest.fn(async () => []) } }));
jest.mock('@/services/appleMusicService', () => ({ appleMusicService: { searchTracks: jest.fn(async () => []), searchAlbums: jest.fn(async () => []) } }));

import { useActiveMusicPlayer } from '../store/useActiveMusicPlayer';
import { useSpotifyStore } from '../store/spotifyStore';
import { useAppleMusicStore } from '../store/appleMusicStore';

const STORES = [useSpotifyStore, useAppleMusicStore];
const INITIAL = STORES.map((store) => store.getState());

beforeEach(() => {
  STORES.forEach((store, i) => store.setState(INITIAL[i], true));
  useSpotifyStore.setState({ isConnected: false, currentTrack: null, isPlaying: false, queue: [] });
  useAppleMusicStore.setState({ isConnected: false, currentTrack: null, isPlaying: false, queue: [] });
});

const spotifyTrack = (name = 'Song One') => ({
  name,
  artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
  album: { images: [{ url: 'https://example.com/big.jpg' }, { url: 'https://example.com/small.jpg' }] },
});

describe('with Spotify connected', () => {
  beforeEach(() => {
    useSpotifyStore.setState({ isConnected: true, currentTrack: spotifyTrack(), isPlaying: true, queue: [{ uri: 'spotify:track:1', trackName: 'Queued', artistName: 'Q Artist', artworkUrl: 'https://example.com/q.jpg' }] });
  });

  it('hands over the song\'s name, its artists joined, its first picture, and whether it is playing', () => {
    const { result } = renderHook(() => useActiveMusicPlayer());
    expect(result.current).toMatchObject({
      service: 'spotify',
      serviceLabel: 'Spotify',
      isConnected: true,
      trackName: 'Song One',
      artistName: 'Artist A, Artist B',
      artworkUrl: 'https://example.com/big.jpg',
      isPlaying: true,
    });
  });

  it('hands over null for the song when nothing is playing', () => {
    useSpotifyStore.setState({ currentTrack: null, isPlaying: false });
    const { result } = renderHook(() => useActiveMusicPlayer());
    expect(result.current).toMatchObject({ isConnected: true, trackName: null, artistName: null, artworkUrl: null, isPlaying: false });
  });

  it('follows the song when the next one starts, and the play button when it is paused', () => {
    const { result } = renderHook(() => useActiveMusicPlayer());
    act(() => { useSpotifyStore.setState({ currentTrack: spotifyTrack('Song Two') }); });
    expect(result.current.trackName).toBe('Song Two');
    act(() => { useSpotifyStore.setState({ isPlaying: false }); });
    expect(result.current.isPlaying).toBe(false);
  });

  it('shows the queue in the shared shape, with the store\'s own key as the id', () => {
    const { result } = renderHook(() => useActiveMusicPlayer());
    expect(result.current.queue).toEqual([{ id: 'spotify:track:1', trackName: 'Queued', artistName: 'Q Artist', artworkUrl: 'https://example.com/q.jpg' }]);
  });

  it('gives the screens the store\'s own play, pause and previous', () => {
    const { result } = renderHook(() => useActiveMusicPlayer());
    const store = useSpotifyStore.getState();
    expect(result.current.playTrack).toBe(store.playTrack);
    expect(result.current.pauseTrack).toBe(store.pauseTrack);
    expect(result.current.previousTrack).toBe(store.previousTrack);
  });

  it('skips forward through the app\'s own queue first, and through Spotify when the queue has nothing', async () => {
    const playNextFromQueue = jest.fn(async () => true);
    const nextTrack = jest.fn(async () => undefined);
    useSpotifyStore.setState({ playNextFromQueue, nextTrack });
    const { result } = renderHook(() => useActiveMusicPlayer());

    await act(async () => { await result.current.nextTrack(); });
    expect(playNextFromQueue).toHaveBeenCalledTimes(1);
    expect(nextTrack).not.toHaveBeenCalled();

    playNextFromQueue.mockResolvedValueOnce(false);
    await act(async () => { await result.current.nextTrack(); });
    expect(nextTrack).toHaveBeenCalledTimes(1);
  });

  it('adds a song to the queue under the store\'s own key', () => {
    const addToQueue = jest.fn();
    useSpotifyStore.setState({ addToQueue });
    const { result } = renderHook(() => useActiveMusicPlayer());
    result.current.addToQueue({ id: 'spotify:track:9', trackName: 'New', artistName: 'N', artworkUrl: null });
    expect(addToQueue).toHaveBeenCalledWith({ uri: 'spotify:track:9', trackName: 'New', artistName: 'N', artworkUrl: null });
  });
});

describe('with Apple Music connected', () => {
  beforeEach(() => {
    useAppleMusicStore.setState({
      isConnected: true,
      canPlayCatalogContent: true,
      currentTrack: { title: 'Apple Song', artistName: 'Apple Artist', artworkUrl: 'https://example.com/apple.jpg' },
      isPlaying: true,
      queue: [{ id: 'cat-1', trackName: 'Queued', artistName: 'Q', artworkUrl: null }],
    });
  });

  it('hands over the song\'s title as its name, its artist, its picture, and whether it can search the catalog', () => {
    const { result } = renderHook(() => useActiveMusicPlayer());
    expect(result.current).toMatchObject({
      service: 'appleMusic',
      serviceLabel: 'Apple Music',
      isConnected: true,
      canSearchCatalog: true,
      trackName: 'Apple Song',
      artistName: 'Apple Artist',
      artworkUrl: 'https://example.com/apple.jpg',
      isPlaying: true,
    });
  });

  it('says the catalog cannot be searched when the account cannot play it', () => {
    useAppleMusicStore.setState({ canPlayCatalogContent: false });
    const { result } = renderHook(() => useActiveMusicPlayer());
    expect(result.current.canSearchCatalog).toBe(false);
  });

  it('follows the song when the next one starts', () => {
    const { result } = renderHook(() => useActiveMusicPlayer());
    act(() => { useAppleMusicStore.setState({ currentTrack: { title: 'Next', artistName: 'Them', artworkUrl: null } }); });
    expect(result.current).toMatchObject({ trackName: 'Next', artistName: 'Them', artworkUrl: null });
  });

  it('shows the queue in the shared shape, with the catalog id as the id', () => {
    const { result } = renderHook(() => useActiveMusicPlayer());
    expect(result.current.queue).toEqual([{ id: 'cat-1', trackName: 'Queued', artistName: 'Q', artworkUrl: null }]);
  });
});

describe('with neither connected', () => {
  it('says so, and hands over harmless stand-ins', async () => {
    const { result } = renderHook(() => useActiveMusicPlayer());
    expect(result.current).toMatchObject({
      service: null,
      isConnected: false,
      canSearchCatalog: false,
      trackName: null,
      artistName: null,
      artworkUrl: null,
      isPlaying: false,
      queue: [],
    });
    await expect(result.current.searchTracks('x')).resolves.toEqual([]);
    await expect(result.current.startArtistMix('x')).resolves.toBe(false);
  });
});
