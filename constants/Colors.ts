/**
 * MangaApp Design System - Modern Minimalist Theme (shadcn / emil-design-eng)
 * Clean neutral zinc palette, subtle borders, precision typography, zero emojis, zero loud gradients.
 */

export function getContrastTextColor(hexColor: string): string {
  if (!hexColor) return '#FFFFFF';
  const clean = hexColor.replace('#', '');
  const fullHex =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.slice(0, 6);
  const r = parseInt(fullHex.slice(0, 2), 16) || 0;
  const g = parseInt(fullHex.slice(2, 4), 16) || 0;
  const b = parseInt(fullHex.slice(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#09090B' : '#FFFFFF';
}

const brand = {
  accent: '#F59E0B',
  accentForeground: '#09090B',
  accentSubtle: 'rgba(245, 158, 11, 0.12)',
  neutralHigh: '#FAFAFA',
  neutralMid: '#71717A',
  neutralLow: '#27272A',
  emerald: '#10B981',
  emeraldSubtle: 'rgba(16, 185, 129, 0.12)',
};

export const Colors = {
  light: {
    text: '#1B1B1F',
    textSecondary: '#44464F',
    textMuted: '#757780',
    background: '#FEFBFF',
    surface: '#FBF8FD',
    surfaceElevated: '#EFEDF1',
    border: '#E1E2EC',
    borderSubtle: '#F5F3F7',
    tint: '#1B1B1F',
    tintSecondary: '#F59E0B',
    icon: '#44464F',
    tabIconDefault: '#44464F',
    tabIconSelected: '#001944',
    cardBackground: '#FFFFFF',
    cardBorder: '#E1E2EC',
    skeleton: '#E9E7EC',
    ...brand,
  },
  dark: {
    text: '#F4F4F5',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    background: '#000000',
    surface: '#09090B',
    surfaceElevated: '#121215',
    border: '#27272A',
    borderSubtle: '#18181B',
    tint: '#FAFAFA',
    tintSecondary: '#F59E0B',
    icon: '#A1A1AA',
    tabIconDefault: '#A1A1AA',
    tabIconSelected: '#FAFAFA',
    cardBackground: '#09090B',
    cardBorder: '#27272A',
    skeleton: '#18181B',
    ...brand,
    accent: '#F59E0B',
    accentForeground: '#09090B',
    accentSubtle: 'rgba(245, 158, 11, 0.16)',
  },
};

type ThemePalette = Pick<
  (typeof Colors)['light'],
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'background'
  | 'surface'
  | 'surfaceElevated'
  | 'border'
  | 'borderSubtle'
  | 'tint'
  | 'tintSecondary'
  | 'icon'
  | 'tabIconDefault'
  | 'tabIconSelected'
  | 'cardBackground'
  | 'cardBorder'
  | 'skeleton'
  | 'accent'
  | 'accentForeground'
  | 'accentSubtle'
>;

export type CharacterThemeId = 'miku' | 'asuka' | 'mion' | 'rikka' | 'sakura' | 'mamimi' | 'kanade';

function characterPalette(
  accent: string,
  background: string,
  surface: string,
  surfaceElevated: string,
  text: string,
  textSecondary: string,
  border: string,
  textMuted: string,
): ThemePalette {
  return {
    accent,
    accentForeground: getContrastTextColor(accent),
    accentSubtle: `${accent}29`,
    background,
    surface,
    surfaceElevated,
    text,
    textSecondary,
    textMuted,
    border,
    borderSubtle: surfaceElevated,
    tint: text,
    tintSecondary: accent,
    icon: textSecondary,
    tabIconDefault: textSecondary,
    tabIconSelected: accent,
    cardBackground: surfaceElevated,
    cardBorder: border,
    skeleton: surfaceElevated,
  };
}

/** Kotatsu's character palettes, distilled from its Material 3 resource themes. */
export const CharacterThemePalettes: Record<CharacterThemeId, { light: ThemePalette; dark: ThemePalette }> = {
  miku: {
    light: characterPalette('#00696D', '#F5FAFA', '#F5FAFA', '#EAEFEE', '#171D1D', '#3D4949', '#6D797A', '#536061'),
    dark: characterPalette('#6FDDE2', '#000000', '#09090B', '#121215', '#DEE3E3', '#BCC9C9', '#3D4949', '#869899'),
  },
  asuka: {
    light: characterPalette('#904A40', '#FFF8F6', '#FFF8F6', '#F9EDEA', '#271815', '#53433F', '#89736E', '#6E5A55'),
    dark: characterPalette('#FFB4A8', '#000000', '#09090B', '#121215', '#F1DEDC', '#D8C2BE', '#534341', '#A38E8A'),
  },
  mion: {
    light: characterPalette('#3B693A', '#F8FBF1', '#F8FBF1', '#EBF0E5', '#191D17', '#424940', '#72796E', '#586054'),
    dark: characterPalette('#A1D39A', '#000000', '#09090B', '#121215', '#E0E4DB', '#C2C9BD', '#424940', '#8D9788'),
  },
  rikka: {
    light: characterPalette('#68548D', '#FEF7FF', '#FEF7FF', '#F2ECF3', '#1D1B20', '#49454E', '#7D7981', '#625D66'),
    dark: characterPalette('#D3BBFD', '#000000', '#09090B', '#121215', '#E7E0E8', '#CBC4CF', '#49454E', '#98909E'),
  },
  sakura: {
    light: characterPalette('#8C4A60', '#FFF8F8', '#FFF8F8', '#F9ECEE', '#21191B', '#514347', '#857377', '#6A585C'),
    dark: characterPalette('#FFB1C8', '#000000', '#09090B', '#121215', '#EFDFE1', '#D5C2C6', '#514347', '#A08D92'),
  },
  mamimi: {
    light: characterPalette('#465D91', '#FAF8FF', '#FAF8FF', '#EEEDF4', '#1A1B20', '#44464F', '#747780', '#5A5D67'),
    dark: characterPalette('#AFC6FF', '#000000', '#09090B', '#121215', '#E2E2E9', '#C5C6D0', '#44464F', '#8F92A0'),
  },
  kanade: {
    light: characterPalette('#474755', '#FCF8FA', '#FCF8FA', '#F0EDEF', '#1C1B1C', '#47464C', '#77747B', '#5E5B63'),
    dark: characterPalette('#FFFFFF', '#000000', '#09090B', '#121215', '#FFFFFF', '#DEDBE2', '#47464C', '#9C99A2'),
  },
};

/** Kotatsu-style dynamic blue palette used by the Dynamic scheme. */
export const DynamicThemePalettes: { light: ThemePalette; dark: ThemePalette } = {
  light: characterPalette('#0059C8', '#F8F9FF', '#F8F9FF', '#E9EEFA', '#191B22', '#44474F', '#747780', '#5A5E69'),
  dark: characterPalette('#ABC7FF', '#000000', '#09090B', '#121215', '#E0E2EC', '#C2C6D4', '#444955', '#8E94A4'),
};

export const ReaderThemes = {
  oled: { background: '#000000', text: '#E4E4E7', name: 'OLED Black' },
  midnight: { background: '#09090B', text: '#FAFAFA', name: 'Minimal Dark' },
  dark: { background: '#000000', text: '#E4E4E7', name: 'Pure Black' },
  sepia: { background: '#F5EBE0', text: '#3E2723', name: 'Warm Sepia' },
  white: { background: '#FFFFFF', text: '#09090B', name: 'Paper White' },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const Radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const Typography = {
  sizes: {
    caption: 13,
    footnote: 14,
    body: 17,
    callout: 17,
    headline: 18,
    title3: 21,
    title2: 25,
    title1: 30,
    largeTitle: 36,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export default Colors;
