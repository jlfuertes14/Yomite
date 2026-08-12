import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export const CacheManager = {
  /**
   * Get cached entry from memory or AsyncStorage
   */
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // 1. Check in-memory cache first for fastest zero-latency lookup
    const memItem = memoryCache.get(key);
    if (memItem) {
      if (memItem.expiry > now) {
        return memItem.data as T;
      }
      memoryCache.delete(key);
    }

    // 2. Fall back to AsyncStorage
    try {
      const raw = await AsyncStorage.getItem(`yomite_cache_${key}`);
      if (raw) {
        const parsed: CacheEntry<T> = JSON.parse(raw);
        if (parsed.expiry > now) {
          // Restore to memory cache for subsequent fast reads
          memoryCache.set(key, parsed);
          return parsed.data;
        } else {
          await AsyncStorage.removeItem(`yomite_cache_${key}`);
        }
      }
    } catch (e) {
      // Ignore storage errors
    }

    return null;
  },

  /**
   * Set cached entry in memory and AsyncStorage
   */
  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const expiry = Date.now() + ttlMs;
    const entry: CacheEntry<T> = { data, expiry };

    memoryCache.set(key, entry);

    try {
      await AsyncStorage.setItem(`yomite_cache_${key}`, JSON.stringify(entry));
    } catch (e) {
      // Ignore storage errors
    }
  },

  /**
   * Clear cache for a specific key
   */
  async remove(key: string): Promise<void> {
    memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(`yomite_cache_${key}`);
    } catch (e) {
      // Ignore storage errors
    }
  },

  /**
   * Clear all app caches
   */
  async clearAll(): Promise<void> {
    memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith('yomite_cache_'));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (e) {
      // Ignore storage errors
    }
  },
};
