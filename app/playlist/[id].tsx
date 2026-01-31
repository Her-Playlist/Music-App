import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  ChevronLeft,
  Play,
  Heart,
  MoreVertical,
  Download,
} from 'lucide-react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useMusic } from '../components/music/MusicContext';
import { LinearGradient } from 'expo-linear-gradient';
import apiClient from '../services/api';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';

export default function PlaylistScreen() {
  const { id, playlist: playlistName } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const { isDark } = useTheme();
  const { playSong, updateQueue } = useMusic();
  const [isLiked, setIsLiked] = useState(false);
  const [playlistDetails, setPlaylistDetails] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Load playlist details
  useEffect(() => {
    loadPlaylistDetails();
  }, [id]);
  const fetchRecommendations = async (token: string) => {
    const recommendations = await apiClient.getPlaylistRecommendations(token);
    const data = recommendations.data;
    return data;
  };
  const loadPlaylistDetails = async () => {
    try {
      // Extract token from the full URL if needed
      const idStr = Array.isArray(id) ? id[0] : id;
      const token = idStr.includes('/')
        ? idStr.split('/').pop() || idStr
        : idStr;
      console.log('Loading playlist details for token:', token);

      const result = await apiClient.getPlaylistDetails(token);
      console.log(
        'Playlist details response:',
        JSON.stringify(result).substring(0, 500) + '...'
      );

      if (result.status === 'Success' && result.data) {
        console.log('Playlist songs count:', result.data.songs?.length || 0);
        const recommendationSongs = await fetchRecommendations(result.data.id);
        setRecommendations(recommendationSongs);
        setPlaylistDetails(result.data);
        setSongs(result.data.songs || []);
        setArtists(result.data.artists || []);
      } else {
        console.error('Failed to load playlist details:', result.message);
      }
    } catch (error) {
      console.error('Error loading playlist details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Play all songs in the playlist
  const playAllSongs = () => {
    if (songs.length > 0) {
      const firstSong = songs[0];
      const imageUrl = getImageUrl(firstSong.image);
      const audioUrl = getAudioUrl(firstSong.download_url || []);

      const song = {
        id: firstSong.id,
        title: firstSong.name,
        artist: firstSong.subtitle || 'Unknown Artist',
        album: playlistDetails?.name || '',
        artwork: imageUrl,
        duration: firstSong.duration || 0,
        audioUrl: audioUrl,
        year: firstSong.year || '',
      };

      // Play the song and update the queue with the playlist
      playSong(song);

      // Update the queue with all songs from this playlist
      updateQueue({
        id: id as string,
        name: playlistDetails?.name || '',
        type: 'playlist',
        songs: songs.map((s) => ({
          id: s.id,
          title: s.name,
          artist: s.subtitle || 'Unknown Artist',
          album: playlistDetails?.name || '',
          artwork: getImageUrl(s.image),
          duration: s.duration || 0,
          audioUrl: getAudioUrl(s.download_url || []),
          year: s.year || '',
        })),
      });
    }
  };

  // Toggle like playlist
  const toggleLike = () => {
    setIsLiked(!isLiked);
  };

  // Download all songs in the playlist
  const downloadAllSongs = async () => {
    if (songs.length === 0) {
      Alert.alert(
        'No songs',
        'There are no songs to download in this playlist.'
      );
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // Create a directory for the playlist if it doesn't exist
      const playlistDir = `${FileSystem.documentDirectory}playlists/${id}/`;
      const dirInfo = await FileSystem.getInfoAsync(playlistDir);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(playlistDir, {
          intermediates: true,
        });
      }

      // Save playlist metadata
      await AsyncStorage.setItem(
        `playlist_${id}`,
        JSON.stringify({
          id: id,
          name: playlistDetails?.name || 'Playlist',
          description: playlistDetails?.description || '',
          imageUrl: getImageUrl(playlistDetails?.image),
          songCount: songs.length,
          totalDuration: songs.reduce(
            (acc, song) => acc + (song.duration || 0),
            0
          ),
        })
      );

      // Download each song
      let downloadedCount = 0;

      for (const song of songs) {
        const audioUrl = getAudioUrl(song.download_url || []);
        if (!audioUrl) {
          console.log(`No audio URL for song: ${song.name}`);
          continue;
        }

        const songFileName = `${song.id}.mp3`;
        const songFilePath = `${playlistDir}${songFileName}`;

        // Check if song already exists
        const fileInfo = await FileSystem.getInfoAsync(songFilePath);

        if (!fileInfo.exists) {
          // Download the song
          const downloadResumable = FileSystem.createDownloadResumable(
            audioUrl,
            songFilePath,
            {},
            (downloadProgress) => {
              const progress =
                downloadProgress.totalBytesWritten /
                downloadProgress.totalBytesExpectedToWrite;
              console.log(
                `Downloading ${song.name}: ${Math.round(progress * 100)}%`
              );
            }
          );

          try {
            const downloadResult = await downloadResumable.downloadAsync();
            if (downloadResult) {
              console.log(`Downloaded song: ${song.name}`);

              // Save song metadata
              await AsyncStorage.setItem(
                `song_${song.id}`,
                JSON.stringify({
                  id: song.id,
                  title: song.name,
                  artist: song.subtitle || 'Unknown Artist',
                  album: playlistDetails?.name || '',
                  artwork: getImageUrl(song.image),
                  duration: song.duration || 0,
                  audioUrl: `file://${songFilePath}`,
                  year: song.year || '',
                  playlistId: id,
                })
              );
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
      const parsedDownloadedSongs = downloadedSongs
        ? JSON.parse(downloadedSongs)
        : [];

      // Add song IDs that aren't already in the list
      const newDownloadedSongs = [
        ...parsedDownloadedSongs,
        ...songs
          .map((s) => s.id)
          .filter((id) => !parsedDownloadedSongs.includes(id)),
      ];

      await AsyncStorage.setItem(
        'downloaded_songs',
        JSON.stringify(newDownloadedSongs)
      );

      // Update the list of downloaded playlists
      const downloadedPlaylists = await AsyncStorage.getItem(
        'downloaded_playlists'
      );
      const parsedDownloadedPlaylists = downloadedPlaylists
        ? JSON.parse(downloadedPlaylists)
        : [];

      if (!parsedDownloadedPlaylists.includes(id)) {
        await AsyncStorage.setItem(
          'downloaded_playlists',
          JSON.stringify([...parsedDownloadedPlaylists, id])
        );
      }

      Alert.alert(
        'Download Complete',
        `${songs.length} songs have been downloaded for offline playback.`
      );
    } catch (error) {
      console.error('Error downloading playlist:', error);
      Alert.alert(
        'Download Error',
        'Failed to download all songs. Please try again.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // Helper function to get image URL
  const getImageUrl = (imageData: any): string => {
    if (!imageData) return 'https://ldgnpdudaohjifgktmst.supabase.co/storage/v1/object/public/ruza//artist.jpg';
    if (typeof imageData === 'string') return imageData;
    if (Array.isArray(imageData)) {
      // const medium = imageData.find(img => img.quality === 'medium' || img.quality === '150x150');
      // if (medium) return medium.url || medium.link || '';
      const high = imageData.find(
        (img) => img.quality === 'high' || img.quality === '500x500'
      );
      if (high) return high.url || high.link || '';
      for (const img of imageData) {
        if (img) {
          const imageUrl = img.url || img.link;
          if (imageUrl) return imageUrl;
        }
      }
    }
    if (typeof imageData === 'object') {
      if (imageData[0]) {
        const firstImage = imageData[0];
        return firstImage.url || firstImage.link || 'https://ldgnpdudaohjifgktmst.supabase.co/storage/v1/object/public/ruza//artist.jpg';
      }
      if (imageData.url) return imageData.url;
      if (imageData.link) return imageData.link;
    }
    return 'https://ldgnpdudaohjifgktmst.supabase.co/storage/v1/object/public/ruza//artist.jpg';
  };

  // Helper function to get audio URL
  const getAudioUrl = (downloadUrls: any[]): string => {
    if (
      !downloadUrls ||
      !Array.isArray(downloadUrls) ||
      downloadUrls.length === 0
    )
      return '';
    const highestQuality = downloadUrls[downloadUrls.length - 1];
    if (highestQuality && highestQuality.link) return highestQuality.link;
    for (let i = downloadUrls.length - 1; i >= 0; i--) {
      const url = downloadUrls[i];
      if (url && url.link) return url.link;
    }
    return '';
  };

  // Calculate total duration of playlist
  const getTotalDuration = () => {
    if (!songs || songs.length === 0) return '0 min';

    const totalSeconds = songs.reduce(
      (acc, song) => acc + (song.duration || 0),
      0
    );
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  };

  // Navigate to playlist details
  const navigateToPlaylist = (playlistId: string, playlistName: string) => {
    // Extract ID from the URL
    const id = playlistId.split('/').pop() || playlistId;
    console.log('Navigating to playlist with ID:', id);

    router.push({
      pathname: '/playlist/[id]',
      params: { id: id, playlist: playlistName },
    });
  };

  // Navigate to artist details
  const navigateToArtist = (
    artistId: string,
    artistName: string,
    artistUrl: string
  ) => {
    // Extract token from the URL (the part after the last slash)
    const token = artistUrl.split('/').pop() || '';
    console.log('Navigating to artist with token:', token);

    router.push({
      pathname: '/artists/details',
      params: { token: token, artist: artistName },
    });
  };

  // Format follower count to be more readable
  const formatFollowerCount = (count: number) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count;
  };

  // Render playlist item for recommended playlists
  const renderPlaylistItem = ({ item }: { item: any }) => {
    // Featured playlists have image as a direct string
    const imageUrl =
      typeof item.image === 'string' ? item.image : getImageUrl(item.image);

    return (
      <TouchableOpacity
        style={styles.albumCard}
        onPress={() => navigateToPlaylist(item.url, item.name)}
      >
        <View style={styles.imageWrapper}>
          <Image source={{ uri: imageUrl }} style={styles.albumCover} />

          {/* Top Left Logo */}
          <Image
            source={{ uri: imageUrl }} // replace with your logo
            style={styles.topLeftLogo}
          />

          {/* Top Right "English" Badge */}
          <View style={styles.topRightBadge}>
            <Text style={styles.badgeText}>English</Text>
          </View>
        </View>

        <Text
          style={[styles.albumTitle, isDark && styles.darkText]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text style={[styles.albumInfo, isDark && styles.darkSubText]}>
          {item.subtitle || ''}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render artist item
  const renderArtistItem = ({ item }: { item: any }) => {
    // Artists have image as an array of objects
    const imageUrl = getImageUrl(item.image);

    return (
      <TouchableOpacity
        style={styles.artistCard}
        key={item.id}
        onPress={() => navigateToArtist(item.id, item.name, item.url)}
      >
        <Image source={{ uri: imageUrl  }} style={styles.artistImage} />
        <Text
          style={[styles.artistName, isDark && styles.darkText]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.follower_count && (
          <Text style={[styles.artistFollowers, isDark && styles.darkSubtext]}>
            {formatFollowerCount(parseInt(item.follower_count) || 0)} followers
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // Handle download button long press for options
  const handleDownloadLongPress = () => {
    if (!isDownloading) {
      // Check if playlist is already downloaded
      checkPlaylistDownloaded(id).then((isDownloaded) => {
        if (isDownloaded) {
          Alert.alert(
            'Playlist Options',
            `What would you like to do with "${
              playlistDetails?.name || playlistName
            }"?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Delete Download',
                style: 'destructive',
                onPress: () => deleteDownloadedPlaylist(),
              },
            ]
          );
        } else {
          // If not downloaded yet, just show download option
          Alert.alert(
            'Playlist Options',
            'Download this playlist for offline listening?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Download',
                onPress: () => downloadAllSongs(),
              },
            ]
          );
        }
      });
    }
  };

  // Check if the playlist is downloaded
  const checkPlaylistDownloaded = async (
    id: string | string[]
  ): Promise<boolean> => {
    const downloadedPlaylists = await AsyncStorage.getItem(
      'downloaded_playlists'
    );
    const idString = Array.isArray(id) ? id[0] : id;
    return downloadedPlaylists
      ? JSON.parse(downloadedPlaylists).includes(idString)
      : false;
  };

  // Delete the downloaded playlist
  const deleteDownloadedPlaylist = async () => {
    try {
      setIsLoading(true);

      // Get all downloaded songs from this playlist
      const downloadedSongs = await AsyncStorage.getItem('downloaded_songs');
      let downloadedSongIds = downloadedSongs
        ? JSON.parse(downloadedSongs)
        : [];

      const playlistDir = `${FileSystem.documentDirectory}playlists/${id}/`;

      // Delete the playlist directory
      const dirInfo = await FileSystem.getInfoAsync(playlistDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(playlistDir, { idempotent: true });
      }

      // Get all songs with this playlistId
      const playlistSongs: string[] = [];
      for (const songId of downloadedSongIds) {
        const songData = await AsyncStorage.getItem(`song_${songId}`);
        if (songData) {
          const song = JSON.parse(songData);
          if (song.playlistId === id) {
            playlistSongs.push(songId);
            await AsyncStorage.removeItem(`song_${songId}`);
          }
        }
      }

      // Remove songs from downloaded songs list
      const filteredSongIds = downloadedSongIds.filter(
        (songId: string) => !playlistSongs.includes(songId)
      );
      await AsyncStorage.setItem(
        'downloaded_songs',
        JSON.stringify(filteredSongIds)
      );

      // Remove playlist from downloaded playlists list
      const downloadedPlaylistsData = await AsyncStorage.getItem(
        'downloaded_playlists'
      );
      const downloadedPlaylistIds = downloadedPlaylistsData
        ? JSON.parse(downloadedPlaylistsData).filter(
            (playlistId: string) => playlistId !== id
          )
        : [];

      await AsyncStorage.setItem(
        'downloaded_playlists',
        JSON.stringify(downloadedPlaylistIds)
      );

      // Remove playlist metadata
      await AsyncStorage.removeItem(`playlist_${id}`);

      Alert.alert(
        'Success',
        `"${playlistDetails?.name || playlistName}" has been deleted`
      );
    } catch (error) {
      console.error('Error deleting playlist:', error);
      Alert.alert('Error', 'Failed to delete playlist');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlaylistDetails();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          isDark && styles.darkContainer,
          styles.loadingContainer,
        ]}
      >
        <ActivityIndicator size="large" color="#E53935" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
          source={{ uri: getImageUrl(playlistDetails?.image) }}
          resizeMode="cover"
          style={[
            styles.header,
            {
              // transform: [{ translateY: -60 }, { translateX: 0 }],
            },
          ]}
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
              <View style={styles.imageWrapperMain}>
                <Image
                  source={{ uri: getImageUrl(playlistDetails?.image) }}
                  style={styles.playlistImage}
                />
                <Image
                  source={{ uri: getImageUrl(playlistDetails?.image) }}
                  style={styles.topLeftLogoImage}
                />
                <View style={styles.topRightBadgeText}>
                  <Text style={styles.badgeTextFont}>English</Text>
                </View>
              </View>

              <View style={styles.playlistInfo}>
                <Text style={styles.playlistTitle}>
                  {playlistDetails?.name || playlistName}
                </Text>
                <Text style={styles.playlistDescription}>
                  {playlistDetails?.description || ''}
                </Text>
                <Text style={styles.playlistStats}>
                  {songs.length} songs • {getTotalDuration()}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={toggleLike}>
            <Heart
              size={24}
              color={isLiked ? '#E53935' : isDark ? '#fff' : '#000'}
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

          <TouchableOpacity style={styles.playButton} onPress={playAllSongs}>
            <Play size={28} color="#fff" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.songsContainer}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Songs
          </Text>

          {songs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isDark && styles.darkText]}>
                No songs in this playlist
              </Text>
            </View>
          ) : (
            <FlatList
              data={songs}
              keyExtractor={(item) => item.id.toString()}
              style={[styles.songsListContainer]}
              // showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              scrollEnabled={true}
              contentContainerStyle={styles.songsListContent}
              renderItem={({ item, index }) => {
                const imageUrl = getImageUrl(item.image);
                const audioUrl = getAudioUrl(item.download_url || []);

                const song = {
                  id: item.id,
                  title: item.name,
                  artist: item.subtitle || 'Unknown Artist',
                  album: playlistDetails?.name || '',
                  artwork: imageUrl,
                  duration: item.duration || 0,
                  audioUrl: audioUrl,
                  year: item.year || '',
                };

                return (
                  <TouchableOpacity
                    style={[styles.songItem, isDark && styles.darkSongItem]}
                    onPress={() => {
                      // Play the song and update the queue with the playlist
                      playSong(song);

                      // Update the queue with all songs from this playlist
                      updateQueue({
                        id: id as string,
                        name: playlistDetails?.name || '',
                        type: 'playlist',
                        songs: songs.map((s) => ({
                          id: s.id,
                          title: s.name,
                          artist: s.subtitle || 'Unknown Artist',
                          album: playlistDetails?.name || '',
                          artwork: getImageUrl(s.image),
                          duration: s.duration || 0,
                          audioUrl: getAudioUrl(s.download_url || []),
                          year: s.year || '',
                        })),
                      });
                    }}
                  >
                    <Text
                      style={[styles.songIndex, isDark && styles.darkSubtext]}
                    >
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
                        style={[
                          styles.songArtist,
                          isDark && styles.darkSubtext,
                        ]}
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
                          album: playlistDetails?.name || '',
                          artwork: imageUrl,
                          duration: item.duration || 0,
                          audioUrl: audioUrl,
                          year: item.year || '',
                        };
                        playSong(song);
                        updateQueue({
                          id: id as string,
                          name: playlistDetails?.name || '',
                          type: 'playlist',
                          songs: songs.map((s) => ({
                            id: s.id,
                            title: s.name,
                            artist: s.subtitle || 'Unknown Artist',
                            album: playlistDetails?.name || '',
                            artwork: getImageUrl(s.image),
                            duration: s.duration || 0,
                            audioUrl: getAudioUrl(s.download_url || []),
                            year: s.year || '',
                          })),
                        });
                      }}
                    >
                      <Play size={16} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>

        {/* Recommended Playlists Section */}
        {recommendations.length > 0 && (
          <View style={styles.categoryContainer}>
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
              Recommended Playlists
            </Text>
            <FlatList
              data={recommendations}
              renderItem={renderPlaylistItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            />
          </View>
        )}

        {/* Artists Section */}
        {artists.length > 0 && (
          <View style={styles.categoryContainer}>
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
              Artists
            </Text>
            <FlatList
              data={artists}
              renderItem={renderArtistItem}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            />
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    // paddingBottom: 120, // Space for player
  },
  header: {
    height: 230,
    backgroundPosition: 'bottom',
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
  playlistImage: {
    width: 100,
    height: 100,
    borderRadius: 4,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  playlistInfo: {
    flex: 1,
    alignItems:"center"
  },
  playlistTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  playlistDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  playlistStats: {
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
  songsContainer: {
    padding: 16,
  },
  songsListContainer: {
    height: 300, // Fixed height for the song list container
    marginBottom: 8,
    borderRadius: 8,
  },
  songsListContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  darkItem: {
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
  darkSubtext: {
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
  darkSongItem: {
    backgroundColor: '#282828',
  },
  categoryContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000',
  },
  categoryList: {
    paddingBottom: 8,
  },
  albumCard: {
    width: 150,
    marginRight: 16,
  },
  albumCover: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  albumTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  imageWrapper: {
    position: 'relative',
  },
  imageWrapperMain: {
    position: 'relative',
    width: 100,
    // marginRight: 16,
  },
  topLeftLogo: {
    position: 'absolute',
    borderRadius: 100,
    top: 5,
    left: 5,
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  topLeftLogoImage: {
    position: 'absolute',
    borderRadius: 100,
    top: 3,
    left: 3,
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },

  topRightBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#001F84',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  topRightBadgeText: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: '#001F84',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },

  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeTextFont: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 6,
    fontWeight: 'bold',
  },

  darkSubText: {
    color: '#aaa',
  },
  albumInfo: {
    fontSize: 12,
    color: '#888',
  },
  artistCard: {
    width: 120,
    marginRight: 16,
    alignItems: 'center',
  },
  artistImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 8,
  },
  artistName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
    marginBottom: 2,
  },
  artistFollowers: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  footer: {
    height: 40,
  },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadProgressText: {
    marginLeft: 5,
    fontSize: 10,
    color: '#E53935',
    fontWeight: 'bold',
  },
});
