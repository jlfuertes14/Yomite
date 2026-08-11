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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
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
import { ChapterSkeleton } from '../../src/components/Skeleton';
import type { Manga, Chapter } from '../../src/types';

const HEADER_HEIGHT = 360;

export default function MangaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = Colors.dark;

  const [manga, setManga] = useState<Manga | null>(null);
  const [stats, setStats] = useState<MangaStatistics | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [isStartingReading, setIsStartingReading] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  const isInLibrary = useLibraryStore((s) => s.isInLibrary(id!));
  const addToLibrary = useLibraryStore((s) => s.addToLibrary);
  const removeFromLibrary = useLibraryStore((s) => s.removeFromLibrary);

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
    } catch (err) {
      console.error('Failed to load chapters:', err);
    } finally {
      setIsLoadingChapters(false);
    }
  };

  const handleToggleLibrary = useCallback(() => {
    if (!manga) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (isInLibrary) {
      removeFromLibrary(manga.id);
    } else {
      const coverFileName = extractCoverFileName(manga);
      addToLibrary({
        mangaId: manga.id,
        title: getMangaTitle(manga),
        coverUrl: getCoverUrl(manga.id, coverFileName, '256'),
        category: 'reading',
        lastReadChapterId: null,
        lastReadPage: 0,
        totalChapters: chapters.length,
        unreadCount: chapters.length,
      });
    }
  }, [manga, isInLibrary, chapters]);

  const handleReadChapter = useCallback(
    (chapterId: string) => {
      router.push(`/reader/${chapterId}?mangaId=${id}` as any);
    },
    [router, id]
  );

  const handleStartReading = useCallback(async () => {
    if (!id || isStartingReading) return;

    try {
      setIsStartingReading(true);
      const result = await getMangaChapters(id, 'en', 1, 0, 'asc');
      const firstChapter = result.data[0];

      if (firstChapter) {
        handleReadChapter(firstChapter.id);
      }
    } catch (err) {
      console.error('Failed to load the first chapter:', err);
    } finally {
      setIsStartingReading(false);
    }
  }, [handleReadChapter, id, isStartingReading]);

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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.accent} />
        <Text style={{ color: colors.text, fontSize: Typography.sizes.headline, fontWeight: Typography.weights.bold, marginTop: 12, textAlign: 'center' }}>
          Network Connection Error
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: Typography.sizes.body, textAlign: 'center', marginTop: 6, marginBottom: 20 }}>
          {error || 'Failed to connect to MangaDex servers.'}
        </Text>
        <Pressable
          onPress={() => {
            loadMangaDetails();
            loadChapters();
          }}
          style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.md }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: Typography.weights.bold }}>Retry Connection</Text>
        </Pressable>
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
              blurRadius={4}
            />
          )}
          <LinearGradient
            colors={['rgba(9,9,11,0.15)', 'rgba(9,9,11,0.55)', colors.background]}
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
                  onPress={handleToggleLibrary}
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
                    {stats?.follows
                      ? (stats.follows + (isInLibrary ? 1 : 0) >= 1000
                          ? `${((stats.follows + (isInLibrary ? 1 : 0)) / 1000).toFixed(1)}k`
                          : stats.follows + (isInLibrary ? 1 : 0))
                      : isInLibrary
                      ? 'Saved'
                      : 'Bookmark'}
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

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleToggleLibrary}
            style={[
              styles.actionButton,
              {
                backgroundColor: isInLibrary ? colors.surfaceElevated : colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                flex: 1,
              },
            ]}
          >
            <Ionicons
              name={isInLibrary ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={isInLibrary ? colors.accent : colors.text}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: isInLibrary ? colors.accent : colors.text },
              ]}
            >
              {isInLibrary ? 'In Library' : 'Add to Library'}
            </Text>
          </Pressable>

          {chapters.length > 0 && (
            <Pressable
              onPress={handleStartReading}
              disabled={isStartingReading}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: colors.accent,
                  flex: 1,
                  opacity: pressed || isStartingReading ? 0.75 : 1,
                },
              ]}
            >
              {isStartingReading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="play" size={16} color="#FFF" />
              )}
              <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
                {isStartingReading ? 'Opening...' : 'Start Reading'}
              </Text>
            </Pressable>
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
          chapters.map((chapter) => {
            const chapterNum = chapter.attributes.chapter;
            const chapterTitle = chapter.attributes.title;
            return (
              <Pressable
                key={chapter.id}
                onPress={() => handleReadChapter(chapter.id)}
                style={({ pressed }) => [
                  styles.chapterRow,
                  {
                    backgroundColor: pressed ? colors.surfaceElevated : 'transparent',
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
                    {getChapterCredit(chapter)} · {chapter.attributes.pages} pages
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            );
          })
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroContainer: {
    height: HEADER_HEIGHT,
    position: 'relative',
  },
  backdropImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.55,
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
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  coverContainer: {
    width: 110,
    height: 162,
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
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  authorText: {
    fontSize: Typography.sizes.footnote,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  actionButtonText: {
    fontSize: Typography.sizes.body,
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
});
