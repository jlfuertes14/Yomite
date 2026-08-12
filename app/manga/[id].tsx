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
import { downloadChapter, removeDownloadedChapter } from '../../src/services/downloadService';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { OfflineState } from '../../src/components/OfflineState';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { LibraryCategoryModal } from '../../src/components/LibraryCategoryModal';
import { ChapterSkeleton } from '../../src/components/Skeleton';
import { triggerHaptic } from '../../src/utils/haptics';
import { formatChapterDate } from '../../src/utils/date';
import type { Manga, Chapter, LibraryCategory } from '../../src/types';

export default function MangaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();

  const [manga, setManga] = useState<Manga | null>(null);
  const [stats, setStats] = useState<MangaStatistics | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
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
  const downloadMap = useDownloadStore((s) => s.chapters);

  // Modals state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [selectedDownloadIds, setSelectedDownloadIds] = useState<Set<string>>(new Set());

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
    loadChapters();
  }, [id, sortOrder]);

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

  const loadChapters = async () => {
    try {
      setIsLoadingChapters(true);
      const result = await getMangaChapters(id!, 'en', 100, 0, sortOrder);
      setChapters(result.data);
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
        addToLibrary({
          mangaId: manga.id,
          title: getMangaTitle(manga),
          coverUrl: getCoverUrl(manga.id, coverFileName, '256'),
          category,
          lastReadChapterId: null,
          lastReadPage: 0,
          totalChapters: chapters.length,
          unreadCount: chapters.length,
        });
      }
    },
    [isInLibrary, updateCategory, id, manga, chapters.length, addToLibrary]
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
      const result = await getMangaChapters(id, 'en', 1, 0, 'asc');
      const firstChapter = result.data[0];

      if (firstChapter) {
        handleReadChapter(firstChapter.id, 0);
      }
    } catch (err) {
      console.error('Failed to load the first chapter:', err);
    } finally {
      setIsStartingReading(false);
    }
  }, [handleReadChapter, id, isStartingReading, lastProgress]);

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
    if (selectedDownloadIds.size === chapters.length) {
      setSelectedDownloadIds(new Set());
    } else {
      setSelectedDownloadIds(new Set(chapters.map((c) => c.id)));
    }
  };

  const handleStartBatchDownload = () => {
    if (selectedDownloadIds.size === 0 || !manga) return;
    const coverFileName = extractCoverFileName(manga);
    const coverUrl = getCoverUrl(manga.id, coverFileName, '512');
    const selectedList = chapters.filter((c) => selectedDownloadIds.has(c.id));
    setDownloadModalVisible(false);

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
          {/* Back button */}
          <SafeAreaView style={styles.backButtonContainer}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)' as any);
                }
              }}
              style={[styles.backButton, { backgroundColor: 'rgba(24,24,27,0.7)', borderColor: colors.border }]}
            >
              <Ionicons name="arrow-back" size={20} color="#FAFAFA" />
            </Pressable>
          </SafeAreaView>

          {/* Cover + Info overlay */}
          <View style={styles.heroContent}>
            <View style={[styles.coverContainer, { borderColor: colors.border }]}>
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
            </View>
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
              setSelectedDownloadIds(new Set(chapters.map((c) => c.id)));
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
                { backgroundColor: colors.accent, flex: 1.2 },
                isStartingReading && { opacity: 0.6 },
              ]}
            >
              {isStartingReading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="play" size={15} color="#FFFFFF" />
                  <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]} numberOfLines={1}>
                    {lastProgress
                      ? `Continue · Page ${lastProgress.pageIndex + 1} of ${lastProgress.totalPages}`
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
          <Text style={[styles.chapterHeaderTitle, { color: colors.text }]}>
            Chapters ({chapters.length})
          </Text>
          <Pressable
            onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={styles.sortButton}
          >
            <Ionicons
              name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={14}
              color={colors.accent}
            />
            <Text style={[styles.sortText, { color: colors.accent }]}>
              {sortOrder === 'asc' ? 'Oldest' : 'Newest'}
            </Text>
          </Pressable>
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
            const isDownloaded = dlItem?.status === 'completed';

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
              if (isDownloading) return;

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
                  },
                ]}
              >
                <View style={styles.chapterInfo}>
                  <Text style={[styles.chapterNumber, { color: colors.text }]}>
                    {chapterNum ? `Ch. ${chapterNum}` : 'Oneshot'}
                    {chapterTitle ? ` - ${chapterTitle}` : ''}
                  </Text>
                  <Text style={[styles.chapterMeta, { color: colors.textMuted }]}>
                    {getChapterCredit(chapter)} · {chapter.attributes.pages} pages · {formatChapterDate(chapter.attributes.publishAt || chapter.attributes.readableAt)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable
                    onPress={handleDownload}
                    hitSlop={8}
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : isDownloaded ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.emerald} />
                    ) : (
                      <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
                    )}
                  </Pressable>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </AnimatedCard>
            );
          })
        )}

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

      {/* Selective & Batch Chapter Download Modal */}
      <Modal
        visible={downloadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDownloadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Download Chapters</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  Select chapters to save for offline reading
                </Text>
              </View>

              <Pressable onPress={() => setDownloadModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Quick Actions Row */}
            <View style={[styles.modalQuickActions, { borderBottomColor: colors.border }]}>
              <Pressable onPress={handleSelectAllDownloads} style={styles.quickActionBtn}>
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
                        backgroundColor: isSelected ? 'rgba(244, 63, 94, 0.12)' : colors.surfaceElevated,
                        borderColor: isSelected ? colors.accent : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
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
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={handleStartBatchDownload}
                disabled={selectedDownloadIds.size === 0}
                style={({ pressed }) => [
                  styles.batchDownloadBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: selectedDownloadIds.size > 0 ? (pressed ? 0.8 : 1) : 0.4,
                  },
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroContainer: {
    position: 'relative',
    minHeight: 290,
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
    gap: Spacing.md,
  },
  coverContainer: {
    width: 100,
    height: 148,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  coverImage: {
    width: '100%',
    height: '100%',
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
    gap: 4,
  },
  mangaTitle: {
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  authorText: {
    fontSize: Typography.sizes.footnote,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    paddingHorizontal: 6,
  },
  actionButtonText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  tagChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  tagText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  synopsisContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  synopsisText: {
    fontSize: Typography.sizes.body,
    lineHeight: 20,
  },
  expandText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
    marginTop: 6,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.md,
  },
  chapterHeaderTitle: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapterInfo: {
    flex: 1,
    gap: 2,
  },
  chapterNumber: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
  },
  chapterMeta: {
    fontSize: Typography.sizes.caption,
  },

  /* Modal Styling */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '82%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    overflow: 'hidden',
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
});
