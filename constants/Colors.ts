/**
 * MangaApp Design System - Modern Minimalist Theme (shadcn / emil-design-eng)
 * Clean neutral zinc palette, subtle borders, precision typography, zero emojis, zero loud gradients.
 */

const brand = {
  accent: '#F59E0B',
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
    text: '#C7C6CA',
    textSecondary: '#C4C6D0',
    textMuted: '#8E9099',
    background: '#1A1B1F',
    surface: '#121316',
    surfaceElevated: '#1F1F23',
    border: '#44474E',
    borderSubtle: '#292A2D',
    tint: '#C7C6CA',
    tintSecondary: '#F59E0B',
    icon: '#C4C6D0',
    tabIconDefault: '#C4C6D0',
    tabIconSelected: '#002F65',
    cardBackground: '#1F1F23',
    cardBorder: '#44474E',
    skeleton: '#292A2D',
    ...brand,
    accent: '#F59E0B',
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
): ThemePalette {
  return {
    accent,
    accentSubtle: `${accent}29`,
    background,
    surface,
    surfaceElevated,
    text,
    textSecondary,
    textMuted: border,
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
    light: characterPalette('#00696D', '#F5FAFA', '#F5FAFA', '#EAEFEE', '#171D1D', '#3D4949', '#6D797A'),
    dark: characterPalette('#6FDDE2', '#0F1415', '#0F1415', '#1B2121', '#DEE3E3', '#BCC9C9', '#3D4949'),
  },
  asuka: {
    light: characterPalette('#904A40', '#FFF8F6', '#FFF8F6', '#F9EDEA', '#271815', '#53433F', '#89736E'),
    dark: characterPalette('#FFB4A8', '#1A1110', '#1A1110', '#271D1C', '#F1DEDC', '#D8C2BE', '#534341'),
  },
  mion: {
    light: characterPalette('#3B693A', '#F8FBF1', '#F8FBF1', '#EBF0E5', '#191D17', '#424940', '#72796E'),
    dark: characterPalette('#A1D39A', '#10140F', '#10140F', '#1D211B', '#E0E4DB', '#C2C9BD', '#424940'),
  },
  rikka: {
    light: characterPalette('#68548D', '#FEF7FF', '#FEF7FF', '#F2ECF3', '#1D1B20', '#49454E', '#7D7981'),
    dark: characterPalette('#D3BBFD', '#151218', '#151218', '#211F24', '#E7E0E8', '#CBC4CF', '#49454E'),
  },
  sakura: {
    light: characterPalette('#8C4A60', '#FFF8F8', '#FFF8F8', '#F9ECEE', '#21191B', '#514347', '#857377'),
    dark: characterPalette('#FFB1C8', '#191113', '#191113', '#261D20', '#EFDFE1', '#D5C2C6', '#514347'),
  },
  mamimi: {
    light: characterPalette('#465D91', '#FAF8FF', '#FAF8FF', '#EEEDF4', '#1A1B20', '#44464F', '#747780'),
    dark: characterPalette('#AFC6FF', '#121318', '#121318', '#1E1F25', '#E2E2E9', '#C5C6D0', '#44464F'),
  },
  kanade: {
    light: characterPalette('#474755', '#FCF8FA', '#FCF8FA', '#F0EDEF', '#1C1B1C', '#47464C', '#77747B'),
    dark: characterPalette('#FFFFFF', '#141314', '#141314', '#282829', '#FFFFFF', '#DEDBE2', '#47464C'),
  },
};

/** Kotatsu-style dynamic blue palette used by the Dynamic scheme. */
export const DynamicThemePalettes: { light: ThemePalette; dark: ThemePalette } = {
  light: characterPalette('#0059C8', '#F8F9FF', '#F8F9FF', '#E9EEFA', '#191B22', '#44474F', '#747780'),
  dark: characterPalette('#ABC7FF', '#10141C', '#10141C', '#1D2432', '#E0E2EC', '#C2C6D4', '#444955'),
};

export const ReaderThemes = {
  oled: { background: '#000000', text: '#E4E4E7', name: 'OLED Black' },
  midnight: { background: '#09090B', text: '#FAFAFA', name: 'Minimal Dark' },
  dark: { background: '#141417', text: '#E4E4E7', name: 'Slate' },
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
    caption: 11,
    footnote: 12,
    body: 14,
    callout: 15,
    headline: 16,
    title3: 18,
    title2: 22,
    title1: 26,
    largeTitle: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export default Colors;
