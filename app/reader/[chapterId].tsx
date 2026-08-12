/**
 * Reader Engine Screen — Multi-Mode Reader (Webtoon, RTL, LTR, Single, Double)
 * Includes MangaDex Official Reader Side Menu Drawer (ReaderMenuDrawer)
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
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
import { useDownloadStore } from '../../src/store/downloadStore';
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
import { ReaderThemes } from '../../constants/Colors';
import { ReaderMenuDrawer } from '../../src/components/ReaderMenuDrawer';
import { OfflineState } from '../../src/components/OfflineState';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import type { ReadingMode, Chapter } from '../../src/types';

const MODE_LABELS: Record<ReadingMode, string> = {
  webtoon: 'Long Strip (Webtoon)',
  rtl: 'Right to Left (Manga)',
  ltr: 'Left to Right (Comic)',
  single: 'Single Page',
  double: 'Double Page',
};

interface WebtoonPageItemProps {
  url: string;
  index: number;
  webtoonWidth: number;
  windowHeight: number;
  imageFit: 'fit_both' | 'fit_width' | 'fit_height';
  onTap: (x: number) => void;
}

const WebtoonPageItem = React.memo(function WebtoonPageItem({
  url,
  index,
  webtoonWidth,
  windowHeight,
  imageFit,
  onTap,
}: WebtoonPageItemProps) {
  const [aspectRatio, setAspectRatio] = useState<number>(1.5);

  const displayHeight =
    imageFit === 'fit_height' ? windowHeight : webtoonWidth * aspectRatio;
  const displayFit = imageFit === 'fit_height' ? 'contain' : 'fill';

  return (
    <Pressable
      onPress={(e) => onTap(e.nativeEvent.locationX)}
      style={{ width: webtoonWidth, alignItems: 'center' }}
    >
      <Image
        source={{ uri: url }}
        style={{
          width: webtoonWidth,
          height: displayHeight,
        }}
        contentFit={displayFit}
        recyclingKey={url}
        onLoad={(e) => {
          if (e.source?.width && e.source?.height) {
            const r = e.source.height / e.source.width;
            setAspectRatio((prev) => (prev === r ? prev : r));
          }
        }}
        transition={100}
      />
    </Pressable>
  );
});

export default function ReaderScreen() {
  const router = useRouter();
  const colors = Colors.dark;
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
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [imageFit, setImageFit] = useState<'fit_both' | 'fit_width' | 'fit_height'>('fit_both');
  const [headerHidden, setHeaderHidden] = useState(false);

  // Metadata state for MangaDex side menu
  const [mangaTitle, setMangaTitle] = useState('Manga');
  const [chapterTitle, setChapterTitle] = useState(`Chapter`);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [scanlationGroup, setScanlationGroup] = useState<string>('Scanlation Team');
  const [currentChapterPublishAt, setCurrentChapterPublishAt] = useState<string | undefined>();
  const [uploaderName, setUploaderName] = useState<string>('Uploader');

  const flatListRef = useRef<FlatList>(null);
  const webtoonListRef = useRef<FlatList<string>>(null);
  const restoredChapterIdRef = useRef<string | null>(null);
  const resumeTargetPageRef = useRef(0);
  const resumeRestoreAttemptsRef = useRef(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      const firstVisible = viewableItems[0].index;
      if (firstVisible !== null && firstVisible !== undefined) {
        setCurrentPage(firstVisible);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 30,
  }).current;
  const readerTheme = ReaderThemes[theme];

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
      webtoonListRef.current?.scrollToIndex({
        index: resumeTargetPageRef.current,
        animated: false,
      });
      restoredChapterIdRef.current = chapterId;
    });

    return () => cancelAnimationFrame(frame);
  }, [chapterId, isLoading, mode, pages.length]);

  const loadPages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setOfflineUnavailable(false);
      restoredChapterIdRef.current = null;
      resumeTargetPageRef.current = 0;
      resumeRestoreAttemptsRef.current = 0;

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

        const result = await getChapterPages(chapterId!, dataSaver);
        loadedPages = result.pages;
      }

      setPages(loadedPages);

      let targetPage = 0;
      if (page !== undefined && page !== null && page !== '') {
        targetPage = parseInt(page, 10);
      } else {
        const historyEntry = useHistoryStore.getState().entries.find((e) => e.chapterId === chapterId);
        if (historyEntry) {
          targetPage = historyEntry.pageIndex;
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
      let targetMangaId = mangaId;
      const chapterData = await getChapterDetails(chapterId!);
      if (chapterData) {
        setScanlationGroup(extractScanlationGroupName(chapterData));
        setUploaderName(extractUploaderUsername(chapterData));

        const mangaRel = chapterData.relationships?.find((r) => r.type === 'manga');
        if (mangaRel?.id && !targetMangaId) {
          targetMangaId = mangaRel.id;
        }
      }

      if (targetMangaId) {
        const [manga, chList] = await Promise.all([
          getMangaDetails(targetMangaId),
          getMangaChapters(targetMangaId, 'en', 500, 0, 'desc'),
        ]);

        const title = getMangaTitle(manga);
        setMangaTitle(title);
        setChapterList(chList.data);

        const coverFile = extractCoverFileName(manga);
        const url = getCoverUrl(manga.id, coverFile, '256');
        setCoverUrl(url);

        const activeCh = chList.data.find((c) => c.id === chapterId);
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

  // Save progress to history
  useEffect(() => {
    if (pages.length > 0 && chapterId) {
      addHistoryEntry({
        mangaId: mangaId ?? chapterId!,
        chapterId: chapterId!,
        title: mangaTitle,
        chapterTitle: chapterTitle,
        coverUrl: coverUrl,
        pageIndex: currentPage,
        totalPages: pages.length,
      });
    }
  }, [currentPage, pages.length, mangaTitle, chapterTitle, coverUrl]);

  // Chapter Switching
  const currentChapterIdx = chapterList.findIndex((c) => c.id === chapterId);

  const nextChapterId = currentChapterIdx > 0
    ? chapterList[currentChapterIdx - 1]?.id
    : (currentChapterIdx === -1 && chapterList.length > 0 ? chapterList[0]?.id : undefined);

  const prevChapterId = (currentChapterIdx >= 0 && currentChapterIdx < chapterList.length - 1)
    ? chapterList[currentChapterIdx + 1]?.id
    : undefined;

  const hasNextChapter = !!nextChapterId;
  const hasPrevChapter = !!prevChapterId;

  const navigateToChapter = useCallback(
    (targetChapterId: string) => {
      setSideMenuVisible(false);
      router.replace(`/reader/${targetChapterId}?mangaId=${mangaId}` as any);
    },
    [mangaId, router]
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
    (page: number) => {
      const clamped = Math.max(0, Math.min(page, pages.length - 1));
      setCurrentPage(clamped);
      if (mode !== 'webtoon') {
        flatListRef.current?.scrollToIndex({ index: clamped, animated: false });
      }
    },
    [pages.length, mode]
  );

  const goToNextPageOrChapter = useCallback(() => {
    if (currentPage < pages.length - 1) {
      goToPage(currentPage + 1);
    } else if (hasNextChapter) {
      if (hapticsEnabled && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      handleNextChapter();
    }
  }, [currentPage, pages.length, goToPage, hasNextChapter, handleNextChapter, hapticsEnabled]);

  const goToPrevPageOrChapter = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    } else if (hasPrevChapter) {
      if (hapticsEnabled && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      handlePrevChapter();
    }
  }, [currentPage, goToPage, hasPrevChapter, handlePrevChapter, hapticsEnabled]);

  const handlePageTap = useCallback(
    (x: number) => {
      if (x > TAP_LEFT && x < TAP_RIGHT) {
        toggleControls();
        return;
      }

      if (hapticsEnabled && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (mode === 'rtl') {
        if (x <= TAP_LEFT) {
          goToNextPageOrChapter();
        } else {
          goToPrevPageOrChapter();
        }
      } else {
        if (x <= TAP_LEFT) {
          goToPrevPageOrChapter();
        } else {
          goToNextPageOrChapter();
        }
      }
    },
    [mode, toggleControls, goToNextPageOrChapter, goToPrevPageOrChapter, hapticsEnabled]
  );

  // ─── Render Page Items ─────────────────────────────────────────

  const renderSinglePage = (url: string, index: number) => {
    let fitMode: 'contain' | 'cover' | 'fill' = 'contain';
    if (imageFit === 'fit_width') fitMode = 'cover';
    else if (imageFit === 'fit_height') fitMode = 'contain';
    else fitMode = 'contain';

    return (
      <Pressable
        key={index}
        style={[styles.pagedPageContainer, { width: windowWidth, height: windowHeight }]}
        onPress={(e) => handlePageTap(e.nativeEvent.locationX)}
      >
        <Image
          source={{ uri: url }}
          style={[styles.pagedImage, { width: windowWidth, height: windowHeight }]}
          contentFit={fitMode}
          transition={150}
        />
      </Pressable>
    );
  };

  const renderDoubleSpread = (pageIndex: number) => {
    const leftUrl = pages[pageIndex];
    const rightUrl = pages[pageIndex + 1];

    return (
      <Pressable
        key={pageIndex}
        style={[styles.doubleSpreadContainer, { width: windowWidth, height: windowHeight }]}
        onPress={(e) => handlePageTap(e.nativeEvent.locationX)}
      >
        <Image
          source={{ uri: mode === 'rtl' ? rightUrl || leftUrl : leftUrl }}
          style={[styles.doubleImage, { width: windowWidth / 2, height: windowHeight }]}
          contentFit="contain"
        />
        {rightUrl && (
          <Image
            source={{ uri: mode === 'rtl' ? leftUrl : rightUrl }}
            style={[styles.doubleImage, { width: windowWidth / 2, height: windowHeight }]}
            contentFit="contain"
          />
        )}
      </Pressable>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: readerTheme.background }]}>
        <ActivityIndicator size="large" color="#E11D48" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading chapter pages...
        </Text>
      </View>
    );
  }

  if (offlineUnavailable) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: readerTheme.background }]}>
        <OfflineState onRetry={loadPages} />
      </View>
    );
  }

  if (error || pages.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: readerTheme.background }]}>
        <Ionicons name="alert-circle-outline" size={52} color="#E11D48" />
        <Text style={[styles.errorText, { color: readerTheme.text }]}>
          {error || 'No pages found for this chapter.'}
        </Text>

        {/* Navigation & Action Controls for Broken / Missing Chapter */}
        <View style={styles.errorActionRow}>
          {hasPrevChapter && (
            <Pressable
              style={({ pressed }) => [
                styles.errorNavBtn,
                { opacity: pressed ? 0.7 : 1, borderColor: colors.border },
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
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={loadPages}
          >
            <Ionicons name="refresh" size={16} color="#FFF" />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>

          {hasNextChapter && (
            <Pressable
              style={({ pressed }) => [
                styles.errorNextBtn,
                { opacity: pressed ? 0.8 : 1, backgroundColor: colors.accent },
              ]}
              onPress={handleNextChapter}
            >
              <Text style={styles.errorNextBtnText}>Next Ch.</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
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

  return (
    <View style={[styles.readerContainer, { backgroundColor: readerTheme.background }]}>
      <StatusBar hidden={headerHidden || !controlsVisible} />

      {/* Reader Layout Mode */}
      {mode === 'webtoon' ? (
        <FlatList
          key="flatlist-webtoon"
          ref={webtoonListRef}
          data={pages}
          keyExtractor={(item, index) => `webtoon-${item}-${index}`}
          renderItem={({ item, index }) => (
            <WebtoonPageItem
              url={item}
              index={index}
              webtoonWidth={webtoonWidth}
              windowHeight={windowHeight}
              imageFit={imageFit}
              onTap={handlePageTap}
            />
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={50}
          initialNumToRender={2}
          windowSize={5}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            if (resumeRestoreAttemptsRef.current >= 3) return;
            resumeRestoreAttemptsRef.current += 1;

            // Page heights are image-dependent. Use RN's measured average first,
            // then retry once the target page enters the render window.
            webtoonListRef.current?.scrollToOffset({
              offset: averageItemLength * index,
              animated: false,
            });
            setTimeout(() => {
              webtoonListRef.current?.scrollToIndex({ index, animated: false });
            }, 100);
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center' }}
          ListFooterComponent={
            pages.length > 0 ? (
              <View style={styles.endOfChapterCard}>
                <Ionicons name="checkmark-circle" size={36} color={Colors.dark.accent} />
                <Text style={styles.endOfChapterTitle}>Finished {chapterTitle}</Text>
                {hasNextChapter ? (
                  <Pressable
                    onPress={handleNextChapter}
                    style={({ pressed }) => [
                      styles.nextChapterBtn,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={styles.nextChapterBtnText}>
                      Continue to Next Chapter ({chapterList[currentChapterIdx - 1]?.attributes?.chapter ? `Ch. ${chapterList[currentChapterIdx - 1].attributes.chapter}` : 'Next'})
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </Pressable>
                ) : (
                  <Text style={styles.lastChapterSubtext}>You've reached the latest available chapter!</Text>
                )}
              </View>
            ) : null
          }
        />
      ) : mode === 'double' ? (
        <FlatList
          key="flatlist-double"
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
          key="flatlist-single"
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
      {showPageNumber && pages.length > 0 && (
        <View style={styles.pageIndicator}>
          <Text style={styles.pageIndicatorText}>
            {currentPage + 1} / {pages.length}
          </Text>
        </View>
      )}

      {/* Controls Overlay */}
      {controlsVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Top Bar */}
          <View style={styles.topBar}>
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
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </Pressable>

            <View style={styles.topTitleCol}>
              <Text style={styles.topBarTitle} numberOfLines={1}>
                {chapterTitle}
              </Text>
              <Text style={styles.topBarSubTitle} numberOfLines={1}>
                Page {currentPage + 1} of {pages.length}
              </Text>
            </View>

            <Pressable
              onPress={() => setSideMenuVisible(true)}
              style={styles.controlButton}
            >
              <Ionicons name="options" size={22} color="#FFF" />
            </Pressable>
          </View>

          {/* Mode Selector Quick Bar */}
          {showModeSelector && (
            <View style={styles.modeSelectorContainer}>
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
                    mode === m && { backgroundColor: 'rgba(255,255,255,0.1)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.modeOptionText,
                      { color: mode === m ? '#FAFAFA' : '#A1A1AA' },
                    ]}
                  >
                    {MODE_LABELS[m]}
                  </Text>
                  {mode === m && (
                    <Ionicons name="checkmark" size={18} color="#FAFAFA" />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Bottom Slider Bar */}
          <View style={styles.bottomBar}>
            <Text style={styles.sliderLabel}>1</Text>
            <View style={styles.sliderTrack}>
              <View
                style={[
                  styles.sliderFill,
                  {
                    width: `${((currentPage + 1) / pages.length) * 100}%`,
                  },
                ]}
              />
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={(e) => {
                  const ratio = e.nativeEvent.locationX / (windowWidth - 80);
                  const targetPage = Math.round(ratio * (pages.length - 1));
                  goToPage(targetPage);
                }}
              />
            </View>
            <Text style={styles.sliderLabel}>{pages.length}</Text>
          </View>
        </View>
      )}

      {/* Official MangaDex Reader Side Control Drawer */}
      <ReaderMenuDrawer
        visible={sideMenuVisible}
        onClose={() => setSideMenuVisible(false)}
        mangaTitle={mangaTitle}
        chapterTitle={chapterTitle}
        scanlationGroup={scanlationGroup}
        uploaderName={uploaderName}
        currentChapterPublishAt={currentChapterPublishAt}
        currentPage={currentPage}
        totalPages={pages.length}
        onSelectPage={goToPage}
        currentChapterId={chapterId!}
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
    backgroundColor: '#18181B',
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
    color: '#FFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: '#E11D48',
    borderRadius: Radius.md,
  },
  retryText: {
    color: '#FFF',
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
  webtoonImage: {},

  // Controls Overlay
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 45,
    paddingBottom: Spacing.sm,
    backgroundColor: 'rgba(9,9,11,0.92)',
  },
  topTitleCol: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  topBarTitle: {
    color: '#FAFAFA',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  topBarSubTitle: {
    color: '#A1A1AA',
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
    backgroundColor: '#18181B',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#27272A',
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  pageIndicatorText: {
    color: '#FAFAFA',
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(9,9,11,0.92)',
    gap: Spacing.md,
  },
  sliderLabel: {
    color: '#FAFAFA',
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.bold,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#27272A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#E11D48',
  },

  /* End of Chapter Card */
  endOfChapterCard: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#141417',
    borderRadius: Radius.lg,
    marginHorizontal: 16,
    marginVertical: 32,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  endOfChapterTitle: {
    color: '#FAFAFA',
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },
  nextChapterBtn: {
    backgroundColor: Colors.dark.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.md,
    gap: 8,
    marginTop: 8,
  },
  nextChapterBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  lastChapterSubtext: {
    color: '#A1A1AA',
    fontSize: Typography.sizes.footnote,
    textAlign: 'center',
  },
});
