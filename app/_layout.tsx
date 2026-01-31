import React, { useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StatusBar as RNStatusBar, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAudioModeAsync } from 'expo-audio';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { MusicProvider } from '../components/music/MusicContext';
import MediaSessionManager from '../components/music/MediaSessionManager';
import { NetworkProvider } from '../components/NetworkContext';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import * as NavigationBar from 'expo-navigation-bar';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ff0000', padding: 20 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>ERROR CAUGHT:</Text>
          <Text style={{ color: '#fff', marginTop: 10 }}>{this.state.error?.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Configure audio mode globally on app start
const configureAudio = async () => {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  } catch (error) {
    console.warn('Failed to configure audio mode:', error);
  }
};

// Create a separate component for content that needs the theme
function ThemedContent() {
  const { isDark } = useTheme();

  // Calculate the status bar height
  const statusBarHeight = Platform.OS === 'ios' ? 44 : RNStatusBar.currentHeight || 0;

  // Set navigation bar color (Android only)
  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        // Set navigation bar button style only (setBackgroundColorAsync is not supported with edge-to-edge)
        NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
      } catch (error) {
        console.warn('Failed to set navigation bar style:', error);
      }
    }
  }, [isDark]);
  return (
    <ErrorBoundary>
      <NetworkProvider>
        <ErrorBoundary>
          <MusicProvider>
            <>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: {
                    paddingTop: Platform.OS === 'ios' ? 0 : statusBarHeight,
                    backgroundColor: isDark ? '#121212' : '#FFFFFF'
                  }
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar
                style={isDark ? "light" : "dark"}
                backgroundColor={isDark ? '#121212' : '#FFFFFF'}
                translucent={false}
              />
              <MediaSessionManager />
            </>
          </MusicProvider>
        </ErrorBoundary>
      </NetworkProvider>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  const isReady = useFrameworkReady();

  // Configure audio mode on app start
  useEffect(() => {
    if (isReady) {
      configureAudio();
    }
  }, [isReady]);
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
