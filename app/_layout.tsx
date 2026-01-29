import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { MusicProvider } from './components/music/MusicContext';
import MediaSessionManager from './components/music/MediaSessionManager';
import { NetworkProvider } from './components/NetworkContext';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import * as NavigationBar from 'expo-navigation-bar';

// Create a separate component for content that needs the theme
function ThemedContent() {
  const { isDark } = useTheme();

  // Calculate the status bar height
  const statusBarHeight = Platform.OS === 'ios' ? 44 : RNStatusBar.currentHeight || 0;

  // Set navigation bar color (Android only)
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Set navigation bar color and button style
      NavigationBar.setBackgroundColorAsync(isDark ? '#121212' : '#FFFFFF');
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
    }
  }, [isDark]);

  return (
    <NetworkProvider>
      <MusicProvider>
        <>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                paddingTop: Platform.OS === 'ios' ? 0 : statusBarHeight
              }
            }}
          >
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar
            style={isDark ? "light" : "dark"}
            backgroundColor={isDark ? '#121212' : '#FFFFFF'}
            translucent={true}
          />
          <MediaSessionManager />
        </>
      </MusicProvider>
    </NetworkProvider>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
