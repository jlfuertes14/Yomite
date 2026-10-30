import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { useDownloadStore } from '../store/downloadStore';
import { getChapterPages } from '../api/mangadex';
import { getUniversalChapterPages, isExternalSource } from '../sources/adapter';
import { SourceManager } from '../sources/SourceManager';

/**
 * Returns the active base download folder path
 */
export function getBaseDownloadDirectory(): string {
  const customDir = useDownloadStore.getState().downloadDirectory;
  if (customDir && customDir.trim()) {
    return customDir.endsWith('/') ? customDir : `${customDir}/`;
  }
  const docDir = (FileSystem as any).documentDirectory || '';
  return `${docDir}Yomite/`;
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
  return `${docDir}Yomite/`;
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

    // 3. Fetch page image URLs (supports MangaDex and all external sources like AsuraScans)
    let pages: string[] = [];
    let headers: Record<string, string> | undefined;

    if (isExternalSource(chapterId)) {
      const result = await getUniversalChapterPages(chapterId);
      pages = (result.pages || []).map((p) => {
        if (!p) return p;
        if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('file:')) {
          return p;
        }
        if (p.startsWith('/api/media/') || chapterId.includes('philia')) {
          return `https://philiascans.org/${p.replace(/^\/+/, '')}`;
        }
        return p;
      });
      headers = result.headers;
      if (!headers) {
        const resolved = SourceManager.resolveSource(chapterId);
        if (resolved?.parser && (resolved.parser as any).getRequestHeaders) {
          headers = (resolved.parser as any).getRequestHeaders();
        }
      }
    } else {
      const cleanId = chapterId.replace(/^mangadex:/, '');
      const res = await getChapterPages(cleanId, false);
      pages = res.pages || [];
    }

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
      await downloadChapterWeb(params, pages, signal, headers);
      return;
    }

    let baseDir = getBaseDownloadDirectory();
    const isSaf = baseDir.startsWith('content://');

    // 5. Try SAF download if user configured a SAF content:// URI (Android only)
    if (isSaf && (FileSystem as any).StorageAccessFramework) {
      try {
        await downloadChapterSaf(params, pages, baseDir, headers);
        return;
      } catch (safErr: any) {
        console.warn(
          'SAF location is not writable or failed. Resetting to default app storage:',
          safErr?.message || safErr
        );
        useDownloadStore.getState().setCustomStorageDirectory(null);
        baseDir = `${(FileSystem as any).documentDirectory || ''}Yomite/`;
      }
    }

    // 6. Standard FileSystem download (file://...)
    await downloadChapterStandard(params, pages, baseDir, signal, headers);
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
  signal: AbortSignal,
  headers?: Record<string, string>
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

  // Filter out headers forbidden by browser fetch
  const fetchHeaders: Record<string, string> = {};
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      if (!['user-agent', 'referer', 'host', 'origin'].includes(k.toLowerCase())) {
        fetchHeaders[k] = v;
      }
    }
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
      const response = await fetch(pageUrl, {
        headers: Object.keys(fetchHeaders).length > 0 ? fetchHeaders : undefined,
        mode: 'cors',
        signal,
      });
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
  signal?: AbortSignal,
  headers?: Record<string, string>
): Promise<void> {
  const { chapterId, mangaId, mangaTitle, chapterNum, chapterTitle } = params;
  const safeMangaId = (mangaId || 'manga').replace(/[:\/\\?%*|"<>]/g, '_');
  const safeChapterId = (chapterId || 'chapter').replace(/[:\/\\?%*|"<>]/g, '_');
  const chapterDir = `${baseDir}${safeMangaId}/${safeChapterId}/`;
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

    const downloadResult = await FileSystem.downloadAsync(
      pageUrl,
      localFilePath,
      headers ? { headers } : undefined
    );
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
    useDownloadStore.getState().setCompleted(chapterId, localPages, totalSizeBytes);
  }
}

/**
 * Android StorageAccessFramework (SAF) content:// download implementation
 */
async function downloadChapterSaf(
  params: any,
  pages: string[],
  baseDir: string,
  headers?: Record<string, string>
): Promise<void> {
  const { chapterId, mangaId, mangaTitle, chapterNum, chapterTitle } = params;
  const SAF = (FileSystem as any).StorageAccessFramework;

  const parentUri = baseDir.replace(/\/$/, '');
  const safeMangaId = (mangaId || 'manga').replace(/[:\/\\?%*|"<>]/g, '_');
  const safeChapterId = (chapterId || 'chapter').replace(/[:\/\\?%*|"<>]/g, '_');

  let mangaFolderUri: string;
  try {
    mangaFolderUri = await SAF.makeDirectoryAsync(parentUri, safeMangaId);
  } catch (_e) {
    mangaFolderUri = `${parentUri}%2F${encodeURIComponent(safeMangaId)}`;
  }

  let chapterFolderUri: string;
  try {
    chapterFolderUri = await SAF.makeDirectoryAsync(mangaFolderUri, safeChapterId);
  } catch (_e) {
    chapterFolderUri = `${mangaFolderUri}%2F${encodeURIComponent(safeChapterId)}`;
  }

  const localPages: string[] = [];
  let totalSizeBytes = 0;

  for (let i = 0; i < pages.length; i++) {
    const pageUrl = pages[i];
    const ext = pageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const tempFile = `${(FileSystem as any).cacheDirectory || ''}temp_dl_${Date.now()}_${i}.${ext}`;

    const tempRes = await FileSystem.downloadAsync(
      pageUrl,
      tempFile,
      headers ? { headers } : undefined
    );

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
    const safeMangaId = mangaId ? mangaId.replace(/[:\/\\?%*|"<>]/g, '_') : '';
    const safeChapterId = chapterId ? chapterId.replace(/[:\/\\?%*|"<>]/g, '_') : '';

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
      if (safeMangaId) {
        const internalChapterDir = `${docDir}Yomite/${safeMangaId}/${safeChapterId}/`;
        try {
          await FileSystem.deleteAsync(internalChapterDir, { idempotent: true });
        } catch (_e) {}
      }
      if (mangaId !== safeMangaId || chapterId !== safeChapterId) {
        const legacyChapterDir = `${docDir}Yomite/${mangaId}/${chapterId}/`;
        try {
          await FileSystem.deleteAsync(legacyChapterDir, { idempotent: true });
        } catch (_e) {}
      }
    }

    // 3. Clean up SAF directory entries if custom SAF folder is active
    if (baseDir.startsWith('content://') && SAF) {
      try {
        const parentUri = baseDir.replace(/\/$/, '');
        const folderFiles = await SAF.readDirectoryAsync(parentUri);
        for (const fileUri of folderFiles) {
          if (
            fileUri.includes(encodeURIComponent(safeChapterId)) ||
            fileUri.includes(safeChapterId) ||
            fileUri.includes(chapterId) ||
            (safeMangaId && (fileUri.includes(encodeURIComponent(safeMangaId)) || fileUri.includes(safeMangaId)))
          ) {
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
