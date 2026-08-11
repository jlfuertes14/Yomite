/**
 * useThemeColor hook — returns color from design token based on scheme
 */
import { Colors } from '../../constants/Colors';
import { useColorScheme } from './useColorScheme';

type ThemeColorKey = keyof typeof Colors.light & keyof typeof Colors.dark;

export function useThemeColor(
  colorKey: ThemeColorKey,
  props?: { light?: string; dark?: string }
): string {
  const scheme = useColorScheme();
  const colorFromProps = props?.[scheme];
  if (colorFromProps) return colorFromProps;
  return Colors[scheme][colorKey];
}

export function useThemeColors() {
  const scheme = useColorScheme();
  return Colors[scheme];
}
