/**
 * History Store — Zustand + AsyncStorage
 * Tracks reading history with timestamps and page progress
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HistoryEntry } from '../types';

const MAX_HISTORY = 200;

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (entry: Omit<HistoryEntry, 'timestamp'>) => void;
  removeEntry: (chapterId: string) => void;
  removeEntries: (chapterIds: string[]) => void;
  clearHistory: () => void;
  getLatest: (count?: number) => HistoryEntry[];
  getMangaProgress: (mangaId: string) => HistoryEntry | undefined;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) =>
        set((state) => {
          // Remove existing entry for the same manga to prevent duplicate history rows
          const filtered = state.entries.filter(
            (e) => (entry.mangaId ? e.mangaId !== entry.mangaId : e.chapterId !== entry.chapterId)
          );
          const newEntry: HistoryEntry = { ...entry, timestamp: Date.now() };
          // Prepend new entry, cap at MAX_HISTORY
          return { entries: [newEntry, ...filtered].slice(0, MAX_HISTORY) };
        }),

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
            entries: state.entries.filter((e) => e.chapterId !== chapterId),
          };
        }),

      removeEntries: (chapterIds) =>
        set((state) => {
          const setIds = new Set(chapterIds);
          try {
            const { useUserStore } = require('./userStore');
            const { deleteCloudHistoryEntry } = require('../services/cloudSync');
            const userId = useUserStore.getState().user?.id;
            if (userId) {
              state.entries
                .filter((e) => setIds.has(e.chapterId))
                .forEach((e) => deleteCloudHistoryEntry(userId, e.mangaId));
            }
          } catch (_e) {}

          return {
            entries: state.entries.filter((e) => !setIds.has(e.chapterId)),
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

        set({ entries: [] });
      },

      getLatest: (count = 20) => get().entries.slice(0, count),

      getMangaProgress: (mangaId) =>
        get().entries.find((e) => e.mangaId === mangaId),
    }),
    {
      name: 'manga-history',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
