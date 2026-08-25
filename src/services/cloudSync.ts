/**
 * Cloud Sync Service — Auto-merges and synchronizes local Reading History
 * and Library Bookmarks with Supabase Cloud.
 * Uses bidirectional timestamp-aware merging to ensure local reading progress
 * is never overwritten by outdated cloud records.
 * Includes Terminal console logging via ApiLogger for all Supabase operations.
 */
import { supabase } from '../lib/supabase';
import { useHistoryStore } from '../store/historyStore';
import { useLibraryStore } from '../store/libraryStore';
import { ApiLogger } from './apiLogger';
import type { HistoryEntry } from '../types';

function formatSupabaseError(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'object') {
    const parts = [
      err.message && `Message: ${err.message}`,
      err.details && `Details: ${err.details}`,
      err.hint && `Hint: ${err.hint}`,
      err.code && `Code: ${err.code}`,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' | ');
    return JSON.stringify(err);
  }
  return String(err);
}

/**
 * Synchronize local AsyncStorage history & library with Supabase cloud user account.
 * 1. Verifies/refreshes active auth token.
 * 2. Pulls existing cloud records from Supabase.
 * 3. Compares timestamps between local & cloud entries per manga.
 * 4. Keeps the latest progress (updates local if cloud is newer, updates cloud if local is newer).
 * 5. Merges missing records in both directions.
 * 6. Logs all actions and status to the developer terminal console via ApiLogger.
 */
let isSyncInProgress = false;

