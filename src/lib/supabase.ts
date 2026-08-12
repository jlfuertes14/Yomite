/**
 * Supabase Auth & Cloud Sync Client
 * Configured for Expo with AsyncStorage for persistent sessions.
 *
 * Guards against SSR (server-side rendering) in Expo Router's static web
 * output where `window` is undefined — AsyncStorage accesses
 * window.localStorage on web and crashes the Node render pass.
 */
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Build a storage adapter that is safe in every environment:
 *  - Native (iOS/Android): uses AsyncStorage
 *  - Web client (browser):  uses AsyncStorage (backed by localStorage)
 *  - Web SSR (Node):        uses a no-op in-memory stub
 */
function getAuthStorage() {
  // SSR / Node — no window, no localStorage
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    const memoryStore: Record<string, string> = {};
    return {
      getItem: (key: string) => memoryStore[key] ?? null,
      setItem: (key: string, value: string) => { memoryStore[key] = value; },
      removeItem: (key: string) => { delete memoryStore[key]; },
    };
  }

  // Native + Browser — safe to import AsyncStorage
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
