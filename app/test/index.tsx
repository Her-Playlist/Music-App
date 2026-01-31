import React, { useState, useEffect, useRef } from 'react';
import { Button, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import * as FileSystem from 'expo-file-system';

const App = () => {
  const [sound, setSound] = useState<Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const playbackStatusRef = useRef<any>(null);

  // Clean up sound and downloaded file on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (localUri) {
        FileSystem.deleteAsync(localUri).catch(console.error);
      }
    };
  }, [sound, localUri]);

  // Update position periodically
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !isSeeking) {
      interval = setInterval(() => {
        if (sound && playbackStatusRef.current?.isLoaded) {
          setPosition(playbackStatusRef.current.positionMillis);
        }
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, isSeeking, sound]);

  // Download and play audio
  const downloadAndPlay = async () => {
    try {
      setIsLoading(true);
      
      const downloadUrl = 'https://song-backend-1gib.vercel.app/api/song?url=https://www.youtube.com/watch?v=e8LJcIlzQeU';
      
      // Create a unique filename
      const filename = `audio-${Date.now()}.mp3`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      // Download the file
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        fileUri
      );
      
      if (downloadResult.status !== 200) {
        throw new Error('Failed to download audio');
      }
      
      // Unload previous sound if it exists
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      // Delete previous local file if it exists
      if (localUri) {
        await FileSystem.deleteAsync(localUri);
      }
      
      console.log('Loading audio...');
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: downloadResult.uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      
      setSound(newSound);
      setLocalUri(downloadResult.uri);
      setIsLoading(false);
      setIsPlaying(true);
      
    } catch (error) {
      console.error('Error loading or playing sound:', error);
      setIsLoading(false);
    }
  };

  // Handle playback status updates
  const onPlaybackStatusUpdate = (status: any) => {
    playbackStatusRef.current = status;
    
    if (!status.isLoaded) return;
    
    // Update duration if available and different
    if (status.durationMillis && status.durationMillis !== duration) {
      setDuration(status.durationMillis);
    }
    
    // Handle playback end
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
    }
  };

  // Toggle play/pause
  const togglePlayback = async () => {
    if (!sound) {
      await downloadAndPlay();
      return;
    }
    
    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  // Reset to beginning
  const restart = async () => {
    if (!sound) return;
    
    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      setPosition(0);
      await sound.playAsync();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error restarting playback:', error);
    }
  };

  // Handle seek
  const onSeekComplete = async (value: number) => {
    if (!sound) return;
    
    try {
      await sound.setPositionAsync(value);
      setPosition(value);
      setIsSeeking(false);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  // Handle slider value change
  const onSliderValueChange = (value: number) => {
    if (!isSeeking) {
      setIsSeeking(true);
    }
    setPosition(value);
  };

  // Format time for display (mm:ss)
  const formatTime = (millis: number) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color="#1EB1FC" />
          <Text style={styles.loadingText}>Loading audio...</Text>
        </View>
      ) : (
        <View>
          <View style={styles.buttonContainer}>
            <Button
              title={isPlaying ? "Pause" : "Play"}
              onPress={togglePlayback}
            />
            
            {sound && (
              <Button
                title="Restart"
                onPress={restart}
              />
            )}
          </View>
          
          {sound && (
            <View style={styles.sliderContainer}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={duration || 1}
                value={position}
                onSlidingStart={() => setIsSeeking(true)}
                onValueChange={onSliderValueChange}
                onSlidingComplete={onSeekComplete}
                minimumTrackTintColor="#1EB1FC"
                maximumTrackTintColor="#D3D3D3"
                thumbTintColor="#1EB1FC"
                step={1}
              />
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  centeredContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  timeText: {
    minWidth: 50,
    textAlign: 'center',
    fontSize: 14,
  }
});

export default App;
