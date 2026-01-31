import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Search as SearchIcon,
  X,
  Play,
  Music,
  Disc,
  ListMusic,
  WifiOff,
} from 'lucide-react-native';
import { useMusic, Song as MusicSong } from '../../components/music/MusicContext';
import { useNetwork } from '../../components/NetworkContext';
import apiClient, { Song } from '../../services/api';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { getTopSongs } from '../../services/musicApi';

// Sample genres
const GENRES = [
  { id: '1', name: 'Rock', color: '#E13300' },
  { id: '2', name: 'Pop', color: '#1ED760' },
  { id: '3', name: 'Hip-Hop', color: '#1E3264' },
  { id: '4', name: 'Electronic', color: '#E8115B' },
  { id: '5', name: 'R&B', color: '#148A08' },
  { id: '6', name: 'Classical', color: '#BC5900' },
  { id: '7', name: 'Jazz', color: '#7358FF' },
  { id: '8', name: 'Metal', color: '#777777' },
  { id: '9', name: 'Country', color: '#B02897' },
  { id: '10', name: 'Blues', color: '#503750' },
  { id: '11', name: 'Folk', color: '#D84000' },
  { id: '12', name: 'Indie', color: '#FF4632' },
];

// Search result types
enum SearchResultType {
  TopResults = 'top_results',
  Song = 'song',
  Artist = 'artist',
  Album = 'album',
  Playlist = 'playlist',
}

// Define interfaces for API responses
interface ArtistImage {
  quality?: string;
  link?: string;
  url?: string;
}

interface Artist {
  id: string;
  name: string;
  image: ArtistImage[];
  role?: string;
  type?: string;
}

interface Album {
  id: string;
  name: string;
  subtitle: string;
  year?: string | number;
  language?: string;
  image: ArtistImage[];
  url: string;
}

interface Playlist {
  id: string;
  name: string;
  songCount?: number;
  image: ArtistImage[];
  url: string;
  language: string;
}

interface ApiSong {
  id: string;
  name: string;
  subtitle?: string;
  image: ArtistImage[];
  album?: string;
  primary_artists?: string;
  language?: string;
  url?: string;
  year?: string | number;
}

