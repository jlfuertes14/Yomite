/**
 * useThemeColor hook — returns color from design token based on scheme & dynamic accent color preference
 */
import { CharacterThemePalettes, CharacterThemeId, Colors, DynamicThemePalettes } from '../../constants/Colors';
import { useColorScheme } from './useColorScheme';
import { useThemeStore } from '../store/themeStore';

type ThemeColorKey = keyof typeof Colors.light & keyof typeof Colors.dark;

export function useThemeColor(
  colorKey: ThemeColorKey,
  props?: { light?: string; dark?: string }
): string {
  const scheme = useColorScheme();
  const themeScheme = useThemeStore((s) => s.colorScheme);
  const palette = themeScheme === 'dynamic'
    ? DynamicThemePalettes[scheme]
    : themeScheme !== 'default'
      ? CharacterThemePalettes[themeScheme as CharacterThemeId][scheme]
      : undefined;
  const resolvedAccent = palette?.accent || Colors[scheme].accent;
  const colorFromProps = props?.[scheme];
  if (colorFromProps) return colorFromProps;
  if (colorKey === 'accent' || colorKey === 'tintSecondary') return resolvedAccent;
  if (colorKey === 'accentSubtle') return palette?.accentSubtle || `${resolvedAccent}1F`;
  return palette?.[colorKey] || Colors[scheme][colorKey];
}

export function useThemeColors() {
  const scheme = useColorScheme();
  const themeScheme = useThemeStore((s) => s.colorScheme);
  const baseColors = Colors[scheme];
  const palette = themeScheme === 'dynamic'
    ? DynamicThemePalettes[scheme]
    : themeScheme !== 'default'
      ? CharacterThemePalettes[themeScheme as CharacterThemeId][scheme]
      : undefined;
  const resolvedAccent = palette?.accent || baseColors.accent;

  return {
    ...baseColors,
    ...palette,
    accent: resolvedAccent,
    tintSecondary: resolvedAccent,
    accentSubtle: palette?.accentSubtle || `${resolvedAccent}1F`,
  };
}
