/**
 * History Store — Zustand + AsyncStorage
 * Tracks reading history with timestamps, page progress, and read chapters
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HistoryEntry } from '../types';
import {
  areTitlesSameManga,
  isSameMangaHistoryEntry,
  deduplicateHistoryEntries,
} from '../utils/mangaTitleNormalizer';

const MAX_HISTORY = 200;

interface HistoryState {
  entries: HistoryEntry[];
  readChapterIds: Record<string, boolean>;
  addEntry: (entry: Omit<HistoryEntry, 'timestamp'> & { timestamp?: number }) => void;
  markChapterRead: (chapterId: string) => void;
  markChapterUnread: (chapterId: string) => void;
  isChapterRead: (chapterId: string) => boolean;
  removeEntry: (chapterId: string) => void;
  removeEntries: (chapterIds: string[]) => void;
  clearHistory: () => void;
  cleanDuplicates: () => void;
  getLatest: (count?: number) => HistoryEntry[];
  getMangaProgress: (mangaId: string, title?: string) => HistoryEntry | undefined;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      readChapterIds: {},

      addEntry: (entry) => {
        const timestamp = entry.timestamp || Date.now();
        const newEntry: HistoryEntry = { ...entry, timestamp };

        set((state) => {
          // Remove any existing entry for the same manga (by mangaId or normalized title across sources)
          const filtered = (state.entries || []).filter(
            (e) => !isSameMangaHistoryEntry(e, newEntry)
          );
          return {
            entries: [newEntry, ...filtered].slice(0, MAX_HISTORY),
            readChapterIds: {
              ...(state.readChapterIds || {}),
              [entry.chapterId]: true,
            },
          };
        });

        // Real-time background push to Supabase if user is logged in
        try {
          const { useUserStore } = require('./userStore');
          const { pushHistoryEntryToCloud } = require('../services/cloudSync');
          const userId = useUserStore.getState().user?.id;
          if (userId) {
            pushHistoryEntryToCloud(userId, newEntry);
          }
        } catch (_e) {}
      },

      cleanDuplicates: () => {
        set((state) => ({
          entries: deduplicateHistoryEntries(state.entries || []),
        }));
      },

      markChapterRead: (chapterId: string) =>
        set((state) => ({
          readChapterIds: {
            ...(state.readChapterIds || {}),
            [chapterId]: true,
          },
        })),

      markChapterUnread: (chapterId: string) =>
        set((state) => {
          const updated = { ...(state.readChapterIds || {}) };
          delete updated[chapterId];
          return { readChapterIds: updated };
        }),

      isChapterRead: (chapterId: string) => {
        const state = get();
        if (state.readChapterIds?.[chapterId]) return true;
        // Check if present in entries list
        return state.entries.some((e) => e.chapterId === chapterId);
      },

      removeEntry: (chapterId) =>
        set((state) => {
          const target = state.entries.find((e) => e.chapterId === chapterId);
          if (target) {
            try {
              const { useUserStore } = require('./userStore');
              const { deleteCloudHistoryEntry } = require('../services/cloudSync');
              const userId = useUserStore.getState().user?.id;
              if (userId) {
                deleteCloudHistoryEntry(userId, target.mangaId);
              }
            } catch (_e) {}
          }
          return {
            entries: state.entries.filter((e) => {
              if (e.chapterId === chapterId) return false;
              if (target && isSameMangaHistoryEntry(e, target)) return false;
              return true;
            }),
          };
        }),

      removeEntries: (chapterIds) =>
        set((state) => {
          const setIds = new Set(chapterIds);
          const targets = state.entries.filter((e) => setIds.has(e.chapterId));
          try {
            const { useUserStore } = require('./userStore');
            const { deleteCloudHistoryEntry } = require('../services/cloudSync');
            const userId = useUserStore.getState().user?.id;
            if (userId) {
              targets.forEach((e) => deleteCloudHistoryEntry(userId, e.mangaId));
            }
          } catch (_e) {}

          return {
            entries: state.entries.filter((e) => {
              if (setIds.has(e.chapterId)) return false;
              if (targets.some((t) => isSameMangaHistoryEntry(e, t))) return false;
              return true;
            }),
          };
        }),

      clearHistory: () => {
        try {
          const { useUserStore } = require('./userStore');
          const { clearCloudHistory } = require('../services/cloudSync');
          const userId = useUserStore.getState().user?.id;
          if (userId) {
            clearCloudHistory(userId);
          }
        } catch (_e) {}

        set({ entries: [], readChapterIds: {} });
      },

      getLatest: (count = 20) => get().entries.slice(0, count),

      getMangaProgress: (mangaId, title) => {
        const entries = get().entries;
        const direct = entries.find((e) => e.mangaId === mangaId);
        if (direct) return direct;
        if (title) {
          const byTitle = entries.find((e) => areTitlesSameManga(e.title, title));
          if (byTitle) return byTitle;
        }
        return undefined;
      },
    }),
    {
      name: 'manga-history',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.entries?.length) {
          state.entries = deduplicateHistoryEntries(state.entries);
        }
      },
    }
  )
);
