import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useColorScheme } from 'react-native';
import { Play, Pause, Download, MoreVertical } from 'lucide-react-native';
import { useMusic, Song } from './MusicContext';
import { useTheme } from '@/app/hooks/useTheme';

interface SongItemProps {
  song: Song;
  showArtwork?: boolean;
  showAlbum?: boolean;
  showDuration?: boolean;
  showDownload?: boolean;
  showMoreOptions?: boolean;
  onPress?: () => void;
}

export default function SongItem({
  song,
  showArtwork = true,
  showAlbum = true,
  showDuration = false,
  showDownload = false,
  showMoreOptions = false,
  onPress,
}: SongItemProps) {
  const colorScheme = useColorScheme();
  const { isDark } = useTheme();
  
  const { 
    currentSong, 
    isPlaying, 
    downloadedSongs,
    isDownloading,
    downloadProgress,
    playSong,
    pauseSong,
    resumeSong,
    downloadSong,
  } = useMusic();
  
  // Check if this song is the current playing song
  const isCurrentSong = currentSong?.id === song.id;
  
  // Check if this song is downloaded
  const isDownloaded = downloadedSongs.includes(song.id);
  
  // Check if this song is currently downloading
  const isCurrentlyDownloading = isDownloading === song.id;
  
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle play/pause
  const handlePlayPause = () => {
    if (isCurrentSong) {
      if (isPlaying) {
        pauseSong();
      } else {
        resumeSong();
      }
    } else {
      playSong(song);
    }
  };
  
  // Handle song selection
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      playSong(song);
    }
  };
  
  // Handle download
  const handleDownload = () => {
    if (!isDownloaded && !isCurrentlyDownloading) {
      downloadSong(song.id);
    }
  };
  
  return (
    <TouchableOpacity
      style={[styles.container, isDark && styles.darkBorder]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {showArtwork && (
        <Image source={{ uri: song.artwork }} style={styles.artwork} />
      )}
      
      <View style={styles.info}>
        <Text 
          style={[
            styles.title, 
            isDark && styles.darkText,
            isCurrentSong && styles.activeText
          ]}
          numberOfLines={1}
        >
          {song.title}
        </Text>
        
        <Text 
          style={[styles.artist, isDark && styles.darkSubtext]}
          numberOfLines={1}
        >
          {song.artist} {showAlbum ? `• ${song.album}` : ''}
        </Text>
      </View>
      
      <View style={styles.actions}>
        {showDuration && (
          <Text style={[styles.duration, isDark && styles.darkSubtext]}>
            {formatDuration(song.duration)}
          </Text>
        )}
        
        {showDownload && (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleDownload}
            disabled={isDownloaded}
          >
            {isCurrentlyDownloading ? (
              <View style={styles.downloadProgress}>
                <View 
                  style={[
                    styles.downloadProgressFill, 
                    { width: `${downloadProgress * 100}%` }
                  ]} 
                />
              </View>
            ) : isDownloaded ? (
              <Download size={20} color="#E53935" fill="#E53935" />
            ) : (
              <Download size={20} color={isDark ? '#aaa' : '#777'} />
            )}
          </TouchableOpacity>
        )}
        
        {showMoreOptions && (
          <TouchableOpacity style={styles.iconButton}>
            <MoreVertical size={20} color={isDark ? '#aaa' : '#777'} />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[
            styles.playButton,
            isCurrentSong && isPlaying && styles.playingButton
          ]}
          onPress={handlePlayPause}
        >
          {isCurrentSong && isPlaying ? (
            <Pause size={16} color="#fff" />
          ) : (
            <Play size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkBorder: {
    borderBottomColor: '#333',
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 4,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
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
    color: '#999',
  },
  activeText: {
    color: '#E53935',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duration: {
    fontSize: 12,
    color: '#666',
    marginRight: 12,
  },
  iconButton: {
    padding: 8,
    marginRight: 4,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingButton: {
    backgroundColor: '#148a41',
  },
  downloadProgress: {
    width: 20,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: 4,
    backgroundColor: '#E53935',
    borderRadius: 2,
  },
}); 