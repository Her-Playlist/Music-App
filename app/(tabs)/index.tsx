import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Button,
  Alert,
} from 'react-native';
import { Play, Heart, RefreshCw, Disc, WifiOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, Stack } from 'expo-router';
import { useMusic } from '../../components/music/MusicContext';
import { useNetwork } from '../../components/NetworkContext';
import apiClient from '../../services/api';
import { useTheme } from '../../hooks/useTheme';

// Home screen category types
interface Category {
  id: string;
  title: string;
  type: 'featured' | 'trending' | 'artists' | 'new';
}

// Featured categories for the home screen
const HOME_CATEGORIES: Category[] = [
  { id: 'featured', title: 'Featured Playlists', type: 'featured' },
  { id: 'trending', title: 'Trending Now', type: 'trending' },
  // { id: 'artists', title: 'Popular Artists', type: 'artists' },
  { id: 'new', title: 'New Releases', type: 'new' },
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const { isDark } = useTheme();
  const { playSong, isLoading: globalLoading, updateQueue } = useMusic();
  const { isConnected, isInternetReachable } = useNetwork();
  const hasConnection = isConnected && isInternetReachable;

  const [featuredPlaylists, setFeaturedPlaylists] = useState<any[]>([]);
  const [trendingSongs, setTrendingSongs] = useState<any[]>([]);
  const [newReleases, setNewReleases] = useState<any[]>([]);
  const [popularArtists, setPopularArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load initial data
  useEffect(() => {
    loadHomeData();
  }, []);

  // Load all data for home screen
  const loadHomeData = async () => {
    setIsLoading(true);

    if (!hasConnection) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Load featured playlists
      const featuredResult = await apiClient.getFeaturedPlaylists();
      // console.log(
      //   'Featured Playlists Response:',
      //   JSON.stringify(featuredResult).substring(0, 500) + '...'
      // );
      if (featuredResult.status === 'Success') {
        if (featuredResult.data && featuredResult.data.data) {
          // console.log(
          //   'Setting Featured Playlists:',
          //   featuredResult.data.data.length
          // );
          // Log the first item to inspect structure
          if (featuredResult.data.data.length > 0) {
            const firstItem = featuredResult.data.data[0];
            // console.log('First playlist item:', JSON.stringify(firstItem));
            // console.log(
            //   'Playlist image data:',
            //   JSON.stringify(firstItem.image)
            // );
          }
          setFeaturedPlaylists(featuredResult.data.data);
        } else {
          console.error(
            'Invalid featured playlists structure:',
            featuredResult.data
          );
        }
      }

      // Load trending songs
      const trendingResult = await apiClient.getTrending('song');
      // console.log(
      //   'Trending Response:',
      //   JSON.stringify(trendingResult).substring(0, 500) + '...'
      // );
      if (trendingResult.status === 'Success') {
        // console.log(
        //   'Setting Trending Songs:',
        //   trendingResult.data?.length || 0
        // );
        // Log the first item to inspect structure
        if (trendingResult.data && trendingResult.data.length > 0) {
          const firstItem = trendingResult.data[0];
          // console.log('First trending item:', JSON.stringify(firstItem));
          // console.log('Trending image data:', JSON.stringify(firstItem.image));
        }
        setTrendingSongs(trendingResult.data || []);
      }

      // Load new releases (albums)
      const newResult = await apiClient.getTrending('album');
      // console.log(
      //   'New Releases Response:',
      //   JSON.stringify(newResult).substring(0, 500) + '...'
      // );
      if (newResult.status === 'Success') {
        // console.log('Setting New Releases:', newResult.data?.length || 0);
        // Log the first item to inspect structure
        if (newResult.data && newResult.data.length > 0) {
          const firstItem = newResult.data[0];
          // console.log('First album item:', JSON.stringify(firstItem));
          // console.log('Album image data:', JSON.stringify(firstItem.image));
        }
        setNewReleases(newResult.data || []);
      }

      // Load popular artists
      const artistsResult = await apiClient.getTopArtists();
      // console.log(
      //   'Artists Response:',
      //   JSON.stringify(artistsResult).substring(0, 500) + '...'
      // );
      if (artistsResult.status === 'Success') {
        // console.log(
        //   'Setting Popular Artists:',
        //   artistsResult.data?.length || 0
        // );
        // Log the first item to inspect structure
        if (artistsResult.data && artistsResult.data.length > 0) {
          const firstItem = artistsResult.data[0];
          // console.log('First artist item:', JSON.stringify(firstItem));
          // console.log('Artist image data:', JSON.stringify(firstItem.image));
        }
        setPopularArtists(artistsResult.data || []);
      }
    } catch (error) {
      console.error('Error loading home data:', error);
      // Show more detailed error information in development
      if (__DEV__) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.log('Error details:', errorMessage);
        console.log('Error stack:', errorStack);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh data
  const handleRefresh = () => {
    if (!hasConnection) {
      Alert.alert(
        "No Internet Connection", 
        "You're currently offline. Please connect to the internet to refresh.",
        [{ text: "OK" }]
      );
      return;
    }
    
    setRefreshing(true);
    loadHomeData();
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

  // Navigate to album details
  const navigateToAlbum = (albumId: string, albumName: string) => {
    // Extract ID from the URL
    const id = albumId.split('/').pop() || albumId;
    console.log('Navigating to album with ID:', id);

    router.push({
      pathname: '/albums/[id]',
      params: { id: id, album: albumName },
    });
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

  // Helper function to get the appropriate image URL from various response formats
  const getImageUrl = (imageData: any): string => {
    if (!imageData) {
      return 'https://via.placeholder.com/300';
    }

    // If imageData is a string, return it directly (featured playlists case)
    if (typeof imageData === 'string') {
      return imageData;
    }

    // If imageData is an array of objects with URLs or links (artist case)
    if (Array.isArray(imageData)) {
      // Try to get medium or 150x150 quality image first
      const medium = imageData.find(
        (img) => img.quality === 'medium' || img.quality === '150x150'
      );
      // if (medium) {
      //   return medium.url || medium.link || '';
      // }

      // Then high quality or 500x500
      const high = imageData.find(
        (img) => img.quality === 'high' || img.quality === '500x500'
      );
      if (high) {
        return high.url || high.link || '';
      }

      // Then any image with a URL or link
      for (const img of imageData) {
        if (img) {
          const imageUrl = img.url || img.link;
          if (imageUrl) return imageUrl;
        }
      }
    }

    // For the trending/albums case where image could be nested objects
    if (typeof imageData === 'object') {
      // For trending image structure
      if (imageData[0]) {
        const firstImage = imageData[0];
        return firstImage.url || firstImage.link || '';
      }

      // Try common fields
      if (imageData.url) return imageData.url;
      if (imageData.link) return imageData.link;
    }

    // Default placeholder
    return 'https://via.placeholder.com/300';
  };

  // Helper function to get the audio URL from download_url array
  const getAudioUrl = (downloadUrls: any[]): string => {
    if (
      !downloadUrls ||
      !Array.isArray(downloadUrls) ||
      downloadUrls.length === 0
    ) {
      return '';
    }

    // Get the highest quality (last index) download URL
    const highestQuality = downloadUrls[downloadUrls.length - 1];
    if (highestQuality && highestQuality.link) {
      return highestQuality.link;
    }

    // Fallback to any available download URL
    for (let i = downloadUrls.length - 1; i >= 0; i--) {
      const url = downloadUrls[i];
      if (url && url.link) {
        return url.link;
      }
    }

    return '';
  };

  // Render playlist item for featured playlists
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
            source={{ uri: imageUrl }}  // replace with your logo
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

  // Render song item for trending songs
  const renderSongItem = ({ item }: { item: any }) => {
    // Check if it's an album or song
    const isAlbum = item.type === 'album';
    const artistName = item.subtitle || 'Unknown Artist';

    // Get image URL based on item type
    const imageUrl = getImageUrl(item.image);

    // Get audio URL for songs
    const audioUrl = isAlbum ? '' : getAudioUrl(item.download_url || []);

    return (
      <TouchableOpacity
        style={[styles.songItem, isDark && styles.darkItem]}
        key={item.id}
        onPress={() => {
          if (isAlbum) {
            navigateToAlbum(item.url, item.name);
          } else {
            // Navigate to song details (optional - can implement later)
            // For now, just view album or artist
            if (item.album && item.album.url) {
              navigateToAlbum(item.album.url, item.album.name || 'Album');
            } else if (
              item.primary_artists_id &&
              item.primary_artists_id.length > 0 &&
              item.url
            ) {
              // Get the first artist
              navigateToArtist(
                item.primary_artists_id[0],
                artistName,
                item.url
              );
            }
          }
        }}
      >
        <Image source={{ uri: imageUrl }} style={styles.songCover} />
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
            {artistName}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.playButton}
          onPress={(e) => {
            e.stopPropagation(); // Prevent parent onPress from firing
            if (isAlbum) {
              navigateToAlbum(item.url, item.name);
            } else {
              const song = {
                id: item.id,
                title: item.name,
                artist: artistName,
                album: item.album || '',
                artwork: imageUrl,
                duration: item.duration || 0,
                audioUrl: audioUrl,
                year: '',
              };
              console.log('Playing song with URL:', audioUrl);
              playSong(song, true);
            }
          }}
        >
          <Play size={16} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Render album item for new releases
  const renderAlbumItem = ({ item }: { item: any }) => {
    // Get image URL with specific handling for album format
    const imageUrl = getImageUrl(item.image);

    return (
      <TouchableOpacity
        style={styles.albumCard}
        key={item.id}
        onPress={() => navigateToAlbum(item.url, item.name)}
      >
        <Image source={{ uri: imageUrl }} style={styles.albumCover} />
        <Text
          style={[styles.albumTitle, isDark && styles.darkText]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text style={[styles.albumInfo, isDark && styles.darkSubText]}>
          {item.subtitle.slice(0, 20) || ''}{item.subtitle.length > 20 ? '...' : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render artist item for popular artists
  const renderArtistItem = ({ item }: { item: any }) => {
    // Artists have image as an array of objects
    const imageUrl = getImageUrl(item.image);

    return (
      <TouchableOpacity
        style={styles.artistCard}
        key={item.id}
        onPress={() => navigateToArtist(item.id, item.name, item.url)}
      >
        <Image source={{ uri: imageUrl }} style={styles.artistImage} />
        <Text
          style={[styles.artistName, isDark && styles.darkText]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.follower_count && (
          <Text style={[styles.artistFollowers, isDark && styles.darkSubText]}>
            {formatFollowerCount(parseInt(item.follower_count) || 0)} followers
          </Text>
        )}
      </TouchableOpacity>
    );
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

  // Render header with personalized greeting
  const renderHeader = () => {
    const currentHour = new Date().getHours();
    let greeting = 'Good evening';

    if (currentHour >= 5 && currentHour < 12) {
      greeting = 'Good morning';
    } else if (currentHour >= 12 && currentHour < 18) {
      greeting = 'Good afternoon';
    }

    return (
      <View
        style={styles.headerContainer}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.greeting, isDark && styles.darkText]}>
            {greeting}
          </Text>
        </View>
        <Link href="/test">
          <Text>
            Test
          </Text>
        </Link>
      </View>
    );
  };

  // Render category section
  const renderCategory = (category: Category) => {
    const data = getCategoryData(category.type);

    let renderItem;
    if (category.type === 'artists') {
      renderItem = renderArtistItem;
    } else if (category.type === 'featured') {
      renderItem = renderPlaylistItem;
    } else if (category.type === 'new') {
      renderItem = renderAlbumItem;
    } else {
      renderItem = renderSongItem;
    }

    return (
      <View style={styles.categoryContainer}>
        <Text style={[styles.categoryTitle, isDark && styles.darkText]}>
          {category.title}
        </Text>
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator
                size="small"
                color="#E53935"
                style={styles.loader}
              />
            ) : (
              <Text style={[styles.emptyText, isDark && styles.darkSubText]}>
                No items to display
              </Text>
            )
          }
        />
      </View>
    );
  };

  // Get data based on category type
  const getCategoryData = (type: string) => {
    switch (type) {
      case 'featured':
        return featuredPlaylists;
      case 'trending':
        return trendingSongs;
      case 'new':
        return newReleases;
      case 'artists':
        return popularArtists;
      default:
        return [];
    }
  };

  // Render offline state
  const renderOfflineState = () => {
    return (
      <View style={[styles.offlineContainer, isDark && styles.darkOfflineContainer]}>
        <WifiOff size={64} color={isDark ? '#555' : '#999'} />
        <Text style={[styles.offlineTitle, isDark && styles.darkText]}>
          You're Offline
        </Text>
        <Text style={[styles.offlineMessage, isDark && styles.darkSubText]}>
          Connect to the internet to browse music
        </Text>
        <TouchableOpacity
          style={styles.offlineButton}
          onPress={() => router.push('/library')}
        >
          <Text style={styles.offlineButtonText}>
            Go to Downloads
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (
    isLoading &&
    !featuredPlaylists.length &&
    !trendingSongs.length &&
    !popularArtists.length
  ) {
    return (
      <View
        style={[
          styles.container,
          isDark && styles.darkContainer,
          styles.loadingContainer,
        ]}
      >
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Loading music...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#E53935']}
            tintColor={isDark ? '#E53935' : undefined}
          />
        }
      >
        <Stack.Screen
          options={{
            title: 'Home',
            headerRight: () => (
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleRefresh}
              >
                <RefreshCw size={20} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            ),
          }}
        />

        {!hasConnection ? (
          renderOfflineState()
        ) : (
          <>
            {renderHeader()}
            {HOME_CATEGORIES.map((category) => (
              <View key={category.id}>{renderCategory(category)}</View>
            ))}
          </>
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
  headerContainer: {
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  categoryContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  categoryTitle: {
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
  imageWrapper: {
    position: 'relative',
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
  
  topRightBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#001F84',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 320,
    backgroundColor: '#f2f2f2',
    borderRadius: 6,
    padding: 8,
    marginRight: 16,
  },
  darkItem: {
    backgroundColor: '#282828',
  },
  songCover: {
    width: 48,
    height: 48,
    borderRadius: 4,
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
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  darkText: {
    color: '#fff',
  },
  darkSubText: {
    color: '#aaa',
  },
  loader: {
    padding: 20,
  },
  emptyText: {
    padding: 20,
    color: '#888',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#000',
  },
  footer: {
    height: 80, // Increased space for music player bar plus tab bar
    width: '100%',
  },
  refreshButton: {
    padding: 8,
  },
  offlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
    marginHorizontal: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  darkOfflineContainer: {
    backgroundColor: '#222',
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  offlineMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  offlineButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
  },
  offlineButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
