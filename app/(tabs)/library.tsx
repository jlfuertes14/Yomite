/**
 * Library Screen — Modern Minimalist Edge-to-Edge Bookshelf
 * Fixed responsive chip container height & grid layout for mobile & web.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useLibraryStore } from '../../src/store/libraryStore';
import { MangaCard, CARD_GAP } from '../../src/components/MangaCard';
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
  const router = useRouter();
  const colors = Colors.dark;
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('reading');
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {filteredEntries.length} titles
        </Text>
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
        <ScrollView contentContainerStyle={styles.emptyScroll}>
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
        <ScrollView contentContainerStyle={styles.gridContainer}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  count: {
    fontSize: Typography.sizes.footnote,
  },
  chipBarWrapper: {
    height: 48,
    marginVertical: Spacing.xs,
  },
  chipScroll: {
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },
  chipBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chipBadgeText: { fontSize: 10, fontWeight: Typography.weights.bold },
  gridContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 40,
  },
  mangaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
