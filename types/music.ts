// Basic types for music entities

export interface Image {
  url: string;
  quality: string;
}

export interface DownloadUrl {
  url: string;
  quality: string;
}

export interface ArtistBasic {
  id: string;
  name: string;
  type?: string;
  role?: string;
}

export interface SongArtists {
  primary: ArtistBasic[];
  featured?: ArtistBasic[];
  all: ArtistBasic[];
}

export interface SongAlbum {
  id: string;
  name: string;
  url?: string;
  type?: string;
}

export interface Song {
  id: string;
  name: string;
  type?: string;
  album: SongAlbum;
  year?: string;
  duration?: number;
  label?: string;
  language?: string;
  hasLyrics?: boolean;
  url?: string;
  copyright?: string;
  playCount?: number;
  downloadUrl: DownloadUrl[];
  image: Image[];
  artists: SongArtists;
}

export interface Artist {
  id: string;
  name: string;
  url?: string;
  type?: string;
  image: Image[];
  songCount?: number;
  followerCount?: number;
  fanCount?: string;
  isVerified?: boolean;
  dominantLanguage?: string;
  dominantType?: string;
  bio?: string;
}

export interface Album {
  id: string;
  name: string;
  description?: string;
  url?: string;
  type?: string;
  year?: string;
  language?: string;
  songCount?: number;
  playCount?: number;
  explicitContent?: boolean;
  image: Image[];
  songs?: Song[];
  artists?: SongArtists;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  type?: string;
  songCount?: number;
  image: Image[];
  url?: string;
  songs?: Song[];
  owner?: {
    id: string;
    name: string;
  };
}

// API response types
export interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
  success: boolean;
} 