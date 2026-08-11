/**
 * Reader Store — Zustand + AsyncStorage
 * Manages reading mode, theme, fit, quality preferences, and current reading state
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReadingMode, ImageFit, ReaderTheme } from '../types';

interface ReaderState {
  // Preferences (persisted)
  mode: ReadingMode;
  theme: ReaderTheme;
  imageFit: ImageFit;
  dataSaver: boolean;
  showPageNumber: boolean;
  pageGap: number; // px gap between pages in webtoon mode
  hapticsEnabled: boolean;

  // Current session (not persisted separately, reset per session)
  currentChapterId: string | null;
  currentMangaId: string | null;
  pages: string[];
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  controlsVisible: boolean;

  // Actions
  setMode: (mode: ReadingMode) => void;
  setTheme: (theme: ReaderTheme) => void;
  setImageFit: (fit: ImageFit) => void;
  setDataSaver: (enabled: boolean) => void;
  setShowPageNumber: (show: boolean) => void;
  setPageGap: (gap: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;

  setChapter: (chapterId: string, mangaId: string, pages: string[]) => void;
  setCurrentPage: (page: number) => void;
  setLoading: (loading: boolean) => void;
  toggleControls: () => void;
  setControlsVisible: (visible: boolean) => void;
  resetSession: () => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      // Defaults
      mode: 'webtoon',
      theme: 'oled',
      imageFit: 'width',
      dataSaver: false,
      showPageNumber: true,
      pageGap: 0,
      hapticsEnabled: true,

      currentChapterId: null,
      currentMangaId: null,
      pages: [],
      currentPage: 0,
      totalPages: 0,
      isLoading: false,
      controlsVisible: false,

      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setImageFit: (fit) => set({ imageFit: fit }),
      setDataSaver: (enabled) => set({ dataSaver: enabled }),
      setShowPageNumber: (show) => set({ showPageNumber: show }),
      setPageGap: (gap) => set({ pageGap: gap }),
      setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),

      setChapter: (chapterId, mangaId, pages) =>
        set({
          currentChapterId: chapterId,
          currentMangaId: mangaId,
          pages,
          totalPages: pages.length,
          currentPage: 0,
          isLoading: false,
        }),

      setCurrentPage: (page) => set({ currentPage: page }),
      setLoading: (loading) => set({ isLoading: loading }),
      toggleControls: () => set((s) => ({ controlsVisible: !s.controlsVisible })),
      setControlsVisible: (visible) => set({ controlsVisible: visible }),

      resetSession: () =>
        set({
          currentChapterId: null,
          currentMangaId: null,
          pages: [],
          currentPage: 0,
          totalPages: 0,
          isLoading: false,
          controlsVisible: false,
        }),
    }),
    {
      name: 'manga-reader-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        mode: state.mode,
        theme: state.theme,
        imageFit: state.imageFit,
        dataSaver: state.dataSaver,
        showPageNumber: state.showPageNumber,
        pageGap: state.pageGap,
        hapticsEnabled: state.hapticsEnabled,
      }),
    }
  )
);
