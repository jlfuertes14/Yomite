import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useLibraryStore } from '../store/libraryStore';
import { getMangaChapters, getMangaTitle } from '../api/mangadex';
import { sendNewChapterNotification } from './notificationService';

export const BACKGROUND_SCAN_TASK = 'YOMITE_LIBRARY_CHECK';

let lastScanTimestamp = Date.now() - 24 * 60 * 60 * 1000; // Default 24h ago

// Define background task
TaskManager.defineTask(BACKGROUND_SCAN_TASK, async () => {
  try {
    const libraryEntries = Object.values(useLibraryStore.getState().entries);
    const targetMangaList = libraryEntries.filter(
      (entry) => entry.category === 'reading' || entry.category === 'favorites'
    );

    if (targetMangaList.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    let foundNewChapters = false;
    const now = Date.now();

    for (const entry of targetMangaList) {
      try {
        const chaptersFeed = await getMangaChapters(entry.mangaId, 'en', 5, 0, 'desc');
        if (chaptersFeed.data && chaptersFeed.data.length > 0) {
          const latestChapter = chaptersFeed.data[0];
          const pubAt = latestChapter.attributes.publishAt || latestChapter.attributes.readableAt;
          if (pubAt) {
            const pubTime = new Date(pubAt).getTime();
            if (pubTime > lastScanTimestamp) {
              foundNewChapters = true;
              await sendNewChapterNotification({
                mangaTitle: entry.title,
                chapterNum: latestChapter.attributes.chapter || 'New',
                mangaId: entry.mangaId,
                chapterId: latestChapter.id,
              });
            }
          }
        }
      } catch (err) {
        // Continue loop
      }
    }

    lastScanTimestamp = now;
    return foundNewChapters
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register periodic library scanner task
 */
export async function registerLibraryScanTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCAN_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SCAN_TASK, {
        minimumInterval: 60 * 60 * 6, // 6 hours
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (err) {
    console.warn('Failed to register background library scan task:', err);
  }
}

/**
 * Unregister periodic library scanner task
 */
export async function unregisterLibraryScanTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCAN_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SCAN_TASK);
    }
  } catch (err) {
    console.warn('Failed to unregister background task:', err);
  }
}
