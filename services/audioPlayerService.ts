import { Audio, AVPlaybackStatus } from 'expo-av';
import { Platform } from 'react-native';

export interface AudioTrack {
  id: string;
  name: string;
  artistName: string;
  albumArt?: string;
  previewUrl: string;
  durationMs: number;
  uri?: string;
}

export interface PlaybackInfo {
  isPlaying: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
  positionMs: number;
  durationMs: number;
  currentTrack: AudioTrack | null;
}

type PlaybackListener = (info: PlaybackInfo) => void;

class AudioPlayerService {
  private sound: Audio.Sound | null = null;
  private currentTrack: AudioTrack | null = null;
  private queue: AudioTrack[] = [];
  private queueIndex: number = -1;
  private listeners: Set<PlaybackListener> = new Set();
  private isInitialized = false;
  private _isPlaying = false;
  private _isBuffering = false;
  private _isLoaded = false;
  private _positionMs = 0;
  private _durationMs = 0;

  async initialize() {
    if (this.isInitialized) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      this.isInitialized = true;
      console.log('[AudioPlayer] Initialized');
    } catch (error) {
      console.error('[AudioPlayer] Failed to initialize:', error);
    }
  }

  subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.getPlaybackInfo());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const info = this.getPlaybackInfo();
    this.listeners.forEach((l) => l(info));
  }

  getPlaybackInfo(): PlaybackInfo {
    return {
      isPlaying: this._isPlaying,
      isBuffering: this._isBuffering,
      isLoaded: this._isLoaded,
      positionMs: this._positionMs,
      durationMs: this._durationMs,
      currentTrack: this.currentTrack,
    };
  }

  private onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      this._isLoaded = true;
      this._isPlaying = status.isPlaying;
      this._isBuffering = status.isBuffering;
      this._positionMs = status.positionMillis ?? 0;
      this._durationMs = status.durationMillis ?? this.currentTrack?.durationMs ?? 0;

      if (status.didJustFinish && !status.isLooping) {
        console.log('[AudioPlayer] Track finished, playing next');
        this.playNext();
      }
    } else {
      if (status.error) {
        console.error('[AudioPlayer] Playback error:', status.error);
      }
      this._isLoaded = false;
      this._isPlaying = false;
      this._isBuffering = false;
    }
    this.notify();
  };

  async loadAndPlay(track: AudioTrack) {
    await this.initialize();

    if (!track.previewUrl) {
      console.warn('[AudioPlayer] No preview URL for track:', track.name);
      return false;
    }

    console.log('[AudioPlayer] Loading track:', track.name, track.previewUrl);

    try {
      await this.unloadCurrent();

      this._isBuffering = true;
      this.currentTrack = track;
      this.notify();

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.previewUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        this.onPlaybackStatusUpdate
      );

      this.sound = sound;
      this._isPlaying = true;
      this.notify();
      console.log('[AudioPlayer] Playing:', track.name);
      return true;
    } catch (error) {
      console.error('[AudioPlayer] Failed to load track:', error);
      this.currentTrack = null;
      this._isBuffering = false;
      this._isPlaying = false;
      this.notify();
      return false;
    }
  }

  async togglePlayPause() {
    if (!this.sound || !this._isLoaded) return;

    try {
      if (this._isPlaying) {
        await this.sound.pauseAsync();
      } else {
        await this.sound.playAsync();
      }
    } catch (error) {
      console.error('[AudioPlayer] Toggle play/pause error:', error);
    }
  }

  async pause() {
    if (!this.sound || !this._isLoaded) return;
    try {
      await this.sound.pauseAsync();
    } catch (error) {
      console.error('[AudioPlayer] Pause error:', error);
    }
  }

  async resume() {
    if (!this.sound || !this._isLoaded) return;
    try {
      await this.sound.playAsync();
    } catch (error) {
      console.error('[AudioPlayer] Resume error:', error);
    }
  }

  async seekTo(positionMs: number) {
    if (!this.sound || !this._isLoaded) return;
    try {
      await this.sound.setPositionAsync(positionMs);
    } catch (error) {
      console.error('[AudioPlayer] Seek error:', error);
    }
  }

  setQueue(tracks: AudioTrack[], startIndex: number = 0) {
    this.queue = tracks;
    this.queueIndex = startIndex;
    console.log('[AudioPlayer] Queue set with', tracks.length, 'tracks, starting at', startIndex);
  }

  async playFromQueue(index: number) {
    if (index < 0 || index >= this.queue.length) return;
    this.queueIndex = index;
    await this.loadAndPlay(this.queue[index]);
  }

  async playNext() {
    if (this.queue.length === 0) {
      await this.stop();
      return;
    }

    const nextIndex = this.queueIndex + 1;
    if (nextIndex < this.queue.length) {
      this.queueIndex = nextIndex;
      await this.loadAndPlay(this.queue[nextIndex]);
    } else {
      console.log('[AudioPlayer] End of queue');
      await this.stop();
    }
  }

  async playPrevious() {
    if (this.queue.length === 0) return;

    if (this._positionMs > 3000 && this.sound && this._isLoaded) {
      await this.sound.setPositionAsync(0);
      return;
    }

    const prevIndex = this.queueIndex - 1;
    if (prevIndex >= 0) {
      this.queueIndex = prevIndex;
      await this.loadAndPlay(this.queue[prevIndex]);
    } else if (this.sound && this._isLoaded) {
      await this.sound.setPositionAsync(0);
    }
  }

  async stop() {
    await this.unloadCurrent();
    this.currentTrack = null;
    this._isPlaying = false;
    this._isBuffering = false;
    this._isLoaded = false;
    this._positionMs = 0;
    this._durationMs = 0;
    this.notify();
  }

  private async unloadCurrent() {
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        console.error('[AudioPlayer] Unload error:', error);
      }
      this.sound = null;
    }
  }

  getQueue(): AudioTrack[] {
    return this.queue;
  }

  getQueueIndex(): number {
    return this.queueIndex;
  }

  isCurrentTrack(trackId: string): boolean {
    return this.currentTrack?.id === trackId;
  }

  destroy() {
    this.unloadCurrent();
    this.listeners.clear();
    this.queue = [];
    this.queueIndex = -1;
    this.currentTrack = null;
  }
}

export const audioPlayer = new AudioPlayerService();
