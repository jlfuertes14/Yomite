/**
 * Cloud Sync Service — Auto-merges and synchronizes local Reading History
 * and Library Bookmarks with Supabase Cloud when a user logs in.
 */
import { supabase } from '../lib/supabase';
import { useHistoryStore } from '../store/historyStore';
import { useLibraryStore } from '../store/libraryStore';

/**
 * Synchronize local AsyncStorage history & library with Supabase cloud user account.
 * Pushes offline reading history to cloud and merges remote records into local store.
 */
export async function syncUserDataWithCloud(userId: string): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    return { success: false, message: 'User not authenticated' };
  }

  try {
    const historyStore = useHistoryStore.getState();
    const libraryStore = useLibraryStore.getState();

    // ─── 1. SYNC READING HISTORY ───
    const localHistory = historyStore.entries;

    if (localHistory.length > 0) {
      const historyRows = localHistory.map((item) => ({
        user_id: userId,
        manga_id: item.mangaId,
        manga_title: item.title,
        cover_url: item.coverUrl,
        chapter_id: item.chapterId,
        chapter_title: item.chapterTitle,
        page_index: item.pageIndex,
        total_pages: item.totalPages,
        updated_at: new Date(item.timestamp).toISOString(),
      }));

      try {
        await supabase
          .from('user_history')
          .upsert(historyRows, { onConflict: 'user_id,manga_id' });
      } catch (_e) {}
    }

    // Pull cloud history backup & restore/merge into local device store
    try {
      const { data: remoteHistory } = await supabase
        .from('user_history')
        .select('*')
        .eq('user_id', userId);

      if (remoteHistory && Array.isArray(remoteHistory) && remoteHistory.length > 0) {
        remoteHistory.forEach((row) => {
          historyStore.addEntry({
            mangaId: row.manga_id,
            title: row.manga_title,
            coverUrl: row.cover_url,
            chapterId: row.chapter_id,
            chapterTitle: row.chapter_title,
            pageIndex: row.page_index || 0,
            totalPages: row.total_pages || 1,
          });
        });
      }
    } catch (_e) {}

    // ─── 2. SYNC LIBRARY BOOKMARKS ───
    const localLibraryItems = Object.values(libraryStore.entries);

    if (localLibraryItems.length > 0) {
      const libraryRows = localLibraryItems.map((item) => ({
        user_id: userId,
        manga_id: item.mangaId,
        title: item.title,
        cover_url: item.coverUrl,
        category: item.category,
        total_chapters: item.totalChapters,
        unread_count: item.unreadCount,
        updated_at: item.addedAt ? new Date(item.addedAt).toISOString() : new Date().toISOString(),
      }));

      try {
        await supabase
          .from('user_library')
          .upsert(libraryRows, { onConflict: 'user_id,manga_id' });
      } catch (_e) {}
    }

    try {
      const { data: remoteLibrary } = await supabase
        .from('user_library')
        .select('*')
        .eq('user_id', userId);

      if (remoteLibrary && Array.isArray(remoteLibrary) && remoteLibrary.length > 0) {
        remoteLibrary.forEach((row) => {
          const existing = libraryStore.entries[row.manga_id];
          if (!existing) {
            libraryStore.addToLibrary({
              mangaId: row.manga_id,
              title: row.title,
              coverUrl: row.cover_url,
              category: row.category,
              lastReadChapterId: null,
              lastReadPage: 0,
              totalChapters: row.total_chapters || 0,
              unreadCount: row.unread_count || 0,
            });
          }
        });
      }
    } catch (_e) {}

    return { success: true, message: 'Cloud sync completed successfully' };
  } catch (err: any) {
    console.warn('Cloud sync encountered non-fatal error:', err);
    return { success: false, message: err?.message || 'Sync error' };
  }
}

/**
 * Remove single history item from Supabase cloud table for an authenticated user
 */
export async function deleteCloudHistoryEntry(userId: string, mangaId: string): Promise<void> {
  if (!userId || !mangaId) return;
  try {
    await supabase
      .from('user_history')
      .delete()
      .eq('user_id', userId)
      .eq('manga_id', mangaId);
  } catch (_e) {}
}

/**
 * Clear all cloud history for an authenticated user
 */
export async function clearCloudHistory(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await supabase
      .from('user_history')
      .delete()
      .eq('user_id', userId);
  } catch (_e) {}
}

/**
 * Remove library entry from Supabase cloud table
 */
export async function deleteCloudLibraryEntry(userId: string, mangaId: string): Promise<void> {
  if (!userId || !mangaId) return;
  try {
    await supabase
      .from('user_library')
      .delete()
      .eq('user_id', userId)
      .eq('manga_id', mangaId);
  } catch (_e) {}
}
