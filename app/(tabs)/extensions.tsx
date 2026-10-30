import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Easing,
  FlatList,
  LayoutAnimation,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Radius, Spacing, Typography } from '../../constants/Colors';
import {
  extractCoverFileName,
  getBatchMangaStatistics,
  getCoverUrl,
  getMangaTitle,
  getPopularManga,
  searchManga,
} from '../../src/api/mangadex';
import { AdvancedSearchModal } from '../../src/components/AdvancedSearchModal';
import { BridgedImage } from '../../src/components/BridgedImage';
import { GridColumnsIcon } from '../../src/components/GridColumnsIcon';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { Skeleton } from '../../src/components/Skeleton';
import { useColorScheme } from '../../src/hooks/useColorScheme';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { CloudFlareCookieManager } from '../../src/sources/network/cloudflare';
import { DEFAULT_USER_AGENT } from '../../src/sources/network/httpClient';
import { webViewBridge } from '../../src/sources/network/webViewBridge';
import { computeTitleMatchScore } from '../../src/sources/parsers/MangaDotParser';
import { DEFAULT_INSTALLED_SOURCE_IDS, SourceManager } from '../../src/sources/SourceManager';
import { CatalogSourceItem, SourceSortOption, SourceTag } from '../../src/sources/types';
import { useCatalogStore } from '../../src/store/catalogStore';
import type { Manga, SearchFilters } from '../../src/types';
import { triggerHaptic } from '../../src/utils/haptics';
import { detectMangaLanguage, getLanguageInfo } from '../../src/utils/language';
import { normalizeRatingToTen } from '../../src/utils/rating';

const STORAGE_KEY_INSTALLED_SOURCES = '@mangaapp_installed_sources_v3';

// Sources shown in the 4-column grid on first install (shared with SourceManager
// so cross-extension search and the grid always agree).
const DEFAULT_INSTALLED_IDS = DEFAULT_INSTALLED_SOURCE_IDS;

interface CuratedSourceMeta {
  id: string;
  name: string;
  displayName: string;
  domain: string;
  icon?: string;
  iconType:
  | 'batoto'
  | 'comick'
  | 'linewebtoon'
  | 'mangadex'
  | 'mangafire'
  | 'mangapill'
  | 'mangaplus'
  | 'mangareader'
  | 'myreadingmanga'
  | 'ninemanga'
  | 'webtoons'
  | 'asuracomic'
  | 'custom';
  letter?: string;
  letterColor?: string;
  bgColor?: string;
}

const CURATED_SOURCES: Record<string, CuratedSourceMeta> = {
  batoto: {
    id: 'batoto',
    name: 'Bato.To',
    displayName: 'Bato.To',
    domain: 'bato.to',
    icon: 'https://www.google.com/s2/favicons?domain=bato.to&sz=64',
    iconType: 'batoto',
    letter: 'B',
    letterColor: '#B45309',
    bgColor: '#FFFFFF',
  },
  'comick-fun': {
    id: 'comick-fun',
    name: 'ComicK',
    displayName: 'ComicK',
    domain: 'comick.dev',
    icon: 'https://www.google.com/s2/favicons?domain=comick.dev&sz=64',
    iconType: 'comick',
    letterColor: '#FFFFFF',
    bgColor: '#3B82F6',
  },
  linewebtoon: {
    id: 'linewebtoon',
    name: 'LineWebtoon',
    displayName: 'LineWeb...',
    domain: 'webtoons.com',
    icon: 'https://www.google.com/s2/favicons?domain=webtoons.com&sz=64',
    iconType: 'linewebtoon',
    letterColor: '#FFFFFF',
    bgColor: '#00D564',
  },
  mangadex: {
    id: 'mangadex',
    name: 'MangaDex',
    displayName: 'MangaDex',
    domain: 'mangadex.org',
    icon: 'https://www.google.com/s2/favicons?domain=mangadex.org&sz=64',
    iconType: 'mangadex',
    letterColor: '#FF6740',
    bgColor: '#1E202A',
  },
  manganato: {
    id: 'manganato',
    name: 'Manganato',
    displayName: 'Manganato',
    domain: 'manganato.gg',
    icon: 'https://www.google.com/s2/favicons?domain=www.manganato.gg&sz=64',
    iconType: 'custom',
    letter: 'M',
    letterColor: '#F97316',
    bgColor: '#1E202A',
  },
  mangadot: {
    id: 'mangadot',
    name: 'MangaDot',
    displayName: 'MangaDot',
    domain: 'mangadot.net',
    icon: 'https://icon.horse/icon/mangadot.net',
    iconType: 'custom',
    letter: 'M',
    letterColor: '#8B5CF6',
    bgColor: '#1E202A',
  },
  flamecomics: {
    id: 'flamecomics',
    name: 'FlameComics',
    displayName: 'FlameComics',
    domain: 'flamecomics.xyz',
    icon: 'https://icon.horse/icon/flamecomics.xyz',
    iconType: 'custom',
    letter: 'F',
    letterColor: '#F59E0B',
    bgColor: '#1E202A',
  },
  mangafire: {
    id: 'mangafire',
    name: 'MangaFire',
    displayName: 'MangaFire',
    domain: 'mangafire.to',
    icon: 'https://www.google.com/s2/favicons?domain=mangafire.to&sz=64',
    iconType: 'mangafire',
    letter: 'M',
    letterColor: '#38BDF8',
    bgColor: '#0F172A',
  },
  mangapill: {
    id: 'mangapill',
    name: 'MangaPill',
    displayName: 'MangaPill',
    domain: 'mangapill.com',
    icon: 'https://www.google.com/s2/favicons?domain=mangapill.com&sz=64',
    iconType: 'mangapill',
    letter: 'M',
    letterColor: '#06B6D4',
    bgColor: '#FFFFFF',
  },
  mangaplus: {
    id: 'mangaplus',
    name: 'MANGA Plus',
    displayName: 'MANGA...',
    domain: 'mangaplus.shueisha.co.jp',
    icon: 'https://www.google.com/s2/favicons?domain=mangaplus.shueisha.co.jp&sz=64',
    iconType: 'mangaplus',
    letterColor: '#DC2626',
    bgColor: '#FFFFFF',
  },
  mangareader: {
    id: 'mangareader',
    name: 'MangaReader',
    displayName: 'MangaR...',
    domain: 'mangareader.to',
    icon: 'https://www.google.com/s2/favicons?domain=mangareader.to&sz=64',
    iconType: 'mangareader',
    letter: 'M',
    letterColor: '#22C55E',
    bgColor: '#FFFFFF',
  },
  myreadingmanga: {
    id: 'myreadingmanga',
    name: 'MyReadingManga',
    displayName: 'MyReadi...',
    domain: 'myreadingmanga.info',
    icon: 'https://www.google.com/s2/favicons?domain=myreadingmanga.info&sz=64',
    iconType: 'myreadingmanga',
    letter: 'M',
    letterColor: '#A855F7',
    bgColor: '#FFFFFF',
  },
  ninemanga: {
    id: 'ninemanga',
    name: 'NineManga',
    displayName: 'NineMa...',
    domain: 'ninemanga.com',
    icon: 'https://www.google.com/s2/favicons?domain=ninemanga.com&sz=64',
    iconType: 'ninemanga',
    letter: 'N',
    letterColor: '#9333EA',
    bgColor: '#FFFFFF',
  },
  webtoons: {
    id: 'webtoons',
    name: 'Webtoon',
    displayName: 'Webtoo...',
    domain: 'webtoons.com',
    icon: 'https://www.google.com/s2/favicons?domain=webtoons.com&sz=64',
    iconType: 'webtoons',
    letterColor: '#00D564',
    bgColor: '#FFFFFF',
  },
  asurascans: {
    id: 'asurascans',
    name: 'AsuraScans',
    displayName: 'AsuraScans',
    domain: 'asuracomic.net',
    icon: 'https://www.google.com/s2/favicons?domain=asuracomic.net&sz=64',
    iconType: 'custom',
    letter: 'A',
    letterColor: '#BE185D',
    bgColor: '#FFFFFF',
  },
  nhentai: {
    id: 'nhentai',
    name: 'NHentai.net',
    displayName: 'NHentai',
    domain: 'nhentai.net',
    icon: 'https://www.google.com/s2/favicons?domain=nhentai.net&sz=64',
    iconType: 'custom',
    letter: 'N',
    letterColor: '#EC4899',
    bgColor: '#1F2937',
  },
  omegascans: {
    id: 'omegascans',
    name: 'OmegaScans',
    displayName: 'OmegaSc...',
    domain: 'omegascans.org',
    icon: 'https://www.google.com/s2/favicons?domain=omegascans.org&sz=64',
    iconType: 'custom',
    letter: 'Ω',
    letterColor: '#F59E0B',
    bgColor: '#18181B',
  },
  vortexscans: {
    id: 'vortexscans',
    name: 'VortexScans',
    displayName: 'VortexScans',
    domain: 'vortexscans.org',
    icon: 'https://www.google.com/s2/favicons?domain=vortexscans.org&sz=64',
    iconType: 'custom',
    letter: 'V',
    letterColor: '#3B82F6',
    bgColor: '#111827',
  },
  hitomila: {
    id: 'hitomila',
    name: 'Hitomi.La',
    displayName: 'Hitomi',
    domain: 'hitomi.la',
    icon: 'https://www.google.com/s2/favicons?domain=hitomi.la&sz=64',
    iconType: 'custom',
    letter: 'H',
    letterColor: '#E11D48',
    bgColor: '#18181B',
  },
  toonily: {
    id: 'toonily',
    name: 'Toonily',
    displayName: 'Toonily',
    domain: 'toonily.com',
    icon: 'https://www.google.com/s2/favicons?domain=toonily.com&sz=64',
    iconType: 'custom',
    letter: 'T',
    letterColor: '#EF4444',
    bgColor: '#18181B',
  },
  philiascans: {
    id: 'philiascans',
    name: 'PhiliaScans',
    displayName: 'PhiliaScans',
    domain: 'philiascans.org',
    icon: 'https://www.google.com/s2/favicons?domain=philiascans.org&sz=64',
    iconType: 'custom',
    letter: 'P',
    letterColor: '#EC4899',
    bgColor: '#18181B',
  },
  ravenscans: {
    id: 'ravenscans',
    name: 'RavenScans',
    displayName: 'RavenScans',
    domain: 'ravenscans.org',
    icon: 'https://www.google.com/s2/favicons?domain=ravenscans.org&sz=64',
    iconType: 'custom',
    letter: 'R',
    letterColor: '#6366F1',
    bgColor: '#18181B',
  },
  'comix-to': {
    id: 'comix-to',
    name: 'Comix',
    displayName: 'Comix',
    domain: 'comix.to',
    icon: 'https://www.google.com/s2/favicons?domain=comix.to&sz=64',
    iconType: 'custom',
    letter: 'C',
    letterColor: '#8B5CF6',
    bgColor: '#18181B',
  },
  reimanga: {
    id: 'reimanga',
    name: 'ReiManga',
    displayName: 'ReiManga',
    domain: 'reimanga.net',
    icon: 'https://www.google.com/s2/favicons?domain=reimanga.net&sz=64',
    iconType: 'custom',
    letter: 'R',
    letterColor: '#FB725D',
    bgColor: '#18181B',
  },
  toonz: {
    id: 'toonz',
    name: 'Toonz',
    displayName: 'Toonz',
    domain: 'toonz.to',
    icon: 'https://toonz.to/branding/toonz/og.png',
    iconType: 'custom',
    letter: 'T',
    letterColor: '#E11D48',
    bgColor: '#18181B',
  },
  kagane: {
    id: 'kagane',
    name: 'Kagane',
    displayName: 'Kagane',
    domain: 'kagane.moe',
    icon: 'https://kagane.moe/favicons/android-icon-192x192.png',
    iconType: 'custom',
    letter: 'K',
    letterColor: '#8B5CF6',
    bgColor: '#18181B',
  },
  projectsuki: {
    id: 'projectsuki',
    name: 'Project Suki',
    displayName: 'Project Suki',
    domain: 'projectsuki.com',
    icon: 'https://www.google.com/s2/favicons?domain=projectsuki.com&sz=64',
    iconType: 'custom',
    letter: 'P',
    letterColor: '#EC4899',
    bgColor: '#18181B',
  },
  mangaball: {
    id: 'mangaball',
    name: 'MangaBall',
    displayName: 'MangaBall',
    domain: 'mangaball.net',
    icon: 'https://www.google.com/s2/favicons?domain=mangaball.net&sz=64',
    iconType: 'custom',
    letter: 'M',
    letterColor: '#EAB308',
    bgColor: '#18181B',
  },
  atsumaru: {
    id: 'atsumaru',
    name: 'Atsumaru',
    displayName: 'Atsumaru',
    domain: 'atsumaru.net',
    icon: 'https://www.google.com/s2/favicons?domain=atsumaru.net&sz=64',
    iconType: 'custom',
    letter: 'A',
    letterColor: '#A855F7',
    bgColor: '#18181B',
  },
  mangago: {
    id: 'mangago',
    name: 'MangaGo',
    displayName: 'MangaGo',
    domain: 'mangago.me',
    icon: 'https://www.google.com/s2/favicons?domain=mangago.me&sz=64',
    iconType: 'custom',
    letter: 'G',
    letterColor: '#22C55E',
    bgColor: '#18181B',
  },
  weebcentral: {
    id: 'weebcentral',
    name: 'Weeb Central',
    displayName: 'Weeb Central',
    domain: 'weebcentral.com',
    icon: 'https://www.google.com/s2/favicons?domain=weebcentral.com&sz=64',
    iconType: 'custom',
    letter: 'W',
    letterColor: '#10B981',
    bgColor: '#18181B',
  },
  mangak: {
    id: 'mangak',
    name: 'MangaK',
    displayName: 'MangaK',
    domain: 'mangak.io',
    icon: 'https://www.google.com/s2/favicons?domain=mangak.io&sz=64',
    iconType: 'custom',
    letter: 'M',
    letterColor: '#38BDF8',
    bgColor: '#18181B',
  },
  onisaga: {
    id: 'onisaga',
    name: 'OniSaga',
    displayName: 'OniSaga',
    domain: 'onisaga.com',
    icon: 'https://www.google.com/s2/favicons?domain=onisaga.com&sz=64',
    iconType: 'custom',
    letter: 'O',
    letterColor: '#F43F5E',
    bgColor: '#18181B',
  },
  toonkotsu: {
    id: 'toonkotsu',
    name: 'Toonkotsu',
    displayName: 'Toonkotsu',
    domain: 'toonkotsu.com',
    icon: 'https://toonkotsu.com/favicon-32x32.png?v=4',
    iconType: 'custom',
    letter: 'T',
    letterColor: '#F59E0B',
    bgColor: '#18181B',
  },
};

