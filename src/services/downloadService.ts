import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { useDownloadStore, DownloadedChapter } from '../store/downloadStore';
import { getChapterPages } from '../api/mangadex';

/**
 * Returns the active base download folder path
 */
export function getBaseDownloadDirectory(): string {
  const customDir = useDownloadStore.getState().downloadDirectory;
  if (customDir && customDir.trim()) {
    return customDir.endsWith('/') ? customDir : `${customDir}/`;
  }
  const docDir = (FileSystem as any).documentDirectory || '';
  return `${docDir}downloads/`;
}

/**
 * Returns a human-friendly display path for the active storage directory
 */
export function getDisplayDownloadDirectory(): string {
  const dir = getBaseDownloadDirectory();
  if (dir.includes('primary%3A')) {
    const folderName = dir.split('primary%3A').pop()?.replace(/\/$/, '') || '';
    return `/storage/emulated/0/${decodeURIComponent(folderName)}`;
  }
  return dir;
}

/**
 * Opens native Android System File Manager directory picker (StorageAccessFramework SAF)
 * Allows the user to browse, select, or create any folder on internal/external storage.
 */
export async function pickAndroidStorageDirectory(): Promise<string | null> {
  if (Platform.OS === 'android' && (FileSystem as any).StorageAccessFramework) {
    try {
      const permissions = await (FileSystem as any).StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted && permissions.directoryUri) {
        const uri = permissions.directoryUri;
        const formattedUri = uri.endsWith('/') ? uri : `${uri}/`;
        useDownloadStore.getState().setCustomStorageDirectory(formattedUri);
        return formattedUri;
      }
    } catch (err) {
      console.warn('SAF storage directory picker failed or was cancelled:', err);
    }
  }
  return null;
}

/**
 * Download a full chapter locally page by page
 */
export async function downloadChapter(params: {
  chapterId: string;
  mangaId: string;
  mangaTitle: string;
  chapterNum: string;
  chapterTitle: string;
  coverUrl?: string | null;
}): Promise<void> {
  const { chapterId, mangaId, mangaTitle, chapterNum, chapterTitle, coverUrl } = params;
  const store = useDownloadStore.getState();

  try {
    // 1. Register in store
    store.startDownload({
      chapterId,
      mangaId,
      mangaTitle,
      chapterNum,
      chapterTitle,
      coverUrl,
      totalFiles: 0,
    });

    // 2. Fetch page image URLs from MangaDex API
    const { pages } = await getChapterPages(chapterId, false);
    if (!pages || pages.length === 0) {
      throw new Error('No page URLs returned for this chapter.');
    }

    // 3. Ensure target local directory exists
    const baseDir = getBaseDownloadDirectory();
    const chapterDir = `${baseDir}${mangaId}/${chapterId}/`;
    await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });

    const localPages: string[] = [];
    let totalSizeBytes = 0;

    // 4. Download pages sequentially
    for (let i = 0; i < pages.length; i++) {
      const pageUrl = pages[i];
      const ext = pageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const localFilePath = `${chapterDir}page_${i + 1}.${ext}`;

      const downloadResult = await FileSystem.downloadAsync(pageUrl, localFilePath);
      localPages.push(downloadResult.uri);

      // Inspect file size
      try {
        const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
        if (fileInfo.exists && fileInfo.size) {
          totalSizeBytes += fileInfo.size;
        }
      } catch (err) {
        // Ignore stat errors
      }

      // Update store progress
      useDownloadStore.getState().updateProgress(chapterId, i + 1, pages.length, [...localPages], totalSizeBytes);
    }

    // 5. Write metadata json
    const metaPath = `${chapterDir}meta.json`;
    await FileSystem.writeAsStringAsync(
      metaPath,
      JSON.stringify({
        chapterId,
        mangaId,
        mangaTitle,
        chapterNum,
        chapterTitle,
        pagesCount: localPages.length,
        downloadedAt: new Date().toISOString(),
      })
    );

    // 6. Complete download
    useDownloadStore.getState().setCompleted(chapterId, localPages, totalSizeBytes);
  } catch (error: any) {
    console.error(`Failed to download chapter ${chapterId}:`, error);
    useDownloadStore.getState().setFailed(chapterId, error?.message || 'Download failed');
  }
}

/**
 * Delete a downloaded chapter from disk and storage
 */
export async function removeDownloadedChapter(chapterId: string, mangaId: string): Promise<void> {
  try {
    const baseDir = getBaseDownloadDirectory();
    const chapterDir = `${baseDir}${mangaId}/${chapterId}/`;
    await FileSystem.deleteAsync(chapterDir, { idempotent: true });
  } catch (err) {
    console.warn(`Error deleting chapter files for ${chapterId}:`, err);
  } finally {
    useDownloadStore.getState().deleteDownload(chapterId);
  }
}

/**
 * Calculate total disk space used by Yomite downloads in bytes
 */
export async function getDownloadStorageUsage(): Promise<number> {
  try {
    const baseDir = getBaseDownloadDirectory();
    const info = await FileSystem.getInfoAsync(baseDir);
    if (!info.exists) return 0;

    let totalBytes = 0;
    const chapters = Object.values(useDownloadStore.getState().chapters);
    chapters.forEach((ch) => {
      if (ch.status === 'completed') {
        totalBytes += ch.sizeBytes || 0;
      }
    });
    return totalBytes;
  } catch (err) {
    return 0;
  }
}
