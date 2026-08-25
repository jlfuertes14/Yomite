import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { useDownloadStore } from '../store/downloadStore';
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
    // 1. Skip if chapter is already downloaded to prevent duplicates
    const existing = store.chapters[chapterId];
    if (existing && existing.status === 'completed') {
      console.log(`[DownloadService] Chapter ${chapterId} is already downloaded. Skipping duplicate.`);
      return;
    }

    // 2. Register in store
    store.startDownload({
      chapterId,
      mangaId,
      mangaTitle,
      chapterNum,
      chapterTitle,
      coverUrl,
      totalFiles: 0,
    });

    // 3. Fetch page image URLs from MangaDex API
    const { pages } = await getChapterPages(chapterId, false);
    if (!pages || pages.length === 0) {
      throw new Error('No page URLs returned for this chapter.');
    }

    let baseDir = getBaseDownloadDirectory();
    const isSaf = baseDir.startsWith('content://');

    // 4. Try SAF download if user configured a SAF content:// URI
    if (isSaf && (FileSystem as any).StorageAccessFramework) {
      try {
        await downloadChapterSaf(params, pages, baseDir);
        return;
      } catch (safErr: any) {
        console.warn(
          'SAF location is not writable or failed. Resetting to default app storage:',
          safErr?.message || safErr
        );
        useDownloadStore.getState().setCustomStorageDirectory(null);
        baseDir = `${(FileSystem as any).documentDirectory || ''}downloads/`;
      }
    }

    // 5. Standard FileSystem download (file://...)
    await downloadChapterStandard(params, pages, baseDir);
  } catch (error: any) {
    console.error(`Failed to download chapter ${chapterId}:`, error);
    useDownloadStore.getState().setFailed(chapterId, error?.message || 'Download failed');
  }
}

/**
 * Standard download implementation using file:// paths
 */
async function downloadChapterStandard(
  params: any,
  pages: string[],
  baseDir: string
): Promise<void> {
  const { chapterId, mangaId, mangaTitle, chapterNum, chapterTitle } = params;
  const chapterDir = `${baseDir}${mangaId}/${chapterId}/`;
  await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });

  const localPages: string[] = [];
  let totalSizeBytes = 0;

  for (let i = 0; i < pages.length; i++) {
    const pageUrl = pages[i];
    const ext = pageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const localFilePath = `${chapterDir}page_${i + 1}.${ext}`;

    const downloadResult = await FileSystem.downloadAsync(pageUrl, localFilePath);
    localPages.push(downloadResult.uri);

    try {
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (fileInfo.exists && fileInfo.size) {
        totalSizeBytes += fileInfo.size;
      }
    } catch (_err) {}

    useDownloadStore.getState().updateProgress(chapterId, i + 1, pages.length, [...localPages], totalSizeBytes);
  }

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
  localPages.push(metaPath);

  useDownloadStore.getState().setCompleted(chapterId, localPages, totalSizeBytes);
}

/**
 * Android StorageAccessFramework (SAF) content:// download implementation
 */
async function downloadChapterSaf(
  params: any,
  pages: string[],
  baseDir: string
): Promise<void> {
  const { chapterId, mangaId, mangaTitle, chapterNum, chapterTitle } = params;
  const SAF = (FileSystem as any).StorageAccessFramework;

  const parentUri = baseDir.replace(/\/$/, '');

  let mangaFolderUri: string;
  try {
    mangaFolderUri = await SAF.makeDirectoryAsync(parentUri, mangaId);
  } catch (_e) {
    mangaFolderUri = `${parentUri}%2F${mangaId}`;
  }

  let chapterFolderUri: string;
  try {
    chapterFolderUri = await SAF.makeDirectoryAsync(mangaFolderUri, chapterId);
  } catch (_e) {
    chapterFolderUri = `${mangaFolderUri}%2F${chapterId}`;
  }

  const localPages: string[] = [];
  let totalSizeBytes = 0;

  for (let i = 0; i < pages.length; i++) {
    const pageUrl = pages[i];
    const ext = pageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const tempFile = `${(FileSystem as any).cacheDirectory || ''}temp_dl_${Date.now()}_${i}.${ext}`;

    const tempRes = await FileSystem.downloadAsync(pageUrl, tempFile);

    const base64Data = await FileSystem.readAsStringAsync(tempRes.uri, {
      encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
    });

    const safFileUri = await SAF.createFileAsync(chapterFolderUri, `page_${i + 1}.${ext}`, mimeType);
    await SAF.writeAsStringAsync(safFileUri, base64Data, {
      encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
    });

    localPages.push(safFileUri);

    try {
      const info = await FileSystem.getInfoAsync(tempRes.uri);
      if (info.exists && info.size) {
        totalSizeBytes += info.size;
      }
      await FileSystem.deleteAsync(tempRes.uri, { idempotent: true });
    } catch (_e) {}

    useDownloadStore.getState().updateProgress(chapterId, i + 1, pages.length, [...localPages], totalSizeBytes);
  }

  try {
    const metaFileUri = await SAF.createFileAsync(chapterFolderUri, 'meta.json', 'application/json');
    await SAF.writeAsStringAsync(
      metaFileUri,
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
    localPages.push(metaFileUri);
  } catch (_e) {}

  useDownloadStore.getState().setCompleted(chapterId, localPages, totalSizeBytes);
}

/**
 * Delete a downloaded chapter from disk and storage at native OS level
 */
export async function removeDownloadedChapter(chapterId: string, mangaId: string): Promise<void> {
  const store = useDownloadStore.getState();
  const chapterObj = store.chapters[chapterId];
  const baseDir = getBaseDownloadDirectory();
  const SAF = (FileSystem as any).StorageAccessFramework;

  try {
    // 1. Delete all recorded page file URIs directly from disk / SAF
    if (chapterObj && chapterObj.localPages && chapterObj.localPages.length > 0) {
      for (const fileUri of chapterObj.localPages) {
        if (!fileUri) continue;
        try {
          if (fileUri.startsWith('content://') && SAF) {
            await SAF.deleteAsync(fileUri, { idempotent: true });
          } else {
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
          }
        } catch (_e) {}
      }
    }

    // 2. Delete standard internal documentDirectory folder (file://)
    const docDir = (FileSystem as any).documentDirectory || '';
    if (docDir) {
      const internalChapterDir = `${docDir}downloads/${mangaId}/${chapterId}/`;
      try {
        await FileSystem.deleteAsync(internalChapterDir, { idempotent: true });
      } catch (_e) {}
    }

    // 3. Clean up SAF directory entries if custom SAF folder is active
    if (baseDir.startsWith('content://') && SAF) {
      try {
        const parentUri = baseDir.replace(/\/$/, '');
        const folderFiles = await SAF.readDirectoryAsync(parentUri);
        for (const fileUri of folderFiles) {
          if (fileUri.includes(chapterId) || fileUri.includes(mangaId)) {
            try {
              await SAF.deleteAsync(fileUri, { idempotent: true });
            } catch (_e) {}
          }
        }
      } catch (_e) {}
    }
  } catch (_err) {
    // Suppress non-fatal deletion warnings
  } finally {
    store.deleteDownload(chapterId);
  }
}

/**
 * Calculate total disk space used by Yomite downloads in bytes
 */
export async function getDownloadStorageUsage(): Promise<number> {
  try {
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