export async function syncUserDataWithCloud(userId: string): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    ApiLogger.logSupabase('SYNC', 'Aborted: User not authenticated', 0, 'No userId provided');
    return { success: false, message: 'User not authenticated' };
  }

  if (isSyncInProgress) {
    console.log('☁️ [Supabase Sync] Sync already in progress, skipping duplicate call.');
    return { success: true, message: 'Sync in progress' };
  }

  isSyncInProgress = true;
  const syncStart = Date.now();
  console.log(`\n☁️ [Supabase Sync] Starting cloud sync for User ID: ${userId}`);

  try {
    // 0. Ensure session token is fresh & clean bloated base64 avatar data from JWT
    try {
      let { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        sessionData = refreshed;
      }

      // Safety: detect oversized JWT (>4KB) caused by base64 data URLs in user_metadata
      const token = sessionData?.session?.access_token;
      if (token && token.length > 4000) {
        console.warn(`⚠️ [Supabase Sync] JWT is ${token.length} chars (exceeds header limit). Sanitizing user_metadata...`);
        try {
          const { data: userData } = await supabase.auth.getUser();
          const meta = userData?.user?.user_metadata ?? {};
          let cleanAvatar = meta.avatar_url || meta.picture || '';
          if (typeof cleanAvatar === 'string' && (cleanAvatar.startsWith('data:') || cleanAvatar.length > 500)) {
            cleanAvatar = '';
          }

          await supabase.auth.updateUser({
            data: {
              avatar_url: cleanAvatar,
              picture: cleanAvatar,
              full_name: meta.full_name || meta.name || '',
              display_name: meta.display_name || '',
              username: meta.username || '',
            },
          });

          const { data: refreshedSession } = await supabase.auth.refreshSession();
          const newToken = refreshedSession?.session?.access_token;
          console.log(`✅ [Supabase Sync] Sanitized user metadata. New token length: ${newToken?.length ?? 0}`);
        } catch (trimErr) {
          console.warn('⚠️ [Supabase Sync] Could not auto-trim metadata:', trimErr);
        }
      }
    } catch {
      // Ignore session check error and proceed
    }

    const historyStore = useHistoryStore.getState();
    const libraryStore = useLibraryStore.getState();

    // ─────────────────────────────────────────────────────────────
    // 1. READING HISTORY: BIDIRECTIONAL TIMESTAMP-AWARE MERGE
    // ─────────────────────────────────────────────────────────────
    const pullHistoryStart = Date.now();
    try {
      let { data: remoteHistory, error: pullErr, status } = await supabase
        .from('user_history')
        .select('*')
        .eq('user_id', userId);

      // Auto-retry once on Bad Request (stale schema cache or expired token)
      if (pullErr && (pullErr.message?.includes('JWT') || pullErr.message?.includes('Bad Request') || status === 400)) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) {
          const retryRes = await supabase
            .from('user_history')
            .select('*')
            .eq('user_id', userId);
          remoteHistory = retryRes.data;
          pullErr = retryRes.error;
        }
      }

      const pullDuration = Date.now() - pullHistoryStart;

      if (pullErr) {
        ApiLogger.logSupabase('PULL_HISTORY', 'Failed to fetch cloud history', pullDuration, formatSupabaseError(pullErr));
      } else {
        const localEntries = [...historyStore.entries];
        const localMap = new Map<string, HistoryEntry>();
        localEntries.forEach((e) => {
          if (e.mangaId) localMap.set(e.mangaId, e);
        });

        const mergedMap = new Map<string, HistoryEntry>();
        const rowsToPushToCloud: any[] = [];
        let updatedLocalCount = 0;

        // Process remote entries
        if (remoteHistory && Array.isArray(remoteHistory)) {
          remoteHistory.forEach((row) => {
            const remoteTimestamp = row.updated_at ? new Date(row.updated_at).getTime() : 0;
            const remoteEntry: HistoryEntry = {
              mangaId: row.manga_id,
              title: row.manga_title,
              coverUrl: row.cover_url,
              chapterId: row.chapter_id,
              chapterTitle: row.chapter_title,
              pageIndex: row.page_index || 0,
              totalPages: row.total_pages || 1,
              timestamp: remoteTimestamp || Date.now(),
            };

            const localEntry = localMap.get(row.manga_id);

            if (!localEntry) {
              // Not on local device -> restore from cloud
              mergedMap.set(row.manga_id, remoteEntry);
              updatedLocalCount++;
            } else {
              // Both exist: compare timestamps!
              if (localEntry.timestamp >= remoteTimestamp) {
                // Local is NEWER or equal -> keep local entry
                mergedMap.set(row.manga_id, localEntry);
                if (localEntry.timestamp > remoteTimestamp) {
                  // Local has newer progress -> queue push to cloud
                  rowsToPushToCloud.push({
                    user_id: userId,
                    manga_id: localEntry.mangaId,
                    manga_title: localEntry.title,
                    cover_url: localEntry.coverUrl,
                    chapter_id: localEntry.chapterId,
                    chapter_title: localEntry.chapterTitle,
                    page_index: localEntry.pageIndex,
                    total_pages: localEntry.totalPages,
                    updated_at: new Date(localEntry.timestamp).toISOString(),
                  });
                }
              } else {
                // Cloud is NEWER -> update local device with latest cloud progress
                mergedMap.set(row.manga_id, remoteEntry);
                updatedLocalCount++;
              }
            }
          });
        }

        // Add any local entries that do not exist in cloud at all
        localEntries.forEach((localEntry) => {
          if (!mergedMap.has(localEntry.mangaId)) {
            mergedMap.set(localEntry.mangaId, localEntry);
            rowsToPushToCloud.push({
              user_id: userId,
              manga_id: localEntry.mangaId,
              manga_title: localEntry.title,
              cover_url: localEntry.coverUrl,
              chapter_id: localEntry.chapterId,
              chapter_title: localEntry.chapterTitle,
              page_index: localEntry.pageIndex,
              total_pages: localEntry.totalPages,
              updated_at: new Date(localEntry.timestamp).toISOString(),
            });
          }
        });

        // Sort all merged entries by timestamp descending
        const finalMergedList = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
        useHistoryStore.setState({ entries: finalMergedList });

        ApiLogger.logSupabase(
          'PULL_HISTORY',
          `Merged history: ${finalMergedList.length} total entries (${updatedLocalCount} from cloud, ${rowsToPushToCloud.length} newer to push)`,
          pullDuration
        );

        // Push newer/missing local entries to cloud
        if (rowsToPushToCloud.length > 0) {
          const pushStart = Date.now();
          let { error: pushErr } = await supabase
            .from('user_history')
            .upsert(rowsToPushToCloud, { onConflict: 'user_id,manga_id' });

          if (pushErr) {
            const fallback = await supabase.from('user_history').upsert(rowsToPushToCloud);
            pushErr = fallback.error;
          }

          const pushDuration = Date.now() - pushStart;
          if (pushErr) {
            ApiLogger.logSupabase('PUSH_HISTORY', `Failed pushing ${rowsToPushToCloud.length} entries`, pushDuration, formatSupabaseError(pushErr));
          } else {
            ApiLogger.logSupabase('PUSH_HISTORY', `Pushed ${rowsToPushToCloud.length} newer local records to Supabase`, pushDuration);
          }
        }
      }
    } catch (pullEx: any) {
      ApiLogger.logSupabase('PULL_HISTORY', 'Exception during history merge', Date.now() - pullHistoryStart, pullEx?.message || String(pullEx));
    }

    // ─────────────────────────────────────────────────────────────
    // 2. LIBRARY BOOKMARKS: BIDIRECTIONAL SYNC
    // ─────────────────────────────────────────────────────────────
    const pullLibStart = Date.now();
    try {
      let { data: remoteLibrary, error: pullLibErr } = await supabase
        .from('user_library')
        .select('*')
        .eq('user_id', userId);

      // Auto-retry once if token was refreshed
      if (pullLibErr && (pullLibErr.message?.includes('JWT') || pullLibErr.message?.includes('Bad Request'))) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) {
          const retryRes = await supabase
            .from('user_library')
            .select('*')
            .eq('user_id', userId);
          remoteLibrary = retryRes.data;
          pullLibErr = retryRes.error;
        }
      }

      const pullLibDuration = Date.now() - pullLibStart;

      if (pullLibErr) {
        ApiLogger.logSupabase('PULL_LIBRARY', 'Failed to fetch cloud library', pullLibDuration, formatSupabaseError(pullLibErr));
      } else {
        const localLibraryItems = Object.values(libraryStore.entries);
        const localLibMap = new Map<string, any>();
        localLibraryItems.forEach((item) => localLibMap.set(item.mangaId, item));

        const rowsToPushToCloud: any[] = [];
        let addedToLocal = 0;

        if (remoteLibrary && Array.isArray(remoteLibrary)) {
          remoteLibrary.forEach((row) => {
            const existing = localLibMap.get(row.manga_id);
            if (!existing) {
              libraryStore.addToLibrary({
                mangaId: row.manga_id,
                title: row.title,
                coverUrl: row.cover_url,
                category: row.category,
                lastReadChapterId: null,
                lastReadPage: 0,
                totalChapters: row.total_chapters || 0,
                unreadCount: row.unread_count !== undefined && row.unread_count !== null ? row.unread_count : 0,
              });
              addedToLocal++;
            } else if (row.total_chapters || row.unread_count !== undefined) {
              libraryStore.updateChapterCounts(
                row.manga_id,
                row.total_chapters || existing.totalChapters || 0,
                row.unread_count !== null && row.unread_count !== undefined ? row.unread_count : existing.unreadCount
              );
            }
          });
        }

        // Check local bookmarks not yet in cloud
        localLibraryItems.forEach((item) => {
          const inRemote = remoteLibrary?.some((r) => r.manga_id === item.mangaId);
          if (!inRemote) {
            rowsToPushToCloud.push({
              user_id: userId,
              manga_id: item.mangaId,
              title: item.title,
              cover_url: item.coverUrl,
              category: item.category,
              total_chapters: item.totalChapters,
              unread_count: item.unreadCount,
              updated_at: item.addedAt ? new Date(item.addedAt).toISOString() : new Date().toISOString(),
            });
          }
        });

        ApiLogger.logSupabase(
          'PULL_LIBRARY',
          `Synced library (${addedToLocal} added from cloud, ${rowsToPushToCloud.length} to push)`,
          pullLibDuration
        );

        if (rowsToPushToCloud.length > 0) {
          const pushLibStart = Date.now();
          let { error: pushLibErr } = await supabase
            .from('user_library')
            .upsert(rowsToPushToCloud, { onConflict: 'user_id,manga_id' });

          if (pushLibErr) {
            const fallback = await supabase.from('user_library').upsert(rowsToPushToCloud);
            pushLibErr = fallback.error;
          }

          const pushDuration = Date.now() - pushLibStart;
          if (pushLibErr) {
            ApiLogger.logSupabase('PUSH_LIBRARY', `Failed to push ${rowsToPushToCloud.length} bookmarks`, pushDuration, formatSupabaseError(pushLibErr));
          } else {
            ApiLogger.logSupabase('PUSH_LIBRARY', `Pushed ${rowsToPushToCloud.length} local bookmarks to Supabase`, pushDuration);
          }
        }
      }
    } catch (pullLibEx: any) {
      ApiLogger.logSupabase('PULL_LIBRARY', 'Exception during library pull', Date.now() - pullLibStart, pullLibEx?.message || String(pullLibEx));
    }

    const totalDuration = Date.now() - syncStart;
    ApiLogger.logSupabase('SYNC_COMPLETE', `Finished full cloud sync for User ID: ${userId}`, totalDuration);
    return { success: true, message: 'Cloud sync completed successfully' };
  } catch (err: any) {
    const totalDuration = Date.now() - syncStart;
    ApiLogger.logSupabase('SYNC_ERROR', 'Cloud sync failed with fatal exception', totalDuration, err?.message || String(err));
    return { success: false, message: err?.message || 'Sync error' };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Real-time push for a single reading history entry to Supabase cloud.
 * Called whenever the user reads a manga page/chapter.
 */
let pushTimeoutMap = new Map<string, any>();

export function pushHistoryEntryToCloud(userId: string, entry: HistoryEntry): void {
  if (!userId || !entry.mangaId) return;

  // Debounce per manga by 1 second to avoid excessive database writes while rapidly swiping pages
  if (pushTimeoutMap.has(entry.mangaId)) {
    clearTimeout(pushTimeoutMap.get(entry.mangaId));
  }

  const timeout = setTimeout(async () => {
    pushTimeoutMap.delete(entry.mangaId);
    const start = Date.now();
    const historyRow = {
      user_id: userId,
      manga_id: entry.mangaId,
      manga_title: entry.title,
      cover_url: entry.coverUrl,
      chapter_id: entry.chapterId,
      chapter_title: entry.chapterTitle,
      page_index: entry.pageIndex,
      total_pages: entry.totalPages,
      updated_at: new Date(entry.timestamp).toISOString(),
    };

    try {
      let { error } = await supabase
        .from('user_history')
        .upsert([historyRow], { onConflict: 'user_id,manga_id' });

      if (error) {
        const fallback = await supabase.from('user_history').upsert([historyRow]);
        error = fallback.error;
      }

      const duration = Date.now() - start;
      if (error) {
        ApiLogger.logSupabase(
          'PUSH_READING_PROGRESS',
          `Failed for "${entry.title}"`,
          duration,
          error.message
        );
      } else {
        ApiLogger.logSupabase(
          'PUSH_READING_PROGRESS',
          `Saved progress for "${entry.title}" (Page ${entry.pageIndex + 1}/${entry.totalPages})`,
          duration
        );
      }
    } catch (e: any) {
      ApiLogger.logSupabase(
        'PUSH_READING_PROGRESS',
        `Exception for "${entry.title}"`,
        Date.now() - start,
        e?.message || String(e)
      );
    }
  }, 1000);

  pushTimeoutMap.set(entry.mangaId, timeout);
}

/**
 * Remove single history item from Supabase cloud table for an authenticated user
 */
export async function deleteCloudHistoryEntry(userId: string, mangaId: string): Promise<void> {
  if (!userId || !mangaId) return;
  const start = Date.now();
  try {
    const { error } = await supabase
      .from('user_history')
      .delete()
      .eq('user_id', userId)
      .eq('manga_id', mangaId);
    const duration = Date.now() - start;
    if (error) {
      ApiLogger.logSupabase('DELETE_HISTORY_ITEM', `Failed for manga ${mangaId}`, duration, error.message);
    } else {
      ApiLogger.logSupabase('DELETE_HISTORY_ITEM', `Removed manga ${mangaId} from cloud`, duration);
    }
  } catch (e: any) {
    ApiLogger.logSupabase('DELETE_HISTORY_ITEM', `Exception for manga ${mangaId}`, Date.now() - start, e?.message || String(e));
  }
}

/**
 * Clear all cloud history for an authenticated user
 */
export async function clearCloudHistory(userId: string): Promise<void> {
  if (!userId) return;
  const start = Date.now();
  try {
    const { error } = await supabase
      .from('user_history')
      .delete()
      .eq('user_id', userId);
    const duration = Date.now() - start;
    if (error) {
      ApiLogger.logSupabase('CLEAR_CLOUD_HISTORY', 'Failed to clear cloud history', duration, error.message);
    } else {
      ApiLogger.logSupabase('CLEAR_CLOUD_HISTORY', 'Cleared all cloud history records', duration);
    }
  } catch (e: any) {
    ApiLogger.logSupabase('CLEAR_CLOUD_HISTORY', 'Exception during clear', Date.now() - start, e?.message || String(e));
  }
}

/**
 * Remove library entry from Supabase cloud table
 */
export async function deleteCloudLibraryEntry(userId: string, mangaId: string): Promise<void> {
  if (!userId || !mangaId) return;
  const start = Date.now();
  try {
    const { error } = await supabase
      .from('user_library')
      .delete()
      .eq('user_id', userId)
      .eq('manga_id', mangaId);
    const duration = Date.now() - start;
    if (error) {
      ApiLogger.logSupabase('DELETE_LIBRARY_ITEM', `Failed for manga ${mangaId}`, duration, error.message);
    } else {
      ApiLogger.logSupabase('DELETE_LIBRARY_ITEM', `Removed library bookmark for ${mangaId}`, duration);
    }
  } catch (e: any) {
    ApiLogger.logSupabase('DELETE_LIBRARY_ITEM', `Exception for manga ${mangaId}`, Date.now() - start, e?.message || String(e));
  }
}
