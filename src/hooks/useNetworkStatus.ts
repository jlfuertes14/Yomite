/**
 * useNetworkStatus — Reactive network connectivity hook using NetInfo
 */
import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);

  useEffect(() => {
    // Fetch initial state
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
      setIsInternetReachable(state.isInternetReachable ?? true);
    });

    return () => unsubscribe();
  }, []);

  const isOffline = isConnected === false || isInternetReachable === false;

  return {
    isConnected,
    isInternetReachable,
    isOffline,
    checkNetwork: async () => {
      const state = await NetInfo.fetch();
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      // Reachability can briefly be null while NetInfo is resolving it. A known
      // connection is enough to make the request, but an explicit "false" is not.
      return state.isConnected === true && state.isInternetReachable !== false;
    },
  };
}
