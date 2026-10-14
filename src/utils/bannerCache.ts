import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const BANNER_CACHE_SUBDIR = 'hero_banners/';

function getBannerCacheDir(): string {
  if (Platform.OS === 'web') return '';
  const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
  return `${baseDir}${BANNER_CACHE_SUBDIR}`;
}

let isDirCreated = false;

async function ensureDirExists(): Promise<string> {
  if (Platform.OS === 'web') return '';
  const dir = getBannerCacheDir();
  if (!dir) return '';
  if (!isDirCreated) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      isDirCreated = true;
    } catch {
      // Ignore if directory creation fails or already exists
    }
  }
  return dir;
}

// In-memory lookup map of mangaId -> local file:// URI
const memoryBannerMap = new Map<string, string>();

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

      const localFilePath = `${dir}${mangaId}.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(localFilePath);

      if (fileInfo.exists && (fileInfo as any).size > 1000) {
        memoryBannerMap.set(mangaId, localFilePath);
        return localFilePath;
      }

      // Download file to local persistent storage
      const downloadRes = await FileSystem.downloadAsync(remoteUrl, localFilePath);
      if (downloadRes.status === 200) {
        memoryBannerMap.set(mangaId, downloadRes.uri);
        return downloadRes.uri;
      }
    } catch (e) {
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
    const promises = items.map(async (item) => {
      if (!item.url) return;
      try {
        const localUri = await BannerCacheManager.getOrCacheBanner(item.id, item.url);
        if (localUri && localUri.startsWith('file://')) {
          resolved[item.id] = localUri;
        }
      } catch {
        // Fail silently per item
      }
    });

    await Promise.allSettled(promises);
    return resolved;
  },
};