const POPULAR_LANGUAGES = [
  { id: 'all', label: 'All Languages' },
  { id: 'en', label: 'English' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'tr', label: 'Turkish' },
  { id: 'id', label: 'Indonesian' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'ar', label: 'Arabic' },
  { id: 'vi', label: 'Vietnamese' },
  { id: 'ru', label: 'Russian' },
  { id: 'ja', label: 'Japanese' },
];

const CONTENT_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'manga', label: 'Manga' },
  { id: 'hentai', label: 'Hentai' },
  { id: 'comic', label: 'Comics' },
];

const DEFAULT_SORT_OPTIONS: SourceSortOption[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'latest', label: 'Latest Updates' },
  { id: 'newest', label: 'Newest Added' },
  { id: 'rating', label: 'Top Rated' },
  { id: 'alphabetical', label: 'Alphabetical' },
];

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  tr: 'Turkish',
  id: 'Indonesian',
  es: 'Spanish',
  fr: 'French',
  ar: 'Arabic',
  vi: 'Vietnamese',
  ru: 'Russian',
  ja: 'Japanese',
  th: 'Thai',
  it: 'Italian',
  de: 'German',
  zh: 'Chinese',
  ko: 'Korean',
  all: 'Multi-language',
};

interface CatalogMangaItem {
  id: string;
  title: string;
  coverUrl: string | null;
  coverHeaders?: Record<string, string>;
  rating?: number | null;
  sourceId: string;
  locale?: string;
}

/**
 * Resolves the accurate website URL for any manga source
 */
export function resolveSourceWebsiteUrl(
  sourceId: string,
  providedDomain?: string,
  providedBaseUrl?: string,
  catalogList?: CatalogSourceItem[]
): string {
  if (providedBaseUrl && providedBaseUrl.startsWith('http')) {
    return providedBaseUrl;
  }

  // 1. Check parser in SourceManager
  const parser = SourceManager.getParser(sourceId);
  if (parser?.metadata?.baseUrl && parser.metadata.baseUrl.startsWith('http')) {
    return parser.metadata.baseUrl;
  }
  if (parser?.metadata?.domain) {
    const d = parser.metadata.domain;
    return d.startsWith('http') ? d : `https://${d}`;
  }

  // 2. Check curated mapping
  const curated = CURATED_SOURCES[sourceId];
  if (curated?.domain) {
    const d = curated.domain;
    return d.startsWith('http') ? d : `https://${d}`;
  }

  // 3. Check catalog item
  const catalog = catalogList || SourceManager.getCatalog();
  const catalogItem = catalog.find((c) => c.id === sourceId || c.domain === sourceId);
  if (catalogItem?.baseUrl && catalogItem.baseUrl.startsWith('http')) {
    return catalogItem.baseUrl;
  }
  if (catalogItem?.domain) {
    const d = catalogItem.domain;
    return d.startsWith('http') ? d : `https://${d}`;
  }

  // 4. Fallback to providedDomain
  if (providedDomain && providedDomain.trim()) {
    const clean = providedDomain.trim();
    if (clean.startsWith('http')) return clean;
    return `https://${clean}`;
  }

  // 5. Special source-id fallbacks
  if (sourceId === 'mangadex') return 'https://mangadex.org';
  if (sourceId === 'reimanga') return 'https://reimanga.net';
  if (sourceId === 'toonz') return 'https://toonz.to';
  if (sourceId === 'kagane') return 'https://kagane.moe';
  if (sourceId === 'mangafire' || sourceId === 'mangafire-en') return 'https://mangafire.to';
  if (sourceId === 'comix-to' || sourceId === 'comixto') return 'https://comix.to';
  if (sourceId === 'asurascans' || sourceId === 'asuracomic') return 'https://asuracomic.net';
  if (sourceId === 'mangapill') return 'https://mangapill.com';
  if (sourceId === 'comick-fun' || sourceId === 'comick') return 'https://comick.dev';
  if (sourceId === 'manganato') return 'https://www.manganato.gg';
  if (sourceId === 'mangadot') return 'https://mangadot.net';
  if (sourceId === 'mangakakalot') return 'https://mangakakalot.com';
  if (sourceId === 'manhuafast') return 'https://manhuafast.com';
  if (sourceId === 'topmanhua') return 'https://topmanhua.com';
  if (sourceId === 'linewebtoon' || sourceId === 'webtoons') return 'https://www.webtoons.com';
  if (sourceId === 'nhentai') return 'https://nhentai.net';
  if (sourceId === 'omegascans') return 'https://omegascans.org';
  if (sourceId === 'vortexscans') return 'https://vortexscans.org';
  if (sourceId === 'hitomila') return 'https://hitomi.la';
  if (sourceId === 'batoto') return 'https://bato.to';
  if (sourceId === 'projectsuki') return 'https://projectsuki.com';
  if (sourceId === 'mangaball') return 'https://mangaball.net';
  if (sourceId === 'atsumaru' || sourceId === 'atsumoe') return 'https://atsumaru.net';
  if (sourceId === 'mangago') return 'https://www.mangago.me';
  if (sourceId === 'weebcentral') return 'https://weebcentral.com';
  if (sourceId === 'mangak') return 'https://mangak.io';
  if (sourceId === 'onisaga') return 'https://onisaga.com';
  if (sourceId === 'toonkotsu') return 'https://toonkotsu.com';

  return `https://${sourceId}.com`;
}

// Enable LayoutAnimation on Android for legacy architecture (no-op in New Architecture / Fabric)
const isFabric = Boolean((global as any)?.nativeFabricUIManager || (global as any)?._IS_FABRIC);
if (Platform.OS === 'android' && !isFabric && (UIManager as any)?.setLayoutAnimationEnabledExperimental) {
  (UIManager as any).setLayoutAnimationEnabledExperimental(true);
}

const EXPLOSION_PARTICLE_COUNT = 22;
// Tile background shatter grid (6x6 shards covering the 62px squircle)
const BG_SHARD_ROWS = 6;
const BG_SHARD_COLS = 6;
const BG_SHARD_SPAN = 62;

interface ExplosionParticle {
  dx: number;
  dy: number;
  size: number;
  color: string;
  delay: number;
  // Static origin offset from tile center (so shards start where the bg actually was)
  ox: number;
  oy: number;
  square: boolean;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
}

