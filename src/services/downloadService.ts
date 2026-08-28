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
  const customDir = useDownloadStore.getState().downloadDirectory;
  if (customDir && customDir.trim()) {
    if (customDir.includes('primary%3A')) {
      const folderName = customDir.split('primary%3A').pop()?.replace(/\/$/, '') || '';
      return `/storage/emulated/0/${decodeURIComponent(folderName)}`;
    }
    return customDir.endsWith('/') ? customDir : `${customDir}/`;
  }
  if (Platform.OS === 'web') {
    return 'Browser IndexedDB / Cache (downloads/yomite/)';
  }
  const docDir = (FileSystem as any).documentDirectory || '';
  return `${docDir}downloads/`;
}

/**
 * Opens native directory picker across Android (SAF) and Web (File System Access API / HTML5 Directory input)
 */
export async function pickStorageDirectory(): Promise<string | null> {
  // 1. Android Native SAF Picker
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

  // 2. Web File System Access API / Directory Selector
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          id: 'yomite_manga_vault',
          mode: 'readwrite',
        });
        if (dirHandle && dirHandle.name) {
          const formattedPath = `downloads/${dirHandle.name}`;
          useDownloadStore.getState().setCustomStorageDirectory(formattedPath);
          return formattedPath;
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Web directory picker error:', err);
        }
      }
    } else if (typeof document !== 'undefined') {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
        input.style.display = 'none';

        input.onchange = (e: any) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const folderName = files[0].webkitRelativePath?.split('/')[0] || 'downloads/custom';
            const formatted = `downloads/${folderName}`;
            useDownloadStore.getState().setCustomStorageDirectory(formatted);
            resolve(formatted);
          } else {
            resolve(null);
          }
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        };

        input.oncancel = () => {
          resolve(null);
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        };

        document.body.appendChild(input);
        input.click();
      });
    }
  }

  return null;
}

export const pickAndroidStorageDirectory = pickStorageDirectory;

const activeAbortControllers = new Map<string, AbortController>();
const pausedChapterIds = new Set<string>();

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

  // Reset pause tracking and create AbortController for this download
  pausedChapterIds.delete(chapterId);
  const controller = new AbortController();
  activeAbortControllers.set(chapterId, controller);
  const signal = controller.signal;

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

    // Check if user paused while fetching chapter page URLs
    if (signal.aborted || pausedChapterIds.has(chapterId) || store.chapters[chapterId]?.status === 'paused') {
      console.log(`[DownloadService] Chapter ${chapterId} was paused before downloading pages.`);
      return;
    }

    // 4. On Web platform: use browser CacheStorage / Blob caching
    if (Platform.OS === 'web') {
      await downloadChapterWeb(params, pages, signal);
      return;
    }

    let baseDir = getBaseDownloadDirectory();
    const isSaf = baseDir.startsWith('content://');

    // 5. Try SAF download if user configured a SAF content:// URI (Android only)
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

    // 6. Standard FileSystem download (file://...)
    await downloadChapterStandard(params, pages, baseDir, signal);
  } catch (error: any) {
    if (signal.aborted || pausedChapterIds.has(chapterId) || error?.name === 'AbortError') {
      console.log(`[DownloadService] Download cancelled/paused for chapter ${chapterId}`);
      return;
    }
    console.error(`Failed to download chapter ${chapterId}:`, error);
    useDownloadStore.getState().setFailed(chapterId, error?.message || 'Download failed');
  } finally {
    activeAbortControllers.delete(chapterId);
  }
}

/**
 * Web browser download implementation using CacheStorage and Blob URLs
 */
