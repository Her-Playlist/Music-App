import { useState, useEffect, useCallback, useRef } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Platform, AppState } from 'react-native';

// Setup media controls for native platforms
const setupNativeMediaControls = async (
  sound: Audio.Sound | null,
  playbackActions: {
    play: () => Promise<void>,
    pause: () => Promise<void>,
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
  if (!sound || Platform.OS === 'web') return;

  try {
    // We need to use the appropriate methods for the platform
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // In Expo, we use the Audio API's status updates to work with the native OS
      // This won't enable system-level controls by itself
      
      // For true media controls, you'd typically need to use:
      // - MusicControls plugin (Cordova/Capacitor)
      // - react-native-track-player
      // - Or Expo's MediaLibrary API with additional configuration
      
      // The following is just a framework for those implementations
      if (sound) {
        // When we have more specific implementation details
        // we would register the handlers with the OS here
        console.log('Setting up native media controls for:', metadata.title);
      }
    }
  } catch (error) {
    console.error('Error setting up native media controls:', error);
  }
};

// Improved audio manager with better synchronization
export function useAudioManager(onPlaybackStatusUpdate: (status: AVPlaybackStatus) => void) {
  // Single sound instance persisted across component lifecycle
  const sound = useRef<Audio.Sound | null>(null);
  
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
    console.log('Next track requested via media controls');
  });
  
  const handlePreviousRef = useRef<() => Promise<void>>(async () => {
    console.log('Previous track requested via media controls');
  });

  // Initialize sound on mount
  useEffect(() => {
    // Create a sound instance
    const initializeSound = async () => {
      sound.current = new Audio.Sound();
    };
    
    initializeSound();
    
    // Clean up audio resources on unmount
    return () => {
      if (sound.current) {
        sound.current.unloadAsync().catch(e => console.warn("Cleanup error:", e));
        sound.current = null;
      }
    };
  }, []);

  // Configure audio session
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: 1, // Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX
          interruptionModeAndroid: 1, // Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Failed to configure audio session:', error);
      }
    };
    
    setupAudio();
  }, []);
  
  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isPlaying && sound.current) {
        // Resume playback when app comes to foreground if it was playing
        sound.current.getStatusAsync()
          .then(status => {
            if (status.isLoaded && !status.isPlaying) {
              sound.current?.playAsync();
            }
          })
          .catch(error => console.error('Error checking playback status:', error));
      }
    });
    
    return () => {
      handleAppStateChange.remove();
    };
  }, [isPlaying]);

  // Play/pause handlers for media controls
  const playAsync = useCallback(async () => {
    if (sound.current) {
      await sound.current.playAsync();
    }
  }, []);

  const pauseAsync = useCallback(async () => {
    if (sound.current) {
      await sound.current.pauseAsync();
    }
  }, []);

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
    
    // Debug: Log the URI format
    console.log('Loading audio with URI:', uri);

    // Check if the URI is valid
    try {
      // Test if the URL is accessible
      console.log('Testing URL accessibility...');
      const response = await fetch(uri, { method: 'HEAD' });
      console.log('URL fetch status:', response.status, response.statusText);
      if (!response.ok) {
        console.error('Audio URL fetch failed with status:', response.status);
        return false;
      }
    } catch (networkError) {
      console.error('Network error when testing audio URL:', networkError);
      // Continue with loading attempt despite network error
    }
    
    // Save metadata for media controls
    if (metadata) {
      mediaMetadata.current = metadata;
    }
    
    // Prevent concurrent operations
    if (isOperationInProgress.current) {
      console.log('Audio operation already in progress, waiting...');
      
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
      // Update UI state early for responsive UX
      if (autoplay) {
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
      
      // Fast path: if we're loading the same URI and it's already loaded, just control playback
      if (uri === currentUri.current && sound.current) {
        const status = await sound.current.getStatusAsync();
        if (status.isLoaded) {
          if (autoplay && !status.isPlaying) {
            await sound.current.playAsync();
            return true;
          } else if (!autoplay && status.isPlaying) {
            await sound.current.pauseAsync();
            return true;
          }
          return true;
        }
      }
      
      // Always unload existing audio before loading new audio
      if (sound.current) {
        // First stop any playing audio immediately to prevent overlapping
        try {
          const status = await sound.current.getStatusAsync();
          if (status.isLoaded) {
            if (status.isPlaying) {
              await sound.current.stopAsync();
            }
            await sound.current.unloadAsync();
          }
        } catch (error) {
          console.warn('Error unloading previous audio:', error);
          // Continue anyway since we're creating a new sound
        }
      }
      
      // Create a new instance if needed
      if (!sound.current) {
        sound.current = new Audio.Sound();
      }
      
      // Load and play the new audio
      await sound.current.loadAsync(
        { uri },
        {
          shouldPlay: autoplay,
          progressUpdateIntervalMillis: 100, // Frequent updates for UI responsiveness
        }
      );
      
      // Set the status update callback separately
      sound.current.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      
      // Store current URI for fast path checks
      currentUri.current = uri;

      // Set up media controls with the latest metadata
      setupNativeMediaControls(
        sound.current,
        {
          play: playAsync,
          pause: pauseAsync,
          next: handleNextRef.current,
          prev: handlePreviousRef.current
        },
        mediaMetadata.current
      );
      
      return true;
    } catch (error) {
      console.error('Failed to load audio:', error);
      setIsPlaying(false);
      return false;
    } finally {
      // Clear operation flag
      setTimeout(() => {
        isOperationInProgress.current = false;
      }, 100);
    }
  }, [onPlaybackStatusUpdate, playAsync, pauseAsync]);

  // Play the current audio with synchronization
  const play = useCallback(async (): Promise<boolean> => {
    if (isOperationInProgress.current) {
      return false;
    }
    
    isOperationInProgress.current = true;
    
    try {
      if (!sound.current) return false;
      
      const status = await sound.current.getStatusAsync();
      if (!status.isLoaded) return false;
      
      // Update state before operation for responsive UI
      setIsPlaying(true);
      await sound.current.playAsync();
      return true;
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsPlaying(false);
      return false;
    } finally {
      isOperationInProgress.current = false;
    }
  }, []);

  // Pause the current audio with synchronization
  const pause = useCallback(async (): Promise<boolean> => {
    if (isOperationInProgress.current) {
      return false;
    }
    
    isOperationInProgress.current = true;
    
    try {
      if (!sound.current) return false;
      
      const status = await sound.current.getStatusAsync();
      if (!status.isLoaded || !status.isPlaying) return false;
      
      // Update state before operation for responsive UI
      setIsPlaying(false);
      await sound.current.pauseAsync();
      return true;
    } catch (error) {
      console.error('Failed to pause audio:', error);
      return false;
    } finally {
      isOperationInProgress.current = false;
    }
  }, []);

  // Seek to a specific position with synchronization
  const seek = useCallback(async (positionMillis: number): Promise<boolean> => {
    if (!sound.current) return false;
    
    try {
      const status = await sound.current.getStatusAsync();
      if (!status.isLoaded) return false;
      
      await sound.current.setPositionAsync(positionMillis);
      return true;
    } catch (error) {
      console.error('Failed to seek:', error);
      return false;
    }
  }, []);

  // Set or toggle loop mode
  const setLooping = useCallback(async (shouldLoop: boolean): Promise<boolean> => {
    if (!sound.current) return false;
    
    try {
      const status = await sound.current.getStatusAsync();
      if (!status.isLoaded) return false;
      
      await sound.current.setIsLoopingAsync(shouldLoop);
      return true;
    } catch (error) {
      console.error('Failed to set loop mode:', error);
      return false;
    }
  }, []);

  // Get current playback position (useful for sync checks)
  const getCurrentPosition = useCallback(async (): Promise<number> => {
    if (!sound.current) return 0;
    
    try {
      const status = await sound.current.getStatusAsync();
      if (!status.isLoaded) return 0;
      
      return status.positionMillis;
    } catch (error) {
      console.error('Failed to get position:', error);
      return 0;
    }
  }, []);

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