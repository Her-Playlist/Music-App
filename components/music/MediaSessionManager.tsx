import React, { useEffect } from 'react';
import { Platform, AppState } from 'react-native';
import { useMusic } from './MusicContext';

/**
 * Component that manages media controls for notifications
 * This component doesn't render anything but helps with background playback
 * Audio configuration is now handled in useAudioManager hook
 */
export default function MediaSessionManager() {
  const { 
    currentSong, 
    isPlaying, 
    playNext, 
    playPrevious, 
    pauseSong, 
    resumeSong
  } = useMusic();

  // Set up app state listener
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('App state changed to:', nextAppState);
    });
    
    return () => {
      appStateSubscription.remove();
    };
  }, []);
  
  // This component doesn't render anything
  return null;
} 