import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Build a storage adapter that is safe in every environment:
 *  - Native (iOS/Android): uses AsyncStorage
 *  - Web client (browser):  uses AsyncStorage (backed by localStorage)
 *  - Web SSR (Node):        uses a no-op in-memory stub
 */
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

// In-memory fallback map to ensure auth never crashes or blocks on SQLITE_FULL errors
const memoryAuthMap = new Map<string, string>();

const authStorage = isSSR
  ? {
      getItem: (key: string) => Promise.resolve(null),
      setItem: (key: string, value: string) => Promise.resolve(),
      removeItem: (key: string) => Promise.resolve(),
    }
  : {
      getItem: async (key: string): Promise<string | null> => {
        try {
          const val = await AsyncStorage.getItem(key);
          if (val !== null) return val;
          return memoryAuthMap.get(key) ?? null;
        } catch (_err) {
          return memoryAuthMap.get(key) ?? null;
        }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        memoryAuthMap.set(key, value);
        try {
          await AsyncStorage.setItem(key, value);
        } catch (err: any) {
          console.warn('[Supabase Auth Storage] AsyncStorage write error, purging legacy cache...', err);
          try {
            // Auto-purge any legacy bulky cache keys from SQLite database
            const keys = await AsyncStorage.getAllKeys();
            const legacyKeys = keys.filter(
              (k) => k.startsWith('yomite_cache_') || k.startsWith('manga_cache_')
            );
            if (legacyKeys.length > 0) {
              await AsyncStorage.multiRemove(legacyKeys);
              // Retry writing the auth token
              await AsyncStorage.setItem(key, value);
            }
          } catch (_e) {
            // Memory fallback is active, session remains valid
          }
        }
      },
      removeItem: async (key: string): Promise<void> => {
        memoryAuthMap.delete(key);
        try {
          await AsyncStorage.removeItem(key);
        } catch (_err) {
          // Ignore
        }
      },
    };

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
