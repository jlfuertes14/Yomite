/**
 * useColorScheme hook — returns 'dark' or 'light'
 * Dynamically resolves based on System preference or App Theme setting (System, Dark, Light)
 */
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useThemeStore } from '../store/themeStore';

export function useColorScheme(): 'light' | 'dark' {
  const systemScheme = useRNColorScheme();
  const appThemeMode = useThemeStore((s) => s.appThemeMode);

  if (appThemeMode === 'system') {
    return systemScheme === 'light' ? 'light' : 'dark';
  }
  return appThemeMode;
}
