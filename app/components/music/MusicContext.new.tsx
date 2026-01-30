import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import apiClient, { Song as ApiSong } from '../../services/api';
import { Platform, AppState, Image as RNImage } from 'react-native';

// Define song type (used within the app)
export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  audioUrl: string;
  year?: string;
}

// Sample songs data (as fallback)
export const SAMPLE_SONGS: Song[] = [
  {
    id: '1',
    title: 'Highway to Hell',
    artist: 'AC/DC',
    album: 'Highway to Hell',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=800&fit=crop',
    duration: 208,
    audioUrl: 'sample-url-1',
    year: '1979',
  },
  {
    id: '2',
    title: 'Stairway to Heaven',
    artist: 'Led Zeppelin',
    album: 'Led Zeppelin IV',
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=800&fit=crop',
    duration: 482,
    audioUrl: 'sample-url-2',
    year: '1971',
  },
  {
    id: '3',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    album: 'Appetite for Destruction',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=800&fit=crop',
    duration: 356,
    audioUrl: 'sample-url-3',
    year: '1987',
  },
  {
    id: '4',
    title: 'Nothing Else Matters',
    artist: 'Metallica',
    album: 'Metallica (Black Album)',
    artwork: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=800&fit=crop',
    duration: 386,
    audioUrl: 'sample-url-4',
    year: '1991',
  },
  {
    id: '5',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=800&fit=crop',
    duration: 354,
    audioUrl: 'sample-url-5',
    year: '1975',
  },
];

// Define context type
interface MusicContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  queue: Song[];
  currentPlaylist: {
    id: string;
    name: string;
    type: 'playlist' | 'album';
  } | null;
  isLiked: boolean;
  repeatMode: number; // 0: off, 1: repeat on
  isShuffle: boolean;
  downloadedSongs: string[];
  isDownloading: string | null;
  downloadProgress: number;
  isLoading: boolean;
  searchResults: Song[];
  favorites: Song[];
  songJustEnded: boolean; // Track when a song has just ended
  
  // Actions
  playSong: (song: Song, playlist?: { id: string; name: string; type: 'playlist' | 'album' }) => void;
  pauseSong: () => void;
  resumeSong: () => void;
  playNext: (isAutoPlay?: boolean) => void;
  playPrevious: () => void;
  seekTo: (time: number) => void;
  toggleLike: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  downloadSong: (songId: string) => void;
  setCurrentTime: (time: number) => void;
  searchSongs: (query: string) => Promise<void>;
  fetchSongById: (id: string) => Promise<Song | null>;
  fetchArtistSongs: (id: string) => Promise<Song[]>;
  addToFavorites: (song: Song) => void;
  removeFromFavorites: (songId: string) => void;
  updateQueue: (playlistId: string, type: 'playlist' | 'album') => Promise<void>;
}

