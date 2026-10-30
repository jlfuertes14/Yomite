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
  Modal,
  AppState,
  Image as NativeImage,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { parseChapterNumber } from '../../src/utils/chapter';
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
import { CloudFlareCookieManager } from '../../src/sources/network/cloudflare';
import { DEFAULT_USER_AGENT } from '../../src/sources/network/httpClient';
import {
  webViewBridge,
  imageBridgeCache,
  isCloudflareProtectedUrl,
} from '../../src/sources/network/webViewBridge';
import { fetchBufferAsDataUri } from '../../src/sources/network/imageHelper';
import type { ReadingMode, Chapter } from '../../src/types';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';

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

type ImageDimensions = { width: number; height: number };

async function getPageDimensions(
  url: string,
  headers?: Record<string, string>,
): Promise<ImageDimensions | null> {
  if (!url) return null;

  // On Web, use standard browser Image to avoid react-native-web's unhandled 16ms setInterval loop
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return new Promise((resolve) => {
      try {
        const img = new window.Image();
        img.onload = () => {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
          } else {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      } catch {
        resolve(null);
      }
    });
  }

  // On Native, provide explicit success & failure callbacks
  return new Promise((resolve) => {
    try {
      if (
        headers &&
        Object.keys(headers).length > 0 &&
        typeof (NativeImage as any).getSizeWithHeaders === 'function'
      ) {
        (NativeImage as any).getSizeWithHeaders(
          url,
          headers,
          (width: number, height: number) => resolve({ width, height }),
          () => resolve(null)
        );
        return;
      }
      NativeImage.getSize(
        url,
        (width: number, height: number) => resolve({ width, height }),
        () => resolve(null)
      );
    } catch {
      resolve(null);
    }
  });
}

