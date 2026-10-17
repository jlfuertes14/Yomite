/**
 * Library Store — Zustand + AsyncStorage
 * Manages bookmarks, categories, total available chapters, and read/unread status
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LibraryEntry, LibraryCategory } from '../types';
import { parseChapterNumber, calculateUnreadCount } from '../utils/chapter';

export type LibraryDisplayMode = 'grid' | 'details' | 'compact';

interface LibraryState {
  entries: Record<string, LibraryEntry>;
  displayMode: LibraryDisplayMode;
  gridColumns: number;
  setDisplayMode: (mode: LibraryDisplayMode) => void;
  setGridColumns: (cols: number) => void;
  addToLibrary: (entry: Omit<LibraryEntry, 'addedAt' | 'updatedAt'>) => void;
  removeFromLibrary: (mangaId: string) => void;
  updateCategory: (mangaId: string, category: LibraryCategory) => void;
  updateReadProgress: (mangaId: string, chapterId: string, page: number, unreadCount?: number) => void;
  updateUnreadCount: (mangaId: string, count: number) => void;
  updateChapterCounts: (mangaId: string, totalChapters: number, unreadCount: number) => void;
  updateEntryDescription: (mangaId: string, description: string) => void;
  isInLibrary: (mangaId: string) => boolean;
  getEntriesByCategory: (category: LibraryCategory) => LibraryEntry[];
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      entries: {},
      displayMode: 'grid',
      gridColumns: 2,
      setDisplayMode: (displayMode) => set({ displayMode }),
      setGridColumns: (gridColumns) => set({ gridColumns }),

      addToLibrary: (entry) =>
        set((state) => {
          const isCompleted = entry.category === 'completed';
          let unread = entry.unreadCount;
          if (isCompleted) {
            unread = 0;
          } else if (unread === undefined && entry.totalChapters > 0) {
            unread = calculateUnreadCount(
              entry.totalChapters,
              parseChapterNumber(entry.lastReadChapterId),
              false
            );
          }
          return {
            entries: {
              ...state.entries,
              [entry.mangaId]: {
                ...entry,
                unreadCount: unread ?? 0,
                addedAt: Date.now(),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      removeFromLibrary: (mangaId) =>
        set((state) => {
          const { [mangaId]: _, ...rest } = state.entries;
          return { entries: rest };
        }),

      updateCategory: (mangaId, category) =>
        set((state) => {
          const existing = state.entries[mangaId];
          if (!existing) return state;
          const isCompleted = category === 'completed';
          return {
            entries: {
              ...state.entries,
              [mangaId]: {
                ...existing,
                category,
                unreadCount: isCompleted ? 0 : existing.unreadCount,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateReadProgress: (mangaId, chapterId, page, unreadCount) =>
        set((state) => {
          const existing = state.entries[mangaId];
          if (!existing) return state;
          const isCompleted = existing.category === 'completed';

          let computedUnread = unreadCount;
          if (isCompleted) {
            computedUnread = 0;
          } else if (computedUnread === undefined && existing.totalChapters > 0) {
            const chNum = parseChapterNumber(chapterId);
            if (chNum !== null && chNum > 0) {
              computedUnread = calculateUnreadCount(existing.totalChapters, chNum, false);
            }
          }

          return {
            entries: {
              ...state.entries,
              [mangaId]: {
                ...existing,
                lastReadChapterId: chapterId,
                lastReadPage: page,
                unreadCount: computedUnread !== undefined ? computedUnread : existing.unreadCount,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateUnreadCount: (mangaId, count) =>
        set((state) => {
          const existing = state.entries[mangaId];
          if (!existing) return state;
          return {
            entries: {
              ...state.entries,
              [mangaId]: { ...existing, unreadCount: count, updatedAt: Date.now() },
            },
          };
        }),

      updateChapterCounts: (mangaId, totalChapters, unreadCount) =>
        set((state) => {
          const existing = state.entries[mangaId];
          if (!existing) return state;
          const isCompleted = existing.category === 'completed';
          return {
            entries: {
              ...state.entries,
              [mangaId]: {
                ...existing,
                totalChapters,
                unreadCount: isCompleted ? 0 : unreadCount,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateEntryDescription: (mangaId, description) =>
        set((state) => {
          const existing = state.entries[mangaId];
          if (!existing) return state;
          return {
            entries: {
              ...state.entries,
              [mangaId]: {
                ...existing,
                description,
              },
            },
          };
        }),

      isInLibrary: (mangaId) => !!get().entries[mangaId],

      getEntriesByCategory: (category) =>
        Object.values(get().entries).filter((e) => e.category === category),
    }),
    {
      name: 'manga-library',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
