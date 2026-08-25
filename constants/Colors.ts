/**
 * MangaApp Design System - Modern Minimalist Theme (shadcn / emil-design-eng)
 * Clean neutral zinc palette, subtle borders, precision typography, zero emojis, zero loud gradients.
 */

const brand = {
  accent: '#F43F5E', // Warm Rose/Red for status & key CTA highlights
  accentSubtle: 'rgba(244, 63, 94, 0.12)',
  neutralHigh: '#FAFAFA',
  neutralMid: '#71717A',
  neutralLow: '#27272A',
  emerald: '#10B981',
  emeraldSubtle: 'rgba(16, 185, 129, 0.12)',
};

export const Colors = {
  light: {
    text: '#09090B',
    textSecondary: '#52525B',
    textMuted: '#A1A1AA',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceElevated: '#F4F4F5',
    border: '#E4E4E7',
    borderSubtle: '#F4F4F5',
    tint: '#09090B',
    tintSecondary: brand.accent,
    icon: '#52525B',
    tabIconDefault: '#A1A1AA',
    tabIconSelected: '#09090B',
    cardBackground: '#FFFFFF',
    cardBorder: '#E4E4E7',
    skeleton: '#E4E4E7',
    ...brand,
  },
  dark: {
    text: '#FAFAFA',
    textSecondary: '#E4E4E7',
    textMuted: '#A1A1AA',
    background: '#09090B',     // Neutral Zinc-950
    surface: '#141417',        // Elevated Card Surface
    surfaceElevated: '#1F1F23', // Input & Pill Surface
    border: '#27272A',         // Subtle Border (Zinc-800)
    borderSubtle: '#18181B',
    tint: '#FAFAFA',
    tintSecondary: brand.accent,
    icon: '#A1A1AA',
    tabIconDefault: '#52525B',
    tabIconSelected: '#FAFAFA',
    cardBackground: '#141417',
    cardBorder: '#27272A',
    skeleton: '#1F1F23',
    ...brand,
  },
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
