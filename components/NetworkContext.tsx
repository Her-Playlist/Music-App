import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Interface for Network Context
interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  offlineMode: boolean;
}

// Create context with default values
const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
  offlineMode: false,
});

// Provider component
export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected !== null ? state.isConnected : false);
      setIsInternetReachable(state.isInternetReachable);
    });

    // Get initial connection status
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected !== null ? state.isConnected : false);
      setIsInternetReachable(state.isInternetReachable);
    });

    // Check if user has enabled offline mode in settings
    AsyncStorage.getItem('offline_mode').then(value => {
      if (value === 'true') {
        setOfflineMode(true);
      }
    });

    // Cleanup function
    return () => {
      unsubscribe();
    };
  }, []);



  return (
    <NetworkContext.Provider value={{ isConnected, isInternetReachable, offlineMode }}>
      {/* {(!isConnected || !isInternetReachable) && !offlineMode && (
        <View style={offlineContainerStyle}>
          <Text style={styles.offlineText}>No Internet Connection</Text>
        </View>
      )} */}
      {children}
    </NetworkContext.Provider>
  );
}

// Custom hook to use the network context
export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

