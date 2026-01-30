import React, { createContext, useState, useContext, ReactNode, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Platform,  } from 'react-native';
import { useAudioManager } from '../../hooks/useAudioManager';
import { setupAudioConfig, teardownAudioConfig, AUDIO_CONSTANTS } from '../../config/audioConfig';
import * as musicApi from '../../services/musicApi';
import apiClient from '@/app/services/api';
import * as FileSystem from 'expo-file-system';

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
  type?: string;
}

// Define context type
interface MusicContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  topSongs: Song[];
  topArtists: Song[];
  albumSongs: Song[];
  queue: Song[];
  currentPlaylist: {
    id: string;
    name: string;
    type: 'playlist' | 'album' | 'song';
  } | null;
  isShuffle: boolean;
  isLoading: boolean;
  repeatMode: boolean;
  recommendations: Song[];
  
  // Actions
  playSong: (song: Song, isSingleSong?: boolean, external?: boolean) => void;
  pauseSong: () => void;
  resumeSong: () => void;
  playNext: (isAutoPlay?: boolean) => void;
  playPrevious: () => void;
  seekTo: (time: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setCurrentTime: (time: number) => void;
  updateQueue: (playlistData: { id: string; name: string; type: 'playlist' | 'album' | 'song'; songs?: Song[] }) => Promise<void>;
}
// Create context with default values
const MusicContext = createContext<MusicContextType>({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  topSongs: [],
  topArtists: [],
  albumSongs: [],
  queue: [],
  currentPlaylist: null,
  isShuffle: false,
  isLoading: false,
  repeatMode: false,
  recommendations: [],
  playSong: () => {},
  pauseSong: () => {},
  resumeSong: () => {},
  playNext: () => {},
  playPrevious: () => {},
  seekTo: () => {},
  toggleShuffle: () => {},
  toggleRepeat: () => {},
  setCurrentTime: () => {},
  updateQueue: async () => {},
});

