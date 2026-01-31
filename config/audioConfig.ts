// Enhanced audio configuration for background playback
// Note: Audio mode configuration is now handled in _layout.tsx
export async function setupAudioConfig() {
  try {
    // Audio configuration for background playback
  } catch (error) {
    console.error('Error setting up audio configuration:', error);
  }
}

export async function teardownAudioConfig() {
  try {
    // Cleanup handled by app lifecycle
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
