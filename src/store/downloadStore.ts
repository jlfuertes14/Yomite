import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'paused' | 'error';

export interface DownloadedChapter {
  chapterId: string;
  mangaId: string;
  mangaTitle: string;
  chapterNum: string;
  chapterTitle: string;
  coverUrl?: string | null;
  localPages: string[];
  totalFiles: number;
  downloadedFiles: number;
  status: DownloadStatus;
  downloadedAt: string;
  sizeBytes: number;
  errorMessage?: string;
}

interface DownloadStore {
  chapters: Record<string, DownloadedChapter>;
  downloadDirectory: string | null;
  startDownload: (item: Omit<DownloadedChapter, 'downloadedFiles' | 'status' | 'downloadedAt' | 'sizeBytes' | 'localPages'>) => void;
  updateProgress: (chapterId: string, downloadedFiles: number, totalFiles: number, localPages: string[], addedBytes?: number) => void;
  setCompleted: (chapterId: string, localPages: string[], sizeBytes: number) => void;
  setFailed: (chapterId: string, errorMessage: string) => void;
  setPaused: (chapterId: string) => void;
  deleteDownload: (chapterId: string) => void;
  setCustomStorageDirectory: (path: string) => void;
  getChapter: (chapterId: string) => DownloadedChapter | undefined;
  isDownloaded: (chapterId: string) => boolean;
}

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      chapters: {},
      downloadDirectory: null,

      startDownload: (item) => {
        set((state) => ({
          chapters: {
            ...state.chapters,
            [item.chapterId]: {
              ...item,
              localPages: [],
              downloadedFiles: 0,
              status: 'downloading',
              downloadedAt: new Date().toISOString(),
              sizeBytes: 0,
            },
          },
        }));
      },

      updateProgress: (chapterId, downloadedFiles, totalFiles, localPages, addedBytes = 0) => {
        set((state) => {
          const existing = state.chapters[chapterId];
          if (!existing) return state;
          return {
            chapters: {
              ...state.chapters,
              [chapterId]: {
                ...existing,
                downloadedFiles,
                totalFiles,
                localPages,
                sizeBytes: existing.sizeBytes + addedBytes,
                status: 'downloading',
              },
            },
          };
        });
      },

      setCompleted: (chapterId, localPages, sizeBytes) => {
        set((state) => {
          const existing = state.chapters[chapterId];
          if (!existing) return state;
          return {
            chapters: {
              ...state.chapters,
              [chapterId]: {
                ...existing,
                localPages,
                downloadedFiles: existing.totalFiles || localPages.length,
                status: 'completed',
                sizeBytes,
              },
            },
          };
        });
      },

      setFailed: (chapterId, errorMessage) => {
        set((state) => {
          const existing = state.chapters[chapterId];
          if (!existing) return state;
          return {
            chapters: {
              ...state.chapters,
              [chapterId]: {
                ...existing,
                status: 'error',
                errorMessage,
              },
            },
          };
        });
      },

      setPaused: (chapterId) => {
        set((state) => {
          const existing = state.chapters[chapterId];
          if (!existing) return state;
          return {
            chapters: {
              ...state.chapters,
              [chapterId]: {
                ...existing,
                status: 'paused',
              },
            },
          };
        });
      },

      deleteDownload: (chapterId) => {
        set((state) => {
          const newChapters = { ...state.chapters };
          delete newChapters[chapterId];
          return { chapters: newChapters };
        });
      },

      setCustomStorageDirectory: (path) => {
        set({ downloadDirectory: path });
      },

      getChapter: (chapterId) => {
        return get().chapters[chapterId];
      },

      isDownloaded: (chapterId) => {
        const item = get().chapters[chapterId];
        return item?.status === 'completed';
      },
    }),
    {
      name: 'yomite-downloads-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
