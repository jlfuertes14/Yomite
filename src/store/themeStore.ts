import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppThemeMode = 'system' | 'dark' | 'light';

export interface AccentColorPreset {
  id: string;
  name: string;
  color: string;
}

export const ACCENT_PRESETS: AccentColorPreset[] = [
  { id: 'rose', name: 'Rose Crimson', color: '#F43F5E' },
  { id: 'violet', name: 'Neon Violet', color: '#8B5CF6' },
  { id: 'indigo', name: 'Cyber Indigo', color: '#6366F1' },
  { id: 'azure', name: 'Ocean Azure', color: '#0EA5E9' },
  { id: 'emerald', name: 'Emerald Mint', color: '#10B981' },
  { id: 'amber', name: 'Amber Gold', color: '#F59E0B' },
  { id: 'coral', name: 'Sunset Coral', color: '#FF6B6B' },
  { id: 'cyan', name: 'Electric Cyan', color: '#06B6D4' },
];

interface ThemeState {
  appThemeMode: AppThemeMode;
  accentColor: string;
  setAppThemeMode: (mode: AppThemeMode) => void;
  setAccentColor: (color: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      appThemeMode: 'dark',
      accentColor: '#F43F5E', // Default Rose Crimson
      setAppThemeMode: (appThemeMode) => set({ appThemeMode }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    {
      name: 'yomite-app-theme-pref',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
