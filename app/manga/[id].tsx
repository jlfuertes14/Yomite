/**
 * Manga Detail Screen — Editorial Swiss Dark Theme
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  FlatList,
  Linking,
  Share,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import {
  getMangaDetails,
  getMangaChapters,
  getMangaTitle,
  getMangaDescription,
  extractCoverFileName,
  getCoverUrl,
  extractAuthorName,
  extractArtistName,
  getMangaStatistics,
  MangaStatistics,
} from '../../src/api/mangadex';
import {
  getUniversalMangaDetails,
  getUniversalMangaChapters,
  getUniversalSimilarManga,
  isExternalSource,
} from '../../src/sources/adapter';
import { SourceManager } from '../../src/sources/SourceManager';
import { useLibraryStore } from '../../src/store/libraryStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { useDownloadStore } from '../../src/store/downloadStore';
import { downloadChapter, removeDownloadedChapter, pauseDownloadChapter } from '../../src/services/downloadService';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { OfflineState } from '../../src/components/OfflineState';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { LibraryCategoryModal } from '../../src/components/LibraryCategoryModal';
import {
  MobileModalRoot,
  MobileSheetPanel,
  MobileSheetPanelRef,
} from '../../src/components/MobileBottomSheet';
import { Skeleton, ChapterSkeleton, MangaCardSkeleton } from '../../src/components/Skeleton';
import { ZoomableImage } from '../../src/components/ZoomableImage';
import { BridgedImage } from '../../src/components/BridgedImage';
import { MangaCard } from '../../src/components/MangaCard';
import { triggerHaptic } from '../../src/utils/haptics';
import { formatChapterDate } from '../../src/utils/date';
import { getLanguageInfo, detectMangaLanguage } from '../../src/utils/language';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
import { parseChapterNumber } from '../../src/utils/chapter';
import { ApiLogger } from '../../src/services/apiLogger';
import { CloudFlareCookieManager } from '../../src/sources/network/cloudflare';
import { DEFAULT_USER_AGENT } from '../../src/sources/network/httpClient';
import { webViewBridge } from '../../src/sources/network/webViewBridge';
import type { Manga, Chapter, LibraryCategory } from '../../src/types';

let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch {}

function formatStatNumber(num?: number | null): string | null {
  if (!num || num <= 0) return null;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

function MangaDetailSkeleton() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const coverWidth = isWeb ? 155 : 115;
  const coverHeight = isWeb ? 225 : 165;
  const topBarPaddingTop = Math.max(insets.top, 12) + (isWeb ? 8 : 6);
  const heroContentPaddingTop = Math.max(insets.top, 12) + (isWeb ? 68 : 58);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Section Skeleton */}
      <View style={styles.heroContainer}>
        {/* Top Bar Skeleton */}
        <View style={[styles.topBarContainer, { paddingTop: topBarPaddingTop }]}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <View style={styles.topBarRightActions}>
            <Skeleton width={32} height={32} borderRadius={16} />
            <Skeleton width={32} height={32} borderRadius={16} />
          </View>
        </View>

        <View style={[styles.heroContent, isWeb && styles.webCenteredContent, { paddingTop: heroContentPaddingTop }]}>
          {/* Cover Skeleton */}
          <Skeleton width={coverWidth} height={coverHeight} borderRadius={14} />

          {/* Hero Meta Skeleton */}
          <View style={[styles.heroMeta, { justifyContent: 'space-between' }]}>
            <View style={{ gap: 8 }}>
              <Skeleton width="92%" height={isWeb ? 24 : 18} borderRadius={Radius.sm} />
              <Skeleton width="65%" height={isWeb ? 24 : 18} borderRadius={Radius.sm} />
              <Skeleton width="45%" height={12} borderRadius={Radius.xs} style={{ marginTop: 2 }} />
              <Skeleton width={70} height={18} borderRadius={Radius.xs} style={{ marginTop: 2 }} />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <Skeleton width={44} height={14} borderRadius={Radius.xs} />
                <Skeleton width={44} height={14} borderRadius={Radius.xs} />
              </View>
            </View>

            {/* Full-width CTA Button Skeleton */}
            <Skeleton width="100%" height={40} borderRadius={20} style={{ marginTop: 10 }} />
          </View>
        </View>
      </View>

      {/* Pinned Tab Bar Skeleton */}
      <View style={[{ width: '100%', backgroundColor: colors.background, zIndex: 10 }, isWeb && styles.webCenteredContent]}>
        <View style={[styles.segmentedTabBar, { borderBottomColor: colors.borderSubtle }]}>
          <View style={[styles.segmentedTab, { paddingVertical: isWeb ? 10 : 8 }]}>
            <Skeleton width={76} height={14} borderRadius={Radius.xs} />
          </View>
          <View style={[styles.segmentedTab, { paddingVertical: isWeb ? 10 : 8 }]}>
            <Skeleton width={52} height={14} borderRadius={Radius.xs} />
          </View>
          <View style={[styles.segmentedTab, { paddingVertical: isWeb ? 10 : 8 }]}>
            <Skeleton width={52} height={14} borderRadius={Radius.xs} />
          </View>
        </View>
      </View>

      {/* Scrollable Content Skeleton */}
      <ScrollView
        style={styles.contentScrollView}
        contentContainerStyle={[
          styles.contentScrollContainer,
          { paddingBottom: isWeb ? 24 : Math.max(insets.bottom, 16) },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <View style={[{ width: '100%', paddingTop: isWeb ? Spacing.sm : 6 }, isWeb && styles.webCenteredContent]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginBottom: isWeb ? Spacing.xs : 4 }}>
            <Skeleton width={90} height={16} borderRadius={Radius.xs} />
            <Skeleton width={68} height={24} borderRadius={Radius.sm} />
          </View>
          {Array.from({ length: 7 }).map((_, i) => (
            <ChapterSkeleton key={i} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default function MangaDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: paramId, fromCatalog } = useLocalSearchParams<{ id: string; fromCatalog?: string }>();
  const id = useMemo(() => (paramId ? decodeURIComponent(paramId) : paramId), [paramId]);
  const router = useRouter();
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const topBarPaddingTop = Math.max(insets.top, 12) + (isWeb ? 8 : 6);
  const heroContentPaddingTop = Math.max(insets.top, 12) + (isWeb ? 68 : 58);

  const similarCardWidth = useMemo(() => {
    if (Platform.OS === 'web') {
      return 'calc((100% - 20px) / 3)';
    }
    const padding = Spacing.lg * 2;
    const gapTotal = 20; // 2 gaps of 10px each for 3 columns
    return Math.floor((windowWidth - padding - gapTotal) / 3);
  }, [windowWidth]);

  const [manga, setManga] = useState<Manga | null>(null);
  useDocumentTitle(manga ? getMangaTitle(manga) : 'Manga Details');
  const [activeTab, setActiveTab] = useState<'chapters' | 'details' | 'similar'>('chapters');
  const [stats, setStats] = useState<MangaStatistics | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [similarManga, setSimilarManga] = useState<Manga[]>([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [selectedScanlator, setSelectedScanlator] = useState<string>(() => {
    return id && id.toLowerCase().includes('mangadot') ? 'deduplicated' : 'all';
  });
  const [isScanlatorDropdownOpen, setIsScanlatorDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [isStartingReading, setIsStartingReading] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  // Cloudflare verification state
  const [chaptersIsCloudflare, setChaptersIsCloudflare] = useState(false);
  const [chaptersCfDomain, setChaptersCfDomain] = useState('comix.to');
  const [isCfInAppModalOpen, setIsCfInAppModalOpen] = useState(false);
  const [cfInAppUrl, setCfInAppUrl] = useState('');
  const isSolvingCloudflareRef = React.useRef(false);

  // Source tracking state for NHentai source
  const [isNHentaiSource, setIsNHentaiSource] = useState<boolean>(() => {
    return Boolean(
      id?.startsWith('nhentai:') ||
      fromCatalog === 'nhentai'
    );
  });

  useEffect(() => {
    const isNH = Boolean(
      id?.startsWith('nhentai:') ||
      fromCatalog === 'nhentai' ||
      manga?.attributes?.links?.raw?.includes('nhentai.net')
    );
    setIsNHentaiSource(isNH);
  }, [id, fromCatalog, manga]);

  // Keep this calculation unconditional. Hooks must run before any loading
  // or error return, otherwise source failures cause React's hook order error.
  const coverHeaders = useMemo(() => {
    if (!id) return undefined;
    const lowerId = id.toLowerCase();
    if (lowerId.startsWith('hitomila:') || lowerId.includes('hitomila')) {
      return { Referer: 'https://hitomi.la/', 'User-Agent': DEFAULT_USER_AGENT };
    }
    if (lowerId.startsWith('nhentai:') || lowerId.includes('nhentai')) {
      return { Referer: 'https://nhentai.net/', 'User-Agent': DEFAULT_USER_AGENT };
    }
    if (lowerId.startsWith('manganato:') || lowerId.includes('manganato')) {
      const cfCookie = CloudFlareCookieManager.getCookie('manganato.gg');
      return {
        Referer: 'https://www.manganato.gg/',
        'User-Agent': DEFAULT_USER_AGENT,
        ...(cfCookie ? { Cookie: cfCookie } : {}),
      };
    }
    if (lowerId.startsWith('mangadot:') || lowerId.includes('mangadot')) {
      const cfCookie = CloudFlareCookieManager.getCookie('mangadot.net');
      return {
        Referer: 'https://mangadot.net/',
        'User-Agent': DEFAULT_USER_AGENT,
        ...(cfCookie ? { Cookie: cfCookie } : {}),
      };
    }
    if (isExternalSource(id)) {
      const resolved = SourceManager.resolveSource(id);
      if (resolved && resolved.parser.getRequestHeaders) {
        return resolved.parser.getRequestHeaders();
      }
    }
    return undefined;
  }, [id]);

  const libraryEntry = useLibraryStore((s) => s.entries[id!]);
  const isInLibrary = useLibraryStore((s) => s.isInLibrary(id!));
  const addToLibrary = useLibraryStore((s) => s.addToLibrary);
  const removeFromLibrary = useLibraryStore((s) => s.removeFromLibrary);
  const updateCategory = useLibraryStore((s) => s.updateCategory);
  const lastProgress = useHistoryStore((s) => s.getMangaProgress(id!));
  const isChapterRead = useHistoryStore((s) => s.isChapterRead);
  const downloadMap = useDownloadStore((s) => s.chapters);

  // Available translated languages list
  const rawAvailableLanguages = manga?.attributes?.availableTranslatedLanguages || ['en'];
  const availableLanguages = Array.from(new Set(rawAvailableLanguages.filter(Boolean)));
  availableLanguages.sort((a, b) => {
    if (a === 'en') return -1;
    if (b === 'en') return 1;
    return getLanguageInfo(a).name.localeCompare(getLanguageInfo(b).name);
  });

  // Auto-align selected language if default 'en' is not in available languages
  useEffect(() => {
    if (manga?.attributes?.availableTranslatedLanguages?.length) {
      const avail = manga.attributes.availableTranslatedLanguages;
      if (!avail.includes(selectedLanguage)) {
        if (avail.includes('en')) {
          setSelectedLanguage('en');
        } else if (avail[0]) {
          setSelectedLanguage(avail[0]);
        }
      }
    }
  }, [manga]);

  // Helper to extract scanlation group name from a chapter
  const getChapterScanlator = useCallback((chapter: Chapter): string => {
    const group = chapter.relationships?.find((r) => r.type === 'scanlation_group');
    const groupName = group?.attributes?.name;
    if (groupName && groupName.trim()) return groupName.trim();
    const user = chapter.relationships?.find((r) => r.type === 'user');
    const userName = user?.attributes?.username;
    if (userName && userName.trim()) return userName.trim();
    return 'Unknown';
  }, []);

  // Scanlation group selector is exclusively for MangaDot sources.
  // MangaDex mangas already have the language sort and do not use the scanlation dropdown.
  const isMangaDot = useMemo(() => {
    return !!(id && id.toLowerCase().includes('mangadot'));
  }, [id]);

  // Compute list of available scanlation groups with chapter counts (only for MangaDot)
  const availableScanlators = useMemo(() => {
    if (!isMangaDot) return [];
    const counts: Record<string, number> = {};
    for (const c of chapters) {
      const sc = getChapterScanlator(c);
      counts[sc] = (counts[sc] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [chapters, getChapterScanlator, isMangaDot]);

  // Count unique chapters (for deduplicated view)
  const uniqueChapterCount = useMemo(() => {
    const seen = new Set<string>();
    for (const c of chapters) {
      const num = c.attributes.chapter?.trim() || c.id;
      seen.add(num);
    }
    return seen.size;
  }, [chapters]);

  // Filtered chapters according to selected scanlation group (only applied on MangaDot)
  const displayedChapters = useMemo(() => {
    if (!isMangaDot) return chapters;
    if (selectedScanlator === 'deduplicated') {
      const seen = new Set<string>();
      return chapters.filter((c) => {
        const num = c.attributes.chapter?.trim() || c.id;
        if (seen.has(num)) return false;
        seen.add(num);
        return true;
      });
    }
    if (selectedScanlator !== 'all') {
      return chapters.filter((c) => getChapterScanlator(c) === selectedScanlator);
    }
    return chapters;
  }, [chapters, selectedScanlator, getChapterScanlator, isMangaDot]);

  // Reset selected scanlator when switching manga (default to deduplicated for MangaDot)
  useEffect(() => {
    setSelectedScanlator(isMangaDot ? 'deduplicated' : 'all');
  }, [id, isMangaDot]);

  // Reconcile selected scanlator if it no longer exists
  useEffect(() => {
    if (
      selectedScanlator !== 'all' &&
      selectedScanlator !== 'deduplicated' &&
      availableScanlators.length > 0 &&
      !availableScanlators.some((s) => s.name === selectedScanlator)
    ) {
      setSelectedScanlator(isMangaDot ? 'deduplicated' : 'all');
    }
  }, [availableScanlators, selectedScanlator, isMangaDot]);

  // Modals state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [selectedDownloadIds, setSelectedDownloadIds] = useState<Set<string>>(new Set());
  const [isCoverHovered, setIsCoverHovered] = useState(false);
  const [isCoverLightboxOpen, setIsCoverLightboxOpen] = useState(false);

  // Mobile Bottom Sheet refs & animated dismiss handlers
  const languageSheetRef = useRef<MobileSheetPanelRef>(null);
  const downloadSheetRef = useRef<MobileSheetPanelRef>(null);
  const scanlatorSheetRef = useRef<MobileSheetPanelRef>(null);

  const closeLanguageModal = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsLanguageDropdownOpen(false);
    } else {
      languageSheetRef.current?.close();
    }
  }, []);

  const closeDownloadModal = useCallback(() => {
    if (Platform.OS === 'web') {
      setDownloadModalVisible(false);
    } else {
      downloadSheetRef.current?.close();
    }
  }, []);

  const closeScanlatorModal = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsScanlatorDropdownOpen(false);
    } else {
      scanlatorSheetRef.current?.close();
    }
  }, []);

  // Windowed chapter pagination for fast rendering on long series (e.g. 500+ chapters)
  const [visibleChapterCount, setVisibleChapterCount] = useState(40);

  useEffect(() => {
    setVisibleChapterCount(40);
  }, [id, sortOrder, selectedScanlator]);

  // Custom Confirmation Dialog State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: keyof typeof Ionicons.glyphMap;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'destructive' | 'primary' | 'success';
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    if (!id) return;
    loadMangaDetails();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadChapters(selectedLanguage, sortOrder);
  }, [id, sortOrder, selectedLanguage]);

  const loadMangaDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const isExt = isExternalSource(id!);
      const [data, statistics] = await Promise.all([
        isExt ? getUniversalMangaDetails(id!) : getMangaDetails(id!),
        !isExt ? getMangaStatistics(id!) : Promise.resolve(null),
      ]);
      setManga(data);
      setStats(statistics);
      loadSimilarManga(data);
    } catch (err: any) {
      console.error('Failed to load manga details:', err);
      const isCf =
        err?.isCloudFlare ||
        err?.name === 'CloudFlareError' ||
        (typeof err?.message === 'string' &&
          (err.message.toLowerCase().includes('cloudflare') ||
            err.message.toLowerCase().includes('challenge') ||
            err.message.toLowerCase().includes('turnstile')));
      if (isCf) {
        setChaptersIsCloudflare(true);
        const resolvedDomain =
          err?.domain ||
          (id?.includes('manganato')
            ? 'manganato.gg'
            : id?.includes('mangadot')
            ? 'mangadot.net'
            : id?.includes('comix')
            ? 'comix.to'
            : id?.includes('comick')
            ? 'comick.dev'
            : 'comix.to');
        setChaptersCfDomain(resolvedDomain);
      }
      ApiLogger.logRequest({
        timestamp: Date.now(),
        method: 'MANGA_DETAILS',
        url: id || 'unknown',
        status: err?.response?.status ?? null,
        statusText: err?.response?.statusText,
        durationMs: 0,
        error: err?.message || String(err),
      });
      setError(
        isCf
          ? 'Cloudflare verification required to view this title.'
          : 'Unable to load manga details from source. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadChapters = async (lang = selectedLanguage, order = sortOrder) => {
    try {
      setIsLoadingChapters(true);
      setChaptersIsCloudflare(false);
      const isExt = isExternalSource(id!);
      let chs: Chapter[] = [];

      if (isExt) {
        chs = await getUniversalMangaChapters(id!);
        if (order === 'desc') {
          chs.sort(
            (a, b) =>
              parseFloat(b.attributes.chapter || '0') -
              parseFloat(a.attributes.chapter || '0')
          );
        } else {
          chs.sort(
            (a, b) =>
              parseFloat(a.attributes.chapter || '0') -
              parseFloat(b.attributes.chapter || '0')
          );
        }
      } else {
        const result = await getMangaChapters(id!, lang, 100, 0, order);
        chs = result.data || [];
      }

      setChapters(chs);

      // Reconcile total chapters and unread count badge in library
      if (id && chs.length > 0) {
        const libStore = useLibraryStore.getState();
        if (libStore.isInLibrary(id)) {
          const entry = libStore.entries[id];
          const isCompleted = entry?.category === 'completed';
          let unread = isCompleted ? 0 : chs.length;

          if (!isCompleted) {
            const historyStore = useHistoryStore.getState();
            const progress = historyStore.getMangaProgress(id, manga ? getMangaTitle(manga) : undefined);
            if (progress?.chapterId || progress?.chapterTitle) {
              const idx = chs.findIndex((c) => c.id === progress.chapterId);
              if (idx >= 0) {
                unread = order === 'desc' ? idx : chs.length - 1 - idx;
              } else {
                const pNum = parseChapterNumber(progress.chapterTitle) ?? parseChapterNumber(progress.chapterId);
                if (pNum !== null && pNum > 0) {
                  unread = chs.filter((c) => {
                    const cNum = parseFloat(c.attributes.chapter || '0');
                    return !isNaN(cNum) && cNum > pNum;
                  }).length;
                }
              }
            }

            // Also check readChapterIds
            const readMap = historyStore.readChapterIds;
            if (readMap && Object.keys(readMap).length > 0) {
              const readInThisManga = chs.filter((c) => historyStore.isChapterRead(c.id)).length;
              if (readInThisManga > 0) {
                unread = Math.min(unread, Math.max(0, chs.length - readInThisManga));
              }
            }
          }

          libStore.updateChapterCounts(id, chs.length, Math.max(0, unread));
        }
      }
    } catch (err: any) {
      console.error('Failed to load chapters:', err);
      const isCf =
        err?.isCloudFlare ||
        err?.name === 'CloudFlareError' ||
        (typeof err?.message === 'string' &&
          (err.message.toLowerCase().includes('cloudflare') ||
            err.message.toLowerCase().includes('challenge') ||
            err.message.toLowerCase().includes('turnstile') ||
            err.message.toLowerCase().includes('verification required')));
      if (isCf) {
        setChaptersIsCloudflare(true);
        const resolvedDomain =
          err?.domain ||
          (id?.includes('manganato')
            ? 'manganato.gg'
            : id?.includes('mangadot')
            ? 'mangadot.net'
            : id?.includes('comix')
            ? 'comix.to'
            : id?.includes('comick')
            ? 'comick.dev'
            : 'comix.to');
        setChaptersCfDomain(resolvedDomain);
      }
      ApiLogger.logRequest({
        timestamp: Date.now(),
        method: 'MANGA_CHAPTERS',
        url: id || 'unknown',
        status: err?.response?.status ?? null,
        statusText: err?.response?.statusText,
        durationMs: 0,
        error: err?.message || String(err),
      });
    } finally {
      setIsLoadingChapters(false);
    }
  };

  const handleSolveCloudflare = useCallback(() => {
    triggerHaptic();
    const sourceDomain =
      chaptersCfDomain ||
      (id?.includes('manganato')
        ? 'manganato.gg'
        : id?.includes('mangadot')
        ? 'mangadot.net'
        : id?.includes('comick')
        ? 'comick.dev'
        : 'comix.to');
    let targetUrl =
      manga?.attributes?.links?.raw ||
      (sourceDomain.startsWith('http') ? sourceDomain : `https://${sourceDomain}`);
    if (targetUrl.includes('/api/')) {
      targetUrl = sourceDomain.startsWith('http') ? sourceDomain : `https://${sourceDomain}/`;
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const handleWindowFocus = () => {
          window.removeEventListener('focus', handleWindowFocus);
          if (isSolvingCloudflareRef.current) {
            isSolvingCloudflareRef.current = false;
            setChaptersIsCloudflare(false);
            loadMangaDetails();
            loadChapters();
          }
        };
        window.addEventListener('focus', handleWindowFocus);
        isSolvingCloudflareRef.current = true;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      setCfInAppUrl(targetUrl);
      setIsCfInAppModalOpen(true);
    }
  }, [chaptersCfDomain, manga, id]);

  const handleSelectCategory = useCallback(
    (category: LibraryCategory) => {
      if (isInLibrary) {
        updateCategory(id!, category);
      } else if (manga) {
        const coverFileName = extractCoverFileName(manga);
        const isCompleted = category === 'completed';
        const progress = useHistoryStore.getState().getMangaProgress(id!, getMangaTitle(manga));
        let unread = isCompleted ? 0 : chapters.length;

        if (!isCompleted && progress && chapters.length > 0) {
          const idx = chapters.findIndex((c) => c.id === progress.chapterId);
          if (idx >= 0) {
            unread = sortOrder === 'desc' ? idx : chapters.length - 1 - idx;
          } else {
            const pNum = parseChapterNumber(progress.chapterTitle) ?? parseChapterNumber(progress.chapterId);
            if (pNum !== null && pNum > 0) {
              unread = chapters.filter((c) => {
                const cNum = parseFloat(c.attributes.chapter || '0');
                return !isNaN(cNum) && cNum > pNum;
              }).length;
            }
          }
        }

        addToLibrary({
          mangaId: manga.id,
          title: getMangaTitle(manga),
          coverUrl: getCoverUrl(manga.id, coverFileName, '512'),
          category,
          lastReadChapterId: progress?.chapterId || null,
          lastReadPage: progress?.pageIndex || 0,
          totalChapters: chapters.length,
          unreadCount: Math.max(0, unread),
          description: getMangaDescription(manga) || '',
        });
      }
    },
    [isInLibrary, updateCategory, id, manga, chapters, sortOrder, addToLibrary]
  );

  const getCategoryDisplayLabel = (cat?: LibraryCategory | null): string => {
    switch (cat) {
      case 'reading':
        return 'Reading';
      case 'plan_to_read':
        return 'Plan to Read';
      case 'completed':
        return 'Completed';
      case 'favorites':
        return 'Favorites';
      case 'dropped':
        return 'Dropped';
      default:
        return 'In Library';
    }
  };

  const handleReadChapter = useCallback(
    (chapterId: string, pageIndex?: number) => {
      let activeScanlator = selectedScanlator;
      if (selectedScanlator === 'all' || selectedScanlator === 'deduplicated') {
        const ch = chapters.find((c) => c.id === chapterId);
        if (ch) {
          const sc = getChapterScanlator(ch);
          if (sc && sc !== 'Unknown' && sc !== 'No Scanlation Group') {
            activeScanlator = sc;
          }
        }
      }

      router.push({
        pathname: '/reader/[chapterId]',
        params: {
          chapterId,
          mangaId: id,
          ...(activeScanlator && activeScanlator !== 'all' ? { scanlator: activeScanlator } : {}),
          ...(pageIndex !== undefined ? { page: String(pageIndex) } : {}),
        },
      } as any);
    },
    [router, id, selectedScanlator, chapters, getChapterScanlator]
  );

  const handleStartReading = useCallback(async () => {
    if (!id || isStartingReading) return;

    if (lastProgress) {
      handleReadChapter(lastProgress.chapterId, lastProgress.pageIndex);
      return;
    }

    try {
      setIsStartingReading(true);
      // External parsers already populated `chapters`. Calling the MangaDex
      // endpoint here causes false 404s such as /manga/omegascans:54/feed.
      const firstChapter = isExternalSource(id)
        ? [...displayedChapters].sort(
            (a, b) =>
              parseFloat(a.attributes.chapter || '0') -
              parseFloat(b.attributes.chapter || '0')
          )[0]
        : (await getMangaChapters(id, selectedLanguage, 1, 0, 'asc')).data[0];

      if (firstChapter) {
        handleReadChapter(firstChapter.id, 0);
      }
    } catch (err) {
      console.error('Failed to load the first chapter:', err);
    } finally {
      setIsStartingReading(false);
    }
  }, [displayedChapters, handleReadChapter, id, isStartingReading, lastProgress, selectedLanguage]);

  const loadSimilarManga = useCallback(async (currentManga: Manga | null) => {
    if (!currentManga || !id) return;
    try {
      setIsLoadingSimilar(true);
      const results = await getUniversalSimilarManga(id, currentManga);
      setSimilarManga(results);
    } catch (err) {
      console.error('Failed to load similar manga:', err);
      setSimilarManga([]);
    } finally {
      setIsLoadingSimilar(false);
    }
  }, [id]);

  const handleShare = useCallback(async () => {
    if (!manga) return;
    triggerHaptic();
    const shareTitle = getMangaTitle(manga);
    const shareUrl =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.href
        : `https://mangadex.org/title/${manga.id}`;

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: shareTitle,
          text: `Check out ${shareTitle} on Yomite!`,
          url: shareUrl,
        });
        return;
      }
    } catch {}

    try {
      await Share.share({
        title: shareTitle,
        message: Platform.OS === 'android' ? `${shareTitle}\n${shareUrl}` : `Check out ${shareTitle} on Yomite!`,
        url: shareUrl,
      });
    } catch (e) {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
        Alert.alert('Link Copied', 'Manga link copied to clipboard.');
      }
    }
  }, [manga]);

  const handleToggleSelectDownload = (chapterId: string) => {
    triggerHaptic();
    setSelectedDownloadIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const alreadyDownloadedCount = useMemo(() => {
    return displayedChapters.filter((c) => downloadMap[c.id]?.status === 'completed').length;
  }, [displayedChapters, downloadMap]);

  const undownloadedChaptersCount = useMemo(() => {
    return displayedChapters.filter((c) => downloadMap[c.id]?.status !== 'completed').length;
  }, [displayedChapters, downloadMap]);

  const selectedTotalPages = useMemo(() => {
    let pages = 0;
    for (const c of displayedChapters) {
      if (selectedDownloadIds.has(c.id) && downloadMap[c.id]?.status !== 'completed') {
        pages += c.attributes.pages || 0;
      }
    }
    return pages;
  }, [displayedChapters, selectedDownloadIds, downloadMap]);

  const handleQuickPreset = useCallback(
    (preset: 'all' | 'next5' | 'next10' | 'next25' | 'unread') => {
      triggerHaptic();
      const undownloaded = displayedChapters.filter(
        (c) => downloadMap[c.id]?.status !== 'completed'
      );

      if (preset === 'all') {
        if (selectedDownloadIds.size === undownloaded.length && undownloaded.length > 0) {
          setSelectedDownloadIds(new Set());
        } else {
          setSelectedDownloadIds(new Set(undownloaded.map((c) => c.id)));
        }
        return;
      }

      if (preset === 'unread') {
        const unreadUndownloaded = undownloaded.filter((c) => !isChapterRead(c.id));
        setSelectedDownloadIds(new Set(unreadUndownloaded.map((c) => c.id)));
        return;
      }

      const count = preset === 'next5' ? 5 : preset === 'next10' ? 10 : 25;
      const unreadFirst = undownloaded.filter((c) => !isChapterRead(c.id));
      const pool = unreadFirst.length > 0 ? unreadFirst : undownloaded;
      const targetIds = pool.slice(0, count).map((c) => c.id);
      setSelectedDownloadIds(new Set(targetIds));
    },
    [displayedChapters, downloadMap, isChapterRead, selectedDownloadIds]
  );

  const handleStartBatchDownload = () => {
    if (selectedDownloadIds.size === 0 || !manga) return;
    const coverFileName = extractCoverFileName(manga);
    const coverUrl = getCoverUrl(manga.id, coverFileName, '512');
    const selectedList = displayedChapters.filter(
      (c) => selectedDownloadIds.has(c.id) && downloadMap[c.id]?.status !== 'completed'
    );
    closeDownloadModal();

    if (selectedList.length === 0) {
      setConfirmModalConfig({
        visible: true,
        title: 'Already Downloaded',
        message: 'All selected chapters are already saved on your device for offline reading.',
        iconName: 'checkmark-circle-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    setConfirmModalConfig({
      visible: true,
      title: 'Downloads Queued',
      message: `Started downloading ${selectedList.length} ${selectedList.length === 1 ? 'chapter' : 'chapters'} in the background.`,
      iconName: 'cloud-download-outline',
      confirmText: 'Got It',
      cancelText: '',
      confirmVariant: 'primary',
      onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
    });

    selectedList.forEach((chapter) => {
      downloadChapter({
        chapterId: chapter.id,
        mangaId: manga.id,
        mangaTitle: getMangaTitle(manga),
        chapterNum: chapter.attributes.chapter || '1',
        chapterTitle: chapter.attributes.title || '',
        coverUrl,
      });
    });
  };

  const getChapterCredit = (chapter: Chapter): string => {
    const group = chapter.relationships?.find((r) => r.type === 'scanlation_group');
    const user = chapter.relationships?.find((r) => r.type === 'user');
    const groupName = group?.attributes?.name ?? null;
    const userName = user?.attributes?.username ?? null;

    if (groupName && userName && groupName !== userName) return `${groupName} · ${userName}`;
    if (groupName) return groupName;
    if (userName) return userName;

    if (id && isExternalSource(id)) {
      const resolved = SourceManager.resolveSource(id);
      if (resolved) return resolved.parser.metadata.name;
    }
    if (chapter.id && isExternalSource(chapter.id)) {
      const resolved = SourceManager.resolveSource(chapter.id);
      if (resolved) return resolved.parser.metadata.name;
    }

    return 'MangaDex';
  };

  if (isLoading) {
    return <MangaDetailSkeleton />;
  }

  if (error || !manga) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <OfflineState
          onRetry={() => {
            loadMangaDetails();
            loadChapters();
          }}
        />
      </SafeAreaView>
    );
  }

  const coverFileName = extractCoverFileName(manga);
  const coverUrl = getCoverUrl(manga.id, coverFileName, '512');
  const rawTitle = getMangaTitle(manga);
  // Strip any leading flag emojis so chapter list manga title is completely clean
  const title = rawTitle.replace(/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]\s*/, '').trim();
  const description = getMangaDescription(manga);
  const author = extractAuthorName(manga);
  const artist = extractArtistName(manga);
  const tags = manga.attributes.tags || [];
  const mangaLang = isNHentaiSource
    ? (manga.attributes.originalLanguage || detectMangaLanguage(rawTitle, undefined, manga.attributes.tags.map((t) => t.attributes?.name?.en), id))
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Header with Backdrop */}
      <View style={styles.heroContainer}>
          {coverUrl && (
            <BridgedImage
              source={{ uri: coverUrl, headers: coverHeaders }}
              style={styles.backdropImage}
              contentFit="cover"
              blurRadius={6}
            />
          )}
          <LinearGradient
            colors={['rgba(9,9,11,0.25)', 'rgba(9,9,11,0.75)', colors.background]}
            style={styles.backdropGradient}
          />

          {/* Top Bar Navigation (Clean flat icon buttons, no circle/backdrop) */}
          <View style={[styles.topBarContainer, { paddingTop: topBarPaddingTop }]}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else if (fromCatalog) {
                  router.replace(`/(tabs)/extensions?reopenCatalog=${fromCatalog}` as any);
                } else {
                  router.replace('/(tabs)' as any);
                }
              }}
              style={({ pressed }) => [
                styles.topIconButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>

            <View style={styles.topBarRightActions}>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setCategoryModalVisible(true);
                }}
                style={({ pressed }) => [
                  styles.topIconButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isInLibrary ? `In library (${getCategoryDisplayLabel(libraryEntry?.category)})` : 'Add to library'}
              >
                <Ionicons
                  name={isInLibrary ? 'bookmark' : 'bookmark-outline'}
                  size={24}
                  color={isInLibrary ? colors.accent : '#FFFFFF'}
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  triggerHaptic();
                  const unDownloadedIds = chapters
                    .filter((c) => downloadMap[c.id]?.status !== 'completed')
                    .map((c) => c.id);
                  setSelectedDownloadIds(new Set(unDownloadedIds));
                  setDownloadModalVisible(true);
                }}
                style={({ pressed }) => [
                  styles.topIconButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Download chapters"
              >
                <Ionicons name="download-outline" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Inner hero content centered with global web margins */}
          <View style={[{ width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>
            {/* 2-Column Hero: Left = Cover, Right = Title, Author, Status, Stats, Continue CTA */}
            <View style={[styles.heroContent, { paddingTop: heroContentPaddingTop }]}>
              <Pressable
                onPress={() => {
                  if (coverUrl) {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setIsCoverLightboxOpen(true);
                  }
                }}
                onHoverIn={() => setIsCoverHovered(true)}
                onHoverOut={() => setIsCoverHovered(false)}
                style={({ pressed }) => [
                  styles.coverContainer,
                  Platform.OS === 'web' && coverUrl && ({ cursor: 'pointer' } as any),
                  pressed && coverUrl && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="View cover image full screen"
              >
                {coverUrl ? (
                  <BridgedImage
                    source={{ uri: coverUrl, headers: coverHeaders }}
                    style={styles.coverImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[styles.coverPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name="book-outline" size={32} color={colors.textMuted} />
                  </View>
                )}
              </Pressable>

              <View style={styles.heroMeta}>
                {/* Manga Title */}
                <Text style={[styles.mangaTitle, { color: colors.text }]} numberOfLines={3}>
                  {title}
                </Text>

                {/* Author */}
                <Text style={[styles.authorText, { color: colors.textSecondary }]} numberOfLines={1}>
                  By {author || 'Unknown'}{artist && artist !== author ? ` · Art: ${artist}` : ''}
                </Text>

                {/* Status with yellow flag icon */}
                <View style={styles.statusRow}>
                  <View style={styles.statusFlagContainer}>
                    <Ionicons name="flag" size={13} color="#F59E0B" />
                    <Text style={[styles.statusFlagText, { color: colors.text }]}>
                      {manga.attributes.status
                        ? manga.attributes.status.charAt(0).toUpperCase() + manga.attributes.status.slice(1)
                        : 'Ongoing'}
                    </Text>
                  </View>

                  {isNHentaiSource && mangaLang ? (
                    <View style={[styles.statusPill, { backgroundColor: colors.surfaceElevated || colors.surface, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, borderWidth: 0 }]}>
                      <Image
                        source={{ uri: getLanguageInfo(mangaLang).flagUrl }}
                        style={{ width: 14, height: 10, borderRadius: 2 }}
                        contentFit="cover"
                      />
                      <Text style={[styles.statusPillText, { color: colors.text, textTransform: 'uppercase', fontSize: 10, fontWeight: '700' }]}>
                        {getLanguageInfo(mangaLang).code.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Rating & Follows Stats row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {(stats?.rating?.bayesian || stats?.rating?.average || 0) > 0
                        ? (stats?.rating?.bayesian || stats?.rating?.average!).toFixed(1)
                        : '8.3'}
                    </Text>
                  </View>

                  <View style={styles.statItem}>
                    <Ionicons name="bookmark" size={14} color={colors.accent} />
                    <Text style={[styles.statValue, { color: colors.textSecondary }]}>
                      {formatStatNumber(stats?.follows) || '65k'}
                    </Text>
                  </View>
                </View>

                {/* Full-width Accent Pill CTA Button */}
                <AnimatedPressable
                  onPress={handleStartReading}
                  disabled={isStartingReading || (chapters.length === 0 && !isLoadingChapters)}
                  style={[
                    styles.heroCtaButton,
                    { backgroundColor: colors.accent },
                    isStartingReading && { opacity: 0.6 },
                    (chapters.length === 0 && !isLoadingChapters) && { opacity: 0.5 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={lastProgress ? 'Continue reading' : 'Start reading'}
                >
                  {isStartingReading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="play" size={14} color="#FFFFFF" />
                      <Text style={styles.heroCtaText} numberOfLines={1}>
                        {lastProgress
                          ? `Continue${lastProgress.chapterTitle ? ` Ch. ${parseChapterNumber(lastProgress.chapterTitle) ?? ''}` : ''}`
                          : 'Start Reading'}
                      </Text>
                    </>
                  )}
                </AnimatedPressable>
              </View>
            </View>
          </View>
        </View>

      {/* Pinned Segmented Tab Bar: Chapters (count) | Details | Similar */}
      <View style={[{ width: '100%', backgroundColor: colors.background, zIndex: 10 }, Platform.OS === 'web' && styles.webCenteredContent]}>
        <View style={[styles.segmentedTabBar, { borderBottomColor: colors.borderSubtle }]}>
          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveTab('chapters');
            }}
            style={styles.segmentedTab}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'chapters' }}
            accessibilityLabel="Chapters tab"
          >
            <Text
              style={[
                styles.segmentedTabText,
                { color: activeTab === 'chapters' ? colors.text : colors.textMuted },
                activeTab === 'chapters' && styles.segmentedTabTextActive,
              ]}
            >
              Chapters ({displayedChapters.length})
            </Text>
            {activeTab === 'chapters' && (
              <View style={[styles.activeTabIndicator, { backgroundColor: colors.accent }]} />
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveTab('details');
            }}
            style={styles.segmentedTab}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'details' }}
            accessibilityLabel="Details tab"
          >
            <Text
              style={[
                styles.segmentedTabText,
                { color: activeTab === 'details' ? colors.text : colors.textMuted },
                activeTab === 'details' && styles.segmentedTabTextActive,
              ]}
            >
              Details
            </Text>
            {activeTab === 'details' && (
              <View style={[styles.activeTabIndicator, { backgroundColor: colors.accent }]} />
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveTab('similar');
              if (similarManga.length === 0 && !isLoadingSimilar) {
                loadSimilarManga(manga);
              }
            }}
            style={styles.segmentedTab}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'similar' }}
            accessibilityLabel="Similar tab"
          >
            <Text
              style={[
                styles.segmentedTabText,
                { color: activeTab === 'similar' ? colors.text : colors.textMuted },
                activeTab === 'similar' && styles.segmentedTabTextActive,
              ]}
            >
              Similar
            </Text>
            {activeTab === 'similar' && (
              <View style={[styles.activeTabIndicator, { backgroundColor: colors.accent }]} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Scrollable Tab Content: Chapters, Details, and Similar */}
      <ScrollView
        style={styles.contentScrollView}
        contentContainerStyle={[
          styles.contentScrollContainer,
          { paddingBottom: Platform.OS === 'web' ? 24 : Math.max(insets.bottom, 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[{ width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>

          {/* Tab 1: Details View (Flat design, uncluttered) */}
          {activeTab === 'details' && (
            <View style={styles.tabContentContainer}>
              {/* Genres Section */}
              {tags.length > 0 && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Genres</Text>
                  <View style={styles.genresWrap}>
                    {tags.map((tag) => (
                      <View
                        key={tag.id}
                        style={[
                          styles.genreChip,
                          { backgroundColor: colors.surfaceElevated },
                        ]}
                      >
                        <Text style={[styles.genreChipText, { color: colors.textSecondary }]}>
                          {tag.attributes?.name?.en ?? Object.values(tag.attributes?.name || {})[0]}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Summary Section */}
              {description ? (
                <View style={styles.detailsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary</Text>
                  <Pressable
                    onPress={() => setSynopsisExpanded(!synopsisExpanded)}
                    style={styles.synopsisContainer}
                  >
                    <Text
                      style={[styles.synopsisText, { color: colors.textSecondary }]}
                      numberOfLines={synopsisExpanded ? undefined : 4}
                    >
                      {description}
                    </Text>
                    <Text style={[styles.expandText, { color: colors.accent }]}>
                      {synopsisExpanded ? 'Show less' : 'Show more'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Information Specs Section (Flat key-value list) */}
              <View style={styles.detailsSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Information</Text>
                <View style={styles.flatInfoList}>
                  <View style={styles.flatInfoRow}>
                    <Text style={[styles.flatInfoLabel, { color: colors.textMuted }]}>Author</Text>
                    <Text style={[styles.flatInfoValue, { color: colors.text }]} numberOfLines={1}>
                      {author || 'Unknown'}
                    </Text>
                  </View>

                  <View style={styles.flatInfoRow}>
                    <Text style={[styles.flatInfoLabel, { color: colors.textMuted }]}>Artist</Text>
                    <Text style={[styles.flatInfoValue, { color: colors.text }]} numberOfLines={1}>
                      {artist || 'Unknown'}
                    </Text>
                  </View>

                  <View style={styles.flatInfoRow}>
                    <Text style={[styles.flatInfoLabel, { color: colors.textMuted }]}>Status</Text>
                    <Text style={[styles.flatInfoValue, { color: colors.accent }]}>
                      {manga.attributes.status
                        ? manga.attributes.status.charAt(0).toUpperCase() + manga.attributes.status.slice(1)
                        : 'Unknown'}
                    </Text>
                  </View>

                  <View style={styles.flatInfoRow}>
                    <Text style={[styles.flatInfoLabel, { color: colors.textMuted }]}>Demographic</Text>
                    <Text style={[styles.flatInfoValue, { color: colors.text }]}>
                      {manga.attributes.publicationDemographic
                        ? manga.attributes.publicationDemographic.charAt(0).toUpperCase() + manga.attributes.publicationDemographic.slice(1)
                        : 'None'}
                    </Text>
                  </View>

                  <View style={styles.flatInfoRow}>
                    <Text style={[styles.flatInfoLabel, { color: colors.textMuted }]}>Content Rating</Text>
                    <Text style={[styles.flatInfoValue, { color: colors.text }]}>
                      {manga.attributes.contentRating
                        ? manga.attributes.contentRating.charAt(0).toUpperCase() + manga.attributes.contentRating.slice(1)
                        : 'Safe'}
                    </Text>
                  </View>

                  <View style={styles.flatInfoRow}>
                    <Text style={[styles.flatInfoLabel, { color: colors.textMuted }]}>Original Language</Text>
                    <Text style={[styles.flatInfoValue, { color: colors.text }]}>
                      {manga.attributes.originalLanguage
                        ? getLanguageInfo(manga.attributes.originalLanguage).name
                        : 'Japanese'}
                    </Text>
                  </View>

                  <View style={styles.flatInfoRow}>
                    <Text style={[styles.flatInfoLabel, { color: colors.textMuted }]}>Published</Text>
                    <Text style={[styles.flatInfoValue, { color: colors.text }]}>
                      {manga.attributes.year
                        ? String(manga.attributes.year)
                        : manga.attributes.createdAt
                        ? new Date(manga.attributes.createdAt).getFullYear().toString()
                        : 'Unknown'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Tab 2: Chapters View */}
          {activeTab === 'chapters' && (
            <View>
              {/* Chapter List Header / Toolbar */}
              <View style={styles.chapterHeader}>
                <View style={styles.chapterHeaderLeft}>
                  <Text style={[styles.chapterHeaderTitle, { color: colors.text }]}>
                    Chapters ({displayedChapters.length})
                  </Text>
                </View>

                <View style={styles.chapterHeaderRight}>
                  {/* Multi-Language Selector Dropdown (When 2 or more available) */}
            {availableLanguages.length > 1 && (
              <View style={styles.languagePickerContainer}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setIsLanguageDropdownOpen((prev) => !prev);
                  }}
                  style={({ pressed }) => [
                    styles.languagePickerBtn,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 0,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: getLanguageInfo(selectedLanguage).flagUrl }}
                    style={styles.languagePickerFlagImage}
                    contentFit="cover"
                  />
                  <Text
                    style={[styles.languagePickerText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {getLanguageInfo(selectedLanguage).name}
                  </Text>
                  <Ionicons
                    name={isLanguageDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {/* Floating Dropdown Modal / Popup on Web */}
                {Platform.OS === 'web' && isLanguageDropdownOpen && (
                  <>
                    <Pressable
                      style={styles.languageWebBackdrop}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        setIsLanguageDropdownOpen(false);
                      }}
                    />
                    <View
                      style={[
                        styles.languageDropdownMenu,
                        {
                          backgroundColor: colors.surface,
                          borderWidth: 0,
                        },
                      ]}
                    >
                      <Text style={[styles.languageDropdownTitle, { color: colors.textMuted }]}>
                        TRANSLATIONS ({availableLanguages.length})
                      </Text>
                      <ScrollView
                        style={styles.languageDropdownScroll}
                        showsVerticalScrollIndicator={true}
                      >
                        {availableLanguages.map((langCode) => {
                          const langInfo = getLanguageInfo(langCode);
                          const isSelected = langCode === selectedLanguage;
                          return (
                            <Pressable
                              key={langCode}
                              onPress={(e: any) => {
                                e?.stopPropagation?.();
                                triggerHaptic();
                                setSelectedLanguage(langCode);
                                setIsLanguageDropdownOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.languageDropdownItem,
                                {
                                  backgroundColor: isSelected
                                    ? colors.accent + '22'
                                    : pressed
                                    ? colors.surfaceElevated
                                    : 'transparent',
                                },
                              ]}
                            >
                              <Image
                                source={{ uri: langInfo.flagUrl }}
                                style={styles.languageDropdownItemFlagImage}
                                contentFit="cover"
                              />
                              <Text
                                style={[
                                  styles.languageDropdownItemName,
                                  {
                                    color: isSelected ? colors.accent : colors.text,
                                    fontWeight: isSelected ? 'bold' : 'normal',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {langInfo.name}
                              </Text>
                              <View style={[styles.langCodeBadge, { backgroundColor: colors.borderSubtle }]}>
                                <Text style={[styles.langCodeBadgeText, { color: colors.textSecondary }]}>
                                  {langCode.toUpperCase()}
                                </Text>
                              </View>
                              {isSelected && (
                                <Ionicons name="checkmark" size={15} color={colors.accent} />
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Scanlation Group Dropdown (Exclusively for MangaDot when 2 or more groups exist) */}
            {isMangaDot && availableScanlators.length > 1 && (
              <View style={styles.groupPickerContainer}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setIsScanlatorDropdownOpen((prev) => !prev);
                  }}
                  style={[
                    styles.sortButton,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 0,
                      maxWidth: 160,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Select scanlation group"
                >
                  <Ionicons name="people-outline" size={13} color={colors.accent} />
                  <Text
                    style={[styles.sortText, { color: colors.accent, flexShrink: 1 }]}
                    numberOfLines={1}
                  >
                    {selectedScanlator === 'all'
                      ? 'All Groups'
                      : selectedScanlator === 'deduplicated'
                      ? 'Deduplicated'
                      : selectedScanlator}
                  </Text>
                  <Ionicons
                    name={isScanlatorDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={11}
                    color={colors.accent}
                  />
                </Pressable>

                {/* Floating Dropdown Modal / Popup on Web */}
                {Platform.OS === 'web' && isScanlatorDropdownOpen && (
                  <>
                    <Pressable
                      style={styles.languageWebBackdrop}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        setIsScanlatorDropdownOpen(false);
                      }}
                    />
                    <View
                      style={[
                        styles.groupDropdownMenu,
                        {
                          backgroundColor: colors.surface,
                          borderWidth: 0,
                        },
                      ]}
                    >
                      <Text style={[styles.languageDropdownTitle, { color: colors.textMuted }]}>
                        SCANLATION GROUPS ({availableScanlators.length})
                      </Text>
                      <ScrollView
                        style={styles.languageDropdownScroll}
                        showsVerticalScrollIndicator={true}
                      >
                        {/* Option 1: All Groups */}
                        <Pressable
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            triggerHaptic();
                            setSelectedScanlator('all');
                            setIsScanlatorDropdownOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.languageDropdownItem,
                            {
                              backgroundColor:
                                selectedScanlator === 'all'
                                  ? colors.accent + '22'
                                  : pressed
                                  ? colors.surfaceElevated
                                  : 'transparent',
                            },
                          ]}
                        >
                          <Ionicons
                            name="albums-outline"
                            size={16}
                            color={selectedScanlator === 'all' ? colors.accent : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.languageDropdownItemName,
                              {
                                color: selectedScanlator === 'all' ? colors.accent : colors.text,
                                fontWeight: selectedScanlator === 'all' ? 'bold' : 'normal',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            All Groups
                          </Text>
                          <View style={[styles.langCodeBadge, { backgroundColor: colors.borderSubtle }]}>
                            <Text style={[styles.langCodeBadgeText, { color: colors.textSecondary }]}>
                              {chapters.length}
                            </Text>
                          </View>
                          {selectedScanlator === 'all' && (
                            <Ionicons name="checkmark" size={15} color={colors.accent} />
                          )}
                        </Pressable>

                        {/* Option 2: Deduplicated (No duplicates like 1.1, 1.1) */}
                        <Pressable
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            triggerHaptic();
                            setSelectedScanlator('deduplicated');
                            setIsScanlatorDropdownOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.languageDropdownItem,
                            {
                              backgroundColor:
                                selectedScanlator === 'deduplicated'
                                  ? colors.accent + '22'
                                  : pressed
                                  ? colors.surfaceElevated
                                  : 'transparent',
                            },
                          ]}
                        >
                          <Ionicons
                            name="filter-outline"
                            size={16}
                            color={
                              selectedScanlator === 'deduplicated' ? colors.accent : colors.textSecondary
                            }
                          />
                          <Text
                            style={[
                              styles.languageDropdownItemName,
                              {
                                color: selectedScanlator === 'deduplicated' ? colors.accent : colors.text,
                                fontWeight: selectedScanlator === 'deduplicated' ? 'bold' : 'normal',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            All (Deduplicated)
                          </Text>
                          <View style={[styles.langCodeBadge, { backgroundColor: colors.borderSubtle }]}>
                            <Text style={[styles.langCodeBadgeText, { color: colors.textSecondary }]}>
                              {uniqueChapterCount}
                            </Text>
                          </View>
                          {selectedScanlator === 'deduplicated' && (
                            <Ionicons name="checkmark" size={15} color={colors.accent} />
                          )}
                        </Pressable>

                        {/* Individual Scanlator Groups */}
                        {availableScanlators.map((group) => {
                          const isSelected = selectedScanlator === group.name;
                          return (
                            <Pressable
                              key={group.name}
                              onPress={(e: any) => {
                                e?.stopPropagation?.();
                                triggerHaptic();
                                setSelectedScanlator(group.name);
                                setIsScanlatorDropdownOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.languageDropdownItem,
                                {
                                  backgroundColor: isSelected
                                    ? colors.accent + '22'
                                    : pressed
                                    ? colors.surfaceElevated
                                    : 'transparent',
                                },
                              ]}
                            >
                              <Ionicons
                                name="people-outline"
                                size={16}
                                color={isSelected ? colors.accent : colors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.languageDropdownItemName,
                                  {
                                    color: isSelected ? colors.accent : colors.text,
                                    fontWeight: isSelected ? 'bold' : 'normal',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {group.name}
                              </Text>
                              <View style={[styles.langCodeBadge, { backgroundColor: colors.borderSubtle }]}>
                                <Text style={[styles.langCodeBadgeText, { color: colors.textSecondary }]}>
                                  {group.count}
                                </Text>
                              </View>
                              {isSelected && (
                                <Ionicons name="checkmark" size={15} color={colors.accent} />
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Sort Button */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              }}
              style={[
                styles.sortButton,
                { backgroundColor: colors.surfaceElevated, borderWidth: 0 },
              ]}
            >
              <Ionicons
                name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                size={13}
                color={colors.accent}
              />
              <Text style={[styles.sortText, { color: colors.accent }]}>
                {sortOrder === 'asc' ? 'Oldest' : 'Newest'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Chapter List */}
        {isLoadingChapters ? (
          <View>
            {Array.from({ length: 8 }).map((_, i) => (
              <ChapterSkeleton key={i} />
            ))}
          </View>
        ) : chaptersIsCloudflare ? (
          <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                backgroundColor: colors.surfaceElevated || colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="shield-checkmark" size={26} color={colors.accent} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
              Verification Required
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 18,
                maxWidth: 280,
              }}
            >
              This source requires a quick bot check to display chapters.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%', maxWidth: 280 }}>
              <Pressable
                onPress={handleSolveCloudflare}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: Radius.md,
                  backgroundColor: colors.accent,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityRole="button"
                aria-label="Verify with Source"
              >
                <Ionicons name="shield-checkmark-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  Verify
                </Text>
              </Pressable>
              <Pressable
                onPress={() => loadChapters()}
                style={{
                  height: 44,
                  paddingHorizontal: 16,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityRole="button"
                aria-label="Retry Loading Chapters"
              >
                <Ionicons name="reload-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                  Retry
                </Text>
              </Pressable>
            </View>
          </View>
        ) : chapters.length === 0 ? (
          <View style={{ padding: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="document-text-outline" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: Typography.weights.semibold as any }}>
              No chapters available
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
              This series does not have any readable chapters on this source yet.
            </Text>
          </View>
        ) : displayedChapters.length === 0 ? (
          <View style={{ padding: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="filter-outline" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: Typography.weights.semibold as any }}>
              No chapters found
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
              No chapters match the selected scanlation group ({selectedScanlator}).
            </Text>
            <Pressable
              onPress={() => setSelectedScanlator(isMangaDot ? 'deduplicated' : 'all')}
              style={{
                marginTop: 12,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: Radius.md,
                backgroundColor: colors.surfaceElevated,
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: Typography.weights.semibold as any }}>
                Show All Groups
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {displayedChapters.slice(0, visibleChapterCount).map((chapter, idx) => {
              const chapterNum = chapter.attributes.chapter;
              const chapterTitle = chapter.attributes.title;
              const dlItem = downloadMap[chapter.id];
              const isDownloading = dlItem?.status === 'downloading';
              const isPaused = dlItem?.status === 'paused';
              const isDownloaded = dlItem?.status === 'completed';
              const isRead = isChapterRead(chapter.id);
              const isCurrentReading = lastProgress?.chapterId === chapter.id;

              const handleDownload = (e: any) => {
                e.stopPropagation();
                if (isDownloaded) {
                  setConfirmModalConfig({
                    visible: true,
                    title: 'Delete Downloaded Chapter',
                    message: `Ch. ${chapterNum || ''} is saved locally for offline reading. Do you want to delete this chapter from your device?`,
                    iconName: 'trash-outline',
                    confirmText: 'Delete Download',
                    cancelText: 'Cancel',
                    confirmVariant: 'destructive',
                    onConfirm: () => {
                      removeDownloadedChapter(chapter.id, manga.id);
                      setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
                    },
                  });
                  return;
                }

                if (isDownloading) {
                  pauseDownloadChapter(chapter.id);
                  return;
                }

                downloadChapter({
                  chapterId: chapter.id,
                  mangaId: manga.id,
                  mangaTitle: title,
                  chapterNum: chapterNum || '1',
                  chapterTitle: chapterTitle || '',
                  coverUrl,
                });
              };

              return (
                <AnimatedCard
                  key={chapter.id}
                  index={idx}
                  onPress={() => handleReadChapter(chapter.id)}
                  style={[
                    styles.chapterRow,
                    {
                      borderBottomWidth: 0,
                      opacity: isRead ? 0.52 : 1,
                      backgroundColor: isCurrentReading
                        ? colors.accent + '14'
                        : isRead
                        ? (Platform.OS === 'web' ? 'rgba(255,255,255,0.015)' : 'transparent')
                        : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.chapterRowInner}>
                    <View style={styles.chapterInfo}>
                      <View style={styles.chapterTitleRow}>
                        {isCurrentReading && <View style={[styles.chapterActiveDot, { backgroundColor: colors.accent }]} />}
                        <Text
                          style={[
                            styles.chapterNumber,
                            {
                              color: isRead ? colors.textMuted : colors.text,
                              fontWeight: isRead ? Typography.weights.medium : Typography.weights.bold,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {chapterNum ? `Ch. ${chapterNum}` : 'Oneshot'}
                          {chapterTitle ? ` - ${chapterTitle}` : ''}
                        </Text>

                        {/* Status Badges: In-Progress Reading vs Completed Read */}
                        {isCurrentReading ? (
                          <View style={[styles.readingBadge, { backgroundColor: colors.surfaceElevated, borderWidth: 0 }]}>
                            <Ionicons name="book" size={11} color={colors.text} />
                            <Text style={[styles.readingBadgeText, { color: colors.text }]}>
                              Reading · p. {(lastProgress?.pageIndex || 0) + 1}/{lastProgress?.totalPages || chapter.attributes.pages || 1}
                            </Text>
                          </View>
                        ) : isRead ? (
                          <View style={[styles.readBadge, { backgroundColor: colors.surfaceElevated, borderWidth: 0 }]}>
                            <Ionicons name="checkmark-done" size={11} color={colors.emerald} />
                            <Text style={[styles.readBadgeText, { color: colors.emerald }]}>Read</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={[styles.chapterMeta, { color: isRead ? colors.textMuted : colors.textSecondary }]}>
                        {getChapterCredit(chapter)}
                        {chapter.attributes.pages > 0 ? ` · ${chapter.attributes.pages} pages` : ''} ·{' '}
                        {formatChapterDate(chapter.attributes.publishAt || chapter.attributes.readableAt)}
                      </Text>
                    </View>

                    <View style={styles.chapterActions}>
                      <Pressable
                        onPress={handleDownload}
                        hitSlop={8}
                        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                        accessibilityLabel={
                          isDownloading
                            ? 'Pause downloading chapter'
                            : isPaused
                            ? 'Resume downloading chapter'
                            : isDownloaded
                            ? 'Chapter downloaded'
                            : 'Download chapter'
                        }
                      >
                        {isDownloading ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <ActivityIndicator size="small" color={colors.accent} />
                            <Ionicons name="pause-circle" size={16} color={colors.accent} />
                          </View>
                        ) : isPaused ? (
                          <Ionicons name="play-circle" size={20} color="#F59E0B" />
                        ) : isDownloaded ? (
                          <Ionicons name="checkmark-circle" size={20} color={colors.emerald} />
                        ) : (
                          <Ionicons name="download-outline" size={20} color={isRead ? colors.textMuted : colors.textSecondary} />
                        )}
                      </Pressable>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </View>
                </AnimatedCard>
              );
            })}

            {displayedChapters.length > visibleChapterCount && (
              <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 8, paddingHorizontal: 16, gap: 10 }}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setVisibleChapterCount((prev) => prev + 40);
                  }}
                  style={({ pressed }) => [
                    styles.sortButton,
                    {
                      backgroundColor: colors.surfaceElevated,
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: Radius.md,
                      width: '100%',
                      maxWidth: 380,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 0,
                      opacity: pressed ? 0.75 : 1,
                    },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Load next 40 chapters"
                >
                  <Text style={[styles.sortText, { color: colors.accent, fontSize: 13, fontWeight: '700' }]}>
                    Load Next 40 Chapters ({displayedChapters.length - visibleChapterCount} remaining)
                  </Text>
                </Pressable>

                {displayedChapters.length - visibleChapterCount > 40 && (
                  <Pressable
                    onPress={() => {
                      triggerHaptic();
                      setVisibleChapterCount(displayedChapters.length);
                    }}
                    style={({ pressed }) => [
                      { paddingVertical: 6, opacity: pressed ? 0.6 : 1 },
                      Platform.OS === 'web' && { cursor: 'pointer' as any },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Show all chapters"
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      Show All ({displayedChapters.length} chapters)
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </View>
    )}

          {/* Tab 3: Similar View (3x3 Grid Layout) */}
          {activeTab === 'similar' && (
            <View style={styles.tabContentContainer}>
              <View style={styles.similarHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>You May Also Like</Text>
              </View>

              {isLoadingSimilar ? (
                <View style={styles.similarGrid}>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <View key={i} style={{ width: similarCardWidth as any }}>
                      <MangaCardSkeleton
                        width="100%"
                        height={typeof similarCardWidth === 'number' ? Math.floor(similarCardWidth * 1.44) : 190}
                      />
                    </View>
                  ))}
                </View>
              ) : similarManga.length === 0 ? (
                <View style={styles.similarEmptyState}>
                  <Ionicons name="sparkles-outline" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: Typography.weights.semibold as any }}>
                    No recommendations found
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                    We couldn't find similar titles for this manga right now.
                  </Text>
                </View>
              ) : (
                <View style={styles.similarGrid}>
                  {similarManga.slice(0, 9).map((item, idx) => {
                    const itemCover = extractCoverFileName(item);
                    const itemCoverUrl = getCoverUrl(item.id, itemCover, '512');
                    return (
                      <View key={item.id} style={{ width: similarCardWidth as any }}>
                        <MangaCard
                          id={item.id}
                          title={getMangaTitle(item)}
                          coverUrl={itemCoverUrl}
                          author={extractAuthorName(item)}
                          rating={null}
                          follows={null}
                          index={idx}
                          width="100%"
                          onPress={(mangaId) => {
                            router.push({
                              pathname: '/manga/[id]',
                              params: { id: mangaId },
                            });
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

        </View>
      </ScrollView>

      {/* Library Category Selection Action Sheet Modal */}
      <LibraryCategoryModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        currentCategory={libraryEntry?.category}
        isInLibrary={isInLibrary}
        onSelectCategory={handleSelectCategory}
        onRemoveFromLibrary={() => removeFromLibrary(id!)}
      />

      {/* Native Mobile Chapter Scanlation Group Selection Modal (Exclusively for MangaDot) */}
      {isMangaDot && Platform.OS !== 'web' && (
        <Modal
          visible={isScanlatorDropdownOpen}
          transparent={true}
          animationType="none"
          onRequestClose={closeScanlatorModal}
        >
          <MobileModalRoot style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdropPressable}
              onPress={closeScanlatorModal}
              accessibilityRole="button"
              accessibilityLabel="Close scanlation group selection"
            />
            <MobileSheetPanel
              ref={scanlatorSheetRef}
              visible={isScanlatorDropdownOpen}
              onClose={() => setIsScanlatorDropdownOpen(false)}
              style={[
                styles.modalContent,
                { backgroundColor: colors.surface, borderTopColor: 'transparent' },
              ]}
              showHandle={true}
              gestureHandleOnly={true}
            >
              <View style={[styles.modalHeader, { borderBottomColor: 'transparent' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Scanlation Group</Text>
                  <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                    Select translation group ({availableScanlators.length} available)
                  </Text>
                </View>
                <Pressable
                  onPress={closeScanlatorModal}
                  style={styles.closeBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close scanlation modal"
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{ padding: Spacing.md, gap: Spacing.xs, paddingBottom: Spacing['2xl'] }}
                showsVerticalScrollIndicator={true}
              >
                {/* Option 1: All Groups */}
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSelectedScanlator('all');
                    closeScanlatorModal();
                  }}
                  style={({ pressed }) => [
                    styles.mobileLanguageRow,
                    {
                      backgroundColor:
                        selectedScanlator === 'all'
                          ? colors.surfaceElevated
                          : pressed
                          ? colors.surfaceElevated
                          : 'transparent',
                      borderWidth: 0,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="All groups"
                >
                  <Ionicons
                    name="albums-outline"
                    size={22}
                    color={selectedScanlator === 'all' ? colors.accent : colors.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.mobileLanguageName,
                        {
                          color: selectedScanlator === 'all' ? colors.accent : colors.text,
                          fontWeight: selectedScanlator === 'all' ? 'bold' : 'normal',
                        },
                      ]}
                    >
                      All Groups
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                      Show all chapters from every group ({chapters.length})
                    </Text>
                  </View>
                  {selectedScanlator === 'all' && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  )}
                </Pressable>

                {/* Option 2: Deduplicated */}
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSelectedScanlator('deduplicated');
                    closeScanlatorModal();
                  }}
                  style={({ pressed }) => [
                    styles.mobileLanguageRow,
                    {
                      backgroundColor:
                        selectedScanlator === 'deduplicated'
                          ? colors.surfaceElevated
                          : pressed
                          ? colors.surfaceElevated
                          : 'transparent',
                      borderWidth: 0,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="All deduplicated groups"
                >
                  <Ionicons
                    name="filter-outline"
                    size={22}
                    color={selectedScanlator === 'deduplicated' ? colors.accent : colors.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.mobileLanguageName,
                        {
                          color: selectedScanlator === 'deduplicated' ? colors.accent : colors.text,
                          fontWeight: selectedScanlator === 'deduplicated' ? 'bold' : 'normal',
                        },
                      ]}
                    >
                      All (Deduplicated)
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                      No duplicates like 1.1, 1.1 ({uniqueChapterCount} unique chapters)
                    </Text>
                  </View>
                  {selectedScanlator === 'deduplicated' && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  )}
                </Pressable>

                {/* Option 3+: Individual groups */}
                {availableScanlators.map((group) => {
                  const isSelected = selectedScanlator === group.name;
                  return (
                    <Pressable
                      key={group.name}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedScanlator(group.name);
                        closeScanlatorModal();
                      }}
                      style={({ pressed }) => [
                        styles.mobileLanguageRow,
                        {
                          backgroundColor: isSelected
                            ? colors.surfaceElevated
                            : pressed
                            ? colors.surfaceElevated
                            : 'transparent',
                          borderWidth: 0,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Scanlation group ${group.name}`}
                    >
                      <Ionicons
                        name="people-outline"
                        size={22}
                        color={isSelected ? colors.accent : colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.mobileLanguageName,
                            {
                              color: isSelected ? colors.accent : colors.text,
                              fontWeight: isSelected ? 'bold' : 'normal',
                            },
                          ]}
                        >
                          {group.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                          {group.count} {group.count === 1 ? 'chapter' : 'chapters'}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </MobileSheetPanel>
          </MobileModalRoot>
        </Modal>
      )}

      {/* Native Mobile Chapter Language Selection Modal */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={isLanguageDropdownOpen}
          transparent={true}
          animationType="none"
          onRequestClose={closeLanguageModal}
        >
          <MobileModalRoot style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdropPressable}
              onPress={closeLanguageModal}
              accessibilityRole="button"
              accessibilityLabel="Close language selection"
            />
            <MobileSheetPanel
              ref={languageSheetRef}
              visible={isLanguageDropdownOpen}
              onClose={() => setIsLanguageDropdownOpen(false)}
              style={[
                styles.modalContent,
                { backgroundColor: colors.surface, borderTopColor: 'transparent' },
              ]}
              showHandle={true}
              gestureHandleOnly={true}
            >
              <View style={[styles.modalHeader, { borderBottomColor: 'transparent' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Chapter Language</Text>
                  <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                    Select translation language ({availableLanguages.length} available)
                  </Text>
                </View>
                <Pressable
                  onPress={closeLanguageModal}
                  style={styles.closeBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close language modal"
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{ padding: Spacing.md, gap: Spacing.xs, paddingBottom: Spacing['2xl'] }}
                showsVerticalScrollIndicator={true}
              >
                {availableLanguages.map((langCode) => {
                  const langInfo = getLanguageInfo(langCode);
                  const isSelected = langCode === selectedLanguage;
                  return (
                    <Pressable
                      key={langCode}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedLanguage(langCode);
                        closeLanguageModal();
                      }}
                      style={({ pressed }) => [
                        styles.mobileLanguageRow,
                        {
                          backgroundColor: isSelected
                            ? colors.surfaceElevated
                            : pressed
                            ? colors.surfaceElevated
                            : 'transparent',
                          borderWidth: 0,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${langInfo.name}`}
                    >
                      <Image
                        source={{ uri: langInfo.flagUrl }}
                        style={styles.mobileLanguageFlagImage}
                        contentFit="cover"
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.mobileLanguageName,
                            {
                              color: isSelected ? colors.text : colors.textSecondary,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {langInfo.name}
                        </Text>
                      </View>
                      <View style={[styles.langCodeBadge, { backgroundColor: colors.surfaceElevated }]}>
                        <Text style={[styles.langCodeBadgeText, { color: colors.textSecondary }]}>
                          {langCode.toUpperCase()}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </MobileSheetPanel>
          </MobileModalRoot>
        </Modal>
      )}

      {/* Selective & Batch Chapter Download Modal */}
      <Modal
        visible={downloadModalVisible}
        transparent
        animationType={Platform.OS === 'web' ? 'fade' : 'none'}
        onRequestClose={closeDownloadModal}
      >
        <MobileModalRoot style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={closeDownloadModal}
            accessibilityRole="button"
            accessibilityLabel="Close download modal"
          />
          <MobileSheetPanel
            ref={downloadSheetRef}
            visible={downloadModalVisible}
            onClose={() => setDownloadModalVisible(false)}
            style={[
              styles.downloadModalContent,
              {
                backgroundColor: colors.surface,
              },
            ]}
            showHandle={Platform.OS !== 'web'}
            gestureHandleOnly={true}
          >
            {/* Modal Header */}
            <View style={styles.downloadModalHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.downloadModalTitle, { color: colors.text }]}>
                  Download Chapters
                </Text>
                <Text style={[styles.downloadModalSub, { color: colors.textMuted }]}>
                  {displayedChapters.length} chapters · {alreadyDownloadedCount} downloaded
                </Text>
              </View>
              <Pressable
                onPress={closeDownloadModal}
                style={({ pressed }) => [
                  styles.downloadCloseBtn,
                  { backgroundColor: colors.surfaceElevated },
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close download modal"
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Quick Batch Selection Presets */}
            <View style={styles.downloadPresetBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.downloadPresetScrollContent}
              >
                {/* All / None Chip */}
                <Pressable
                  onPress={() => handleQuickPreset('all')}
                  style={({ pressed }) => [
                    styles.downloadChip,
                    {
                      backgroundColor:
                        selectedDownloadIds.size === undownloadedChaptersCount && undownloadedChaptersCount > 0
                          ? colors.accent
                          : colors.surfaceElevated,
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle select all chapters"
                >
                  <Ionicons
                    name={
                      selectedDownloadIds.size === undownloadedChaptersCount && undownloadedChaptersCount > 0
                        ? 'checkmark-done'
                        : 'list-outline'
                    }
                    size={14}
                    color={
                      selectedDownloadIds.size === undownloadedChaptersCount && undownloadedChaptersCount > 0
                        ? '#FFFFFF'
                        : colors.text
                    }
                  />
                  <Text
                    style={[
                      styles.downloadChipText,
                      {
                        color:
                          selectedDownloadIds.size === undownloadedChaptersCount && undownloadedChaptersCount > 0
                            ? '#FFFFFF'
                            : colors.text,
                      },
                    ]}
                  >
                    {selectedDownloadIds.size === undownloadedChaptersCount && undownloadedChaptersCount > 0
                      ? 'Deselect All'
                      : 'All'}
                  </Text>
                </Pressable>

                {/* Next 5 */}
                {undownloadedChaptersCount >= 5 && (
                  <Pressable
                    onPress={() => handleQuickPreset('next5')}
                    style={({ pressed }) => [
                      styles.downloadChip,
                      { backgroundColor: colors.surfaceElevated },
                      pressed && { opacity: 0.75 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Select next 5 chapters"
                  >
                    <Ionicons name="add" size={14} color={colors.text} />
                    <Text style={[styles.downloadChipText, { color: colors.text }]}>Next 5</Text>
                  </Pressable>
                )}

                {/* Next 10 */}
                {undownloadedChaptersCount >= 10 && (
                  <Pressable
                    onPress={() => handleQuickPreset('next10')}
                    style={({ pressed }) => [
                      styles.downloadChip,
                      { backgroundColor: colors.surfaceElevated },
                      pressed && { opacity: 0.75 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Select next 10 chapters"
                  >
                    <Ionicons name="add" size={14} color={colors.text} />
                    <Text style={[styles.downloadChipText, { color: colors.text }]}>Next 10</Text>
                  </Pressable>
                )}

                {/* Next 25 */}
                {undownloadedChaptersCount >= 25 && (
                  <Pressable
                    onPress={() => handleQuickPreset('next25')}
                    style={({ pressed }) => [
                      styles.downloadChip,
                      { backgroundColor: colors.surfaceElevated },
                      pressed && { opacity: 0.75 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Select next 25 chapters"
                  >
                    <Ionicons name="add" size={14} color={colors.text} />
                    <Text style={[styles.downloadChipText, { color: colors.text }]}>Next 25</Text>
                  </Pressable>
                )}

                {/* Unread */}
                <Pressable
                  onPress={() => handleQuickPreset('unread')}
                  style={({ pressed }) => [
                    styles.downloadChip,
                    { backgroundColor: colors.surfaceElevated },
                    pressed && { opacity: 0.75 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Select unread chapters"
                >
                  <Ionicons name="book-outline" size={13} color={colors.text} />
                  <Text style={[styles.downloadChipText, { color: colors.text }]}>Unread</Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* Flat Chapters List */}
            <FlatList
              data={displayedChapters}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.downloadFlatListContent}
              ItemSeparatorComponent={() => (
                <View style={[styles.downloadRowSeparator, { backgroundColor: colors.border, opacity: 0.3 }]} />
              )}
              initialNumToRender={20}
              maxToRenderPerBatch={25}
              windowSize={7}
              renderItem={({ item }) => {
                const isSelected = selectedDownloadIds.has(item.id);
                const dlItem = downloadMap[item.id];
                const isDownloaded = dlItem?.status === 'completed';
                const isDownloading = dlItem?.status === 'downloading';
                const isRead = isChapterRead(item.id);

                return (
                  <Pressable
                    onPress={() => {
                      if (isDownloaded) return;
                      handleToggleSelectDownload(item.id);
                    }}
                    disabled={isDownloaded}
                    style={({ pressed }) => [
                      styles.downloadCompactRow,
                      isSelected && { backgroundColor: `${colors.accent}14` },
                      isDownloaded && { opacity: 0.55 },
                      pressed && !isDownloaded && { opacity: 0.7 },
                      Platform.OS === 'web' && !isDownloaded && { cursor: 'pointer' },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected, disabled: isDownloaded }}
                    accessibilityLabel={
                      item.attributes.chapter
                        ? `Chapter ${item.attributes.chapter}`
                        : item.attributes.title || 'Chapter'
                    }
                  >
                    {/* Flat custom round indicator */}
                    <View
                      style={[
                        styles.downloadCheckCircle,
                        isDownloaded
                          ? { borderColor: colors.emerald, backgroundColor: `${colors.emerald}20` }
                          : isSelected
                          ? { borderColor: colors.accent, backgroundColor: colors.accent }
                          : { borderColor: colors.textMuted, opacity: 0.4 },
                      ]}
                    >
                      {isDownloaded ? (
                        <Ionicons name="checkmark" size={13} color={colors.emerald} />
                      ) : isSelected ? (
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      ) : null}
                    </View>

                    {/* Chapter Info */}
                    <View style={styles.downloadRowContent}>
                      <View style={styles.downloadRowTopLine}>
                        <Text
                          style={[
                            styles.downloadRowChapterNum,
                            { color: isRead ? colors.textMuted : colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {item.attributes.chapter ? `Ch. ${item.attributes.chapter}` : 'Oneshot'}
                          {item.attributes.title ? `  ${item.attributes.title}` : ''}
                        </Text>
                      </View>
                      <View style={styles.downloadRowMetaLine}>
                        <Text style={[styles.downloadRowMetaText, { color: colors.textMuted }]}>
                          {item.attributes.pages} pages
                        </Text>
                        {isRead && (
                          <Text style={[styles.downloadRowMetaText, { color: colors.textMuted }]}>
                            · Read
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Status Pill Badge */}
                    {isDownloaded ? (
                      <View style={[styles.downloadCompactBadge, { backgroundColor: `${colors.emerald}18` }]}>
                        <Ionicons name="checkmark-done" size={12} color={colors.emerald} />
                        <Text style={[styles.downloadCompactBadgeText, { color: colors.emerald }]}>Saved</Text>
                      </View>
                    ) : isDownloading ? (
                      <View style={styles.downloadProgressWrap}>
                        <ActivityIndicator size="small" color={colors.accent} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />

            {/* Minimalist Bottom Action Bar */}
            <View style={[styles.downloadFooterBar, { backgroundColor: colors.surface }]}>
              <View style={styles.downloadFooterInfo}>
                <Text style={[styles.downloadFooterCount, { color: colors.text }]}>
                  {selectedDownloadIds.size} {selectedDownloadIds.size === 1 ? 'chapter' : 'chapters'}
                </Text>
                <Text style={[styles.downloadFooterPages, { color: colors.textMuted }]}>
                  {selectedDownloadIds.size > 0 ? `~${selectedTotalPages} pages total` : 'None selected'}
                </Text>
              </View>

              <Pressable
                onPress={handleStartBatchDownload}
                disabled={selectedDownloadIds.size === 0}
                style={({ pressed }) => [
                  styles.downloadActionBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: selectedDownloadIds.size > 0 ? (pressed ? 0.85 : 1) : 0.35,
                  },
                  pressed && selectedDownloadIds.size > 0 && { transform: [{ scale: 0.97 }] },
                  Platform.OS === 'web' && selectedDownloadIds.size > 0 && { cursor: 'pointer' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Download ${selectedDownloadIds.size} chapters`}
              >
                <Ionicons name="arrow-down" size={17} color="#FFFFFF" />
                <Text style={styles.downloadActionBtnText}>
                  Download {selectedDownloadIds.size > 0 ? `(${selectedDownloadIds.size})` : ''}
                </Text>
              </Pressable>
            </View>
          </MobileSheetPanel>
        </MobileModalRoot>
      </Modal>
      {/* Sleek Custom Confirmation Dialog */}
      <ConfirmationModal
        visible={confirmModalConfig.visible}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        iconName={confirmModalConfig.iconName || 'trash-outline'}
        confirmVariant={confirmModalConfig.confirmVariant || 'primary'}
        confirmText={confirmModalConfig.confirmText || 'OK'}
        cancelText={confirmModalConfig.cancelText}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* Full-Screen Cover Image Lightbox Modal */}
      <Modal
        visible={isCoverLightboxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCoverLightboxOpen(false)}
      >
        <Pressable
          style={styles.lightboxOverlay}
          onPress={() => setIsCoverLightboxOpen(false)}
        >
          {coverUrl && (
            <ZoomableImage
              source={{ uri: coverUrl, headers: coverHeaders }}
              style={styles.lightboxImage}
              contentFit="contain"
              onTap={() => setIsCoverLightboxOpen(false)}
            />
          )}
        </Pressable>
      </Modal>

      {/* In-App Cloudflare WebView Verification Modal */}
      {isCfInAppModalOpen && (
        <Modal
          visible={isCfInAppModalOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsCfInAppModalOpen(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                height: 52,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                  Human Verification
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={() => {
                    setIsCfInAppModalOpen(false);
                    loadChapters();
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: Radius.full,
                    backgroundColor: colors.accent,
                  }}
                  accessibilityRole="button"
                  aria-label="Close Verification"
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Done</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (cfInAppUrl) {
                      Linking.openURL(cfInAppUrl).catch(() => {});
                    }
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surfaceElevated || colors.surface,
                  }}
                  accessibilityRole="button"
                  aria-label="Open in external browser"
                >
                  <Ionicons name="open-outline" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {WebView && Platform.OS !== 'web' ? (
              <WebView
                source={{ uri: cfInAppUrl }}
                userAgent={DEFAULT_USER_AGENT}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                style={{ flex: 1, backgroundColor: colors.background }}
                injectedJavaScript={`
                  (function() {
                    var interval = setInterval(function() {
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

                      var rawPre = document.querySelector('pre');
                      var rawText = (rawPre ? rawPre.innerText : '') || (document.body ? document.body.innerText : '') || '';
                      var trimmed = rawText.trim();
                      var isJson = (trimmed.startsWith('{') || trimmed.startsWith('[')) && (trimmed.includes('"chapters"') || trimmed.includes('"data"') || trimmed.includes('"manga"'));

                      var hasRealContent = isJson || (
                        document.querySelectorAll('.row-content-chapter, .chapter-list, .panel-story-info-description, #contentBox, .story-info-right, .manga-info-text, h1, .chapter-name').length > 0
                      );

                      var cookie = document.cookie || '';
                      var hasClearance = cookie.includes('cf_clearance');

                      if (hasClearance || hasRealContent || (document.readyState === 'complete' && !isChallenge)) {
                        clearInterval(interval);
                        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'CF_SOLVED',
                          cookie: cookie,
                          url: href
                        }));
                      }
                    }, 1200);
                  })();
                  true;
                `}
                onMessage={async (event: any) => {
                  try {
                    const parsed = JSON.parse(event.nativeEvent.data);
                    if (parsed.type === 'CF_SOLVED') {
                      const domain = chaptersCfDomain;
                      if (domain) {
                        webViewBridge.setDomainVerified(domain, true);
                      }
                      if (parsed.cookie && domain) {
                        const match = parsed.cookie.match(/cf_clearance=([^;]+)/);
                        if (match) {
                          await CloudFlareCookieManager.setCookie(domain, match[0]);
                        }
                      }
                      setIsCfInAppModalOpen(false);
                      setChaptersIsCloudflare(false);
                      loadMangaDetails();
                      loadChapters();
                    }
                  } catch {}
                }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Text style={{ color: colors.text, fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
                  Verification opened in a new tab. When finished, tap Done.
                </Text>
                <Pressable
                  onPress={() => {
                    setIsCfInAppModalOpen(false);
                    setChaptersIsCloudflare(false);
                    loadMangaDetails();
                    loadChapters();
                  }}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: Radius.md,
                    backgroundColor: colors.accent,
                  }}
                  accessibilityRole="button"
                  aria-label="Done Verification"
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Done</Text>
                </Pressable>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webCenteredContent: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 24 : 0,
  },
  heroContainer: {
    position: 'relative',
    paddingBottom: Spacing.xs,
  },
  backdropImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.45,
  },
  backdropGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Top Navigation Bar
  topBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  topIconButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  topBarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroContent: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
    gap: Platform.OS === 'web' ? Spacing.xl : 14,
  },
  coverContainer: {
    width: Platform.OS === 'web' ? 155 : 115,
    height: Platform.OS === 'web' ? 225 : 165,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  mobileExpandBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 4,
    borderRadius: Radius.xs,
    borderWidth: 0,
  },
  coverHoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMeta: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  mangaTitle: {
    fontSize: Platform.OS === 'web' ? 26 : 17,
    fontWeight: Typography.weights.bold,
    lineHeight: Platform.OS === 'web' ? 32 : 22,
    letterSpacing: -0.3,
  },
  authorText: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statusFlagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusFlagText: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
  },
  statusPill: {
    paddingHorizontal: Platform.OS === 'web' ? 8 : 4,
    paddingVertical: Platform.OS === 'web' ? 4 : 2,
    borderRadius: Radius.xs,
    borderWidth: 0,
  },
  statusPillText: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 13,
    fontWeight: Typography.weights.bold,
  },
  heroCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    borderRadius: 20,
    marginTop: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  heroCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.2,
  },

  // Segmented Tab Bar
  segmentedTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginTop: Spacing.xs,
    marginBottom: 0,
    paddingHorizontal: Spacing.lg,
  },
  segmentedTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    position: 'relative',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  segmentedTabText: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: Typography.weights.medium,
  },
  segmentedTabTextActive: {
    fontWeight: Typography.weights.bold,
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 1.5,
  },

  // Content ScrollView
  contentScrollView: {
    flex: 1,
  },
  contentScrollContainer: {
    paddingBottom: 16,
  },

  // Tab Content Container
  tabContentContainer: {
    paddingBottom: 0,
  },

  // Details Sections (Flat Design)
  detailsSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Platform.OS === 'web' ? 14 : 10,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: Typography.weights.bold,
    marginBottom: Platform.OS === 'web' ? 6 : 4,
    letterSpacing: -0.2,
  },
  genresWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 0,
  },
  genreChipText: {
    fontSize: 12,
    fontWeight: Typography.weights.medium,
  },
  synopsisContainer: {
    marginTop: 4,
  },
  synopsisText: {
    fontSize: Platform.OS === 'web' ? 15 : Typography.sizes.body,
    lineHeight: Platform.OS === 'web' ? 24 : 20,
  },
  expandText: {
    fontSize: Platform.OS === 'web' ? 14 : Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
    marginTop: 6,
  },

  // Information Flat List
  flatInfoList: {
    marginTop: 2,
  },
  flatInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  flatInfoLabel: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
  },
  flatInfoValue: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
    maxWidth: '65%',
    textAlign: 'right',
  },

  // Similar Manga Tab
  similarHeaderRow: {
    paddingHorizontal: Spacing.lg,
    marginTop: Platform.OS === 'web' ? Spacing.sm : 6,
    marginBottom: Platform.OS === 'web' ? Spacing.xs : 6,
  },
  similarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: Spacing.lg,
  },
  similarSkeletonCard: {
    width: '48%',
    height: 200,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  similarEmptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginTop: Platform.OS === 'web' ? Spacing.sm : 6,
    marginBottom: Platform.OS === 'web' ? Spacing.xs : 4,
    gap: Spacing.sm,
    zIndex: 100,
  },
  chapterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 100,
  },
  chapterHeaderTitle: {
    fontSize: Platform.OS === 'web' ? 14 : 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
  },
  languagePickerContainer: {
    position: 'relative',
    zIndex: 100,
  },
  languagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 0,
  },
  languagePickerFlagImage: {
    width: 18,
    height: 12,
    borderRadius: 2,
  },
  languagePickerText: {
    fontSize: Platform.OS === 'web' ? 12 : 11,
    fontWeight: Typography.weights.semibold,
    maxWidth: 110,
  },
  languageWebBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
  groupPickerContainer: {
    position: 'relative',
    zIndex: 101,
  },
  groupDropdownMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 240,
    borderRadius: Radius.lg,
    borderWidth: 0,
    padding: 8,
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.45)',
    elevation: 20,
    zIndex: 9999,
  },
  languageDropdownMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 220,
    borderRadius: Radius.lg,
    borderWidth: 0,
    padding: 8,
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.45)',
    elevation: 20,
    zIndex: 9999,
  },
  languageDropdownTitle: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  languageDropdownScroll: {
    maxHeight: 280,
  },
  languageDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    gap: 8,
  },
  languageDropdownItemFlagImage: {
    width: 20,
    height: 14,
    borderRadius: 2,
  },
  languageDropdownItemName: {
    flex: 1,
    fontSize: 13,
  },
  langCodeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  langCodeBadgeText: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
  },
  mobileLanguageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 0,
    gap: 12,
  },
  mobileLanguageFlagImage: {
    width: 24,
    height: 17,
    borderRadius: 3,
  },
  mobileLanguageName: {
    fontSize: Typography.sizes.body,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 0,
  },
  sortText: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  chapterRow: {
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 0,
  },
  chapterRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  chapterActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
  chapterInfo: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  chapterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  chapterNumber: {
    fontSize: Platform.OS === 'web' ? 16 : Typography.sizes.body,
  },
  chapterMeta: {
    fontSize: Platform.OS === 'web' ? 13 : Typography.sizes.caption,
  },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: 0,
  },
  readBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.3,
  },
  readingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: 0,
  },
  readingBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },

  /* Modal Styling */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    padding: Platform.OS === 'web' ? Spacing.xl : 0,
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 580 : undefined,
    maxHeight: Platform.OS === 'web' ? ('82vh' as any) : '82%',
    borderRadius: Platform.OS === 'web' ? Radius.xl : undefined,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 0,
    borderTopWidth: 0,
    overflow: 'hidden',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 0,
  },
  modalTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  modalSub: {
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  downloadModalContent: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    maxHeight: Platform.OS === 'web' ? 520 : '60%',
    borderRadius: Platform.OS === 'web' ? Radius.xl : undefined,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 0,
    overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
    elevation: 16,
  },
  downloadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  downloadModalTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.3,
  },
  downloadModalSub: {
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  downloadCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadPresetBar: {
    paddingVertical: Spacing.sm,
  },
  downloadPresetScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  downloadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    minHeight: 32,
  },
  downloadChipText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  downloadFlatListContent: {
    paddingVertical: Spacing.xs,
  },
  downloadRowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.lg,
  },
  downloadCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    minHeight: 48,
    gap: Spacing.md,
  },
  downloadCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadRowContent: {
    flex: 1,
    gap: 2,
  },
  downloadRowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadRowChapterNum: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  downloadRowMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  downloadRowMetaText: {
    fontSize: Typography.sizes.caption,
  },
  downloadCompactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  downloadCompactBadgeText: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
  },
  downloadProgressWrap: {
    paddingRight: 4,
  },
  downloadFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  downloadFooterInfo: {
    gap: 2,
  },
  downloadFooterCount: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  downloadFooterPages: {
    fontSize: Typography.sizes.caption,
  },
  downloadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 6,
    minHeight: 44,
  },
  downloadActionBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: '90%',
    height: '90%',
    maxWidth: Platform.OS === 'web' ? 650 : 450,
    maxHeight: Platform.OS === 'web' ? 900 : 700,
    aspectRatio: 0.68,
    borderRadius: Radius.lg,
  },
});
