import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// Bounded High-Speed In-Memory Cache (RAM) with LRU eviction (max 150 items)
const memoryCache = new Map<string, CacheEntry<any>>();
const MAX_MEMORY_ENTRIES = 150;

export const CacheManager = {
  /**
   * Get cached entry from memory
   */
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();
    const memItem = memoryCache.get(key);
    if (memItem) {
      if (memItem.expiry > now) {
        // Refresh LRU order (delete & re-insert)
        memoryCache.delete(key);
        memoryCache.set(key, memItem);
        return memItem.data as T;
      }
      memoryCache.delete(key);
    }
    return null;
  },

  /**
   * Set cached entry in memory only (avoids bloating AsyncStorage SQLite database)
   */
  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const expiry = Date.now() + ttlMs;
    const entry: CacheEntry<T> = { data, expiry };

    // Evict oldest entry if limit reached
    if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey) memoryCache.delete(firstKey);
    }

    memoryCache.set(key, entry);
  },

  /**
   * Clear cache for a specific key
   */
  async remove(key: string): Promise<void> {
    memoryCache.delete(key);
  },

  /**
   * Clear all memory caches
   */
  async clearAll(): Promise<void> {
    memoryCache.clear();
  },

  /**
   * One-time / background purge of any legacy `yomite_cache_*` keys stored in AsyncStorage SQLite.
   * Frees up SQLite database quota on user devices to prevent SQLITE_FULL (code 13).
   */
  async cleanLegacyStorageCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const legacyKeys = keys.filter(
        (k) => k.startsWith('yomite_cache_') || k.startsWith('manga_cache_')
      );
      if (legacyKeys.length > 0) {
        await AsyncStorage.multiRemove(legacyKeys);
      }
    } catch (e) {
      // Ignore if storage is locked
    }
  },
};

// Automatically trigger legacy cache purge on startup in background
CacheManager.cleanLegacyStorageCache().catch(() => {});