// Add an interface for top query results
interface TopQuery {
  id: string;
  name: string;
  subtitle: string;
  type: string;
  image: ArtistImage[];
  description?: string;
  primary_artists?: string;
  url: string;
  position: number;
}

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const { isDark } = useTheme();
  const { playSong, isLoading } = useMusic();
  const { isConnected, isInternetReachable } = useNetwork();
  const hasConnection = isConnected && isInternetReachable;

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeTab, setActiveTab] = useState(SearchResultType.TopResults);
  const [topQuery, setTopQuery] = useState<TopQuery[]>([]);

  // Handle search when query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      if (hasConnection) {
        performSearch(searchQuery);
      } else if (searchQuery.trim().length > 0) {
        // If no connection, show an alert instead of performing search
        Alert.alert(
          "No Internet Connection",
          "You're offline. Connect to the internet to search for music.",
          [{ text: "OK" }]
        );
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, hasConnection]);

  // Perform search using the API
  const performSearch = async (query: string) => {
    if (!query.trim() || !hasConnection) return;

    try {
      setIsSearchLoading(true);
      // Search for all content
      const searchResult = await apiClient.searchAll(query);
      const songs = await getTopSongs(query);
      if (searchResult.status === 'Success') {
        // Update search results based on the response
        const { artists, albums, playlists, top_query } =
          searchResult.data;

        // Update top query results if available
        if (top_query && top_query.data) {
          setTopQuery(top_query.data || []);
          console.log('Top query results:', top_query.data);
        } else {
          setTopQuery([]);
        }

        // Update song results if available
        if (songs && songs) {
          setSongs(songs);
        } else {
          setSongs([]);
        }

        // Update other content types
        if (artists && artists.data) {
          setArtists(artists.data || []);
        } else {
          setArtists([]);
        }

        if (albums && albums.data) {
          setAlbums(albums.data || []);
        } else {
          setAlbums([]);
        }

        if (playlists && playlists.data) {
          setPlaylists(playlists.data || []);
        } else {
          setPlaylists([]);
        }
      }
    } catch (error) {
      console.error('Error performing search:', error);
    } finally {
      setIsSearchLoading(false);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setActiveTab(SearchResultType.TopResults);
  };

  // Save recent search
  const saveRecentSearch = (query: string) => {
    if (!query.trim() || recentSearches.includes(query.trim())) return;

    const newRecentSearches = [query.trim(), ...recentSearches.slice(0, 4)];
    setRecentSearches(newRecentSearches);
  };

  // Handle search from search button
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    if (!hasConnection) {
      Alert.alert(
        "No Internet Connection",
        "You're offline. Connect to the internet to search for music.",
        [{ text: "OK" }]
      );
      return;
    }
    
    saveRecentSearch(searchQuery);
    performSearch(searchQuery);
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  // Render genre item
  const renderGenreItem = ({ item }: { item: (typeof GENRES)[0] }) => (
    <TouchableOpacity
      style={[styles.genreItem, { backgroundColor: item.color }]}
      onPress={() => {
        setSearchQuery(item.name);
        handleSearch();
      }}
    >
      <Text style={styles.genreText}>{item.name}</Text>
    </TouchableOpacity>
  );

  // Navigate to artist details
  const navigateToArtist = (artistId: string, artistName: string) => {
    router.push({
      pathname: '/artists/details',
      params: { id: artistId, artist: artistName },
    });
  };

  const navigateToPlaylist = (playlistId: string, playlistName: string) => {
    // Extract ID from the URL
    const id = playlistId.split('/').pop() || playlistId;
    console.log('Navigating to playlist with ID:', id);

    router.push({
      pathname: '/playlist/[id]',
      params: { id: id, playlist: playlistName },
    });
  };

  const navigateToAlbum = (albumId: string, albumName: string) => {
    // Extract ID from the URL
    const id = albumId.split('/').pop() || albumId;
    console.log('Navigating to album with ID:', id);

    router.push({
      pathname: '/albums/[id]',
      params: { id: id, album: albumName },
    });
  };

  // Handle song play 
  const handlePlaySong = async (song: any,external?:boolean) => {
      console.log("song",song);
      const appSong = {
        id: song.id,
        title: song.name,
        artist: song.subtitle || 'Unknown Artist',
        album: song.album || 'Unknown Album',
        artwork:
          song.image,
        duration: song.duration,
        audioUrl:
          song.url,
        year: song.year || '',
      };
      if(external){  
        playSong(appSong,true);
      }else{
        playSong(appSong,true,true);
      }
  };

  // Render result tabs
  const renderResultTabs = () => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContainer}
        keyboardShouldPersistTaps="handled"
        accessible={false}
      >
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === SearchResultType.TopResults && styles.activeTab,
              isDark &&
                activeTab === SearchResultType.TopResults &&
                styles.darkActiveTab,
            ]}
            onPress={() => setActiveTab(SearchResultType.TopResults)}
          >
            <SearchIcon
              size={18}
              color={
                activeTab === SearchResultType.TopResults
                  ? isDark
                    ? '#fff'
                    : '#000'
                  : isDark
                  ? '#999'
                  : '#666'
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === SearchResultType.TopResults &&
                  styles.activeTabText,
                isDark && styles.darkTabText,
                isDark &&
                  activeTab === SearchResultType.TopResults &&
                  styles.darkActiveTabText,
              ]}
            >
              Top Results
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === SearchResultType.Song && styles.activeTab,
              isDark &&
                activeTab === SearchResultType.Song &&
                styles.darkActiveTab,
            ]}
            onPress={() => setActiveTab(SearchResultType.Song)}
          >
            <Music
              size={18}
              color={
                activeTab === SearchResultType.Song
                  ? isDark
                    ? '#fff'
                    : '#000'
                  : isDark
                  ? '#999'
                  : '#666'
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === SearchResultType.Song && styles.activeTabText,
                isDark && styles.darkTabText,
                isDark &&
                  activeTab === SearchResultType.Song &&
                  styles.darkActiveTabText,
              ]}
            >
              Songs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === SearchResultType.Artist && styles.activeTab,
              isDark &&
                activeTab === SearchResultType.Artist &&
                styles.darkActiveTab,
            ]}
            onPress={() => setActiveTab(SearchResultType.Artist)}
          >
            <Music
              size={18}
              color={
                activeTab === SearchResultType.Artist
                  ? isDark
                    ? '#fff'
                    : '#000'
                  : isDark
                  ? '#999'
                  : '#666'
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === SearchResultType.Artist && styles.activeTabText,
                isDark && styles.darkTabText,
                isDark &&
                  activeTab === SearchResultType.Artist &&
                  styles.darkActiveTabText,
              ]}
            >
              Artists
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === SearchResultType.Album && styles.activeTab,
              isDark &&
                activeTab === SearchResultType.Album &&
                styles.darkActiveTab,
            ]}
            onPress={() => setActiveTab(SearchResultType.Album)}
          >
            <Disc
              size={18}
              color={
                activeTab === SearchResultType.Album
                  ? isDark
                    ? '#fff'
                    : '#000'
                  : isDark
                  ? '#999'
                  : '#666'
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === SearchResultType.Album && styles.activeTabText,
                isDark && styles.darkTabText,
                isDark &&
                  activeTab === SearchResultType.Album &&
                  styles.darkActiveTabText,
              ]}
            >
              Albums
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === SearchResultType.Playlist && styles.activeTab,
              isDark &&
                activeTab === SearchResultType.Playlist &&
                styles.darkActiveTab,
            ]}
            onPress={() => setActiveTab(SearchResultType.Playlist)}
          >
            <ListMusic
              size={18}
              color={
                activeTab === SearchResultType.Playlist
                  ? isDark
                    ? '#fff'
                    : '#000'
                  : isDark
                  ? '#999'
                  : '#666'
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === SearchResultType.Playlist && styles.activeTabText,
                isDark && styles.darkTabText,
                isDark &&
                  activeTab === SearchResultType.Playlist &&
                  styles.darkActiveTabText,
              ]}
            >
              Playlists
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // Render search result content based on active tab
  const renderSearchResultContent = () => {
    if (isSearchLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53935" />
          <Text style={[styles.loadingText, isDark && styles.darkText]}>
            Searching...
          </Text>
        </View>
      );
    }

    switch (activeTab) {
      case SearchResultType.TopResults:
        return (
          <ScrollView
            contentContainerStyle={styles.topResultsContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Display top query match (if available) - this is the most relevant result */}
            {topQuery && topQuery.length > 0 &&  
              !songs.some(song => 
                song.name.toLowerCase() === topQuery[0].name.toLowerCase() && 
                song.artist.toLowerCase() === topQuery[0].primary_artists?.toLowerCase()
              ) && (
              <View style={styles.topResultSection}>
                <Text
                  style={[
                    styles.topResultSectionTitle,
                    isDark && styles.darkText,
                  ]}
                >
                  Best Match
                </Text>
                <TouchableOpacity
                  style={styles.bestMatchContainer}
                  onPress={() => {
                    const item = topQuery[0];
                    if (item.type === 'artist') {
                      navigateToArtist(item.id, item.name);
                    } else if (item.type === 'album') {
                      navigateToAlbum(item.url || '', item.name);
                    } else if (item.type === 'playlist') {
                      navigateToPlaylist(item.url || '', item.name);
                    } else if (item.type === 'song') {
                      handlePlaySong(item);
                    }
                  }}
                >
                  <Image
                    source={{
                      uri:
                        topQuery[0].image &&
                        Array.isArray(topQuery[0].image) &&
                        topQuery[0].image.length > 0
                          ? topQuery[0].image[topQuery[0].image.length - 1].link
                          : 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png',
                    }}
                    style={styles.bestMatchImage}
                  />
                  <View style={styles.bestMatchInfo}>
                    <Text
                      style={[styles.bestMatchTitle, isDark && styles.darkText]}
                    >
                      {topQuery[0].name}
                    </Text>
                    <Text
                      style={[
                        styles.bestMatchSubtitle,
                        isDark && styles.darkSubtext,
                      ]}
                    >
                      {topQuery[0].subtitle}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Display top songs (if available) */}
            {songs && songs.length > 0 && (
              <View style={styles.topResultSection}>
                <Text
                  style={[
                    styles.topResultSectionTitle,
                    isDark && styles.darkText,
                  ]}
                >
                  Songs
                </Text>
                <View style={styles.topSongsContainer}>
                  {songs.map((item, index) => {
                    // console.log("item",item);
                    const song = {
                      id: item.id || index+1,
                      name: item.name,
                      subtitle: item.artist,
                      image: item.thumbnail,
                      album: item.album,
                      primary_artists: item.artists,
                      language: `English`,
                      url: item.songUrl,
                      duration: item.duration,
                    }
                    const external = item.type == 'spotify' ? true : false;
                    return (  
                      <TouchableOpacity
                        key={index}
                        style={[styles.resultItem, isDark && styles.darkBorder]}
                        onPress={() => handlePlaySong(song,external)}
                    >
                      <Image
                        source={{
                          uri:
                            item.thumbnail ||
                            'https://via.placeholder.com/150',
                        }}
                        style={styles.resultImage}
                      />
                      <View style={styles.resultInfo}>
                        <Text
                          style={[
                            styles.resultTitle,
                            isDark && styles.darkText,
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.resultSubtitle,
                            isDark && styles.darkSubtext,
                          ]}
                        >
                          {item.artist}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.playButton}
                        onPress={() => handlePlaySong(song,external)}
                      >
                        <Play size={16} color="#fff" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                  })}
                </View>
              </View>
            )}

            {/* Display top artists (if available) */}
            {artists && artists.length > 0 && (
              <View style={styles.topResultSection}>
                <Text
                  style={[
                    styles.topResultSectionTitle,
                    isDark && styles.darkText,
                  ]}
                >
                  Artists
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.topArtistsContainer}>
                    {artists.slice(0, 4).map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.artistCard}
                        onPress={() => navigateToArtist(item.id, item.name)}
                      >
                        <Image
                          source={{
                            uri:
                              item.image[item.image.length - 1]?.link ||
                              item.image[item.image.length - 1]?.url ||
                              'https://www.jiosaavn.com/_i/3.0/artist-default-music.png',
                          }}
                          style={styles.artistCardImage}
                        />
                        <Text
                          style={[
                            styles.artistCardName,
                            isDark && styles.darkText,
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Display top albums (if available) */}
            {albums && albums.length > 0 && (
              <View style={styles.topResultSection}>
                <Text
                  style={[
                    styles.topResultSectionTitle,
                    isDark && styles.darkText,
                  ]}
                >
                  Albums
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.topAlbumsContainer}>
                    {albums.slice(0, 4).map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.albumCard}
                        onPress={() =>
                          navigateToAlbum(item.url || '', item.name)
                        }
                      >
                        <Image
                          source={{
                            uri:
                              item.image[item.image.length - 1]?.link ||
                              item.image[item.image.length - 1]?.url ||
                              'https://via.placeholder.com/150',
                          }}
                          style={styles.albumCardImage}
                        />
                        <Text
                          style={[
                            styles.albumCardName,
                            isDark && styles.darkText,
                          ]}
                          numberOfLines={2}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.albumCardSubtitle,
                            isDark && styles.darkSubtext,
                          ]}
                          numberOfLines={1}
                        >
                          {`${item.subtitle?.slice(0, 20)}${
                            item.subtitle?.length > 20 ? '...' : ''
                          }`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </ScrollView>
        );

      case SearchResultType.Song:
        return (
          <FlatList
            data={songs}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.resultItem, isDark && styles.darkBorder]}
                onPress={() => handlePlaySong(item)}
              >
                <Image
                  source={{
                    uri:
                      item.image[0]?.link || 'https://via.placeholder.com/150',
                  }}
                  style={styles.resultImage}
                />
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, isDark && styles.darkText]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.resultSubtitle,
                      isDark && styles.darkSubtext,
                    ]}
                  >
                    {item.subtitle ||
                      (item.primary_artists &&
                        `${item.primary_artists} • ${item.album || ''}`)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => handlePlaySong(item)}
                >
                  <Play size={16} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultsList}
            ListEmptyComponent={
              <Text style={[styles.emptyText, isDark && styles.darkText]}>
                No songs found
              </Text>
            }
          />
        );

      case SearchResultType.Artist:
        return (
          <FlatList
            data={artists}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.artistItem, isDark && styles.darkBorder]}
                onPress={() => navigateToArtist(item.id, item.name)}
              >
                <Image
                  source={{
                    uri:
                      item.image[0]?.link ||
                      item.image[0]?.url ||
                      'https://www.jiosaavn.com/_i/3.0/artist-default-music.png',
                  }}
                  style={styles.artistImage}
                />
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, isDark && styles.darkText]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.resultSubtitle,
                      isDark && styles.darkSubtext,
                    ]}
                  >
                    Artist
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultsList}
            ListEmptyComponent={
              <Text style={[styles.emptyText, isDark && styles.darkText]}>
                No artists found
              </Text>
            }
          />
        );

      case SearchResultType.Album:
        return (
          <FlatList
            data={albums}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => navigateToAlbum(item.url || '', item.name)}
                style={[styles.resultItem, isDark && styles.darkBorder]}
              >
                <Image
                  source={{
                    uri:
                      item.image[item.image.length - 1]?.link ||
                      item.image[item.image.length - 1]?.url ||
                      'https://via.placeholder.com/150',
                  }}
                  style={styles.albumImage}
                />
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, isDark && styles.darkText]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.resultSubtitle,
                      isDark && styles.darkSubtext,
                    ]}
                  >
                    {`${item.subtitle.slice(0, 20)}${
                      item.subtitle.length > 20 && '...'
                    }`}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultsList}
            ListEmptyComponent={
              <Text style={[styles.emptyText, isDark && styles.darkText]}>
                No albums found
              </Text>
            }
          />
        );

      case SearchResultType.Playlist:
        return (
          <FlatList
            data={playlists}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => navigateToPlaylist(item.url || '', item.name)}
                style={[styles.resultItem, isDark && styles.darkBorder]}
              >
                <View style={styles.imageWrapper}>
                  <Image
                    source={{
                      uri:
                        item.image && item.image.length > 0
                          ? item.image[item.image.length - 1].link ||
                            item.image[item.image.length - 1].url
                          : 'https://via.placeholder.com/150',
                    }}
                    style={styles.albumImage}
                  />
                  <Image
                    source={{
                      uri:
                        item.image && item.image.length > 0
                          ? item.image[item.image.length - 1].link ||
                            item.image[item.image.length - 1].url
                          : 'https://via.placeholder.com/150',
                    }}
                    style={styles.topLeftLogo}
                  />
                  <View style={styles.topRightBadge}>
                    <Text style={styles.badgeText}>English</Text>
                  </View>
                </View>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, isDark && styles.darkText]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.resultSubtitle,
                      isDark && styles.darkSubtext,
                    ]}
                  >
                    Playlist •{' '}
                    {item.language.charAt(0).toUpperCase() +
                      item.language.slice(1) || 'Unknown'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultsList}
            ListEmptyComponent={
              <Text style={[styles.emptyText, isDark && styles.darkText]}>
                No playlists found
              </Text>
            }
          />
        );

      default:
        return null;
    }
  };

  // Render offline message
  const renderOfflineMessage = () => {
    return (
      <View style={[styles.offlineContainer, isDark && styles.darkOfflineContainer]}>
        <WifiOff size={64} color={isDark ? '#555' : '#999'} />
        <Text style={[styles.offlineTitle, isDark && styles.darkText]}>
          You're Offline
        </Text>
        <Text style={[styles.offlineMessage, isDark && styles.darkSubtext]}>
          Connect to the internet to search for music
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

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.darkText]}>Search</Text>
      </View>

      <View
        style={[styles.searchContainer, isDark && styles.darkSearchContainer]}
      >
        <SearchIcon
          size={20}
          color={isDark ? '#aaa' : '#666'}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, isDark && styles.darkSearchInput]}
          placeholder="Artists, songs, or podcasts"
          placeholderTextColor={isDark ? '#777' : '#999'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <X size={18} color={isDark ? '#aaa' : '#666'} />
          </TouchableOpacity>
        ) : null}
      </View>

      {searchQuery ? (
        <View style={styles.searchResultsContainer}>
          <View
            style={[styles.tabsWrapperSticky, isDark && styles.darkTabsWrapper]}
          >
            {hasConnection ? renderResultTabs() : null}
          </View>
          <View style={styles.searchResultsContent}>
            {hasConnection ? renderSearchResultContent() : renderOfflineMessage()}
          </View>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          {!hasConnection ? (
            renderOfflineMessage()
          ) : (
            <>
              {recentSearches.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                      Recent searches
                    </Text>
                    <TouchableOpacity onPress={clearRecentSearches}>
                      <Text
                        style={[styles.clearText, isDark && styles.darkClearText]}
                      >
                        Clear all
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {recentSearches.map((query, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.recentItem, isDark && styles.darkBorder]}
                      onPress={() => {
                        if (!hasConnection) {
                          Alert.alert(
                            "No Internet Connection",
                            "You're offline. Connect to the internet to search for music.",
                            [{ text: "OK" }]
                          );
                          return;
                        }
                        setSearchQuery(query);
                        handleSearch();
                      }}
                    >
                      <Text style={[styles.recentText, isDark && styles.darkText]}>
                        {query}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                  Browse all
                </Text>
                <FlatList
                  data={GENRES}
                  renderItem={renderGenreItem}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  scrollEnabled={false}
                  contentContainerStyle={styles.genresList}
                />
              </View>
            </>
          )}
        </ScrollView>
      )}
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  darkText: {
    color: '#fff',
  },
  darkSubtext: {
    color: '#999',
  },
  darkBorder: {
    borderBottomColor: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    marginBottom: 16,
  },
  darkSearchContainer: {
    backgroundColor: '#333',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#000',
  },
  darkSearchInput: {
    color: '#fff',
  },
  clearButton: {
    padding: 8,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  clearText: {
    fontSize: 14,
    color: '#E53935',
  },
  darkClearText: {
    color: '#E53935',
  },
  recentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentText: {
    fontSize: 16,
    color: '#000',
  },
  genresList: {
    paddingVertical: 8,
  },
  genreItem: {
    flex: 1,
    margin: 8,
    height: 100,
    borderRadius: 8,
    padding: 16,
    justifyContent: 'flex-end',
  },
  genreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  searchResultsContainer: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabsScrollContainer: {
    paddingRight: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeTab: {
    backgroundColor: '#f0f0f0',
  },
  darkActiveTab: {
    backgroundColor: '#333',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  darkTabText: {
    color: '#999',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
  darkActiveTabText: {
    color: '#fff',
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 90, // Space for player bar
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  imageWrapper: {
    position: 'relative',
  },

  topLeftLogo: {
    position: 'absolute',
    borderRadius: 100,
    top: 2,
    left: 2,
    width: 8,
    height: 8,
    resizeMode: 'contain',
  },
  topRightBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#001F84',
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  badgeText: {
    color: '#fff',
    fontSize: 2,
    fontWeight: 'bold',
  },

  artistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  artistImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  albumImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#000',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
    color: '#666',
  },
  topResultsContainer: {
    paddingBottom: 90,
  },
  topResultSection: {
    marginBottom: 24,
  },
  topResultSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  topSongsContainer: {
    paddingHorizontal: 16,
  },
  topArtistsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingRight: 8,
  },
  topAlbumsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingRight: 8,
  },
  artistCard: {
    width: 120,
    marginRight: 12,
    alignItems: 'center',
  },
  artistCardImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  artistCardName: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  albumCard: {
    width: 140,
    marginRight: 12,
  },
  albumCardImage: {
    width: 140,
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
  },
  albumCardName: {
    fontSize: 14,
    fontWeight: '500',
  },
  albumCardSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  bestMatchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  bestMatchImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  bestMatchInfo: {
    marginLeft: 16,
    flex: 1,
  },
  bestMatchTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bestMatchSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  tabsWrapperSticky: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  darkTabsWrapper: {
    backgroundColor: '#121212',
  },
  searchResultsContent: {
    flex: 1,
  },
  offlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 30,
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
