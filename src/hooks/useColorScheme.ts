/**
 * useColorScheme hook — returns 'dark' or 'light'
 * Defaults to dark for manga reader experience
 */
import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' {
  return 'dark';
}
