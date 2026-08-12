/**
 * useThemeColor hook — returns color from design token based on scheme & dynamic accent color preference
 */
import { Colors } from '../../constants/Colors';
import { useColorScheme } from './useColorScheme';
import { useThemeStore } from '../store/themeStore';

type ThemeColorKey = keyof typeof Colors.light & keyof typeof Colors.dark;

export function useThemeColor(
  colorKey: ThemeColorKey,
  props?: { light?: string; dark?: string }
): string {
  const scheme = useColorScheme();
  const accentColor = useThemeStore((s) => s.accentColor) || '#F43F5E';
  const colorFromProps = props?.[scheme];
  if (colorFromProps) return colorFromProps;
  if (colorKey === 'accent' || colorKey === 'tintSecondary') return accentColor;
  if (colorKey === 'accentSubtle') return `${accentColor}1F`;
  return Colors[scheme][colorKey];
}

export function useThemeColors() {
  const scheme = useColorScheme();
  const accentColor = useThemeStore((s) => s.accentColor) || '#F43F5E';
  const baseColors = Colors[scheme];

  return {
    ...baseColors,
    accent: accentColor,
    tintSecondary: accentColor,
    accentSubtle: `${accentColor}1F`,
  };
}
