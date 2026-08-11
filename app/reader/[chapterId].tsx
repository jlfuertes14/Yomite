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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { chapterId, mangaId } = useLocalSearchParams<{
    chapterId: string;
    mangaId?: string;
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
  const [uploaderName, setUploaderName] = useState<string>('Uploader');

  const flatListRef = useRef<FlatList>(null);

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

  const loadPages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getChapterPages(chapterId!, dataSaver);
      setPages(result.pages);
      setCurrentPage(0);
    } catch (err) {
      console.error('Failed to load pages:', err);
      setError('Failed to load chapter pages. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMangaMeta = async () => {
    try {
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

  const handlePageTap = useCallback(
    (x: number) => {
      if (x > TAP_LEFT && x < TAP_RIGHT) {
        toggleControls();
        return;
      }

      if (hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (mode === 'rtl') {
        if (x <= TAP_LEFT) {
          goToPage(currentPage + 1);
        } else {
          goToPage(currentPage - 1);
        }
      } else {
        if (x <= TAP_LEFT) {
          goToPage(currentPage - 1);
        } else {
          goToPage(currentPage + 1);
        }
      }
    },
    [currentPage, mode, toggleControls, goToPage]
  );

  // Chapter Switching
  const currentChapterIdx = chapterList.findIndex((c) => c.id === chapterId);
  const hasNextChapter = currentChapterIdx > 0; // Descending list: index 0 is latest
  const hasPrevChapter = currentChapterIdx < chapterList.length - 1;

  const navigateToChapter = (targetChapterId: string) => {
    setSideMenuVisible(false);
    router.replace(`/reader/${targetChapterId}?mangaId=${mangaId}` as any);
  };

  const handlePrevChapter = () => {
    if (hasPrevChapter) {
      navigateToChapter(chapterList[currentChapterIdx + 1].id);
    }
  };

  const handleNextChapter = () => {
    if (hasNextChapter) {
      navigateToChapter(chapterList[currentChapterIdx - 1].id);
    }
  };

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

  if (error || pages.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: readerTheme.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#E11D48" />
        <Text style={[styles.errorText, { color: readerTheme.text }]}>
          {error || 'No pages found for this chapter.'}
        </Text>
        <Pressable style={styles.retryButton} onPress={loadPages}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable
          style={styles.backTextButton}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)' as any);
          }}
        >
          <Text style={[styles.backTextLabel, { color: colors.textMuted }]}>
            Go Back
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center' }}
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
          initialScrollIndex={currentPage}
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
        currentPage={currentPage}
        totalPages={pages.length}
        onSelectPage={goToPage}
        currentChapterId={chapterId!}
        chapters={chapterList.map((c) => ({
          id: c.id,
          chapterNum: c.attributes.chapter ?? '?',
          title: c.attributes.title ?? '',
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
  retryButton: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    backgroundColor: '#E11D48',
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: Typography.sizes.body,
  },
  backTextButton: {
    marginTop: Spacing.sm,
  },
  backTextLabel: {
    fontSize: Typography.sizes.body,
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
});