// Helper to convert API song to app song format
const convertApiSongToAppSong = (apiSong: any): Song => {
  // Log the raw API song data to debug
  console.log('Raw API song data:', JSON.stringify(apiSong).substring(0, 500));
  
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
  
  // Log the extracted URLs for debugging
  console.log(`Song ${apiSong.id} - ${apiSong.name}:`, {
    downloadUrl,
    artwork,
    imageData: apiSong.image
  });
  
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

// Create context with default values
const MusicContext = createContext<MusicContextType>({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  queue: [],
  currentPlaylist: null,
  isLiked: false,
  repeatMode: 0,
  isShuffle: false,
  downloadedSongs: [],
  isDownloading: null,
  downloadProgress: 0,
  isLoading: false,
  searchResults: [],
  favorites: [],
  songJustEnded: false,
  
  playSong: () => {},
  pauseSong: () => {},
  resumeSong: () => {},
  playNext: () => {},
  playPrevious: () => {},
  seekTo: () => {},
  toggleLike: () => {},
  toggleRepeat: () => {},
  toggleShuffle: () => {},
  downloadSong: () => {},
  setCurrentTime: () => {},
  searchSongs: async () => {},
  fetchSongById: async () => null,
  fetchArtistSongs: async () => [],
  addToFavorites: () => {},
  removeFromFavorites: () => {},
  updateQueue: async () => {},
});

// Provider component
export function MusicProvider({ children }: { children: ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<{
    id: string;
    name: string;
    type: 'playlist' | 'album';
  } | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [downloadedSongs, setDownloadedSongs] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isProcessingChange, setIsProcessingChange] = useState(false);
  const [songJustEnded, setSongJustEnded] = useState(false);
  const changeLockRef = useRef<boolean>(false);
  
  // Debounce mechanism to prevent multiple audio playbacks
  const lastPlayRequestRef = useRef<{ songId: string, timestamp: number } | null>(null);
  const lastNextRequestRef = useRef<number>(0);
  const lastPreviousRequestRef = useRef<number>(0); // Add reference for previous button
  
  // Add these near the top with other state declarations
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionLockRef = useRef<boolean>(false);
  
  // Add this near the top with other refs
  const nextRequestRef = useRef<{ timestamp: number; songId: string } | null>(null);
  
  // Configure audio session for background playback
  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Configure audio mode for playback with proper interruption behavior
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: 1, // DoNotMix
          interruptionModeAndroid: 1, // DoNotMix
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        
        console.log('Audio mode configured for background playback');
      } catch (error) {
        console.error('Error setting up audio mode:', error);
      }
    };
    
    setupAudio();
    
    // Set up AppState listener to handle app going to background/foreground
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('App state changed to:', nextAppState);
      
      // If the app is coming back to the foreground, check if we need to refresh audio session
      if (nextAppState === 'active' && sound && isPlaying) {
        // Audio sessions can sometimes be lost when app is backgrounded, so refresh it
        sound.getStatusAsync().then(status => {
          if (status.isLoaded && !status.isPlaying && isPlaying) {
            sound.playAsync();
          }
        }).catch(error => {
          console.error('Error refreshing audio playback:', error);
        });
      }
    });
    
    return () => {
      // Clean up the subscription
      appStateSubscription.remove();
    };
  }, [sound, isPlaying]);
  
  // Set up hardware media button controls (Play/Pause/Next/Previous)
  useEffect(() => {
    const setupMediaControls = async () => {
      if (Platform.OS !== 'web') {
        try {
          // Enable handling of media button events
          await Audio.setIsEnabledAsync(true);
          
          // Set up audio session interruptibility
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            interruptionModeIOS: 1, // DoNotMix
            interruptionModeAndroid: 1, // DoNotMix
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          
          console.log('Media button controls configured');
        } catch (error) {
          console.error('Error setting up media controls:', error);
        }
      }
    };
    
    setupMediaControls();
    
    // This cleanup is important to prevent memory leaks
    return () => {
      if (Platform.OS !== 'web') {
        Audio.setIsEnabledAsync(false)
          .catch(error => console.error('Error disabling audio:', error));
      }
    };
  }, []);
  
  // Load initial data
  useEffect(() => {
    // Load popular songs as initial queue
    const loadInitialSongs = async () => {
      try {
        setIsLoading(true);
        // Get trending songs instead of search
        const result = await apiClient.getTrending('song');
        if (result.status === 'Success' && result.data.length > 0) {
          const songs = result.data.map(convertApiSongToAppSong);
          setQueue(songs);
        } else {
          // Fallback to sample songs
          setQueue(SAMPLE_SONGS);
        }
      } catch (error) {
        console.error('Error loading initial songs:', error);
        setQueue(SAMPLE_SONGS);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialSongs();
    
    // Load favorites from storage (implementation would depend on your storage solution)
    // For now, we'll keep it empty
    
    return () => {
      // Cleanup any audio resources
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);
  
  // Load and play audio when currentSong changes
  useEffect(() => {
    const loadAndPlayAudio = async () => {
      if (currentSong && isPlaying) {
        try {
          // Unload previous sound
          if (sound) {
            await sound.unloadAsync();
          }
          
          // Set media info for OS-level controls and notifications
          if (Platform.OS === 'ios' || Platform.OS === 'android') {
            try {
              // Configure audio mode for playback with proper interruption behavior
              await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                interruptionModeIOS: 1, // DoNotMix
                interruptionModeAndroid: 1, // DoNotMix
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
              });
              
              // Create sound object with notification configuration
              const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: currentSong.audioUrl },
                { 
                  shouldPlay: true,
                  progressUpdateIntervalMillis: 1000,
                  // Enable MediaPlayer implementation for Android notifications
                  // This implementation adds notification controls automatically
                  androidImplementation: Platform.OS === 'android' ? 'MediaPlayer' : undefined,
                },
                onPlaybackStatusUpdate
              );
              
              // For Android, set metadata that will appear in notification
              if (Platform.OS === 'android') {
                try {
                  // Send additional metadata to Android MediaPlayer
                  await newSound.setStatusAsync({
                    androidImplementation: 'MediaPlayer',
                    progressUpdateIntervalMillis: 1000,
                  });
                } catch (error) {
                  console.error('Error setting Android notification metadata:', error);
                }
              }
              
              setSound(newSound);
            } catch (error) {
              console.error('Error setting media info:', error);
            }
          } else {
            // Fallback for web or other platforms
            const { sound: newSound } = await Audio.Sound.createAsync(
              { uri: currentSong.audioUrl },
              { shouldPlay: true },
              onPlaybackStatusUpdate
            );
            
            setSound(newSound);
          }
        } catch (error) {
          console.error('Error loading audio:', error);
          setIsPlaying(false);
          // Try to play next song if current one fails
          playNext();
        }
      }
    };
    
    loadAndPlayAudio();
  }, [currentSong]);
  
  // Handle play/pause state changes
  useEffect(() => {
    if (sound) {
      if (isPlaying) {
        sound.playAsync();
      } else {
        sound.pauseAsync();
      }
    }
  }, [isPlaying]);
  
  // Playback status update handler
  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentTime(status.positionMillis / 1000);
      
      // When a song finishes playing
      if (status.didJustFinish && !isTransitioning) {
        console.log(`Song finished naturally. Repeat mode: ${repeatMode}`);
        
        // Set the songJustEnded flag to true
        setSongJustEnded(true);
        
        // Clear the flag after a short time
        setTimeout(() => {
          setSongJustEnded(false);
        }, 2000);
        
        // Different handling based on repeat mode
        if (repeatMode === 1) {
          // Repeat is ON: Restart the current song
          console.log('Repeat ON - restarting current song');
          if (sound) {
            sound.setPositionAsync(0);
            sound.playAsync();
          }
        } else {
          // Repeat is OFF: Play next song if available, otherwise stop
          console.log('Repeat OFF mode active - playing next if available');
          
          // Use setTimeout to break the call stack and prevent recursion
          setTimeout(() => {
            playNext(true); // Pass true to indicate auto-play (not user initiated)
          }, 100);
        }
      }
    }
  };
  
  // Search songs using the API
  const searchSongs = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsLoading(true);
      const result = await apiClient.search(query, 'song');
      if (result.status === 'Success') {
        const songs = result.data.results.map(convertApiSongToAppSong);
        setSearchResults(songs);
      }
    } catch (error) {
      console.error('Error searching songs:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch song by ID
  const fetchSongById = async (id: string): Promise<Song | null> => {
    try {
      setIsLoading(true);
      const result = await apiClient.getSongDetails(id);
      if (result.status === 'Success') {
        return convertApiSongToAppSong(result.data);
      }
      return null;
    } catch (error) {
      console.error(`Error fetching song with ID ${id}:`, error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch artist songs
  const fetchArtistSongs = async (id: string): Promise<Song[]> => {
    try {
      setIsLoading(true);
      const result = await apiClient.getArtistsSongs(id);
      if (result.status === 'Success') {
        return result.data.songs.map(convertApiSongToAppSong);
      }
      return [];
    } catch (error) {
      console.error(`Error fetching songs for artist with ID ${id}:`, error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add song to favorites
  const addToFavorites = (song: Song) => {
    if (!favorites.some(fav => fav.id === song.id)) {
      setFavorites([...favorites, song]);
      if (currentSong?.id === song.id) {
        setIsLiked(true);
      }
    }
  };
  
  // Remove song from favorites
  const removeFromFavorites = (songId: string) => {
    setFavorites(favorites.filter(song => song.id !== songId));
    if (currentSong?.id === songId) {
      setIsLiked(false);
    }
  };
  
  // Helper function to safely unload sound - completely rewritten
  const unloadSound = async () => {
    try {
      // Store the current sound in a local variable
      const currentSound = sound;
      
      // First, set the sound to null immediately to prevent other code from trying to use it
      setSound(null);
      
      // Then try to unload the previous sound if it exists
      if (currentSound) {
        try {
          // Try to get status but don't throw if it fails
          const status = await currentSound.getStatusAsync().catch(() => ({ isLoaded: false }));
          
          if (status.isLoaded) {
            // Try to pause first in case stopping fails
            await currentSound.pauseAsync().catch(() => console.log('Could not pause sound'));
            
            // Then try to stop and unload, but don't fail if either operation fails
            await currentSound.stopAsync().catch(() => console.log('Could not stop sound'));
            await currentSound.unloadAsync().catch(() => console.log('Could not unload sound'));
          }
        } catch (e) {
          // Log but don't rethrow to ensure cleanup continues
          console.log('Safely handled sound unload error:', e);
        }
      }
    } catch (error) {
      console.error('Error in unloadSound:', error);
    }
  };
  
  // Helper function to safely load and play new sound
  const loadAndPlaySound = async (audioUrl: string) => {
    try {
      // Configure for background playback
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // Set up audio settings for native platforms with notifications
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          {
            shouldPlay: true,
            progressUpdateIntervalMillis: 1000,
            // Enable MediaPlayer implementation for Android notifications
            androidImplementation: Platform.OS === 'android' ? 'MediaPlayer' : undefined,
          },
          onPlaybackStatusUpdate
        );
        
        // For Android, set metadata that will appear in notification
        if (Platform.OS === 'android') {
          try {
            // Send additional metadata to Android MediaPlayer
            await newSound.setStatusAsync({
              androidImplementation: 'MediaPlayer',
              progressUpdateIntervalMillis: 1000,
            });
          } catch (error) {
            console.error('Error setting Android notification metadata:', error);
          }
        }
        
        setSound(newSound);
        return true;
      } else {
        // Fallback for non-mobile platforms
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        return true;
      }
    } catch (error) {
      console.error('Error loading sound:', error);
      return false;
    }
  };
  
  // Play next song in queue - completely rewritten to be more reliable
  const playNext = async (isAutoPlay = false) => {
    // Prevent multiple transitions
    if (transitionLockRef.current || isTransitioning) {
      console.log('Transition already in progress, skipping playNext call');
      return;
    }
    
    // Basic validation
    if (!currentSong || queue.length === 0) {
      console.log('No current song or empty queue, cannot play next');
      return;
    }
    
    // Set transition lock immediately
    transitionLockRef.current = true;
    setIsTransitioning(true);
    
    try {
      console.log('Starting transition to next song...');
      
      // Find the current song in the queue
      const currentIndex = queue.findIndex(song => song.id === currentSong.id);
      if (currentIndex === -1) {
        console.log('Current song not found in queue');
        return;
      }
      
      // Check if we're at the end of the queue
      const isLastSong = currentIndex === queue.length - 1;
      
      // If this is the last song and repeat is off, just stop playback
      if (isLastSong && repeatMode === 0) {
        console.log('Last song with repeat OFF - stopping playback');
        setIsPlaying(false);
        await unloadSound();
        return;
      }
      
      // Find the next song index
      const nextIndex = (currentIndex + 1) % queue.length;
      const nextSong = queue[nextIndex];
      
      // Validate next song
      if (!nextSong || !nextSong.audioUrl || nextSong.audioUrl.trim() === '') {
        console.log('Invalid next song or missing audio URL');
        return;
      }
      
      console.log(`Playing next song: ${nextSong.title}`);
      
      // NEW APPROACH: First update all state, then handle audio transitions
      
      // 1. Update the current song state 
      setCurrentSong(nextSong);
      setCurrentTime(0);
      setIsLiked(favorites.some(fav => fav.id === nextSong.id));
      
      // 2. Ensure we're not playing
      setIsPlaying(false);
      
      // 3. Wait for the next tick to let React update the state
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 4. Cleanup previous audio completely
      await unloadSound();
      
      // 5. Wait a bit more for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 6. Now try to load and play the new audio
      try {
        // Create new sound object
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: nextSong.audioUrl },
          { 
            shouldPlay: false, // Start paused
            progressUpdateIntervalMillis: 1000,
          },
          onPlaybackStatusUpdate
        );
        
        // Set the sound state
        setSound(newSound);
        
        // Start playing after a brief delay
        setTimeout(() => {
          newSound.playAsync().catch(e => console.log('Error playing sound:', e));
          setIsPlaying(true);
        }, 50);
        
        console.log('Successfully transitioned to next song');
      } catch (audioError) {
        console.error('Failed to load next song audio:', audioError);
        // If we failed to load this song, try the next one
        setTimeout(() => playNext(true), 500);
      }
    } catch (error) {
      console.error('Critical error in playNext:', error);
    } finally {
      // Clear transition locks after a delay
      setTimeout(() => {
        transitionLockRef.current = false;
        setIsTransitioning(false);
        console.log('Transition locks cleared');
      }, 1000);
    }
  };
  
  // Play previous song in queue - completely rewritten to match playNext approach
  const playPrevious = async () => {
    // Prevent multiple transitions
    if (transitionLockRef.current || isTransitioning) {
      console.log('Transition already in progress, skipping playPrevious call');
      return;
    }
    
    // Basic validation
    if (!currentSong || queue.length === 0) {
      console.log('No current song or empty queue, cannot play previous');
      return;
    }
    
    // Set transition lock immediately
    transitionLockRef.current = true;
    setIsTransitioning(true);
    
    try {
      console.log('Starting transition to previous song...');
      
      // If current time is more than 3 seconds, restart the current song
      if (currentTime > 3) {
        console.log('Current position > 3 seconds, restarting current song');
        if (sound) {
          await sound.setPositionAsync(0);
          setCurrentTime(0);
        }
        transitionLockRef.current = false;
        setIsTransitioning(false);
        return;
      }
      
      // Find the current song in the queue
      const currentIndex = queue.findIndex(song => song.id === currentSong.id);
      if (currentIndex === -1) {
        console.log('Current song not found in queue');
        return;
      }
      
      // Find the previous song index
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      const prevSong = queue[prevIndex];
      
      // Validate previous song
      if (!prevSong || !prevSong.audioUrl || prevSong.audioUrl.trim() === '') {
        console.log('Invalid previous song or missing audio URL');
        return;
      }
      
      console.log(`Playing previous song: ${prevSong.title}`);
      
      // 1. Update the current song state 
      setCurrentSong(prevSong);
      setCurrentTime(0);
      setIsLiked(favorites.some(fav => fav.id === prevSong.id));
      
      // 2. Ensure we're not playing
      setIsPlaying(false);
      
      // 3. Wait for the next tick to let React update the state
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 4. Cleanup previous audio completely
      await unloadSound();
      
      // 5. Wait a bit more for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 6. Now try to load and play the new audio
      try {
        // Create new sound object
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: prevSong.audioUrl },
          { 
            shouldPlay: false, // Start paused
            progressUpdateIntervalMillis: 1000,
          },
          onPlaybackStatusUpdate
        );
        
        // Set the sound state
        setSound(newSound);
        
        // Start playing after a brief delay
        setTimeout(() => {
          newSound.playAsync().catch(e => console.log('Error playing sound:', e));
          setIsPlaying(true);
        }, 50);
        
        console.log('Successfully transitioned to previous song');
      } catch (audioError) {
        console.error('Failed to load previous song audio:', audioError);
      }
    } catch (error) {
      console.error('Critical error in playPrevious:', error);
    } finally {
      // Clear transition locks after a delay
      setTimeout(() => {
        transitionLockRef.current = false;
        setIsTransitioning(false);
        console.log('Transition locks cleared');
      }, 1000);
    }
  };
  
  // Seek to a specific time
  const seekTo = (time: number) => {
    if (sound) {
      sound.setPositionAsync(time * 1000);
    }
    setCurrentTime(time);
  };
  
  // Toggle like status for current song
  const toggleLike = () => {
    if (currentSong) {
      if (isLiked) {
        removeFromFavorites(currentSong.id);
      } else {
        addToFavorites(currentSong);
      }
    }
  };
  
  // Toggle repeat mode (off -> on -> off)
  const toggleRepeat = () => {
    setRepeatMode(repeatMode === 0 ? 1 : 0);
  };
  
  // Toggle shuffle mode
  const toggleShuffle = () => {
    const newShuffleState = !isShuffle;
    setIsShuffle(newShuffleState);
    
    // If turning shuffle on and we have a current song
    if (newShuffleState && currentSong) {
      const currentSongIndex = queue.findIndex(song => song.id === currentSong.id);
      if (currentSongIndex !== -1) {
        // Create a copy of the queue without the current song
        const remainingSongs = [...queue];
        const currentSongItem = remainingSongs.splice(currentSongIndex, 1)[0];
        
        // Fisher-Yates shuffle algorithm for the remaining songs
        for (let i = remainingSongs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
        }
        
        // Put current song back at the beginning and set new queue
        const newQueue = [currentSongItem, ...remainingSongs];
        setQueue(newQueue);
      }
    } 
    // If turning shuffle off, restore original playlist order if possible
    else if (!newShuffleState && currentPlaylist) {
      // We'll re-fetch the playlist to get the original order
      updateQueue(currentPlaylist.id, currentPlaylist.type);
    }
  };
  
  // Download a song
  const downloadSong = (songId: string) => {
    if (isDownloading || downloadedSongs.includes(songId)) return;
    
    // Simulate download
    setIsDownloading(songId);
    setDownloadProgress(0);
    
    // Simulate download progress
    const intervalId = setInterval(() => {
      setDownloadProgress(prev => {
        const newProgress = prev + 0.1;
        
        if (newProgress >= 1) {
          clearInterval(intervalId);
          setIsDownloading(null);
          setDownloadedSongs(prev => [...prev, songId]);
          return 1;
        }
        
        return newProgress;
      });
    }, 300);
  };
  
  // Update queue when playing from playlist/album
  const updateQueue = async (playlistId: string, type: 'playlist' | 'album') => {
    try {
      setIsLoading(true);
      let result;
      
      if (type === 'playlist') {
        result = await apiClient.getPlaylistDetails(playlistId);
      } else {
        result = await apiClient.getAlbumDetails(playlistId);
      }
      
      if (result.status === 'Success' && result.data) {
        const songs = result.data.songs?.map(convertApiSongToAppSong) || [];
        
        // If we have a current song in this playlist, keep playing it
        if (currentSong && songs.some(song => song.id === currentSong.id)) {
          const currentIndex = songs.findIndex(song => song.id === currentSong.id);
          // Create a new queue starting from the current song
          const newQueue = [
            ...songs.slice(currentIndex),
            ...songs.slice(0, currentIndex)
          ];
          setQueue(newQueue);
        } else {
          // If no current song, just set the queue as is
          setQueue(songs);
        }
      }
    } catch (error) {
      console.error(`Error loading ${type} songs:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  // COMPLETE REWRITE: Play a specific song with debounce to prevent double playback
  const playSong = async (song: Song, playlist?: { id: string; name: string; type: 'playlist' | 'album' }) => {
    // Basic validation
    if (!song || !song.audioUrl) {
      console.error('Invalid song or missing audio URL');
      return;
    }

    // If the song is already playing, don't restart it
    if (currentSong?.id === song.id && isPlaying) {
      console.log('Song already playing, not restarting');
      return;
    }
    
    // Check for duplicate play requests within 300ms
    const now = Date.now();
    if (lastPlayRequestRef.current 
        && lastPlayRequestRef.current.songId === song.id 
        && now - lastPlayRequestRef.current.timestamp < 300) {
      console.log('Debounced duplicate play request');
      return;
    }
    
    // Update the last play request
    lastPlayRequestRef.current = {
      songId: song.id,
      timestamp: now
    };
    
    console.log(`Starting to play song: ${song.title}`);
    
    // If playing from a playlist/album, update the current playlist
    if (playlist) {
      setCurrentPlaylist(playlist);
    }
    
    // 1. First update state
    setCurrentSong(song);
    setCurrentTime(0);
    setIsLiked(favorites.some(fav => fav.id === song.id));
    
    // 2. Ensure playback is paused during transition
    setIsPlaying(false);
    
    // 3. Unload previous sound
    await unloadSound();
    
    // 4. Create and play the new sound
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.audioUrl },
        { 
          shouldPlay: false, // We'll start playing manually
          progressUpdateIntervalMillis: 1000,
          androidImplementation: Platform.OS === 'android' ? 'MediaPlayer' : undefined,
        },
        onPlaybackStatusUpdate
      );
      
      // Set the new sound
      setSound(newSound);
      
      // Start playing after a brief delay
      setTimeout(() => {
        newSound.playAsync().catch(e => console.log('Playback start error:', e));
        setIsPlaying(true);
        console.log(`Now playing: ${song.title}`);
      }, 100);
    } catch (error) {
      console.error('Error creating sound object:', error);
    }
  };
  
  // Pause current song - simplified
  const pauseSong = () => {
    if (sound && isPlaying) {
      sound.pauseAsync().catch(e => console.log('Error pausing:', e));
      setIsPlaying(false);
    }
  };
  
  // Resume playing current song - simplified
  const resumeSong = () => {
    if (sound && currentSong && !isPlaying) {
      sound.playAsync().catch(e => console.log('Error resuming:', e));
      setIsPlaying(true);
    }
  };
  
  // Set up context value
  const contextValue: MusicContextType = {
    currentSong,
    isPlaying,
    currentTime,
    queue,
    currentPlaylist,
    isLiked,
    repeatMode,
    isShuffle,
    downloadedSongs,
    isDownloading,
    downloadProgress,
    isLoading,
    searchResults,
    favorites,
    songJustEnded,
    
    playSong,
    pauseSong,
    resumeSong,
    playNext,
    playPrevious,
    seekTo,
    toggleLike,
    toggleRepeat,
    toggleShuffle,
    downloadSong,
    setCurrentTime,
    searchSongs,
    fetchSongById,
    fetchArtistSongs,
    addToFavorites,
    removeFromFavorites,
    updateQueue,
  };
  
  return (
    <MusicContext.Provider value={contextValue}>
      {children}
    </MusicContext.Provider>
  );
}

// Custom hook to use the music context
export function useMusic() {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}