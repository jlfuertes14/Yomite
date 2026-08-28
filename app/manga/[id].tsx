/**
 * Manga Detail Screen — Editorial Swiss Dark Theme
 */
import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { ChapterSkeleton } from '../../src/components/Skeleton';
import { ZoomableImage } from '../../src/components/ZoomableImage';
import { triggerHaptic } from '../../src/utils/haptics';
import { formatChapterDate } from '../../src/utils/date';
import { getLanguageInfo } from '../../src/utils/language';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
import type { Manga, Chapter, LibraryCategory } from '../../src/types';

export default function MangaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();

  const [manga, setManga] = useState<Manga | null>(null);
  useDocumentTitle(manga ? getMangaTitle(manga) : 'Manga Details');
  const [stats, setStats] = useState<MangaStatistics | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [isStartingReading, setIsStartingReading] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

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

  // Modals state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [selectedDownloadIds, setSelectedDownloadIds] = useState<Set<string>>(new Set());
  const [isCoverHovered, setIsCoverHovered] = useState(false);
  const [isCoverLightboxOpen, setIsCoverLightboxOpen] = useState(false);

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
      const [data, statistics] = await Promise.all([
        getMangaDetails(id!),
        getMangaStatistics(id!),
      ]);
      setManga(data);
      setStats(statistics);
    } catch (err: any) {
      console.error('Failed to load manga details:', err);
      setError('Unable to reach MangaDex. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadChapters = async (lang = selectedLanguage, order = sortOrder) => {
    try {
      setIsLoadingChapters(true);
      const result = await getMangaChapters(id!, lang, 100, 0, order);
      const chs = result.data || [];
      setChapters(chs);

      // Reconcile total chapters and unread count badge in library
      if (id && chs.length > 0) {
        const libStore = useLibraryStore.getState();
        if (libStore.isInLibrary(id)) {
          const progress = useHistoryStore.getState().getMangaProgress(id);
          let unread = chs.length;
          if (progress?.chapterId) {
            const idx = chs.findIndex((c) => c.id === progress.chapterId);
            if (idx >= 0) {
              unread = order === 'desc' ? idx : chs.length - 1 - idx;
            }
          }
          libStore.updateChapterCounts(id, chs.length, Math.max(0, unread));
        }
      }
    } catch (err: any) {
      console.error('Failed to load chapters:', err);
    } finally {
      setIsLoadingChapters(false);
    }
  };

  const handleSelectCategory = useCallback(
    (category: LibraryCategory) => {
      if (isInLibrary) {
        updateCategory(id!, category);
      } else if (manga) {
        const coverFileName = extractCoverFileName(manga);
        const progress = useHistoryStore.getState().getMangaProgress(id!);
        let unread = chapters.length;
        if (progress?.chapterId && chapters.length > 0) {
          const idx = chapters.findIndex((c) => c.id === progress.chapterId);
          if (idx >= 0) {
            unread = sortOrder === 'desc' ? idx : chapters.length - 1 - idx;
          }
        }

        addToLibrary({
          mangaId: manga.id,
          title: getMangaTitle(manga),
          coverUrl: getCoverUrl(manga.id, coverFileName, '256'),
          category,
          lastReadChapterId: progress?.chapterId || null,
          lastReadPage: progress?.pageIndex || 0,
          totalChapters: chapters.length,
          unreadCount: Math.max(0, unread),
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
      const pageParam = pageIndex !== undefined ? `&page=${pageIndex}` : '';
      router.push(`/reader/${chapterId}?mangaId=${id}${pageParam}` as any);
    },
    [router, id]
  );

  const handleStartReading = useCallback(async () => {
    if (!id || isStartingReading) return;

    if (lastProgress) {
      handleReadChapter(lastProgress.chapterId, lastProgress.pageIndex);
      return;
    }

    try {
      setIsStartingReading(true);
      const result = await getMangaChapters(id, selectedLanguage, 1, 0, 'asc');
      const firstChapter = result.data[0];

      if (firstChapter) {
        handleReadChapter(firstChapter.id, 0);
      }
    } catch (err) {
      console.error('Failed to load the first chapter:', err);
    } finally {
      setIsStartingReading(false);
    }
  }, [handleReadChapter, id, isStartingReading, lastProgress, selectedLanguage]);

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

  const handleSelectAllDownloads = () => {
    const unDownloadedChapters = chapters.filter((c) => downloadMap[c.id]?.status !== 'completed');
    if (selectedDownloadIds.size === unDownloadedChapters.length) {
      setSelectedDownloadIds(new Set());
    } else {
      setSelectedDownloadIds(new Set(unDownloadedChapters.map((c) => c.id)));
    }
  };

  const handleStartBatchDownload = () => {
    if (selectedDownloadIds.size === 0 || !manga) return;
    const coverFileName = extractCoverFileName(manga);
    const coverUrl = getCoverUrl(manga.id, coverFileName, '512');
    const selectedList = chapters.filter(
      (c) => selectedDownloadIds.has(c.id) && downloadMap[c.id]?.status !== 'completed'
    );
    setDownloadModalVisible(false);

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

    if (groupName && userName) return `${groupName} · ${userName}`;
    return groupName || userName || 'MangaDex';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
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
  const title = getMangaTitle(manga);
  const description = getMangaDescription(manga);
  const author = extractAuthorName(manga);
  const artist = extractArtistName(manga);
  const tags = manga.attributes.tags.slice(0, 8);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Header with Backdrop */}
        <View style={styles.heroContainer}>
          {coverUrl && (
            <Image
              source={{ uri: coverUrl }}
              style={styles.backdropImage}
              contentFit="cover"
              blurRadius={6}
            />
          )}
          <LinearGradient
            colors={['rgba(9,9,11,0.2)', 'rgba(9,9,11,0.7)', colors.background]}
            style={styles.backdropGradient}
          />
          {/* Back button on far upper left */}
          <SafeAreaView style={styles.backButtonContainer}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)' as any);
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={26} color="#FAFAFA" />
            </Pressable>
          </SafeAreaView>

          {/* Inner hero content centered with global web margins */}
          <View style={[{ width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>
            {/* Cover + Info overlay */}
            <View style={styles.heroContent}>
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
                  { borderColor: colors.border },
                  Platform.OS === 'web' && coverUrl && ({ cursor: 'pointer' } as any),
                  pressed && coverUrl && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                {coverUrl ? (
                  <Image
                    source={{ uri: coverUrl }}
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
                <Text style={[styles.mangaTitle, { color: colors.text }]} numberOfLines={3}>
                  {title}
                </Text>
                <Text style={[styles.authorText, { color: colors.textSecondary }]}>
                  {author}
                  {artist !== author ? ` · Art: ${artist}` : ''}
                </Text>
                <View style={styles.statusRow}>
                  {stats?.rating?.bayesian || stats?.rating?.average ? (
                    <View style={[styles.statusPill, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                      <Ionicons name="star" size={10} color="#F59E0B" />
                      <Text style={[styles.statusPillText, { color: '#F59E0B' }]}>
                        {(stats.rating.bayesian || stats.rating.average!).toFixed(2)}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => setCategoryModalVisible(true)}
                    style={({ pressed }) => [
                      styles.statusPill,
                      {
                        backgroundColor: isInLibrary ? 'rgba(244, 63, 94, 0.2)' : colors.surfaceElevated,
                        borderColor: isInLibrary ? colors.accent : colors.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isInLibrary ? 'bookmark' : 'bookmark-outline'}
                      size={11}
                      color={colors.accent}
                    />
                    <Text style={[styles.statusPillText, { color: isInLibrary ? colors.accent : colors.text }]}>
                      {isInLibrary ? getCategoryDisplayLabel(libraryEntry?.category) : 'Add to Library'}
                    </Text>
                  </Pressable>

                  <View style={[styles.statusPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <Text style={[styles.statusPillText, { color: colors.accent }]}>
                      {manga.attributes.status?.toLowerCase()}
                    </Text>
                  </View>
                  {manga.attributes.publicationDemographic && (
                    <View style={[styles.statusPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                      <Text style={[styles.statusPillText, { color: colors.textSecondary }]}>
                        {manga.attributes.publicationDemographic.toLowerCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Main Body Content centered with global web margins */}
        <View style={[{ width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          {/* Add to Library Button */}
          <AnimatedPressable
            onPress={() => setCategoryModalVisible(true)}
            style={[
              styles.actionButton,
              {
                backgroundColor: isInLibrary ? colors.surfaceElevated : colors.surface,
                borderColor: isInLibrary ? colors.accent : colors.border,
                borderWidth: 1,
                flex: 1,
              },
            ]}
          >
            <Ionicons
              name={isInLibrary ? 'bookmark' : 'bookmark-outline'}
              size={15}
              color={isInLibrary ? colors.accent : colors.text}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: isInLibrary ? colors.accent : colors.text },
              ]}
              numberOfLines={1}
            >
              {isInLibrary ? getCategoryDisplayLabel(libraryEntry?.category) : 'Library ▾'}
            </Text>
          </AnimatedPressable>

          {/* Download Chapters Modal Trigger Button */}
          <AnimatedPressable
            onPress={() => {
              const unDownloadedIds = chapters
                .filter((c) => downloadMap[c.id]?.status !== 'completed')
                .map((c) => c.id);
              setSelectedDownloadIds(new Set(unDownloadedIds));
              setDownloadModalVisible(true);
            }}
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderWidth: 1,
                flex: 1,
              },
            ]}
          >
            <Ionicons name="download-outline" size={15} color={colors.accent} />
            <Text style={[styles.actionButtonText, { color: colors.text }]} numberOfLines={1}>
              Download
            </Text>
          </AnimatedPressable>

          {/* Start Reading Button */}
          {chapters.length > 0 && (
            <AnimatedPressable
              onPress={handleStartReading}
              disabled={isStartingReading}
              style={[
                styles.actionButton,
                { backgroundColor: colors.accent, flex: 1.4 },
                isStartingReading && { opacity: 0.6 },
              ]}
            >
              {isStartingReading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="play" size={14} color="#FFFFFF" />
                  <Text
                    style={[styles.actionButtonText, { color: '#FFFFFF', flexShrink: 1 }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {lastProgress
                      ? `Continue (p. ${lastProgress.pageIndex + 1}/${lastProgress.totalPages})`
                      : 'Start Reading'}
                  </Text>
                </>
              )}
            </AnimatedPressable>
          )}
        </View>

        {/* Tags */}
        <View style={styles.tagsRow}>
          {tags.map((tag) => (
            <View
              key={tag.id}
              style={[styles.tagChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                {tag.attributes.name.en ?? Object.values(tag.attributes.name)[0]}
              </Text>
            </View>
          ))}
        </View>

        {/* Synopsis */}
        {description ? (
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
        ) : null}

        {/* Chapter List Header */}
        <View style={styles.chapterHeader}>
          <View style={styles.chapterHeaderLeft}>
            <Text style={[styles.chapterHeaderTitle, { color: colors.text }]}>
              Chapters ({chapters.length})
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
                      borderColor: isLanguageDropdownOpen ? colors.accent : colors.border,
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
                          borderColor: colors.border,
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

            {/* Sort Button */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              }}
              style={[
                styles.sortButton,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
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
        ) : (
          chapters.map((chapter, idx) => {
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
                    borderBottomColor: colors.borderSubtle,
                    opacity: isRead ? 0.52 : 1,
                    backgroundColor: isCurrentReading
                      ? colors.accent + '14'
                      : isRead
                      ? (Platform.OS === 'web' ? 'rgba(255,255,255,0.015)' : 'transparent')
                      : 'transparent',
                  },
                ]}
              >
                <View style={styles.chapterInfo}>
                  <View style={styles.chapterTitleRow}>
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
                      <View style={[styles.readingBadge, { backgroundColor: colors.accent + '22', borderColor: colors.accent }]}>
                        <Ionicons name="book" size={11} color={colors.accent} />
                        <Text style={[styles.readingBadgeText, { color: colors.accent }]}>
                          Reading · p. {(lastProgress?.pageIndex || 0) + 1}/{lastProgress?.totalPages || chapter.attributes.pages || 1}
                        </Text>
                      </View>
                    ) : isRead ? (
                      <View style={[styles.readBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
                        <Ionicons name="checkmark-done" size={11} color={colors.emerald} />
                        <Text style={[styles.readBadgeText, { color: colors.emerald }]}>Read</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={[styles.chapterMeta, { color: isRead ? colors.textMuted : colors.textSecondary }]}>
                    {getChapterCredit(chapter)} · {chapter.attributes.pages} pages · {formatChapterDate(chapter.attributes.publishAt || chapter.attributes.readableAt)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
              </AnimatedCard>
            );
          })
        )}

        </View>

        <View style={{ height: 60 }} />
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

      {/* Native Mobile Chapter Language Selection Modal */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={isLanguageDropdownOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsLanguageDropdownOpen(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setIsLanguageDropdownOpen(false)}
          >
            <Pressable
              style={[
                styles.modalContent,
                { backgroundColor: colors.surface, borderTopColor: colors.border },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderSubtle }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Chapter Language</Text>
                  <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                    Select translation language ({availableLanguages.length} available)
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsLanguageDropdownOpen(false)}
                  style={styles.closeBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
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
                        setIsLanguageDropdownOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.mobileLanguageRow,
                        {
                          backgroundColor: isSelected
                            ? colors.accent + '20'
                            : pressed
                            ? colors.surfaceElevated
                            : 'transparent',
                          borderColor: isSelected ? colors.accent : colors.borderSubtle,
                        },
                      ]}
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
                              color: isSelected ? colors.accent : colors.text,
                              fontWeight: isSelected ? 'bold' : '500',
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
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Selective & Batch Chapter Download Modal */}
      <Modal
        visible={downloadModalVisible}
        transparent
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        onRequestClose={() => setDownloadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={() => setDownloadModalVisible(false)}
          />
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Download Chapters</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  Select chapters to save for offline reading
                </Text>
              </View>

              <Pressable
                onPress={() => setDownloadModalVisible(false)}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.7 },
                  Platform.OS === 'web' && { cursor: 'pointer' },
                ]}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Quick Actions Row */}
            <View style={[styles.modalQuickActions, { borderBottomColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable
                onPress={handleSelectAllDownloads}
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  pressed && { opacity: 0.75 },
                  Platform.OS === 'web' && { cursor: 'pointer' },
                ]}
              >
                <Ionicons
                  name={selectedDownloadIds.size === chapters.length ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={colors.accent}
                />
                <Text style={[styles.quickActionText, { color: colors.text }]}>
                  {selectedDownloadIds.size === chapters.length ? 'Deselect All' : 'Select All'}
                </Text>
              </Pressable>

              <Text style={[styles.selectedCountText, { color: colors.textMuted }]}>
                {selectedDownloadIds.size} of {chapters.length} selected
              </Text>
            </View>

            {/* Chapters Selection List */}
            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.downloadListContent}
              renderItem={({ item }) => {
                const isSelected = selectedDownloadIds.has(item.id);
                const dlItem = downloadMap[item.id];
                const isDownloaded = dlItem?.status === 'completed';
                const isDownloading = dlItem?.status === 'downloading';

                return (
                  <Pressable
                    onPress={() => handleToggleSelectDownload(item.id)}
                    style={({ pressed }) => [
                      styles.downloadRow,
                      {
                        backgroundColor: isSelected ? `${colors.accent}15` : colors.surfaceElevated,
                        borderColor: isSelected ? colors.accent : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                      Platform.OS === 'web' && { cursor: 'pointer' },
                    ]}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isSelected ? colors.accent : colors.textMuted}
                    />

                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.downloadRowTitle, { color: colors.text }]}>
                        {item.attributes.chapter ? `Ch. ${item.attributes.chapter}` : 'Oneshot'}
                        {item.attributes.title ? ` - ${item.attributes.title}` : ''}
                      </Text>
                      <Text style={[styles.downloadRowSub, { color: colors.textMuted }]}>
                        {item.attributes.pages} pages
                      </Text>
                    </View>

                    {isDownloaded ? (
                      <View style={[styles.downloadedBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                        <Ionicons name="checkmark-done" size={14} color={colors.emerald} />
                        <Text style={[styles.downloadedBadgeText, { color: colors.emerald }]}>Downloaded</Text>
                      </View>
                    ) : isDownloading ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
            />

            {/* Bottom Download Trigger CTA */}
            <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
              <Pressable
                onPress={handleStartBatchDownload}
                disabled={selectedDownloadIds.size === 0}
                style={({ pressed }) => [
                  styles.batchDownloadBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: selectedDownloadIds.size > 0 ? (pressed ? 0.8 : 1) : 0.4,
                  },
                  Platform.OS === 'web' && selectedDownloadIds.size > 0 && { cursor: 'pointer' },
                ]}
              >
                <Ionicons name="download" size={18} color="#FFFFFF" />
                <Text style={styles.batchDownloadBtnText}>
                  Download {selectedDownloadIds.size > 0 ? `(${selectedDownloadIds.size} Chapters)` : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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
              source={{ uri: coverUrl }}
              style={styles.lightboxImage}
              contentFit="contain"
              onTap={() => setIsCoverLightboxOpen(false)}
            />
          )}
        </Pressable>
      </Modal>
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
    minHeight: Platform.OS === 'web' ? 380 : 290,
    justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
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
  backButtonContainer: {
    position: 'absolute',
    top: 0,
    left: Spacing.md,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Platform.OS === 'web' ? Spacing.lg : Spacing.md,
  },
  coverContainer: {
    width: Platform.OS === 'web' ? 180 : 100,
    height: Platform.OS === 'web' ? 260 : 148,
    borderRadius: Platform.OS === 'web' ? Radius.lg : Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
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
    justifyContent: 'flex-end',
    gap: Platform.OS === 'web' ? 8 : 4,
  },
  mangaTitle: {
    fontSize: Platform.OS === 'web' ? 32 : Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
    lineHeight: Platform.OS === 'web' ? 38 : 22,
    letterSpacing: -0.3,
  },
  authorText: {
    fontSize: Platform.OS === 'web' ? 16 : Typography.sizes.footnote,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  statusPill: {
    paddingHorizontal: Platform.OS === 'web' ? 10 : 7,
    paddingVertical: Platform.OS === 'web' ? 5 : 3,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Platform.OS === 'web' ? Spacing.md : Spacing.sm,
    marginTop: Platform.OS === 'web' ? Spacing.xl : Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Platform.OS === 'web' ? 14 : Spacing.md,
    paddingHorizontal: Platform.OS === 'web' ? 24 : 6,
    borderRadius: Radius.md,
  },
  actionButtonText: {
    fontSize: Platform.OS === 'web' ? 15 : Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    marginTop: Platform.OS === 'web' ? Spacing.xl : Spacing.lg,
    gap: Platform.OS === 'web' ? Spacing.sm : Spacing.xs,
  },
  tagChip: {
    paddingHorizontal: Platform.OS === 'web' ? 12 : Spacing.sm,
    paddingVertical: Platform.OS === 'web' ? 6 : 4,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  tagText: {
    fontSize: Platform.OS === 'web' ? 13 : Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  synopsisContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Platform.OS === 'web' ? Spacing.xl : Spacing.lg,
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
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginTop: Platform.OS === 'web' ? Spacing['2xl'] + 8 : Spacing['2xl'],
    marginBottom: Spacing.md,
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
    borderWidth: 1,
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
  languageDropdownMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 220,
    borderRadius: Radius.lg,
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
  },
  sortText: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? Spacing.md + 4 : Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  chapterInfo: {
    flex: 1,
    gap: 4,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderTopWidth: 1,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  modalQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickActionText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  selectedCountText: {
    fontSize: Typography.sizes.footnote,
  },
  downloadListContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  downloadRowTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  downloadRowSub: {
    fontSize: Typography.sizes.caption,
  },
  downloadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  downloadedBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  modalFooter: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  batchDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    gap: 8,
  },
  batchDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.body,
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
