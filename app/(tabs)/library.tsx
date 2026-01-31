import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Image, TouchableOpacity, useColorScheme, Alert, TouchableHighlight, RefreshControl, Modal, Animated } from 'react-native';
import { Play, Plus, Search, Download, Music, Trash2, X, MoreVertical, List, Wifi, WifiOff, DiscAlbum } from 'lucide-react-native';
import { useMusic, Song as MusicSong } from '../components/music/MusicContext';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetwork } from '../components/NetworkContext';
import { useTheme } from '../hooks/useTheme';

// Define playlist type
interface Playlist {
  id: string;
  title: string;
  count: number;
  image: string;
  type: string;
}

// Extend Song type to include playlistId and albumId
interface Song extends MusicSong {
  playlistId?: string;
  albumId?: string;
}

const PLAYLISTS: Playlist[] = [
  {
    id: 'likes',
    title: 'Liked Songs',
    count: 37,
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
    type: 'system'
  },
  {
    id: 'playlist1',
    title: 'Road Trip Mix',
    count: 24,
    image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop',
    type: 'custom'
  },
  {
    id: 'playlist2',
    title: 'Workout Jams',
    count: 18,
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
    type: 'custom'
  },
  {
    id: 'playlist3',
    title: 'Chill Vibes',
    count: 42,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop',
    type: 'custom'
  },
];

