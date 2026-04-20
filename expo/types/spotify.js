
export interface SpotifyArtist {
  id: string;
  name: string;
  external_urls: {
    spotify: string;
  };
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

