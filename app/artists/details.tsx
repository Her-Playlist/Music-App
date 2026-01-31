import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, ScrollView, useColorScheme, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Play, Pause, Heart } from 'lucide-react-native';
import { useMusic } from '../../components/music/MusicContext';
import apiClient from '../../services/api';
import { useTheme } from '../../hooks/useTheme';

export default function ArtistDetailsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { isDark } = useTheme();
  const { token, artist } = params;
  
  const { playSong, currentSong, isPlaying, pauseSong, resumeSong } = useMusic();
  
  const [artistData, setArtistData] = useState<any>(null);
  const [artistSongs, setArtistSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  
  useEffect(() => {
    if (token) {
      loadArtistData();
    }
  }, [token]);
  
  const loadArtistData = async () => {
    setIsLoading(true);
    
    try {
      // Get artist details
      const artistResult = await apiClient.getArtistDetails(token as string);
      if (artistResult.success) {
        setArtistData(artistResult.data.results[0]);
        
        // Try to get artist ID from the response for songs
        const artistId = artistResult.data.results[0]?.id;
        
        if (artistId) {
          // Get artist songs using ID
          const songsResult:any = await apiClient.getArtistSongs(artistId);
          if (songsResult.success) {
            setArtistSongs(songsResult.data.results);
          }
        }
      }
    } catch (error) {
      console.error('Error loading artist data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePlaySong = (song: any) => {
    const formattedSong = {
      id: song.id,
      title: song.name,
      artist: song.artists?.primary?.map((artist: any) => artist.name).join(', ') || artistData?.name || 'Unknown Artist',
      album: song.album?.name || '',
      artwork: song.image?.[1]?.url || artistData?.image?.[1]?.url || 'https://via.placeholder.com/300',
      duration: song.duration || 0,
      audioUrl: song.downloadUrl?.[1]?.url || '',
      year: song.year
    };
    
    playSong(formattedSong);
  };
  
  const handlePlayAll = () => {
    if (artistSongs.length > 0) {
      handlePlaySong(artistSongs[0]);
    }
  };
  
  const toggleLike = () => {
    setIsLiked(!isLiked);
  };
  
  const renderSongItem = ({ item, index }: { item: any; index: number }) => {
    const isCurrentlyPlaying = currentSong?.id === item.id;
    const artistName = item.artists?.primary?.map((artist: any) => artist.name).join(', ') || 
                    artistData?.name || 'Unknown Artist';
    
    return (
      <TouchableOpacity
        style={[styles.songItem, isDark && styles.darkBorder]}
        onPress={() => handlePlaySong(item)}
      >
        <Text style={[styles.songIndex, isDark && styles.darkText]}>
          {index + 1}
        </Text>
        <View style={styles.songInfo}>
          <Text 
            style={[
              styles.songTitle, 
              isDark && styles.darkText,
              isCurrentlyPlaying && styles.activeText
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text 
            style={[styles.songArtist, isDark && styles.darkSubText]} 
            numberOfLines={1}
          >
            {artistName}
          </Text>
        </View>
        {isCurrentlyPlaying && (
          <TouchableOpacity 
            style={styles.playPauseButton}
            onPress={isPlaying ? pauseSong : resumeSong}
          >
            {isPlaying ? (
              <Pause size={16} color="#fff" />
            ) : (
              <Play size={16} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };
  
  const getHighQualityImage = (images: any[]) => {
    if (!images || images.length === 0) return 'https://via.placeholder.com/300';
    
    // Try to get a high-quality image (prefer 500x500)
    const highQualityImage = images.find(img => img.quality === '500x500');
    if (highQualityImage) return highQualityImage.url;
    
    // Fallback to the highest quality available
    return images[images.length - 1].url;
  };
  
  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.darkContainer, styles.loadingContainer]}>
        <Stack.Screen options={{ title: artist as string || 'Artist' }} />
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Loading artist...
        </Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Stack.Screen 
        options={{ 
          headerShown: false 
        }}
      />
      
      <ScrollView style={styles.scrollView}>
        <LinearGradient
          colors={isDark ? 
            ['rgba(0,0,0,0.8)', '#121212'] : 
            ['rgba(200,200,200,0.8)', '#ffffff']
          }
          style={styles.headerGradient}
        >
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <ArrowLeft 
              size={24} 
              color={isDark ? '#fff' : '#000'} 
            />
          </TouchableOpacity>
          
          <View style={styles.artistHeaderContent}>
            <Image 
              source={{ 
                uri: artistData ? 
                  getHighQualityImage(artistData.image) : 
                  'https://via.placeholder.com/300'
              }} 
              style={styles.artistImage} 
            />
            
            <Text style={[styles.artistName, isDark && styles.darkText]}>
              {artistData?.name || artist || 'Unknown Artist'}
            </Text>
            
            {artistData?.followerCount && (
              <Text style={[styles.followerCount, isDark && styles.darkSubText]}>
                {artistData.followerCount} followers
              </Text>
            )}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.playAllButton}
                onPress={handlePlayAll}
                disabled={artistSongs.length === 0}
              >
                <Play size={16} color="#fff" />
                <Text style={styles.playAllText}>Play All</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.likeButton, 
                  isLiked && styles.likedButton
                ]}
                onPress={toggleLike}
              >
                <Heart 
                  size={16} 
                  color={isLiked ? '#fff' : (isDark ? '#fff' : '#000')}
                  fill={isLiked ? '#E53935' : 'transparent'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
        
        <View style={styles.songsContainer}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Popular Songs
          </Text>
          
          {artistSongs.length > 0 ? (
            <FlatList
              data={artistSongs}
              renderItem={renderSongItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.songsList}
            />
          ) : (
            <Text style={[styles.noSongsText, isDark && styles.darkSubText]}>
              No songs available
            </Text>
          )}
        </View>
        
        {artistData?.bio && (
          <View style={styles.bioContainer}>
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
              About
            </Text>
            <Text style={[styles.bioText, isDark && styles.darkSubText]}>
              {artistData.bio}
            </Text>
          </View>
        )}
        
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#000',
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  artistHeaderContent: {
    alignItems: 'center',
  },
  artistImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 16,
  },
  artistName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
    textAlign: 'center',
  },
  followerCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E53935',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 12,
  },
  playAllText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  likeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  likedButton: {
    backgroundColor: '#E53935',
  },
  songsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  songsList: {
    paddingBottom: 8,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkBorder: {
    borderBottomColor: '#333',
  },
  songIndex: {
    width: 30,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  songInfo: {
    flex: 1,
    marginLeft: 8,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#666',
  },
  activeText: {
    color: '#E53935',
  },
  playPauseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  bioContainer: {
    padding: 16,
    paddingTop: 8,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  darkText: {
    color: '#fff',
  },
  darkSubText: {
    color: '#aaa',
  },
  noSongsText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
  footer: {
    height: 100, // Space for music player bar
  },
}); 