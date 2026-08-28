/**
 * Library Screen — Modern Minimalist Edge-to-Edge Bookshelf
 * Fixed responsive chip container height & grid layout for mobile & web.
 * Includes dynamic unread badge reconciliation & pull-to-refresh.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { useLibraryStore } from '../../src/store/libraryStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { getMangaChapters } from '../../src/api/mangadex';
import { MangaCard, CARD_GAP } from '../../src/components/MangaCard';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
import type { LibraryCategory } from '../../src/types';

type VectorIcon = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORIES: { key: LibraryCategory; label: string; icon: VectorIcon }[] = [
  { key: 'reading', label: 'Reading', icon: 'book-outline' },
  { key: 'plan_to_read', label: 'Plan to read', icon: 'bookmark-outline' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-done-outline' },
  { key: 'favorites', label: 'Favorites', icon: 'star-outline' },
  { key: 'dropped', label: 'Dropped', icon: 'trash-outline' },
];

export default function LibraryScreen() {
  useDocumentTitle('Library');
  const router = useRouter();
  const colors = useThemeColors();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('reading');
  const [refreshing, setRefreshing] = useState(false);
  const entries = useLibraryStore((s) => s.entries);

  const filteredEntries = Object.values(entries).filter(
    (e) => e.category === activeCategory
  );

  const navigateToManga = useCallback(
    (mangaId: string) => {
      router.push(`/manga/${mangaId}` as any);
    },
    [router]
  );

  // Auto-reconcile unread counts when returning to the Library tab
  useFocusEffect(
    useCallback(() => {
      const allEntries = Object.values(useLibraryStore.getState().entries);
      const historyEntries = useHistoryStore.getState().entries;
      const historyMap = new Map<string, string>();
      historyEntries.forEach((h) => {
        if (h.mangaId && h.chapterId) {
          historyMap.set(h.mangaId, h.chapterId);
        }
      });

      // Update unread count if last read chapter ID changed
      allEntries.forEach((item) => {
        const lastRead = historyMap.get(item.mangaId);
        if (lastRead && lastRead !== item.lastReadChapterId) {
          useLibraryStore.getState().updateReadProgress(item.mangaId, lastRead, 0);
        }
      });
    }, [])
  );

  // Pull to refresh: Fetch latest chapters from MangaDex and update unread badges
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const allEntries = Object.values(useLibraryStore.getState().entries);
      const historyStore = useHistoryStore.getState();

      await Promise.allSettled(
        allEntries.map(async (entry) => {
          try {
            const feed = await getMangaChapters(entry.mangaId, 'en', 100, 0, 'desc');
            const chs = feed.data || [];
            if (chs.length > 0) {
              const progress = historyStore.getMangaProgress(entry.mangaId);
              let unread = chs.length;
              if (progress?.chapterId) {
                const idx = chs.findIndex((c) => c.id === progress.chapterId);
                if (idx >= 0) {
                  unread = idx;
                }
              }
              useLibraryStore.getState().updateChapterCounts(entry.mangaId, chs.length, Math.max(0, unread));
            }
          } catch (_e) {
            // Ignore single failures during bulk refresh
          }
        })
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[{ flex: 1, width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={() => setDrawerVisible(true)}
                style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
                hitSlop={8}
              >
                <Ionicons name="menu" size={26} color={colors.text} />
              </Pressable>
            )}
            <Text style={[styles.title, { color: colors.text }]}>Library</Text>
          </View>
          <View style={styles.headerRight}>
            {refreshing && (
              <Text style={[styles.syncingText, { color: colors.accent }]}>Updating...</Text>
            )}
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {filteredEntries.length} titles
            </Text>
          </View>
        </View>

        {/* Category Chips Container (Fixed Height 46px) */}
        <View style={styles.chipBarWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
            style={{ flexGrow: 0 }}
          >
            {CATEGORIES.map((cat) => {
              const isActive = cat.key === activeCategory;
              const catCount = Object.values(entries).filter(
                (e) => e.category === cat.key
              ).length;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setActiveCategory(cat.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? colors.surfaceElevated : colors.surface,
                      borderColor: isActive ? colors.text : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={isActive ? colors.text : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      { color: isActive ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {cat.label}
                  </Text>
                  {catCount > 0 && (
                    <View
                      style={[
                        styles.chipBadge,
                        {
                          backgroundColor: isActive
                            ? colors.accent
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipBadgeText,
                          { color: '#FFFFFF' },
                        ]}
                      >
                        {catCount}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Library Grid / Empty State */}
        {filteredEntries.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyScroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
          >
            <View style={styles.emptyState}>
              <Ionicons name="library-outline" size={54} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No titles in this category
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Browse Discover to add manga to your collection
              </Text>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.gridContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
          >
            <View style={styles.mangaGrid}>
              {filteredEntries.map((entry) => (
                <MangaCard
                  key={entry.mangaId}
                  id={entry.mangaId}
                  title={entry.title}
                  coverUrl={entry.coverUrl}
                  unreadCount={entry.unreadCount}
                  onPress={navigateToManga}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {/* Hamburger Slide Drawer */}
        <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webCenteredContent: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'web' ? Spacing.lg : Spacing.md,
    paddingBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  plainIconButton: {
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  syncingText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  count: {
    fontSize: Typography.sizes.caption,
  },
  chipBarWrapper: {
    height: 46,
    marginBottom: Spacing.sm,
  },
  chipScroll: {
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    height: 46,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  chipBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.full,
    minWidth: 16,
    alignItems: 'center',
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
  },
  gridContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
    paddingTop: Spacing.sm,
  },
  mangaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    justifyContent: 'flex-start',
  },
});
