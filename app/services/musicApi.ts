import apiClient, { Song as ApiSong } from './api';
import { Song } from '../components/music/MusicContext';
import axios from 'axios';

// Helper to convert API song to app song format
export const convertApiSongToAppSong = (apiSong: any): Song => {
  let downloadUrl = '';

  // Check all possible download URL formats
  if (apiSong.downloadUrl && Array.isArray(apiSong.downloadUrl) && apiSong.downloadUrl.length > 0) {
    // Try to get the highest quality URL from downloadUrl array
    downloadUrl = apiSong.downloadUrl[apiSong.downloadUrl.length - 1]?.url || apiSong.downloadUrl[0]?.url || '';
  } else if (apiSong.download_url && Array.isArray(apiSong.download_url) && apiSong.download_url.length > 0) {
    // Try to get the highest quality URL from download_url array
    downloadUrl = apiSong.download_url[apiSong.download_url.length - 1]?.link ||
                apiSong.download_url[0]?.link || '';
  }

  // Get the high quality image or fallback to first available
  let artwork = '';

  // Handle different image formats
  if (apiSong.image) {
    if (Array.isArray(apiSong.image)) {
      // Find the highest quality image (500x500)
      const highQualityImage = apiSong.image.find((img: { quality: string; link: string }) =>
        img.quality === '500x500'
      );

      if (highQualityImage) {
        artwork = highQualityImage.link;
      } else {
        // Fallback to any available image
        artwork = apiSong.image[0]?.link || '';
      }
    } else if (typeof apiSong.image === 'string') {
      // If image is a direct string URL
      artwork = apiSong.image;
    }
  }

  return {
    id: apiSong.id,
    title: apiSong.name,
    artist: apiSong.subtitle ||
            apiSong.artists?.primary?.map((artist: any) => artist.name).join(', ') ||
            apiSong.primary_artists?.map((artist: any) => artist.name).join(', ') ||
            'Unknown Artist',
    album: apiSong.album?.name || '',
    artwork: artwork,
    duration: apiSong.duration || 0,
    audioUrl: downloadUrl,
    year: apiSong.year || undefined
  };
};

export const getTrendingSongs = async (): Promise<Song[]> => {
  try {
    const result = await apiClient.getTrending('song');
    if (result.status === 'Success' && result.data.length > 0) {
      return result.data.map(convertApiSongToAppSong);
    }
    return [];
  } catch (error) {
    console.error('Error loading trending songs:', error);
    return [];
  }
};

export const getSongDetails = async (id: string): Promise<Song | null> => {
  try {
    const result = await apiClient.getSongDetails(id);
    if (result.status === 'Success') {
      return convertApiSongToAppSong(result.data);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching song with ID ${id}:`, error);
    return null;
  }
};
export const getSongRecommendations = async (id: string): Promise<Song[]> => {
  try {
    const result = await apiClient.getSongRecommendations(id);
    return result.data.map(convertApiSongToAppSong);
  } catch (error) {
    console.error(`Error fetching song recommendations for ID ${id}:`, error);
    return [];
  }
}

export const getArtistSongs = async (id: string): Promise<Song[]> => {
  try {
    const result = await apiClient.getArtistsSongs(id);
    if (result.status === 'Success') {
      return result.data.songs.map(convertApiSongToAppSong);
    }
    return [];
  } catch (error) {
    console.error(`Error fetching songs for artist with ID ${id}:`, error);
    return [];
  }
};

export const getPlaylistDetails = async (playlistId: string): Promise<Song[]> => {
  try {
    const result = await apiClient.getPlaylistDetails(playlistId);
    if (result.status === 'Success' && result.data) {
      return result.data.songs?.map(convertApiSongToAppSong) || [];
    }
    return [];
  } catch (error) {
    console.error(`Error loading playlist songs:`, error);
    return [];
  }
};


export const getAlbumDetails = async (albumId: string): Promise<Song[]> => {
  try {
    const result = await apiClient.getAlbumDetails(albumId);
    if (result.status === 'Success' && result.data) {
      return result.data.songs?.map(convertApiSongToAppSong) || [];
    }
    return [];
  } catch (error) {
    console.error(`Error loading album songs:`, error);
    return [];
  }
};

export const getTopSongs = async (query: string): Promise<Song[]> => {
  try {
    const result = await axios.get(`https://song-backend-latest.vercel.app/api/search?songName=${query}`);
    const data = result.data.data;
    // console.log("data.songs", data.songs);
    return data.songs || [];
  } catch (error) {
    console.error(`Error loading top songs:`, error);
    return [];
  }
};
export const getRecommendations = async (name: string): Promise<Song[]> => {
  try {
    const result = await axios.get(`https://song-backend-latest.vercel.app/api/recommendations?songName=${name}&limit=100`);
    return result.data.data.songs
  } catch (error) {
    console.error(`Error loading recommendations:`, error);
    return [];
  }
}
export const checkRecommendations = async (track: object): Promise<Song[]> => {
  try {
    const result = await axios.post(`https://song-backend-latest.vercel.app/api/check`, track);
    return result.data.data
  } catch (error) {
    console.error(`Error loading recommendations:`, error);
    return [];
  }
}

