/**
 * Reader Engine Screen — Multi-Mode Reader (Webtoon, RTL, LTR, Single, Double)
 * Includes MangaDex Official Reader Side Menu Drawer (ReaderMenuDrawer)
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  useWindowDimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useReaderStore } from '../../src/store/readerStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { useLibraryStore } from '../../src/store/libraryStore';
import { useDownloadStore } from '../../src/store/downloadStore';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
import {
  getChapterPages,
  getMangaChapters,
  getMangaDetails,
  getChapterDetails,
  getMangaTitle,
  extractCoverFileName,
  getCoverUrl,
  extractScanlationGroupName,
  extractUploaderUsername,
} from '../../src/api/mangadex';
import {
  getUniversalChapterPages,
  getUniversalMangaDetails,
  getUniversalMangaChapters,
  isExternalSource,
} from '../../src/sources/adapter';
import { ReaderThemes } from '../../constants/Colors';
import { ReaderMenuDrawer } from '../../src/components/ReaderMenuDrawer';
import { OfflineState } from '../../src/components/OfflineState';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { ApiLogger } from '../../src/services/apiLogger';
import { ZoomableImage } from '../../src/components/ZoomableImage';
import type { ReadingMode, Chapter } from '../../src/types';

function getContrastTextColor(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#09090B' : '#FFFFFF';
}

function getChapterNumberFromId(id: string): number | null {
  const match = id.match(/(?:chapter[/:_-]|:)(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

const MODE_LABELS: Record<ReadingMode, string> = {
  webtoon: 'Long Strip (Webtoon)',
  rtl: 'Right to Left (Manga)',
  ltr: 'Left to Right (Comic)',
  single: 'Single Page',
  double: 'Double Page',
};

interface ReaderImagePageProps {
  url: string;
  index: number;
  width: number;
  height: number;
  contentFit: 'contain' | 'cover' | 'fill';
  zoomEnabled?: boolean;
  onTap?: (x: number) => void;
  onAspectMeasured?: (ratio: number) => void;
  headers?: Record<string, string>;
}

const ReaderImagePage = React.memo(function ReaderImagePage({
  url,
  index,
  width,
  height,
  contentFit,
  zoomEnabled = true,
  onTap,
  onAspectMeasured,
  headers,
}: ReaderImagePageProps) {
  const colors = useThemeColors();
  const theme = useReaderStore((s) => s.theme);
  const readerTheme = ReaderThemes[theme];
  const [isError, setIsError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const imageSource = useMemo(() => {
    if (!url) return null;
    const baseSource = headers ? { uri: url, headers } : { uri: url };
    if (retryCount === 0) return baseSource;
    const separator = url.includes('?') ? '&' : '?';
    return { ...baseSource, uri: `${url}${separator}retry=${retryCount}` };
  }, [url, retryCount, headers]);

  const handleImageError = useCallback(() => {
    ApiLogger.logRequest({
      timestamp: Date.now(),
      method: 'GET_IMG',
      url,
      status: 429,
      statusText: 'Image Load Failed',
      durationMs: 0,
      error: `Page ${index + 1} image failed to load (Rate limit or network error)`,
    });

    if (retryCount < 3) {
      setIsRetrying(true);
      const delay = Math.pow(2, retryCount + 1) * 800;
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        setIsRetrying(false);
      }, delay);
    } else {
      setIsError(true);
      setIsRetrying(false);
    }
  }, [url, index, retryCount]);

  const handleManualRetry = useCallback(() => {
    setIsError(false);
    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);
    setTimeout(() => setIsRetrying(false), 500);
  }, []);

  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      {isError ? (
        <View style={[styles.imageErrorCard, { width: Math.min(width - 32, 420), borderColor: colors.border }]}>
          <Ionicons name="warning-outline" size={32} color={colors.accent} />
          <Text style={[styles.imageErrorTitle, { color: colors.text }]}>Page {index + 1} Load Failed</Text>
          <Text style={[styles.imageErrorSubtext, { color: colors.textSecondary }]}>
            MangaDex rate limit (429) or network timeout.
          </Text>

          <Pressable
            onPress={handleManualRetry}
            style={({ pressed }) => [
              styles.imageRetryBtn,
              { backgroundColor: colors.accent },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="refresh" size={16} color={getContrastTextColor(colors.accent)} />
            <Text style={[styles.imageRetryBtnText, { color: getContrastTextColor(colors.accent) }]}>Retry Page {index + 1}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
          {imageSource && (
            <ZoomableImage
              source={imageSource}
              style={{ width, height }}
              contentFit={contentFit}
              zoomEnabled={zoomEnabled}
              recyclingKey={url}
              onTap={onTap}
              onLoad={(e) => {
                setIsError(false);
                if (e.source?.width && e.source?.height && onAspectMeasured) {
                  onAspectMeasured(e.source.height / e.source.width);
                }
              }}
              onError={handleImageError}
            />
          )}

          {isRetrying && (
            <View style={[styles.imageRetryOverlay, { backgroundColor: readerTheme.background }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.imageRetryingText, { color: readerTheme.text }]}>
                Rate limited / Retrying page {index + 1} ({retryCount + 1}/3)...
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

interface WebtoonPageItemProps {
  url: string;
  index: number;
  webtoonWidth: number;
  windowHeight: number;
  imageFit: 'fit_both' | 'fit_width' | 'fit_height';
  onTap: (x: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  headers?: Record<string, string>;
}

const WebtoonPageItem = React.memo(function WebtoonPageItem({
  url,
  index,
  webtoonWidth,
  windowHeight,
  imageFit,
  onTap,
  onLayout,
  headers,
}: WebtoonPageItemProps) {
  const [aspectRatio, setAspectRatio] = useState<number>(1.5);

  const displayHeight =
    imageFit === 'fit_height' ? windowHeight : webtoonWidth * aspectRatio;
  const displayFit = imageFit === 'fit_height' ? 'contain' : 'fill';

  return (
    <View onLayout={onLayout}>
      <ReaderImagePage
      url={url}
      index={index}
      width={webtoonWidth}
      height={displayHeight}
      contentFit={displayFit}
      zoomEnabled={false}
      onTap={onTap}
      headers={headers}
        onAspectMeasured={(ratio) => {
          setAspectRatio((prev) => (prev === ratio ? prev : ratio));
        }}
      />
    </View>
  );
});

export default function ReaderScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { checkNetwork } = useNetworkStatus();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { chapterId, mangaId, page } = useLocalSearchParams<{
    chapterId: string;
    mangaId?: string;
    page?: string;
  }>();

  // Dynamic Tap zones for page turning
  const TAP_LEFT = windowWidth * 0.3;
  const TAP_RIGHT = windowWidth * 0.7;

  const mode = useReaderStore((s) => s.mode);
  const theme = useReaderStore((s) => s.theme);
  const dataSaver = useReaderStore((s) => s.dataSaver);
  const showPageNumber = useReaderStore((s) => s.showPageNumber);
  const hapticsEnabled = useReaderStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = useReaderStore((s) => s.setHapticsEnabled);
  const setMode = useReaderStore((s) => s.setMode);
  const controlsVisible = useReaderStore((s) => s.controlsVisible);
  const toggleControls = useReaderStore((s) => s.toggleControls);
  const setControlsVisible = useReaderStore((s) => s.setControlsVisible);

  const addHistoryEntry = useHistoryStore((s) => s.addEntry);

  // Local state
  const [pages, setPages] = useState<string[]>([]);
  const [nextChapterPages, setNextChapterPages] = useState<string[]>([]);
  const [nextChapterPageHeaders, setNextChapterPageHeaders] = useState<Record<string, string> | undefined>();
  const [activeWebtoonChapterId, setActiveWebtoonChapterId] = useState<string | undefined>(chapterId);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [imageFit, setImageFit] = useState<'fit_both' | 'fit_width' | 'fit_height'>('fit_both');
  const [headerHidden, setHeaderHidden] = useState(false);
  const [pageTimelineWidth, setPageTimelineWidth] = useState(0);

  const [mangaTitle, setMangaTitle] = useState('Manga');
  const [chapterTitle, setChapterTitle] = useState(`Chapter`);
  useDocumentTitle(`${mangaTitle} • ${chapterTitle}`);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [scanlationGroup, setScanlationGroup] = useState<string>('Scanlation Team');
  const [currentChapterPublishAt, setCurrentChapterPublishAt] = useState<string | undefined>();
  const [uploaderName, setUploaderName] = useState<string>('Uploader');
  const [resolvedMangaId, setResolvedMangaId] = useState<string | undefined>(mangaId);
  const [pageHeaders, setPageHeaders] = useState<Record<string, string> | undefined>(undefined);

  const flatListRef = useRef<FlatList>(null);
  const webtoonListRef = useRef<FlatList<string>>(null);
  const restoredChapterIdRef = useRef<string | null>(null);
  const resumeTargetPageRef = useRef(0);
  const resumeRestoreAttemptsRef = useRef(0);
  const isProgrammaticScrollRef = useRef(false);
  const webtoonJumpAttemptsRef = useRef(0);
  const pendingWebtoonJumpRef = useRef<number | null>(null);
  const webtoonJumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextChapterLoadRequestedRef = useRef(false);
  const lastWebtoonPositionRef = useRef<number | null>(null);
  const webtoonLayoutsRef = useRef(new Map<number, { y: number; height: number }>());
  const pendingWebtoonOffsetRef = useRef(0);
  const currentWebtoonIndexRef = useRef(0);
  const webtoonScrollOffsetRef = useRef(0);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 30,
  }).current;
  const readerTheme = ReaderThemes[theme];

  const moveWebtoonTo = useCallback((index: number, scrollOffset = 0, animated = false) => {
    isProgrammaticScrollRef.current = true;
    pendingWebtoonJumpRef.current = index;
    pendingWebtoonOffsetRef.current = Math.max(0, scrollOffset);

    const layout = webtoonLayoutsRef.current.get(index);
    if (layout) {
      webtoonListRef.current?.scrollToOffset({
        offset: Math.max(0, layout.y + pendingWebtoonOffsetRef.current),
        animated,
      });
      pendingWebtoonJumpRef.current = null;
      return;
    }

    webtoonListRef.current?.scrollToIndex({ index, animated, viewPosition: 0 });
  }, []);

  const handleWebtoonPageLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    webtoonLayoutsRef.current.set(index, { y, height });

    if (pendingWebtoonJumpRef.current !== index) return;
    webtoonListRef.current?.scrollToOffset({
      offset: Math.max(0, y + pendingWebtoonOffsetRef.current),
      animated: false,
    });
    pendingWebtoonJumpRef.current = null;
  }, []);

  // Load chapter pages & metadata
  useEffect(() => {
    if (!chapterId) return;
    loadPages();
    loadMangaMeta();
  }, [chapterId, dataSaver, mangaId]);

  // FlatList only uses initialScrollIndex on its first mount. This effect restores
  // a saved webtoon position after the chapter has been loaded and laid out.
  useEffect(() => {
    if (
      mode !== 'webtoon' ||
      isLoading ||
      pages.length === 0 ||
      resumeTargetPageRef.current === 0 ||
      restoredChapterIdRef.current === chapterId
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      moveWebtoonTo(resumeTargetPageRef.current, pendingWebtoonOffsetRef.current);
      restoredChapterIdRef.current = chapterId;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [chapterId, isLoading, mode, moveWebtoonTo, pages.length]);

  const loadPages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setOfflineUnavailable(false);
      restoredChapterIdRef.current = null;
      resumeTargetPageRef.current = 0;
      resumeRestoreAttemptsRef.current = 0;
      isProgrammaticScrollRef.current = false;
      webtoonJumpAttemptsRef.current = 0;
      pendingWebtoonJumpRef.current = null;
      if (webtoonJumpTimerRef.current) clearTimeout(webtoonJumpTimerRef.current);
      setActiveWebtoonChapterId(chapterId);
      setNextChapterPages([]);
      setNextChapterPageHeaders(undefined);
      nextChapterLoadRequestedRef.current = false;
      lastWebtoonPositionRef.current = null;
      webtoonLayoutsRef.current.clear();
      pendingWebtoonOffsetRef.current = 0;
      currentWebtoonIndexRef.current = 0;
      webtoonScrollOffsetRef.current = 0;

      // Check if downloaded locally
      const downloadedCh = useDownloadStore.getState().getChapter(chapterId!);
      let loadedPages: string[];
      if (downloadedCh && downloadedCh.status === 'completed' && downloadedCh.localPages.length > 0) {
        loadedPages = downloadedCh.localPages;
        if (downloadedCh.mangaTitle) setMangaTitle(downloadedCh.mangaTitle);
        if (downloadedCh.chapterNum) setChapterTitle(`Ch. ${downloadedCh.chapterNum}`);
      } else {
        const isOnline = await checkNetwork();
        if (!isOnline) {
          setPages([]);
          setOfflineUnavailable(true);
          return;
        }

        const isExt = isExternalSource(chapterId!);
        if (isExt) {
          const result = await getUniversalChapterPages(chapterId!);
          loadedPages = result.pages;
          setPageHeaders(result.headers);
        } else {
          const result = await getChapterPages(chapterId!, dataSaver);
          loadedPages = result.pages;
        }
      }

      setPages(loadedPages);

      let targetPage = 0;
      if (page !== undefined && page !== null && page !== '') {
        targetPage = parseInt(page, 10);
      } else {
        const historyEntry = useHistoryStore.getState().entries.find((e) => e.chapterId === chapterId);
        if (historyEntry) {
          targetPage = historyEntry.pageIndex;
          pendingWebtoonOffsetRef.current = historyEntry.scrollOffset || 0;
        }
      }
      const maxPage = Math.max(0, loadedPages.length - 1);
      const clampedPage = Math.max(0, Math.min(isNaN(targetPage) ? 0 : targetPage, maxPage));
      resumeTargetPageRef.current = clampedPage;
      setCurrentPage(clampedPage);
    } catch (err) {
      console.error('Failed to load pages:', err);
      const isOnline = await checkNetwork();
      if (!isOnline) {
        setPages([]);
        setOfflineUnavailable(true);
      } else {
        setError('Failed to load chapter pages. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadMangaMeta = async () => {
    try {
      if (!(await checkNetwork())) return;
      let targetMangaId = mangaId || resolvedMangaId;
      let chapterLang = 'en';

      const isExt = isExternalSource(chapterId!);
      let chapterData: Chapter | null = null;

      if (!isExt) {
        chapterData = await getChapterDetails(chapterId!);
        if (chapterData) {
          chapterLang = chapterData.attributes?.translatedLanguage || 'en';
          setScanlationGroup(extractScanlationGroupName(chapterData));
          setUploaderName(extractUploaderUsername(chapterData));

          const mangaRel = chapterData.relationships?.find((r) => r.type === 'manga');
          if (mangaRel?.id && !targetMangaId) {
            targetMangaId = mangaRel.id;
            setResolvedMangaId(mangaRel.id);
          }
        }
      }

      if (targetMangaId) {
        const isExtManga = isExternalSource(targetMangaId);
        const [manga, chList] = await Promise.all([
          isExtManga ? getUniversalMangaDetails(targetMangaId) : getMangaDetails(targetMangaId),
          isExtManga
            ? getUniversalMangaChapters(targetMangaId).then((chs) => ({ data: chs, total: chs.length }))
            : getMangaChapters(targetMangaId, chapterLang, 500, 0, 'desc'),
        ]);

        const title = getMangaTitle(manga);
        setMangaTitle(title);

        let allChapters = chList.data || [];
        if (chapterData && !allChapters.some((c) => c.id === chapterId)) {
          allChapters = [chapterData, ...allChapters];
        }
        setChapterList(allChapters);

        const coverFile = extractCoverFileName(manga);
        const url = getCoverUrl(manga.id, coverFile, '256');
        setCoverUrl(url);

        const activeCh = allChapters.find((c) => c.id === chapterId);
        if (activeCh) {
          setCurrentChapterPublishAt(activeCh.attributes.publishAt || activeCh.attributes.readableAt);
          const num = activeCh.attributes.chapter ? `Ch. ${activeCh.attributes.chapter}` : 'Chapter';
          const chTitle = activeCh.attributes.title ? ` - ${activeCh.attributes.title}` : '';
          setChapterTitle(`${num}${chTitle}`);
          const grp = extractScanlationGroupName(activeCh);
          if (grp && grp !== 'No Scanlation Group') {
            setScanlationGroup(grp);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load reader metadata:', err);
    }
  };

  // Save progress to history & update library unread badge
  useEffect(() => {
    if (pages.length > 0 && chapterId && (mode !== 'webtoon' || activeWebtoonChapterId === chapterId)) {
      const activeMangaId = mangaId ?? chapterId!;
      addHistoryEntry({
        mangaId: activeMangaId,
        chapterId: chapterId!,
        title: mangaTitle,
        chapterTitle: chapterTitle,
        coverUrl: coverUrl,
        pageIndex: currentPage,
        totalPages: pages.length,
        scrollOffset: mode === 'webtoon' ? webtoonScrollOffsetRef.current : 0,
      });

      // If manga is bookmarked in the library, update read progress & unread count
      const libStore = useLibraryStore.getState();
      if (libStore.isInLibrary(activeMangaId)) {
        let unread: number | undefined;
        if (chapterList && chapterList.length > 0) {
          const idx = chapterList.findIndex((c) => c.id === chapterId);
          if (idx >= 0) {
            unread = Math.max(0, idx);
          }
        }
        libStore.updateReadProgress(activeMangaId, chapterId!, currentPage, unread);
      }
    }
  }, [activeWebtoonChapterId, chapterId, currentPage, mode, pages.length, mangaTitle, chapterTitle, coverUrl, chapterList]);

  // Chapter Switching
  const currentChapterIdx = chapterList.findIndex((c) => c.id === chapterId);
  const currentChapter = currentChapterIdx >= 0
    ? chapterList[currentChapterIdx]
    : chapterList.find((c) => {
        const currentNumber = getChapterNumberFromId(chapterId || '');
        return currentNumber !== null && Number(c.attributes.chapter) === currentNumber;
      });
  const currentChapterNumber = currentChapter?.attributes.chapter
    ? Number(currentChapter.attributes.chapter)
    : getChapterNumberFromId(chapterId || '');

  const nextChapterId = currentChapterNumber !== null
    ? chapterList
        .filter((chapter) => Number(chapter.attributes.chapter) > currentChapterNumber)
        .sort((a, b) => Number(a.attributes.chapter) - Number(b.attributes.chapter))[0]?.id
    : (currentChapterIdx > 0 ? chapterList[currentChapterIdx - 1]?.id : undefined);

  // Keep the next chapter unloaded until the reader reaches the current chapter's
  // boundary. This mirrors Kotatsu's lazy adjacent-chapter loading behavior.
  useEffect(() => {
    setNextChapterPages([]);
    setNextChapterPageHeaders(undefined);
    nextChapterLoadRequestedRef.current = false;
    setActiveWebtoonChapterId(chapterId);
  }, [dataSaver, mode, nextChapterId]);

  const loadNextChapterPages = useCallback(async () => {
    if (mode !== 'webtoon' || !nextChapterId || nextChapterLoadRequestedRef.current) return;
    nextChapterLoadRequestedRef.current = true;
    try {
      const result = isExternalSource(nextChapterId)
        ? await getUniversalChapterPages(nextChapterId)
        : await getChapterPages(nextChapterId, dataSaver);
      setNextChapterPages(result.pages);
      if ('headers' in result) setNextChapterPageHeaders(result.headers);
    } catch (err) {
      nextChapterLoadRequestedRef.current = false;
      console.warn('Unable to load next chapter webtoon pages:', err);
    }
  }, [dataSaver, mode, nextChapterId]);

  const activeAppendedChapter = activeWebtoonChapterId === nextChapterId ? chapterList.find((c) => c.id === nextChapterId) : undefined;
  const activePageCount = activeAppendedChapter ? nextChapterPages.length : pages.length;
  const activeChapterTitle = activeAppendedChapter
    ? `${activeAppendedChapter.attributes.chapter ? `Ch. ${activeAppendedChapter.attributes.chapter}` : 'Chapter'}${activeAppendedChapter.attributes.title ? ` - ${activeAppendedChapter.attributes.title}` : ''}`
    : chapterTitle;
  const activeChapterPublishAt = activeAppendedChapter?.attributes.publishAt || activeAppendedChapter?.attributes.readableAt || currentChapterPublishAt;
  const activeScanlationGroup = activeAppendedChapter ? extractScanlationGroupName(activeAppendedChapter) : scanlationGroup;
  const activeUploaderName = activeAppendedChapter ? extractUploaderUsername(activeAppendedChapter) : uploaderName;
  const webtoonPages = useMemo(
    () => (nextChapterPages.length > 0 ? [...pages, ...nextChapterPages] : pages),
    [nextChapterPages, pages]
  );

  const handleWebtoonViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const firstVisible = viewableItems?.[0]?.index;
    if (firstVisible === null || firstVisible === undefined) return;

    if (firstVisible >= pages.length - 2 && nextChapterPages.length === 0 && nextChapterId) {
      loadNextChapterPages();
    }

    const pendingJump = pendingWebtoonJumpRef.current;
    if (pendingJump !== null && viewableItems.some((item: any) => item.index === pendingJump)) {
      const layout = webtoonLayoutsRef.current.get(pendingJump);
      if (layout) {
        webtoonListRef.current?.scrollToOffset({
          offset: Math.max(0, layout.y + pendingWebtoonOffsetRef.current),
          animated: false,
        });
        pendingWebtoonJumpRef.current = null;
      }
    } else if (pendingJump !== null) {
      return;
    }

    if (lastWebtoonPositionRef.current === firstVisible) return;
    lastWebtoonPositionRef.current = firstVisible;
    currentWebtoonIndexRef.current = firstVisible;

    if (firstVisible < pages.length) {
      setActiveWebtoonChapterId(chapterId);
      setCurrentPage(firstVisible);
    } else if (nextChapterPages.length > 0) {
      setActiveWebtoonChapterId(nextChapterId);
      setCurrentPage(firstVisible - pages.length);
    }
  }, [chapterId, loadNextChapterPages, nextChapterId, nextChapterPages.length, pages.length]);

  useEffect(() => {
    if (!activeAppendedChapter || currentPage < 0 || nextChapterPages.length === 0) return;
    addHistoryEntry({
      mangaId: mangaId ?? resolvedMangaId ?? activeAppendedChapter.id,
      chapterId: activeAppendedChapter.id,
      title: mangaTitle,
      chapterTitle: activeChapterTitle,
      coverUrl,
      pageIndex: currentPage,
      totalPages: nextChapterPages.length,
      scrollOffset: webtoonScrollOffsetRef.current,
    });
  }, [activeAppendedChapter, activeChapterTitle, addHistoryEntry, coverUrl, currentPage, mangaId, mangaTitle, nextChapterPages.length, resolvedMangaId]);

  const saveWebtoonProgress = useCallback(() => {
    if (mode !== 'webtoon' || activePageCount === 0) return;
    const activeChapterId = activeAppendedChapter?.id || chapterId;
    if (!activeChapterId) return;
    addHistoryEntry({
      mangaId: mangaId ?? resolvedMangaId ?? activeChapterId,
      chapterId: activeChapterId,
      title: mangaTitle,
      chapterTitle: activeChapterTitle,
      coverUrl,
      pageIndex: currentPage,
      totalPages: activePageCount,
      scrollOffset: webtoonScrollOffsetRef.current,
    });
  }, [activeAppendedChapter, activeChapterTitle, activePageCount, addHistoryEntry, chapterId, coverUrl, currentPage, mangaId, mangaTitle, mode, resolvedMangaId]);

  const prevChapterId = (currentChapterIdx >= 0 && currentChapterIdx < chapterList.length - 1)
    ? chapterList[currentChapterIdx + 1]?.id
    : undefined;

  const hasNextChapter = !!nextChapterId;
  const hasPrevChapter = !!prevChapterId;

  const navigateToChapter = useCallback(
    (targetChapterId: string) => {
      setSideMenuVisible(false);
      const mId = mangaId || resolvedMangaId;
      const query = mId ? `?mangaId=${mId}` : '';
      router.replace(`/reader/${targetChapterId}${query}` as any);
    },
    [mangaId, resolvedMangaId, router]
  );

  const handlePrevChapter = useCallback(() => {
    if (prevChapterId) {
      navigateToChapter(prevChapterId);
    }
  }, [prevChapterId, navigateToChapter]);

  const handleNextChapter = useCallback(() => {
    if (nextChapterId) {
      navigateToChapter(nextChapterId);
    }
  }, [nextChapterId, navigateToChapter]);

  // ─── Page Navigation ───────────────────────────────────────────

  const goToPage = useCallback(
    (pageIdx: number) => {
      const pageCount = activeAppendedChapter ? nextChapterPages.length : pages.length;
      const clamped = Math.max(0, Math.min(pageIdx, pageCount - 1));
      setCurrentPage(clamped);

      if (mode === 'webtoon') {
        const globalIndex = activeAppendedChapter ? pages.length + clamped : clamped;
        moveWebtoonTo(globalIndex, 0, true);
      } else if (mode === 'double') {
        const spreadIdx = Math.floor(clamped / 2);
        try {
          flatListRef.current?.scrollToOffset({
            offset: spreadIdx * windowWidth,
            animated: false,
          });
        } catch {
          flatListRef.current?.scrollToIndex({
            index: spreadIdx,
            animated: false,
          });
        }
      } else {
        try {
          flatListRef.current?.scrollToOffset({
            offset: clamped * windowWidth,
            animated: false,
          });
        } catch {
          flatListRef.current?.scrollToIndex({
            index: clamped,
            animated: false,
          });
        }
      }
    },
    [activeAppendedChapter, mode, moveWebtoonTo, nextChapterPages.length, pages.length, windowWidth]
  );

  const goToNextPageOrChapter = useCallback(() => {
    if (currentPage < activePageCount - 1) {
      goToPage(currentPage + 1);
    } else if (activeAppendedChapter) {
      return;
    } else if (nextChapterPages.length > 0) {
      setActiveWebtoonChapterId(nextChapterId);
      setCurrentPage(0);
      isProgrammaticScrollRef.current = true;
      webtoonListRef.current?.scrollToIndex({
        index: pages.length,
        animated: true,
        viewPosition: 0,
      });
    } else if (hasNextChapter && nextChapterPages.length === 0) {
      if (hapticsEnabled && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      handleNextChapter();
    }
  }, [activeAppendedChapter, activePageCount, currentPage, goToPage, hasNextChapter, handleNextChapter, hapticsEnabled, nextChapterPages.length]);

  const goToPrevPageOrChapter = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    } else if (activeAppendedChapter) {
      setActiveWebtoonChapterId(chapterId);
      setCurrentPage(pages.length - 1);
      isProgrammaticScrollRef.current = true;
      webtoonListRef.current?.scrollToIndex({ index: pages.length - 1, animated: true, viewPosition: 0 });
    } else if (hasPrevChapter) {
      if (hapticsEnabled && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      handlePrevChapter();
    }
  }, [activeAppendedChapter, chapterId, currentPage, goToPage, hasPrevChapter, handlePrevChapter, hapticsEnabled, pages.length]);

  const handlePageTap = useCallback(
    (x: number) => {
      const isLeft = x < windowWidth * 0.5;

      if (Platform.OS !== 'web') {
        const centerMin = windowWidth * 0.35;
        const centerMax = windowWidth * 0.65;
        if (x >= centerMin && x <= centerMax) {
          toggleControls();
          return;
        }

        if (hapticsEnabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }

      // In webtoon mode, disable left/right tap navigation
      if (mode === 'webtoon') {
        return;
      }

      if (mode === 'rtl') {
        if (isLeft) {
          goToNextPageOrChapter();
        } else {
          goToPrevPageOrChapter();
        }
      } else {
        if (isLeft) {
          goToPrevPageOrChapter();
        } else {
          goToNextPageOrChapter();
        }
      }
    },
    [windowWidth, mode, toggleControls, goToNextPageOrChapter, goToPrevPageOrChapter, hapticsEnabled]
  );

  // Web Keyboard Navigation
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (mode === 'webtoon') {
          // Disable left/right navigation in webtoon mode
          return;
        }
        if (mode === 'rtl') {
          goToNextPageOrChapter();
        } else {
          goToPrevPageOrChapter();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === ' ') {
        e.preventDefault();
        if (mode === 'webtoon') {
          // Disable left/right navigation in webtoon mode
          return;
        }
        if (mode === 'rtl') {
          goToPrevPageOrChapter();
        } else {
          goToNextPageOrChapter();
        }
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (mode === 'webtoon') {
          webtoonListRef.current?.scrollToOffset({
            offset: Math.max(0, (currentPage - 1) * windowHeight * 0.8),
            animated: true,
          });
        } else {
          goToPrevPageOrChapter();
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        if (mode === 'webtoon') {
          webtoonListRef.current?.scrollToOffset({
            offset: (currentPage + 1) * windowHeight * 0.8,
            animated: true,
          });
        } else {
          goToNextPageOrChapter();
        }
      } else if (e.key === '[' || e.key === 'p' || e.key === 'P') {
        if (hasPrevChapter) {
          e.preventDefault();
          handlePrevChapter();
        }
      } else if (e.key === ']' || e.key === 'n' || e.key === 'N') {
        if (hasNextChapter) {
          e.preventDefault();
          handleNextChapter();
        }
      } else if (e.key === 'm' || e.key === 'M' || e.key === 'Escape') {
        setSideMenuVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    mode,
    currentPage,
    pages.length,
    hasNextChapter,
    hasPrevChapter,
    goToNextPageOrChapter,
    goToPrevPageOrChapter,
    handleNextChapter,
    handlePrevChapter,
    windowHeight,
  ]);

  // ─── Render Page Items ─────────────────────────────────────────

  const renderSinglePage = (url: string, index: number) => {
    let fitMode: 'contain' | 'cover' | 'fill' = 'contain';
    if (imageFit === 'fit_width') fitMode = 'cover';
    else if (imageFit === 'fit_height') fitMode = 'contain';
    else fitMode = 'contain';

    return (
      <ReaderImagePage
        key={index}
        url={url}
        index={index}
        width={windowWidth}
        height={windowHeight}
        contentFit={fitMode}
        onTap={handlePageTap}
        headers={pageHeaders}
      />
    );
  };

  const renderDoubleSpread = (pageIndex: number) => {
    const leftUrl = pages[pageIndex];
    const rightUrl = pages[pageIndex + 1];

    return (
      <View
        key={pageIndex}
        style={[styles.doubleSpreadContainer, { width: windowWidth, height: windowHeight }]}
      >
        <ReaderImagePage
          url={mode === 'rtl' ? rightUrl || leftUrl : leftUrl}
          index={pageIndex}
          width={windowWidth / 2}
          height={windowHeight}
          contentFit="contain"
          onTap={handlePageTap}
          headers={pageHeaders}
        />
        {rightUrl && (
          <ReaderImagePage
            url={mode === 'rtl' ? leftUrl : rightUrl}
            index={pageIndex + 1}
            width={windowWidth / 2}
            height={windowHeight}
            contentFit="contain"
            onTap={handlePageTap}
            headers={pageHeaders}
          />
        )}
      </View>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: readerTheme.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: readerTheme.text }]}>
          Loading chapter pages...
        </Text>
      </View>
    );
  }

  if (offlineUnavailable) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <OfflineState onRetry={loadPages} />
      </View>
    );
  }

  if (error || pages.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={52} color={colors.accent} />
        <Text style={[styles.errorText, { color: colors.text }]}>
          {error || 'No pages found for this chapter.'}
        </Text>

        {/* Navigation & Action Controls for Broken / Missing Chapter */}
        <View style={styles.errorActionRow}>
          {hasPrevChapter && (
            <Pressable
              style={({ pressed }) => [
                styles.errorNavBtn,
                { opacity: pressed ? 0.7 : 1, borderColor: colors.border, backgroundColor: colors.surface },
              ]}
              onPress={handlePrevChapter}
            >
              <Ionicons name="arrow-back" size={16} color={colors.text} />
              <Text style={[styles.errorNavBtnText, { color: colors.text }]}>Prev Ch.</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              { opacity: pressed ? 0.8 : 1, backgroundColor: colors.accent },
            ]}
            onPress={loadPages}
          >
            <Ionicons name="refresh" size={16} color={getContrastTextColor(colors.accent)} />
            <Text style={[styles.retryText, { color: getContrastTextColor(colors.accent) }]}>Retry</Text>
          </Pressable>

          {hasNextChapter && (
            <Pressable
              style={({ pressed }) => [
                styles.errorNextBtn,
                { opacity: pressed ? 0.8 : 1, backgroundColor: colors.accent },
              ]}
              onPress={handleNextChapter}
            >
              <Text style={[styles.errorNextBtnText, { color: getContrastTextColor(colors.accent) }]}>Next Ch.</Text>
              <Ionicons name="arrow-forward" size={16} color={getContrastTextColor(colors.accent)} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={styles.backTextButton}
          onPress={() => {
            if (mangaId) {
              router.replace(`/manga/${mangaId}` as any);
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)' as any);
            }
          }}
        >
          <Text style={[styles.backTextLabel, { color: colors.textMuted }]}>
            ← Return to Manga Details
          </Text>
        </Pressable>
      </View>
    );
  }

  const webtoonWidth = Math.min(windowWidth, 800);
  const pageTimelineDotCount = Math.min(activePageCount, 18);

  return (
    <View style={[styles.readerContainer, { backgroundColor: readerTheme.background }]}>
      <StatusBar hidden={headerHidden || !controlsVisible} />

      {/* Reader Layout Mode */}
      {mode === 'webtoon' ? (
        <FlatList
          key={`flatlist-webtoon-${chapterId}`}
          ref={webtoonListRef}
          style={styles.webtoonList}
          data={webtoonPages}
          keyExtractor={(item, index) => `webtoon-${item}-${index}`}
          renderItem={({ item, index }) => (
            <WebtoonPageItem
              url={item}
              index={index}
              webtoonWidth={webtoonWidth}
              windowHeight={windowHeight}
              imageFit={imageFit}
              onTap={handlePageTap}
              headers={index < pages.length ? pageHeaders : nextChapterPageHeaders}
              onLayout={(event) => handleWebtoonPageLayout(index, event)}
            />
          )}
          onViewableItemsChanged={handleWebtoonViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          removeClippedSubviews={false}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={50}
          initialNumToRender={5}
          windowSize={7}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Bring the target into the render window. Its onLayout callback then
            // restores the exact page-relative offset without repeated snapping.
            webtoonListRef.current?.scrollToOffset({
              offset: averageItemLength * index,
              animated: false,
            });
          }}
          onScroll={({ nativeEvent }) => {
            const layout = webtoonLayoutsRef.current.get(currentWebtoonIndexRef.current);
            if (layout) {
              webtoonScrollOffsetRef.current = Math.max(0, nativeEvent.contentOffset.y - layout.y);
            }
          }}
          onScrollEndDrag={saveWebtoonProgress}
          onMomentumScrollEnd={saveWebtoonProgress}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            // A page-selector/history restore may still be retrying while image
            // heights settle. Once the reader drags, their scroll must win.
            isProgrammaticScrollRef.current = false;
            pendingWebtoonJumpRef.current = null;
            if (webtoonJumpTimerRef.current) {
              clearTimeout(webtoonJumpTimerRef.current);
              webtoonJumpTimerRef.current = null;
            }
          }}
          bounces
          alwaysBounceVertical
          overScrollMode="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center' }}
        />
      ) : mode === 'double' ? (
        <FlatList
          key={`flatlist-double-${chapterId}`}
          ref={flatListRef}
          data={Array.from({ length: Math.ceil(pages.length / 2) })}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `double-${i}`}
          renderItem={({ index }) => renderDoubleSpread(index * 2)}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(
              e.nativeEvent.contentOffset.x / windowWidth
            );
            setCurrentPage(newIndex * 2);
          }}
        />
      ) : (
        <FlatList
          key={`flatlist-single-${chapterId}`}
          ref={flatListRef}
          data={pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `single-${i}`}
          renderItem={({ item, index }) => renderSinglePage(item, index)}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(
              e.nativeEvent.contentOffset.x / windowWidth
            );
            setCurrentPage(newIndex);
          }}
          initialScrollIndex={currentPage > 0 && currentPage < pages.length ? currentPage : undefined}
          getItemLayout={(_, index) => ({
            length: windowWidth,
            offset: windowWidth * index,
            index,
          })}
        />
      )}

      {/* Page Number Indicator */}
      {showPageNumber && activePageCount > 0 && (
        <View style={[styles.pageIndicator, { backgroundColor: colors.surfaceElevated }]} pointerEvents="none">
          <Text style={[styles.pageIndicatorText, { color: colors.text }]}>
            {currentPage + 1} / {activePageCount}
          </Text>
        </View>
      )}

      {/* Controls Overlay (Mobile Only) */}
      {Platform.OS !== 'web' && controlsVisible && (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
          {/* Top Bar */}
          <View style={[styles.topBar, { backgroundColor: colors.surfaceElevated }]}>
            <Pressable
              onPress={() => {
                setControlsVisible(false);
                if (router.canGoBack()) {
                  router.back();
                } else if (mangaId) {
                  router.replace(`/manga/${mangaId}` as any);
                } else {
                  router.replace('/(tabs)' as any);
                }
              }}
              style={styles.controlButton}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>

            <View style={styles.topTitleCol}>
              <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
                {activeChapterTitle}
              </Text>
              <Text style={[styles.topBarSubTitle, { color: colors.textMuted }]} numberOfLines={1}>
                Page {currentPage + 1} of {activePageCount}
              </Text>
            </View>

            <Pressable
              onPress={() => setSideMenuVisible(true)}
              style={styles.controlButton}
            >
              <Ionicons name="options" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Mode Selector Quick Bar */}
          {showModeSelector && (
            <View style={[styles.modeSelectorContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {(Object.keys(MODE_LABELS) as ReadingMode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setShowModeSelector(false);
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  style={[
                    styles.modeOption,
                    mode === m && { backgroundColor: colors.accentSubtle },
                  ]}
                >
                  <Text
                    style={[
                      styles.modeOptionText,
                      { color: mode === m ? colors.text : colors.textMuted },
                    ]}
                  >
                    {MODE_LABELS[m]}
                  </Text>
                  {mode === m && (
                    <Ionicons name="checkmark" size={18} color={colors.text} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Chapter and page timeline navigation */}
          <View style={[styles.bottomBar, { backgroundColor: colors.surfaceElevated }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous chapter"
              disabled={!hasPrevChapter}
              onPress={handlePrevChapter}
              style={({ pressed }) => [
                styles.chapterNavButton,
                {
                  backgroundColor: pressed && hasPrevChapter ? colors.accentSubtle : 'transparent',
                  opacity: !hasPrevChapter ? 0.3 : 1,
                },
              ]}
            >
              <Ionicons name="play-skip-back" size={18} color={colors.text} />
            </Pressable>

            <View
              style={styles.pageTimeline}
              onLayout={(event) => setPageTimelineWidth(event.nativeEvent.layout.width)}
            >
              <View style={[styles.timelineRail, { backgroundColor: colors.borderSubtle }]} />
              <View
                style={[
                  styles.timelineProgress,
                  {
                    width: `${activePageCount > 1 ? (currentPage / (activePageCount - 1)) * 100 : 0}%`,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
              {Array.from({ length: pageTimelineDotCount }, (_, dotIndex) => {
                const progress = pageTimelineDotCount > 1
                  ? dotIndex / (pageTimelineDotCount - 1)
                  : 0;
                return (
                  <View
                    key={dotIndex}
                    pointerEvents="none"
                    style={[
                      styles.timelineDot,
                      {
                        left: `${Math.min(100, progress * 100)}%`,
                        backgroundColor: colors.border,
                      },
                    ]}
                  />
                );
              })}
              <View
                pointerEvents="none"
                style={[
                  styles.timelineCurrentMarker,
                  {
                    left: `${activePageCount > 1 ? (currentPage / (activePageCount - 1)) * 100 : 0}%`,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
              <Pressable
                style={StyleSheet.absoluteFill}
                accessibilityRole="adjustable"
                accessibilityLabel={`Page ${currentPage + 1} of ${activePageCount}`}
                onPress={(e) => {
                  const ratio = pageTimelineWidth > 0
                    ? e.nativeEvent.locationX / pageTimelineWidth
                    : 0;
                  const targetPage = Math.round(ratio * (activePageCount - 1));
                  goToPage(targetPage);
                }}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next chapter"
              disabled={!hasNextChapter}
              onPress={handleNextChapter}
              style={({ pressed }) => [
                styles.chapterNavButton,
                {
                  backgroundColor: pressed && hasNextChapter ? colors.accentSubtle : 'transparent',
                  opacity: !hasNextChapter ? 0.3 : 1,
                },
              ]}
            >
              <Ionicons name="play-skip-forward" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Official MangaDex Reader Side Control Drawer */}
      <ReaderMenuDrawer
        visible={sideMenuVisible}
        onClose={() => setSideMenuVisible(false)}
        mangaTitle={mangaTitle}
        chapterTitle={activeChapterTitle}
        scanlationGroup={activeScanlationGroup}
        uploaderName={activeUploaderName}
        currentChapterPublishAt={activeChapterPublishAt}
        currentPage={currentPage}
        totalPages={activePageCount}
        onSelectPage={goToPage}
        currentChapterId={activeWebtoonChapterId || chapterId!}
        chapters={chapterList.map((c) => ({
          id: c.id,
          chapterNum: c.attributes.chapter ?? '?',
          title: c.attributes.title ?? '',
          publishAt: c.attributes.publishAt || c.attributes.readableAt,
        }))}
        onSelectChapter={navigateToChapter}
        hasPrevChapter={hasPrevChapter}
        hasNextChapter={hasNextChapter}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
        readingMode={mode}
        onChangeReadingMode={(m) => setMode(m)}
        imageFit={imageFit}
        onChangeImageFit={(fit) => setImageFit(fit)}
        headerHidden={headerHidden}
        onToggleHeaderHidden={() => setHeaderHidden(!headerHidden)}
        hapticsEnabled={hapticsEnabled}
        onToggleHaptics={() => setHapticsEnabled(!hapticsEnabled)}
        onOpenSettings={() => {
          setSideMenuVisible(false);
          router.push('/(tabs)/settings' as any);
        }}
        onGoBackToManga={() => {
          setSideMenuVisible(false);
          if (mangaId) {
            router.push(`/manga/${mangaId}` as any);
          } else if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)' as any);
          }
        }}
        onGoToHome={() => {
          setSideMenuVisible(false);
          router.replace('/(tabs)' as any);
        }}
      />

      {/* Web Persistent Floating Menu Window Trigger Button */}
      {Platform.OS === 'web' && !sideMenuVisible && (
        <Pressable
          onPress={() => setSideMenuVisible(true)}
          style={({ pressed }) => [
            styles.webFloatingMenuTrigger,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Ionicons name="options-outline" size={18} color={colors.text} />
          <Text style={[styles.webFloatingMenuTriggerText, { color: colors.text }]}>Menu</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  readerContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.sizes.body,
    marginTop: Spacing.md,
  },
  errorText: {
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  errorActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
  },
  errorNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  errorNavBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  errorNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  errorNextBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  retryText: {
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.footnote,
  },
  backTextButton: {
    marginTop: Spacing.md,
    padding: Spacing.xs,
  },
  backTextLabel: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },

  // Paged mode
  pagedPageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagedImage: {},

  // Double spread
  doubleSpreadContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doubleImage: {},

  // Webtoon / Long Strip
  webtoonList: {
    flex: 1,
    width: '100%',
  },
  webtoonImage: {},

  // Controls Overlay
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 45,
    paddingBottom: Spacing.sm,
  },
  topTitleCol: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  topBarTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  topBarSubTitle: {
    fontSize: Typography.sizes.caption,
  },
  controlButton: {
    padding: Spacing.sm,
  },

  // Mode Selector Dropdown
  modeSelectorContainer: {
    position: 'absolute',
    top: 90,
    right: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    width: 220,
    zIndex: 30,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  modeOptionText: {
    fontSize: Typography.sizes.footnote,
  },

  // Page Indicator
  pageIndicator: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  pageIndicatorText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.bold,
  },

  // Bottom Slider Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  chapterNavButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  pageTimeline: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  timelineRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: Radius.full,
  },
  timelineProgress: {
    position: 'absolute',
    left: 0,
    height: 2,
    borderRadius: Radius.full,
  },
  timelineDot: {
    position: 'absolute',
    top: 18,
    width: 4,
    height: 4,
    marginLeft: -2,
    borderRadius: Radius.full,
  },
  timelineCurrentMarker: {
    position: 'absolute',
    top: 6,
    width: 3,
    height: 28,
    marginLeft: -1.5,
    borderRadius: Radius.full,
  },

  webFloatingMenuTrigger: {
    position: 'fixed' as any,
    bottom: 28,
    right: 28,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.5)',
    elevation: 10,
    zIndex: 999,
    cursor: 'pointer' as any,
  },
  webFloatingMenuTriggerText: {
    fontSize: 13,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.3,
  },
  imageErrorCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 20,
  },
  imageErrorTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },
  imageErrorSubtext: {
    fontSize: Typography.sizes.footnote,
    textAlign: 'center',
  },
  imageRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
    marginTop: 8,
  },
  imageRetryBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  imageRetryOverlay: {
    position: 'absolute',
    bottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageRetryingText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  zoomResetBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 99,
  },
  zoomResetText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
});