async function downloadChapterWeb(
  params: any,
  pages: string[],
  signal: AbortSignal
): Promise<void> {
  const { chapterId } = params;
  const store = useDownloadStore.getState();
  const existing = store.chapters[chapterId];
  const localPages: string[] = existing?.localPages ? [...existing.localPages] : [];
  let totalSizeBytes = existing?.sizeBytes || 0;
  const startIndex = localPages.length;

  let cache: Cache | null = null;
  if (typeof caches !== 'undefined') {
    try {
      cache = await caches.open('yomite-manga-chapters-v1');
    } catch (_err) {}
  }

  for (let i = startIndex; i < pages.length; i++) {
    // Check if user paused the download or signal aborted
    if (signal.aborted || pausedChapterIds.has(chapterId) || useDownloadStore.getState().chapters[chapterId]?.status === 'paused') {
      console.log(`[DownloadService] Chapter ${chapterId} paused on web at page ${i}/${pages.length}`);
      return;
    }

    const pageUrl = pages[i];
    let finalPageUri = pageUrl;

    try {
      const response = await fetch(pageUrl, { mode: 'cors', signal });
      if (response.ok) {
        const blob = await response.blob();
        const blobSize = blob.size || 350000;
        totalSizeBytes += blobSize;

        if (cache) {
          try {
            await cache.put(
              pageUrl,
              new Response(blob.slice(0), {
                headers: {
                  'Content-Type': blob.type || 'image/jpeg',
                  'Cache-Control': 'public, max-age=31536000',
                },
              })
            );
          } catch (_cErr) {}
        }
        finalPageUri = pageUrl;
      } else {
        totalSizeBytes += 300000;
      }
    } catch (fetchErr: any) {
      if (signal.aborted || pausedChapterIds.has(chapterId) || fetchErr?.name === 'AbortError') {
        console.log(`[DownloadService] Fetch aborted on pause for chapter ${chapterId}`);
        return;
      }
      totalSizeBytes += 300000;
      finalPageUri = pageUrl;
    }

    if (signal.aborted || pausedChapterIds.has(chapterId) || useDownloadStore.getState().chapters[chapterId]?.status === 'paused') {
      console.log(`[DownloadService] Chapter ${chapterId} paused immediately after fetch.`);
      return;
    }

    localPages.push(finalPageUri);
    useDownloadStore.getState().updateProgress(chapterId, localPages.length, pages.length, [...localPages], totalSizeBytes);
  }

  if (!signal.aborted && !pausedChapterIds.has(chapterId) && useDownloadStore.getState().chapters[chapterId]?.status !== 'paused') {
    useDownloadStore.getState().setCompleted(chapterId, localPages, totalSizeBytes);
  }
}

/**
 * Standard download implementation using file:// paths
 */
async function downloadChapterStandard(
  params: any,
  pages: string[],
  baseDir: string,
  signal?: AbortSignal
): Promise<void> {
  const { chapterId, mangaId, mangaTitle, chapterNum, chapterTitle } = params;
  const chapterDir = `${baseDir}${mangaId}/${chapterId}/`;
  await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });

  const store = useDownloadStore.getState();
  const existing = store.chapters[chapterId];
  const localPages: string[] = existing?.localPages ? [...existing.localPages] : [];
  let totalSizeBytes = existing?.sizeBytes || 0;
  const startIndex = localPages.length;

  for (let i = startIndex; i < pages.length; i++) {
    // Check if user clicked pause
    if (signal?.aborted || pausedChapterIds.has(chapterId) || useDownloadStore.getState().chapters[chapterId]?.status === 'paused') {
      console.log(`[DownloadService] Chapter ${chapterId} paused at page ${i}/${pages.length}`);
      return;
    }

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

    if (signal?.aborted || pausedChapterIds.has(chapterId) || useDownloadStore.getState().chapters[chapterId]?.status === 'paused') {
      return;
    }

    useDownloadStore.getState().updateProgress(chapterId, localPages.length, pages.length, [...localPages], totalSizeBytes);
  }

  if (!signal?.aborted && !pausedChapterIds.has(chapterId) && useDownloadStore.getState().chapters[chapterId]?.status !== 'paused') {
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

  try {
    // On Web platform: remove cached pages from CacheStorage
    if (Platform.OS === 'web') {
      if (typeof caches !== 'undefined' && chapterObj && chapterObj.localPages) {
        try {
          const cache = await caches.open('yomite-manga-chapters-v1');
          for (const pageUrl of chapterObj.localPages) {
            if (pageUrl && pageUrl.startsWith('http')) {
              await cache.delete(pageUrl);
            }
          }
        } catch (_cErr) {}
      }
      return;
    }

    const baseDir = getBaseDownloadDirectory();
    const SAF = (FileSystem as any).StorageAccessFramework;

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
 * Pause an active download for a chapter
 */
export function pauseDownloadChapter(chapterId: string): void {
  pausedChapterIds.add(chapterId);
  useDownloadStore.getState().setPaused(chapterId);
  const controller = activeAbortControllers.get(chapterId);
  if (controller) {
    controller.abort();
    activeAbortControllers.delete(chapterId);
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
