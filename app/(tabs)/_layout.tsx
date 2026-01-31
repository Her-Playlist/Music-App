import React from 'react';
import { Tabs } from 'expo-router';
import { Library, Search, User, HomeIcon } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import MusicPlayerBar from '../../components/music/MusicPlayerBar';
import { useTheme } from '../../hooks/useTheme';

type TabIconProps = {
  color: string;
  size: number;
};

export default function TabLayout() {
  const { isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#fff' }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? '#121212' : '#fff',
            borderTopColor: isDark ? '#222' : '#eee',
            height: 55,
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
      <MusicPlayerBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
