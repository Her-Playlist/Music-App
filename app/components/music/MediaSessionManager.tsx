import React, { useEffect } from 'react';
import { Platform, AppState } from 'react-native';
import { Audio } from 'expo-av';
import { useMusic } from './MusicContext';

/**
 * Component that manages media controls for notifications
 * This component doesn't render anything but helps with background playback
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

  // Set up audio mode for Android
  useEffect(() => {
    const setupAudio = async () => {
      try {
        if (Platform.OS === 'android') {
          // Configure audio mode for Android
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            interruptionModeIOS: 1, // DoNotMix 
            interruptionModeAndroid: 1, // DoNotMix
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          
          console.log('Android audio mode configured for notifications');
        }
      } catch (error) {
        console.error('Error setting up audio mode:', error);
      }
    };
    
    setupAudio();
    
    // Set up app state listener
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