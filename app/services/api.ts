import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://jiosaavn-api-ts-eight.vercel.app';

// Types based on JioSaavn API response
export interface SongImage {
  quality: string;
  url: string;
}

export interface SongArtist {
  id: string;
  name: string;
  role: string;
  type: string;
  image: SongImage[];
  url: string;
}

export interface SongArtists {
  primary: SongArtist[];
  featured: SongArtist[];
  all: SongArtist[];
}

export interface SongAlbum {
  id: string | null;
  name: string | null;
  url: string | null;
}

export interface SongDownloadUrl {
  quality: string;
  url: string;
}

export interface SongLyrics {
  lyrics: string;
  copyright: string;
  snippet: string;
}

export interface ApiSong {
  id: string;
  name: string;
  primary_artists: string;
  album: {
    name: string;
  };
  image: Array<{
    quality: string;
    url: string;
  }>;
  duration: number;
  download_url: Array<{
    url: string;
  }>;
  year?: string;
}

export interface Song {
  id: string;
  name: string;
  subtitle: string;
  type: string;
  year: string | null;
  releaseDate: string | null;
  duration: number | null;
  label: string | null;
  explicitContent: boolean;
  playCount: number | null;
  language: string;
  hasLyrics: boolean;
  lyricsId: string | null;
  lyrics?: SongLyrics;
  url: string;
  copyright: string | null;
  album: SongAlbum;
  artists: SongArtists;
  image: SongImage[];
  download_url: SongDownloadUrl[];
}

export interface Album {
  id: string;
  name: string;
  description: string;
  year: number | null;
  type: string;
  playCount: number | null;
  language: string;
  explicitContent: boolean;
  artists: SongArtists;
  songCount: number | null;
  url: string;
  image: SongImage[];
  songs: Song[] | null;
}

export interface Artist {
  id: string;
  name: string;
  url: string;
  type: string;
  image: SongImage[];
  followerCount: number | null;
  fanCount: string | null;
  isVerified: boolean | null;
  dominantLanguage: string | null;
  dominantType: string | null;
  topSongs: Song[] | null;
  topAlbums: Album[] | null;
  singles: Song[] | null;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  year: number | null;
  type: string;
  playCount: number | null;
  language: string;
  explicitContent: boolean;
  songCount: number | null;
  url: string;
  image: SongImage[];
  songs: Song[] | null;
  artists: SongArtist[] | null;
}

interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = BASE_URL;
  }

  private async getLanguage(): Promise<string> {
    try {
      const language = await AsyncStorage.getItem('language');
      return language || 'english';
    } catch (error) {
      console.error('Error getting language:', error);
      return 'english';
    }
  }

  private async fetchApi<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    try {
      const language = await this.getLanguage();
      const queries = {
        ...params,
        lang: params.lang || language,
      };

      const queryParams = new URLSearchParams(queries).toString();
      const url = `${this.baseUrl}/${endpoint}?${queryParams}`;

      console.log('API Request URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response for:', endpoint, data.status, data.message);
      return data as ApiResponse<T>;
    } catch (error) {
      console.error(`Error fetching from ${endpoint}:`, error);
      return {
        status: 'Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: {} as T,
      };
    }
  }

  // Home
  async getHomeData(lang?: string[], mini = true) {
    return this.fetchApi<{ modules: any[] }>('modules', {
      lang: lang?.join(',') || '',
      mini: `${mini}`,
    });
  }

  // Song
  async getSongDetails(token: string | string[], mini = false) {
    return this.fetchApi<Song>(
      'song',
      Array.isArray(token)
        ? { id: token.join(','), mini: `${mini}` }
        : { id:token, mini: `${mini}` }
    );
  }

  async getSongRecommendations(id: string, lang?: string[], mini = true) {
    return this.fetchApi<Song[]>('song/recommend', {
      id,
      lang: lang?.join(',') || '',
      mini: `${mini}`,
    });
  }

  // Album
  async getAlbumDetails(token: string, mini = true) {
    return this.fetchApi<Album>('album', {
      token,
      mini: `${mini}`,
    });
  }

  async getAlbumRecommendations(id: string, lang?: string[], mini = true) {
    return this.fetchApi<Album[]>('album/recommend', {
      id,
      lang: lang?.join(',') || '',
      mini: `${mini}`,
    });
  }

  async getAlbumFromSameYear(year: number, lang?: string[], mini = true) {
    return this.fetchApi<Album[]>('album/same-year', {
      year: `${year}`,
      lang: lang?.join(',') || '',
      mini: `${mini}`,
    });
  }

  // Playlist
  async getPlaylistDetails(token: string, mini = true) {
    return this.fetchApi<Playlist>('playlist', {
      token,
      mini: `${mini}`,
    });
  }

  async getPlaylistRecommendations(id: string, lang?: string[], mini = true) {
    return this.fetchApi<Playlist[]>('playlist/recommend', {
      id,
      lang: lang?.join(',') || '',
      mini: `${mini}`,
    });
  }

  // Artist
  async getArtistDetails(token: string, mini = true) {
    try {
      // If provided with a full URL, extract token
      if (token.includes('/')) {
        token = token.split('/').pop() || token;
      }

      const response = await this.fetchApi<Artist>('artist', {
        token,
        n_song: '50',
        n_album: '50',
        mini: `${mini}`,
      });

      if (response.status === 'Success') {
        return {
          success: true,
          data: {
            results: [response.data]
          }
        };
      }
      return {
        success: false,
        data: {
          results: []
        }
      };
    } catch (error) {
      console.error('Error in getArtistDetails:', error);
      return {
        success: false,
        data: {
          results: []
        }
      };
    }
  }

  async getArtistsSongs(
    id: string,
    page = 0,
    cat = 'popularity',
    sort = 'asc',
    mini = true
  ) {
    return this.fetchApi<{ songs: Song[] }>('artist/songs', {
      id,
      page: `${page}`,
      cat,
      sort,
      mini: `${mini}`,
    });
  }

  // Add compatibility method for artist songs with simpler response format
  async getArtistSongs(id: string) {
    try {
      const response = await this.getArtistsSongs(id);
      if (response.status === 'Success') {
        return {
          success: true,
          data: {
            results: response.data || []
          }
        };
      }
      return {
        success: false,
        data: {
          results: []
        }
      };
    } catch (error) {
      console.error('Error in getArtistSongs:', error);
      return {
        success: false,
        data: {
          results: []
        }
      };
    }
  }

  async getArtistsAlbums(
    id: string,
    page = 0,
    cat = 'popularity',
    sort = 'asc',
    mini = true
  ) {
    return this.fetchApi<{ albums: Album[] }>('artist/albums', {
      id,
      page: `${page}`,
      cat,
      sort,
      mini: `${mini}`,
    });
  }

  // Search
  async searchAll(query: string) {
    return this.fetchApi<any>('search', { q: query });
  }

  async search(
    query: string,
    type: 'song' | 'album' | 'playlist' | 'artist' | 'show',
    page = 1,
    n = 50
  ) {
    return this.fetchApi<any>(`search/${type === 'show' ? 'podcast' : type}s`, {
      q: query,
      page: `${page}`,
      n: `${n}`,
    });
  }

  // Trending
  async getTrending(type: 'song' | 'album' | 'playlist', lang?: string[], mini = true) {
    return this.fetchApi<any[]>(`get/trending`, {
      type,
      lang: lang?.join(',') || '',
      mini: `${mini}`,
    });
  }

  // Lyrics
  async getLyrics(id: string) {
    return this.fetchApi<SongLyrics>('get/lyrics', { id });
  }

  // Get top artists
  async getTopArtists(page = 1, n = 50, lang?: string[], mini = true) {
    return this.fetchApi<any[]>('get/top-artists', {
      page: `${page}`,
      n: `${n}`,
      lang: lang?.join(',') || '',
      mini: `${mini}`,
    });
  }

  // Get featured playlists
  async getFeaturedPlaylists(page = 1, n = 50, lang?: string[], mini = true) {
    return this.fetchApi<{count: number, last_page: boolean, data: any[]}>('get/featured-playlists', {
      page: `${page}`,
      n: `${n}`,
      lang: lang?.join(',') || '',
      mini: `${mini}`,
    });
  }
}

// Create and export a singleton instance
const apiClient = new ApiClient();
export default apiClient;
