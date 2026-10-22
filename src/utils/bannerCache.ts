import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Platform } from 'react-native';

const BANNER_CACHE_SUBDIR = 'hero_banners_v512/';
const LEGACY_BANNER_CACHE_SUBDIR = 'hero_banners/';
const PURGE_FLAG_KEY = '@yomite_banner_cache_purged_v512_clean';
const MAX_MEMORY_BANNERS = 12;
const PREFETCH_CONCURRENCY = 3;

const MANGA_REQUEST_HEADERS = {
  'User-Agent': 'Yomite/1.2.6',
  Referer: 'https://mangadex.org',
};

function getBannerCacheDir(): string {
  if (Platform.OS === 'web') return '';
  const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
  return `${baseDir}${BANNER_CACHE_SUBDIR}`;
}

function getLegacyBannerCacheDir(): string {
  if (Platform.OS === 'web') return '';
  const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
  return `${baseDir}${LEGACY_BANNER_CACHE_SUBDIR}`;
}

let isDirCreated = false;

async function ensureDirExists(): Promise<string> {
  if (Platform.OS === 'web') return '';
  const dir = getBannerCacheDir();
  if (!dir) return '';

  try {
    // 1. Check if one-time legacy 256 cache purge was performed
    const isPurged = await AsyncStorage.getItem(PURGE_FLAG_KEY).catch(() => null);
    if (!isPurged) {
      // Clear native expo-image memory & disk caches so no stale 256 thumbnails linger
      await Image.clearMemoryCache().catch(() => { });
      await Image.clearDiskCache().catch(() => { });

      // Delete legacy directory
      const legacyDir = getLegacyBannerCacheDir();
      if (legacyDir) {
        const legacyInfo = await FileSystem.getInfoAsync(legacyDir).catch(() => null);
        if (legacyInfo?.exists) {
          await FileSystem.deleteAsync(legacyDir, { idempotent: true }).catch(() => { });
        }
      }

      // Clean current directory to guarantee no low-res 256 files remain
      const dirInfo = await FileSystem.getInfoAsync(dir).catch(() => null);
      if (dirInfo?.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => { });
      }

      memoryBannerMap.clear();
      await AsyncStorage.setItem(PURGE_FLAG_KEY, 'true').catch(() => { });
      isDirCreated = false;
    }

    if (!isDirCreated) {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      isDirCreated = true;
    }
  } catch {
    // Ignore if directory creation fails or already exists
  }
  return dir;
}

// In-memory lookup map of mangaId -> local file:// URI
const memoryBannerMap = new Map<string, string>();

function rememberBanner(mangaId: string, uri: string): void {
  memoryBannerMap.delete(mangaId);
  memoryBannerMap.set(mangaId, uri);

  while (memoryBannerMap.size > MAX_MEMORY_BANNERS) {
    const oldestId = memoryBannerMap.keys().next().value as string | undefined;
    if (!oldestId) break;
    memoryBannerMap.delete(oldestId);
  }
}

export const BannerCacheManager = {
  /**
   * Synchronously returns the locally cached file URI if known in memory
   */
  getCachedUri(mangaId: string): string | null {
    if (Platform.OS === 'web') return null;
    return memoryBannerMap.get(mangaId) || null;
  },

  /**
   * Resolves whether the banner image is already cached on local storage.
   * If it exists, returns the file:// URI.
   * If not, downloads it to persistent cache in the background and returns the local URI once saved.
   */
  async getOrCacheBanner(mangaId: string, remoteUrl: string | null): Promise<string | null> {
    if (!remoteUrl || Platform.OS === 'web') return remoteUrl;

    // 1. Quick in-memory hit
    if (memoryBannerMap.has(mangaId)) {
      return memoryBannerMap.get(mangaId)!;
    }

    try {
      const dir = await ensureDirExists();
      if (!dir) return remoteUrl;

      const localFilePath = `${dir}${mangaId}_512.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(localFilePath);

      // Verify file exists and has healthy size (> 10KB for 512 image; 400 error was 45 bytes)
      if (fileInfo.exists && (fileInfo as any).size > 10000) {
        rememberBanner(mangaId, localFilePath);
        return localFilePath;
      }

      // If file exists but is corrupted/truncated, delete it
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localFilePath, { idempotent: true }).catch(() => { });
      }

      // Download file to local persistent storage with User-Agent header
      const downloadRes = await FileSystem.downloadAsync(remoteUrl, localFilePath, {
        headers: MANGA_REQUEST_HEADERS,
      });

      if (downloadRes.status === 200) {
        const dlInfo = await FileSystem.getInfoAsync(downloadRes.uri);
        if (dlInfo.exists && (dlInfo as any).size > 10000) {
          rememberBanner(mangaId, downloadRes.uri);
          return downloadRes.uri;
        }
      }
    } catch {
      // On any download or filesystem error, fall back to remoteUrl
    }

    return remoteUrl;
  },

  /**
   * Batch pre-download and verify top hero banner covers in the background
   */
  async prefetchHeroBanners(items: { id: string; url: string | null }[]): Promise<Record<string, string>> {
    if (Platform.OS === 'web') return {};

    const resolved: Record<string, string> = {};
    for (let index = 0; index < items.length; index += PREFETCH_CONCURRENCY) {
      const batch = items.slice(index, index + PREFETCH_CONCURRENCY);
      await Promise.allSettled(
        batch.map(async (item) => {
          if (!item.url) return;
          try {
            const localUri = await BannerCacheManager.getOrCacheBanner(item.id, item.url);
            if (localUri && localUri.startsWith('file://')) {
              resolved[item.id] = localUri;
            }
          } catch {
            // Fail silently per item
          }
        })
      );
    }
    return resolved;
  },

  /**
   * Wipes all cached hero banners on disk, clears in-memory map,
   * and clears expo-image memory and disk caches.
   */
  async clearCache(): Promise<void> {
    memoryBannerMap.clear();
    try {
      await Image.clearMemoryCache();
      await Image.clearDiskCache();
    } catch { }

    if (Platform.OS === 'web') return;

    try {
      const dir = getBannerCacheDir();
      if (dir) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
      const legacyDir = getLegacyBannerCacheDir();
      if (legacyDir) {
        await FileSystem.deleteAsync(legacyDir, { idempotent: true });
      }
      isDirCreated = false;
    } catch { }
  },
};

