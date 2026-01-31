import React from 'react';
import { Tabs } from 'expo-router';
import { Library, Search, User, HomeIcon } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import MusicPlayerBar from '../components/music/MusicPlayerBar';
import { useMusic } from '../components/music/MusicContext';
import { useTheme } from '../hooks/useTheme';

type TabIconProps = {
  color: string;
  size: number;
};

export default function TabLayout() {
  const { isDark } = useTheme();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? '#121212' : '#fff',
            borderTopColor: isDark ? '#222' : '#eee',
            height: 55,
            // Add bottom padding when needed
            paddingBottom: 0,
          },
          tabBarActiveTintColor: '#E53935',
          tabBarInactiveTintColor: isDark ? '#777' : '#666',
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }: TabIconProps) => <HomeIcon size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size }: TabIconProps) => <Search size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, size }: TabIconProps) => <Library size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }: TabIconProps) => <User size={size} color={color} />,
          }}
        />
      </Tabs>
      
      {/* Position the music player bar above the tab bar */}
      <View style={styles.playerContainer}>
        <MusicPlayerBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  playerContainer: {
    position: 'absolute',
    bottom: 55, // Height of the tab bar
    left: 0,
    right: 0,
    zIndex: 100, // Make sure it's above other content
  }
});