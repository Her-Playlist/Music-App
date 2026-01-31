import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ImageBackground,
  useColorScheme, 
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView
} from 'react-native';
import { 
  ChevronLeft, 
  Play, 
  Heart, 
  MoreVertical, 
  Download 
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useMusic } from '../components/music/MusicContext';
import apiClient from '../services/api';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';

export default function AlbumDetails() {
  const { id, album } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const { isDark } = useTheme();
  const { playSong, updateQueue } = useMusic();
  
  const [albumDetails, setAlbumDetails] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    loadAlbumDetails();
  }, [id]);

  const loadAlbumDetails = async () => {
    try {
      // Extract token from the full URL if needed
      const idStr = id as string;
      const token = idStr.includes('/') ? idStr.split('/').pop() || idStr : idStr;
      console.log('Loading album details for token:', token);
      
      const result = await apiClient.getAlbumDetails(token);
      console.log('Album details response:', JSON.stringify(result).substring(0, 500) + '...');
      
      if (result.status === 'Success' && result.data) {
        console.log('Album songs count:', result.data.songs?.length || 0);
        setAlbumDetails(result.data);
        setSongs(result.data.songs || []);
      } else {
        console.error('Failed to load album details:', result.message);
      }
    } catch (error) {
      console.error('Error loading album details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getImageUrl = (imageData: any): string => {
    if (!imageData) return 'https://via.placeholder.com/300';
    if (typeof imageData === 'string') return imageData;
    if (Array.isArray(imageData)) {
      const high = imageData.find(img => img.quality === 'high' || img.quality === '500x500');
      if (high) return high.url || high.link || '';
      for (const img of imageData) {
        if (img) {
          const imageUrl = img.url || img.link;
          if (imageUrl) return imageUrl;
        }
      }
    }
    return 'https://via.placeholder.com/300';
  };

  const getAudioUrl = (downloadUrls: any[]): string => {
    if (!downloadUrls || !Array.isArray(downloadUrls) || downloadUrls.length === 0) return '';
    const highestQuality = downloadUrls[downloadUrls.length - 1];
    if (highestQuality && highestQuality.link) return highestQuality.link;
    for (let i = downloadUrls.length - 1; i >= 0; i--) {
      const url = downloadUrls[i];
      if (url && url.link) return url.link;
    }
    return '';
  };

  const renderSongItem = ({ item, index }: { item: any; index: number }) => {
    const imageUrl = getImageUrl(item.image);
    const audioUrl = getAudioUrl(item.download_url || []);
    
    const song = {
      id: item.id,
      title: item.name,
      artist: item.subtitle || 'Unknown Artist',
      album: albumDetails?.name || album || '',
      artwork: imageUrl,
      duration: item.duration || 0,
      audioUrl: audioUrl,
      year: item.year || ''
    };
    
    return (
      <TouchableOpacity
        style={[styles.songItem, isDark && styles.darkSongItem]}
        onPress={() => {
          // Play the song and update the queue with the album
          playSong(song);

          // Update the queue with all songs from this album
          updateQueue({
            id: id as string,
            name: albumDetails?.name || album || '',
            type: 'album',
            songs: songs.map(s => ({
              id: s.id,
              title: s.name,
              artist: s.subtitle || 'Unknown Artist',
              album: albumDetails?.name || album || '',
              artwork: getImageUrl(s.image),
              duration: s.duration || 0,
              audioUrl: getAudioUrl(s.download_url || []),
              year: s.year || ''
            }))
          });
        }}
      >
        <Text style={[styles.songIndex, isDark && styles.darkSubText]}>
          {index + 1}
        </Text>
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.songCover}
        />
        <View style={styles.songInfo}>
          <Text 
            style={[styles.songTitle, isDark && styles.darkText]} 
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text 
            style={[styles.songArtist, isDark && styles.darkSubText]} 
            numberOfLines={1}
          >
            {item.subtitle || 'Unknown Artist'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.playButton}
          onPress={(e) => {
            e.stopPropagation();
            const song = {
              id: item.id,
              title: item.name,
              artist: item.subtitle || 'Unknown Artist',
              album: albumDetails?.name || album || '',
              artwork: imageUrl,
              duration: item.duration || 0,
              audioUrl: audioUrl,
              year: item.year || ''
            };
            playSong(song);
          }}
        >
          <Play size={16} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Play all songs in the album
  const playAllSongs = () => {
    if (songs.length > 0) {
      const firstSong = songs[0];
      const imageUrl = getImageUrl(firstSong.image);
      const audioUrl = getAudioUrl(firstSong.download_url || []);
      
      const song = {
        id: firstSong.id,
        title: firstSong.name,
        artist: firstSong.subtitle || 'Unknown Artist',
        album: albumDetails?.name || album || '',
        artwork: imageUrl,
        duration: firstSong.duration || 0,
        audioUrl: audioUrl,
        year: firstSong.year || ''
      };
      
      // Play the song and update the queue with the album
      playSong(song);

      // Update the queue with all songs from this album
      updateQueue({
        id: id as string,
        name: albumDetails?.name || album || '',
        type: 'album',
        songs: songs.map(s => ({
          id: s.id,
          title: s.name,
          artist: s.subtitle || 'Unknown Artist',
          album: albumDetails?.name || album || '',
          artwork: getImageUrl(s.image),
          duration: s.duration || 0,
          audioUrl: getAudioUrl(s.download_url || []),
          year: s.year || ''
        }))
      });
    }
  };

  // Download all songs in the album
  const downloadAllSongs = async () => {
    if (songs.length === 0) {
      Alert.alert('No songs', 'There are no songs to download in this album.');
      return;
    }
    
    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      // Create a directory for the album if it doesn't exist
      const albumDir = `${FileSystem.documentDirectory}albums/${id}/`;
      const dirInfo = await FileSystem.getInfoAsync(albumDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(albumDir, { intermediates: true });
      }
      
      // Save album metadata
      await AsyncStorage.setItem(`album_${id}`, JSON.stringify({
        id: id,
        name: albumDetails?.name || 'Album',
        subtitle: albumDetails?.subtitle || '',
        imageUrl: getImageUrl(albumDetails?.image),
        songCount: songs.length,
        totalDuration: songs.reduce((acc, song) => acc + (song.duration || 0), 0),
        year: albumDetails?.year || ''
      }));
      
      // Download each song
      let downloadedCount = 0;
      
      for (const song of songs) {
        const audioUrl = getAudioUrl(song.download_url || []);
        if (!audioUrl) {
          console.log(`No audio URL for song: ${song.name}`);
          continue;
        }
        
        const songFileName = `${song.id}.mp3`;
        const songFilePath = `${albumDir}${songFileName}`;
        
        // Check if song already exists
        const fileInfo = await FileSystem.getInfoAsync(songFilePath);
        
        if (!fileInfo.exists) {
          // Download the song
          const downloadResumable = FileSystem.createDownloadResumable(
            audioUrl,
            songFilePath,
            {},
            (downloadProgress) => {
              const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
              console.log(`Downloading ${song.name}: ${Math.round(progress * 100)}%`);
            }
          );
          
          try {
            const downloadResult = await downloadResumable.downloadAsync();
            if (downloadResult) {
              console.log(`Downloaded song: ${song.name}`);
              
              // Save song metadata
              await AsyncStorage.setItem(`song_${song.id}`, JSON.stringify({
                id: song.id,
                title: song.name,
                artist: song.subtitle || 'Unknown Artist',
                album: albumDetails?.name || album || '',
                artwork: getImageUrl(song.image),
                duration: song.duration || 0,
                audioUrl: `file://${songFilePath}`,
                year: song.year || '',
                albumId: id,
              }));
            }
          } catch (e) {
            console.error(`Error downloading song ${song.name}:`, e);
          }
        } else {
          console.log(`Song already downloaded: ${song.name}`);
        }
        
        downloadedCount++;
        setDownloadProgress(downloadedCount / songs.length);
      }
      
      // Update the list of downloaded songs
      const downloadedSongs = await AsyncStorage.getItem('downloaded_songs');
      const parsedDownloadedSongs = downloadedSongs ? JSON.parse(downloadedSongs) : [];
      
      // Add song IDs that aren't already in the list
      const newDownloadedSongs = [
        ...parsedDownloadedSongs,
        ...songs.map(s => s.id).filter(id => !parsedDownloadedSongs.includes(id))
      ];
      
      await AsyncStorage.setItem('downloaded_songs', JSON.stringify(newDownloadedSongs));
      
      // Update the list of downloaded albums
      const downloadedAlbums = await AsyncStorage.getItem('downloaded_albums');
      const parsedDownloadedAlbums = downloadedAlbums ? JSON.parse(downloadedAlbums) : [];
      
      if (!parsedDownloadedAlbums.includes(id)) {
        await AsyncStorage.setItem('downloaded_albums', JSON.stringify([...parsedDownloadedAlbums, id]));
      }
      
      Alert.alert('Download Complete', `${songs.length} songs have been downloaded for offline playback.`);
    } catch (error) {
      console.error('Error downloading album:', error);
      Alert.alert('Download Error', 'Failed to download all songs. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Toggle like album
  const toggleLike = () => {
    setIsLiked(!isLiked);
  };

  // Calculate total duration of album
  const getTotalDuration = () => {
    if (!songs || songs.length === 0) return '0 min';
    
    const totalSeconds = songs.reduce((acc, song) => acc + (song.duration || 0), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  };

  // Handle download button long press for options
  const handleDownloadLongPress = () => {
    if (!isDownloading) {
      // Check if album is already downloaded
      checkAlbumDownloaded().then(isDownloaded => {
        if (isDownloaded) {
          Alert.alert(
            'Album Options',
            `What would you like to do with "${albumDetails?.name || album}"?`,
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Delete Download',
                style: 'destructive',
                onPress: () => deleteDownloadedAlbum()
              }
            ]
          );
        } else {
          // If not downloaded yet, just show download option
          Alert.alert(
            'Album Options',
            'Download this album for offline listening?',
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Download',
                onPress: () => downloadAllSongs()
              }
            ]
          );
        }
      });
    }
  };

  // Check if album is already downloaded
  const checkAlbumDownloaded = async (): Promise<boolean> => {
    try {
      const downloadedAlbums = await AsyncStorage.getItem('downloaded_albums');
      if (downloadedAlbums) {
        const albums = JSON.parse(downloadedAlbums);
        return albums.includes(id);
      }
      return false;
    } catch (error) {
      console.error('Error checking if album is downloaded:', error);
      return false;
    }
  };

  // Delete the downloaded album
  const deleteDownloadedAlbum = async () => {
    try {
      setIsLoading(true);
      
      // Get all downloaded songs from this album
      const downloadedSongs = await AsyncStorage.getItem('downloaded_songs');
      let downloadedSongIds = downloadedSongs ? JSON.parse(downloadedSongs) : [];
      
      const albumDir = `${FileSystem.documentDirectory}albums/${id}/`;
      
      // Delete the album directory
      const dirInfo = await FileSystem.getInfoAsync(albumDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(albumDir, { idempotent: true });
      }
      
      // Get all songs with this albumId
      const albumSongs: string[] = [];
      for (const songId of downloadedSongIds) {
        const songData = await AsyncStorage.getItem(`song_${songId}`);
        if (songData) {
          const song = JSON.parse(songData);
          if (song.albumId === id) {
            albumSongs.push(songId);
            await AsyncStorage.removeItem(`song_${songId}`);
          }
        }
      }
      
      // Remove songs from downloaded songs list
      downloadedSongIds = downloadedSongIds.filter((id: string) => !albumSongs.includes(id));
      await AsyncStorage.setItem('downloaded_songs', JSON.stringify(downloadedSongIds));
      
      // Remove album from downloaded albums list
      const downloadedAlbumsData = await AsyncStorage.getItem('downloaded_albums');
      const downloadedAlbumIds = downloadedAlbumsData 
        ? JSON.parse(downloadedAlbumsData).filter((albumId: string) => albumId !== id) 
        : [];
      
      await AsyncStorage.setItem('downloaded_albums', JSON.stringify(downloadedAlbumIds));
      
      // Remove album metadata
      await AsyncStorage.removeItem(`album_${id}`);
      
      Alert.alert('Success', `"${albumDetails?.name || album}" has been deleted`);
    } catch (error) {
      console.error('Error deleting album:', error);
      Alert.alert('Error', 'Failed to delete album');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlbumDetails();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.darkContainer, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#E53935" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E53935']}
            tintColor={isDark ? '#E53935' : '#E53935'}
            progressBackgroundColor={isDark ? '#282828' : '#f2f2f2'}
          />
        }
      >
        <ImageBackground
          source={{ uri: getImageUrl(albumDetails?.image) }}
          style={styles.header}
        >
          <LinearGradient
            colors={['transparent', isDark ? '#121212' : '#fff']}
            style={styles.gradient}
          >
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
            >
              <ChevronLeft size={28} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <Image source={{ uri: getImageUrl(albumDetails?.image) }} style={styles.albumImage} />
              
              <View style={styles.albumInfo}>
                <Text style={styles.albumTitle}>{albumDetails?.name || album}</Text>
                <Text style={styles.albumDescription}>{albumDetails?.subtitle || ''}</Text>
                <Text style={styles.albumStats}>
                  {songs.length} songs • {getTotalDuration()}
                  {albumDetails?.year ? ` • ${albumDetails.year}` : ''}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={toggleLike}>
            <Heart 
              size={24} 
              color={isLiked ? '#E53935' : (isDark ? '#fff' : '#000')}
              fill={isLiked ? '#E53935' : 'transparent'}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={downloadAllSongs}
            onLongPress={handleDownloadLongPress}
            delayLongPress={600}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <View style={styles.downloadProgressContainer}>
                <ActivityIndicator size="small" color="#E53935" />
                <Text style={styles.downloadProgressText}>
                  {Math.round(downloadProgress * 100)}%
                </Text>
              </View>
            ) : (
              <Download size={24} color={isDark ? '#fff' : '#000'} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <MoreVertical size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          
          <View style={styles.spacer} />
          
          <TouchableOpacity 
            style={styles.playButton}
            onPress={playAllSongs}
          >
            <Play size={28} color="#fff" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          renderItem={renderSongItem}
          contentContainerStyle={styles.songsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isDark && styles.darkSubText]}>
                No songs in this album
              </Text>
            </View>
          }
          nestedScrollEnabled={true}
        />
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 340,
  },
  gradient: {
    flex: 1,
    paddingTop: 40,
  },
  backButton: {
    margin: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  albumImage: {
    width: 140,
    height: 140,
    borderRadius: 4,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  albumInfo: {
    flex: 1,
  },
  albumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  albumDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  albumStats: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  actionButton: {
    marginRight: 20,
  },
  spacer: {
    flex: 1,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  songsList: {
    paddingTop: 8,
    paddingBottom: 120, // Space for player
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 16,
    borderRadius: 4,
    marginBottom: 4,
  },
  darkSongItem: {
    backgroundColor: '#282828', 
  },
  songIndex: {
    width: 24,
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  songCover: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginLeft: 8,
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#888',
  },
  darkText: {
    color: '#fff',
  },
  darkSubText: {
    color: '#aaa',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  downloadProgressText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E53935',
  },
}); 