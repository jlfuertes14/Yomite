import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibraryStore } from '../store/libraryStore';
import { getUniversalMangaChapters, isExternalSource } from '../sources/adapter';
import { SourceManager } from '../sources/SourceManager';
import type { Chapter } from '../types';
import {
  sendNewChapterNotification,
  sendBatchChapterNotification,
  ChapterNotificationPayload,
} from './notificationService';

export const BACKGROUND_SCAN_TASK = 'YOMITE_LIBRARY_CHECK';
const KNOWN_CHAPTERS_STORAGE_KEY = '@yomite_known_latest_chapters_v1';
// v2 starts notifications disabled by default so enabling them is always an explicit opt-in.
const SCAN_CONFIG_STORAGE_KEY = '@yomite_bg_scan_config_v2';

export interface BackgroundScanConfig {
  enabled: boolean;
  intervalMinutes: number;
  lastScanTimestamp: number;
}

const DEFAULT_CONFIG: BackgroundScanConfig = {
  enabled: false,
  intervalMinutes: 360, // 6 hours
  lastScanTimestamp: 0,
};

/**
 * Persisted map of mangaId -> latest known chapter ID
 */
async function getKnownChaptersMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KNOWN_CHAPTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveKnownChaptersMap(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(KNOWN_CHAPTERS_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save known chapters map:', err);
  }
}

export async function getBackgroundScanConfig(): Promise<BackgroundScanConfig> {
  try {
    const raw = await AsyncStorage.getItem(SCAN_CONFIG_STORAGE_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveBackgroundScanConfig(config: Partial<BackgroundScanConfig>): Promise<void> {
  try {
    const current = await getBackgroundScanConfig();
    const updated = { ...current, ...config };
    await AsyncStorage.setItem(SCAN_CONFIG_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save background scan config:', err);
  }
}

/**
 * Resolves the newest/latest chapter from a chapter list across different source sorting conventions
 */
export function getLatestChapter(chapters: Chapter[]): Chapter | null {
  if (!chapters || chapters.length === 0) return null;

  let maxNum = -Infinity;
  let maxChapter: Chapter | null = null;

  for (const ch of chapters) {
    const raw = ch.attributes?.chapter;
    const num = raw ? parseFloat(raw) : NaN;
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
      maxChapter = ch;
    }
  }

  if (maxChapter && maxNum > -Infinity) return maxChapter;

  // Fallback: compare upload timestamps or first/last item
  const firstDate = new Date(chapters[0].attributes?.readableAt || 0).getTime();
  const lastDate = new Date(chapters[chapters.length - 1].attributes?.readableAt || 0).getTime();
  return firstDate >= lastDate ? chapters[0] : chapters[chapters.length - 1];
}

/**
 * Core update checking routine.
 * Can be called either from the background task or manually via Settings / Pull-to-refresh.
 * Universally supports MangaDex and all 1,200+ Kotatsu/external extension catalog sources.
 */
export async function checkLibraryForUpdates(options?: {
  forceNotify?: boolean;
}): Promise<{
  newUpdates: ChapterNotificationPayload[];
  checkedCount: number;
}> {
  const libraryEntries = Object.values(useLibraryStore.getState().entries);
  
  // Specifically filter items marked "Reading" (and favorites if active)
  const targetMangaList = libraryEntries.filter(
    (entry) => entry.category === 'reading' || entry.category === 'favorites'
  );

  if (targetMangaList.length === 0) {
    return { newUpdates: [], checkedCount: 0 };
  }

  const knownMap = await getKnownChaptersMap();
  const updatedKnownMap = { ...knownMap };
  const newUpdates: ChapterNotificationPayload[] = [];
  const isFirstEverScan = Object.keys(knownMap).length === 0;

  for (const entry of targetMangaList) {
    try {
      // Query chapters universally: handles MangaDex and all external scrapers/parsers
      const chapters = await getUniversalMangaChapters(entry.mangaId);
      const latestChapter = getLatestChapter(chapters);

      if (latestChapter) {
        const latestId = latestChapter.id;
        const chapterNum = latestChapter.attributes?.chapter || 'New';
        const knownId = knownMap[entry.mangaId];

        // Dynamically resolve actual source name (e.g. Asura Scans, Manganato, Flame Comics, MangaDex)
        let sourceName = 'MangaDex';
        if (isExternalSource(entry.mangaId)) {
          const resolved = SourceManager.resolveSource(entry.mangaId);
          sourceName = resolved?.parser?.metadata?.name || 'External Catalog';
        }

        // If we previously indexed this title and the latest chapter changed, flag it!
        if (knownId && knownId !== latestId) {
          newUpdates.push({
            mangaTitle: entry.title,
            chapterNum: String(chapterNum),
            mangaId: entry.mangaId,
            chapterId: latestId,
            sourceName,
          });
        } else if (isFirstEverScan && options?.forceNotify) {
          // If forced test on initial scan
          newUpdates.push({
            mangaTitle: entry.title,
            chapterNum: String(chapterNum),
            mangaId: entry.mangaId,
            chapterId: latestId,
            sourceName,
          });
        }

        updatedKnownMap[entry.mangaId] = latestId;
      }
    } catch {
      // Continue to check other titles in case of transient network failure on a specific source
    }
  }

  await saveKnownChaptersMap(updatedKnownMap);
  await saveBackgroundScanConfig({ lastScanTimestamp: Date.now() });

  // Deliver notifications based on single vs batch results
  if (newUpdates.length === 1) {
    await sendNewChapterNotification(newUpdates[0]);
  } else if (newUpdates.length > 1) {
    await sendBatchChapterNotification({
      totalCount: newUpdates.length,
      titles: newUpdates.map((u) => u.mangaTitle),
      firstMangaId: newUpdates[0]?.mangaId,
      firstChapterId: newUpdates[0]?.chapterId,
    });
  }

  return { newUpdates, checkedCount: targetMangaList.length };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BACKGROUND TASK REGISTRATION (Root Level Execution)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(BACKGROUND_SCAN_TASK, async () => {
      try {
        const config = await getBackgroundScanConfig();
        if (!config.enabled) {
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const { newUpdates } = await checkLibraryForUpdates();

        return newUpdates.length > 0
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.NoData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  } catch (err) {
    console.warn('Failed to define background library check task:', err);
  }
}

/**
 * Register periodic library scanner task with the native scheduler (WorkManager / BGTaskScheduler)
 */
export async function registerLibraryScanTask(intervalMinutes: number = 360): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCAN_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SCAN_TASK, {
        minimumInterval: Math.max(15, intervalMinutes) * 60, // seconds
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }

    await saveBackgroundScanConfig({
      enabled: true,
      intervalMinutes,
    });

    return true;
  } catch (err) {
    console.warn('Failed to register background library scan task:', err);
    return false;
  }
}

/**
 * Unregister periodic library scanner task
 */
export async function unregisterLibraryScanTask(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCAN_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SCAN_TASK);
    }

    await saveBackgroundScanConfig({ enabled: false });
    return true;
  } catch (err) {
    console.warn('Failed to unregister background task:', err);
    return false;
  }
}

/**
 * Check if the background task is currently active
 */
export async function isLibraryScanTaskRegistered(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCAN_TASK);
  } catch {
    return false;
  }
}
