import React, { useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useColorScheme, GestureResponderEvent } from 'react-native';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react-native';
import { router } from 'expo-router';
import { useMusic } from './MusicContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/app/hooks/useTheme';

const MusicPlayerBar = memo(() => {
  const colorScheme = useColorScheme();
  const { isDark } = useTheme();
  
  const { 
    currentSong, 
    isPlaying,
    currentTime,
    pauseSong, 
    resumeSong, 
    playNext, 
    playPrevious,
  } = useMusic();
  
  if (!currentSong) return null;
  
  // Progress calculation
  const progress = currentTime / (currentSong.duration || 1);

  // Debounce touch handler to prevent rapid multiple touches
  const handlePlayPause = (() => {
    if (isPlaying) {
      pauseSong();
    } else {
      resumeSong();
    }
  });

  const handlePrevious = (() => {
    playPrevious();
  });

  const handleNext = (() => {
    playNext(false); // false indicates user initiated (not auto-play)
  });
  
  const navigateToPlayer = () => {
    router.push('/player');
  };

  return (
    <TouchableOpacity 
      style={[styles.container, isDark && styles.darkContainer]}
      activeOpacity={0.9}
      onPress={navigateToPlayer}
    >
      <LinearGradient
        colors={isDark ? ['#303030', '#282828'] : ['#f8f8f8', '#f2f2f2']}
        style={styles.gradient}
      >
        <View style={styles.contentRow}>
          <Image source={{ uri: currentSong.artwork }} style={styles.artwork} />
          <View style={styles.songInfo}>
            <Text style={[styles.title, isDark && styles.darkText]} numberOfLines={1}>
              {currentSong.title}
            </Text>
            <Text style={[styles.artist, isDark && styles.darkSubtext]} numberOfLines={1}>
              {currentSong.artist}
            </Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity 
              onPress={handlePrevious} 
              style={styles.controlButton}
              activeOpacity={0.6}
              hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
            >
              <SkipBack size={20} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handlePlayPause} 
              style={styles.playButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              {isPlaying ? (
                <Pause size={20} color="#fff" />
              ) : (
                <Play size={20} color="#fff" style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleNext} 
              style={styles.controlButton}
              activeOpacity={0.6}
              hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
            >
              <SkipForward size={20} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Progress bar at bottom (visual only) */}
        <View style={[styles.progressBg, isDark && styles.darkProgressBg]}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${progress * 100}%` }
            ]} 
          />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

MusicPlayerBar.displayName = 'MusicPlayerBar';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  darkContainer: {
    borderTopColor: '#333',
  },
  gradient: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 13, // Extra padding to account for progress bar
  },
  progressBg: {
    height: 3,
    backgroundColor: '#e0e0e0',
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  darkProgressBg: {
    backgroundColor: '#333',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#E53935',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  artist: {
    fontSize: 12,
    color: '#666',
  },
  darkText: {
    color: '#fff',
  },
  darkSubtext: {
    color: '#aaa',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    padding: 8,
    marginHorizontal: 2,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  }
});

export default MusicPlayerBar; 