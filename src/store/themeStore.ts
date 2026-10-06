import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppThemeMode = 'system' | 'dark' | 'light';
export type AppColorScheme =
  | 'default'
  | 'dynamic'
  | 'miku'
  | 'asuka'
  | 'mion'
  | 'rikka'
  | 'sakura'
  | 'mamimi'
  | 'kanade';

export interface ThemeSchemePreset {
  id: AppColorScheme;
  name: string;
  color: string;
}

export const THEME_SCHEME_PRESETS: ThemeSchemePreset[] = [
  { id: 'default', name: 'Default', color: '#F59E0B' },
  { id: 'dynamic', name: 'Dynamic', color: '#0059C8' },
  { id: 'miku', name: 'Miku', color: '#6FDDE2' },
  { id: 'asuka', name: 'Asuka', color: '#FFB4A8' },
  { id: 'mion', name: 'Mion', color: '#A1D39A' },
  { id: 'rikka', name: 'Rikka', color: '#D3BBFD' },
  { id: 'sakura', name: 'Sakura', color: '#FFB1C8' },
  { id: 'mamimi', name: 'Mamimi', color: '#AFC6FF' },
  { id: 'kanade', name: 'Kanade', color: '#FFFFFF' },
];

interface ThemeState {
  appThemeMode: AppThemeMode;
  colorScheme: AppColorScheme;
  setAppThemeMode: (mode: AppThemeMode) => void;
  setColorScheme: (scheme: AppColorScheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      appThemeMode: 'dark',
      colorScheme: 'default',
      setAppThemeMode: (appThemeMode) => set({ appThemeMode }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
    }),
    {
      name: 'yomite-app-theme-pref',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: any) => {
        const { accentColor: _legacyAccentColor, ...stateWithoutAccent } = persistedState ?? {};
        return {
          ...stateWithoutAccent,
          colorScheme: stateWithoutAccent.colorScheme || 'default',
        };
      },
    }
  )
);