function makeExplosionParticles(
  accentColor: string,
  letterColor: string,
  bgGray: string
): ExplosionParticle[] {
  const bgLight = '#E4E4E7';
  // ~40% of shards are chunks of the gray tile background (incl. light-gray flash),
  // the rest are icon/accent fragments — like the HyperOS tile shatter.
  const palette = [letterColor, bgGray, accentColor, bgLight, '#FFFFFF', bgGray, letterColor, bgLight];
  return Array.from({ length: EXPLOSION_PARTICLE_COUNT }, (_, i) => {
    const angle = (i / EXPLOSION_PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 42 + Math.random() * 52;
    const isBgChunk = i % 4 === 1 || i % 4 === 5;
    return {
      dx: Math.cos(angle) * distance,
      // Slight upward bias + gravity pull applied during animation
      dy: Math.sin(angle) * distance - 8,
      // Background chunks fly as slightly larger shards
      size: isBgChunk ? 5 + Math.random() * 6 : 3.5 + Math.random() * 5,
      color: palette[i % palette.length],
      delay: Math.random() * 45,
      ox: 0,
      oy: 0,
      square: isBgChunk,
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(1),
    };
  });
}

/**
 * Breaks the gray squircle fill itself into shards: each shard starts at its
 * real position on the tile (ox/oy from center) and bursts outward, so the
 * background visibly disintegrates instead of fading as one block.
 */
function makeBgShatterShards(bgGray: string): ExplosionParticle[] {
  const shards: ExplosionParticle[] = [];
  const cellW = BG_SHARD_SPAN / BG_SHARD_COLS;
  const cellH = BG_SHARD_SPAN / BG_SHARD_ROWS;
  const tones = [bgGray, '#E4E4E7', bgGray, '#D4D4D8', bgGray, '#E4E4E7'];
  for (let row = 0; row < BG_SHARD_ROWS; row++) {
    for (let col = 0; col < BG_SHARD_COLS; col++) {
      const ox = col * cellW + cellW / 2 - BG_SHARD_SPAN / 2;
      const oy = row * cellH + cellH / 2 - BG_SHARD_SPAN / 2;
      // Outward direction follows the shard's position + jitter
      const dist = 26 + Math.random() * 46;
      const len = Math.max(1, Math.hypot(ox, oy));
      const jx = (Math.random() - 0.5) * 22;
      const jy = (Math.random() - 0.5) * 22;
      shards.push({
        dx: (ox / len) * dist + jx,
        dy: (oy / len) * dist + jy - 6,
        size: Math.min(cellW, cellH) - 1.5,
        color: tones[(row + col) % tones.length],
        delay: Math.random() * 40,
        ox,
        oy,
        square: true,
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        opacity: new Animated.Value(1),
        scale: new Animated.Value(1),
      });
    }
  }
  return shards;
}

function SourceFavicon({
  icon,
  letter,
  letterColor,
  imageStyle,
  textStyle,
}: {
  icon?: string;
  letter: string;
  letterColor?: string;
  imageStyle: any;
  textStyle: any;
}) {
  const [hasError, setHasError] = useState(false);

  if (icon && !hasError) {
    return (
      <Image
        source={{ uri: icon }}
        style={imageStyle}
        contentFit="contain"
        transition={150}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <Text style={[textStyle, letterColor ? { color: letterColor } : null]}>
      {letter}
    </Text>
  );
}

/**
 * Grid cell with Xiaomi HyperOS (Poco X7 Pro) style delete animation:
 * icon implodes while shattering into particles + shockwave ring,
 * then the grid collapses with a spring via LayoutAnimation.
 */
function SourceGridCell({
  source,
  colors,
  exploding,
  isDefault,
  onPress,
  onLongPress,
}: {
  source: {
    id: string;
    name: string;
    displayName: string;
    domain: string;
    icon?: string;
    letter?: string;
    letterColor?: string;
  };
  colors: any;
  exploding: boolean;
  isDefault?: boolean;
  onPress: () => void;
  onLongPress: (layout?: { x: number; y: number; width: number; height: number }) => void;
}) {
  const cellRef = useRef<View>(null);
  const touchCoords = useRef({ pageX: 0, pageY: 0 });
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0.4)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  // Gray tile background fill animation (flash light-gray, then dissolve with the burst)
  const bgScale = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const bgFlashOpacity = useRef(new Animated.Value(0)).current;

  const particles = useMemo(
    () =>
      makeExplosionParticles(
        colors.accent,
        source.letterColor || colors.accent,
        colors.surfaceElevated
      ),
    // Generate once per cell mount so vectors stay stable during the burst
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Shards of the gray tile background itself, positioned across the tile surface
  const bgShards = useMemo(
    () => makeBgShatterShards(colors.surfaceElevated),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const runBurst = useCallback((list: ExplosionParticle[], gravityDrop: number) => {
    list.forEach((p) => {
      Animated.parallel([
        Animated.timing(p.x, {
          toValue: p.dx,
          duration: 520,
          delay: p.delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(p.y, {
            toValue: p.dy,
            duration: 300,
            delay: p.delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Gravity drop after the outward burst
          Animated.timing(p.y, {
            toValue: p.dy + gravityDrop,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 480,
          delay: p.delay + 60,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(p.scale, {
          toValue: 0.2,
          duration: 540,
          delay: p.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  useEffect(() => {
    if (!exploding) return;
    // Icon implosion: quick shrink + fade (HyperOS squash before shatter)
    Animated.parallel([
      Animated.timing(iconScale, {
        toValue: 0.35,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue: 0,
        duration: 230,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      // Gray background fill: light-gray flash on impact, then the solid fill
      // vanishes fast so the bg shards ARE the background disintegrating
      Animated.sequence([
        Animated.timing(bgFlashOpacity, {
          toValue: 0.85,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bgFlashOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(bgScale, {
        toValue: 0.55,
        duration: 320,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // Background fill shatters into its grid shards + icon fragments burst
    runBurst(bgShards, 30);
    runBurst(particles, 34);

    // Shockwave ring expanding outward
    Animated.parallel([
      Animated.timing(ringScale, {
        toValue: 2.1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(ringOpacity, {
          toValue: 0.55,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 390,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

  }, [exploding, iconScale, iconOpacity, labelOpacity, ringScale, ringOpacity, bgScale, bgOpacity, bgFlashOpacity, particles, bgShards, runBurst]);

  const handleCellLongPress = useCallback(() => {
    if (exploding) return;
    if (cellRef.current && typeof (cellRef.current as any).measureInWindow === 'function') {
      (cellRef.current as any).measureInWindow((x: number, y: number, width: number, height: number) => {
        if (typeof x === 'number' && typeof y === 'number' && width > 0) {
          onLongPress({ x, y, width, height });
        } else {
          onLongPress({
            x: touchCoords.current.pageX - 36,
            y: touchCoords.current.pageY - 36,
            width: 72,
            height: 72,
          });
        }
      });
    } else {
      onLongPress({
        x: touchCoords.current.pageX - 36,
        y: touchCoords.current.pageY - 36,
        width: 72,
        height: 72,
      });
    }
  }, [exploding, onLongPress]);

  return (
    <Pressable
      ref={cellRef as any}
      onPress={onPress}
      onLongPress={handleCellLongPress}
      delayLongPress={350}
      disabled={exploding}
      onTouchStart={(e) => {
        const native = e.nativeEvent as any;
        const px = typeof native.clientX === 'number' ? native.clientX : native.pageX;
        const py = typeof native.clientY === 'number' ? native.clientY : native.pageY;
        touchCoords.current = { pageX: px, pageY: py };
      }}
      {...{
        onContextMenu: (e: any) => {
          e?.preventDefault?.();
          if (!exploding) {
            if (cellRef.current && typeof (cellRef.current as any).measureInWindow === 'function') {
              (cellRef.current as any).measureInWindow((x: number, y: number, width: number, height: number) => {
                if (typeof x === 'number' && typeof y === 'number' && width > 0) {
                  onLongPress({ x, y, width, height });
                } else {
                  onLongPress({
                    x: (e.clientX ?? 50) - 36,
                    y: (e.clientY ?? 50) - 36,
                    width: 72,
                    height: 72,
                  });
                }
              });
            } else {
              onLongPress({
                x: (e.clientX ?? 50) - 36,
                y: (e.clientY ?? 50) - 36,
                width: 72,
                height: 72,
              });
            }
          }
        },
      }}
      style={({ pressed, hovered }: any) => [
        styles.sourceGridCell,
        {
          transform: [{ scale: exploding ? 1 : pressed ? 0.94 : hovered ? 1.02 : 1 }],
          opacity: pressed && !exploding ? 0.85 : 1,
        },
        Platform.OS === 'web' && { cursor: 'pointer' as any },
      ]}
      aria-label={`Open ${source.name} series. Hold to manage.`}
    >
      {/* Flat Squircle App Icon Container (gray fill dissolves with the burst) */}
      <Animated.View
        style={[
          styles.squircleContainer,
          {
            backgroundColor: colors.surfaceElevated,
            transform: [{ scale: bgScale }],
            opacity: bgOpacity,
          },
        ]}
      >
        <Animated.View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: iconScale }],
            opacity: iconOpacity,
          }}
        >
          <SourceFavicon
            icon={source.icon}
            letter={source.letter || source.name.charAt(0)}
            letterColor={source.letterColor || colors.accent}
            imageStyle={styles.sourceGridFavicon}
            textStyle={styles.monogramLetter}
          />
        </Animated.View>

        {isDefault && (
          <View style={styles.primaryBadgeContainer} accessibilityLabel="Primary Discover Source">
            <Ionicons name="star" size={10} color="#FFFFFF" />
          </View>
        )}

        {/* Light-gray impact flash washing over the tile background */}
        {exploding && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.explosionFlash,
              { backgroundColor: '#E4E4E7', opacity: bgFlashOpacity },
            ]}
          />
        )}
      </Animated.View>

      {/* Xiaomi-style shatter: gray bg shards + icon fragments + shockwave */}
      {exploding && (
        <View style={styles.explosionOverlay} pointerEvents="none">
          <Animated.View
            style={[
              styles.explosionRing,
              { borderColor: colors.accent, transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
          {/* Background fill disintegrating: shards start at their real tile position */}
          {bgShards.map((p, i) => (
            <Animated.View
              key={`bg-${i}`}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: p.size,
                height: p.size,
                marginLeft: p.ox - p.size / 2,
                marginTop: p.oy - p.size / 2,
                borderRadius: 2,
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
              }}
            />
          ))}
          {/* Icon / accent fragments bursting from the center */}
          {particles.map((p, i) => (
            <Animated.View
              key={`fg-${i}`}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: p.size,
                height: p.size,
                marginLeft: p.ox - p.size / 2,
                marginTop: p.oy - p.size / 2,
                borderRadius: p.square ? 2 : p.size / 2,
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
              }}
            />
          ))}
        </View>
      )}

      {/* Truncated Name */}
      <Animated.Text
        numberOfLines={1}
        style={[styles.sourceGridTitle, { color: colors.text, opacity: labelOpacity }]}
      >
        {source.displayName}
      </Animated.Text>
    </Pressable>
  );
}

export default function ExtensionsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { reopenCatalog, catalogQuery, catalogRequestId, catalogFrom } = useLocalSearchParams<{
    reopenCatalog?: string;
    catalogQuery?: string;
    catalogRequestId?: string;
    catalogFrom?: string;
  }>();

  // State preservation when navigating to manga details and returning
  const isViewingMangaFromCatalogRef = useRef(false);
  const isRestoringFromDetailRef = useRef(false);
  const isSolvingCloudflareRef = useRef(false);
  const handledCatalogRequestRef = useRef<string | null>(null);
  const catalogOpenedFromSearchRef = useRef(false);
  const catalogSearchQueryRef = useRef('');
  const catalogSlideX = useRef(new Animated.Value(0)).current;
  const isCatalogClosingRef = useRef(false);
  // True when the catalog was opened through the store (Discover search sheet)
  // rather than through the Extensions route params.
  const catalogFromStoreRef = useRef(false);
  const handledCatalogStoreRequestRef = useRef<string | null>(null);
  const catalogRequest = useCatalogStore((s) => s.request);
  const setCatalogHostMounted = useCatalogStore((s) => s.setHostMounted);

  const [drawerVisible, setDrawerVisible] = useState(false);

  // Installed Sources on the 4-column grid (Image 1)
  const [installedIds, setInstalledIds] = useState<string[]>(DEFAULT_INSTALLED_IDS);
  const [defaultSourceId, setDefaultSourceId] = useState<string>('mangadex');
  const [advancedSearchVisible, setAdvancedSearchVisible] = useState(false);
  const [catalogFilters, setCatalogFilters] = useState<SearchFilters | null>(null);

  // Source Card Action Floating Bar state (Long Press on Grid Card)
  const [sourceActionModalVisible, setSourceActionModalVisible] = useState(false);
  const [selectedSourceForAction, setSelectedSourceForAction] = useState<{
    id: string;
    name: string;
    domain?: string;
    icon?: string;
    displayName?: string;
  } | null>(null);
  const [sourceActionLayout, setSourceActionLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    isFirstRow?: boolean;
  } | null>(null);

  const fabAnimScale = useRef(new Animated.Value(0)).current;
  const fabAnimOpacity = useRef(new Animated.Value(0)).current;
  const isClosingFabRef = useRef(false);

  const dismissFab = useCallback((onComplete?: () => void) => {
    if (isClosingFabRef.current) return;
    isClosingFabRef.current = true;

    Animated.parallel([
      Animated.timing(fabAnimScale, {
        toValue: 0,
        duration: 170,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
      Animated.timing(fabAnimOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSourceActionModalVisible(false);
      isClosingFabRef.current = false;
      onComplete?.();
    });
  }, [fabAnimScale, fabAnimOpacity]);

  useEffect(() => {
    if (sourceActionModalVisible) {
      isClosingFabRef.current = false;
      fabAnimScale.setValue(0);
      fabAnimOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(fabAnimScale, {
          toValue: 1,
          duration: 180,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fabAnimOpacity, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [sourceActionModalVisible, fabAnimScale, fabAnimOpacity]);

  // Xiaomi HyperOS style delete: which grid cell is currently shattering
  const [explodingId, setExplodingId] = useState<string | null>(null);
  const pendingRemovalTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pendingRemovalTimeout.current) clearTimeout(pendingRemovalTimeout.current);
    };
  }, []);

  // Sources Catalog Modal state (New Screenshot)
  const [sourcesCatalogVisible, setSourcesCatalogVisible] = useState(false);
  const [catalogLanguage, setCatalogLanguage] = useState<string>('en');
  const [catalogContentType, setCatalogContentType] = useState<string>('all');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [isCatalogSearchOpen, setIsCatalogSearchOpen] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  // Manga Browser Modal state (Image 2)
  const [mangaModalVisible, setMangaModalVisible] = useState(false);
  // When opened from the Discover search carousel we slide the catalog
  // horizontally (like a pushed screen) instead of using the vertical curtain.
  const [catalogSlidesHorizontally, setCatalogSlidesHorizontally] = useState(false);
  const [activeMangaSource, setActiveMangaSource] = useState<{ id: string; name: string; domain?: string }>({
    id: 'mangadex',
    name: 'MangaDex',
    domain: 'mangadex.org',
  });
  const [selectedSort, setSelectedSort] = useState<string>('popular');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<SourceTag[]>([{ id: '', label: 'All' }]);
  const [availableSorts, setAvailableSorts] = useState<SourceSortOption[]>(DEFAULT_SORT_OPTIONS);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isMangaSearchOpen, setIsMangaSearchOpen] = useState(false);
  const [mangaSearchQuery, setMangaSearchQuery] = useState('');
  const [debouncedMangaQuery, setDebouncedMangaQuery] = useState('');
  const [sortPickerVisible, setSortPickerVisible] = useState(false);
  const [columnsMode, setColumnsMode] = useState<2 | 3>(3);
  const gridIconScale = useRef(new Animated.Value(1)).current;
  const gridIconRotate = useRef(new Animated.Value(0)).current;

  const handleToggleColumnsMode = useCallback(() => {
    triggerHaptic();

    // Tactile spring scale pop
    gridIconScale.setValue(0.72);
    Animated.spring(gridIconScale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // Fluid 90deg rotation
    gridIconRotate.setValue(0);
    Animated.timing(gridIconRotate, {
      toValue: 1,
      duration: 220,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    setColumnsMode((prev) => (prev === 3 ? 2 : 3));
  }, [gridIconScale, gridIconRotate]);

  const gridIconSpin = gridIconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  // Source catalog curtain header animation
  const catalogHeaderAnim = useRef(new Animated.Value(0)).current;
  const isCatalogChromeHiddenRef = useRef(false);
  const catalogLastScrollYRef = useRef(0);
  const [catalogHeaderHeight, setCatalogHeaderHeight] = useState(135);

  const catalogHeaderOpacity = catalogHeaderAnim.interpolate({
    inputRange: [-70, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const hideCatalogHeader = useCallback(() => {
    if (!isCatalogChromeHiddenRef.current) {
      isCatalogChromeHiddenRef.current = true;
      Animated.timing(catalogHeaderAnim, {
        toValue: -(catalogHeaderHeight + 60),
        duration: 220,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [catalogHeaderHeight, catalogHeaderAnim]);

  const showCatalogHeader = useCallback(() => {
    if (isCatalogChromeHiddenRef.current) {
      isCatalogChromeHiddenRef.current = false;
      Animated.timing(catalogHeaderAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [catalogHeaderAnim]);

  const handleCatalogScrollBeginDrag = useCallback(() => {
    // Hide/show the header from the actual scroll direction, not drag start.
  }, []);

  const handleCatalogScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const previousY = catalogLastScrollYRef.current;
    catalogLastScrollYRef.current = y;

    if (y <= 10) {
      showCatalogHeader();
      return;
    }

    if (y > previousY + 2) hideCatalogHeader();
    else if (y < previousY - 2) showCatalogHeader();
  }, [hideCatalogHeader, showCatalogHeader]);

  const handleCatalogScrollEndDrag = useCallback(() => {
    // Keep the current chrome state after the gesture ends.
  }, []);

  const handleCatalogMomentumScrollEnd = useCallback(() => {
    // Keep the current chrome state after momentum ends.
  }, []);

  useEffect(() => {
    if (!mangaModalVisible) {
      isCatalogChromeHiddenRef.current = false;
      catalogLastScrollYRef.current = 0;
      catalogHeaderAnim.setValue(0);
    }
  }, [mangaModalVisible, catalogHeaderAnim]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMangaQuery(mangaSearchQuery.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [mangaSearchQuery]);

  // Mangas loaded in Image 2 modal
  const [modalMangas, setModalMangas] = useState<CatalogMangaItem[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalIsCloudflare, setModalIsCloudflare] = useState(false);
  const [modalCfDomain, setModalCfDomain] = useState('');
  const [modalCfUrl, setModalCfUrl] = useState('');
  const [isCfInAppModalOpen, setIsCfInAppModalOpen] = useState(false);
  const [cfInAppUrl, setCfInAppUrl] = useState('');
  const cfWebViewRef = useRef<any>(null);
  const [persistentBridgeUrl, setPersistentBridgeUrl] = useState('https://mangadot.net/');
  const persistentBridgeRef = useRef<any>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isModalLoadingMore, setIsModalLoadingMore] = useState(false);
  const [modalPage, setModalPage] = useState(1);
  const [hasMoreMangas, setHasMoreMangas] = useState(true);

  // Register WebView script dispatcher for authenticated requests
  useEffect(() => {
    webViewBridge.registerSender((script: string) => {
      if (cfWebViewRef.current) {
        cfWebViewRef.current.injectJavaScript(script);
        return;
      }
      if (persistentBridgeRef.current) {
        persistentBridgeRef.current.injectJavaScript(script);
      }
    });
    return () => {
      webViewBridge.unregisterSender();
    };
  }, []);

  // Load installed sources from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        await SourceManager.init();
        setDefaultSourceId(SourceManager.getDefaultDiscoverSourceId());
        const stored = await AsyncStorage.getItem(STORAGE_KEY_INSTALLED_SOURCES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // An explicitly emptied grid is respected: no sources, no search.
            if (parsed.length === 0) {
              setInstalledIds([]);
              await SourceManager.syncInstalledSources([]);
              return;
            }
            // Auto-migration to ensure new curated sources appear for existing users
            const MIGRATION_KEY_V5 = '@mangaapp_catalog_v5_migrated';
            const migrated = await AsyncStorage.getItem(MIGRATION_KEY_V5);
            if (!migrated) {
              const NEW_DEFAULT_IDS = [
                'toonz',
                'kagane',
                'mangafire',
                'projectsuki',
                'mangaball',
                'atsumaru',
                'mangago',
                'weebcentral',
                'mangak',
                'onisaga',
                'toonkotsu',
              ];
              const merged = [...parsed];
              let addedAny = false;
              for (const id of NEW_DEFAULT_IDS) {
                if (!merged.includes(id)) {
                  merged.push(id);
                  addedAny = true;
                }
              }
              await AsyncStorage.setItem(MIGRATION_KEY_V5, 'true');
              if (addedAny) {
                await AsyncStorage.setItem(
                  STORAGE_KEY_INSTALLED_SOURCES,
                  JSON.stringify(merged)
                );
                setInstalledIds(merged);
                await SourceManager.syncInstalledSources(merged);
                return;
              }
            }
            setInstalledIds(parsed);
            await SourceManager.syncInstalledSources(parsed);
            return;
          }
        }
        // Initial install: persist default curated sources
        await AsyncStorage.setItem(
          STORAGE_KEY_INSTALLED_SOURCES,
          JSON.stringify(DEFAULT_INSTALLED_IDS)
        );
        await SourceManager.syncInstalledSources(DEFAULT_INSTALLED_IDS);
      } catch {
        // Fallback to default
      }
    })();
  }, []);

  // Save installed sources helper
  const handleToggleInstallSource = useCallback(
    async (sourceId: string) => {
      triggerHaptic();
      setInstalledIds((prev) => {
        let updated: string[];
        if (prev.includes(sourceId)) {
          updated = prev.filter((id) => id !== sourceId);
          SourceManager.setSourceEnabled(sourceId, false);
        } else {
          updated = [...prev, sourceId];
          SourceManager.setSourceEnabled(sourceId, true);
        }
        AsyncStorage.setItem(STORAGE_KEY_INSTALLED_SOURCES, JSON.stringify(updated)).catch(() => { });
        return updated;
      });
    },
    []
  );

  const handleSourceLongPress = useCallback(
    (
      source: {
        id: string;
        name: string;
        domain?: string;
        icon?: string;
        displayName?: string;
      },
      layout?: { x: number; y: number; width: number; height: number; isFirstRow?: boolean }
    ) => {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedSourceForAction(source);
      if (layout) {
        setSourceActionLayout(layout);
      }
      setSourceActionModalVisible(true);
    },
    []
  );

  const handleRemoveSourceFromGrid = useCallback(async () => {
    if (!selectedSourceForAction || explodingId) return;
    const sourceId = selectedSourceForAction.id;
    // Close the action sheet first so the shatter plays on the grid behind it
    setSourceActionModalVisible(false);
    // Heavy impact at the moment of shatter, like HyperOS app uninstall
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setExplodingId(sourceId);
    setSelectedSourceForAction(null);
    if (pendingRemovalTimeout.current) clearTimeout(pendingRemovalTimeout.current);
    // Let the particle burst (~550ms) finish, then collapse the layout with a spring
    pendingRemovalTimeout.current = setTimeout(() => {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(
          380,
          LayoutAnimation.Types.spring,
          LayoutAnimation.Properties.scaleXY
        )
      );
      setInstalledIds((prev) => {
        const updated = prev.filter((id) => id !== sourceId);
        SourceManager.setSourceEnabled(sourceId, false);
        AsyncStorage.setItem(STORAGE_KEY_INSTALLED_SOURCES, JSON.stringify(updated)).catch(() => { });
        return updated;
      });
      setExplodingId(null);
      pendingRemovalTimeout.current = null;
    }, 600);
  }, [selectedSourceForAction, explodingId]);

  const handleSetPrimarySourceFromFab = useCallback(async () => {
    if (!selectedSourceForAction) return;
    triggerHaptic();
    const srcId = selectedSourceForAction.id;
    await SourceManager.setDefaultDiscoverSourceId(srcId);
    setDefaultSourceId(srcId);
    dismissFab();
  }, [selectedSourceForAction, dismissFab]);

  // All 1,223 catalog items
  const allCatalog = useMemo(() => SourceManager.getCatalog(), []);

  // Filtered catalog list for "Sources catalog" screen (new screenshot)
  const filteredCatalogSources = useMemo(() => {
    const q = catalogSearchQuery.toLowerCase().trim();
    return allCatalog.filter((item) => {
      // Language filter
      if (catalogLanguage !== 'all') {
        if (item.locale !== catalogLanguage && item.locale !== 'all') {
          return false;
        }
      }

      // Content Type filter
      if (catalogContentType !== 'all') {
        if (item.contentType !== catalogContentType) {
          return false;
        }
      }

      // Search query filter
      if (q) {
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDomain = item.domain.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDomain) return false;
      }

      return true;
    });
  }, [allCatalog, catalogLanguage, catalogContentType, catalogSearchQuery]);

  // List of sources displayed on Image 1 (4-column grid)
  const displayGridSources = useMemo(() => {
    return installedIds.map((id) => {
      const catalogItem = allCatalog.find((c) => c.id === id);
      const parser = SourceManager.getParser(id);
      const curated = CURATED_SOURCES[id];

      const domain =
        parser?.metadata.domain ||
        curated?.domain ||
        catalogItem?.domain ||
        '';

      const name =
        catalogItem?.title ||
        parser?.metadata.name ||
        (curated?.name === 'AsuraComic' ? 'AsuraScans' : curated?.name) ||
        id;

      const icon =
        catalogItem?.icon ||
        (parser?.metadata.icon?.startsWith('http') ? parser.metadata.icon : undefined) ||
        curated?.icon ||
        (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : undefined);

      const firstLetter = name.charAt(0).toUpperCase();

      return {
        id,
        name,
        displayName:
          curated?.displayName && curated.displayName !== 'AsuraCo...'
            ? curated.displayName
            : name.length > 8
              ? `${name.slice(0, 7)}…`
              : name,
        domain,
        icon,
        iconType: curated?.iconType || 'custom',
        letter: curated?.letter || firstLetter,
        letterColor: curated?.letterColor || colors.accent,
        bgColor: colors.surface,
      };
    });
  }, [installedIds, allCatalog, colors]);

  // Load mangas when Manga Browser Modal (Image 2) opens or changes
  const loadModalMangas = useCallback(
    async (
      pageToLoad: number,
      append = false,
      filtersOverride?: SearchFilters | null
    ) => {
      const activeCatalogFilters =
        filtersOverride !== undefined ? filtersOverride : catalogFilters;
      if (pageToLoad === 1) {
        setIsModalLoading(true);
        setModalError(null);
        setModalIsCloudflare(false);
      } else {
        setIsModalLoadingMore(true);
      }

      try {
        const sourceId = activeMangaSource.id;

        if (sourceId === 'batoto') {
          throw new Error(
            'Bato.to permanently shut down operations in early 2026. This source is no longer active. We recommend using Comix, MangaDex, or MangaPill for active updates.'
          );
        }

        if (sourceId === 'mangadex') {
          const offset = (pageToLoad - 1) * 24;
          let results: Manga[] = [];

          let orders: Record<string, 'asc' | 'desc'> = { followedCount: 'desc' };
          if (selectedSort === 'latest') orders = { latestUploadedChapter: 'desc' };
          else if (selectedSort === 'newest') orders = { createdAt: 'desc' };
          else if (selectedSort === 'rating') orders = { rating: 'desc' };
          else if (selectedSort === 'alphabetical') orders = { title: 'asc' };

          if (debouncedMangaQuery.trim() || selectedGenre || activeCatalogFilters) {
            const searchRes = await searchManga(
              {
                ...(activeCatalogFilters ?? {}),
                title: debouncedMangaQuery.trim() || activeCatalogFilters?.title || undefined,
                includedTags: selectedGenre
                  ? [selectedGenre]
                  : activeCatalogFilters?.includedTags,
                orders: activeCatalogFilters?.orders ?? orders,
              },
              24,
              offset
            );
            results = searchRes.data;
          } else if (pageToLoad === 1 && selectedSort === 'popular') {
            results = await getPopularManga(24);
          } else {
            const searchRes = await searchManga(
              {
                orders,
              },
              24,
              offset
            );
            results = searchRes.data;
          }

          // Fetch stats for rating percentages
          const mangaIds = results.map((m) => m.id);
          let statsMap: Record<string, any> = {};
          try {
            if (mangaIds.length > 0) {
              statsMap = await getBatchMangaStatistics(mangaIds);
            }
          } catch {
            // fallback
          }

          const mapped: CatalogMangaItem[] = results.map((m) => {
            const fileName = extractCoverFileName(m);
            const coverUrl = fileName ? getCoverUrl(m.id, fileName, '256') : null;
            const stat = statsMap[m.id];
            const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
            const rating = normalizeRatingToTen(ratingVal, 'mangadex');

            return {
              id: m.id,
              title: getMangaTitle(m),
              coverUrl,
              rating,
              sourceId: 'mangadex',
            };
          });

          setModalMangas((prev) => (append ? [...prev, ...mapped] : mapped));
          setHasMoreMangas(results.length >= 24);
        } else {
          // Dynamic parser from SourceManager
          let parser = SourceManager.getParser(sourceId);
          if (!parser) {
            const item = allCatalog.find((c) => c.id === sourceId);
            if (item) {
              parser = SourceManager.createParserForCatalogSource(item) || undefined;
            }
          }

          if (parser) {
            const list = await parser.getList({
              page: pageToLoad,
              order: selectedSort as any,
              query: debouncedMangaQuery.trim() || undefined,
              tags: selectedGenre ? [selectedGenre] : undefined,
            });

            const mapped: CatalogMangaItem[] = list.map((m) => ({
              id: m.id,
              title: m.title,
              coverUrl: m.coverUrl,
              coverHeaders:
                m.coverHeaders ||
                (parser!.metadata.id === 'manganato'
                  ? { Referer: 'https://www.manganato.gg/' }
                  : parser!.metadata.id === 'mangadot'
                    ? { Referer: 'https://mangadot.net/' }
                    : parser!.metadata.id === 'hitomila'
                      ? { Referer: 'https://hitomi.la/' }
                      : undefined),
              rating: normalizeRatingToTen(m.rating, parser!.metadata.id),
              sourceId: parser!.metadata.id,
              locale: m.locale || detectMangaLanguage(m.title, undefined, m.tags, parser!.metadata.id),
            }));

            setModalMangas((prev) => (append ? [...prev, ...mapped] : mapped));
            setHasMoreMangas(list.length >= 15);
          } else {
            if (!append) setModalMangas([]);
            setHasMoreMangas(false);
          }
        }
      } catch (err: any) {
        const isCf =
          err.isCloudFlare ||
          (typeof err.message === 'string' &&
            (err.message.toLowerCase().includes('cloudflare') ||
              err.message.toLowerCase().includes('challenge') ||
              err.message.toLowerCase().includes('turnstile')));
        if (!isCf) {
          console.error('Error loading modal mangas:', err);
        } else {
          console.log('[Extensions] Source requires Cloudflare verification:', activeMangaSource?.name);
        }
        const cfDomain =
          err.domain ||
          (activeMangaSource.id === 'manganato' ? 'manganato.gg' : '') ||
          (activeMangaSource.id === 'mangadot' ? 'mangadot.net' : '') ||
          (activeMangaSource.id === 'comick-fun' || activeMangaSource.id === 'comick' ? 'comick.dev' : '') ||
          (activeMangaSource.id === 'onisaga' ? 'onisaga.com' : '') ||
          activeMangaSource.domain ||
          (activeMangaSource.id === 'comix-to' ? 'comix.to' : '') ||
          (activeMangaSource.id === 'reimanga' ? 'reimanga.net' : '');
        setModalIsCloudflare(!!isCf);
        setModalCfDomain(cfDomain);
        setModalCfUrl(err.url || (cfDomain ? `https://${cfDomain}/` : ''));

        const errMsg = isCf
          ? `${activeMangaSource.name} requires a quick bot check to browse.`
          : err.response?.status === 404
            ? 'Catalog page not found. Please try again later.'
            : err.message || 'Unable to connect to source server.';
        if (!append) {
          setModalMangas([]);
          setModalError(errMsg);
        }
      } finally {
        setIsModalLoading(false);
        setIsModalLoadingMore(false);
      }
    },
    [activeMangaSource, selectedSort, selectedGenre, debouncedMangaQuery, allCatalog, catalogFilters]
  );

  const handleOpenActiveSourceWebsite = useCallback(async () => {
    triggerHaptic();
    const targetUrl =
      modalCfUrl ||
      resolveSourceWebsiteUrl(
        activeMangaSource.id,
        modalCfDomain || activeMangaSource.domain,
        undefined,
        allCatalog
      );

    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        await WebBrowser.openBrowserAsync(targetUrl);
      }
    } catch {
      Linking.openURL(targetUrl).catch(() => { });
    }
  }, [activeMangaSource, modalCfDomain, modalCfUrl, allCatalog]);

  const handleSolveCloudflare = useCallback(() => {
    triggerHaptic();
    const targetDomain = modalCfDomain || activeMangaSource.domain;
    let targetUrl =
      modalCfUrl ||
      resolveSourceWebsiteUrl(
        activeMangaSource.id,
        targetDomain,
        undefined,
        allCatalog
      );

    // If the challenge occurred on a REST API endpoint (/api/search), load the clean website homepage!
    // This avoids rendering raw JSON and ugly browser pretty-print checkboxes to the user.
    if (targetUrl.includes('/api/')) {
      targetUrl = targetDomain.startsWith('http') ? targetDomain : `https://${targetDomain}/`;
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const handleWindowFocus = () => {
          window.removeEventListener('focus', handleWindowFocus);
          if (isSolvingCloudflareRef.current) {
            isSolvingCloudflareRef.current = false;
            setModalError(null);
            setModalIsCloudflare(false);
            loadModalMangas(1, false);
          }
        };
        window.addEventListener('focus', handleWindowFocus);
        isSolvingCloudflareRef.current = true;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      // In-App verification modal keeps the user completely inside Yomite
      setCfInAppUrl(targetUrl);
      setIsCfInAppModalOpen(true);
    }
  }, [activeMangaSource, modalCfDomain, modalCfUrl, allCatalog, loadModalMangas]);

  // Auto-reload manga cards when returning back to Yomite app from external browser
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isSolvingCloudflareRef.current) {
        isSolvingCloudflareRef.current = false;
        setModalError(null);
        setModalIsCloudflare(false);
        loadModalMangas(1, false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadModalMangas]);

  // Auto-restore source catalog when returning back from manga details / chapter list
  useFocusEffect(
    useCallback(() => {
      if (isViewingMangaFromCatalogRef.current) {
        isViewingMangaFromCatalogRef.current = false;
        setMangaModalVisible(true);
      }
    }, [])
  );

  const loadSourceFilters = useCallback(async (sourceId: string) => {
    setIsLoadingTags(true);
    try {
      let parser = SourceManager.getParser(sourceId);
      if (!parser) {
        const item = allCatalog.find((c) => c.id === sourceId);
        if (item) {
          parser = SourceManager.createParserForCatalogSource(item) || undefined;
        }
      }

      let tags: SourceTag[] = [];
      let sorts: SourceSortOption[] = DEFAULT_SORT_OPTIONS;

      if (parser) {
        if (parser.getAvailableTags) {
          try {
            tags = await parser.getAvailableTags();
          } catch (e) {
            console.warn(`[Tags] Failed to fetch tags for ${sourceId}:`, e);
          }
        }
        if (parser.getAvailableSorts) {
          try {
            const s = parser.getAvailableSorts();
            if (Array.isArray(s) && s.length > 0) sorts = s;
          } catch (e) {
            console.warn(`[Sorts] Failed to fetch sorts for ${sourceId}:`, e);
          }
        }
      }

      setAvailableTags([{ id: '', label: 'All' }, ...(tags || [])]);
      setAvailableSorts(sorts);

      // If current selectedSort is not supported by this source, switch to its default/first sort
      if (sorts.length > 0 && !sorts.some((s) => s.id === selectedSort)) {
        setSelectedSort(sorts[0].id);
      }
    } catch (err) {
      console.warn('Error loading source filters:', err);
      setAvailableTags([{ id: '', label: 'All' }]);
      setAvailableSorts(DEFAULT_SORT_OPTIONS);
    } finally {
      setIsLoadingTags(false);
    }
  }, [allCatalog, selectedSort]);

  // Restore catalog from deep link / Discover "view all" (reopenCatalog + catalogQuery)
  useEffect(() => {
    if (reopenCatalog) {
      const requestKey = `${reopenCatalog}|${catalogQuery ?? ''}|${catalogRequestId ?? ''}`;
      if (handledCatalogRequestRef.current === requestKey) return;

      const src =
        displayGridSources.find((s) => s.id === reopenCatalog) ||
        allCatalog.find((c) => c.id === reopenCatalog);
      if (src) {
        handledCatalogRequestRef.current = requestKey;
        const query = typeof catalogQuery === 'string' ? catalogQuery : '';
        const hasQuery = query.trim().length > 0;

        // Remember where the catalog was opened from so the back arrow can
        // return to the Discover search sheet instead of just closing.
        const fromSearch = catalogFrom === 'search' && hasQuery;
        catalogOpenedFromSearchRef.current = fromSearch;
        catalogSearchQueryRef.current = query;
        isCatalogClosingRef.current = false;
        catalogFromStoreRef.current = false;

        // A query means "fresh search from Discover"; without one we are
        // returning from a manga detail page and must keep the current state.
        isRestoringFromDetailRef.current = !hasQuery;

        setActiveMangaSource({
          id: src.id,
          name: src.name || (src as any).title,
          domain: (src as any).domain,
        });
        setSelectedGenre('');
        setCatalogFilters(null);
        setMangaSearchQuery(query);
        setDebouncedMangaQuery(query.trim());
        setIsMangaSearchOpen(hasQuery);
        setModalCfUrl('');
        setCatalogSlidesHorizontally(fromSearch);

        if (fromSearch) {
          // Push-in from the right, matching the navigation screen transition.
          catalogSlideX.setValue(windowWidth);
          setMangaModalVisible(true);
          requestAnimationFrame(() => {
            Animated.timing(catalogSlideX, {
              toValue: 0,
              duration: 260,
              easing: Easing.bezier(0.23, 1, 0.32, 1),
              useNativeDriver: Platform.OS !== 'web',
            }).start();
          });
        } else {
          setMangaModalVisible(true);
        }

        loadSourceFilters(src.id);
      }
    }
  }, [
    reopenCatalog,
    catalogQuery,
    catalogRequestId,
    catalogFrom,
    displayGridSources,
    allCatalog,
    loadSourceFilters,
  ]);

  // Let the Discover search sheet know the catalog host is available.
  useEffect(() => {
    setCatalogHostMounted(true);
    return () => setCatalogHostMounted(false);
  }, [setCatalogHostMounted]);

  // Direct open from the Discover search sheet (via the store). The sheet stays
  // mounted underneath, so the catalog slides in over the results and slides
  // away again to reveal them — no tab switch, no intermediate renders.
  useEffect(() => {
    if (!catalogRequest) return;
    if (handledCatalogStoreRequestRef.current === catalogRequest.requestId) return;
    handledCatalogStoreRequestRef.current = catalogRequest.requestId;

    catalogFromStoreRef.current = true;
    catalogOpenedFromSearchRef.current = true;
    catalogSearchQueryRef.current = catalogRequest.query;
    isCatalogClosingRef.current = false;
    isRestoringFromDetailRef.current = false;

    setActiveMangaSource({
      id: catalogRequest.sourceId,
      name: catalogRequest.name,
      domain: catalogRequest.domain,
    });
    setSelectedGenre('');
    setCatalogFilters(null);
    setMangaSearchQuery(catalogRequest.query);
    setDebouncedMangaQuery(catalogRequest.query.trim());
    setIsMangaSearchOpen(catalogRequest.query.trim().length > 0);
    setModalCfUrl('');
    setCatalogSlidesHorizontally(true);
    catalogSlideX.setValue(windowWidth);
    setMangaModalVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(catalogSlideX, {
        toValue: 0,
        duration: 260,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });

    loadSourceFilters(catalogRequest.sourceId);
  }, [catalogRequest, windowWidth, catalogSlideX, loadSourceFilters]);

  const handleCloseCatalogFromSearch = useCallback(() => {
    if (isCatalogClosingRef.current) return;
    isCatalogClosingRef.current = true;

    catalogOpenedFromSearchRef.current = false;
    isViewingMangaFromCatalogRef.current = false;
    isRestoringFromDetailRef.current = false;

    // Pop out to the right like a navigation screen. When the catalog was
    // opened directly from the search sheet (store), the sheet is still
    // mounted underneath and is simply revealed as the catalog slides away.
    Animated.timing(catalogSlideX, {
      toValue: windowWidth,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      isCatalogClosingRef.current = false;
      setMangaModalVisible(false);
      setCatalogSlidesHorizontally(false);

      if (catalogFromStoreRef.current) {
        catalogFromStoreRef.current = false;
        useCatalogStore.getState().clearCatalog();
      } else {
        router.navigate(
          `/(tabs)?searchQuery=${encodeURIComponent(catalogSearchQueryRef.current)}&searchRequestId=${Date.now()}` as any
        );
      }
    });
  }, [router, catalogSlideX, windowWidth]);

  // Handle Android hardware back press when catalog is open
  useEffect(() => {
    if (!mangaModalVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (catalogOpenedFromSearchRef.current) {
        handleCloseCatalogFromSearch();
        return true;
      }
      isViewingMangaFromCatalogRef.current = false;
      isRestoringFromDetailRef.current = false;
      setMangaModalVisible(false);
      return true;
    });
    return () => sub.remove();
  }, [mangaModalVisible, handleCloseCatalogFromSearch]);

  useEffect(() => {
    if (mangaModalVisible) {
      if (isRestoringFromDetailRef.current) {
        // Returned from manga chapter list: keep loaded mangas and position intact!
        isRestoringFromDetailRef.current = false;
        return;
      }
      setModalPage(1);
      loadModalMangas(1, false);
    }
  }, [mangaModalVisible, activeMangaSource, selectedSort, selectedGenre, debouncedMangaQuery, loadModalMangas]);

  const handleOpenMangaModal = useCallback((source: { id: string; name: string; domain?: string }) => {
    triggerHaptic();
    isRestoringFromDetailRef.current = false;
    isViewingMangaFromCatalogRef.current = false;
    catalogOpenedFromSearchRef.current = false;
    isCatalogClosingRef.current = false;
    catalogSlideX.setValue(0);
    setCatalogSlidesHorizontally(false);
    setActiveMangaSource(source);
    setSelectedGenre('');
    setMangaSearchQuery('');
    setDebouncedMangaQuery('');
    setIsMangaSearchOpen(false);
    setModalCfUrl('');
    setMangaModalVisible(true);
    loadSourceFilters(source.id);
  }, [loadSourceFilters]);

  // Floating Action Bar dynamic position calculation based on card location
  const fabCoordinates = useMemo(() => {
    const fabWidth = 112;
    const fabHeight = 42;
    const GAP = 8;

    if (!sourceActionLayout) {
      return {
        top: Math.max(60, windowHeight / 2 - fabHeight / 2),
        left: Math.max(16, windowWidth / 2 - fabWidth / 2),
      };
    }

    const { x, y, width, height, isFirstRow } = sourceActionLayout;

    // 1. Vertical calculation:
    // Bottom rendering applies ONLY on the first row of cards!
    // For all other rows (row 2, row 3, row 4...), the FAB always renders on TOP of the card.
    let top: number;
    if (isFirstRow) {
      top = y + height + GAP;
    } else {
      top = y - fabHeight - GAP;
    }
    top = Math.max(24, Math.min(windowHeight - fabHeight - 24, top));

    // 2. Horizontal calculation:
    // If card is on the left half of the screen, span from card to the RIGHT.
    // If card is on the right half, span from card to the LEFT.
    const cardCenterX = x + width / 2;
    const isLeftHalf = cardCenterX < windowWidth / 2;

    let left: number;
    if (isLeftHalf) {
      left = Math.round(x + (width - 62) / 2);
    } else {
      left = Math.round(x + (width + 62) / 2 - fabWidth);
    }
    left = Math.max(12, Math.min(windowWidth - fabWidth - 12, left));

    return { top, left, isLeftHalf, isFirstRow: !!isFirstRow };
  }, [sourceActionLayout, windowWidth, windowHeight]);

  // Origin-aware directional scaling:
  // - Left-side cards: extends from LEFT TO RIGHT (shrinks RIGHT TO LEFT).
  // - Right-side cards: extends from RIGHT TO LEFT (shrinks LEFT TO RIGHT).
  // - First row cards: extends from TOP TO BOTTOM (shrinks BOTTOM TO TOP).
  // - Other rows cards: extends from BOTTOM TO TOP (shrinks TOP TO BOTTOM).
  const fabTranslateX = useMemo(() => {
    return fabAnimScale.interpolate({
      inputRange: [0, 1],
      outputRange: fabCoordinates.isLeftHalf ? [-56, 0] : [56, 0],
    });
  }, [fabAnimScale, fabCoordinates.isLeftHalf]);

  const fabTranslateY = useMemo(() => {
    return fabAnimScale.interpolate({
      inputRange: [0, 1],
      outputRange: fabCoordinates.isFirstRow ? [-21, 0] : [21, 0],
    });
  }, [fabAnimScale, fabCoordinates.isFirstRow]);

  const handleBrowseCatalogFromFab = useCallback(() => {
    if (!selectedSourceForAction) return;
    const src = selectedSourceForAction;
    dismissFab(() => {
      handleOpenMangaModal(src);
    });
  }, [selectedSourceForAction, dismissFab, handleOpenMangaModal]);

  const handleLoadMoreModalMangas = useCallback(() => {
    if (!isModalLoading && !isModalLoadingMore && hasMoreMangas) {
      const next = modalPage + 1;
      setModalPage(next);
      loadModalMangas(next, true);
    }
  }, [isModalLoading, isModalLoadingMore, hasMoreMangas, modalPage, loadModalMangas]);

  // Width for 3-column cards in Manga Browser Modal
  const modalPadding = 16;
  const modalGap = 10;
  const modalCardWidth = Math.floor(
    (Math.min(windowWidth, 1200) - modalPadding * 2 - modalGap * (columnsMode - 1)) / columnsMode
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[{ flex: 1, width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            IMAGE 1: Main Extensions Page Header: "Manga sources" & "Catalog"
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderLeft}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={() => setDrawerVisible(true)}
                style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
                hitSlop={8}
                aria-label="Open Navigation Menu"
              >
                <Ionicons name="menu" size={24} color={colors.text} />
              </Pressable>
            )}
            <Text style={[styles.mainSectionTitle, { color: colors.text }]}>Manga sources</Text>
          </View>

          {/* Catalog Clickable Button matching Image 1 -> Opens "Sources catalog" */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setSourcesCatalogVisible(true);
            }}
            hitSlop={10}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            aria-label="Open Sources Catalog"
          >
            <Text style={[styles.catalogButtonText, { color: colors.accent }]}>Catalog</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mainScrollContent}>
          {/* 4-Column Grid of Installed Manga Sources matching Image 1 */}
          {displayGridSources.length === 0 ? (
            <View style={styles.emptyGridStateBox}>
              <Ionicons name="apps-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyGridTitle, { color: colors.text }]}>No Sources Installed</Text>
              <Text style={[styles.emptyGridSubtitle, { color: colors.textMuted }]}>
                Browse the Catalog to install manga sources to your extensions.
              </Text>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setSourcesCatalogVisible(true);
                }}
                style={[styles.emptyGridCatalogBtn, { backgroundColor: colors.accent }]}
                aria-label="Open Sources Catalog"
              >
                <Ionicons name="compass-outline" size={18} color={colors.accentForeground} />
                <Text style={[styles.emptyGridCatalogBtnText, { color: colors.accentForeground }]}>Open Catalog</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.fourColumnGrid}>
              {displayGridSources.map((source, index) => {
                const isFirstRow = index < 4;
                return (
                  <SourceGridCell
                    key={source.id}
                    source={source}
                    colors={colors}
                    exploding={explodingId === source.id}
                    isDefault={source.id === defaultSourceId}
                    onPress={() => {
                      if (explodingId) return;
                      handleOpenMangaModal(source);
                    }}
                    onLongPress={(layout) => {
                      if (explodingId) return;
                      handleSourceLongPress(source, layout ? { ...layout, isFirstRow } : undefined);
                    }}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SOURCE CARD ACTION FLOATING ACTION BAR (Pill anchored to Card)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Modal
          visible={sourceActionModalVisible}
          transparent
          animationType="none"
          onRequestClose={() => dismissFab()}
        >
          <View style={styles.fabModalRoot}>
            {/* Transparent backdrop to dismiss when tapping outside with outro shrink */}
            <Pressable
              style={styles.fabModalBackdrop}
              onPress={() => dismissFab()}
              accessibilityLabel="Close action menu"
            />

            {selectedSourceForAction && (
              <Animated.View
                style={[
                  styles.floatingActionBar,
                  {
                    top: fabCoordinates.top,
                    left: fabCoordinates.left,
                    opacity: fabAnimOpacity,
                    transform: [
                      { translateX: fabTranslateX },
                      { translateY: fabTranslateY },
                      { scale: fabAnimScale },
                    ],
                    backgroundColor: isDark ? '#222329' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                    borderWidth: StyleSheet.hairlineWidth * 2,
                    shadowOpacity: isDark ? 0.45 : 0.22,
                  },
                ]}
              >
                {/* 1. Browse Catalog Button */}
                <Pressable
                  onPress={handleBrowseCatalogFromFab}
                  style={({ pressed }) => [
                    styles.fabActionButton,
                    pressed && {
                      opacity: 0.7,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.06)',
                      transform: [{ scale: 0.92 }],
                    },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Browse catalog for ${selectedSourceForAction.name}`}
                >
                  <Ionicons name="book-outline" size={20} color={isDark ? '#F4F4F5' : '#18181B'} />
                </Pressable>

                {/* 2. Set as Primary Discover Source Button */}
                <Pressable
                  onPress={handleSetPrimarySourceFromFab}
                  style={({ pressed }) => [
                    styles.fabActionButton,
                    pressed && {
                      opacity: 0.7,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.06)',
                      transform: [{ scale: 0.92 }],
                    },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Set ${selectedSourceForAction.name} as primary discover source`}
                >
                  <Ionicons
                    name={selectedSourceForAction.id === defaultSourceId ? 'star' : 'star-outline'}
                    size={20}
                    color={selectedSourceForAction.id === defaultSourceId ? '#EAB308' : isDark ? '#F4F4F5' : '#18181B'}
                  />
                </Pressable>

                {/* 3. Remove / Delete Button (-) */}
                <Pressable
                  onPress={handleRemoveSourceFromGrid}
                  style={({ pressed }) => [
                    styles.fabActionButton,
                    pressed && {
                      opacity: 0.7,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.06)',
                      transform: [{ scale: 0.92 }],
                    },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${selectedSourceForAction.name} from extensions`}
                >
                  <Ionicons name="remove-circle-outline" size={22} color={isDark ? '#F4F4F5' : '#18181B'} />
                </Pressable>
              </Animated.View>
            )}
          </View>
        </Modal>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            NEW SCREENSHOT: "Sources catalog" Modal (when "Catalog" is clicked)
            Allows browsing all 1,223 sources and adding/removing with '+'
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Modal
          visible={sourcesCatalogVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setSourcesCatalogVisible(false)}
        >
          <SafeAreaView
            style={[styles.modalContainer, { backgroundColor: colors.background }]}
            edges={['top', 'bottom']}
          >
            {/* Top Bar matching screenshot: ← Sources catalog 🔍 */}
            <View style={[styles.catalogTopBar, { borderBottomColor: colors.border }]}>
              <View style={styles.catalogTopBarLeft}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSourcesCatalogVisible(false);
                  }}
                  hitSlop={12}
                  style={styles.modalBackBtn}
                  aria-label="Back to Manga Sources"
                >
                  <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.catalogScreenTitle, { color: colors.text }]}>Sources catalog</Text>
              </View>

              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setIsCatalogSearchOpen((prev) => !prev);
                }}
                hitSlop={8}
                style={styles.modalActionBtn}
                aria-label="Search Sources"
              >
                <Ionicons
                  name="search-outline"
                  size={22}
                  color={colors.text}
                />
              </Pressable>
            </View>

            {/* In-Catalog Search Bar (when expanded) */}
            {isCatalogSearchOpen && (
              <View style={[styles.catalogSearchBar, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.catalogSearchInput, { color: colors.text }]}
                  placeholder="Search 1,223 sources by name or domain..."
                  placeholderTextColor={colors.textMuted}
                  value={catalogSearchQuery}
                  multiline={false}
                  numberOfLines={1}
                  onChangeText={(text) => setCatalogSearchQuery(text.replace(/[\r\n]+/g, ' '))}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {catalogSearchQuery.length > 0 && (
                  <Pressable onPress={() => setCatalogSearchQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Filter Bar matching screenshot: [ 文A English ▾ ] [ Manga ] [ Hentai ] [ Comics ] */}
            <View style={[styles.catalogFilterRow, { borderBottomColor: colors.border }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catalogFilterScroll}
              >
                {/* Language Dropdown Chip: [ 文A English ▾ ] */}
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setLanguagePickerVisible((prev) => !prev);
                  }}
                  style={[
                    styles.langDropdownChip,
                    {
                      backgroundColor: languagePickerVisible ? colors.surfaceElevated : colors.surface,
                      borderWidth: 0,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Filter catalog by language"
                  accessibilityState={{ expanded: languagePickerVisible }}
                >
                  <Ionicons name="language-outline" size={15} color={colors.text} />
                  <Text style={[styles.langDropdownText, { color: colors.text }]}>
                    {LANGUAGE_NAMES[catalogLanguage] || 'English'}
                  </Text>
                  <Ionicons
                    name={languagePickerVisible ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {/* Content Type Filter Chips: Manga, Hentai, Comics */}
                {CONTENT_TYPES.map((type) => {
                  const isSelected = catalogContentType === type.id;
                  return (
                    <Pressable
                      key={type.id}
                      onPress={() => {
                        triggerHaptic();
                        setCatalogContentType(isSelected ? 'all' : type.id);
                      }}
                      style={[
                        styles.typeFilterChip,
                        {
                          backgroundColor: isSelected ? colors.surfaceElevated : colors.surface,
                          borderWidth: 0,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeFilterText,
                          {
                            color: isSelected ? colors.text : colors.textMuted,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Sources List matching screenshot */}
            <FlatList
              style={{ flex: 1 }}
              data={filteredCatalogSources || []}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              contentContainerStyle={styles.sourcesListContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={25}
              maxToRenderPerBatch={30}
              windowSize={7}
              renderItem={({ item }) => {
                const isInstalled = Array.isArray(installedIds) && installedIds.includes(item.id);
                const typeLabel =
                  item.contentType === 'hentai'
                    ? 'Hentai'
                    : item.contentType === 'comic'
                      ? 'Comics'
                      : 'Manga';
                const langLabel =
                  (item.locale && LANGUAGE_NAMES[item.locale]) ||
                  (item.locale ? item.locale.toUpperCase() : 'EN');
                const firstLetter = item?.title ? item.title.charAt(0).toUpperCase() : '?';

                return (
                  <View style={[styles.sourceRowItem, { borderBottomColor: colors.border }]}>
                    {/* Left: Squircle Icon */}
                    <View style={[styles.sourceListSquircle, { backgroundColor: colors.surface, borderWidth: 0 }]}>
                      <SourceFavicon
                        icon={item.icon}
                        letter={firstLetter}
                        letterColor={colors.textSecondary}
                        imageStyle={styles.sourceListFavicon}
                        textStyle={styles.sourceListMonogram}
                      />
                    </View>

                    {/* Middle: Title & Subtitle */}
                    <Pressable
                      onPress={() => {
                        setSourcesCatalogVisible(false);
                        handleOpenMangaModal({
                          id: item.id,
                          name: item.title,
                          domain: item.domain,
                        });
                      }}
                      style={styles.sourceListInfo}
                      aria-label={`Browse ${item.title}`}
                    >
                      <Text numberOfLines={1} style={[styles.sourceListTitle, { color: colors.text }]}>
                        {item.title}
                      </Text>

                      <View style={styles.sourceListSubtitleRow}>
                        {item.isBroken && (
                          <Ionicons
                            name="volume-mute-outline"
                            size={12}
                            color={colors.textMuted}
                            style={{ marginRight: 2 }}
                          />
                        )}
                        <Text numberOfLines={1} style={[styles.sourceListSubtitle, { color: colors.textMuted }]}>
                          {typeLabel}, {langLabel}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Right: Actions */}
                    <View style={styles.sourceListActionBox}>
                      <Pressable
                        onPress={async () => {
                          triggerHaptic();
                          await SourceManager.setDefaultDiscoverSourceId(item.id);
                          setDefaultSourceId(item.id);
                          if (!isInstalled) {
                            handleToggleInstallSource(item.id);
                          }
                        }}
                        hitSlop={8}
                        style={styles.sourceListGlobeBtn}
                        aria-label={`Set ${item.title} as primary discover source`}
                      >
                        <Ionicons
                          name={item.id === defaultSourceId ? 'star' : 'star-outline'}
                          size={18}
                          color={item.id === defaultSourceId ? '#EAB308' : colors.textSecondary}
                        />
                      </Pressable>

                      <View style={[styles.verticalSeparator, { backgroundColor: colors.border }]} />

                      <Pressable
                        onPress={() => {
                          triggerHaptic();
                          const targetUrl = resolveSourceWebsiteUrl(
                            item.id,
                            item.domain,
                            item.baseUrl,
                            allCatalog
                          );
                          if (Platform.OS === 'web' && typeof window !== 'undefined') {
                            window.open(targetUrl, '_blank', 'noopener,noreferrer');
                          } else {
                            WebBrowser.openBrowserAsync(targetUrl).catch(() =>
                              Linking.openURL(targetUrl).catch(() => { })
                            );
                          }
                        }}
                        hitSlop={8}
                        style={styles.sourceListGlobeBtn}
                        aria-label={`Open ${item.title} website in browser`}
                      >
                        <Ionicons name="globe-outline" size={20} color={colors.textSecondary} />
                      </Pressable>

                      <View style={[styles.verticalSeparator, { backgroundColor: colors.border }]} />

                      <Pressable
                        onPress={() => handleToggleInstallSource(item.id)}
                        hitSlop={12}
                        style={styles.plusActionBtn}
                        aria-label={isInstalled ? `Remove ${item.title}` : `Add ${item.title}`}
                      >
                        {isInstalled ? (
                          <Ionicons name="checkmark" size={24} color={colors.emerald || '#10B981'} />
                        ) : (
                          <Ionicons name="add" size={26} color={colors.textSecondary} />
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyCatalogBox}>
                  <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                  <Text style={[styles.emptyCatalogTitle, { color: colors.text }]}>
                    No Sources Found
                  </Text>
                  <Text style={[styles.emptyCatalogDesc, { color: colors.textMuted }]}>
                    Try changing your search query or language filter.
                  </Text>
                </View>
              }
            />

            {/* Popover Dropdown for Sources Catalog Language */}
            {languagePickerVisible && (
              <Modal
                transparent
                visible={languagePickerVisible}
                animationType="fade"
                onRequestClose={() => setLanguagePickerVisible(false)}
              >
                <Pressable
                  style={styles.popoverBackdropTransparent}
                  onPress={() => setLanguagePickerVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close language dropdown"
                >
                  <View
                    style={[
                      styles.langDropdownPopup,
                      {
                        top: (safeTop > 0 ? safeTop + 52 : (Platform.OS === 'ios' ? 104 : 96)) + (isCatalogSearchOpen ? 48 : 0),
                        left:
                          Platform.OS === 'web' && windowWidth > 1200
                            ? Math.max(16, (windowWidth - 1200) / 2 + 16)
                            : 16,
                        backgroundColor: colors.surfaceElevated || colors.surface,
                        borderWidth: 0,
                      },
                    ]}
                  >
                    <View style={styles.dropdownHeaderLabel}>
                      <Text style={[styles.dropdownSectionTitle, { color: colors.textMuted }]}>
                        FILTER BY LANGUAGE
                      </Text>
                    </View>
                    <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                      {POPULAR_LANGUAGES.map((lang) => {
                        const isSelected = catalogLanguage === lang.id;
                        return (
                          <Pressable
                            key={lang.id}
                            onPress={() => {
                              triggerHaptic();
                              setCatalogLanguage(lang.id);
                              setLanguagePickerVisible(false);
                            }}
                            style={({ pressed }) => [
                              styles.sortDropdownItem,
                              {
                                backgroundColor: isSelected
                                  ? `${colors.accent}18`
                                  : pressed
                                    ? `${colors.text}08`
                                    : 'transparent',
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Filter by ${lang.label}`}
                          >
                            <Text
                              style={[
                                styles.sortDropdownItemText,
                                {
                                  color: isSelected ? colors.accent : colors.text,
                                  fontWeight: isSelected ? '700' : '500',
                                },
                              ]}
                            >
                              {lang.label}
                            </Text>
                            {isSelected && (
                              <Ionicons name="checkmark" size={16} color={colors.accent} />
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                </Pressable>
              </Modal>
            )}
          </SafeAreaView>
        </Modal>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            IMAGE 2: Fullscreen Manga Browser Modal (when clicking any source in grid)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Modal
          visible={mangaModalVisible}
          animationType={catalogSlidesHorizontally ? 'none' : 'slide'}
          transparent={catalogSlidesHorizontally}
          // The sliding catalog already owns its safe-area padding (header
          // `paddingTop: safeTop`, list `paddingBottom: insets.bottom + 24`).
          // On Android the dialog content wrapper is inset by the system bars
          // unless statusBarTranslucent is set (`fitsSystemWindows`), and the
          // window only spans the full screen when navigationBarTranslucent is
          // set — without both, a strip of the search sheet shows through at
          // the bottom of the sliding catalog.
          statusBarTranslucent={catalogSlidesHorizontally}
          navigationBarTranslucent={catalogSlidesHorizontally}
          presentationStyle={catalogSlidesHorizontally ? undefined : 'fullScreen'}
          onRequestClose={() => {
            if (isMangaSearchOpen) {
              setIsMangaSearchOpen(false);
              return;
            }
            if (sortPickerVisible) {
              setSortPickerVisible(false);
              return;
            }
            if (catalogOpenedFromSearchRef.current) {
              handleCloseCatalogFromSearch();
              return;
            }
            isRestoringFromDetailRef.current = false;
            isViewingMangaFromCatalogRef.current = false;
            setMangaModalVisible(false);
          }}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              { backgroundColor: colors.background },
              catalogSlidesHorizontally && {
                transform: [{ translateX: catalogSlideX }],
              },
            ]}
          >
            {/* Curtain Sticky Header in Source Catalog Modal */}
            <Animated.View
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0) setCatalogHeaderHeight(h);
              }}
              style={[
                styles.catalogStickyHeader,
                {
                  backgroundColor: colors.background,
                  borderBottomColor: colors.border,
                  paddingTop: safeTop,
                  transform: [{ translateY: catalogHeaderAnim }],
                  opacity: catalogHeaderOpacity,
                },
              ]}
            >
              {/* Top Navigation Bar: Back Arrow & Right Action Icons */}
              <View style={[styles.modalTopBar, { borderBottomColor: colors.border }]}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    if (catalogOpenedFromSearchRef.current) {
                      handleCloseCatalogFromSearch();
                      return;
                    }
                    isRestoringFromDetailRef.current = false;
                    isViewingMangaFromCatalogRef.current = false;
                    setMangaModalVisible(false);
                  }}
                  hitSlop={12}
                  style={styles.modalBackBtn}
                  aria-label="Back"
                >
                  <Ionicons name="arrow-back" size={28} color={colors.text} />
                </Pressable>

                <View style={styles.modalTopBarRight}>
                  <Pressable
                    onPress={handleOpenActiveSourceWebsite}
                    hitSlop={8}
                    style={styles.modalActionBtn}
                    aria-label={`Open ${activeMangaSource.name} Website in Browser`}
                  >
                    <Ionicons name="globe-outline" size={22} color={colors.text} />
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      triggerHaptic();
                      setIsMangaSearchOpen((prev) => !prev);
                    }}
                    hitSlop={8}
                    style={styles.modalActionBtn}
                    aria-label="Toggle Search"
                  >
                    <Ionicons
                      name="search-outline"
                      size={22}
                      color={colors.text}
                    />
                  </Pressable>

                  <Pressable
                    onPress={handleToggleColumnsMode}
                    hitSlop={8}
                    style={styles.modalActionBtn}
                    aria-label={`Switch between 2 and 3 column layout, currently ${columnsMode} columns`}
                  >
                    <Animated.View
                      style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: [{ scale: gridIconScale }, { rotate: gridIconSpin }],
                      }}
                    >
                      <GridColumnsIcon
                        columns={columnsMode}
                        size={22}
                        color={colors.text}
                      />
                    </Animated.View>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      triggerHaptic();
                      setSortPickerVisible(true);
                    }}
                    hitSlop={8}
                    style={styles.modalActionBtn}
                    aria-label="More Options"
                  >
                    <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
                  </Pressable>
                </View>
              </View>

              {/* In-Modal Search Bar (when expanded) */}
              {isMangaSearchOpen && (
                <View style={[styles.modalSearchBox, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="search" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[styles.modalSearchInput, { color: colors.text }]}
                    placeholder={`Search ${activeMangaSource.name}...`}
                    placeholderTextColor={colors.textMuted}
                    value={mangaSearchQuery}
                    multiline={false}
                    numberOfLines={1}
                    onChangeText={(text) => setMangaSearchQuery(text.replace(/[\r\n]+/g, ' '))}
                    onSubmitEditing={() => setDebouncedMangaQuery(mangaSearchQuery.trim())}
                    returnKeyType="search"
                    autoFocus
                    autoCapitalize="none"
                  />
                  {mangaSearchQuery.length > 0 && (
                    <Pressable
                      onPress={() => {
                        setMangaSearchQuery('');
                        setDebouncedMangaQuery('');
                      }}
                      hitSlop={8}
                      aria-label="Clear Search"
                    >
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              )}

              {/* Title & Filter/Sort Row matching Image 2 */}
              <View style={styles.modalTitleRow}>
                <Text style={[styles.modalSourceTitle, { color: colors.text }]}>
                  {activeMangaSource.name}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {activeMangaSource?.id === 'mangadex' && (
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        setAdvancedSearchVisible(true);
                      }}
                      style={[
                        styles.sortFilterBtn,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderWidth: 0,
                        },
                      ]}
                      aria-label="Open MangaDex Filters Modal"
                    >
                      <Ionicons name="options-outline" size={14} color={colors.accent} />
                      <Text style={[styles.sortFilterText, { color: colors.accent, fontWeight: '600' }]}>
                        Filters
                      </Text>
                    </Pressable>
                  )}

                  {/* Sort Order Selector Button: e.g. "Popular ⏷" */}
                  <Pressable
                    onPress={() => {
                      triggerHaptic();
                      setSortPickerVisible((prev) => !prev);
                    }}
                    style={[
                      styles.sortFilterBtn,
                      {
                        backgroundColor: sortPickerVisible ? colors.surfaceElevated : colors.surface,
                        borderWidth: 0,
                      },
                    ]}
                    aria-label="Change Sort Order"
                  >
                    <Ionicons name="filter-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.sortFilterText, { color: colors.text }]}>
                      {availableSorts.find((s) => s.id === selectedSort)?.label || selectedSort || 'Popular'}
                    </Text>
                    <Ionicons
                      name={sortPickerVisible ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Dynamic Genre / Tag / Category Filter Chips fetched from Source */}
              <View style={styles.genreChipsContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.genreChipsScroll}
                >
                  {availableTags.map((genre) => {
                    const isSelected = selectedGenre === genre.id;
                    return (
                      <Pressable
                        key={genre.id ? `${genre.group || ''}_${genre.id}` : 'all'}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedGenre(isSelected ? '' : genre.id);
                        }}
                        style={[
                          styles.genreChip,
                          {
                            backgroundColor: isSelected ? colors.surfaceElevated : colors.surface,
                            borderWidth: 0,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.genreChipText,
                            {
                              color: isSelected ? colors.text : colors.textMuted,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {genre.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {isLoadingTags && (
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 4 }}>
                      <Skeleton width={52} height={28} borderRadius={8} />
                      <Skeleton width={68} height={28} borderRadius={8} />
                      <Skeleton width={60} height={28} borderRadius={8} />
                    </View>
                  )}
                </ScrollView>
              </View>
            </Animated.View>

            {/* 3-Column Manga Grid matching Image 2 */}
            {isModalLoading ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.mangaGridContent,
                  { paddingTop: catalogHeaderHeight + Spacing.xs },
                ]}
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: modalGap }}>
                  {Array.from({ length: columnsMode * 4 }).map((_, i) => (
                    <View key={i} style={[styles.mangaCardItem, { width: modalCardWidth }]}>
                      <View style={[styles.mangaCoverWrapper, { backgroundColor: colors.surfaceElevated }]}>
                        <Skeleton width="100%" height="100%" borderRadius={8} />
                      </View>
                      <View style={{ marginTop: 4, gap: 4 }}>
                        <Skeleton width="85%" height={12} borderRadius={4} />
                        <Skeleton width="50%" height={10} borderRadius={4} />
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : modalError ? (
              <View style={[styles.modalEmptyBox, { paddingTop: catalogHeaderHeight + 20, paddingHorizontal: 24, paddingVertical: 32 }]}>
                {modalIsCloudflare ? (
                  <View style={{ alignItems: 'center', width: '100%', maxWidth: 320 }}>
                    <Ionicons name="shield-checkmark-outline" size={38} color={colors.accent} style={{ marginBottom: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                      Verification Required
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textSecondary || '#D4D4D8',
                        textAlign: 'center',
                        marginTop: 4,
                        lineHeight: 18,
                        maxWidth: 280,
                      }}
                    >
                      {activeMangaSource.name} needs a quick human check to browse titles.
                    </Text>
                    <Pressable
                      onPress={handleSolveCloudflare}
                      hitSlop={8}
                      style={({ pressed }: any) => [
                        {
                          marginTop: 18,
                          height: 38,
                          paddingHorizontal: 22,
                          borderRadius: Radius.full,
                          backgroundColor: colors.accent,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 0,
                        },
                        pressed && { opacity: 0.8 },
                        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                      ]}
                      accessibilityRole="button"
                      aria-label="Verify with Source"
                    >
                      <Ionicons name="shield-checkmark-outline" size={15} color={colors.accentForeground} style={{ marginRight: 6 }} />
                      <Text style={{ color: colors.accentForeground, fontSize: 13, fontWeight: '700' }}>
                        Verify
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', width: '100%', maxWidth: 320 }}>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 16,
                        backgroundColor: colors.surfaceElevated || colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                      Unable to Load
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
                      {modalError}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
                      <Pressable
                        onPress={() => {
                          triggerHaptic();
                          loadModalMangas(1, false);
                        }}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: Radius.md,
                          backgroundColor: colors.accent,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        aria-label="Retry loading mangas"
                      >
                        <Ionicons name="refresh" size={16} color={colors.accentForeground} style={{ marginRight: 6 }} />
                        <Text style={{ color: colors.accentForeground, fontSize: 13, fontWeight: '700' }}>
                          Retry
                        </Text>
                      </Pressable>

                      {activeMangaSource.domain ? (
                        <Pressable
                          onPress={handleOpenActiveSourceWebsite}
                          style={{
                            flex: 1,
                            height: 44,
                            borderRadius: Radius.md,
                            backgroundColor: colors.surfaceElevated || colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          aria-label="Visit Website"
                        >
                          <Ionicons name="open-outline" size={15} color={colors.text} style={{ marginRight: 6 }} />
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                            Website
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            ) : modalMangas.length === 0 ? (
              <View style={[styles.modalEmptyBox, { paddingTop: catalogHeaderHeight + 20 }]}>
                <Ionicons name="book-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.modalEmptyTitle, { color: colors.text }]}>No Manga Found</Text>
                <Text style={[styles.modalEmptyDesc, { color: colors.textMuted }]}>
                  Try clearing the genre filter or searching for a different title.
                </Text>
              </View>
            ) : (
              <FlatList
                data={modalMangas}
                key={columnsMode}
                numColumns={columnsMode}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                contentContainerStyle={[
                  styles.mangaGridContent,
                  { paddingTop: catalogHeaderHeight + Spacing.xs, paddingBottom: insets.bottom + 24 },
                ]}
                columnWrapperStyle={{ gap: modalGap }}
                showsVerticalScrollIndicator={false}
                onScroll={handleCatalogScroll}
                onScrollBeginDrag={handleCatalogScrollBeginDrag}
                onScrollEndDrag={handleCatalogScrollEndDrag}
                onMomentumScrollEnd={handleCatalogMomentumScrollEnd}
                scrollEventThrottle={16}
                initialNumToRender={18}
                maxToRenderPerBatch={18}
                windowSize={5}
                renderItem={({ item }) => {
                  return (
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        if (catalogOpenedFromSearchRef.current) {
                          // Opened from the Discover search sheet: returning
                          // from the manga should land back on the results
                          // instead of reopening the catalog on the Extensions
                          // tab.
                          catalogOpenedFromSearchRef.current = false;
                          catalogFromStoreRef.current = false;
                          useCatalogStore.getState().clearCatalog();
                          catalogSlideX.setValue(0);
                          setCatalogSlidesHorizontally(false);
                        } else {
                          isRestoringFromDetailRef.current = true;
                          isViewingMangaFromCatalogRef.current = true;
                        }
                        setMangaModalVisible(false);
                        const params = new URLSearchParams();
                        if (activeMangaSource?.id) params.set('fromCatalog', activeMangaSource.id);
                        if (item.coverUrl) params.set('coverUrl', item.coverUrl);
                        if (item.title) params.set('title', item.title);
                        const qs = params.toString() ? `?${params.toString()}` : '';
                        router.push(`/manga/${encodeURIComponent(item.id)}${qs}` as any);
                      }}
                      style={({ pressed }) => [
                        styles.mangaCardItem,
                        {
                          width: modalCardWidth,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                      aria-label={`View ${item.title}`}
                    >
                      {/* Cover Image Container with 2:3 Aspect Ratio */}
                      <View style={[styles.mangaCoverWrapper, { backgroundColor: colors.surfaceElevated }]}>
                        <Skeleton width="100%" height="100%" borderRadius={8} style={StyleSheet.absoluteFill as any} />
                        {item.coverUrl ? (
                          <BridgedImage
                            source={{
                              uri: item.coverUrl,
                              headers:
                                item.coverHeaders ||
                                (item.sourceId === 'hitomila'
                                  ? { Referer: 'https://hitomi.la/' }
                                  : undefined),
                            }}
                            style={styles.mangaCoverImage}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View style={styles.mangaCoverFallback}>
                            <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                          </View>
                        )}

                        {/* Rating overlay badge matching MangaDex format (e.g. ★ 8.4) */}
                        {item.rating && item.rating > 0 ? (
                          <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={10} color={colors.accent} />
                            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Title truncated to 2 lines matching Image 2 (Flag prefix for NHentai only) */}
                      <Text numberOfLines={2} style={[styles.mangaCardTitle, { color: colors.text }]}>
                        {(item.sourceId === 'nhentai' || activeMangaSource?.id === 'nhentai') && item.locale
                          ? `${getLanguageInfo(item.locale).flag} `
                          : ''}
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                }}
                onEndReached={handleLoadMoreModalMangas}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  isModalLoadingMore ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: modalGap, paddingHorizontal: Spacing.md, paddingTop: 12, paddingBottom: 24 }}>
                      {Array.from({ length: columnsMode }).map((_, i) => (
                        <View key={i} style={[styles.mangaCardItem, { width: modalCardWidth }]}>
                          <View style={[styles.mangaCoverWrapper, { backgroundColor: colors.surfaceElevated }]}>
                            <Skeleton width="100%" height="100%" borderRadius={8} />
                          </View>
                          <View style={{ marginTop: 4, gap: 4 }}>
                            <Skeleton width="85%" height={12} borderRadius={4} />
                            <Skeleton width="50%" height={10} borderRadius={4} />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null
                }
              />
            )}

            {/* Popover Dropdown for Sort Filter */}
            {sortPickerVisible && (
              <Modal
                transparent
                visible={sortPickerVisible}
                animationType="fade"
                onRequestClose={() => setSortPickerVisible(false)}
              >
                <Pressable
                  style={styles.popoverBackdrop}
                  onPress={() => setSortPickerVisible(false)}
                >
                  <View
                    style={[
                      styles.sortDropdownPopup,
                      {
                        top: (safeTop > 0 ? safeTop + 52 : (Platform.OS === 'ios' ? 120 : 105)) + (isMangaSearchOpen ? 52 : 0),
                        right:
                          Platform.OS === 'web' && windowWidth > 1200
                            ? Math.max(16, (windowWidth - 1200) / 2 + 16)
                            : 16,
                        backgroundColor: colors.surfaceElevated || colors.surface,
                        borderWidth: 0,
                      },
                    ]}
                  >
                    <View style={styles.dropdownHeaderLabel}>
                      <Text style={[styles.dropdownSectionTitle, { color: colors.textMuted }]}>
                        SORT BY
                      </Text>
                    </View>
                    {availableSorts.map((opt) => {
                      const isSelected = selectedSort === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => {
                            triggerHaptic();
                            setSelectedSort(opt.id);
                            setSortPickerVisible(false);
                          }}
                          style={({ pressed }) => [
                            styles.sortDropdownItem,
                            {
                              backgroundColor: isSelected
                                ? `${colors.accent}18`
                                : pressed
                                  ? `${colors.text}08`
                                  : 'transparent',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.sortDropdownItemText,
                              {
                                color: isSelected ? colors.accent : colors.text,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color={colors.accent} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </Pressable>
              </Modal>
            )}

            {/* In-App Verification Modal */}
            {isCfInAppModalOpen && (
              <Modal
                visible={isCfInAppModalOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsCfInAppModalOpen(false)}
              >
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                  {/* Clean Flat Header - Zero Borders */}
                  <View
                    style={{
                      height: 56,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 16,
                      backgroundColor: colors.surface || colors.background,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          backgroundColor: colors.surfaceElevated || 'rgba(255, 255, 255, 0.08)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.2 }}>
                          Verification
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary || '#D4D4D8', fontWeight: '500' }}>
                          {activeMangaSource.name}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Pressable
                        onPress={() => {
                          triggerHaptic();
                          const domain = modalCfDomain || activeMangaSource.domain || (activeMangaSource.id === 'onisaga' ? 'onisaga.com' : '');
                          if (domain) {
                            webViewBridge.setDomainVerified(domain, true);
                          }
                          setIsCfInAppModalOpen(false);
                          setModalError(null);
                          setModalIsCloudflare(false);
                          loadModalMangas(1, false);
                        }}
                        hitSlop={8}
                        style={({ pressed }: any) => [
                          {
                            paddingHorizontal: 16,
                            height: 34,
                            borderRadius: Radius.full,
                            backgroundColor: colors.accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 4,
                          },
                          pressed && { opacity: 0.8 },
                          Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                        ]}
                        accessibilityRole="button"
                        aria-label="Done Verification"
                      >
                        <Ionicons name="checkmark" size={15} color={colors.accentForeground} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accentForeground }}>
                          Done
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          triggerHaptic();
                          const domain = modalCfDomain || activeMangaSource.domain || (activeMangaSource.id === 'onisaga' ? 'onisaga.com' : '');
                          if (domain) {
                            webViewBridge.setDomainVerified(domain, true);
                          }
                          setIsCfInAppModalOpen(false);
                          setModalError(null);
                          setModalIsCloudflare(false);
                          loadModalMangas(1, false);
                        }}
                        hitSlop={8}
                        style={({ pressed }: any) => [
                          {
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.surfaceElevated || 'rgba(255, 255, 255, 0.08)',
                          },
                          pressed && { opacity: 0.7 },
                          Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                        ]}
                        accessibilityRole="button"
                        aria-label="Close verification modal"
                      >
                        <Ionicons name="close" size={18} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Dark Mode High-Contrast Helper Strip */}
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 9,
                      backgroundColor: colors.surfaceElevated || '#121215',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="information-circle-outline" size={15} color={colors.accent} />
                    <Text style={{ fontSize: 12, color: colors.textSecondary || '#D4D4D8', flex: 1, fontWeight: '500', lineHeight: 16 }}>
                      Complete the check below. Yomite will automatically return once verified, or tap Done.
                    </Text>
                  </View>

                  {/* WebView Body */}
                  {Platform.OS !== 'web' ? (
                    <WebView
                      ref={cfWebViewRef}
                      source={{ uri: cfInAppUrl }}
                      userAgent={
                        Platform.OS === 'android'
                          ? 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
                          : DEFAULT_USER_AGENT
                      }
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      sharedCookiesEnabled={true}
                      thirdPartyCookiesEnabled={true}
                      style={{ flex: 1, backgroundColor: colors.background }}
                      onLoadEnd={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        const url = nativeEvent.url || '';
                        const title = (nativeEvent.title || '').toLowerCase();
                        const isCfTitle =
                          title.includes('just a moment') ||
                          title.includes('attention required') ||
                          title.includes('security check') ||
                          title.includes('checking your browser') ||
                          title.includes('verify you are human') ||
                          title.includes('cloudflare');
                        const isCfHost =
                          url.includes('challenges.cloudflare.com') ||
                          url.includes('/cdn-cgi/challenge-platform/');

                        const targetDomain = modalCfDomain || activeMangaSource.domain || (activeMangaSource.id === 'onisaga' ? 'onisaga.com' : '');
                        const isTargetDomain = targetDomain && url.includes(targetDomain);

                        if (isTargetDomain && !isCfTitle && !isCfHost) {
                          cfWebViewRef.current?.injectJavaScript(
                            '(function() { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: "CF_SOLVED", cookie: document.cookie || "", url: window.location.href })); })(); true;'
                          );
                        }
                      }}
                      injectedJavaScript={`
                        (function() {
                          var interval = setInterval(function() {
                            try {
                              var href = window.location.href || '';
                              var title = (document.title || '').toLowerCase();
                              var isChallenge = title.includes('just a moment') ||
                                                title.includes('turnstile') ||
                                                title.includes('security check') ||
                                                title.includes('attention required') ||
                                                href.includes('challenges.cloudflare.com') ||
                                                document.querySelector('#challenge-running') ||
                                                document.querySelector('.cf-turnstile') ||
                                                document.querySelector('#challenge-stage') ||
                                                document.querySelector('#cf-wrapper') ||
                                                document.querySelector('iframe[src*="cloudflare"]') ||
                                                document.querySelector('iframe[src*="turnstile"]');

                              if (isChallenge) {
                                return;
                              }

                              var cookie = document.cookie || '';

                              // 1. Check for JSON API Response (MangaDot, REST endpoints)
                              var rawPre = document.querySelector('pre');
                              var rawText = (rawPre ? rawPre.innerText : '') || (document.body ? document.body.innerText : '') || '';
                              rawText = rawText.trim();

                              if (rawText.startsWith('{') || rawText.startsWith('[')) {
                                try {
                                  var jsonData = JSON.parse(rawText);
                                  var list = jsonData.manga_list || jsonData.data || jsonData.results || jsonData.items || (Array.isArray(jsonData) ? jsonData : null);
                                  if (Array.isArray(list)) {
                                    var jsonCards = [];
                                    var seenIds = {};
                                    for (var k = 0; k < list.length; k++) {
                                      var it = list[k];
                                      var id = it.id != null ? String(it.id) : (it.slug || '');
                                      var t = (it.title || it.name || 'Untitled').trim();
                                      var p = it.photo || it.cover || it.thumbnail || it.image || '';
                                      var h = id ? ('/manga/' + id) : '';
                                      if (h && t && !seenIds[h]) {
                                        seenIds[h] = true;
                                        jsonCards.push({ href: h, title: t, cover: p });
                                      }
                                    }
                                    clearInterval(interval);
                                    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                                      type: 'CF_SOLVED',
                                      cookie: cookie,
                                      cards: jsonCards,
                                      url: href,
                                      isJson: true
                                    }));
                                    return;
                                  }
                                } catch (jsonErr) {}
                              }

                              // 2. Check for HTML Cards
                              var cards = [];
                              var seen = {};
                              var items = document.querySelectorAll(
                                '.search-story-item, .item, .content-genres-item, .list-truyen-item-wrap, .panel-story-chapter-list, .story-info-right, .manga-card, article'
                              );
                              for (var i = 0; i < items.length; i++) {
                                var el = items[i];
                                var a = el.querySelector('h3 a, a.genres-item-name, a.item-title, .story-name a, a[href*="/manga/"], a[href*="/series/"]') || el.querySelector('a');
                                if (!a) continue;
                                var cardHref = a.getAttribute('href') || '';
                                var cardTitle = (a.getAttribute('title') || a.textContent || '').trim();
                                if (!cardHref || cardHref.includes('/chapter-') || cardHref.includes('/chapter/') || seen[cardHref]) continue;
                                seen[cardHref] = true;
                                var img = el.querySelector('img');
                                var cardCover = img ? (img.getAttribute('data-src') || img.getAttribute('src') || '') : '';
                                cards.push({ href: cardHref, title: cardTitle, cover: cardCover });
                              }

                              if (cards.length === 0) {
                                var links = document.querySelectorAll('a[href*="/manga/"], a[href*="/series/"]');
                                for (var j = 0; j < links.length; j++) {
                                  var lk = links[j];
                                  var lkHref = lk.getAttribute('href') || '';
                                  if (!lkHref || lkHref.includes('/chapter-') || lkHref.includes('/chapter/') || lkHref.includes('/manga-list/') || seen[lkHref]) continue;
                                  var lkTitle = (lk.getAttribute('title') || lk.textContent || '').trim();
                                  if (!lkTitle) continue;
                                  seen[lkHref] = true;
                                  var lkImg = lk.querySelector('img') || (lk.parentNode ? lk.parentNode.querySelector('img') : null);
                                  var lkCover = lkImg ? (lkImg.getAttribute('data-src') || lkImg.getAttribute('src') || '') : '';
                                  cards.push({ href: lkHref, title: lkTitle, cover: lkCover });
                                }
                              }

                              var isNoResults = document.body && (
                                document.body.innerText.includes('No matches found') ||
                                document.body.innerText.includes('No results found') ||
                                document.body.innerText.includes('Cannot find') ||
                                !!document.querySelector('.no-result, .search-no-result, .panel-no-content')
                              );

                              var isFinished = document.readyState === 'complete' && !isChallenge;

                              if (cards.length > 0 || isNoResults || isFinished) {
                                clearInterval(interval);
                                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                                  type: 'CF_SOLVED',
                                  cookie: cookie,
                                  cards: cards,
                                  url: href,
                                  isNoResults: isNoResults && cards.length === 0
                                }));
                              }
                            } catch (e) {}
                          }, 1000);
                        })();
                        true;
                      `}
                      onMessage={async (event) => {
                        try {
                          const parsed = JSON.parse(event.nativeEvent.data);
                          if (webViewBridge.handleMessage(parsed)) {
                            return;
                          }

                          if (parsed.type === 'CF_SOLVED') {
                            const domain = modalCfDomain || activeMangaSource.domain;
                            if (domain) {
                              webViewBridge.setDomainVerified(domain, true);
                              setPersistentBridgeUrl(`https://${domain}/`);
                              if (persistentBridgeRef.current) {
                                persistentBridgeRef.current.reload();
                              }
                              if (parsed.cookie) {
                                const match = parsed.cookie.match(/cf_clearance=([^;]+)/);
                                if (match) {
                                  await CloudFlareCookieManager.setCookie(domain, match[0]);
                                }
                              }
                            }

                            if (parsed.isJson && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
                              const mappedCards: CatalogMangaItem[] = parsed.cards.map((c: any) => {
                                const rawHref = c.href || '';
                                const absHref = rawHref.startsWith('http')
                                  ? rawHref
                                  : `https://${domain}/${rawHref.replace(/^\/+/, '')}`;
                                const cover = c.cover
                                  ? c.cover.startsWith('http')
                                    ? c.cover
                                    : `https://${domain}/${c.cover.replace(/^\/+/, '')}`
                                  : null;
                                const slugMatch = absHref.match(/\/manga\/([^/?#]+)/);
                                const cardId = slugMatch
                                  ? `${activeMangaSource.id}:${slugMatch[1]}`
                                  : `${activeMangaSource.id}:${absHref}`;

                                return {
                                  id: cardId,
                                  title: c.title,
                                  coverUrl: cover,
                                  coverHeaders: {
                                    Referer: `https://${domain}/`,
                                    'User-Agent': DEFAULT_USER_AGENT,
                                  },
                                  sourceId: activeMangaSource.id,
                                  locale: 'en',
                                };
                              });
                              let finalCards = mappedCards;
                              if (activeMangaSource.id === 'mangadot' && debouncedMangaQuery.trim()) {
                                const q = debouncedMangaQuery.trim();
                                finalCards = mappedCards
                                  .map((c) => ({ card: c, score: computeTitleMatchScore(c.title, q) }))
                                  .filter((item) => item.score > 0)
                                  .sort((a, b) => b.score - a.score)
                                  .map((item) => item.card);
                              }
                              setModalMangas(finalCards);
                              setIsCfInAppModalOpen(false);
                              setModalError(null);
                              setModalIsCloudflare(false);
                            } else {
                              setIsCfInAppModalOpen(false);
                              setModalError(null);
                              setModalIsCloudflare(false);
                              loadModalMangas(1, false);
                            }
                          }
                        } catch { }
                      }}
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                      <Text style={{ color: colors.text, fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
                        Verification opened in a new tab. When finished, click Done.
                      </Text>
                      <Pressable
                        onPress={() => {
                          const domain = modalCfDomain || activeMangaSource.domain;
                          if (domain) {
                            webViewBridge.setDomainVerified(domain, true);
                          }
                          setIsCfInAppModalOpen(false);
                          setModalError(null);
                          setModalIsCloudflare(false);
                          loadModalMangas(1, false);
                        }}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                          borderRadius: Radius.md,
                          backgroundColor: colors.accent,
                        }}
                      >
                        <Text style={{ color: colors.accentForeground, fontWeight: '700' }}>Done</Text>
                      </Pressable>
                    </View>
                  )}
                </SafeAreaView>
              </Modal>
            )}
          </Animated.View>
        </Modal>

        {/* Navigation Drawer */}
        <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

        {/* MangaDex advanced filters (catalog only) */}
        <AdvancedSearchModal
          visible={advancedSearchVisible}
          onClose={() => setAdvancedSearchVisible(false)}
          onApplyFilters={(filters) => {
            setAdvancedSearchVisible(false);
            setCatalogFilters(filters);
            loadModalMangas(1, false, filters);
          }}
        />

        {/* Persistent Background Cloudflare & Network Bridge */}
        {Platform.OS !== 'web' && (
          <View
            style={{
              position: 'absolute',
              top: -9999,
              left: -9999,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: 'none',
            }}
          >
            <WebView
              ref={persistentBridgeRef}
              source={{ uri: persistentBridgeUrl }}
              userAgent={
                Platform.OS === 'android'
                  ? 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
                  : DEFAULT_USER_AGENT
              }
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              onMessage={(event) => {
                try {
                  const parsed = JSON.parse(event.nativeEvent.data);
                  webViewBridge.handleMessage(parsed);
                } catch { }
              }}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webCenteredContent: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  // Top Header matching Image 1: "Manga sources" & "Catalog"
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mainSectionTitle: {
    fontSize: 20,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.2,
  },
  catalogButtonText: {
    fontSize: 15,
    fontWeight: Typography.weights.semibold,
  },
  plainIconButton: {
    padding: 4,
  },
  mainScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },
  // Flat 4-Column Grid matching clean design
  fourColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 24,
    columnGap: 8,
    marginTop: Spacing.sm,
  },
  sourceGridCell: {
    width: '22%',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer' as any,
  },
  squircleContainer: {
    width: 62,
    height: 62,
    borderRadius: 16,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryBadgeContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  sourceGridFavicon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  explosionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explosionFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  explosionRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
  },
  serifB: {
    fontSize: 30,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  unicornBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webtoonBadge: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webtoonText: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 13,
  },
  mangadexCatBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catUnderline: {
    width: 20,
    height: 3,
    backgroundColor: '#FF6740',
    borderRadius: 2,
    marginTop: 2,
  },
  mangaPlusBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mangaPlusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: -0.5,
  },
  mangaPlusSign: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    marginTop: -4,
  },
  monogramLetter: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sourceGridTitle: {
    fontSize: 12,
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
    width: '100%',
    letterSpacing: -0.2,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NEW SCREENSHOT: Sources Catalog Modal Styles
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  catalogTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catalogTopBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  catalogScreenTitle: {
    fontSize: 20,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.2,
  },
  catalogSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    height: 40,
    maxHeight: 40,
    borderRadius: Radius.md,
    borderWidth: 0,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  catalogSearchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  catalogFilterRow: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catalogFilterScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  langDropdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 0,
  },
  langDropdownText: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
  },
  typeFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 0,
  },
  typeFilterText: {
    fontSize: 13,
  },
  sourcesListContent: {
    paddingBottom: 60,
  },
  sourceRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sourceListSquircle: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sourceListFavicon: {
    width: 28,
    height: 28,
  },
  sourceListMonogram: {
    fontSize: 20,
    fontWeight: '700',
  },
  sourceListInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    gap: 3,
  },
  sourceListTitle: {
    fontSize: 15,
    fontWeight: Typography.weights.semibold,
  },
  sourceListSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceListSubtitle: {
    fontSize: 12,
  },
  sourceListActionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceListGlobeBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalSeparator: {
    width: 1,
    height: 28,
    marginRight: 4,
  },
  plusActionBtn: {
    padding: 6,
  },
  emptyCatalogBox: {
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
  },
  emptyCatalogTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.xs,
  },
  emptyCatalogDesc: {
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
  },
  langOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: 4,
  },
  langOptionText: {
    fontSize: 14,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IMAGE 2: Manga Browser Modal Styles
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  modalContainer: {
    flex: 1,
    position: 'relative',
  },
  catalogStickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBackBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTopBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modalActionBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    height: 40,
    maxHeight: 40,
    borderRadius: Radius.md,
    borderWidth: 0,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  modalSourceTitle: {
    fontSize: 26,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.3,
  },
  sortFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  sortFilterText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  genreChipsContainer: {
    paddingVertical: Spacing.xs,
  },
  genreChipsScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  genreChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 0,
  },
  genreChipText: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
  },
  mangaGridContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: 60,
    gap: 14,
  },
  mangaCardItem: {
    gap: 4,
  },
  mangaCoverWrapper: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 0,
  },
  mangaCoverImage: {
    width: '100%',
    height: '100%',
  },
  mangaCoverFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    paddingHorizontal: Platform.OS === 'web' ? 8 : 6,
    paddingVertical: Platform.OS === 'web' ? 3 : 2,
    borderRadius: Radius.xs,
  },
  ratingText: {
    color: '#FAFAFA',
    fontSize: Platform.OS === 'web' ? 11 : 10,
    fontWeight: Typography.weights.bold,
  },
  mangaCardTitle: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
    lineHeight: 16,
    marginTop: 2,
  },
  modalLoadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingBottom: 60,
  },
  modalEmptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 60,
  },
  modalEmptyTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.xs,
  },
  modalEmptyDesc: {
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalFooterLoader: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  sortOptionsList: {
    gap: 6,
    marginTop: 4,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  sortOptionLabel: {
    fontSize: 14,
  },
  modalRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  modalRetryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
  },
  modalVisitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 0,
  },
  modalVisitBtnText: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Empty Grid State Styles
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  emptyGridStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyGridTitle: {
    fontSize: 18,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.xs,
  },
  emptyGridSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyGridCatalogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full,
    marginTop: Spacing.md,
  },
  emptyGridCatalogBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: Typography.weights.semibold,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Floating Action Bar (Anchored Pill Popover)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fabModalRoot: {
    flex: 1,
    position: 'relative',
  },
  fabModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  floatingActionBar: {
    position: 'absolute',
    width: 112,
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 99999,
  },
  fabActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Popover Dropdown for Catalog Filters (Sort & Language)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  popoverBackdropTransparent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  langDropdownPopup: {
    position: 'absolute',
    width: 200,
    borderRadius: Radius.lg,
    borderWidth: 0,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 16,
  },
  sortDropdownPopup: {
    position: 'absolute',
    width: 190,
    borderRadius: Radius.lg,
    borderWidth: 0,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 16,
  },
  dropdownHeaderLabel: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
    marginBottom: 4,
  },
  dropdownSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sortDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    marginVertical: 1,
    borderRadius: Radius.sm,
  },
  sortDropdownItemText: {
    fontSize: 13,
  },
});
