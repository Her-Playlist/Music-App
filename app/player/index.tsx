import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Heart,
  Share,
  ChevronDown,
  Repeat,
  Shuffle,
  MoreVertical,
  Volume2,
  List,
} from 'lucide-react-native';
import { Stack, router } from 'expo-router';
import { useMusic } from '../components/music/MusicContext';
import { useNetwork } from '../components/NetworkContext';
import { useTheme } from '../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';
import * as Audio from 'expo-av';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/api';
import * as musicApi from '../services/musicApi';

// Get screen dimensions
const { width } = Dimensions.get('window');

// Define Song type to match what's in MusicContext and add position
type QueueSong = {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  album: string;
  audioUrl: string;
  position?: number; // Make position optional to match context type
  isRecommendation?: boolean;
};

export default function PlayerScreen() {
  const { isDark } = useTheme();
  const { isConnected, isInternetReachable } = useNetwork();
  const hasConnection = isConnected && isInternetReachable;

  // State from music context
  const {
    currentSong,
    isPlaying,
    currentTime,
    repeatMode,
    isShuffle,
    resumeSong,
    pauseSong,
    playNext,
    topSongs,
    topArtists,
    albumSongs,
    playPrevious,
    toggleRepeat,
    toggleShuffle,
    seekTo,
    setCurrentTime,
    recommendations,
    queue,
    playSong,
  } = useMusic();

  // Local component state
  const [showQueue, setShowQueue] = useState(false);
  const currentSongIdRef = useRef<string | null>(null);
  const lastPositionRef = useRef(0);
  const lastSkipForwardPressRef = useRef(0);
  const lastSkipBackwardPressRef = useRef(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Format time from seconds to MM:SS
  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // If no song is playing, redirect back
  useEffect(() => {
    if (!currentSong) {
      router.back();
    } else if (currentSong.id !== currentSongIdRef.current) {
      // Reset when song changes
      currentSongIdRef.current = currentSong.id;
      console.log(`NEW SONG LOADED: ${currentSong.title}`);
      lastPositionRef.current = 0;
    }
  }, [currentSong]);

  // Check if the current song is already downloaded
  useEffect(() => {
    if (currentSong) {
      checkIfDownloaded();
    }
  }, [currentSong]);

  // Force queue view when offline
  useEffect(() => {
    if (!hasConnection) {
      setShowQueue(true);
    }
  }, [hasConnection]);

  // Check if song is already downloaded
  async function checkIfDownloaded() {
    if (!currentSong) return;

    try {
      // Check if song exists in downloaded songs
      const downloadedSongs = await AsyncStorage.getItem('downloaded_songs');
      const songIds = downloadedSongs ? JSON.parse(downloadedSongs) : [];

      setIsDownloaded(songIds.includes(currentSong.id));
    } catch (error) {
      console.error('Error checking download status:', error);
      setIsDownloaded(false);
    }
  }

  // Download the current song
  async function downloadCurrentSong() {
    if (!currentSong || isDownloading || isDownloaded) return;

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      // Determine the directory - we'll store as an individual song
      const songDir = `${FileSystem.documentDirectory}songs/`;

      // Create the directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(songDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(songDir, { intermediates: true });
      }

      // Define file path for the song
      const songFilePath = `${songDir}${currentSong.id}.mp3`;

      // Check if song already exists
      const fileInfo = await FileSystem.getInfoAsync(songFilePath);

      if (!fileInfo.exists) {
        // Download the song
        const downloadResumable = FileSystem.createDownloadResumable(
          currentSong.audioUrl,
          songFilePath,
          {},
          (downloadProgress) => {
            const progress =
              downloadProgress.totalBytesWritten /
              downloadProgress.totalBytesExpectedToWrite;
            setDownloadProgress(progress);
          }
        );

        try {
          const downloadResult = await downloadResumable.downloadAsync();

          if (downloadResult) {
            console.log(`Downloaded song: ${currentSong.title}`);

            // Save song metadata
            await AsyncStorage.setItem(
              `song_${currentSong.id}`,
              JSON.stringify({
                id: currentSong.id,
                title: currentSong.title,
                artist: currentSong.artist,
                album: currentSong.album,
                artwork: currentSong.artwork,
                duration: currentSong.duration,
                audioUrl: `file://${songFilePath}`,
                year: currentSong.year || '',
              })
            );

            // Update the list of downloaded songs
            const downloadedSongs = await AsyncStorage.getItem(
              'downloaded_songs'
            );
            const parsedDownloadedSongs = downloadedSongs
              ? JSON.parse(downloadedSongs)
              : [];

            if (!parsedDownloadedSongs.includes(currentSong.id)) {
              parsedDownloadedSongs.push(currentSong.id);
              await AsyncStorage.setItem(
                'downloaded_songs',
                JSON.stringify(parsedDownloadedSongs)
              );
            }

            setIsDownloaded(true);
          }
        } catch (e) {
          console.error(`Error downloading song ${currentSong.title}:`, e);
        }
      } else {
        console.log(`Song already downloaded: ${currentSong.title}`);
        setIsDownloaded(true);
      }
    } catch (error) {
      console.error('Error in download process:', error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }

  // Delete a downloaded song
  async function deleteDownloadedSong() {
    if (!currentSong || !isDownloaded) return;

    try {
      setIsDownloading(true);

      // File path for the song
      const songFilePath = `${FileSystem.documentDirectory}songs/${currentSong.id}.mp3`;

      // Check if song exists
      const fileInfo = await FileSystem.getInfoAsync(songFilePath);

      if (fileInfo.exists) {
        // Delete the song file
        await FileSystem.deleteAsync(songFilePath, { idempotent: true });
      }

      // Remove song from downloaded songs list
      const downloadedSongs = await AsyncStorage.getItem('downloaded_songs');
      if (downloadedSongs) {
        const songList = JSON.parse(downloadedSongs);
        const updatedList = songList.filter(
          (id: string) => id !== currentSong.id
        );
        await AsyncStorage.setItem(
          'downloaded_songs',
          JSON.stringify(updatedList)
        );
      }

      // Remove song metadata
      await AsyncStorage.removeItem(`song_${currentSong.id}`);

      setIsDownloaded(false);
    } catch (error) {
      console.error('Error deleting song:', error);
    } finally {
      setIsDownloading(false);
    }
  }

  // Toggle download/delete
  function toggleDownload() {
    if (isDownloaded) {
      deleteDownloadedSong();
    } else {
      downloadCurrentSong();
    }
  }

  // Get recommended songs
  function getRecommendedSongs() {
    return recommendations;
  }

  async function checkRecommendations(track:object) {
    const result:any = await musicApi.checkRecommendations(track);
    console.log(result);
    const external = result.type == "spotify"?false:true;
    playSong(result,true,external);
  }


  // Get queue without current song
  function getQueueWithoutCurrentSong() {
    if (!currentSong || queue.length === 0) return queue;

    // Find and exclude current song from queue
    const currentIndex = queue.findIndex((song) => song.id === currentSong.id);

    // If current song not in queue or queue is empty
    if (currentIndex === -1) {
      return queue;
    }

    // Return queue without current song
    return [...queue.slice(currentIndex + 1), ...queue.slice(0, currentIndex)];
  }

  // Get queue position
  function getQueuePosition(songId: string) {
    if (!queue.length) return -1;
    return queue.findIndex((song) => song.id === songId);
  }

  // Safety check
  if (!currentSong) return null;

  return (
    <View
      style={[styles.container, isDark && styles.darkContainer]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronDown
            size={28}
            color={isDark ? '#fff' : '#000'}
          />
        </TouchableOpacity>

        <View style={styles.headerTitles}>
          <Text
            style={[
              styles.headerTitle,
              isDark && styles.darkText,
            ]}
          >
            Now Playing
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              isDark && styles.darkSubtext,
            ]}
          >
            From{' '}
            {currentSong?.album?.slice(0, 10) || currentSong?.artist?.slice(0, 10)}
            {currentSong?.album?.length > 10 || currentSong?.artist?.length > 10
              ? '...'
              : ''}
          </Text>
        </View>

        <TouchableOpacity style={styles.menuButton}>
          <MoreVertical
            size={24}
            color={isDark ? '#fff' : '#000'}
          />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainScrollViewContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Player Section */}
        <View>
          {/* Album artwork */}
          <View style={styles.artworkContainer}>
            <Image
              source={{ uri: currentSong.artwork }}
              style={styles.artwork}
              resizeMode="cover"
            />
          </View>

          {/* Song info */}
          <View style={styles.infoContainer}>
            <View style={styles.titleContainer}>
              <Text
                style={[
                  styles.title,
                  isDark && styles.darkText,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {currentSong.title}
              </Text>
            </View>

            <Text
              style={[
                styles.artist,
                isDark && styles.darkSubtext,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {currentSong.artist}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={currentSong?.duration || 1}
              value={currentTime}
              onSlidingComplete={useCallback((value: any) => {
                setCurrentTime(value);
                seekTo(value); // assuming seekTo is your method to update the current position
              }, [])}
              step={1}
              minimumTrackTintColor="#E53935"
              maximumTrackTintColor={
                isDark
                  ? 'rgba(70, 70, 70, 0.3)'
                  : 'rgba(200, 200, 200, 0.3)'
              }
              thumbTintColor="#E53935"
              tapToSeek={true}
            />

            <View style={styles.timeContainer}>
              <Text
                style={[
                  styles.timeText,
                  isDark && styles.darkSubtext,
                ]}
              >
                {formatTime(currentTime)}
              </Text>
              <Text
                style={[
                  styles.timeText,
                  isDark && styles.darkSubtext,
                ]}
              >
                {formatTime(currentSong?.duration || 0)}
              </Text>
            </View>
          </View>

          {/* Playback controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleShuffle}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.iconContainer}>
                <Shuffle
                  size={22}
                  color={
                    isShuffle
                      ? '#E53935'
                      : isDark
                      ? '#999'
                      : '#777'
                  }
                />
                {isShuffle && <View style={styles.activeIndicator} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                // Prevent rapid button clicks
                const now = Date.now();
                const timeSinceLastClick =
                  now - lastSkipBackwardPressRef.current;
                if (timeSinceLastClick < 500) return;

                // Update last press time
                lastSkipBackwardPressRef.current = now;
                playPrevious();
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 15, right: 15 }}
            >
              <SkipBack
                size={32}
                color={isDark ? '#fff' : '#000'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={() => {
                if (isPlaying) {
                  pauseSong();
                } else {
                  resumeSong();
                }
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isPlaying ? (
                <Pause size={36} color="#fff" />
              ) : (
                <Play size={36} color="#fff" style={{ marginLeft: 3 }} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                // Prevent rapid button clicks
                const now = Date.now();
                const timeSinceLastClick =
                  now - lastSkipForwardPressRef.current;
                if (timeSinceLastClick < 500) return;

                // Update last press time
                lastSkipForwardPressRef.current = now;
                playNext(false);
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 15, right: 15 }}
            >
              <SkipForward
                size={32}
                color={isDark ? '#fff' : '#000'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleRepeat}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.iconContainer}>
                <Repeat
                  size={22}
                  color={
                    repeatMode
                      ? '#E53935'
                      : isDark
                      ? '#999'
                      : '#777'
                  }
                />
                {repeatMode && <View style={styles.activeIndicator} />}
              </View>
            </TouchableOpacity>
          </View>

          {/* Additional controls */}
          <View style={styles.additionalControls}>
            {hasConnection && (
              <TouchableOpacity
                style={styles.additionalButton}
                onPress={() => setShowQueue(false)}
              >
                <Text
                  style={[
                    styles.additionalButtonText,
                    isDark && styles.darkSubtext,
                    !showQueue && { color: '#E53935' },
                  ]}
                >
                  Recommendations
                </Text>
              </TouchableOpacity>
            )}

            {getQueueWithoutCurrentSong().length !== 0 && (
              <TouchableOpacity
                style={styles.additionalButton}
                onPress={() => hasConnection ? setShowQueue(!showQueue) : null}
              >
                <Text
                  style={[
                    styles.additionalButtonText,
                    isDark && styles.darkSubtext,
                    (showQueue || !hasConnection) && { color: '#E53935' },
                  ]}
                >
                  Queue
                </Text>
              </TouchableOpacity>
            )}

            {/* Download button */}
            <TouchableOpacity
              style={styles.additionalButton}
              onPress={toggleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <View style={styles.downloadingContainer}>
                  <ActivityIndicator size="small" color="#E53935" />
                  <Text style={styles.downloadPercentage}>
                    {Math.round(downloadProgress * 100)}%
                  </Text>
                </View>
              ) : (
                <Download
                  size={20}
                  color={
                    isDownloaded
                      ? '#E53935'
                      : isDark
                      ? '#aaa'
                      : '#777'
                  }
                  fill={isDownloaded ? '#E53935' : 'transparent'}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.additionalButton}>
              <Volume2
                size={20}
                color={isDark ? '#aaa' : '#777'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Queue or Recommendations Section */}
        {showQueue || !hasConnection ? (
          /* Queue Section */
          <View>
            <View
              style={[
                styles.queueHeader,
                isDark && { borderBottomColor: '#333' },
              ]}
            >
              <Text
                style={[
                  styles.queueHeaderText,
                  isDark && styles.darkText,
                ]}
              >
                Up Next ({queue.length > 0 ? queue.length - 1 : 0} song
                {queue.length !== 2 ? 's' : ''})
              </Text>
              <View style={styles.queueInfo}>
                {isShuffle && (
                  <View style={styles.queueBadge}>
                    <Shuffle size={12} color="#E53935" />
                    <Text style={styles.queueBadgeText}>Shuffle On</Text>
                  </View>
                )}
                {repeatMode && (
                  <View style={styles.queueBadge}>
                    <Repeat size={12} color="#E53935" />
                    <Text style={styles.queueBadgeText}>Repeat On</Text>
                  </View>
                )}
              </View>
            </View>

            {getQueueWithoutCurrentSong().length === 0 ? (
              <Text
                style={[
                  styles.emptyQueueText,
                  isDark && styles.darkEmptyQueueText,
                ]}
              >
                No more songs in queue
              </Text>
            ) : (
              getQueueWithoutCurrentSong().map((item, index) => {
                const isNextSong = index === 0;
                const queuePosition = getQueuePosition(item.id);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.queueItem,
                      isDark && styles.darkQueueItem,
                      isNextSong && styles.upNextQueueItem,
                      isNextSong &&
                        isDark &&
                        styles.darkUpNextQueueItem,
                    ]}
                    onPress={() => playSong(item)}
                  >
                    <Text
                      style={[
                        styles.queuePosition,
                        isDark && styles.darkSubtext,
                        isNextSong && styles.upNextText,
                      ]}
                    >
                      {isNextSong ? (
                        <Play size={16} color="#E53935" />
                      ) : queuePosition > -1 ? (
                        queuePosition + 1
                      ) : (
                        index + 1
                      )}
                    </Text>
                    <Image
                      source={{ uri: item.artwork }}
                      style={[
                        styles.queueItemArtwork,
                        isNextSong && styles.upNextQueueItemArtwork,
                      ]}
                    />
                    <View style={styles.queueItemInfo}>
                      <Text
                        style={[
                          styles.queueItemTitle,
                          isDark && styles.darkText,
                          isNextSong && styles.upNextText,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {isNextSong ? 'Up Next: ' : ''}
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.queueItemArtist,
                          isDark && styles.darkSubtext,
                          isNextSong && styles.upNextSubtext,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.artist}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.queueItemDuration,
                        isDark && styles.darkSubtext,
                        isNextSong && styles.upNextSubtext,
                      ]}
                    >
                      {formatTime(item.duration)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          /* Recommendations Section - only show when online */
          <View>
            <View 
              style={[
                styles.queueHeader,
                isDark && { borderBottomColor: '#333' },
              ]}
            >
              <Text
                style={[
                  styles.queueHeaderText,
                  isDark && styles.darkText,
                ]}
              >
                Recommended Songs
              </Text>
            </View>

            {getRecommendedSongs().length === 0 ? (
              <Text
                style={[
                  styles.emptyQueueText,
                  isDark && styles.darkEmptyQueueText,
                ]}
              >
                No recommendations available
              </Text>
            ) : (
              <>
                {/* Context Recommendations */}
                <Text
                  style={[
                    styles.recommendationSubHeader,
                    isDark && styles.darkText,
                  ]}
                >
                  You may also like
                </Text>
                <View style={[
                  styles.fixedHeightContainer, 
                  isDark && styles.darkFixedHeightContainer
                ]}>
                  <FlatList
                    data={getRecommendedSongs()}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={true}
                    nestedScrollEnabled={true}
                    style={styles.recommendationListContainer}
                    contentContainerStyle={styles.recommendationListContent}
                    renderItem={({item, index}:any) => {
                      
                      return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.songItem,
                          isDark && styles.darkSongItem,
                        ]}
                        onPress={() => checkRecommendations(item)}
                      >
                        <Text
                          style={[styles.songIndex, isDark && styles.darkSubtext]}
                        >
                          {index + 1}
                        </Text>
                        <Image
                          source={{ uri: item.album.image_large }}
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
                            style={[styles.songArtist, isDark && styles.darkSubtext]}
                            numberOfLines={1}
                          >
                            {item.artists[0].name}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.songPlayButton}
                          onPress={() => checkRecommendations(item)}
                        >
                          <Play size={16} color="#fff" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                     )
                    }}
                  />
                </View>
                
                {/* Album Songs Section */}
                {albumSongs && albumSongs.length > 0 && (
                  <>
                    <Text
                      style={[
                        styles.recommendationSubHeader,
                        isDark && styles.darkText,
                      ]}
                    >
                      More from this album
                    </Text>
                    <FlatList
                      data={albumSongs}
                      keyExtractor={(item) => item.id.toString()}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.horizontalListContainer}
                      contentContainerStyle={styles.horizontalListContent}
                      renderItem={({item}) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.horizontalSongCard}
                          onPress={() => playSong(item)}
                        >
                          <Image
                            source={{ uri: item.artwork }}
                            style={styles.horizontalSongCover}
                          />
                          <Text
                            style={[styles.horizontalSongTitle, isDark && styles.darkText]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={[styles.horizontalSongArtist, isDark && styles.darkSubtext]}
                            numberOfLines={1}
                          >
                            {item.artist}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </>
                )}
                
                {/* Artists Section */}
                {topArtists && topArtists.length > 0 && (
                  <>
                    <Text
                      style={[
                        styles.recommendationSubHeader,
                        isDark && styles.darkText,
                      ]}
                    >
                      Featured Artists
                    </Text>
                    <FlatList
                      data={topArtists}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(item, index) => `artist-${item.id || index}`}
                      style={styles.artistListContainer}
                      contentContainerStyle={styles.artistListContent}
                      renderItem={({item}:any) => (
                        <TouchableOpacity
                          style={styles.artistCard}
                          onPress={() => {
                            // Navigation to artist details would go here
                            // You could implement this later
                            console.log('Navigate to artist:', item.name);
                          }}
                        >
                          <Image
                            source={{ 
                              uri: item.image ? item.image[item.image.length - 1].link : 
                                  item.image || 
                                  'https://ldgnpdudaohjifgktmst.supabase.co/storage/v1/object/public/ruza//artist.jpg' 
                            }}
                            style={styles.artistImage}
                          />
                          <Text
                            style={[styles.artistName, isDark && styles.darkText]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[styles.artistRole, isDark && styles.darkSubtext]}
                            numberOfLines={1}
                          >
                            {item.role || 'Artist'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </>
                )}
                
                {/* Artist Songs Section */}
                {topSongs && topSongs.length > 0 && (
                  <>
                    <Text
                      style={[
                        styles.recommendationSubHeader,
                        isDark && styles.darkText,
                      ]}
                    >
                      More from {currentSong?.artist}
                    </Text>
                    <FlatList
                      data={topSongs}
                      keyExtractor={(item) => item.id.toString()}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.horizontalListContainer}
                      contentContainerStyle={styles.horizontalListContent}
                      renderItem={({item}) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.horizontalSongCard}
                          onPress={() => playSong(item)}
                        >
                          <Image
                            source={{ uri: item.artwork }}
                            style={styles.horizontalSongCover}
                          />
                          <Text
                            style={[styles.horizontalSongTitle, isDark && styles.darkText]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={[styles.horizontalSongArtist, isDark && styles.darkSubtext]}
                            numberOfLines={1}
                          >
                            {item.artist}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 20,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollViewContent: {
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitles: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  menuButton: {
    padding: 8,
  },
  artworkContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  artwork: {
    width: width - 80,
    height: width - 80,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  infoContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
  },
  artist: {
    fontSize: 18,
    color: '#666',
  },
  progressContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
    position: 'relative',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    position: 'relative',
  },
  controlButton: {
    padding: 8,
    position: 'relative',
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    width: 30,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOneText: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#E53935',
    top: 6,
    alignSelf: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E53935',
  },
  tooltip: {
    position: 'absolute',
    bottom: -24,
    left: -16,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    width: 80,
    alignItems: 'center',
    opacity: 0.9,
    zIndex: 10,
  },
  darkTooltip: {
    backgroundColor: '#333',
  },
  tooltipText: {
    fontSize: 10,
    color: '#333',
  },
  additionalControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  additionalButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  additionalButtonText: {
    fontSize: 12,
    color: '#777',
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
  lyricsContainer: {
    display: 'none', // We're not using this anymore
  },
  lyricsContent: {
    display: 'none', // We're not using this anymore
  },
  lyricText: {
    display: 'none', // We're not using this anymore
  },
  activeLyric: {
    display: 'none', // We're not using this anymore
  },
  darkText: {
    color: '#fff',
  },
  darkSubtext: {
    color: '#aaa',
  },
  queueContainer: {
    paddingHorizontal: 16,
    minHeight: 400, // Increased minimum height
    marginTop: 20,
    marginBottom: 40,
  },
  queueItems: {
    marginTop: 4,
    paddingHorizontal: 4,
  },
  queueItemsContent: {
    paddingVertical: 4,
    paddingBottom: 60,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 8,
  },
  queueHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E53935',
  },
  queueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  queueBadgeText: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '600',
    marginLeft: 4,
  },
  queueCount: {
    fontSize: 14,
    color: '#888',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: 'rgba(240, 240, 240, 0.5)',
  },
  queueItemArtwork: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  queueItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  queueItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  queueItemArtist: {
    fontSize: 14,
    color: '#666',
  },
  queueItemDuration: {
    fontSize: 13,
    color: '#888',
    minWidth: 45,
    textAlign: 'right',
  },
  queueSeparator: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 4,
  },
  emptyQueueText: {
    textAlign: 'center',
    paddingVertical: 32,
    color: '#888',
    fontSize: 16,
    fontStyle: 'italic',
    backgroundColor: 'rgba(240, 240, 240, 0.3)',
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 16,
  },
  upNextText: {
    color: '#E53935',
    fontWeight: 'bold',
  },
  shineEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 50,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    transform: [{ skewX: '-30deg' }],
    zIndex: 2,
  },
  playbackEndedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  playbackEndedContainer: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: 8,
    alignSelf: 'stretch',
    borderLeftWidth: 4,
    borderLeftColor: '#E53935',
  },
  playbackEndedTitle: {
    fontSize: 18,
    color: '#E53935',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  playbackEndedText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  playbackEndedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  playbackEndedButton: {
    backgroundColor: '#E53935',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  playbackEndedButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  notification: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    padding: 12,
    backgroundColor: 'rgba(29, 185, 84, 0.9)',
    borderRadius: 8,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  notificationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  volumeSliderContainer: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopWidth: 1,
    borderTopColor: '#333',
    overflow: 'hidden',
  },
  volumeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  customSliderContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  customSliderTrack: {
    height: 4,
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  customSliderFill: {
    height: '100%',
    backgroundColor: '#E53935',
    borderRadius: 2,
  },
  customSliderThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E53935',
    position: 'absolute',
    top: -4,
  },
  queuePosition: {
    width: 24,
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 8,
  },
  contentContainer: {
    flex: 1,
    marginTop: 8,
    marginBottom: 24,
  },
  recommendationsContainer: {
    paddingHorizontal: 16,
    minHeight: 400,
    marginTop: 20,
    marginBottom: 40,
  },
  recommendationsHeader: {
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(29, 185, 84, 0.3)',
  },
  recommendationsHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E53935',
    marginBottom: 4,
  },
  recommendationsContent: {
    paddingBottom: 60,
    paddingHorizontal: 4,
  },
  recommendationItem: {
    backgroundColor: 'rgba(29, 185, 84, 0.08)',
    borderRadius: 8,
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#E53935',
  },
  viewAllButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(29, 185, 84, 0.9)',
    alignItems: 'center',
    alignSelf: 'center',
  },
  viewAllButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  currentQueueItem: {
    backgroundColor: 'rgba(29, 185, 84, 0.08)',
    borderRadius: 8,
    marginVertical: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#E53935',
  },
  currentQueueItemArtwork: {
    borderColor: '#E53935',
    borderWidth: 2,
  },
  currentQueueText: {
    color: '#E53935',
    fontWeight: 'bold',
  },
  currentQueueSubtext: {
    color: '#E53935',
    fontWeight: 'bold',
  },
  upNextQueueItem: {
    borderRadius: 8,
    paddingVertical: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#E53935',
  },
  upNextQueueItemArtwork: {
    width: 56,
    height: 56,
    borderRadius: 6,
    borderColor: '#E53935',
    borderWidth: 2,
  },
  upNextSubtext: {
    color: '#E53935',
    fontWeight: '500',
  },
  controlText: {
    position: 'absolute',
    bottom: -24,
    left: -16,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    width: 80,
    alignItems: 'center',
    opacity: 0.9,
    zIndex: 10,
  },
  activeControlText: {
    color: '#E53935',
    fontWeight: 'bold',
  },
  itemSeparator: {
    height: 1,
    backgroundColor: '#eee',
    marginLeft: 70,
    marginRight: 12,
  },
  darkItemSeparator: {
    backgroundColor: '#333',
  },
  darkQueueItem: {
    backgroundColor: 'rgba(40, 40, 40, 0.6)',
  },
  darkUpNextQueueItem: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
  },
  darkRecommendationItem: {
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    borderLeftColor: '#E53935',
  },
  darkEmptyQueueText: {
    backgroundColor: 'rgba(40, 40, 40, 0.5)',
    color: '#aaa',
  },
  downloadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  downloadPercentage: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: 'bold',
  },
  recommendationSubHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E53935',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  recommendationListContainer: {
    paddingBottom: 16,
    marginBottom: 16,
  },
  recommendationListContent: {
    paddingHorizontal: 4,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: 'rgba(240, 240, 240, 0.5)',
  },
  darkSongItem: {
    backgroundColor: '#282828',
  },
  songIndex: {
    width: 24,
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 8,
  },
  songCover: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  songInfo: {
    flex: 1,
    marginRight: 8,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#666',
  },
  songPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistListContainer: {
    padding: 12,
  },
  artistListContent: {
    paddingHorizontal: 4,
  },
  artistCard: {
    width: 120,
    padding: 8,
    alignItems: 'center',
    marginRight: 16,
  },
  artistImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  artistName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  artistRole: {
    fontSize: 12,
    color: '#666',
  },
  horizontalListContainer: {
    padding: 12,
  },
  horizontalListContent: {
    paddingHorizontal: 4,
  },
  horizontalSongCard: {
    width: 120,
    padding: 8,
    alignItems: 'center',
    marginRight: 16,
  },
  horizontalSongCover: {
    width: 100,
    height: 100,
    borderRadius: 6,
    marginBottom: 8,
  },
  horizontalSongTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  horizontalSongArtist: {
    fontSize: 12,
    color: '#666',
  },
  fixedHeightContainer: {
    height: 250,
    borderRadius: 8,
    // backgroundColor: 'rgba(0, 0, 0, 0.03)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  darkFixedHeightContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
