import React, { createContext, useState, useContext, ReactNode, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { useAudioManager } from '../../hooks/useAudioManager';
import { setupAudioConfig, teardownAudioConfig, AUDIO_CONSTANTS } from '../../config/audioConfig';
import * as musicApi from '../../services/musicApi';
import { Paths, File } from 'expo-file-system';

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
  const topSongs: any[] = [];
  const topArtists: any[] = [];
  const albumSongs: any[] = [];
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
  const fetcher = useCallback(async () => {
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
      const newRecommendations = await musicApi.getRecommendations(currentSong?.id);

      if (newRecommendations.length > 0) {
        setRecommendations(newRecommendations);
      }
    }
  }, [currentSong, recommendations]);

  useEffect(() => {
    if (currentSong) {
      currentSongRef.current = currentSong;
      fetcher();
    }
  }, [currentSong, fetcher]);

  // Update repeatModeRef whenever repeatMode changes
  useEffect(() => {
    repeatModeRef.current = repeatMode;
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
        return;
      }

      // Get the latest repeat mode from ref
      const currentRepeatMode = repeatModeRef.current;

      if (currentRepeatMode) {
        // Just restart the current song
        if (currentSongFromRef?.audioUrl && audioManagerRef.current) {
          try {
            // Use explicit seek to beginning then restart approach
            audioManagerRef.current.seek(0).then(() => {
              audioManagerRef.current.play().then((playSuccess: boolean) => {
                // Play after seek successful
              }).catch((playError: Error) => {
                console.error('Error playing after seek:', playError);

                // Fall back to full reload as last resort
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
              ).catch((error: Error) => {
                console.error('Error with original reload approach:', error);
              });
            });
          } catch (error) {
            console.error('Error in repeat mode restart sequence:', error);
          }
        }
      } else {
        // Play the next song
        // Set autoPlay flag to true to indicate this is automatic playback
        // Make sure to call the actual function, not just reference it
        if (playNextRef.current) {
          songEndAutoplayRef.current = true;
          playNextRef.current(true).then(success => {
            songEndAutoplayRef.current = false;
          }).catch(error => {
            console.error('Auto-play next error:', error);
            songEndAutoplayRef.current = false;
          });
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

      let songs: Song[] = [];

      // If songs are provided in playlistData, use them directly
      if (playlistData.songs && playlistData.songs.length > 0) {
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
        setIsLoading(false);
        return;
      }

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
        // If we have a current song, place it at the front
        if (previousSong) {
          // Find the song in the new playlist
          const songInNewPlaylist = songs.find(song => song.id === previousSong.id);

          if (songInNewPlaylist) {
            // Create a new array with current song first, then the rest
            const currentSongIndex = songs.findIndex(song => song.id === previousSong.id);

            // Remove current song from its original position
            const songsCopy = [...songs];
            songsCopy.splice(currentSongIndex, 1);

            // Place it at the beginning
            const newQueue = [songInNewPlaylist, ...songsCopy];
            setQueue(newQueue);
          } else {
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

          // Create a new queue starting from the current song
          // If shuffle is ON, just ensure current song is first and shuffle the rest
          if (isShuffle) {
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
            const newQueue = [
              ...songs.slice(currentIndex),
              ...songs.slice(0, currentIndex)
            ];
            setQueue(newQueue);
          }
        } else {
          // If no current song or not in playlist, just set the queue
          // If shuffle is on, shuffle the new queue
          if (isShuffle && songs.length > 1) {
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
      return;
    }

    // Step 1: Find current song index
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    if (currentIndex === -1) {
      return;
    }

    // Step 2: Create a copy of all songs except current one
    const songsToShuffle = [...queue];
    const currentSongCopy = { ...songsToShuffle[currentIndex] };
    songsToShuffle.splice(currentIndex, 1);

    // Step 3: Fisher-Yates shuffle algorithm for all remaining songs
    for (let i = songsToShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songsToShuffle[i], songsToShuffle[j]] = [songsToShuffle[j], songsToShuffle[i]];
    }

    // Step 4: Create a new queue with current song at the beginning
    // and all other songs fully shuffled after it
    const newQueue = [currentSongCopy, ...songsToShuffle];

    // Step 5: Update the queue
    setQueue(newQueue);
  }, [currentSong, queue]);

  // Toggle shuffle with proper dependencies
  const toggleShuffle = useCallback(() => {
    const newShuffleState = !isShuffle;
    setIsShuffle(newShuffleState);

    if (newShuffleState) {
      // Shuffle the entire queue and move current song to first position
      shuffleRemainingQueue();
    } else if (currentPlaylist) {
      // Restore original order when shuffle is turned off

      // Store the current song before restoring order
      const currentSongBeforeRestore = currentSong;

      // Restore original order
      updateQueue({
        id: currentPlaylist.id,
        name: currentPlaylist.name,
        type: currentPlaylist.type
      })
        .then(() => {
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

                // Pull out current song
                const currentSongCopy = { ...restoredQueue[currentSongIndex] };

                // Remove current song from its current position
                restoredQueue.splice(currentSongIndex, 1);

                // Add it to the beginning
                const updatedQueue = [currentSongCopy, ...restoredQueue];

                // Update the queue
                setQueue(updatedQueue);
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
    if (!song.audioUrl) {
      console.error('Cannot play song without audio URL:', song.id);
      return false;
    }

    if (isSingleSong) {
      setCurrentPlaylist(null);
      setQueue([]);
    }

    // Update current song state immediately for UI responsiveness
    setCurrentSong(song);
    setCurrentTime(0);

    let finalAudioUrl = song.audioUrl;

    // If this is an external song, download it first
    if (external) {
      try {
        setIsLoading(true);

        // Create a unique filename
        const filename = `audio-${song.id}-${Date.now()}.mp3`;
        const cacheFile = new File(Paths.cache, filename);

        // Download the file
        await File.downloadFileAsync(
          `https://song-backend-dawa.vercel.app/api/song?url=${song.audioUrl}`,
          cacheFile,
          { idempotent: true }
        );

        // Use the local file URI for playback
        finalAudioUrl = cacheFile.uri;
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
          const filename = finalAudioUrl.split('/').pop() || '';
          const cacheFile = new File(Paths.cache, filename);
          await cacheFile.delete();
        } catch (cleanupError) {
          console.error('Error cleaning up temporary file:', cleanupError);
        }
      }
      return false;
    }
  }, [audioManager]);

  // Play the next song in queue with improved synchronization
  const playNext = useCallback(async (isAutoPlay = false) => {
    // Prevent concurrent transitions
    if (isTransitioningRef.current) {
      return false;
    }

    // Mark as transitioning
    isTransitioningRef.current = true;

    try {
      // Validate queue state
      if (!currentSong || queue.length === 0) {
        if (recommendations.length > 0) {
          const previousSong = currentSong;

          // Find current song in recommendations to play the next one sequentially
          let nextSong;
          if (currentSong) {
            const currentSongIndexInRecommendations = recommendations.findIndex(song => song.id === currentSong.id);

            if (currentSongIndexInRecommendations !== -1 && currentSongIndexInRecommendations < recommendations.length - 1) {
              // Play the next song in recommendations sequence
              nextSong = recommendations[currentSongIndexInRecommendations + 1];
            } else {
              // If current song not in recommendations or at the end, play the first recommendation
              nextSong = recommendations[0];
            }
          } else {
            // If no current song, start from the first recommendation
            nextSong = recommendations[0];
          }

          setCurrentSong(nextSong);

          let finalAudioUrl = nextSong.audioUrl;
          const isExternalSong = nextSong?.type === "youtube";

          // If this is an external song, download it first
          if (isExternalSong) {
            try {
              setIsLoading(true);

              // Create a unique filename
              const filename = `audio-${nextSong.id}-${Date.now()}.mp3`;
              const cacheFile = new File(Paths.cache, filename);

              // Download the file
              await File.downloadFileAsync(
                `https://song-backend-dawa.vercel.app/api/song?url=${nextSong.audioUrl}`,
                cacheFile,
                { idempotent: true }
              );

              // Use the local file URI for playback
              finalAudioUrl = cacheFile.uri;
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
                const filename = finalAudioUrl.split('/').pop() || '';
                const cacheFile = new File(Paths.cache, filename);
                await cacheFile.delete();
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
        return false;
      }

      // Check if we're at the end of the queue
      const isLastSong = currentIndex === queue.length - 1;

      // Handle loop mode for last song
      if (isLastSong && !repeatMode) {
        if (!isAutoPlay) {
          // If manual skip on last song, just stop playback
          audioManager.pause();
        }
        return false;
      }

      // Get the next song
      const nextIndex = (currentIndex + 1) % queue.length;
      const nextSong = queue[nextIndex];

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

          // Create a unique filename
          const filename = `audio-${nextSong.id}-${Date.now()}.mp3`;
          const cacheFile = new File(Paths.cache, filename);

          // Download the file
          await File.downloadFileAsync(
            `https://song-backend-dawa.vercel.app/api/song?url=${nextSong.audioUrl}`,
            cacheFile,
            { idempotent: true }
          );

          // Use the local file URI for playback
          finalAudioUrl = cacheFile.uri;
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
            const filename = finalAudioUrl.split('/').pop() || '';
            const cacheFile = new File(Paths.cache, filename);
            await cacheFile.delete();
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
      return false;
    }

    // Mark as transitioning
    isTransitioningRef.current = true;

    try {
      // Validate queue state
      if (!currentSong || queue.length === 0) {
        return false;
      }

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
  }, [repeatMode, audioManager]);

  // Update sound loop mode when repeatMode changes
  useEffect(() => {
    // Apply loop mode setting to current sound
    if (audioManagerRef.current && currentSong) {
      audioManagerRef.current.setLooping(repeatMode)
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

  // Setup native platform media controls
  const setupNativeMediaControls = useCallback(() => {
    if (!currentSong) return;

    // Audio mode is now configured in useAudioManager
    // No additional setup needed here
  }, [currentSong]);

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
          resumeSong();
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          pauseSong();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          playPrevious();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          playNext();
        });
      } catch (error) {
        console.error('Failed to update MediaSession metadata:', error);
      }
    }

    // Setup native platform controls
    if (Platform.OS !== 'web') {
      setupNativeMediaControls();
    }
  }, [currentSong, resumeSong, pauseSong, playNext, playPrevious, setupNativeMediaControls]);

  // Set up media controls callbacks
  useEffect(() => {
    if (!audioManager.setMediaControlCallbacks) return;

    audioManager.setMediaControlCallbacks({
      onNext: async () => {
        playNext();
      },
      onPrevious: async () => {
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
