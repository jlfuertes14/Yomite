/**
 * UI Store — Global transient UI states (e.g. Floating Tab Bar visibility during card scrolling)
 */
import { create } from 'zustand';

interface UIState {
  isTabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isTabBarVisible: true,
  setTabBarVisible: (visible: boolean) => set({ isTabBarVisible: visible }),
}));
