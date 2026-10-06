import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  FlatList,
  Modal,
  Linking,
  useWindowDimensions,
  BackHandler,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { SourceManager } from '../../src/sources/SourceManager';
import { CatalogSourceItem } from '../../src/sources/types';
import { CloudFlareCookieManager } from '../../src/sources/network/cloudflare';
import { triggerHaptic } from '../../src/utils/haptics';
import {
  getPopularManga,
  searchManga,
  getCoverUrl,
  extractCoverFileName,
  getMangaTitle,
  getBatchMangaStatistics,
} from '../../src/api/mangadex';
import type { Manga, SearchFilters } from '../../src/types';

const STORAGE_KEY_INSTALLED_SOURCES = '@mangaapp_installed_sources_v2';

// Initial default sources displayed in the 4-column grid (Image 1)
const DEFAULT_INSTALLED_IDS = [
  'comix-to',
  'reimanga',
  'comick-fun',
  'mangadex',
  'mangapill',
  'asurascans',
  'linewebtoon',
  'mangafire',
  'mangaplus',
  'mangareader',
  'myreadingmanga',
  'ninemanga',
  'webtoons',
  'batoto',
];

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
    domain: 'comick.io',
    icon: 'https://www.google.com/s2/favicons?domain=comick.io&sz=64',
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
  mangafire: {
    id: 'mangafire',
    name: 'MangaFire',
    displayName: 'MangaFi...',
    domain: 'mangafire.to',
    icon: 'https://www.google.com/s2/favicons?domain=mangafire.to&sz=64',
    iconType: 'mangafire',
    letterColor: '#38BDF8',
    bgColor: '#0F172A',
  },
  mangapill: {
    id: 'mangapill',
    name: 'MangaPill',
    displayName: 'MangaP...',
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
    displayName: 'VortexS...',
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
    displayName: 'Hitomi.La',
    domain: 'hitomi.la',
    icon: 'https://www.google.com/s2/favicons?domain=hitomi.la&sz=64',
    iconType: 'custom',
    letter: 'H',
    letterColor: '#E11D48',
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

const GENRE_CHIPS = [
  { label: 'All', id: '' },
  { label: 'Romance', id: '423e2eae-a7a2-4a8b-ac03-a8351462d71d' },
  { label: 'Comedy', id: '4d32cc48-9f00-4cca-9b5a-a839f0764984' },
  { label: 'Drama', id: 'b9af3a63-f058-424f-a1f0-a1f50431538c' },
  { label: 'Fantasy', id: 'cdc58593-87dd-4cc7-bbc0-2ec27bf404cc' },
  { label: 'Action', id: '391b0423-d847-456f-aff0-8b0cfc03066b' },
  { label: 'Adventure', id: '87cc87cd-a395-47af-b27a-93258283bbc6' },
  { label: 'Horror', id: 'cdad7e68-07dd-4270-a3ee-6344d6ee4321' },
  { label: 'Sci-Fi', id: '256325d6-3d75-43c4-973c-ecd34df48668' },
  { label: 'Mystery', id: 'ee9634b1-638e-4da0-a125-667adc0b4b24' },
];

const SORT_OPTIONS: { id: 'popular' | 'latest' | 'newest' | 'rating' | 'alphabetical'; label: string }[] = [
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
  ratingPercent?: number | null;
  sourceId: string;
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
  if (sourceId === 'comix-to' || sourceId === 'comixto') return 'https://comix.to';
  if (sourceId === 'asurascans' || sourceId === 'asuracomic') return 'https://asuracomic.net';
  if (sourceId === 'mangapill') return 'https://mangapill.com';
  if (sourceId === 'comick-fun' || sourceId === 'comick') return 'https://comick.io';
  if (sourceId === 'manganato') return 'https://manganato.com';
  if (sourceId === 'mangakakalot') return 'https://mangakakalot.com';
  if (sourceId === 'manhuafast') return 'https://manhuafast.com';
  if (sourceId === 'topmanhua') return 'https://topmanhua.com';
  if (sourceId === 'linewebtoon' || sourceId === 'webtoons') return 'https://www.webtoons.com';
  if (sourceId === 'nhentai') return 'https://nhentai.net';
  if (sourceId === 'omegascans') return 'https://omegascans.org';
  if (sourceId === 'vortexscans') return 'https://vortexscans.org';
  if (sourceId === 'hitomila') return 'https://hitomi.la';
  if (sourceId === 'batoto') return 'https://bato.to';

  return `https://${sourceId}.com`;
}

export default function ExtensionsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const { reopenCatalog } = useLocalSearchParams<{ reopenCatalog?: string }>();

  // State preservation when navigating to manga details and returning
  const isViewingMangaFromCatalogRef = useRef(false);
  const isRestoringFromDetailRef = useRef(false);
  const isSolvingCloudflareRef = useRef(false);

  const [drawerVisible, setDrawerVisible] = useState(false);

  // Installed Sources on the 4-column grid (Image 1)
  const [installedIds, setInstalledIds] = useState<string[]>(DEFAULT_INSTALLED_IDS);

  // Source Card Action Menu state (Long Press on Grid Card)
  const [sourceActionModalVisible, setSourceActionModalVisible] = useState(false);
  const [selectedSourceForAction, setSelectedSourceForAction] = useState<{
    id: string;
    name: string;
    domain?: string;
    icon?: string;
    displayName?: string;
  } | null>(null);

  // Sources Catalog Modal state (New Screenshot)
  const [sourcesCatalogVisible, setSourcesCatalogVisible] = useState(false);
  const [catalogLanguage, setCatalogLanguage] = useState<string>('en');
  const [catalogContentType, setCatalogContentType] = useState<string>('all');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [isCatalogSearchOpen, setIsCatalogSearchOpen] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  // Manga Browser Modal state (Image 2)
  const [mangaModalVisible, setMangaModalVisible] = useState(false);
  const [activeMangaSource, setActiveMangaSource] = useState<{ id: string; name: string; domain?: string }>({
    id: 'mangadex',
    name: 'MangaDex',
    domain: 'mangadex.org',
  });
  const [selectedSort, setSelectedSort] = useState<'popular' | 'latest' | 'newest' | 'rating' | 'alphabetical'>('popular');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [isMangaSearchOpen, setIsMangaSearchOpen] = useState(false);
  const [mangaSearchQuery, setMangaSearchQuery] = useState('');
  const [debouncedMangaQuery, setDebouncedMangaQuery] = useState('');
  const [sortPickerVisible, setSortPickerVisible] = useState(false);
  const [columnsMode, setColumnsMode] = useState<2 | 3>(3);

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
  const [isCfCookieModalOpen, setIsCfCookieModalOpen] = useState(false);
  const [cfCookieInput, setCfCookieInput] = useState('');
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isModalLoadingMore, setIsModalLoadingMore] = useState(false);
  const [modalPage, setModalPage] = useState(1);
  const [hasMoreMangas, setHasMoreMangas] = useState(true);

  // Load installed sources from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        await SourceManager.init();
        const stored = await AsyncStorage.getItem(STORAGE_KEY_INSTALLED_SOURCES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInstalledIds(parsed);
          }
        }
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
        AsyncStorage.setItem(STORAGE_KEY_INSTALLED_SOURCES, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    },
    []
  );

  const handleSourceLongPress = useCallback(
    (source: {
      id: string;
      name: string;
      domain?: string;
      icon?: string;
      displayName?: string;
    }) => {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedSourceForAction(source);
      setSourceActionModalVisible(true);
    },
    []
  );

  const handleRemoveSourceFromGrid = useCallback(async () => {
    if (!selectedSourceForAction) return;
    const sourceId = selectedSourceForAction.id;
    triggerHaptic();
    setInstalledIds((prev) => {
      const updated = prev.filter((id) => id !== sourceId);
      SourceManager.setSourceEnabled(sourceId, false);
      AsyncStorage.setItem(STORAGE_KEY_INSTALLED_SOURCES, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    setSourceActionModalVisible(false);
    setSelectedSourceForAction(null);
  }, [selectedSourceForAction]);

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
    async (pageToLoad: number, append = false) => {
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

          if (debouncedMangaQuery.trim() || selectedGenre) {
            const searchRes = await searchManga(
              {
                title: debouncedMangaQuery.trim() || undefined,
                includedTags: selectedGenre ? [selectedGenre] : undefined,
                orders,
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
            const ratingPercent = ratingVal ? Math.round(ratingVal * 10) : null;

            return {
              id: m.id,
              title: getMangaTitle(m),
              coverUrl,
              ratingPercent,
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
                (parser!.metadata.id === 'hitomila' ? { Referer: 'https://hitomi.la/' } : undefined),
              ratingPercent: m.rating ? Math.round(m.rating > 10 ? m.rating : m.rating * 10) : null,
              sourceId: parser!.metadata.id,
            }));

            setModalMangas((prev) => (append ? [...prev, ...mapped] : mapped));
            setHasMoreMangas(list.length >= 15);
          } else {
            if (!append) setModalMangas([]);
            setHasMoreMangas(false);
          }
        }
      } catch (err: any) {
        console.error('Error loading modal mangas:', err);
        const isCf =
          err.isCloudFlare ||
          (typeof err.message === 'string' &&
            (err.message.toLowerCase().includes('cloudflare') ||
              err.message.toLowerCase().includes('challenge') ||
              err.message.toLowerCase().includes('turnstile')));
        const cfDomain =
          err.domain ||
          activeMangaSource.domain ||
          (activeMangaSource.id === 'comix-to' ? 'comix.to' : '') ||
          (activeMangaSource.id === 'reimanga' ? 'reimanga.net' : '');
        setModalIsCloudflare(!!isCf);
        setModalCfDomain(cfDomain);

        const errMsg = isCf
          ? `${activeMangaSource.name} is protected by Cloudflare Turnstile anti-bot verification. Open in browser to complete verification, or paste your clearance cookie.`
          : err.response?.status === 404
          ? 'Source catalog page returned 404 Not Found. The layout or API path may have changed.'
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
    [activeMangaSource, selectedSort, selectedGenre, debouncedMangaQuery, allCatalog]
  );

  const handleOpenActiveSourceWebsite = useCallback(async () => {
    triggerHaptic();
    const targetUrl = resolveSourceWebsiteUrl(
      activeMangaSource.id,
      modalCfDomain || activeMangaSource.domain,
      undefined,
      allCatalog
    );

    if (modalIsCloudflare) {
      isSolvingCloudflareRef.current = true;
    }

    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          if (modalIsCloudflare) {
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
          }
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        await WebBrowser.openBrowserAsync(targetUrl);
        // Triggers when in-app browser is dismissed/closed on mobile
        if (modalIsCloudflare && isSolvingCloudflareRef.current) {
          isSolvingCloudflareRef.current = false;
          setModalError(null);
          setModalIsCloudflare(false);
          loadModalMangas(1, false);
        }
      }
    } catch {
      Linking.openURL(targetUrl).catch(() => {});
    }
  }, [activeMangaSource, modalCfDomain, modalIsCloudflare, allCatalog, loadModalMangas]);

  const handleSolveCloudflare = handleOpenActiveSourceWebsite;

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

  const handleOpenCookieModal = useCallback(() => {
    triggerHaptic();
    const domain = modalCfDomain || activeMangaSource.domain || 'comix.to';
    const existing = CloudFlareCookieManager.getCookie(domain) || '';
    setCfCookieInput(existing);
    setIsCfCookieModalOpen(true);
  }, [modalCfDomain, activeMangaSource]);

  const handleSaveCookie = useCallback(async () => {
    triggerHaptic();
    const domain = modalCfDomain || activeMangaSource.domain || 'comix.to';
    await CloudFlareCookieManager.setCookie(domain, cfCookieInput.trim());
    setIsCfCookieModalOpen(false);
    loadModalMangas(1, false);
  }, [modalCfDomain, activeMangaSource, cfCookieInput, loadModalMangas]);

  // Auto-restore source catalog when returning back from manga details / chapter list
  useFocusEffect(
    useCallback(() => {
      if (isViewingMangaFromCatalogRef.current) {
        isViewingMangaFromCatalogRef.current = false;
        setMangaModalVisible(true);
      }
    }, [])
  );

  // Restore catalog from deep link or browser refresh with reopenCatalog parameter
  useEffect(() => {
    if (reopenCatalog) {
      const src =
        displayGridSources.find((s) => s.id === reopenCatalog) ||
        allCatalog.find((c) => c.id === reopenCatalog);
      if (src) {
        isRestoringFromDetailRef.current = true;
        setActiveMangaSource({
          id: src.id,
          name: src.name || (src as any).title,
          domain: (src as any).domain,
        });
        setMangaModalVisible(true);
      }
    }
  }, [reopenCatalog, displayGridSources, allCatalog]);

  // Handle Android hardware back press when catalog is open
  useEffect(() => {
    if (!mangaModalVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      isViewingMangaFromCatalogRef.current = false;
      isRestoringFromDetailRef.current = false;
      setMangaModalVisible(false);
      return true;
    });
    return () => sub.remove();
  }, [mangaModalVisible]);

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
    setActiveMangaSource(source);
    setSelectedGenre('');
    setMangaSearchQuery('');
    setDebouncedMangaQuery('');
    setIsMangaSearchOpen(false);
    setMangaModalVisible(true);
  }, []);

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
                <Ionicons name="compass-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyGridCatalogBtnText}>Open Catalog</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.fourColumnGrid}>
              {displayGridSources.map((source) => {
                return (
                  <Pressable
                    key={source.id}
                    onPress={() => handleOpenMangaModal(source)}
                    onLongPress={() => handleSourceLongPress(source)}
                    delayLongPress={350}
                    {...{
                      onContextMenu: (e: any) => {
                        e?.preventDefault?.();
                        handleSourceLongPress(source);
                      },
                    }}
                    style={({ pressed }) => [
                      styles.sourceGridCell,
                      { transform: [{ scale: pressed ? 0.95 : 1 }] },
                    ]}
                    aria-label={`Open ${source.name} series. Hold to manage.`}
                  >
                    {/* Squircle App Icon Container */}
                    <View
                      style={[
                        styles.squircleContainer,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {source.icon ? (
                        <Image
                          source={{ uri: source.icon }}
                          style={styles.sourceGridFavicon}
                          contentFit="contain"
                          transition={150}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.monogramLetter,
                            { color: source.letterColor || colors.accent },
                          ]}
                        >
                          {source.letter || source.name.charAt(0)}
                        </Text>
                      )}
                    </View>

                    {/* Truncated Name matching Image 1 */}
                    <Text numberOfLines={1} style={[styles.sourceGridTitle, { color: colors.text }]}>
                      {source.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SOURCE CARD ACTION MENU MODAL (Triggered on Card Long Press)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Modal
          visible={sourceActionModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSourceActionModalVisible(false)}
        >
          <View style={styles.actionModalOverlay}>
            <Pressable
              style={styles.actionModalBackdrop}
              onPress={() => setSourceActionModalVisible(false)}
            />
            <View
              style={[
                styles.actionModalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Header: Icon + Title + Domain */}
              {selectedSourceForAction && (
                <View style={styles.actionModalHeader}>
                  <View
                    style={[
                      styles.actionModalIconBox,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {selectedSourceForAction.icon ? (
                      <Image
                        source={{ uri: selectedSourceForAction.icon }}
                        style={styles.actionModalFavicon}
                        contentFit="contain"
                      />
                    ) : (
                      <Text
                        style={[
                          styles.actionModalMonogram,
                          { color: colors.accent },
                        ]}
                      >
                        {selectedSourceForAction.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.actionModalTitle, { color: colors.text }]}>
                      {selectedSourceForAction.name}
                    </Text>
                    {selectedSourceForAction.domain ? (
                      <Text style={[styles.actionModalDomain, { color: colors.textMuted }]}>
                        {selectedSourceForAction.domain}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              <View style={[styles.actionModalDivider, { backgroundColor: colors.border }]} />

              {/* Action 1: Browse Manga */}
              <Pressable
                onPress={() => {
                  if (!selectedSourceForAction) return;
                  const src = selectedSourceForAction;
                  setSourceActionModalVisible(false);
                  handleOpenMangaModal(src);
                }}
                style={({ pressed }) => [
                  styles.actionModalRow,
                  { backgroundColor: pressed ? `${colors.text}08` : 'transparent' },
                ]}
              >
                <Ionicons name="book-outline" size={20} color={colors.text} />
                <Text style={[styles.actionModalRowText, { color: colors.text }]}>
                  Browse Catalog
                </Text>
              </Pressable>

              {/* Action 2: Visit Website */}
              {selectedSourceForAction && (
                <Pressable
                  onPress={() => {
                    if (!selectedSourceForAction) return;
                    const url = resolveSourceWebsiteUrl(
                      selectedSourceForAction.id,
                      selectedSourceForAction.domain,
                      undefined,
                      allCatalog
                    );
                    setSourceActionModalVisible(false);
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.open(url, '_blank', 'noopener,noreferrer');
                    } else {
                      WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
                    }
                  }}
                  style={({ pressed }) => [
                    styles.actionModalRow,
                    { backgroundColor: pressed ? `${colors.text}08` : 'transparent' },
                  ]}
                >
                  <Ionicons name="open-outline" size={20} color={colors.text} />
                  <Text style={[styles.actionModalRowText, { color: colors.text }]}>
                    Visit Website
                  </Text>
                </Pressable>
              )}

              {/* Action 3: Remove from Extensions (Destructive) */}
              <Pressable
                onPress={handleRemoveSourceFromGrid}
                style={({ pressed }) => [
                  styles.actionModalRow,
                  { backgroundColor: pressed ? '#EF444415' : 'transparent' },
                ]}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.actionModalRowText, { color: '#EF4444', fontWeight: '600' }]}>
                  Remove from Extensions
                </Text>
              </Pressable>

              <View style={[styles.actionModalDivider, { backgroundColor: colors.border }]} />

              {/* Action 4: Cancel */}
              <Pressable
                onPress={() => setSourceActionModalVisible(false)}
                style={({ pressed }) => [
                  styles.actionModalRow,
                  { backgroundColor: pressed ? `${colors.text}08` : 'transparent', justifyContent: 'center' },
                ]}
              >
                <Text style={[styles.actionModalCancelText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
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
                  color={isCatalogSearchOpen ? colors.accent : colors.text}
                />
              </Pressable>
            </View>

            {/* In-Catalog Search Bar (when expanded) */}
            {isCatalogSearchOpen && (
              <View style={[styles.catalogSearchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.catalogSearchInput, { color: colors.text }]}
                  placeholder="Search 1,223 sources by name or domain..."
                  placeholderTextColor={colors.textMuted}
                  value={catalogSearchQuery}
                  onChangeText={setCatalogSearchQuery}
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
                    setLanguagePickerVisible(true);
                  }}
                  style={[
                    styles.langDropdownChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="language-outline" size={15} color={colors.text} />
                  <Text style={[styles.langDropdownText, { color: colors.text }]}>
                    {LANGUAGE_NAMES[catalogLanguage] || 'English'}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
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
                          borderColor: isSelected ? 'rgba(255, 255, 255, 0.22)' : colors.border,
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
                    <View style={[styles.sourceListSquircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {item.icon ? (
                        <Image
                          source={{ uri: item.icon }}
                          style={styles.sourceListFavicon}
                          contentFit="contain"
                          transition={150}
                        />
                      ) : (
                        <Text style={[styles.sourceListMonogram, { color: colors.textSecondary }]}>
                          {firstLetter}
                        </Text>
                      )}
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
                              Linking.openURL(targetUrl).catch(() => {})
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

            {/* Language Picker Modal for Sources Catalog */}
            {languagePickerVisible && (
              <ConfirmationModal
                visible={languagePickerVisible}
                title="Select Language"
                message="Filter manga catalog by language:"
                iconName="language-outline"
                confirmText="Done"
                onConfirm={() => setLanguagePickerVisible(false)}
                onCancel={() => setLanguagePickerVisible(false)}
              >
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
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
                        style={[
                          styles.langOptionRow,
                          {
                            backgroundColor: isSelected ? `${colors.accent}18` : 'transparent',
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.langOptionText,
                            {
                              color: isSelected ? colors.accent : colors.text,
                              fontWeight: isSelected ? '700' : '400',
                            },
                          ]}
                        >
                          {lang.label}
                        </Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </ConfirmationModal>
            )}
          </SafeAreaView>
        </Modal>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            IMAGE 2: Fullscreen Manga Browser Modal (when clicking any source in grid)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Modal
          visible={mangaModalVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setMangaModalVisible(false)}
        >
          <SafeAreaView
            style={[styles.modalContainer, { backgroundColor: colors.background }]}
            edges={['top', 'bottom']}
          >
            {/* Top Navigation Bar: Back Arrow & Right Action Icons */}
            <View style={[styles.modalTopBar, { borderBottomColor: colors.border }]}>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  isRestoringFromDetailRef.current = false;
                  isViewingMangaFromCatalogRef.current = false;
                  setMangaModalVisible(false);
                }}
                hitSlop={12}
                style={styles.modalBackBtn}
                aria-label="Back"
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
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
                    color={isMangaSearchOpen ? colors.accent : colors.text}
                  />
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setColumnsMode((prev) => (prev === 3 ? 2 : 3));
                  }}
                  hitSlop={8}
                  style={styles.modalActionBtn}
                  aria-label="Toggle Column Layout"
                >
                  <Ionicons name="grid-outline" size={22} color={colors.text} />
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
              <View style={[styles.modalSearchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.modalSearchInput, { color: colors.text }]}
                  placeholder={`Search ${activeMangaSource.name}...`}
                  placeholderTextColor={colors.textMuted}
                  value={mangaSearchQuery}
                  onChangeText={setMangaSearchQuery}
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
                    borderColor: sortPickerVisible ? 'rgba(255, 255, 255, 0.22)' : colors.border,
                    borderWidth: 1,
                  },
                ]}
                aria-label="Change Sort Order"
              >
                <Ionicons name="filter-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.sortFilterText, { color: colors.text }]}>
                  {SORT_OPTIONS.find((s) => s.id === selectedSort)?.label || 'Popular'}
                </Text>
                <Ionicons
                  name={sortPickerVisible ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Genre Filter Chips matching Image 2 */}
            <View style={styles.genreChipsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.genreChipsScroll}
              >
                {GENRE_CHIPS.map((genre) => {
                  const isSelected = selectedGenre === genre.id;
                  return (
                    <Pressable
                      key={genre.label}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedGenre(isSelected ? '' : genre.id);
                      }}
                      style={[
                        styles.genreChip,
                        {
                          backgroundColor: isSelected ? colors.surfaceElevated : colors.surface,
                          borderColor: isSelected ? 'rgba(255, 255, 255, 0.22)' : colors.border,
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
              </ScrollView>
            </View>

            {/* 3-Column Manga Grid matching Image 2 */}
            {isModalLoading ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : modalError ? (
              <View style={styles.modalEmptyBox}>
                <Ionicons
                  name={modalIsCloudflare ? 'shield-checkmark' : 'alert-circle-outline'}
                  size={52}
                  color={modalIsCloudflare ? '#F38020' : '#EF4444'}
                />
                <Text style={[styles.modalEmptyTitle, { color: colors.text }]}>
                  {modalIsCloudflare
                    ? `Cloudflare Challenge: ${activeMangaSource.name}`
                    : `Unable to load from ${activeMangaSource.name}`}
                </Text>
                <Text style={[styles.modalEmptyDesc, { color: colors.textMuted }]}>
                  {modalError}
                </Text>

                <View style={{ flexDirection: 'column', gap: 10, marginTop: 18, width: '100%', maxWidth: 360, alignItems: 'stretch' }}>
                  {modalIsCloudflare && (
                    <>
                      <Pressable
                        onPress={handleSolveCloudflare}
                        style={[styles.modalRetryBtn, { backgroundColor: '#F38020', width: '100%', justifyContent: 'center' }]}
                        aria-label="Solve Cloudflare in Browser"
                      >
                        <Ionicons name="globe" size={18} color="#FFFFFF" />
                        <Text style={styles.modalRetryBtnText}>Open Browser to Solve Challenge</Text>
                      </Pressable>
                      <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: -4, marginBottom: 2 }}>
                        After completing verification, return to Yomite to automatically reload manga cards.
                      </Text>

                      <Pressable
                        onPress={handleOpenCookieModal}
                        style={[
                          styles.modalVisitBtn,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                            width: '100%',
                            justifyContent: 'center',
                          },
                        ]}
                        aria-label="Set Cloudflare Clearance Cookie"
                      >
                        <Ionicons name="key-outline" size={18} color={colors.text} />
                        <Text style={[styles.modalVisitBtnText, { color: colors.text }]}>
                          Paste Clearance Cookie (cf_clearance)
                        </Text>
                      </Pressable>
                    </>
                  )}

                  <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        loadModalMangas(1, false);
                      }}
                      style={[styles.modalRetryBtn, { backgroundColor: colors.accent, flex: 1, justifyContent: 'center' }]}
                      aria-label="Retry loading mangas"
                    >
                      <Ionicons name="refresh" size={16} color="#FFFFFF" />
                      <Text style={styles.modalRetryBtnText}>Retry</Text>
                    </Pressable>

                    {activeMangaSource.domain ? (
                      <Pressable
                        onPress={handleSolveCloudflare}
                        style={[
                          styles.modalVisitBtn,
                          { borderColor: colors.border, backgroundColor: colors.surface, flex: 1, justifyContent: 'center' },
                        ]}
                        aria-label="Visit Source Website"
                      >
                        <Ionicons name="open-outline" size={16} color={colors.text} />
                        <Text style={[styles.modalVisitBtnText, { color: colors.text }]}>
                          Visit Website
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : modalMangas.length === 0 ? (
              <View style={styles.modalEmptyBox}>
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
                contentContainerStyle={styles.mangaGridContent}
                columnWrapperStyle={{ gap: modalGap }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={18}
                maxToRenderPerBatch={18}
                windowSize={5}
                renderItem={({ item }) => {
                  return (
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        isRestoringFromDetailRef.current = true;
                        isViewingMangaFromCatalogRef.current = true;
                        setMangaModalVisible(false);
                        router.push(`/manga/${item.id}?fromCatalog=${activeMangaSource.id}` as any);
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
                        {item.coverUrl ? (
                          <Image
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

                        {/* Rating or Percentage Badge matching Image 2 e.g. "71%" */}
                        {item.ratingPercent !== undefined && item.ratingPercent !== null && (
                          <View style={styles.percentBadge}>
                            <Text style={styles.percentBadgeText}>{item.ratingPercent}%</Text>
                          </View>
                        )}
                      </View>

                      {/* Title truncated to 2 lines matching Image 2 */}
                      <Text numberOfLines={2} style={[styles.mangaCardTitle, { color: colors.text }]}>
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                }}
                onEndReached={handleLoadMoreModalMangas}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  isModalLoadingMore ? (
                    <View style={styles.modalFooterLoader}>
                      <ActivityIndicator size="small" color={colors.accent} />
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
                        top: (Platform.OS === 'ios' ? 120 : 105) + (isMangaSearchOpen ? 52 : 0),
                        right:
                          Platform.OS === 'web' && windowWidth > 1200
                            ? Math.max(16, (windowWidth - 1200) / 2 + 16)
                            : 16,
                        backgroundColor: colors.surfaceElevated || colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.dropdownHeaderLabel}>
                      <Text style={[styles.dropdownSectionTitle, { color: colors.textMuted }]}>
                        SORT BY
                      </Text>
                    </View>
                    {SORT_OPTIONS.map((opt) => {
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

            {/* Cloudflare Clearance Cookie Input Modal */}
            {isCfCookieModalOpen && (
              <ConfirmationModal
                visible={isCfCookieModalOpen}
                title="Cloudflare Cookie"
                message={`Paste the 'cf_clearance' cookie from your browser session on ${modalCfDomain || activeMangaSource.name}:`}
                iconName="shield-checkmark-outline"
                iconColor="#F38020"
                confirmText="Save & Retry"
                cancelText="Cancel"
                onConfirm={handleSaveCookie}
                onCancel={() => setIsCfCookieModalOpen(false)}
              >
                <View style={{ width: '100%', marginVertical: 10 }}>
                  <TextInput
                    style={{
                      backgroundColor: colors.surfaceElevated || colors.surface,
                      color: colors.text,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: Radius.md,
                      padding: 10,
                      fontSize: 12,
                      minHeight: 56,
                      textAlignVertical: 'top',
                    }}
                    placeholder="cf_clearance=... or paste full cookie string"
                    placeholderTextColor={colors.textMuted}
                    value={cfCookieInput}
                    onChangeText={setCfCookieInput}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {CloudFlareCookieManager.hasCookie(modalCfDomain || activeMangaSource.domain || 'comix.to') && (
                    <Pressable
                      onPress={async () => {
                        triggerHaptic();
                        const domain = modalCfDomain || activeMangaSource.domain || 'comix.to';
                        await CloudFlareCookieManager.removeCookie(domain);
                        setCfCookieInput('');
                      }}
                      style={{ marginTop: 8, alignSelf: 'flex-start' }}
                    >
                      <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>
                        Clear Saved Cookie
                      </Text>
                    </Pressable>
                  )}
                </View>
              </ConfirmationModal>
            )}
          </SafeAreaView>
        </Modal>

        {/* Navigation Drawer */}
        <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
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
  // 4-Column Grid matching Image 1
  fourColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 20,
    columnGap: 8,
    marginTop: Spacing.xs,
  },
  sourceGridCell: {
    width: '22%',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer' as any,
  },
  squircleContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sourceGridFavicon: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  serifB: {
    fontSize: 34,
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
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sourceGridTitle: {
    fontSize: 12,
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
    width: '100%',
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
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
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
    borderWidth: 1,
  },
  langDropdownText: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
  },
  typeFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
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
    borderWidth: 1,
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
    padding: Spacing.xs,
  },
  modalTopBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  modalActionBtn: {
    padding: Spacing.xs,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
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
    borderWidth: 1,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
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
  percentBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  percentBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
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
    borderWidth: 1,
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
  // Source Card Action Menu Modal (Long-Press)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  actionModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  actionModalCard: {
    width: Platform.OS === 'web' ? '100%' : '78%',
    maxWidth: Platform.OS === 'web' ? 320 : 260,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  actionModalIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionModalFavicon: {
    width: 26,
    height: 26,
  },
  actionModalMonogram: {
    fontSize: 20,
    fontWeight: '700',
  },
  actionModalTitle: {
    fontSize: 15,
    fontWeight: Typography.weights.bold,
  },
  actionModalDomain: {
    fontSize: 11,
  },
  actionModalDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xs,
  },
  actionModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.md,
    marginVertical: 1,
    cursor: 'pointer' as any,
  },
  actionModalRowText: {
    fontSize: 13.5,
    fontWeight: Typography.weights.medium,
  },
  actionModalCancelText: {
    fontSize: 13.5,
    fontWeight: Typography.weights.semibold,
    textAlign: 'center',
    width: '100%',
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Popover Dropdown for Catalog Sort Filter
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  sortDropdownPopup: {
    position: 'absolute',
    width: 190,
    borderRadius: Radius.lg,
    borderWidth: 1,
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
