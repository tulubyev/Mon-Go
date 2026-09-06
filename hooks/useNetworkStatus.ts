import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Live connectivity status. Mongolia has no signal outside the cities, so
 * screens use this to show cached data instead of spinners/errors, and to
 * hide network-only features (AI chat, TTS/STT/OCR) behind a clear banner
 * rather than letting them fail silently.
 */
export function useNetworkStatus(): boolean {
  // Optimistic default — avoids a flash of "offline" banner on mount before
  // the first NetInfo event arrives.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // isInternetReachable can be null while NetInfo is still probing —
      // fall back to isConnected so we don't flicker "offline" during that.
      setIsOnline(state.isInternetReachable ?? state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