// Provider component
export function MusicProvider({ children }: { children: ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<{
    id: string;
    name: string;
    type: 'playlist' | 'album' | 'song';
  } | null>(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repeatMode, setRepeatMode] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [topSongs, setTopSongs] = useState<any[]>([]);
  const [topArtists, setTopArtists] = useState<any[]>([]);
  const [albumSongs, setAlbumSongs] = useState<any[]>([]);
  // Refs to prevent multiple actions
  const songEndAutoplayRef = useRef<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);
  
  // Refs for functions to avoid circular dependencies
  const audioManagerRef = useRef<any>(null);
  const playNextRef = useRef<(isAutoPlay?: boolean) => Promise<boolean>>(async () => false);
  
  // Ref to keep track of the current song
  const currentSongRef = useRef<Song | null>(null);
  
  // Add ref for repeat mode
  const repeatModeRef = useRef<boolean>(false);
  
  // Add a flag to track when a manual seek is in progress
  const isSeekingRef = useRef<boolean>(false);
  
  // Update currentSongRef whenever currentSong changes
  const fetcher = async () => {
    if (!currentSong) return;
    
    // Only fetch new recommendations if:
    // 1. We don't have any recommendations yet
    // 2. Current song is at the end of recommendations array
    // 3. Current song is not in the recommendations array at all
    const currentSongIndexInRecommendations = recommendations.findIndex(song => song.id === currentSong.id);
    const isAtEndOfRecommendations = currentSongIndexInRecommendations === recommendations.length - 1;
    const isSongNotInRecommendations = currentSongIndexInRecommendations === -1;
    const needsNewRecommendations = recommendations.length === 0 || isAtEndOfRecommendations || isSongNotInRecommendations;
    
    if (needsNewRecommendations) {
      console.log("Fetching new recommendations for:", currentSong.title, 
        isSongNotInRecommendations ? "(song not in current recommendations)" : 
        isAtEndOfRecommendations ? "(at end of recommendations)" : "(no existing recommendations)");
      const newRecommendations = await musicApi.getRecommendations(`${currentSong?.title}`);
      console.log("New recommendations:", newRecommendations.length);
      
      const formattedRecommendations = newRecommendations
      
      if (formattedRecommendations.length > 0) {
        setRecommendations(formattedRecommendations);
      }
    } else {
      console.log("Using existing recommendations, current song index:", currentSongIndexInRecommendations);
    }
  }
  useEffect(() => {
    if (currentSong) {
      currentSongRef.current = currentSong;
      fetcher();
    }
  }, [currentSong]);
  
  // Update repeatModeRef whenever repeatMode changes
  useEffect(() => {
    repeatModeRef.current = repeatMode;
    console.log('Repeat mode ref updated to:', repeatMode);
  }, [repeatMode]);

  // Initialize audio manager with status update handler
  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (!status.isLoaded) return;
    
    // Update current time only if not currently seeking
    if (!isSeekingRef.current) {
      setCurrentTime(status.positionMillis / 1000);
    }
    
    // Handle song completion
    if (status.didJustFinish && !status.isLooping) {
      // console.log('Song just finished, checking repeat mode');
      // Check if we have a valid song using the ref to get the latest value
      const currentSongFromRef = currentSongRef.current;
      
      if (!currentSongFromRef) {
        console.log('No current song from ref, skipping', currentSongFromRef);
        return;
      }
      console.log("currentSongFromRef",currentSongFromRef)
      // Get the latest repeat mode from ref
      const currentRepeatMode = repeatModeRef.current;
      console.log('Song finished, current repeat mode is:', currentRepeatMode);
      
      if (currentRepeatMode) {
        // Just restart the current song
        console.log('Restarting current song in repeat mode', currentRepeatMode);
        if (currentSongFromRef?.audioUrl && audioManagerRef.current) {
          console.log('Loading audio URL:', currentSongFromRef.audioUrl);
          console.log('Current audio manager state:', {
            isPlaying: audioManagerRef.current.isPlaying,
            hasAudioManager: !!audioManagerRef.current
          });
          
          try {
            // First explicitly stop and unload the current song
            console.log('Stopping current playback before restart');
            
            // Use explicit seek to beginning then restart approach
            audioManagerRef.current.seek(0).then(() => {
              console.log('Successfully seeked to beginning, now playing');
              audioManagerRef.current.play().then((playSuccess: boolean) => {
                console.log('Play after seek result:', playSuccess);
              }).catch((playError: Error) => {
                console.error('Error playing after seek:', playError);
                
                // Fall back to full reload as last resort
                console.log('Falling back to full reload');
                audioManagerRef.current.loadAudio(
                  currentSongFromRef.audioUrl, 
                  true,
                  {
                    title: currentSongFromRef.title,
                    artist: currentSongFromRef.artist,
                    artwork: currentSongFromRef.artwork,
                    duration: currentSongFromRef.duration
                  }
                ).catch((error: Error) => {
                  console.error('Final fallback also failed:', error);
                });
              });
            }).catch((seekError: Error) => {
              console.error('Error seeking to beginning:', seekError);
              
              // Original approach as fallback
              audioManagerRef.current.loadAudio(
                currentSongFromRef.audioUrl, 
                true,
                {
                  title: currentSongFromRef.title,
                  artist: currentSongFromRef.artist,
                  artwork: currentSongFromRef.artwork,
                  duration: currentSongFromRef.duration
                }
              ).then((success: boolean) => {
                console.log('Original reload approach result:', success);
              }).catch((error: Error) => {
                console.error('Error with original reload approach:', error);
              });
            });
          } catch (error) {
            console.error('Error in repeat mode restart sequence:', error);
          }
        } else {
          console.error('Missing required data for repeat:', { 
            hasUrl: !!currentSongFromRef?.audioUrl, 
            hasAudioManager: !!audioManagerRef.current 
          });
        }
      } else {
        // Play the next song
        console.log('Triggering playNext from onPlaybackStatusUpdate');
        // Set autoPlay flag to true to indicate this is automatic playback
        // Make sure to call the actual function, not just reference it
        if (playNextRef.current) {
          songEndAutoplayRef.current = true;
          playNextRef.current(true).then(success => {
            console.log('Auto-play next result:', success);
            songEndAutoplayRef.current = false;
          }).catch(error => {
            console.error('Auto-play next error:', error);
            songEndAutoplayRef.current = false;
          });
        } else {
          console.error('playNextRef.current is not defined');
        }
      }
    }
  }, []); // Remove repeatMode from dependency array since we're using ref
  
  // Initialize audio manager
  const audioManager = useAudioManager(onPlaybackStatusUpdate);
  const { isPlaying } = audioManager;
  
  // Store audio manager in ref to avoid circular dependencies
  useEffect(() => {
    audioManagerRef.current = audioManager;
  }, [audioManager]);
  
  // Initialize audio configuration
  useEffect(() => {
    setupAudioConfig();
    
    return () => {
      teardownAudioConfig();
    };
  }, []);
  
  // Update queue when playing from playlist/album
  const updateQueue = useCallback(async (playlistData: { id: string; name: string; type: 'playlist' | 'album' | 'song'; songs?: Song[] }) => {
    try {
      setIsLoading(true);
      console.log(`Updating queue from ${playlistData.type} with ID ${playlistData.id} (${playlistData.name})`);
      
      let songs: Song[] = [];
      
      // If songs are provided in playlistData, use them directly
      if (playlistData.songs && playlistData.songs.length > 0) {
        console.log(`Using ${playlistData.songs.length} songs provided in playlistData`);
        songs = playlistData.songs;
      } else {
        // Otherwise fetch songs from API
        if (playlistData.type === 'playlist') {
          songs = await musicApi.getPlaylistDetails(playlistData.id);
        } else {
          songs = await musicApi.getAlbumDetails(playlistData.id);
        }
      }
      
      if (songs.length === 0) {
        console.log(`No songs found in ${playlistData.type}`);
        setIsLoading(false);
        return;
      }
      
      console.log(`Loaded ${songs.length} songs from ${playlistData.type}`);
      
      // Store current song information before updating queue
      const previousSong = currentSong;
      const wasShuffle = isShuffle;
      
      // Set current playlist with the provided data
      setCurrentPlaylist({
        id: playlistData.id,
        name: playlistData.name,
        type: playlistData.type
      });
      
      // If we're in shuffle mode and turning it off, 
      // we need special handling to maintain correct order
      if (wasShuffle && !isShuffle) {
        console.log('Restoring original order from shuffled state');
        
        // If we have a current song, place it at the front
        if (previousSong) {
          // Find the song in the new playlist
          const songInNewPlaylist = songs.find(song => song.id === previousSong.id);
          
          if (songInNewPlaylist) {
            console.log('Current song found in the playlist, moving to front');
            // Create a new array with current song first, then the rest
            const currentSongIndex = songs.findIndex(song => song.id === previousSong.id);
            
            // Remove current song from its original position
            const songsCopy = [...songs];
            songsCopy.splice(currentSongIndex, 1);
            
            // Place it at the beginning
            const newQueue = [songInNewPlaylist, ...songsCopy];
            setQueue(newQueue);
          } else {
            console.log('Current song not found in the new playlist');
            setQueue(songs);
          }
        } else {
          // No current song, just set the new queue
          setQueue(songs);
        }
      } 
      // Normal queue update (not restoring from shuffle)
      else {
        // If we have a current song in this playlist, keep playing it
        if (previousSong && songs.some(song => song.id === previousSong.id)) {
          const currentIndex = songs.findIndex(song => song.id === previousSong.id);
          console.log(`Current song found at index ${currentIndex} in the new playlist`);
          
          // Create a new queue starting from the current song
          // If shuffle is ON, just ensure current song is first and shuffle the rest
          if (isShuffle) {
            console.log('Shuffle is ON, placing current song first and shuffling rest');
            const currentSongCopy = { ...songs[currentIndex] };
            
            // Remove current song from array
            const remainingSongs = [...songs];
            remainingSongs.splice(currentIndex, 1);
            
            // Shuffle remaining songs
    for (let i = remainingSongs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
    }
    
            // Place current song at beginning
            const newQueue = [currentSongCopy, ...remainingSongs];
            setQueue(newQueue);
          } else {
            // If shuffle is OFF, maintain original playlist order but start from current
            console.log('Shuffle is OFF, maintaining playlist order starting from current song');
    const newQueue = [
              ...songs.slice(currentIndex),
              ...songs.slice(0, currentIndex)
            ];
            setQueue(newQueue);
          }
        } else {
          console.log('Current song not in new playlist or no current song');
          // If no current song or not in playlist, just set the queue
          // If shuffle is on, shuffle the new queue
          if (isShuffle && songs.length > 1) {
            console.log('Shuffle is ON, shuffling new playlist');
            const shuffled = [...songs];
            
            // Fisher-Yates shuffle
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            
            setQueue(shuffled);
          } else {
            // Just set the queue in original order
            setQueue(songs);
          }
        }
      }
    } catch (error) {
      console.error(`Error loading ${playlistData.type} songs:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [currentSong, isShuffle]);
  
  // Helper function to shuffle remaining songs while keeping current song in place
  const shuffleRemainingQueue = useCallback(() => {
    if (!currentSong || queue.length <= 1) {
      console.log('Cannot shuffle queue: no current song or queue too small');
      return;
    }
    
    console.log('Shuffling queue, total songs:', queue.length);
    
    // Step 1: Find current song index
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    if (currentIndex === -1) {
      console.log('Current song not found in queue, cannot shuffle');
      return;
    }
    
    // Step 2: Create a copy of all songs except current one
    const songsToShuffle = [...queue];
    const currentSongCopy = { ...songsToShuffle[currentIndex] };
    songsToShuffle.splice(currentIndex, 1);
    
    console.log('Songs to shuffle:', songsToShuffle.length);
    
    // Step 3: Fisher-Yates shuffle algorithm for all remaining songs
    for (let i = songsToShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songsToShuffle[i], songsToShuffle[j]] = [songsToShuffle[j], songsToShuffle[i]];
    }
    
    // Step 4: Create a new queue with current song at the beginning
    // and all other songs fully shuffled after it
    const newQueue = [currentSongCopy, ...songsToShuffle];
    
    console.log('New shuffled queue length:', newQueue.length, 'Current song is now at position 0');
    
    // Step 5: Update the queue
    setQueue(newQueue);
  }, [currentSong, queue]);
  
  // Toggle shuffle with proper dependencies 
  const toggleShuffle = useCallback(() => {
    const newShuffleState = !isShuffle;
    console.log('Toggling shuffle mode to:', newShuffleState);
    setIsShuffle(newShuffleState);
    
    if (newShuffleState) {
      // Shuffle the entire queue and move current song to first position
      console.log('Shuffle ON - shuffling the entire queue');
      shuffleRemainingQueue();
    } else if (currentPlaylist) {
      // Restore original order when shuffle is turned off
      console.log('Shuffle OFF - restoring original order from playlist:', currentPlaylist.name);
      
      // Store the current song before restoring order
      const currentSongBeforeRestore = currentSong;
      
      // Restore original order
      updateQueue({
        id: currentPlaylist.id,
        name: currentPlaylist.name,
        type: currentPlaylist.type
      })
        .then(() => {
          console.log('Queue restored to original order, length:', queue.length);
          
          // If we have a current song, ensure it's at the start of the queue
          if (currentSongBeforeRestore) {
            try {
              // Create a copy of the current queue
              const restoredQueue = [...queue];
              const currentSongIndex = restoredQueue.findIndex(song => 
                song.id === currentSongBeforeRestore.id
              );
              
              if (currentSongIndex > 0) {
                // Move current song to front while preserving relative order of all other songs
                console.log(`Moving current song from position ${currentSongIndex} to front of queue`);
                
                // Pull out current song
                const currentSongCopy = { ...restoredQueue[currentSongIndex] };
                
                // Remove current song from its current position
                restoredQueue.splice(currentSongIndex, 1);
                
                // Add it to the beginning
                const updatedQueue = [currentSongCopy, ...restoredQueue];
                
                // Update the queue
                setQueue(updatedQueue);
                console.log('Queue updated with current song at position 0');
              } else {
                console.log('Current song already at the beginning of queue, no rearrangement needed');
              }
            } catch (error) {
              console.error('Error rearranging queue after restore:', error);
            }
          }
        })
        .catch(error => {
          console.error('Failed to restore original queue order:', error);
        });
    } else {
      console.log('No playlist available to restore original order');
      
      // Even without a playlist, ensure current song is first when turning shuffle off
      if (currentSong) {
        try {
          const queueCopy = [...queue];
          const currentIndex = queueCopy.findIndex(song => song.id === currentSong.id);
          
          if (currentIndex > 0) {
            // Move current song to front
            const currentSongCopy = { ...queueCopy[currentIndex] };
            queueCopy.splice(currentIndex, 1);
            const updatedQueue = [currentSongCopy, ...queueCopy];
            setQueue(updatedQueue);
            console.log('Rearranged queue with current song at front without playlist context');
          }
        } catch (error) {
          console.error('Error rearranging queue without playlist:', error);
        }
      }
    }
  }, [isShuffle, currentPlaylist, currentSong, shuffleRemainingQueue, updateQueue, queue]);
  
  // Play a song with simplified workflow
  const playSong = useCallback(async (
    song: Song, 
    isSingleSong?: boolean,
    external?: boolean
  ) => {
    // If no audioUrl, can't play
    console.log('Playing song:', song);
    if (!song.audioUrl) {
      console.error('Cannot play song without audio URL:', song.id);
      return false;
    }

    if (isSingleSong) {
      setCurrentPlaylist(null);
      setQueue([]);
    }

    // Log currentSong state before updating
    console.log('Current song before update:', currentSong);

    // Update current song state immediately for UI responsiveness
    setCurrentSong(song);
    setCurrentTime(0);

    // Log currentSong state after updating
    console.log('Current song after update:', song);

    let finalAudioUrl = song.audioUrl;

    // If this is an external song, download it first
    if (external) {
      try {
        setIsLoading(true);
        console.log('Downloading external song:', song.title);

        // Create a unique filename
        const filename = `audio-${song.id}-${Date.now()}.mp3`;
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;

        // Download the file
        const downloadResult = await FileSystem.downloadAsync(
          `https://song-backend-dawa.vercel.app/api/song?url=${song.audioUrl}`,
          fileUri
        );

        if (downloadResult.status !== 200) {
          throw new Error('Failed to download audio');
        }

        // Use the local file URI for playback
        finalAudioUrl = downloadResult.uri;
        console.log('Song downloaded successfully:', finalAudioUrl);
      } catch (error) {
        console.error('Error downloading external song:', error);
        setIsLoading(false);
        return false;
      } finally {
        setIsLoading(false);
      }
    }

    try {
      // Load and play the song with metadata for media controls
      const success = await audioManager.loadAudio(
        finalAudioUrl, 
        true,
        {
          title: song.title,
          artist: song.artist,
          artwork: song.artwork,
          duration: song.duration
        }
      );

      if (!success) {
        console.error('Failed to load audio with URL:', finalAudioUrl);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error loading audio:', error);
      // If it's an external song, try to clean up the temporary file
      if (external) {
        try {
          const fileUri = finalAudioUrl.replace('file://', '');
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
          console.log('Cleaned up temporary audio file');
        } catch (cleanupError) {
          console.error('Error cleaning up temporary file:', cleanupError);
        }
      }
      return false;
    }
  }, [audioManager, currentSong]);
  
  // Play the next song in queue with improved synchronization
  const playNext = useCallback(async (isAutoPlay = false) => {
    // Prevent concurrent transitions
    if (isTransitioningRef.current) {
      console.log('Song transition already in progress, ignoring next request');
      return false;
    }
    
    // Mark as transitioning
    isTransitioningRef.current = true;
    console.log(`Playing next song (autoPlay: ${isAutoPlay})`);
    
    try {
      // Validate queue state
      if (!currentSong || queue.length === 0) {
        console.log('Cannot play next: no current song or empty queue');
        if (recommendations.length > 0) {
          const previousSong = currentSong;
          
          // Find current song in recommendations to play the next one sequentially
          let nextSong;
          if (currentSong) {
            const currentSongIndexInRecommendations = recommendations.findIndex(song => song.id === currentSong.id);
            
            if (currentSongIndexInRecommendations !== -1 && currentSongIndexInRecommendations < recommendations.length - 1) {
              // Play the next song in recommendations sequence
              nextSong = recommendations[currentSongIndexInRecommendations + 1];
              const checkRecommendations = await musicApi.checkRecommendations(nextSong);
              console.log("checkRecommendations",checkRecommendations)
              if(checkRecommendations){
                nextSong = checkRecommendations
              }
              console.log('Playing next sequential recommendation:', nextSong.title);
            } else {
              // If current song not in recommendations or at the end, play the first recommendation
              nextSong = recommendations[0];
              const checkRecommendations = await musicApi.checkRecommendations(nextSong);
              console.log("checkRecommendations",checkRecommendations)
              if(checkRecommendations){
                nextSong = checkRecommendations
              }
              console.log('Starting recommendation sequence from beginning:', nextSong.title);
            }
          } else {
            // If no current song, start from the first recommendation
            nextSong = recommendations[0];
            const checkRecommendations = await musicApi.checkRecommendations(nextSong);
            console.log("checkRecommendations",checkRecommendations)
            if(checkRecommendations){
              nextSong = checkRecommendations
            }
            console.log('Starting recommendation sequence from beginning:', nextSong.title);
          }
          
          setCurrentSong(nextSong);
          
          let finalAudioUrl = nextSong.audioUrl;
          const isExternalSong = nextSong?.type === "youtube";
          
          // If this is an external song, download it first
          if (isExternalSong) {
            try {
              setIsLoading(true);
              console.log('Downloading external song:', nextSong.title);

              // Create a unique filename
              const filename = `audio-${nextSong.id}-${Date.now()}.mp3`;
              const fileUri = `${FileSystem.cacheDirectory}${filename}`;

              // Download the file
              const downloadResult = await FileSystem.downloadAsync(
                `https://song-backend-dawa.vercel.app/api/song?url=${nextSong.audioUrl}`,
                fileUri
              );

              if (downloadResult.status !== 200) {
                throw new Error('Failed to download audio');
              }

              // Use the local file URI for playback
              finalAudioUrl = downloadResult.uri;
              console.log('Song downloaded successfully:', finalAudioUrl);
            } catch (error) {
              console.error('Error downloading external song:', error);
              setIsLoading(false);
              setCurrentSong(previousSong);
              return false;
            } finally {
              setIsLoading(false);
            }
          }
          
          setCurrentTime(0);
          const success = await audioManager.loadAudio(
            finalAudioUrl,
            true, 
            {
              title: nextSong.title,
              artist: nextSong.artist,
              artwork: nextSong.artwork,
              duration: nextSong.duration
            }
          );
          if (!success) {
            console.error('Failed to load next song, reverting UI state');
            setCurrentSong(previousSong);
            
            // Clean up downloaded file if external song
            if (isExternalSong) {
              try {
                const fileUri = finalAudioUrl.replace('file://', '');
                await FileSystem.deleteAsync(fileUri, { idempotent: true });
                console.log('Cleaned up temporary audio file');
              } catch (cleanupError) {
                console.error('Error cleaning up temporary file:', cleanupError);
              }
            }
            
            return false;
          }
          return true;
        }
        return false;
      }
      
      // Find current position
      const currentIndex = queue.findIndex(song => song.id === currentSong.id);
      if (currentIndex === -1) {
        console.log('Current song not found in queue');
        return false;
      }
      console.log("Current song position in queue:", currentIndex + 1, "of", queue.length);
      
      // Check if we're at the end of the queue
      const isLastSong = currentIndex === queue.length - 1;
      
      // Handle loop mode for last song
      if (isLastSong && !repeatMode) {
        console.log('At end of queue and repeat is OFF');
        if (!isAutoPlay) {
          // If manual skip on last song, just stop playback
          audioManager.pause();
        }
        return false;
      }
      
      // Get the next song
      const nextIndex = (currentIndex + 1) % queue.length;
      const nextSong = queue[nextIndex];
      
      console.log(`Playing next song: ${nextSong.title} by ${nextSong.artist} (${nextIndex+1}/${queue.length})`);
      
      // If no audio URL, can't play
      if (!nextSong.audioUrl) {
        console.error('Next song has no audio URL:', nextSong);
        return false;
      }
      
      // Remember previous song in case we need to revert UI
      const previousSong = currentSong;
      
      // Update UI state first
      setCurrentSong(nextSong);
      setCurrentTime(0);
      
      let finalAudioUrl = nextSong.audioUrl;
      const isExternalSong = nextSong?.type === "youtube";
      
      // If this is an external song, download it first
      if (isExternalSong) {
        try {
          setIsLoading(true);
          console.log('Downloading external song:', nextSong.title);

          // Create a unique filename
          const filename = `audio-${nextSong.id}-${Date.now()}.mp3`;
          const fileUri = `${FileSystem.cacheDirectory}${filename}`;

          // Download the file
          const downloadResult = await FileSystem.downloadAsync(
            `https://song-backend-dawa.vercel.app/api/song?url=${nextSong.audioUrl}`,
            fileUri
          );

          if (downloadResult.status !== 200) {
            throw new Error('Failed to download audio');
          }

          // Use the local file URI for playback
          finalAudioUrl = downloadResult.uri;
          console.log('Song downloaded successfully:', finalAudioUrl);
        } catch (error) {
          console.error('Error downloading external song:', error);
          setIsLoading(false);
          setCurrentSong(previousSong);
          return false;
        } finally {
          setIsLoading(false);
        }
      }
      
      // Try to load and play the song
      const success = await audioManager.loadAudio(
        finalAudioUrl, 
        true, 
        {
          title: nextSong.title,
          artist: nextSong.artist,
          artwork: nextSong.artwork,
          duration: nextSong.duration
        }
      );
      
      // If loading failed, restore previous UI state and clean up
      if (!success) {
        console.error('Failed to load next song, reverting UI state');
        setCurrentSong(previousSong);
        
        // Clean up downloaded file if external song
        if (isExternalSong) {
          try {
            const fileUri = finalAudioUrl.replace('file://', '');
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
            console.log('Cleaned up temporary audio file');
          } catch (cleanupError) {
            console.error('Error cleaning up temporary file:', cleanupError);
          }
        }
        
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error playing next song:', error);
      return false;
    } finally {
      // Allow a small delay before clearing transition flag
      // to prevent rapid button presses from causing issues
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 250);
    }
  }, [currentSong, queue, audioManager, repeatMode, recommendations]);
  
  // Store playNext in ref to avoid circular dependencies
  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);
  
  // Play the previous song in queue with improved synchronization
  const playPrevious = useCallback(async () => {
    // Prevent concurrent transitions
    if (isTransitioningRef.current) {
      console.log('Song transition already in progress, ignoring previous request');
      return false;
    }
    
    // Mark as transitioning
    isTransitioningRef.current = true;
    
    try {
      // Validate queue state
      if (!currentSong || queue.length === 0) {
        return false;
      }
      console.log("QUEUE",queue)
      
      // If track position is past threshold, just restart current song
      if (currentTime > AUDIO_CONSTANTS.SEEK_RESTART_THRESHOLD) {
        setCurrentTime(0);
        await audioManager.seek(0);
        return true;
      }
      
      // Find current position
      const currentIndex = queue.findIndex(song => song.id === currentSong.id);
      if (currentIndex === -1) {
        return false;
      }
      
      // Get previous song (wrap around if needed)
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      const prevSong = queue[prevIndex];
      
      // If no audio URL, can't play
      if (!prevSong.audioUrl) {
        return false;
      }
      
      // Remember current song in case we need to revert UI
      const originalSong = currentSong;
      
      // Update UI state first
      setCurrentSong(prevSong);
      setCurrentTime(0);
      
      // Try to load and play the song
      const success = await audioManager.loadAudio(prevSong.audioUrl, true);
      
      // If loading failed, restore previous UI state
      if (!success) {
        console.error('Failed to load previous song, reverting UI state');
        setCurrentSong(originalSong);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error playing previous song:', error);
      return false;
    } finally {
      // Allow a small delay before clearing transition flag
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 250);
    }
  }, [currentSong, currentTime, queue, audioManager]);
  
  // Toggle repeat without debounce
  const toggleRepeat = useCallback(() => {
    const newRepeatMode = !repeatMode;
    setRepeatMode(newRepeatMode);
    
    // Update audio manager's loop setting
    audioManager.setLooping(newRepeatMode);
    
    // Log for debugging
    console.log('Repeat mode toggled to:', newRepeatMode);
  }, [repeatMode, audioManager]);
  
  // Update sound loop mode when repeatMode changes
  useEffect(() => {
    // Apply loop mode setting to current sound
    if (audioManagerRef.current && currentSong) {
      console.log('Updating sound loop mode to:', repeatMode);
      audioManagerRef.current.setLooping(repeatMode)
        .then((success: boolean) => console.log('Loop mode update result:', success))
        .catch((error: Error) => console.error('Failed to update loop mode:', error));
    }
  }, [repeatMode, currentSong]);
  
  // Seek to a specific time
  const seekTo = useCallback((time: number) => {
    if (!currentSong) return;
    
    // Set seeking flag to prevent onPlaybackStatusUpdate from changing currentTime
    isSeekingRef.current = true;
    
    const milliseconds = Math.max(0, Math.min(time, currentSong.duration || 0)) * 1000;
    audioManager.seek(milliseconds)
      .then(() => {
        // Update currentTime manually
        setCurrentTime(time);
        // Give some time for the seek to complete before allowing updates again
        setTimeout(() => {
          isSeekingRef.current = false;
        }, 500); // 500ms should be enough for most seek operations to settle
      })
      .catch((error) => {
        console.error('Error during seek:', error);
        isSeekingRef.current = false;
      });
    
    console.log("SEEK TO", time);
  }, [currentSong, audioManager]);
  
  // Pause playback
  const pauseSong = useCallback(() => {
    audioManager.pause();
  }, [audioManager]);
  
  // Resume playback
  const resumeSong = useCallback(() => {
    if (currentSong?.audioUrl) {
      audioManager.play();
    }
  }, [currentSong, audioManager]);
  
  // Fetch song by ID
  const fetchSongById = useCallback(async (id: string): Promise<Song | null> => {
    try {
      setIsLoading(true);
      return await musicApi.getSongDetails(id);
    } catch (error) {
      console.error(`Error fetching song with ID ${id}:`, error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Fetch artist songs
  const fetchArtistSongs = useCallback(async (id: string): Promise<Song[]> => {
    try {
      setIsLoading(true);
      return await musicApi.getArtistSongs(id);
    } catch (error) {
      console.error(`Error fetching songs for artist with ID ${id}:`, error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Update media session metadata when song changes
  useEffect(() => {
    if (!currentSong) return;
    
    // Update MediaSession metadata for web browsers
    if ('mediaSession' in navigator && Platform.OS === 'web') {
      // console.log('Updating MediaSession metadata for:', currentSong.title);
      
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title || 'Unknown Title',
          artist: currentSong.artist || 'Unknown Artist',
          album: currentSong.album || 'Unknown Album',
          artwork: [
            { src: currentSong.artwork, sizes: '512x512', type: 'image/jpeg' }
          ]
        });
        
        // Update or set handlers each time metadata changes
        navigator.mediaSession.setActionHandler('play', () => {
          console.log('MediaSession: play action triggered');
          resumeSong();
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
          console.log('MediaSession: pause action triggered');
          pauseSong();
        });
        
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          console.log('MediaSession: previous track action triggered');
          playPrevious();
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          console.log('MediaSession: next track action triggered');
          playNext();
        });
        
        // console.log('MediaSession metadata and handlers updated successfully');
      } catch (error) {
        console.error('Failed to update MediaSession metadata:', error);
      }
    }
    
    // Setup native platform controls
    if (Platform.OS !== 'web') {
      setupNativeMediaControls();
    }
  }, [currentSong, resumeSong, pauseSong, playNext, playPrevious]);
  
  // Setup native platform media controls
  const setupNativeMediaControls = useCallback(() => {
    if (!currentSong) return;
    
    // For iOS and Android using the Audio API
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // In a real implementation, we would use the native media session API
        // This is a placeholder for the actual implementation
        Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: 1, // Audio.InterruptionModeIOS.DoNotMix
          interruptionModeAndroid: 1, // Audio.InterruptionModeAndroid.DoNotMix
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        
        // The actual implementation depends on the expo-av version
        // For more recent versions, Expo provides RegisterRemoteControlEvents or similar
      }
    } catch (error) {
      console.error('Error setting up native media controls:', error);
    }
  }, [currentSong]);
  
  // Set up media controls callbacks
  useEffect(() => {
    if (!audioManager.setMediaControlCallbacks) return;
    
    audioManager.setMediaControlCallbacks({
      onNext: async () => {
        console.log('Media controls: Next track');
        playNext();
      },
      onPrevious: async () => {
        console.log('Media controls: Previous track');
        playPrevious();
      }
    });
  }, [audioManager, playNext, playPrevious]);
  
  // Set up context value
  const contextValue: MusicContextType = {
    currentSong,
    isPlaying,
    currentTime,
    queue,
    currentPlaylist,
    topSongs,
    topArtists,
    albumSongs,
    isShuffle,
    isLoading,
    repeatMode,
    recommendations,
    playSong,
    pauseSong,
    resumeSong,
    playNext,
    playPrevious,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    setCurrentTime,
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