async function classifyDefaultReadingMode({
  pages,
  headers,
  originalLanguage,
  sourceHint,
}: {
  pages: string[];
  headers?: Record<string, string>;
  originalLanguage?: string;
  sourceHint: string;
}): Promise<ReadingMode> {
  const sample = pages.filter(Boolean).slice(0, 8);
  const dimensions = (await Promise.all(sample.map((url) => getPageDimensions(url, headers))))
    .filter((size): size is ImageDimensions => Boolean(size && size.width > 0 && size.height > 0));

  const ratios = dimensions.map((size) => size.height / size.width).sort((a, b) => a - b);
  const medianRatio = ratios.length > 0 ? ratios[Math.floor(ratios.length / 2)] : 0;
  const veryTallPageRatio = ratios.length > 0
    ? ratios.filter((ratio) => ratio >= 2.2).length / ratios.length
    : 0;
  const tallPageRatio = ratios.length > 0
    ? ratios.filter((ratio) => ratio >= 1.9).length / ratios.length
    : 0;

  const language = (originalLanguage || '').toLowerCase();
  const source = sourceHint.toLowerCase();
  const koreanSignal = /^(ko|kr)([-_]|$)/.test(language);
  const webtoonSourceSignal = /webtoon|manhwa|asura|reaper|flame|void|toonkotsu|webtoonxyz/.test(source);

  // Dimensions are deliberately evaluated across several pages. One unusually
  // tall manga page is not enough to classify the whole title as a webtoon.
  let webtoonScore = 0;
  if (koreanSignal) webtoonScore += 3;
  if (webtoonSourceSignal) webtoonScore += 3;
  if (medianRatio >= 2.2) webtoonScore += 3;
  else if (medianRatio >= 1.9) webtoonScore += 1;
  if (veryTallPageRatio >= 0.5) webtoonScore += 2;
  else if (tallPageRatio >= 0.6) webtoonScore += 1;

  return webtoonScore >= 3 ? 'webtoon' : 'single';
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
  reloadTrigger?: number;
  onImageError?: (index: number, url: string) => void;
  onImageSuccess?: (index: number) => void;
  onCloudflareVerify?: () => void;
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
  reloadTrigger,
  onImageError,
  onImageSuccess,
  onCloudflareVerify,
}: ReaderImagePageProps) {
  const colors = useThemeColors();
  const theme = useReaderStore((s) => s.theme);
  const readerTheme = ReaderThemes[theme];
  const [isError, setIsError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [bridgedDataUri, setBridgedDataUri] = useState<string | null>(() => imageBridgeCache.get(url) || null);

  const resolvedUrl = useMemo(() => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('file:')) {
      return url;
    }
    if (url.startsWith('/api/media/') || url.includes('philia')) {
      return `https://philiascans.org/${url.replace(/^\/+/, '')}`;
    }
    return url;
  }, [url]);

  const isCfProtectedUrl = useMemo(() => isCloudflareProtectedUrl(resolvedUrl), [resolvedUrl]);

  useEffect(() => {
    setIsError(false);
    setIsRetrying(false);
    setRetryCount(0);
    const cached = imageBridgeCache.get(resolvedUrl) || null;
    if (cached) {
      setBridgedDataUri(cached);
      return;
    }

    setBridgedDataUri(null);

    // Proactively fetch via bridge if CF protected on native
    if (isCfProtectedUrl && Platform.OS !== 'web' && webViewBridge.hasSender()) {
      let isMounted = true;
      webViewBridge
        .fetchImageBase64(resolvedUrl, 20000)
        .then((dataUri) => {
          if (isMounted && dataUri) {
            imageBridgeCache.set(resolvedUrl, dataUri);
            setBridgedDataUri(dataUri);
            setIsError(false);
            setIsRetrying(false);
            onImageSuccess?.(index);
          }
        })
        .catch(() => {
          // If proactive bridge fails, handleImageError will catch it
        });

      return () => {
        isMounted = false;
      };
    }

    // Proactively fetch via HTTP buffer if JXL/Kagane image
    const isJxlOrKagane = resolvedUrl && (resolvedUrl.includes('.jxl') || resolvedUrl.includes('kstatic.to'));
    if (isJxlOrKagane) {
      let isMounted = true;
      fetchBufferAsDataUri(resolvedUrl, headers)
        .then((dataUri) => {
          if (isMounted && dataUri) {
            imageBridgeCache.set(resolvedUrl, dataUri);
            setBridgedDataUri(dataUri);
            setIsError(false);
            setIsRetrying(false);
            onImageSuccess?.(index);
          }
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }
  }, [headers, reloadTrigger, resolvedUrl, isCfProtectedUrl, index, onImageSuccess]);

  const imageSource = useMemo(() => {
    if (bridgedDataUri) return { uri: bridgedDataUri };
    if (!resolvedUrl) return null;
    return headers ? { uri: resolvedUrl, headers } : { uri: resolvedUrl };
  }, [resolvedUrl, headers, bridgedDataUri]);

  const handleImageError = useCallback(async () => {
    // 1. If Cloudflare protected domain and not already bridged, attempt WebView bridge fetch FIRST
    if (isCfProtectedUrl && !bridgedDataUri && Platform.OS !== 'web' && webViewBridge.hasSender()) {
      try {
        setIsRetrying(true);
        const dataUri = await webViewBridge.fetchImageBase64(resolvedUrl, 20000);
        if (dataUri) {
          imageBridgeCache.set(resolvedUrl, dataUri);
          setBridgedDataUri(dataUri);
          setIsError(false);
          setIsRetrying(false);
          onImageSuccess?.(index);
          return;
        }
      } catch (err) {
        // Bridge fetch failed (e.g. Cloudflare Turnstile not yet solved)
      }
    }

    // 1.5. Resilient fallback to direct HTTP buffer for ANY image that failed in native decoder
    if (resolvedUrl && !bridgedDataUri) {
      try {
        setIsRetrying(true);
        const dataUri = await fetchBufferAsDataUri(resolvedUrl, headers);
        if (dataUri) {
          imageBridgeCache.set(resolvedUrl, dataUri);
          setBridgedDataUri(dataUri);
          setIsError(false);
          setIsRetrying(false);
          onImageSuccess?.(index);
          return;
        }
      } catch {}
    }

    // 2. Retry before logging hard error
    if (retryCount < 2) {
      setIsRetrying(true);
      const delay = Math.pow(2, retryCount + 1) * 600;
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        setIsRetrying(false);
      }, delay);
      return;
    }

    // 3. Only if ALL retries and fallbacks have failed, log and set error state
    ApiLogger.logRequest({
      timestamp: Date.now(),
      method: 'GET_IMG',
      url: resolvedUrl,
      status: isCfProtectedUrl ? 403 : null,
      statusText: isCfProtectedUrl ? 'Cloudflare Challenge / 403' : 'Image Load Failed',
      durationMs: 0,
      error: `Page ${index + 1} image failed to load${isCfProtectedUrl ? ' (Cloudflare verification required)' : ''}`,
    });

    onImageError?.(index, resolvedUrl);
    setIsError(true);
    setIsRetrying(false);
  }, [resolvedUrl, index, retryCount, isCfProtectedUrl, headers, onImageError, onImageSuccess, bridgedDataUri]);

  const handleManualRetry = useCallback(async () => {
    setIsError(false);
    setIsRetrying(true);
    if (isCfProtectedUrl && Platform.OS !== 'web' && webViewBridge.hasSender()) {
      try {
        const dataUri = await webViewBridge.fetchImageBase64(resolvedUrl, 20000);
        if (dataUri) {
          imageBridgeCache.set(resolvedUrl, dataUri);
          setBridgedDataUri(dataUri);
          setIsRetrying(false);
          onImageSuccess?.(index);
          return;
        }
      } catch {}
    }
    if (resolvedUrl) {
      try {
        const dataUri = await fetchBufferAsDataUri(resolvedUrl, headers);
        if (dataUri) {
          imageBridgeCache.set(resolvedUrl, dataUri);
          setBridgedDataUri(dataUri);
          setIsRetrying(false);
          onImageSuccess?.(index);
          return;
        }
      } catch {}
    }
    setRetryCount((prev) => prev + 1);
    setTimeout(() => setIsRetrying(false), 500);
  }, [isCfProtectedUrl, resolvedUrl, headers, index, onImageSuccess]);

  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      {isError ? (
        <View
          style={[
            styles.imageErrorCard,
            {
              width: Math.min(width - 32, 400),
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Ionicons
            name={isCfProtectedUrl ? 'shield-outline' : 'alert-circle-outline'}
            size={36}
            color={colors.accent}
          />
          <Text style={[styles.imageErrorTitle, { color: colors.text }]}>
            {isCfProtectedUrl ? `Page ${index + 1} • Verification Required` : `Page ${index + 1} • Load Failed`}
          </Text>
          <Text style={[styles.imageErrorSubtext, { color: colors.textSecondary }]}>
            {isCfProtectedUrl
              ? 'This chapter image is protected by Cloudflare. Solve verification once to continue reading.'
              : 'Unable to load page image. Please check your network connection.'}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {isCfProtectedUrl && onCloudflareVerify && (
              <Pressable
                onPress={onCloudflareVerify}
                style={({ pressed }) => [
                  styles.imageRetryBtn,
                  { backgroundColor: colors.accent, minHeight: 44, paddingHorizontal: 18 },
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityRole="button"
                aria-label="Verify Cloudflare"
              >
                <Ionicons name="shield-checkmark" size={16} color={getContrastTextColor(colors.accent)} />
                <Text style={[styles.imageRetryBtnText, { color: getContrastTextColor(colors.accent) }]}>
                  Verify Cloudflare
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleManualRetry}
              style={({ pressed }) => [
                styles.imageRetryBtn,
                {
                  backgroundColor: colors.surfaceElevated,
                  minHeight: 44,
                  paddingHorizontal: 16,
                },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              aria-label={`Retry Page ${index + 1}`}
            >
              <Ionicons
                name="refresh"
                size={16}
                color={colors.text}
              />
              <Text
                style={[
                  styles.imageRetryBtnText,
                  { color: colors.text },
                ]}
              >
                Retry Page {index + 1}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
          {imageSource && (
            <ZoomableImage
              key={`${url}-${bridgedDataUri ? 'bridged' : 'direct'}-retry-${retryCount}-${reloadTrigger ?? 0}`}
              source={imageSource}
              style={{ width, height }}
              contentFit={contentFit}
              zoomEnabled={zoomEnabled}
              recyclingKey={`${url}-${bridgedDataUri ? 'bridged' : 'direct'}-${reloadTrigger ?? 0}`}
              onTap={onTap}
              onLoad={(e) => {
                setIsError(false);
                onImageSuccess?.(index);
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
                Retrying page {index + 1} ({retryCount + 1}/3)...
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
  onLayout?: (index: number, event: LayoutChangeEvent) => void;
  headers?: Record<string, string>;
  reloadTrigger?: number;
  onImageError?: (index: number, url: string) => void;
  onImageSuccess?: (index: number) => void;
  onCloudflareVerify?: () => void;
}

// Measured image aspect ratios survive cell recycling. Without this, a page that
// scrolls out of the render window remounts at the 1.5 placeholder height and
// shifts every page below it until the image reloads.
const webtoonAspectCache = new Map<string, number>();

interface WebtoonStripPage {
  key: string;
  chapterId: string;
  localIndex: number;
  globalIndex: number;
  url: string;
}

interface WebtoonPageMeasurement {
  key: string;
  index: number;
  y: number;
  height: number;
}

interface WebtoonJump {
  chapterId: string;
  localIndex: number;
  globalIndex: number;
  offsetWithinPage: number;
  token: number;
  attempts: number;
  startedAt: number;
  lastReportedOffset?: number;
  stalledChecks?: number;
}

const getWebtoonPageKey = (chapterId: string, localIndex: number) =>
  `${chapterId}::${localIndex}`;

const WebtoonPageItem = React.memo(function WebtoonPageItem({
  url,
  index,
  webtoonWidth,
  windowHeight,
  imageFit,
  onTap,
  onLayout,
  headers,
  reloadTrigger,
  onImageError,
  onImageSuccess,
  onCloudflareVerify,
}: WebtoonPageItemProps) {
  const [aspectRatio, setAspectRatio] = useState<number>(() => webtoonAspectCache.get(url) ?? 1.5);

  const displayHeight =
    imageFit === 'fit_height' ? windowHeight : webtoonWidth * aspectRatio;
  const displayFit = imageFit === 'fit_height' ? 'contain' : 'fill';

  return (
    <View onLayout={onLayout ? (event) => onLayout(index, event) : undefined}>
      <ReaderImagePage
        url={url}
        index={index}
        width={webtoonWidth}
        height={displayHeight}
        contentFit={displayFit}
        zoomEnabled={false}
        onTap={onTap}
        headers={headers}
        reloadTrigger={reloadTrigger}
        onImageError={onImageError}
        onImageSuccess={onImageSuccess}
        onCloudflareVerify={onCloudflareVerify}
        onAspectMeasured={(ratio) => {
          webtoonAspectCache.set(url, ratio);
          setAspectRatio((prev) => (prev === ratio ? prev : ratio));
        }}
      />
    </View>
  );
});

export default function ReaderScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { checkNetwork } = useNetworkStatus();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
    chapterId: rawChapterParam,
    mangaId: rawMangaParam,
    page,
    scrollOffset: rawScrollOffsetParam,
    scanlator: rawScanlatorParam,
  } = useLocalSearchParams<{
    chapterId: string;
    mangaId?: string;
    page?: string;
    scrollOffset?: string;
    scanlator?: string;
  }>();

  const chapterId = useMemo(() => {
    if (!rawChapterParam) return '';
    try {
      return decodeURIComponent(rawChapterParam);
    } catch {
      return rawChapterParam;
    }
  }, [rawChapterParam]);

  const mangaId = useMemo(() => {
    if (!rawMangaParam) return undefined;
    try {
      return decodeURIComponent(rawMangaParam);
    } catch {
      return rawMangaParam;
    }
  }, [rawMangaParam]);

  const [selectedScanlator, setSelectedScanlator] = useState<string | undefined>(() => {
    if (rawScanlatorParam) {
      try {
        return decodeURIComponent(rawScanlatorParam);
      } catch {
        return rawScanlatorParam;
      }
    }
    return undefined;
  });

  useEffect(() => {
    if (rawScanlatorParam) {
      try {
        setSelectedScanlator(decodeURIComponent(rawScanlatorParam));
      } catch {
        setSelectedScanlator(rawScanlatorParam);
      }
    }
  }, [rawScanlatorParam]);

  // Dynamic Tap zones for page turning
  const TAP_LEFT = windowWidth * 0.3;
  const TAP_RIGHT = windowWidth * 0.7;

  const storedMode = useReaderStore((s) => s.mode);
  const modeOverrides = useReaderStore((s) => s.modeOverrides);
  const theme = useReaderStore((s) => s.theme);
  const dataSaver = useReaderStore((s) => s.dataSaver);
  const showPageNumber = useReaderStore((s) => s.showPageNumber);
  const hapticsEnabled = useReaderStore((s) => s.hapticsEnabled);
  const setMode = useReaderStore((s) => s.setMode);
  const setModeOverride = useReaderStore((s) => s.setModeOverride);
  const controlsVisible = useReaderStore((s) => s.controlsVisible);
  const toggleControls = useReaderStore((s) => s.toggleControls);
  const setControlsVisible = useReaderStore((s) => s.setControlsVisible);

  const addHistoryEntry = useHistoryStore((s) => s.addEntry);
  const readerLibraryEntry = useLibraryStore((s) => (mangaId ? s.entries[mangaId] : undefined));
  const addToLibrary = useLibraryStore((s) => s.addToLibrary);
  const removeFromLibrary = useLibraryStore((s) => s.removeFromLibrary);

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
  const [mobileMenuSection, setMobileMenuSection] = useState<'chapters' | 'settings'>('settings');
  const [mobileChapterViewMode, setMobileChapterViewMode] = useState<'list' | 'grid'>('list');
  const [imageFit, setImageFit] = useState<'fit_both' | 'fit_width' | 'fit_height'>('fit_both');
  const [headerHidden, setHeaderHidden] = useState(false);
 const [pageTimelineWidth, setPageTimelineWidth] = useState(0);
  const controlsProgress = useRef(new Animated.Value(controlsVisible ? 1 : 0)).current;
  const sliderProgress = useRef(new Animated.Value(0)).current;
  const timelinePreviewPageRef = useRef<number | null>(null);
  const timelineDraggingRef = useRef(false);
  const [timelinePreviewPage, setTimelinePreviewPage] = useState<number | null>(null);

  const [mangaTitle, setMangaTitle] = useState('Manga');
  const [chapterTitle, setChapterTitle] = useState(`Chapter`);
  useDocumentTitle(`${mangaTitle} • ${chapterTitle}`);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [scanlationGroup, setScanlationGroup] = useState<string>('Scanlation Team');
  const [currentChapterPublishAt, setCurrentChapterPublishAt] = useState<string | undefined>();
  const [uploaderName, setUploaderName] = useState<string>('Uploader');
  const [resolvedMangaId, setResolvedMangaId] = useState<string | undefined>(mangaId);
  const [mangaOriginalLanguage, setMangaOriginalLanguage] = useState<string | undefined>();
  const [detectedDefaultMode, setDetectedDefaultMode] = useState<ReadingMode | null>(null);
  const [pageHeaders, setPageHeaders] = useState<Record<string, string> | undefined>(undefined);
  const [isCloudflare, setIsCloudflare] = useState(false);
  const [isCfInAppModalOpen, setIsCfInAppModalOpen] = useState(false);
  const [cfInAppUrl, setCfInAppUrl] = useState('https://mangadot.net/');
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());

  const readerContentKey = mangaId || resolvedMangaId || chapterId || '';
  const mode = modeOverrides[readerContentKey] || detectedDefaultMode || storedMode;
  const handleSetReaderMode = useCallback((nextMode: ReadingMode) => {
    setMode(nextMode);
    if (readerContentKey) {
      setModeOverride(readerContentKey, nextMode);
    }
    setDetectedDefaultMode(nextMode);
  }, [readerContentKey, setMode, setModeOverride]);

  const persistentBridgeRef = useRef<any>(null);
  const cfWebViewRef = useRef<any>(null);
  const hasSolvedRef = useRef(false);
  const isSolvingCloudflareRef = useRef(false);
  const [persistentBridgeUrl, setPersistentBridgeUrl] = useState('https://mangadot.net/');

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

  useEffect(() => {
    let targetUrl = 'https://mangadot.net/';
    if (chapterId?.includes('reimanga')) {
      const parts = chapterId.replace(/^reimanga:/, '').split(':');
      targetUrl =
        parts.length > 0 && parts[0]
          ? `https://reimanga.net/manga/${parts[0].replace(/^manga\//, '')}`
          : 'https://reimanga.net/';
    } else if (chapterId?.includes('mangadot')) {
      targetUrl = 'https://mangadot.net/';
    } else if (chapterId?.includes('manganato')) {
      targetUrl = 'https://manganato.gg/';
    } else if (chapterId?.includes('onisaga')) {
      targetUrl = 'https://onisaga.com/';
    } else if (chapterId?.includes('toonkotsu')) {
      targetUrl = 'https://toonkotsu.com/';
    } else if (chapterId?.includes('weebcentral')) {
      targetUrl = 'https://weebcentral.com/';
    } else if (chapterId?.includes('mangak')) {
      targetUrl = 'https://mangak.io/';
    } else if (chapterId?.includes('nhentai')) {
      targetUrl = 'https://nhentai.net/';
    } else if (chapterId?.includes('comix')) {
      targetUrl = 'https://comix.net/';
    } else if (pages.length > 0 && pages[0]) {
      try {
        const u = new URL(pages[0]);
        targetUrl = `${u.protocol}//${u.host}/`;
      } catch {}
    }
    setPersistentBridgeUrl(targetUrl);
  }, [chapterId, pages]);

  const isCloudflareSource = useMemo(() => {
    if (!chapterId) return false;
    return (
      chapterId.includes('reimanga') ||
      chapterId.includes('mangadot') ||
      chapterId.includes('manganato') ||
      chapterId.includes('comix') ||
      chapterId.includes('weebcentral') ||
      chapterId.includes('mangak') ||
      chapterId.includes('onisaga') ||
      chapterId.includes('toonkotsu') ||
      pages.some(
        (p) =>
          p.includes('reimanga.net') ||
          p.includes('mangadot.net') ||
          p.includes('/chapters/manga_') ||
          p.includes('chapmanganato') ||
          p.includes('onisaga.com') ||
          p.includes('toonkotsu.com') ||
          p.includes('mangak.io') ||
          p.includes('weebcentral.com')
      )
    );
  }, [chapterId, pages]);


  const flatListRef = useRef<FlatList>(null);
  const webtoonListRef = useRef<FlatList<WebtoonStripPage>>(null);
  const restoredChapterIdRef = useRef<string | null>(null);
  const resumeTargetPageRef = useRef(0);
  const isProgrammaticScrollRef = useRef(false);
  const webtoonJumpTokenRef = useRef(0);
  const webtoonJumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWebtoonJumpRef = useRef<WebtoonJump | null>(null);
  const nextChapterLoadRequestedRef = useRef(false);
  const nextChapterLoadIdRef = useRef<string | null>(null);
  const loadNextChapterPagesRef = useRef<() => void>(() => {});
  const loadedPagesChapterIdRef = useRef<string | null>(null);
  const loadPagesTokenRef = useRef(0);
  const webtoonStripPagesRef = useRef<WebtoonStripPage[]>([]);
  const webtoonMeasurementsRef = useRef(new Map<string, WebtoonPageMeasurement>());
  const pendingWebtoonOffsetRef = useRef(0);
  const currentWebtoonIndexRef = useRef(0);
  const webtoonContentOffsetRef = useRef(0);
  const webtoonScrollOffsetRef = useRef(0);
  const webtoonSuppressTrackingOffsetRef = useRef<number | null>(null);
  const webtoonPositionFrameRef = useRef<number | null>(null);
  const [webtoonJumpActive, setWebtoonJumpActive] = useState(false);

  const readerTheme = ReaderThemes[theme];
  const webtoonWidth = Math.min(windowWidth, 800);
  const webtoonDefaultPageHeight = webtoonWidth * 1.5;

  const getWebtoonMeasurement = useCallback((index: number) => {
    const page = webtoonStripPagesRef.current[index];
    if (!page) return undefined;
    const measurement = webtoonMeasurementsRef.current.get(page.key);
    return measurement && measurement.index === index ? measurement : undefined;
  }, []);

  const getWebtoonAverageMeasuredHeight = useCallback(() => {
    let total = 0;
    let count = 0;
    webtoonMeasurementsRef.current.forEach((measurement) => {
      if (measurement.height > 0) {
        total += measurement.height;
        count += 1;
      }
    });
    return count > 0 ? total / count : webtoonDefaultPageHeight;
  }, [webtoonDefaultPageHeight]);

  const getWebtoonPredictedHeight = useCallback(
    (url: string) => {
      if (imageFit === 'fit_height') return windowHeight;
      const ratio = webtoonAspectCache.get(url);
      return ratio && ratio > 0 ? webtoonWidth * ratio : webtoonDefaultPageHeight;
    },
    [imageFit, webtoonDefaultPageHeight, webtoonWidth, windowHeight],
  );

  // A page height is known exactly once it has been measured. Before that, use
  // the cached aspect ratio (or the default placeholder height). This same
  // prediction backs getItemLayout, so unrendered pages still occupy realistic
  // space and the list can jump directly into them instead of ratcheting through
  // every page above the destination.
  const getWebtoonLayoutHeight = useCallback(
    (index: number) => {
      const page = webtoonStripPagesRef.current[index];
      if (!page) return webtoonDefaultPageHeight;
      const measurement = webtoonMeasurementsRef.current.get(page.key);
      if (measurement && measurement.index === index) return measurement.height;
      return getWebtoonPredictedHeight(page.url);
    },
    [getWebtoonPredictedHeight, webtoonDefaultPageHeight],
  );

  const getWebtoonLayoutOffset = useCallback(
    (index: number) => {
      let offset = 0;
      for (let itemIndex = 0; itemIndex < index; itemIndex += 1) {
        offset += getWebtoonLayoutHeight(itemIndex);
      }
      return offset;
    },
    [getWebtoonLayoutHeight],
  );

  const getWebtoonItemLayout = useCallback(
    (_data: ArrayLike<WebtoonStripPage> | null | undefined, index: number) => ({
      length: getWebtoonLayoutHeight(index),
      offset: getWebtoonLayoutOffset(index),
      index,
    }),
    [getWebtoonLayoutHeight, getWebtoonLayoutOffset],
  );

  // Measured pages give exact offsets. For pages that have never been rendered we
  // anchor to the closest measured page above or below and predict the gap using
  // cached aspect ratios, so a long jump lands close enough to start measuring
  // the actual destination.
  const estimateWebtoonOffset = useCallback(
    (index: number) => {
      if (index <= 0) return 0;

      const direct = getWebtoonMeasurement(index);
      if (direct) return direct.y;

      let before: WebtoonPageMeasurement | undefined;
      for (let itemIndex = index - 1; itemIndex >= 0; itemIndex -= 1) {
        const measurement = getWebtoonMeasurement(itemIndex);
        if (measurement) {
          before = measurement;
          break;
        }
      }

      let after: WebtoonPageMeasurement | undefined;
      for (let itemIndex = index + 1; itemIndex < webtoonStripPagesRef.current.length; itemIndex += 1) {
        const measurement = getWebtoonMeasurement(itemIndex);
        if (measurement) {
          after = measurement;
          break;
        }
      }

      const averageHeight = getWebtoonAverageMeasuredHeight();
      const heightOf = (itemIndex: number) => {
        const measurement = getWebtoonMeasurement(itemIndex);
        if (measurement) return measurement.height;
        const page = webtoonStripPagesRef.current[itemIndex];
        return page ? getWebtoonPredictedHeight(page.url) : averageHeight;
      };

      if (before) {
        let forward = before.y + before.height;
        for (let itemIndex = before.index + 1; itemIndex < index; itemIndex += 1) {
          forward += heightOf(itemIndex);
        }

        if (!after) return Math.max(0, forward);

        let backward = after.y;
        for (let itemIndex = index; itemIndex < after.index; itemIndex += 1) {
          backward -= heightOf(itemIndex);
        }

        return Math.max(
          0,
          index - before.index <= after.index - index ? forward : backward,
        );
      }

      if (after) {
        let backward = after.y;
        for (let itemIndex = index; itemIndex < after.index; itemIndex += 1) {
          backward -= heightOf(itemIndex);
        }
        return Math.max(0, backward);
      }

      return Math.max(0, getWebtoonLayoutOffset(index));
    },
    [
      getWebtoonAverageMeasuredHeight,
      getWebtoonLayoutOffset,
      getWebtoonMeasurement,
      getWebtoonPredictedHeight,
    ],
  );

  const finishWebtoonJump = useCallback(
    (contentOffset: number) => {
      const jump = pendingWebtoonJumpRef.current;
      if (!jump) return;

      pendingWebtoonJumpRef.current = null;
      isProgrammaticScrollRef.current = false;
      if (webtoonJumpTimerRef.current) {
        clearTimeout(webtoonJumpTimerRef.current);
        webtoonJumpTimerRef.current = null;
      }

      const page = webtoonStripPagesRef.current[jump.globalIndex];
      if (
        !page ||
        page.chapterId !== jump.chapterId ||
        page.localIndex !== jump.localIndex
      ) {
        webtoonSuppressTrackingOffsetRef.current = null;
        setWebtoonJumpActive(false);
        return;
      }

      const measurement = getWebtoonMeasurement(jump.globalIndex);
      currentWebtoonIndexRef.current = jump.globalIndex;
      webtoonScrollOffsetRef.current = measurement
        ? Math.max(0, contentOffset - measurement.y)
        : Math.max(0, jump.offsetWithinPage);

      if (page) {
        setActiveWebtoonChapterId(page.chapterId);
        setCurrentPage(page.localIndex);
      }

      // Keep the indicator on the selected page until the user actually scrolls.
      webtoonSuppressTrackingOffsetRef.current = contentOffset;
      setWebtoonJumpActive(false);

      if (jump.globalIndex >= webtoonStripPagesRef.current.length - 3) {
        loadNextChapterPagesRef.current();
      }
    },
    [getWebtoonMeasurement],
  );

  const attemptWebtoonJumpRef = useRef<() => void>(() => {});

  const attemptWebtoonJump = useCallback(() => {
    const jump = pendingWebtoonJumpRef.current;
    if (!jump) return;

    if (Date.now() - jump.startedAt > 12000) {
      finishWebtoonJump(webtoonContentOffsetRef.current);
      return;
    }

    const pageAtIndex = webtoonStripPagesRef.current[jump.globalIndex];
    if (
      !pageAtIndex ||
      pageAtIndex.chapterId !== jump.chapterId ||
      pageAtIndex.localIndex !== jump.localIndex
    ) {
      const resolvedIndex = webtoonStripPagesRef.current.findIndex(
        (page) => page.chapterId === jump.chapterId && page.localIndex === jump.localIndex,
      );
      if (resolvedIndex < 0) {
        finishWebtoonJump(webtoonContentOffsetRef.current);
        return;
      }
      jump.globalIndex = resolvedIndex;
    }

    if (webtoonJumpTimerRef.current) {
      clearTimeout(webtoonJumpTimerRef.current);
      webtoonJumpTimerRef.current = null;
    }

    // Only timed retries count toward the safety cap. Cell-layout callbacks can
    // legitimately fire many times during a single ratchet step.
    const retry = () => {
      const active = pendingWebtoonJumpRef.current;
      if (!active || active.token !== jump.token) return;
      active.attempts += 1;
      if (active.attempts > 120) {
        // Never leave the reader locked on a page we cannot measure. Settle on
        // the real scroll position instead of showing an indicator that lies.
        finishWebtoonJump(webtoonContentOffsetRef.current);
        return;
      }
      attemptWebtoonJumpRef.current();
    };

    const list = webtoonListRef.current;
    if (!list) {
      webtoonJumpTimerRef.current = setTimeout(retry, 70);
      return;
    }

    const measurement = getWebtoonMeasurement(jump.globalIndex);
    if (measurement) {
      const targetOffset = Math.max(0, measurement.y + jump.offsetWithinPage);
      const currentOffset = webtoonContentOffsetRef.current;
      if (Math.abs(currentOffset - targetOffset) <= 24) {
        finishWebtoonJump(currentOffset);
        return;
      }

      list.scrollToOffset({ offset: targetOffset, animated: false });
      webtoonJumpTimerRef.current = setTimeout(() => {
        const active = pendingWebtoonJumpRef.current;
        if (!active || active.token !== jump.token) return;
        const actualOffset = webtoonContentOffsetRef.current;
        const latest = getWebtoonMeasurement(active.globalIndex);
        if (latest) {
          const expected = Math.max(0, latest.y + active.offsetWithinPage);
          if (Math.abs(actualOffset - expected) <= 32) {
            finishWebtoonJump(actualOffset);
            return;
          }

          // A destination near the end of the strip can be unreachable because
          // the list cannot scroll past its content. Accept the closest real
          // offset instead of retrying for several seconds.
          if (
            active.lastReportedOffset !== undefined &&
            Math.abs(actualOffset - active.lastReportedOffset) < 0.5
          ) {
            active.stalledChecks = (active.stalledChecks || 0) + 1;
            if (active.stalledChecks >= 2) {
              finishWebtoonJump(actualOffset);
              return;
            }
          } else {
            active.stalledChecks = 0;
          }
          active.lastReportedOffset = actualOffset;
        }
        retry();
      }, 140);
      return;
    }

    // A virtualized list cannot scroll beyond its measured content. Repeatedly
    // scrolling to the best estimate ratchets the render window forward until the
    // destination page is measured, at which point we snap to its exact offset.
    const estimatedOffset = estimateWebtoonOffset(jump.globalIndex);
    list.scrollToOffset({
      offset: Math.max(0, estimatedOffset + jump.offsetWithinPage),
      animated: false,
    });

    webtoonJumpTimerRef.current = setTimeout(retry, 70);
  }, [estimateWebtoonOffset, finishWebtoonJump, getWebtoonMeasurement]);

  attemptWebtoonJumpRef.current = attemptWebtoonJump;

  const jumpToWebtoonPage = useCallback(
    (targetChapterId: string, localIndex: number, offsetWithinPage = 0) => {
      const globalIndex = webtoonStripPagesRef.current.findIndex(
        (page) => page.chapterId === targetChapterId && page.localIndex === localIndex,
      );
      if (globalIndex < 0) return false;

      webtoonJumpTokenRef.current += 1;
      pendingWebtoonJumpRef.current = {
        chapterId: targetChapterId,
        localIndex,
        globalIndex,
        offsetWithinPage: Math.max(0, offsetWithinPage),
        token: webtoonJumpTokenRef.current,
        attempts: 0,
        startedAt: Date.now(),
      };
      isProgrammaticScrollRef.current = true;
      webtoonSuppressTrackingOffsetRef.current = null;
      currentWebtoonIndexRef.current = globalIndex;
      webtoonScrollOffsetRef.current = Math.max(0, offsetWithinPage);

      setActiveWebtoonChapterId(targetChapterId);
      setCurrentPage(localIndex);
      setWebtoonJumpActive(true);
      attemptWebtoonJumpRef.current();
      return true;
    },
    [],
  );

  const cancelWebtoonJump = useCallback(() => {
    if (!pendingWebtoonJumpRef.current && !isProgrammaticScrollRef.current) return;
    pendingWebtoonJumpRef.current = null;
    isProgrammaticScrollRef.current = false;
    webtoonJumpTokenRef.current += 1;
    if (webtoonJumpTimerRef.current) {
      clearTimeout(webtoonJumpTimerRef.current);
      webtoonJumpTimerRef.current = null;
    }
    webtoonSuppressTrackingOffsetRef.current = null;
    setWebtoonJumpActive(false);
  }, []);

  const updateWebtoonPosition = useCallback(
    (contentOffset: number) => {
      if (pendingWebtoonJumpRef.current || isProgrammaticScrollRef.current) return;
      // Wait for the saved-page restore to run before letting the initial layout
      // at the top of the strip overwrite the resume target with page 1.
      if (restoredChapterIdRef.current !== chapterId) return;

      const suppressedOffset = webtoonSuppressTrackingOffsetRef.current;
      if (suppressedOffset !== null) {
        if (Math.abs(contentOffset - suppressedOffset) <= 2) return;
        webtoonSuppressTrackingOffsetRef.current = null;
      }

      const stripPages = webtoonStripPagesRef.current;
      if (stripPages.length === 0) return;

      const readingLine = contentOffset + windowHeight * 0.4;
      let activeIndex: number | null = null;
      let bestTop = -1;

      webtoonMeasurementsRef.current.forEach((measurement) => {
        if (measurement.index < 0 || measurement.index >= stripPages.length) return;
        const page = stripPages[measurement.index];
        if (!page || page.key !== measurement.key) return;
        if (
          readingLine >= measurement.y &&
          readingLine < measurement.y + measurement.height &&
          measurement.y > bestTop
        ) {
          bestTop = measurement.y;
          activeIndex = measurement.index;
        }
      });

      if (activeIndex === null) {
        let bestDistance = Infinity;
        webtoonMeasurementsRef.current.forEach((measurement) => {
          if (measurement.index < 0 || measurement.index >= stripPages.length) return;
          const page = stripPages[measurement.index];
          if (!page || page.key !== measurement.key) return;
          const distance =
            readingLine < measurement.y
              ? measurement.y - readingLine
              : readingLine - (measurement.y + measurement.height);
          if (distance < bestDistance) {
            bestDistance = distance;
            activeIndex = measurement.index;
          }
        });
      }

      if (activeIndex === null) return;
      const page = stripPages[activeIndex];
      if (!page) return;

      const measurement = webtoonMeasurementsRef.current.get(page.key);
      currentWebtoonIndexRef.current = activeIndex;
      setActiveWebtoonChapterId((previous) =>
        previous === page.chapterId ? previous : page.chapterId,
      );
      setCurrentPage((previous) =>
        previous === page.localIndex ? previous : page.localIndex,
      );
      webtoonScrollOffsetRef.current = measurement
        ? Math.max(0, contentOffset - measurement.y)
        : 0;

      if (activeIndex >= stripPages.length - 3) {
        loadNextChapterPagesRef.current();
      }
    },
    [chapterId, windowHeight],
  );

  const queueWebtoonPositionUpdate = useCallback(() => {
    if (webtoonPositionFrameRef.current !== null) return;
    webtoonPositionFrameRef.current = requestAnimationFrame(() => {
      webtoonPositionFrameRef.current = null;
      updateWebtoonPosition(webtoonContentOffsetRef.current);
    });
  }, [updateWebtoonPosition]);

  const handleWebtoonCellLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      // This onLayout belongs to the FlatList cell itself, so its y is the exact
      // content offset of the page. The page item's own y is always 0 because it
      // is positioned inside the cell wrapper.
      const page = webtoonStripPagesRef.current[index];
      if (!page) return;

      const { y, height } = event.nativeEvent.layout;
      if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) return;

      const previous = webtoonMeasurementsRef.current.get(page.key);
      if (
        previous &&
        previous.index === index &&
        Math.abs(previous.y - y) < 0.5 &&
        Math.abs(previous.height - height) < 0.5
      ) {
        return;
      }

      webtoonMeasurementsRef.current.set(page.key, {
        key: page.key,
        index,
        y,
        height,
      });

      // Keep cached offsets for pages below this one valid before they remount.
      // Without this a far jump can anchor to a stale measurement after an image
      // above it changed height.
      if (previous && Math.abs(previous.height - height) >= 0.5) {
        const heightDelta = height - previous.height;
        webtoonMeasurementsRef.current.forEach((measurement) => {
          if (measurement.index > index) {
            measurement.y += heightDelta;
          }
        });
      }

      const jump = pendingWebtoonJumpRef.current;
      if (jump) {
        if (
          jump.globalIndex === index ||
          (previous && Math.abs(previous.height - height) >= 0.5)
        ) {
          attemptWebtoonJumpRef.current();
        }
        return;
      }

      // If a page entirely above the viewport grows or shrinks after its image
      // loads, compensate the scroll offset so the reader does not drift.
      if (previous && Math.abs(previous.height - height) >= 0.5) {
        const changedAboveViewport =
          previous.y + previous.height <= webtoonContentOffsetRef.current + 1;
        if (changedAboveViewport) {
          const nextOffset = Math.max(
            0,
            webtoonContentOffsetRef.current + (height - previous.height),
          );
          webtoonContentOffsetRef.current = nextOffset;
          webtoonListRef.current?.scrollToOffset({
            offset: nextOffset,
            animated: false,
          });
          webtoonSuppressTrackingOffsetRef.current = nextOffset;
        }
      }

      queueWebtoonPositionUpdate();
    },
    [queueWebtoonPositionUpdate],
  );

  const webtoonCellRenderer = useMemo(() => {
    const WebtoonCellRenderer = ({
      index,
      style,
      onLayout,
      onFocusCapture,
      children,
    }: any) => (
      <View
        style={style}
        onFocusCapture={onFocusCapture}
        onLayout={(event: LayoutChangeEvent) => {
          onLayout?.(event);
          handleWebtoonCellLayout(index, event);
        }}
      >
        {children}
      </View>
    );
    WebtoonCellRenderer.displayName = 'WebtoonCellRenderer';
    return WebtoonCellRenderer;
  }, [handleWebtoonCellLayout]);

  useEffect(() => {
    return () => {
      if (webtoonPositionFrameRef.current !== null) {
        cancelAnimationFrame(webtoonPositionFrameRef.current);
        webtoonPositionFrameRef.current = null;
      }
      if (webtoonJumpTimerRef.current) {
        clearTimeout(webtoonJumpTimerRef.current);
        webtoonJumpTimerRef.current = null;
      }
    };
  }, []);

  // Load chapter pages & metadata
  useEffect(() => {
    if (!chapterId) return;
    loadPages();
    loadMangaMeta();
  }, [chapterId, dataSaver, mangaId, page, rawScrollOffsetParam]);

  // Remember the page the user came from when the reading mode changes. A fresh
  // webtoon FlatList mounts at offset 0, so it must be seeked explicitly.
  const lastReaderModeRef = useRef<ReadingMode | null>(null);
  useEffect(() => {
    const previousMode = lastReaderModeRef.current;
    lastReaderModeRef.current = mode;

    if (mode === 'webtoon' && previousMode !== 'webtoon') {
      if (restoredChapterIdRef.current === chapterId) {
        resumeTargetPageRef.current = currentPage;
        pendingWebtoonOffsetRef.current = 0;
      } else if (pages.length > 0 && currentPage !== resumeTargetPageRef.current) {
        resumeTargetPageRef.current = currentPage;
        pendingWebtoonOffsetRef.current = 0;
      }
      restoredChapterIdRef.current = null;
      cancelWebtoonJump();
    } else if (mode !== 'webtoon' && previousMode === 'webtoon') {
      resumeTargetPageRef.current = currentPage;
      pendingWebtoonOffsetRef.current = 0;
    }
  }, [cancelWebtoonJump, chapterId, currentPage, mode, pages.length]);

  // Restore a saved webtoon position after the chapter has loaded and laid out.
  // The list must not report its initial top-of-strip position until this runs.
  useEffect(() => {
    if (
      mode !== 'webtoon' ||
      isLoading ||
      pages.length === 0 ||
      restoredChapterIdRef.current === chapterId
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const targetPage = Math.max(
        0,
        Math.min(resumeTargetPageRef.current, pages.length - 1),
      );
      jumpToWebtoonPage(
        chapterId,
        targetPage,
        Math.max(0, pendingWebtoonOffsetRef.current),
      );
      restoredChapterIdRef.current = chapterId;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [chapterId, isLoading, jumpToWebtoonPage, mode, pages.length]);

  const loadPages = async () => {
    const loadToken = ++loadPagesTokenRef.current;
    try {
      setIsLoading(true);
      setError(null);
      setIsCloudflare(false);
      setOfflineUnavailable(false);
      setPages([]);
      setCurrentPage(0);
      loadedPagesChapterIdRef.current = null;
      restoredChapterIdRef.current = null;
      resumeTargetPageRef.current = 0;
      setDetectedDefaultMode(null);
      setMangaOriginalLanguage(undefined);
      isProgrammaticScrollRef.current = false;
      pendingWebtoonJumpRef.current = null;
      webtoonJumpTokenRef.current += 1;
      if (webtoonJumpTimerRef.current) {
        clearTimeout(webtoonJumpTimerRef.current);
        webtoonJumpTimerRef.current = null;
      }
      setWebtoonJumpActive(false);
      setActiveWebtoonChapterId(chapterId);
      setNextChapterPages([]);
      setNextChapterPageHeaders(undefined);
      nextChapterLoadRequestedRef.current = false;
      nextChapterLoadIdRef.current = null;
      webtoonMeasurementsRef.current.clear();
      pendingWebtoonOffsetRef.current = 0;
      currentWebtoonIndexRef.current = 0;
      webtoonContentOffsetRef.current = 0;
      webtoonScrollOffsetRef.current = 0;
      webtoonSuppressTrackingOffsetRef.current = null;

      // Check if downloaded locally
      const downloadedCh = useDownloadStore.getState().getChapter(chapterId!);
      let loadedPages: string[];
      if (downloadedCh && downloadedCh.status === 'completed' && downloadedCh.localPages.length > 0) {
        loadedPages = downloadedCh.localPages;
        if (downloadedCh.mangaTitle) setMangaTitle(downloadedCh.mangaTitle);
        if (downloadedCh.chapterNum) setChapterTitle(`Ch. ${downloadedCh.chapterNum}`);
      } else {
        const isOnline = await checkNetwork();
        if (loadPagesTokenRef.current !== loadToken) return;
        if (!isOnline) {
          setPages([]);
          setOfflineUnavailable(true);
          return;
        }

        const isExt = isExternalSource(chapterId!);
        if (isExt) {
          const result = await getUniversalChapterPages(chapterId!);
          if (loadPagesTokenRef.current !== loadToken) return;
          loadedPages = (result.pages || []).map((p) => {
            if (!p) return p;
            if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('file:')) {
              return p;
            }
            if (p.startsWith('/api/media/') || chapterId?.includes('philia')) {
              return `https://philiascans.org/${p.replace(/^\/+/, '')}`;
            }
            return p;
          });
          if (result.mangaId && !resolvedMangaId) {
            setResolvedMangaId(result.mangaId);
          }

          await CloudFlareCookieManager.init();
          if (loadPagesTokenRef.current !== loadToken) return;
          const isMangaDot = chapterId.includes('mangadot');
          const cfCookie = isMangaDot
            ? CloudFlareCookieManager.getCookie('mangadot.net')
            : chapterId.includes('reimanga')
            ? CloudFlareCookieManager.getCookie('reimanga.net')
            : chapterId.includes('manganato')
            ? CloudFlareCookieManager.getCookie('manganato.gg')
            : chapterId.includes('onisaga')
            ? CloudFlareCookieManager.getCookie('onisaga.com')
            : chapterId.includes('toonkotsu')
            ? CloudFlareCookieManager.getCookie('toonkotsu.com')
            : chapterId.includes('weebcentral')
            ? CloudFlareCookieManager.getCookie('weebcentral.com')
            : chapterId.includes('mangak')
            ? CloudFlareCookieManager.getCookie('mangak.io')
            : chapterId.includes('toonz')
            ? CloudFlareCookieManager.getCookie('toonz.to')
            : chapterId.includes('kagane')
            ? CloudFlareCookieManager.getCookie('kagane.moe')
            : undefined;

          const defaultHeaders: Record<string, string> = {
            'User-Agent': DEFAULT_USER_AGENT,
            Referer: isMangaDot
              ? 'https://mangadot.net/'
              : chapterId.includes('reimanga')
              ? 'https://reimanga.net/'
              : chapterId.includes('nhentai')
              ? 'https://nhentai.net/'
              : chapterId.includes('manganato')
              ? 'https://www.manganato.gg/'
              : chapterId.includes('onisaga')
              ? 'https://onisaga.com/'
              : chapterId.includes('toonkotsu')
              ? 'https://toonkotsu.com/'
              : chapterId.includes('weebcentral')
              ? 'https://weebcentral.com/'
              : chapterId.includes('mangak')
              ? 'https://mangak.io/'
              : chapterId.includes('mangafire')
              ? 'https://mangafire.to/'
              : chapterId.includes('toonz')
              ? 'https://toonz.to/'
              : chapterId.includes('kagane')
              ? 'https://kagane.moe/'
              : chapterId.includes('comix')
              ? 'https://comix.net/'
              : chapterId.includes('philia')
              ? 'https://philiascans.org/'
              : 'https://mangadex.org/',
          };
          if (cfCookie) {
            defaultHeaders['Cookie'] = cfCookie;
          }

          const fallbackHeaders = {
            ...defaultHeaders,
            ...(result.headers || {}),
          };
          setPageHeaders(fallbackHeaders);
        } else {
          const result = await getChapterPages(chapterId!, dataSaver);
          if (loadPagesTokenRef.current !== loadToken) return;
          loadedPages = result.pages;
        }
      }

      if (loadPagesTokenRef.current !== loadToken) return;

      const sanitizedPages = (loadedPages || []).map((p) => {
        if (!p) return p;
        if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('file:')) {
          return p;
        }
        if (p.startsWith('/api/media/') || chapterId?.includes('philia')) {
          return `https://philiascans.org/${p.replace(/^\/+/, '')}`;
        }
        return p;
      });

      let targetPage = 0;
      pendingWebtoonOffsetRef.current = 0;
      const historyEntry = useHistoryStore
        .getState()
        .entries.find((e) => e.chapterId === chapterId);
      if (page !== undefined && page !== null && page !== '') {
        targetPage = parseInt(page, 10);
      } else if (historyEntry) {
        targetPage = historyEntry.pageIndex;
      }
      const scrollOffsetParam = parseInt(rawScrollOffsetParam || '', 10);
      pendingWebtoonOffsetRef.current =
        !isNaN(scrollOffsetParam) && scrollOffsetParam > 0
          ? scrollOffsetParam
          : historyEntry?.scrollOffset || 0;
      const maxPage = Math.max(0, sanitizedPages.length - 1);
      const clampedPage = Math.max(0, Math.min(isNaN(targetPage) ? 0 : targetPage, maxPage));

      loadedPagesChapterIdRef.current = chapterId;
      resumeTargetPageRef.current = clampedPage;
      webtoonScrollOffsetRef.current = pendingWebtoonOffsetRef.current;
      setPages(sanitizedPages);
      setCurrentPage(clampedPage);
    } catch (err: any) {
      if (loadPagesTokenRef.current !== loadToken) return;
      const isCf =
        err?.isCloudFlare ||
        err?.name === 'CloudFlareError' ||
        err?.status === 403 ||
        (err?.message &&
          (err.message.toLowerCase().includes('cloudflare') ||
            err.message.toLowerCase().includes('just a moment') ||
            err.message.toLowerCase().includes('turnstile')));
      if (!isCf) {
        console.error('Failed to load pages:', err);
      } else {
        console.log('[Reader] Cloudflare verification required:', chapterId);
      }
      if (isCf) {
        setIsCloudflare(true);
        if (chapterId?.includes('reimanga')) {
          const parts = chapterId.replace(/^reimanga:/, '').split(':');
          setCfInAppUrl(
            parts.length > 0 && parts[0]
              ? `https://reimanga.net/manga/${parts[0].replace(/^manga\//, '')}`
              : 'https://reimanga.net/'
          );
        } else if (chapterId?.includes('mangadot')) {
          setCfInAppUrl('https://mangadot.net/');
        } else if (chapterId?.includes('manganato')) {
          setCfInAppUrl('https://manganato.gg/');
        } else if (chapterId?.includes('onisaga')) {
          setCfInAppUrl('https://onisaga.com/');
        } else if (chapterId?.includes('toonkotsu')) {
          setCfInAppUrl('https://toonkotsu.com/');
        } else if (chapterId?.includes('weebcentral')) {
          setCfInAppUrl('https://weebcentral.com/');
        } else if (chapterId?.includes('mangak')) {
          setCfInAppUrl('https://mangak.io/');
        } else if (chapterId?.includes('nhentai')) {
          setCfInAppUrl('https://nhentai.net/');
        } else if (chapterId?.includes('comix')) {
          setCfInAppUrl('https://comix.net/');
        } else if (chapterId?.includes('mangafire')) {
          setCfInAppUrl('https://mangafire.to/');
        } else if (chapterId?.includes('toonz')) {
          setCfInAppUrl('https://toonz.to/');
        } else if (chapterId?.includes('kagane')) {
          setCfInAppUrl('https://kagane.moe/');
        } else {
          setCfInAppUrl('https://mangadot.net/');
        }
      }

      const isOnline = await checkNetwork();
      if (loadPagesTokenRef.current !== loadToken) return;
      if (!isOnline) {
        setPages([]);
        setOfflineUnavailable(true);
      } else if (!isCf) {
        setError('Failed to load chapter pages. Please try again.');
      }
    } finally {
      if (loadPagesTokenRef.current === loadToken) {
        setIsLoading(false);
      }
    }
  };

  // Choose a per-title default after the chapter pages are available. The
  // explicit override in readerStore always wins, so automatic detection never
  // changes a mode the user deliberately selected for this title.
  useEffect(() => {
    if (isLoading || pages.length === 0 || !readerContentKey || modeOverrides[readerContentKey]) {
      return;
    }

    let cancelled = false;

    classifyDefaultReadingMode({
      pages,
      headers: pageHeaders,
      originalLanguage: mangaOriginalLanguage,
      sourceHint: `${chapterId || ''} ${readerContentKey}`,
    })
      .then((detectedMode) => {
        if (!cancelled) setDetectedDefaultMode(detectedMode);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId, isLoading, mangaOriginalLanguage, modeOverrides, pageHeaders, pages, readerContentKey]);

  // Auto-reload chapter pages when returning back to Yomite app from external browser
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isSolvingCloudflareRef.current) {
        isSolvingCloudflareRef.current = false;
        setIsCfInAppModalOpen(false);
        setIsCloudflare(false);
        setFailedPages(new Set());
        imageBridgeCache.clear();
        setReloadTrigger((v) => v + 1);
        persistentBridgeRef.current?.reload();
        loadPages();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleCloudflareSolved = useCallback(
    async (newCookie?: string) => {
      let domain = 'mangadot.net';
      if (chapterId.includes('reimanga')) {
        domain = 'reimanga.net';
      } else if (chapterId.includes('mangadot')) {
        domain = 'mangadot.net';
      } else if (chapterId.includes('manganato')) {
        domain = 'manganato.gg';
      } else if (chapterId.includes('onisaga')) {
        domain = 'onisaga.com';
      } else if (chapterId.includes('toonkotsu')) {
        domain = 'toonkotsu.com';
      } else if (chapterId.includes('weebcentral')) {
        domain = 'weebcentral.com';
      } else if (chapterId.includes('mangak')) {
        domain = 'mangak.io';
      } else if (chapterId.includes('nhentai')) {
        domain = 'nhentai.net';
      } else if (chapterId.includes('comix')) {
        domain = 'comix.to';
      } else if (chapterId.includes('mangafire')) {
        domain = 'mangafire.to';
      } else if (chapterId.includes('toonz')) {
        domain = 'toonz.to';
      } else if (chapterId.includes('kagane')) {
        domain = 'kagane.moe';
      } else if (pages.length > 0 && pages[0]) {
        try {
          const u = new URL(pages[0]);
          domain = u.host;
        } catch {
          domain = 'mangadot.net';
        }
      }

      if (domain) {
        webViewBridge.setDomainVerified(domain, true);
        if (newCookie) {
          const match = newCookie.match(/cf_clearance=([^;]+)/);
          if (match) {
            await CloudFlareCookieManager.setCookie(domain, match[0]);
          } else {
            await CloudFlareCookieManager.setCookie(domain, newCookie);
          }
        }
      }

      const activeCookie = domain ? CloudFlareCookieManager.getCookie(domain) : null;
      if (activeCookie) {
        setPageHeaders((prev) => ({
          ...(prev || {}),
          Cookie: activeCookie,
        }));
      }

      setIsCfInAppModalOpen(false);
      setIsCloudflare(false);
      setFailedPages(new Set());
      imageBridgeCache.clear();
      setReloadTrigger((v) => v + 1);

      // Refresh persistent background bridge session with the newly acquired cookies
      persistentBridgeRef.current?.reload();

      if (pages.length === 0) {
        loadPages();
      }
    },
    [chapterId, pages]
  );

  const handleCfNavStateChange = useCallback(
    (navState: any) => {
      const url = navState.url || '';
      const title = (navState.title || '').toLowerCase();

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
      const isTargetDomain =
        url.includes('reimanga.net') ||
        url.includes('mangadot.net') ||
        url.includes('manganato') ||
        url.includes('onisaga') ||
        url.includes('toonkotsu') ||
        url.includes('weebcentral') ||
        url.includes('mangak') ||
        url.includes('nhentai') ||
        url.includes('toonz') ||
        url.includes('kagane') ||
        url.includes('mangafire') ||
        url.includes('comix');

      if (!navState.loading && isTargetDomain && !isCfTitle && !isCfHost) {
        if (!hasSolvedRef.current) {
          hasSolvedRef.current = true;
          cfWebViewRef.current?.injectJavaScript(`
            (function() {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'CF_SOLVED',
                cookie: document.cookie || '',
                url: window.location.href
              }));
            })();
            true;
          `);
        }
      }
    },
    []
  );

  const handleOpenCloudflareVerification = useCallback(() => {
    let targetUrl = 'https://mangadot.net/';
    if (chapterId.includes('reimanga')) {
      const parts = chapterId.replace(/^reimanga:/, '').split(':');
      targetUrl =
        parts.length > 0 && parts[0]
          ? `https://reimanga.net/manga/${parts[0].replace(/^manga\//, '')}`
          : 'https://reimanga.net/';
    } else if (chapterId.includes('mangadot')) {
      targetUrl = 'https://mangadot.net/';
    } else if (chapterId.includes('manganato')) {
      targetUrl = 'https://manganato.gg/';
    } else if (chapterId.includes('nhentai')) {
      targetUrl = 'https://nhentai.net/';
    } else if (chapterId.includes('comix')) {
      targetUrl = 'https://comix.net/';
    } else if (chapterId.includes('mangafire')) {
      targetUrl = 'https://mangafire.to/';
    } else if (chapterId.includes('toonz')) {
      targetUrl = 'https://toonz.to/';
    } else if (chapterId.includes('kagane')) {
      targetUrl = 'https://kagane.moe/';
    } else if (chapterId.includes('weebcentral')) {
      targetUrl = 'https://weebcentral.com/';
    } else if (chapterId.includes('mangak')) {
      targetUrl = 'https://mangak.io/';
    } else if (chapterId.includes('onisaga')) {
      targetUrl = 'https://onisaga.com/';
    } else if (chapterId.includes('toonkotsu')) {
      targetUrl = 'https://toonkotsu.com/';
    } else if (pages.length > 0 && pages[0]) {

      try {
        const u = new URL(pages[0]);
        targetUrl = `${u.protocol}//${u.host}/`;
      } catch {
        targetUrl = 'https://mangadot.net/';
      }
    }
    setCfInAppUrl(targetUrl);
    hasSolvedRef.current = false;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWindowFocus = () => {
        window.removeEventListener('focus', handleWindowFocus);
        handleCloudflareSolved();
      };
      window.addEventListener('focus', handleWindowFocus);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      setIsCfInAppModalOpen(true);
    } else {
      setIsCfInAppModalOpen(true);
    }
  }, [chapterId, pages, handleCloudflareSolved]);

  const handleImageError = useCallback((index: number) => {
    setFailedPages((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const handleImageSuccess = useCallback((index: number) => {
    setFailedPages((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const renderCloudflareModal = () => (
    <Modal
      visible={isCfInAppModalOpen}
      animationType="slide"
      onRequestClose={() => setIsCfInAppModalOpen(false)}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.cfHeaderRow, { backgroundColor: colors.surfaceElevated, borderBottomWidth: 0 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
            <Text style={[styles.cfHeaderTitle, { color: colors.text }]}>Verification</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => {
                const domain = chapterId.includes('reimanga')
                  ? 'reimanga.net'
                  : chapterId.includes('onisaga')
                  ? 'onisaga.com'
                  : chapterId.includes('toonkotsu')
                  ? 'toonkotsu.com'
                  : chapterId.includes('weebcentral')
                  ? 'weebcentral.com'
                  : 'mangadot.net';
                webViewBridge.setDomainVerified(domain, true);
                setIsCfInAppModalOpen(false);
                loadPages();
              }}
              style={({ pressed }) => [
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
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accentForeground }}>Done</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const domain = chapterId.includes('reimanga')
                  ? 'reimanga.net'
                  : chapterId.includes('onisaga')
                  ? 'onisaga.com'
                  : chapterId.includes('toonkotsu')
                  ? 'toonkotsu.com'
                  : chapterId.includes('weebcentral')
                  ? 'weebcentral.com'
                  : 'mangadot.net';
                webViewBridge.setDomainVerified(domain, true);
                setIsCfInAppModalOpen(false);
                loadPages();
              }}
              style={({ pressed }) => [
                {
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              aria-label="Close Verification"
            >
              <Ionicons name="close" size={20} color={colors.text} />
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
            onNavigationStateChange={handleCfNavStateChange}
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
              const isTargetDomain =
                url.includes('reimanga.net') ||
                url.includes('mangadot.net') ||
                url.includes('manganato') ||
                url.includes('onisaga') ||
                url.includes('toonkotsu') ||
                url.includes('weebcentral') ||
                url.includes('mangak') ||
                url.includes('nhentai') ||
                url.includes('toonz') ||
                url.includes('kagane') ||
                url.includes('mangafire') ||
                url.includes('comix');

              if (isTargetDomain && !isCfTitle && !isCfHost) {
                if (!hasSolvedRef.current) {
                  hasSolvedRef.current = true;
                  cfWebViewRef.current?.injectJavaScript(`
                    (function() {
                      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'CF_SOLVED',
                        cookie: document.cookie || '',
                        url: window.location.href
                      }));
                    })();
                    true;
                  `);
                }
              }
            }}
            injectedJavaScript={`
              (function() {
                var attempts = 0;
                var interval = setInterval(function() {
                  attempts++;
                  var href = window.location.href || '';
                  var title = (document.title || '').toLowerCase();
                  var isChallenge = title.includes('just a moment') ||
                                    title.includes('turnstile') ||
                                    title.includes('security check') ||
                                    title.includes('attention required') ||
                                    href.includes('challenges.cloudflare.com') ||
                                    document.querySelector('#challenge-running') ||
                                    document.querySelector('#challenge-stage');

                  if (isChallenge) return;

                  var cookie = document.cookie || '';
                  var isFinished = document.readyState === 'complete';

                  if (isFinished || cookie.includes('cf_clearance') || attempts > 8) {
                    clearInterval(interval);
                    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'CF_SOLVED',
                      cookie: cookie,
                      url: href
                    }));
                  }
                }, 1000);
              })();
              true;
            `}
            onMessage={async (event: any) => {
              try {
                const parsed = JSON.parse(event.nativeEvent.data);
                if (webViewBridge.handleMessage(parsed)) {
                  return;
                }
                if (parsed.type === 'CF_SOLVED') {
                  await handleCloudflareSolved(parsed.cookie);
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
                handleCloudflareSolved();
              }}
              style={[styles.retryButton, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              aria-label="Done Verification"
            >
              <Text style={[styles.retryText, { color: getContrastTextColor(colors.accent) }]}>Done</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );

  const loadMangaMeta = async () => {
    try {
      let targetMangaId = mangaId || resolvedMangaId;
      if (!targetMangaId && isExternalSource(chapterId)) {
        if (chapterId.startsWith('nhentai:')) {
          targetMangaId = chapterId;
          setResolvedMangaId(chapterId);
        } else if (chapterId.includes('__')) {
          const parts = chapterId.split('__');
          targetMangaId = parts[0];
          setResolvedMangaId(parts[0]);
        } else {
          const historyEntry = useHistoryStore.getState().entries.find((e) => e.chapterId === chapterId);
          if (historyEntry && historyEntry.mangaId && historyEntry.mangaId !== chapterId) {
            targetMangaId = historyEntry.mangaId;
            setResolvedMangaId(historyEntry.mangaId);
          }
        }
      }
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
        setMangaOriginalLanguage(manga?.attributes?.originalLanguage);

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
          if (!selectedScanlator || selectedScanlator === 'all') {
            const chScanlator = getChapterScanlator(activeCh);
            if (chScanlator && chScanlator !== 'Unknown') {
              setSelectedScanlator(chScanlator);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load reader metadata:', err);
    }
  };

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
    const target = (mangaId || chapterId || resolvedMangaId || '').toLowerCase();
    return target.includes('mangadot');
  }, [mangaId, chapterId, resolvedMangaId]);

  // Compute available scanlation groups only for MangaDot
  const availableScanlators = useMemo(() => {
    if (!isMangaDot) return [];
    const counts: Record<string, number> = {};
    for (const c of chapterList) {
      const sc = getChapterScanlator(c);
      counts[sc] = (counts[sc] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [chapterList, getChapterScanlator, isMangaDot]);

  // Chapters filtered strictly according to user chosen scanlation group
  const effectiveChapterList = useMemo(() => {
    if (isMangaDot && selectedScanlator && selectedScanlator !== 'all') {
      const filtered = chapterList.filter((c) => getChapterScanlator(c) === selectedScanlator);
      if (filtered.length > 0) return filtered;
    }
    return chapterList;
  }, [chapterList, selectedScanlator, getChapterScanlator, isMangaDot]);

  // Chapter Switching (strictly aware of chosen scanlation group)
  const currentChapterIdx = effectiveChapterList.findIndex((c) => c.id === chapterId);
  const currentChapter = currentChapterIdx >= 0
    ? effectiveChapterList[currentChapterIdx]
    : effectiveChapterList.find((c) => {
        const currentNumber = getChapterNumberFromId(chapterId || '');
        return currentNumber !== null && Number(c.attributes.chapter) === currentNumber;
      });
  const currentChapterNumber = currentChapter?.attributes.chapter
    ? Number(currentChapter.attributes.chapter)
    : (getChapterNumberFromId(chapterId || '') ?? parseChapterNumber(chapterTitle));

  const nextChapterId = currentChapterNumber !== null
    ? effectiveChapterList
        .filter((chapter) => Number(chapter.attributes.chapter) > currentChapterNumber)
        .sort((a, b) => Number(a.attributes.chapter) - Number(b.attributes.chapter))[0]?.id
    : (currentChapterIdx > 0 ? effectiveChapterList[currentChapterIdx - 1]?.id : undefined);

  const prevChapterId = currentChapterNumber !== null
    ? effectiveChapterList
        .filter((chapter) => Number(chapter.attributes.chapter) < currentChapterNumber)
        .sort((a, b) => Number(b.attributes.chapter) - Number(a.attributes.chapter))[0]?.id
    : (currentChapterIdx >= 0 && currentChapterIdx < effectiveChapterList.length - 1
        ? effectiveChapterList[currentChapterIdx + 1]?.id
        : undefined);

  const hasNextChapter = !!nextChapterId;
  const hasPrevChapter = !!prevChapterId;

  // Save progress to history & update library unread badge
  useEffect(() => {
    if (loadedPagesChapterIdRef.current !== chapterId) return;
    if (pages.length > 0 && chapterId && (mode !== 'webtoon' || activeWebtoonChapterId === chapterId)) {
      const activeMangaId = mangaId || resolvedMangaId || chapterId!;
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
      const targetEntry =
        libStore.entries[activeMangaId] ||
        (resolvedMangaId ? libStore.entries[resolvedMangaId] : undefined) ||
        (mangaTitle
          ? Object.values(libStore.entries).find(
              (e) => e.title.toLowerCase() === mangaTitle.toLowerCase()
            )
          : undefined);

      if (targetEntry) {
        let unread: number | undefined;

        if (targetEntry.category === 'completed') {
          unread = 0;
        } else if (effectiveChapterList && effectiveChapterList.length > 0) {
          if (currentChapterNumber !== null && !isNaN(currentChapterNumber)) {
            const unreadChapters = effectiveChapterList.filter((c) => {
              const num = parseFloat(c.attributes.chapter || '');
              return !isNaN(num) && num > currentChapterNumber;
            });
            unread = unreadChapters.length;
          } else {
            const idx = effectiveChapterList.findIndex((c) => c.id === chapterId);
            if (idx >= 0) {
              const firstNum = parseFloat(effectiveChapterList[0]?.attributes?.chapter || '0');
              const lastNum = parseFloat(
                effectiveChapterList[effectiveChapterList.length - 1]?.attributes?.chapter || '0'
              );
              const isDesc = firstNum >= lastNum;
              unread = isDesc ? idx : effectiveChapterList.length - 1 - idx;
            }
          }
        }

        // Fallback: If chapter list is not loaded yet, compute from targetEntry.totalChapters & currentChapterNumber
        if (unread === undefined && targetEntry.totalChapters > 0) {
          const chNum =
            currentChapterNumber ?? parseChapterNumber(chapterTitle) ?? parseChapterNumber(chapterId);
          if (chNum !== null && chNum > 0) {
            const readCount = Math.min(targetEntry.totalChapters, Math.floor(chNum));
            unread = Math.max(0, targetEntry.totalChapters - readCount);
          }
        }

        libStore.updateReadProgress(targetEntry.mangaId, chapterId!, currentPage, unread);
      }
    }
  }, [
    activeWebtoonChapterId,
    chapterId,
    currentPage,
    mode,
    pages.length,
    mangaTitle,
    chapterTitle,
    coverUrl,
    effectiveChapterList,
    mangaId,
    resolvedMangaId,
    currentChapterNumber,
  ]);

  // Keep the next chapter unloaded until the reader reaches the current chapter's
  // boundary. This mirrors Kotatsu's lazy adjacent-chapter loading behavior.
  useEffect(() => {
    setNextChapterPages([]);
    setNextChapterPageHeaders(undefined);
    nextChapterLoadRequestedRef.current = false;
    nextChapterLoadIdRef.current = null;
    setActiveWebtoonChapterId(chapterId);
  }, [dataSaver, mode, nextChapterId]);

  const loadNextChapterPages = useCallback(async () => {
    if (mode !== 'webtoon' || !nextChapterId || nextChapterLoadRequestedRef.current) return;
    nextChapterLoadRequestedRef.current = true;
    nextChapterLoadIdRef.current = nextChapterId;
    const requestedNextChapterId = nextChapterId;
    try {
      const result = isExternalSource(requestedNextChapterId)
        ? await getUniversalChapterPages(requestedNextChapterId)
        : await getChapterPages(requestedNextChapterId, dataSaver);
      if (nextChapterLoadIdRef.current !== requestedNextChapterId) return;
      const rawPages = result.pages || [];
      const sanitizedNextPages = rawPages.map((p) => {
        if (!p) return p;
        if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('file:')) {
          return p;
        }
        if (p.startsWith('/api/media/') || nextChapterId?.includes('philia')) {
          return `https://philiascans.org/${p.replace(/^\/+/, '')}`;
        }
        return p;
      });
      setNextChapterPages(sanitizedNextPages);
      const isExtNext = isExternalSource(nextChapterId);
      if (isExtNext) {
        const cfCookie = nextChapterId.includes('mangadot')
          ? CloudFlareCookieManager.getCookie('mangadot.net')
          : nextChapterId.includes('reimanga')
          ? CloudFlareCookieManager.getCookie('reimanga.net')
          : nextChapterId.includes('manganato')
          ? CloudFlareCookieManager.getCookie('manganato.gg')
          : nextChapterId.includes('onisaga')
          ? CloudFlareCookieManager.getCookie('onisaga.com')
          : nextChapterId.includes('toonkotsu')
          ? CloudFlareCookieManager.getCookie('toonkotsu.com')
          : undefined;

        const defaultHeaders: Record<string, string> = {
          'User-Agent': DEFAULT_USER_AGENT,
          Referer: nextChapterId.includes('mangadot')
            ? 'https://mangadot.net/'
            : nextChapterId.includes('reimanga')
            ? 'https://reimanga.net/'
            : nextChapterId.includes('nhentai')
            ? 'https://nhentai.net/'
            : nextChapterId.includes('manganato')
            ? 'https://www.manganato.gg/'
            : nextChapterId.includes('onisaga')
            ? 'https://onisaga.com/'
            : nextChapterId.includes('toonkotsu')
            ? 'https://toonkotsu.com/'
            : 'https://mangadex.org/',
        };
        if (cfCookie) {
          defaultHeaders['Cookie'] = cfCookie;
        }

        const fallbackNextHeaders = {
          ...defaultHeaders,
          ...('headers' in result && result.headers ? result.headers : {}),
        };
        setNextChapterPageHeaders(fallbackNextHeaders);
      } else {
        setNextChapterPageHeaders(undefined);
      }
    } catch (err) {
      if (nextChapterLoadIdRef.current === requestedNextChapterId) {
        nextChapterLoadRequestedRef.current = false;
      }
      console.warn('Unable to load next chapter webtoon pages:', err);
    }
  }, [dataSaver, mode, nextChapterId]);
  loadNextChapterPagesRef.current = loadNextChapterPages;

  // A page is identified by {chapterId, localIndex}, never by its FlatList index.
  // The global index is derived from the current concatenated data array, so it
  // stays correct when the next chapter is appended or measurements reflow.
  const webtoonStripPages = useMemo<WebtoonStripPage[]>(() => {
    const strip: WebtoonStripPage[] = [];
    pages.forEach((url, localIndex) => {
      strip.push({
        key: getWebtoonPageKey(chapterId, localIndex),
        chapterId,
        localIndex,
        globalIndex: strip.length,
        url,
      });
    });
    if (nextChapterPages.length > 0 && nextChapterId) {
      nextChapterPages.forEach((url, localIndex) => {
        strip.push({
          key: getWebtoonPageKey(nextChapterId, localIndex),
          chapterId: nextChapterId,
          localIndex,
          globalIndex: strip.length,
          url,
        });
      });
    }
    return strip;
  }, [chapterId, nextChapterId, nextChapterPages, pages]);
  webtoonStripPagesRef.current = webtoonStripPages;

  useEffect(() => {
    const validKeys = new Set(webtoonStripPages.map((stripPage) => stripPage.key));
    webtoonMeasurementsRef.current.forEach((_measurement, key) => {
      if (!validKeys.has(key)) {
        webtoonMeasurementsRef.current.delete(key);
      }
    });
  }, [webtoonStripPages]);

  const readingNextChapter =
    !!nextChapterId &&
    activeWebtoonChapterId === nextChapterId &&
    nextChapterPages.length > 0;
  const activeAppendedChapter = readingNextChapter
    ? chapterList.find((c) => c.id === nextChapterId)
    : undefined;
  const activePageCount = readingNextChapter ? nextChapterPages.length : pages.length;
  const activeChapterIdForPages = readingNextChapter ? nextChapterId : chapterId;
  const activeChapterTitle = activeAppendedChapter
    ? `${activeAppendedChapter.attributes.chapter ? `Ch. ${activeAppendedChapter.attributes.chapter}` : 'Chapter'}${activeAppendedChapter.attributes.title ? ` - ${activeAppendedChapter.attributes.title}` : ''}`
    : chapterTitle;
  const activeChapterPublishAt = activeAppendedChapter?.attributes.publishAt || activeAppendedChapter?.attributes.readableAt || currentChapterPublishAt;
  const activeScanlationGroup = activeAppendedChapter ? extractScanlationGroupName(activeAppendedChapter) : scanlationGroup;
  const activeUploaderName = activeAppendedChapter ? extractUploaderUsername(activeAppendedChapter) : uploaderName;
  const handleToggleReaderBookmark = useCallback(() => {
    if (!mangaId) return;

    if (readerLibraryEntry) {
      removeFromLibrary(mangaId);
    } else {
      addToLibrary({
        mangaId,
        title: mangaTitle,
        coverUrl: coverUrl || '',
        category: 'reading',
        lastReadChapterId: activeWebtoonChapterId || chapterId,
        lastReadPage: currentPage,
        totalChapters: chapterList.length,
        unreadCount: chapterList.length,
        description: '',
      });
    }
  }, [activeWebtoonChapterId, addToLibrary, chapterId, chapterList.length, coverUrl, currentPage, mangaId, mangaTitle, readerLibraryEntry, removeFromLibrary]);
  useEffect(() => {
    if (!readingNextChapter || !nextChapterId || currentPage < 0 || nextChapterPages.length === 0) {
      return;
    }
    addHistoryEntry({
      mangaId: mangaId ?? resolvedMangaId ?? nextChapterId,
      chapterId: nextChapterId,
      title: mangaTitle,
      chapterTitle: activeChapterTitle,
      coverUrl,
      pageIndex: currentPage,
      totalPages: nextChapterPages.length,
      scrollOffset: webtoonScrollOffsetRef.current,
    });
  }, [activeChapterTitle, addHistoryEntry, coverUrl, currentPage, mangaId, mangaTitle, nextChapterId, nextChapterPages.length, readingNextChapter, resolvedMangaId]);

  const saveWebtoonProgress = useCallback(() => {
    if (mode !== 'webtoon' || activePageCount === 0) return;
    updateWebtoonPosition(webtoonContentOffsetRef.current);

    const activePage = webtoonStripPagesRef.current[currentWebtoonIndexRef.current];
    const saveChapterId = activePage?.chapterId || activeChapterIdForPages;
    if (!saveChapterId) return;
    const savePageIndex = activePage ? activePage.localIndex : currentPage;
    const saveTotalPages = activePage
      ? activePage.chapterId === nextChapterId
        ? nextChapterPages.length
        : pages.length
      : activePageCount;
    const saveChapter = chapterList.find((chapter) => chapter.id === saveChapterId);
    const saveChapterTitle = saveChapter
      ? `${saveChapter.attributes.chapter ? `Ch. ${saveChapter.attributes.chapter}` : 'Chapter'}${saveChapter.attributes.title ? ` - ${saveChapter.attributes.title}` : ''}`
      : activeChapterTitle;

    addHistoryEntry({
      mangaId: mangaId ?? resolvedMangaId ?? saveChapterId,
      chapterId: saveChapterId,
      title: mangaTitle,
      chapterTitle: saveChapterTitle,
      coverUrl,
      pageIndex: savePageIndex,
      totalPages: saveTotalPages,
      scrollOffset: webtoonScrollOffsetRef.current,
    });
  }, [activeChapterIdForPages, activeChapterTitle, activePageCount, addHistoryEntry, chapterList, coverUrl, currentPage, mangaId, mangaTitle, mode, nextChapterId, nextChapterPages.length, pages.length, resolvedMangaId, updateWebtoonPosition]);

  const navigateToChapter = useCallback(
    (targetChapterId: string) => {
      setSideMenuVisible(false);
      const mId = mangaId || resolvedMangaId;
      const scanlatorQuery = selectedScanlator && selectedScanlator !== 'all' ? `&scanlator=${encodeURIComponent(selectedScanlator)}` : '';
      const query = mId ? `?mangaId=${encodeURIComponent(mId)}${scanlatorQuery}` : (scanlatorQuery ? `?${scanlatorQuery.slice(1)}` : '');
      router.replace(`/reader/${encodeURIComponent(targetChapterId)}${query}` as any);
    },
    [mangaId, resolvedMangaId, selectedScanlator, router]
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
      const pageCount = readingNextChapter ? nextChapterPages.length : pages.length;
      const clamped = Math.max(0, Math.min(pageIdx, pageCount - 1));
      setCurrentPage(clamped);

      if (mode === 'webtoon') {
        if (activeChapterIdForPages) {
          // Resolve the stable page key now; the jump keeps working even if
          // the next chapter gets appended while measurements are pending.
          jumpToWebtoonPage(activeChapterIdForPages, clamped, 0);
        }
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
    [activeChapterIdForPages, jumpToWebtoonPage, mode, nextChapterPages.length, pages.length, readingNextChapter, windowWidth]
  );

  useEffect(() => {
    Animated.spring(controlsProgress, {
      toValue: controlsVisible ? 1 : 0,
      useNativeDriver: true,
      tension: 85,
      friction: 13,
    }).start();
  }, [controlsProgress, controlsVisible]);

  useEffect(() => {
    if (timelineDraggingRef.current) return;
    const ratio = activePageCount > 1 ? currentPage / (activePageCount - 1) : 0;
    sliderProgress.setValue(Math.max(0, Math.min(1, ratio)));
  }, [activePageCount, currentPage, sliderProgress]);

  const timelineDragStartRatio = useRef(0);
  const timelinePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const ratio = pageTimelineWidth > 0
        ? event.nativeEvent.locationX / pageTimelineWidth
        : 0;
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      timelineDragStartRatio.current = clampedRatio;
      timelineDraggingRef.current = true;
      const previewPage = Math.round(clampedRatio * Math.max(0, activePageCount - 1));
      timelinePreviewPageRef.current = previewPage;
      setTimelinePreviewPage(previewPage);
      sliderProgress.setValue(clampedRatio);
    },
    onPanResponderMove: (_event, gestureState) => {
      if (pageTimelineWidth <= 0) return;
      const ratio = Math.max(
        0,
        Math.min(1, timelineDragStartRatio.current + gestureState.dx / pageTimelineWidth),
      );
      const previewPage = Math.round(ratio * Math.max(0, activePageCount - 1));
      sliderProgress.setValue(ratio);
      timelinePreviewPageRef.current = previewPage;
      setTimelinePreviewPage(previewPage);
    },
    onPanResponderRelease: () => {
      const previewPage = timelinePreviewPageRef.current;
      timelineDraggingRef.current = false;
      timelinePreviewPageRef.current = null;
      setTimelinePreviewPage(null);
      if (previewPage !== null) goToPage(previewPage);
    },
    onPanResponderTerminate: () => {
      timelineDraggingRef.current = false;
      timelinePreviewPageRef.current = null;
      setTimelinePreviewPage(null);
      sliderProgress.setValue(activePageCount > 1 ? currentPage / (activePageCount - 1) : 0);
    },
  }), [activePageCount, goToPage, pageTimelineWidth, sliderProgress]);

  const goToNextPageOrChapter = useCallback(() => {
    if (currentPage < activePageCount - 1) {
      goToPage(currentPage + 1);
    } else if (readingNextChapter) {
      return;
    } else if (mode === 'webtoon' && nextChapterPages.length > 0 && nextChapterId) {
      setActiveWebtoonChapterId(nextChapterId);
      setCurrentPage(0);
      jumpToWebtoonPage(nextChapterId, 0, 0);
    } else if (hasNextChapter) {
      if (hapticsEnabled && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      handleNextChapter();
    }
  }, [activePageCount, currentPage, goToPage, hasNextChapter, handleNextChapter, hapticsEnabled, jumpToWebtoonPage, mode, nextChapterId, nextChapterPages.length, readingNextChapter]);

  const goToPrevPageOrChapter = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    } else if (readingNextChapter && nextChapterId && pages.length > 0) {
      setActiveWebtoonChapterId(chapterId);
      setCurrentPage(pages.length - 1);
      if (mode === 'webtoon') {
        jumpToWebtoonPage(chapterId, pages.length - 1, 0);
      } else {
        goToPage(pages.length - 1);
      }
    } else if (hasPrevChapter) {
      if (hapticsEnabled && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      handlePrevChapter();
    }
  }, [chapterId, currentPage, goToPage, hasPrevChapter, handlePrevChapter, hapticsEnabled, jumpToWebtoonPage, mode, nextChapterId, pages.length, readingNextChapter]);

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

  // Keep the page item prop stable. The ref still routes taps to the latest
  // navigation state without invalidating every mounted page on progress updates.
  const handlePageTapRef = useRef(handlePageTap);
  useEffect(() => {
    handlePageTapRef.current = handlePageTap;
  }, [handlePageTap]);
  const stablePageTap = useCallback((x: number) => handlePageTapRef.current(x), []);

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
            offset: Math.max(0, webtoonContentOffsetRef.current - windowHeight * 0.8),
            animated: true,
          });
        } else {
          goToPrevPageOrChapter();
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        if (mode === 'webtoon') {
          webtoonListRef.current?.scrollToOffset({
            offset: webtoonContentOffsetRef.current + windowHeight * 0.8,
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
        onTap={stablePageTap}
        headers={pageHeaders}
        reloadTrigger={reloadTrigger}
        onImageError={handleImageError}
        onImageSuccess={handleImageSuccess}
        onCloudflareVerify={handleOpenCloudflareVerification}
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
          onTap={stablePageTap}
          headers={pageHeaders}
          reloadTrigger={reloadTrigger}
          onImageError={handleImageError}
          onImageSuccess={handleImageSuccess}
          onCloudflareVerify={handleOpenCloudflareVerification}
        />
        {rightUrl && (
          <ReaderImagePage
            url={mode === 'rtl' ? leftUrl : rightUrl}
            index={pageIndex + 1}
            width={windowWidth / 2}
            height={windowHeight}
            contentFit="contain"
            onTap={stablePageTap}
            headers={pageHeaders}
            reloadTrigger={reloadTrigger}
            onImageError={handleImageError}
            onImageSuccess={handleImageSuccess}
            onCloudflareVerify={handleOpenCloudflareVerification}
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

  if (isCloudflare) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.centerContainer, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
          <Ionicons name="shield-checkmark-outline" size={56} color={colors.accent} />
          <Text style={[styles.errorText, { color: colors.text, marginTop: 16, fontSize: 18, fontWeight: '700' }]}>
            Cloudflare Verification Required
          </Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24, fontSize: 14, lineHeight: 20 }}>
            This chapter is protected by Cloudflare anti-bot. Solve the verification once to continue reading.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.accent, paddingHorizontal: 28, paddingVertical: 14 },
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleOpenCloudflareVerification}
            accessibilityRole="button"
            aria-label="Verify via In-App Browser"
          >
            <Ionicons name="shield-checkmark" size={18} color={getContrastTextColor(colors.accent)} />
            <Text style={[styles.retryText, { color: getContrastTextColor(colors.accent), marginLeft: 8 }]}>
              Verify via In-App Browser
            </Text>
          </Pressable>

          <Pressable
            style={[styles.backTextButton, { marginTop: 20 }]}
            onPress={() => {
              if (mangaId || resolvedMangaId) {
                router.replace(`/manga/${mangaId || resolvedMangaId}` as any);
              } else if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)' as any);
              }
            }}
            accessibilityRole="button"
            aria-label="Return to Manga Details"
          >
            <Text style={[styles.backTextLabel, { color: colors.textMuted }]}>
              ← Return to Manga Details
            </Text>
          </Pressable>
        </View>

        {renderCloudflareModal()}
      </View>
    );
  }

  if (error || pages.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
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
                accessibilityRole="button"
                aria-label="Previous Chapter"
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
              accessibilityRole="button"
              aria-label="Retry"
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
                accessibilityRole="button"
                aria-label="Next Chapter"
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
            accessibilityRole="button"
            aria-label="Return to Manga Details"
          >
            <Text style={[styles.backTextLabel, { color: colors.textMuted }]}>
              ← Return to Manga Details
            </Text>
          </Pressable>
        </View>

        {renderCloudflareModal()}
      </View>
    );
  }

  const pageTimelineDotCount = Math.min(activePageCount, 18);
  const topCurtainY = controlsProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 0],
  });
  const bottomCurtainY = controlsProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [140, 0],
  });

  return (
    <View style={[styles.readerContainer, { backgroundColor: readerTheme.background }]}>
      <StatusBar hidden={headerHidden || !controlsVisible} />

      {/* Reader Layout Mode */}
      {mode === 'webtoon' ? (
        <FlatList
          key={`flatlist-webtoon-${chapterId}-${pages.length > 0 ? 'ready' : 'empty'}`}
          ref={webtoonListRef}
          style={styles.webtoonList}
          data={webtoonStripPages}
          keyExtractor={(page) => page.key}
          getItemLayout={getWebtoonItemLayout}
          initialScrollIndex={
            currentPage > 0 && currentPage < pages.length ? currentPage : undefined
          }
          renderItem={({ item: page }) => (
            <WebtoonPageItem
              url={page.url}
              index={page.globalIndex}
              webtoonWidth={webtoonWidth}
              windowHeight={windowHeight}
              imageFit={imageFit}
              onTap={stablePageTap}
              headers={page.chapterId === chapterId ? pageHeaders : nextChapterPageHeaders}
              reloadTrigger={reloadTrigger}
              onImageError={handleImageError}
              onImageSuccess={handleImageSuccess}
              onCloudflareVerify={handleOpenCloudflareVerification}
            />
          )}
          CellRendererComponent={webtoonCellRenderer}
          removeClippedSubviews={false}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          maxToRenderPerBatch={webtoonJumpActive ? 12 : 5}
          updateCellsBatchingPeriod={50}
          initialNumToRender={5}
          windowSize={webtoonJumpActive ? 21 : 7}
          onScroll={({ nativeEvent }) => {
            webtoonContentOffsetRef.current = nativeEvent.contentOffset.y;
            queueWebtoonPositionUpdate();
          }}
          onScrollEndDrag={saveWebtoonProgress}
          onMomentumScrollEnd={() => {
            queueWebtoonPositionUpdate();
            saveWebtoonProgress();
          }}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            // A page-selector/history restore may still be retrying while image
            // heights settle. Once the reader drags, their scroll must win.
            cancelWebtoonJump();
            isProgrammaticScrollRef.current = false;
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

      {/* Cloudflare Challenge Warning Floating Banner */}
      {failedPages.size > 0 && isCloudflareSource && !controlsVisible && (
        <View
          style={[
            styles.cfFloatingBanner,
            {
              backgroundColor: colors.surfaceElevated,
            },
          ]}
        >
          <Ionicons name="shield-outline" size={18} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cfFloatingBannerTitle, { color: colors.text }]}>
              Cloudflare Verification
            </Text>
            <Text style={[styles.cfFloatingBannerSubtitle, { color: colors.textSecondary }]}>
              {failedPages.size} {failedPages.size === 1 ? 'page requires' : 'pages require'} verification
            </Text>
          </View>
          <Pressable
            onPress={handleOpenCloudflareVerification}
            style={({ pressed }) => [
              styles.cfFloatingBannerBtn,
              { backgroundColor: colors.accent },
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            aria-label="Verify Cloudflare"
          >
            <Text style={[styles.cfFloatingBannerBtnText, { color: getContrastTextColor(colors.accent) }]}>
              Verify
            </Text>
          </Pressable>
        </View>
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
      {Platform.OS !== 'web' && (
        <Animated.View pointerEvents={controlsVisible ? 'box-none' : 'none'} style={StyleSheet.absoluteFill}>
          {/* Top Bar */}

          <Animated.View style={[styles.topBar, { backgroundColor: colors.surfaceElevated }, { transform: [{ translateY: topCurtainY }] }]}>
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
              onPress={handleToggleReaderBookmark}
              style={styles.controlButton}
              accessibilityRole="button"
              accessibilityLabel={readerLibraryEntry ? 'Remove bookmark' : 'Bookmark manga'}
            >
              <Ionicons
                name={readerLibraryEntry ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={readerLibraryEntry ? colors.accent : colors.text}
              />
            </Pressable>
          </Animated.View>

         {/* Mode Selector Quick Bar */}
          {showModeSelector && (
            <View style={[styles.modeSelectorContainer, { backgroundColor: colors.surface }]}>
              {(Object.keys(MODE_LABELS) as ReadingMode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    handleSetReaderMode(m);
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

          <Animated.View style={[styles.bottomBar, { backgroundColor: colors.surfaceElevated, paddingBottom: insets.bottom + Spacing.sm }, { transform: [{ translateY: bottomCurtainY }] }]}>
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
              <View style={[styles.timelineRail, { backgroundColor: colors.accentSubtle }]} />
              <Animated.View
                style={[
                  styles.timelineProgress,
                  {
                    width: sliderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, pageTimelineWidth],
                    }),
                    backgroundColor: colors.accent,
                  },
                ]}
              />
              <View pointerEvents="none" style={styles.timelineDots}>
                {Array.from({ length: pageTimelineDotCount }, (_, dotIndex) => {
                  const progress = pageTimelineDotCount > 1
                    ? dotIndex / (pageTimelineDotCount - 1)
                    : 0;
                  const activeDotLimit = activePageCount > 1
                    ? (timelinePreviewPage ?? currentPage) / (activePageCount - 1)
                    : 0;
                  const isActive = progress <= activeDotLimit;
                  return (
                    <View
                      key={dotIndex}
                      style={[
                        styles.timelineDot,
                        {
                          left: `${Math.min(100, progress * 100)}%`,
                          backgroundColor: isActive ? colors.accentForeground : colors.text,
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.timelineThumbGap,
                  {
                    left: sliderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, pageTimelineWidth],
                    }),
                    backgroundColor: colors.surfaceElevated,
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.timelineThumb,
                  {
                    left: sliderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, pageTimelineWidth],
                    }),
                    backgroundColor: colors.accent,
                    shadowColor: colors.background,
                  },
                ]}
              />
              {timelinePreviewPage !== null && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.timelinePreviewBubble,
                    {
                      left: sliderProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, pageTimelineWidth],
                      }),
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.timelinePreviewText, { color: colors.text }]}>
                    {timelinePreviewPage + 1}
                  </Text>
                </Animated.View>
              )}
              <View
                {...timelinePanResponder.panHandlers}
                style={StyleSheet.absoluteFill}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={`Page ${currentPage + 1} of ${activePageCount}`}
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mobileChapterViewMode === 'grid' ? 'Open page grid' : 'Open chapter list'}
              onPress={() => {
                setMobileMenuSection('chapters');
                setSideMenuVisible(true);
              }}
              style={({ pressed }) => [
                styles.chapterNavButton,
                pressed && { backgroundColor: colors.accentSubtle, opacity: 0.82 },
              ]}
            >
              <Ionicons
                name={mobileChapterViewMode === 'grid' ? 'grid-outline' : 'list-outline'}
                size={20}
                color={colors.text}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open reader settings"
              onPress={() => {
                setMobileMenuSection('settings');
                setSideMenuVisible(true);
              }}
              style={({ pressed }) => [
                styles.chapterNavButton,
                pressed && { backgroundColor: colors.accentSubtle, opacity: 0.82 },
              ]}
            >
              <Ionicons name="ellipsis-horizontal" size={21} color={colors.text} />
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}

      {/* Official MangaDex Reader Side Control Drawer */}
      <ReaderMenuDrawer
        visible={sideMenuVisible}
        onClose={() => setSideMenuVisible(false)}
        mobileSection={mobileMenuSection}
        mobileChapterViewMode={mobileChapterViewMode}
        onMobileChapterViewModeChange={setMobileChapterViewMode}
        mangaTitle={mangaTitle}
        chapterTitle={activeChapterTitle}
        scanlationGroup={activeScanlationGroup}
        uploaderName={activeUploaderName}
        currentChapterPublishAt={activeChapterPublishAt}
        currentPage={currentPage}
        totalPages={activePageCount}
        onSelectPage={goToPage}
        currentChapterId={activeChapterIdForPages || chapterId!}
        pageUrls={readingNextChapter ? nextChapterPages : pages}
        pageHeaders={readingNextChapter ? nextChapterPageHeaders : pageHeaders}
        chapters={effectiveChapterList.map((c) => ({
          id: c.id,
          chapterNum: c.attributes.chapter ?? '?',
          title: c.attributes.title ?? '',
          publishAt: c.attributes.publishAt || c.attributes.readableAt,
          scanlator: extractScanlationGroupName(c),
          uploader: extractUploaderUsername(c),
        }))}
        selectedScanlator={selectedScanlator}
        availableScanlators={availableScanlators}
        onSelectScanlator={(sc) => setSelectedScanlator(sc)}
        onSelectChapter={navigateToChapter}
        hasPrevChapter={hasPrevChapter}
        hasNextChapter={hasNextChapter}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
        readingMode={mode}
        onChangeReadingMode={handleSetReaderMode}
        imageFit={imageFit}
        onChangeImageFit={(fit) => setImageFit(fit)}
        headerHidden={headerHidden}
        onToggleHeaderHidden={() => setHeaderHidden(!headerHidden)}
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
      />

      {/* Web Persistent Floating Menu Window Trigger Button */}
      {Platform.OS === 'web' && !sideMenuVisible && (
        <Pressable
          onPress={() => setSideMenuVisible(true)}
          style={({ pressed }) => [
            styles.webFloatingMenuTrigger,
            { backgroundColor: colors.surface },
            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Ionicons name="options-outline" size={18} color={colors.text} />
          <Text style={[styles.webFloatingMenuTriggerText, { color: colors.text }]}>Menu</Text>
        </Pressable>
      )}
      {/* In-App Cloudflare WebView Verification Modal */}
      {renderCloudflareModal()}

      {/* Persistent Background Bridge for Authenticated Image Streaming */}
      {Platform.OS !== 'web' && persistentBridgeUrl && (
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
              } catch {}
            }}
          />
        </View>
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
    height: 48,
    marginHorizontal: 6,
    justifyContent: 'center',
    position: 'relative',
  },
  timelineRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 15,
    height: 18,
    borderRadius: Radius.full,
  },
  timelineProgress: {
    position: 'absolute',
    left: 0,
    top: 15,
    height: 18,
    borderRadius: Radius.full,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  timelineDots: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 0,
    bottom: 0,
    zIndex: 3,
  },
  timelineDot: {
    position: 'absolute',
    top: 22,
    width: 4,
    height: 4,
    marginLeft: -2,
    borderRadius: Radius.full,
  },
  timelineThumbGap: {
    position: 'absolute',
    top: 6,
    width: 11,
    height: 36,
    marginLeft: -5.5,
    borderRadius: Radius.full,
    zIndex: 2,
  },
  timelineThumb: {
    position: 'absolute',
    top: 1,
    width: 3,
    height: 46,
    marginLeft: -1.5,
    borderRadius: Radius.full,
    zIndex: 4,
  },
  timelinePreviewBubble: {
    position: 'absolute',
    bottom: 44,
    minWidth: 42,
    height: 30,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    transform: [{ translateX: -21 }],
    elevation: 5,
  },
  timelinePreviewText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.bold,
  },

  webFloatingMenuTrigger: {
    position: 'fixed' as any,
    bottom: 28,
    right: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
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
    borderRadius: Radius.xl,
    padding: Spacing.xl,
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
    lineHeight: 18,
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
  cfHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
  },
  cfHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cfFloatingBanner: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 52,
    left: 16,
    right: 16,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.lg,
  },
  cfFloatingBannerTitle: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  cfFloatingBannerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  cfFloatingBannerBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.md,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cfFloatingBannerBtnText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.bold,
  },
});
