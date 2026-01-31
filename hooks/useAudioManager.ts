import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Platform, AppState } from 'react-native';

type AVPlaybackStatus = any;

// Setup media controls for native platforms
const setupNativeMediaControls = async (
  player: any,
  playbackActions: {
    play: () => void,
    pause: () => void,
    next: () => Promise<void>,
    prev: () => Promise<void>
  },
  metadata: {
    title?: string,
    artist?: string,
    artwork?: string,
    duration?: number
  }
) => {
  if (!player || Platform.OS === 'web') return;

  try {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // Native media controls setup complete
    }
  } catch (error) {
    console.error('Error setting up native media controls:', error);
  }
};

// Improved audio manager with better synchronization
export function useAudioManager(onPlaybackStatusUpdate: (status: AVPlaybackStatus) => void) {
  // Use the expo-audio hook to create the player
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Track playback state
  const [isPlaying, setIsPlaying] = useState(false);

  // Track current audio source for comparison
  const currentUri = useRef<string | null>(null);

  // Track media metadata for controls
  const mediaMetadata = useRef<{
    title?: string,
    artist?: string,
    artwork?: string,
    duration?: number
  }>({});

  // Track operation state to prevent concurrent operations
  const isOperationInProgress = useRef<boolean>(false);

  // Refs for media control handlers
  const handleNextRef = useRef<() => Promise<void>>(async () => {
    // Next track requested via media controls
  });

  const handlePreviousRef = useRef<() => Promise<void>>(async () => {
    // Previous track requested via media controls
  });

  // Note: Audio mode is now configured in _layout.tsx

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isPlaying && player) {
        // Resume playback when app comes to foreground if it was playing
        if (!player.playing) {
          player.play();
        }
      }
    });

    return () => {
      handleAppStateChange.remove();
    };
  }, [isPlaying, player]);

  // Update playback status when status changes
  useEffect(() => {
    const mappedStatus = {
      isLoaded: player.isLoaded,
      isPlaying: player.playing,
      positionMillis: (status.currentTime || 0) * 1000,
      durationMillis: (status.duration || 0) * 1000,
      didJustFinish: status.currentTime === status.duration && status.duration > 0,
    };

    setIsPlaying(player.playing);
    onPlaybackStatusUpdate(mappedStatus);
  }, [status, player.isLoaded, player.playing, onPlaybackStatusUpdate]);

  // Load and optionally play audio with synchronization
  const loadAudio = useCallback(async (
    uri: string,
    autoplay = true,
    metadata?: {
      title?: string,
      artist?: string,
      artwork?: string,
      duration?: number
    }
  ): Promise<boolean> => {
    if (!uri) {
      console.error('Invalid audio URI');
      return false;
    }

    // Check if the URI is valid
    try {
      const response = await fetch(uri, { method: 'HEAD' });
      if (!response.ok) {
        console.error('Audio URL fetch failed with status:', response.status);
        return false;
      }
    } catch (networkError) {
      console.error('Network error when testing audio URL:', networkError);
    }

    // Save metadata for media controls
    if (metadata) {
      mediaMetadata.current = metadata;
    }

    // Prevent concurrent operations
    if (isOperationInProgress.current) {
      // Wait for pending operation to finish (with timeout)
      let attempts = 0;
      while (isOperationInProgress.current && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }

      // If still busy after waiting, fail gracefully
      if (isOperationInProgress.current) {
        console.error('Audio system busy, cannot load new audio');
        return false;
      }
    }

    // Mark operation as in progress
    isOperationInProgress.current = true;

    try {
      // Fast path: if we're loading the same URI and it's already loaded, just control playback
      if (uri === currentUri.current && player.isLoaded) {
        if (autoplay && !player.playing) {
          player.play();
          return true;
        } else if (!autoplay && player.playing) {
          player.pause();
          return true;
        }
        return true;
      }

      // Load new audio source using replace() instead of loadAsync()
      await player.replace({ uri });
      currentUri.current = uri;

      // Play if autoplay is enabled
      if (autoplay) {
        player.play();
      }

      // Set up media controls with the latest metadata
      setupNativeMediaControls(
        player,
        {
          play: () => player.play(),
          pause: () => player.pause(),
          next: handleNextRef.current,
          prev: handlePreviousRef.current
        },
        mediaMetadata.current
      );

      return true;
    } catch (error) {
      console.error('Failed to load audio:', error);
      return false;
    } finally {
      // Clear operation flag
      setTimeout(() => {
        isOperationInProgress.current = false;
      }, 100);
    }
  }, [player]);

  // Play the current audio with synchronization
  const play = useCallback(async (): Promise<boolean> => {
    if (isOperationInProgress.current) {
      return false;
    }

    isOperationInProgress.current = true;

    try {
      if (!player.isLoaded) return false;

      player.play();
      return true;
    } catch (error) {
      console.error('Failed to play audio:', error);
      return false;
    } finally {
      isOperationInProgress.current = false;
    }
  }, [player]);

  // Pause the current audio with synchronization
  const pause = useCallback(async (): Promise<boolean> => {
    if (isOperationInProgress.current) {
      return false;
    }

    isOperationInProgress.current = true;

    try {
      if (!player.isLoaded || !player.playing) return false;

      player.pause();
      return true;
    } catch (error) {
      console.error('Failed to pause audio:', error);
      return false;
    } finally {
      isOperationInProgress.current = false;
    }
  }, [player]);

  // Seek to a specific position with synchronization
  const seek = useCallback(async (positionMillis: number): Promise<boolean> => {
    if (!player.isLoaded) return false;

    try {
      const seconds = positionMillis / 1000;
      await player.seekTo(seconds);
      return true;
    } catch (error) {
      console.error('Failed to seek:', error);
      return false;
    }
  }, [player]);

  // Set or toggle loop mode
  const setLooping = useCallback(async (shouldLoop: boolean): Promise<boolean> => {
    // expo-audio doesn't have built-in looping through the player object
    // This would need to be handled at the app level
    return true;
  }, []);

  // Get current playback position (useful for sync checks)
  const getCurrentPosition = useCallback(async (): Promise<number> => {
    try {
      return (status.currentTime || 0) * 1000;
    } catch (error) {
      console.error('Failed to get position:', error);
      return 0;
    }
  }, [status]);

  // Set handlers for next/previous track (to be called from parent component)
  const setMediaControlCallbacks = useCallback((callbacks: {
    onNext?: () => Promise<void>,
    onPrevious?: () => Promise<void>
  }) => {
    if (callbacks.onNext) {
      handleNextRef.current = callbacks.onNext;
    }
    if (callbacks.onPrevious) {
      handlePreviousRef.current = callbacks.onPrevious;
    }
  }, []);

  return {
    isPlaying,
    loadAudio,
    play,
    pause,
    seek,
    setLooping,
    getCurrentPosition,
    setMediaControlCallbacks
  };
}
