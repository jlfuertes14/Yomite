/**
 * Library Store — Zustand + AsyncStorage
 * Manages bookmarks, categories, and read status
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LibraryEntry, LibraryCategory } from '../types';

interface LibraryState {
  entries: Record<string, LibraryEntry>;
  addToLibrary: (entry: Omit<LibraryEntry, 'addedAt' | 'updatedAt'>) => void;
  removeFromLibrary: (mangaId: string) => void;
  updateCategory: (mangaId: string, category: LibraryCategory) => void;
  updateReadProgress: (mangaId: string, chapterId: string, page: number) => void;
  updateUnreadCount: (mangaId: string, count: number) => void;
  isInLibrary: (mangaId: string) => boolean;
  getEntriesByCategory: (category: LibraryCategory) => LibraryEntry[];
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      entries: {},

      addToLibrary: (entry) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [entry.mangaId]: {
              ...entry,
              addedAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
        })),

      removeFromLibrary: (mangaId) =>
        set((state) => {
          const { [mangaId]: _, ...rest } = state.entries;
          return { entries: rest };
        }),

      updateCategory: (mangaId, category) =>
        set((state) => {
          const existing = state.entries[mangaId];
          if (!existing) return state;
          return {
            entries: {
              ...state.entries,
              [mangaId]: { ...existing, category, updatedAt: Date.now() },
            },
          };
        }),

      updateReadProgress: (mangaId, chapterId, page) =>
        set((state) => {
          const existing = state.entries[mangaId];
          if (!existing) return state;
          return {
            entries: {
              ...state.entries,
              [mangaId]: {
                ...existing,
                lastReadChapterId: chapterId,
                lastReadPage: page,
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