export default function LibraryScreen() {
  const colorScheme = useColorScheme();
  const { isDark } = useTheme();
  const { playSong, updateQueue } = useMusic();
  const { isConnected, isInternetReachable } = useNetwork();
  const hasConnection = isConnected && isInternetReachable;
  
  const [downloadedSongs, setDownloadedSongs] = useState<Song[]>([]);
  const [downloadedPlaylists, setDownloadedPlaylists] = useState<any[]>([]);
  const [downloadedAlbums, setDownloadedAlbums] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPlaylists, setExpandedPlaylists] = useState<{[key: string]: boolean}>({});
  const [expandedAlbums, setExpandedAlbums] = useState<{[key: string]: boolean}>({});
  const [activeTab, setActiveTab] = useState<'playlists' | 'albums' | 'artists' | 'downloaded'>('playlists');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'playlist' | 'album' | 'song', item: any} | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuItem, setContextMenuItem] = useState<{type: 'playlist' | 'album' | 'song', item: any} | null>(null);
  
  const contextMenuOpacity = useRef(new Animated.Value(0)).current;
  
  // Toggle playlist expansion
  const togglePlaylistExpansion = (playlistId: string) => {
    setExpandedPlaylists(prev => ({
      ...prev,
      [playlistId]: !prev[playlistId]
    }));
  };
  
  // Toggle album expansion
  const toggleAlbumExpansion = (albumId: string) => {
    setExpandedAlbums(prev => ({
      ...prev,
      [albumId]: !prev[albumId]
    }));
  };
  
  // Load downloaded songs and playlists
  useEffect(() => {
    loadDownloadedContent();
  }, []);
  
  const loadDownloadedContent = async () => {
    try {
      setIsLoading(true);
      
      // Load downloaded song IDs
      const storedSongIds = await AsyncStorage.getItem('downloaded_songs');
      const downloadedSongIds = storedSongIds ? JSON.parse(storedSongIds) : [];
      
      // Load downloaded playlist IDs
      const storedPlaylistIds = await AsyncStorage.getItem('downloaded_playlists');
      const downloadedPlaylistIds = storedPlaylistIds ? JSON.parse(storedPlaylistIds) : [];
      
      // Load downloaded album IDs
      const storedAlbumIds = await AsyncStorage.getItem('downloaded_albums');
      const downloadedAlbumIds = storedAlbumIds ? JSON.parse(storedAlbumIds) : [];
      
      // Load song details for each downloaded song
      const songs: Song[] = [];
      for (const songId of downloadedSongIds) {
        const songData = await AsyncStorage.getItem(`song_${songId}`);
        if (songData) {
          songs.push(JSON.parse(songData));
        }
      }
      
      // Group songs by playlist
      const songsByPlaylist: {[playlistId: string]: Song[]} = {};
      songs.forEach(song => {
        if (song.playlistId) {
          if (!songsByPlaylist[song.playlistId]) {
            songsByPlaylist[song.playlistId] = [];
          }
          songsByPlaylist[song.playlistId].push(song);
        }
      });
      
      // Group songs by album
      const songsByAlbum: {[albumId: string]: Song[]} = {};
      songs.forEach(song => {
        if (song.albumId) {
          if (!songsByAlbum[song.albumId]) {
            songsByAlbum[song.albumId] = [];
          }
          songsByAlbum[song.albumId].push(song);
        }
      });
      
      // Load playlist details for each downloaded playlist
      const playlists: any[] = [];
      for (const playlistId of downloadedPlaylistIds) {
        const playlistData = await AsyncStorage.getItem(`playlist_${playlistId}`);
        if (playlistData) {
          const playlist = JSON.parse(playlistData);
          // Add songs to playlist
          playlist.songs = songsByPlaylist[playlistId] || [];
          playlists.push(playlist);
        }
      }
      
      // Load album details for each downloaded album
      const albums: any[] = [];
      for (const albumId of downloadedAlbumIds) {
        const albumData = await AsyncStorage.getItem(`album_${albumId}`);
        if (albumData) {
          const album = JSON.parse(albumData);
          // Add songs to album
          album.songs = songsByAlbum[albumId] || [];
          albums.push(album);
        }
      }
      
      setDownloadedSongs(songs);
      setDownloadedPlaylists(playlists);
      setDownloadedAlbums(albums);
    } catch (error) {
      console.error('Error loading downloaded content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to playlist detail
  const navigateToPlaylist = (playlistId: string) => {
    router.push(`/playlist/${playlistId}`);
  };
  
  // Navigate to album detail
  const navigateToAlbum = (albumId: string) => {
    router.push(`/albums/${albumId}`);
  };
  
  // Play a downloaded song
  const playDownloadedSong = (song: Song) => {
    // Use the locally stored file URL
    if (song.playlistId) {
      // Find the playlist this song belongs to
      const playlist = downloadedPlaylists.find(p => p.id === song.playlistId);
      if (playlist) {
        // Play song with playlist context
        playSong(song);
        
        // Update queue with all songs from this playlist
        updateQueue({
          id: playlist.id,
          name: playlist.name,
          type: 'playlist',
          songs: playlist.songs || []
        });
      } else {
        playSong(song);
      }
    } else if (song.albumId) {
      // Find the album this song belongs to
      const album = downloadedAlbums.find(a => a.id === song.albumId);
      if (album) {
        // Play song with album context
        playSong(song);
        
        // Update queue with all songs from this album
        updateQueue({
          id: album.id,
          name: album.name,
          type: 'album',
          songs: album.songs || []
        });
      } else {
        playSong(song);
      }
    } else {
      // No playlist or album context, just play the song
      playSong(song);
      updateQueue({
        id: 'songs',
        name: 'Songs',
        type: 'song',
        songs: downloadedSongs
      });
    }
  };

  // Handle deletion confirmation
  const confirmDelete = () => {
    if (!itemToDelete) return;
    
    switch (itemToDelete.type) {
      case 'playlist':
        deletePlaylist(itemToDelete.item.id, itemToDelete.item.name);
        break;
      case 'album':
        deleteAlbum(itemToDelete.item.id, itemToDelete.item.name);
        break;
      case 'song':
        deleteSong(itemToDelete.item);
        break;
    }
    
    setDeleteModalVisible(false);
    setItemToDelete(null);
  };
  
  // Open delete modal
  const openDeleteModal = (type: 'playlist' | 'album' | 'song', item: any) => {
    setItemToDelete({ type, item });
    setDeleteModalVisible(true);
  };
  
  // Delete a downloaded playlist
  const deletePlaylist = async (playlistId: string, playlistName: string) => {
    Alert.alert(
      'Delete Downloaded Playlist',
      `Are you sure you want to delete "${playlistName}" and all its downloaded songs?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Get the playlist data
              const playlistData = await AsyncStorage.getItem(`playlist_${playlistId}`);
              if (!playlistData) return;
              
              const playlist = JSON.parse(playlistData);
              
              // Delete the playlist directory
              const playlistDir = `${FileSystem.documentDirectory}playlists/${playlistId}/`;
              const dirInfo = await FileSystem.getInfoAsync(playlistDir);
              
              if (dirInfo.exists) {
                await FileSystem.deleteAsync(playlistDir, { idempotent: true });
              }
              
              // Get the list of all downloaded songs
              const downloadedSongsData = await AsyncStorage.getItem('downloaded_songs');
              let downloadedSongIds = downloadedSongsData ? JSON.parse(downloadedSongsData) : [];
              
              // Get all songs from this playlist
              const playlistSongs = downloadedSongs.filter(song => song.playlistId === playlistId);
              
              // Remove songs metadata
              for (const song of playlistSongs) {
                await AsyncStorage.removeItem(`song_${song.id}`);
                // Remove song ID from downloaded songs list
                downloadedSongIds = downloadedSongIds.filter((id: string) => id !== song.id);
              }
              
              // Update downloaded songs list
              await AsyncStorage.setItem('downloaded_songs', JSON.stringify(downloadedSongIds));
              
              // Remove playlist from downloaded playlists list
              const downloadedPlaylistsData = await AsyncStorage.getItem('downloaded_playlists');
              const downloadedPlaylistIds = downloadedPlaylistsData 
                ? JSON.parse(downloadedPlaylistsData).filter((id: string) => id !== playlistId) 
                : [];
              
              await AsyncStorage.setItem('downloaded_playlists', JSON.stringify(downloadedPlaylistIds));
              
              // Remove playlist metadata
              await AsyncStorage.removeItem(`playlist_${playlistId}`);
              
              // Refresh the list
              await loadDownloadedContent();
              
              Alert.alert('Success', `"${playlistName}" has been deleted`);
            } catch (error) {
              console.error('Error deleting playlist:', error);
              Alert.alert('Error', 'Failed to delete playlist');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };
  
  // Delete a downloaded album
  const deleteAlbum = async (albumId: string, albumName: string) => {
    Alert.alert(
      'Delete Downloaded Album',
      `Are you sure you want to delete "${albumName}" and all its downloaded songs?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Get the album data
              const albumData = await AsyncStorage.getItem(`album_${albumId}`);
              if (!albumData) return;
              
              const album = JSON.parse(albumData);
              
              // Delete the album directory
              const albumDir = `${FileSystem.documentDirectory}albums/${albumId}/`;
              const dirInfo = await FileSystem.getInfoAsync(albumDir);
              
              if (dirInfo.exists) {
                await FileSystem.deleteAsync(albumDir, { idempotent: true });
              }
              
              // Get the list of all downloaded songs
              const downloadedSongsData = await AsyncStorage.getItem('downloaded_songs');
              let downloadedSongIds = downloadedSongsData ? JSON.parse(downloadedSongsData) : [];
              
              // Get all songs from this album
              const albumSongs = downloadedSongs.filter(song => song.albumId === albumId);
              
              // Remove songs metadata
              for (const song of albumSongs) {
                await AsyncStorage.removeItem(`song_${song.id}`);
                // Remove song ID from downloaded songs list
                downloadedSongIds = downloadedSongIds.filter((id: string) => id !== song.id);
              }
              
              // Update downloaded songs list
              await AsyncStorage.setItem('downloaded_songs', JSON.stringify(downloadedSongIds));
              
              // Remove album from downloaded albums list
              const downloadedAlbumsData = await AsyncStorage.getItem('downloaded_albums');
              const downloadedAlbumIds = downloadedAlbumsData 
                ? JSON.parse(downloadedAlbumsData).filter((id: string) => id !== albumId) 
                : [];
              
              await AsyncStorage.setItem('downloaded_albums', JSON.stringify(downloadedAlbumIds));
              
              // Remove album metadata
              await AsyncStorage.removeItem(`album_${albumId}`);
              
              // Refresh the list
              await loadDownloadedContent();
              
              Alert.alert('Success', `"${albumName}" has been deleted`);
            } catch (error) {
              console.error('Error deleting album:', error);
              Alert.alert('Error', 'Failed to delete album');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Delete an individual downloaded song
  const deleteSong = async (song: Song) => {
    const parentName = song.playlistId ? 
      downloadedPlaylists.find(p => p.id === song.playlistId)?.name : 
      downloadedAlbums.find(a => a.id === song.albumId)?.name;
    
    Alert.alert(
      'Delete Downloaded Song',
      `Are you sure you want to delete "${song.title}" from "${parentName || 'downloads'}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Delete the song file
              let songFilePath = '';
              if (song.playlistId) {
                songFilePath = `${FileSystem.documentDirectory}playlists/${song.playlistId}/${song.id}.mp3`;
              } else if (song.albumId) {
                songFilePath = `${FileSystem.documentDirectory}albums/${song.albumId}/${song.id}.mp3`;
              }
              
              if (songFilePath) {
                const fileInfo = await FileSystem.getInfoAsync(songFilePath);
                if (fileInfo.exists) {
                  await FileSystem.deleteAsync(songFilePath, { idempotent: true });
                }
              }
              
              // Remove song from downloaded songs list
              const downloadedSongsData = await AsyncStorage.getItem('downloaded_songs');
              const downloadedSongIds = downloadedSongsData 
                ? JSON.parse(downloadedSongsData).filter((id: string) => id !== song.id) 
                : [];
              
              await AsyncStorage.setItem('downloaded_songs', JSON.stringify(downloadedSongIds));
              
              // Remove song metadata
              await AsyncStorage.removeItem(`song_${song.id}`);
              
              // Refresh the list
              await loadDownloadedContent();
              
              Alert.alert('Success', `"${song.title}" has been deleted`);
            } catch (error) {
              console.error('Error deleting song:', error);
              Alert.alert('Error', 'Failed to delete song');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Show context menu for an item
  const showContextMenu = (type: 'playlist' | 'album' | 'song', item: any, x: number, y: number) => {
    setContextMenuItem({ type, item });
    setContextMenuPosition({ x, y });
    setContextMenuVisible(true);
    
    Animated.timing(contextMenuOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true
    }).start();
  };
  
  // Hide context menu
  const hideContextMenu = () => {
    Animated.timing(contextMenuOpacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true
    }).start(() => {
      setContextMenuVisible(false);
      setContextMenuItem(null);
    });
  };
  
  // Handle long press to show context menu
  const handleItemLongPress = (type: 'playlist' | 'album' | 'song', item: any, event: any) => {
    // Get the position of the touch
    const { pageX, pageY } = event.nativeEvent;
    showContextMenu(type, item, pageX, pageY);
  };
  
  // Handle delete from context menu
  const handleDeleteFromMenu = () => {
    if (!contextMenuItem) return;
    
    hideContextMenu();
    openDeleteModal(contextMenuItem.type, contextMenuItem.item);
  };

  // Show offline message if no internet
  const renderOfflineMessage = () => {
    if (hasConnection) return null;
    
    return (
      <View style={[styles.offlineMessageContainer, isDark && styles.darkOfflineMessageContainer]}>
        <WifiOff size={32} color={isDark ? '#fff' : '#000'} />
        <Text style={[styles.offlineMessageTitle, isDark && styles.darkText]}>You're offline</Text>
        <Text style={[styles.offlineMessageText, isDark && styles.darkSubtext]}>
          You can still access your downloaded music in offline mode
        </Text>
        <TouchableOpacity 
          style={styles.offlineActionButton} 
          onPress={() => setActiveTab('downloaded')}
        >
          <Text style={styles.offlineActionButtonText}>View Downloads</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Modify onRefresh to check connection
  const onRefresh = async () => {
    setRefreshing(true);
    
    if (!hasConnection) {
      Alert.alert(
        "No Internet Connection", 
        "You're currently offline. Please connect to the internet to refresh your library.",
        [{ text: "OK" }]
      );
      setRefreshing(false);
      return;
    }
    
    await loadDownloadedContent();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.darkText]}>Your Library</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerButton}>
            <Search size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Plus size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E53935']}
            tintColor={isDark ? '#E53935' : undefined}
          />
        }
      >
        {!hasConnection && activeTab !== 'downloaded' ? (
          renderOfflineMessage()
        ) : (
          <>
            <View style={styles.filterContainer}>
              <TouchableOpacity 
                style={[
                  styles.filterChip, 
                  activeTab === 'playlists' && styles.activeFilterChip
                ]}
                onPress={() => setActiveTab('playlists')}
              >
                <Text style={activeTab === 'playlists' ? styles.activeFilterText : [styles.filterText, isDark && styles.darkSubtext]}>
                  Playlists
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.filterChip,
                  activeTab === 'albums' && styles.activeFilterChip
                ]}
                onPress={() => setActiveTab('albums')}
              >
                <Text style={activeTab === 'albums' ? styles.activeFilterText : [styles.filterText, isDark && styles.darkSubtext]}>
                  Albums
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.filterChip,
                  activeTab === 'artists' && styles.activeFilterChip
                ]}
                onPress={() => setActiveTab('artists')}
              >
                <Text style={activeTab === 'artists' ? styles.activeFilterText : [styles.filterText, isDark && styles.darkSubtext]}>
                  Artists
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.filterChip,
                  activeTab === 'downloaded' && styles.activeFilterChip
                ]}
                onPress={() => setActiveTab('downloaded')}
              >
                <Text style={activeTab === 'downloaded' ? styles.activeFilterText : [styles.filterText, isDark && styles.darkSubtext]}>
                  Downloaded
                </Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'playlists' && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Your Playlists</Text>
                
                {/* Regular Playlists */}
                {PLAYLISTS.map((playlist) => (
                  <TouchableOpacity
                    key={playlist.id}
                    style={[styles.playlistItem, isDark && styles.darkBorder]}
                    onPress={() => navigateToPlaylist(playlist.id)}
                  >
                    <Image source={{ uri: playlist.image }} style={styles.playlistImage} />
                    <View style={styles.playlistInfo}>
                      <Text style={[styles.playlistTitle, isDark && styles.darkText]}>
                        {playlist.title}
                      </Text>
                      <Text style={[styles.playlistSubtitle, isDark && styles.darkSubtext]}>
                        Playlist • {playlist.count} songs
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            {activeTab === 'albums' && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Your Albums</Text>
                
                {/* No regular albums yet */}
                <View style={styles.emptyStateContainer}>
                  <Music size={48} color={isDark ? '#555' : '#999'} />
                  <Text style={[styles.emptyStateText, isDark && styles.darkSubtext]}>
                    Your saved albums will appear here
                  </Text>
                </View>
              </View>
            )}
            
            {activeTab === 'downloaded' && (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Downloaded Playlists</Text>
                  </View>
                  
                  {/* Downloaded Playlists with nested songs */}
                  {downloadedPlaylists.length > 0 ? (
                    downloadedPlaylists.map((playlist) => (
                      <View key={playlist.id}>
                        <TouchableHighlight
                          style={[styles.playlistItem, isDark && styles.darkBorder]}
                          onPress={() => togglePlaylistExpansion(playlist.id)}
                          onLongPress={(event) => handleItemLongPress('playlist', playlist, event)}
                          underlayColor={isDark ? '#333' : '#f0f0f0'}
                          delayLongPress={500}
                        >
                          <View style={styles.playlistItemContent}>
                            <Image source={{ uri: playlist.imageUrl }} style={styles.playlistImage} />
                            <View style={styles.playlistInfo}>
                              <Text style={[styles.playlistTitle, isDark && styles.darkText]}>
                                {playlist.name} <Download size={12} color="#E53935" />
                              </Text>
                              <Text style={[styles.playlistSubtitle, isDark && styles.darkSubtext]}>
                                Downloaded • {playlist.songs?.length || 0} songs
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.expandButton}
                              onPress={() => togglePlaylistExpansion(playlist.id)}
                            >
                              <Text style={styles.expandButtonText}>{expandedPlaylists[playlist.id] ? '▼' : '▶'}</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableHighlight>
                        
                        {expandedPlaylists[playlist.id] && playlist.songs && playlist.songs.length > 0 && (
                          <View style={[styles.nestedSongsList, isDark && styles.darkNestedList]}>
                            {playlist.songs.map((song: Song) => (
                              <TouchableHighlight
                                key={song.id}
                                style={[styles.nestedSongItem, isDark && styles.darkNestedItem]}
                                onPress={() => playDownloadedSong(song)}
                                onLongPress={(event) => handleItemLongPress('song', song, event)}
                                underlayColor={isDark ? '#333' : '#f0f0f0'}
                                delayLongPress={500}
                              >
                                <View style={styles.songItemContent}>
                                  <Image source={{ uri: song.artwork }} style={styles.nestedSongImage} />
                                  <View style={styles.songInfo}>
                                    <Text style={[styles.songTitle, isDark && styles.darkText]} numberOfLines={1}>
                                      {song.title}
                                    </Text>
                                    <Text style={[styles.songSubtitle, isDark && styles.darkSubtext]} numberOfLines={1}>
                                      {song.artist}
                                    </Text>
                                  </View>
                                  <TouchableOpacity 
                                    style={styles.songPlayButton}
                                    onPress={() => playDownloadedSong(song)}
                                  >
                                    <Play size={14} color="#fff" />
                                  </TouchableOpacity>
                                </View>
                              </TouchableHighlight>
                            ))}
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyStateContainer}>
                      <List size={48} color={isDark ? '#555' : '#999'} />
                      <Text style={[styles.emptyStateText, isDark && styles.darkSubtext]}>
                        No downloaded playlists yet
                      </Text>
                      <Text style={[styles.emptyStateSubtext, isDark && styles.darkSubtext]}>
                        Download playlists to listen offline
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Downloaded Songs</Text>
                  </View>
                  
                  {downloadedSongs.length > 0 ? (
                    <FlatList
                      data={downloadedSongs.filter(song => !song.playlistId)}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableHighlight
                          style={[styles.songItem, isDark && styles.darkSongItem]}
                          onPress={() => playDownloadedSong(item)}
                          onLongPress={(event) => handleItemLongPress('song', item, event)}
                          underlayColor={isDark ? '#333' : '#f0f0f0'}
                          delayLongPress={500}
                        >
                          <View style={styles.songItemContent}>
                            <Image source={{ uri: item.artwork }} style={styles.songImage} />
                            <View style={styles.songInfo}>
                              <Text style={[styles.songTitle, isDark && styles.darkText]} numberOfLines={1}>
                                {item.title}
                              </Text>
                              <Text style={[styles.songSubtitle, isDark && styles.darkSubtext]} numberOfLines={1}>
                                {item.artist}
                              </Text>
                            </View>
                            <TouchableOpacity 
                              style={styles.songPlayButton}
                              onPress={() => playDownloadedSong(item)}
                            >
                              <Play size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        </TouchableHighlight>
                      )}
                      scrollEnabled={false}
                      style={styles.songsListContainer}
                    />
                  ) : (
                    <View style={styles.emptyStateContainer}>
                      <Music size={48} color={isDark ? '#555' : '#999'} />
                      <Text style={[styles.emptyStateText, isDark && styles.darkSubtext]}>
                        No downloaded songs yet
                      </Text>
                      <Text style={[styles.emptyStateSubtext, isDark && styles.darkSubtext]}>
                        Download songs to listen offline
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Downloaded Albums</Text>
                  </View>
                  
                  {/* Downloaded Albums with nested songs */}
                  {downloadedAlbums.length > 0 ? (
                    downloadedAlbums.map((album) => (
                      <View key={album.id}>
                        <TouchableHighlight
                          style={[styles.playlistItem, isDark && styles.darkBorder]}
                          onPress={() => toggleAlbumExpansion(album.id)}
                          onLongPress={(event) => handleItemLongPress('album', album, event)}
                          underlayColor={isDark ? '#333' : '#f0f0f0'}
                          delayLongPress={500}
                        >
                          <View style={styles.playlistItemContent}>
                            <Image source={{ uri: album.imageUrl }} style={styles.playlistImage} />
                            <View style={styles.playlistInfo}>
                              <Text style={[styles.playlistTitle, isDark && styles.darkText]}>
                                {album.name} <Download size={12} color="#E53935" />
                              </Text>
                              <Text style={[styles.playlistSubtitle, isDark && styles.darkSubtext]}>
                                {album.subtitle} • {album.songs?.length || 0} songs
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.expandButton}
                              onPress={() => toggleAlbumExpansion(album.id)}
                            >
                              <Text style={styles.expandButtonText}>{expandedAlbums[album.id] ? '▼' : '▶'}</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableHighlight>
                        
                        {expandedAlbums[album.id] && album.songs && album.songs.length > 0 && (
                          <View style={[styles.nestedSongsList, isDark && styles.darkNestedList]}>
                            {album.songs.map((song: Song) => (
                              <TouchableHighlight
                                key={song.id}
                                style={[styles.nestedSongItem, isDark && styles.darkNestedItem]}
                                onPress={() => playDownloadedSong(song)}
                                onLongPress={(event) => handleItemLongPress('song', song, event)}
                                underlayColor={isDark ? '#333' : '#f0f0f0'}
                                delayLongPress={500}
                              >
                                <View style={styles.songItemContent}>
                                  <Image source={{ uri: song.artwork }} style={styles.nestedSongImage} />
                                  <View style={styles.songInfo}>
                                    <Text style={[styles.songTitle, isDark && styles.darkText]} numberOfLines={1}>
                                      {song.title}
                                    </Text>
                                    <Text style={[styles.songSubtitle, isDark && styles.darkSubtext]} numberOfLines={1}>
                                      {song.artist}
                                    </Text>
                                  </View>
                                  <TouchableOpacity 
                                    style={styles.songPlayButton}
                                    onPress={() => playDownloadedSong(song)}
                                  >
                                    <Play size={14} color="#fff" />
                                  </TouchableOpacity>
                                </View>
                              </TouchableHighlight>
                            ))}
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyStateContainer}>
                      <DiscAlbum  size={48} color={isDark ? '#555' : '#999'} />
                      <Text style={[styles.emptyStateText, isDark && styles.darkSubtext]}>
                        No downloaded albums yet
                      </Text>
                      <Text style={[styles.emptyStateSubtext, isDark && styles.darkSubtext]}>
                        Download albums to listen offline
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Context Menu */}
      {contextMenuVisible && (
        <TouchableOpacity 
          style={styles.contextMenuOverlay}
          activeOpacity={1}
          onPress={hideContextMenu}
        >
          <Animated.View 
            style={[
              styles.contextMenu, 
              isDark && styles.darkContextMenu,
              { 
                opacity: contextMenuOpacity,
                top: contextMenuPosition.y - 40,
                left: Math.min(contextMenuPosition.x - 100, (contextMenuPosition.x > 100 ? contextMenuPosition.x : contextMenuPosition.x))
              }
            ]}
          >
            <View style={styles.contextMenuHeader}>
              <Text style={[styles.contextMenuTitle, isDark && styles.darkText]} numberOfLines={1}>
                {contextMenuItem?.type === 'playlist' && contextMenuItem?.item.name}
                {contextMenuItem?.type === 'album' && contextMenuItem?.item.name}
                {contextMenuItem?.type === 'song' && contextMenuItem?.item.title}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.contextMenuItem}
              onPress={handleDeleteFromMenu}
            >
              <Trash2 size={18} color="#FF3B30" style={styles.contextMenuIcon} />
              <Text style={[styles.contextMenuText, isDark && styles.darkText]}>
                Delete {contextMenuItem?.type}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, isDark && styles.darkModalContainer]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.darkText]}>
                Confirm Delete
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <X size={24} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={[styles.modalText, isDark && styles.darkText]}>
                {itemToDelete?.type === 'playlist' && `Delete playlist "${itemToDelete.item.name}"?`}
                {itemToDelete?.type === 'album' && `Delete album "${itemToDelete.item.name}"?`}
                {itemToDelete?.type === 'song' && `Delete song "${itemToDelete.item.title}"?`}
              </Text>
              
              <Text style={[styles.modalSubtext, isDark && styles.darkSubtext]}>
                {itemToDelete?.type === 'playlist' && 'This will remove all downloaded songs in this playlist.'}
                {itemToDelete?.type === 'album' && 'This will remove all downloaded songs in this album.'}
                {itemToDelete?.type === 'song' && 'This will remove the downloaded audio file.'}
              </Text>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setDeleteModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalDeleteButton]}
                  onPress={confirmDelete}
                >
                  <Text style={styles.modalButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  activeFilterChip: {
    backgroundColor: '#f0f0f0',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  sectionButton: {
    padding: 4,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  playlistImage: {
    width: 56,
    height: 56,
    borderRadius: 4,
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playlistTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  playlistSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  divider: {
    height: 8,
    backgroundColor: 'rgba(94, 89, 92, 0.2)',
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  songImage: {
    width: 48,
    height: 48,
    borderRadius: 4,
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
  },
  songTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  songSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  songPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  nestedSongsList: {
    paddingLeft: 24,
    marginTop: 4,
    marginBottom: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
  },
  nestedSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 12,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  nestedSongImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  darkNestedItem: {
    backgroundColor: '#222',
    borderLeftColor: '#333',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  songDeleteButton: {
    padding: 8,
    marginRight: 4,
  },
  playlistItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  songItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  darkDeleteAction: {
    backgroundColor: '#CC3026',
  },
  expandButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandButtonText: {
    fontSize: 16,
    color: '#888',
    fontWeight: 'bold',
  },
  darkNestedList: {
    borderLeftColor: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  darkModalContainer: {
    backgroundColor: '#222',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalContent: {
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalSubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: '#888',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 120,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  modalDeleteButton: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Context menu styles
  contextMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  contextMenu: {
    position: 'absolute',
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    overflow: 'hidden'
  },
  darkContextMenu: {
    backgroundColor: '#333',
  },
  contextMenuHeader: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  contextMenuTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  contextMenuIcon: {
    marginRight: 10,
  },
  contextMenuText: {
    fontSize: 16,
  },
  songsListContainer: {
    marginVertical: 8,
  },
  itemSeparator: {
    height: 8,
    backgroundColor: '#f0f0f0',
  },
  darkSongItem: {
    borderBottomColor: '#333',
  },
  offlineMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 40,
    marginHorizontal: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  darkOfflineMessageContainer: {
    backgroundColor: '#222',
  },
  offlineMessageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  offlineMessageText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  offlineActionButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  offlineActionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  tabs: {
    flexDirection: 'row',
    padding: 8,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#E53935',
  },
  darkTabs: {
    backgroundColor: '#222',
  },
  darkActiveTab: {
    borderBottomColor: '#fff',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  activeTabText: {
    color: '#E53935',
  },
  darkTabText: {
    color: '#fff',
  },
  darkActiveTabText: {
    color: '#fff',
  },
});