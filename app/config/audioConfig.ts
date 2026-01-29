import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Enhanced audio configuration for background playback
export async function setupAudioConfig() {
  try {
    // Configure audio mode for background playback
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: 1, // Audio.InterruptionModeIOS.DoNotMix
      interruptionModeAndroid: 1, // Audio.InterruptionModeAndroid.DoNotMix
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    
    // Enable audio on non-web platforms
    if (Platform.OS !== 'web') {
      await Audio.setIsEnabledAsync(true);
      
      // On Android, requesting audio focus keeps the app
      // from being killed when in the background
      if (Platform.OS === 'android') {
        console.log('Configuring Android audio for background playback');
        // This is handled by the Audio.setAudioModeAsync configuration above
      }
      
      // On iOS, we need to ensure background audio capability
      // This should be configured in app.json too
      if (Platform.OS === 'ios') {
        console.log('Configuring iOS audio for background playback');
        // Handled by app.json configuration and Audio.setAudioModeAsync above
      }
    }
  } catch (error) {
    console.error('Error setting up audio configuration:', error);
  }
}

export async function teardownAudioConfig() {
  try {
    if (Platform.OS !== 'web') {
      await Audio.setIsEnabledAsync(false);
      
      // Release audio focus on Android when shutting down
      if (Platform.OS === 'android') {
        // Additional cleanup for Android if needed
      }
    }
  } catch (error) {
    console.error('Error tearing down audio configuration:', error);
  }
}

export const AUDIO_CONSTANTS = {
  REPEAT_BUTTON_COOLDOWN: 500, // ms
  SHUFFLE_BUTTON_COOLDOWN: 500, // ms
  SEEK_RESTART_THRESHOLD: 3, // seconds
  TRANSITION_TIMEOUT: 300, // ms - timeout for song transitions
}; 