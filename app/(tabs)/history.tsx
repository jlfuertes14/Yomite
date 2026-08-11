/**
 * History Screen — Modern Minimalist Reading History with Covers
 */
import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useHistoryStore } from '../../src/store/historyStore';
import { getMangaDetails, extractCoverFileName, getCoverUrl } from '../../src/api/mangadex';
import type { HistoryEntry } from '../../src/types';

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function HistoryRowItem({
  item,
  onPress,
}: {
  item: HistoryEntry;
  onPress: (entry: HistoryEntry) => void;
}) {
  const colors = Colors.dark;
  const [coverUrl, setCoverUrl] = useState<string | null>(item.coverUrl);

  useEffect(() => {
    if (!coverUrl && item.mangaId && item.mangaId.length === 36) {
      getMangaDetails(item.mangaId)
        .then((manga) => {
          const fileName = extractCoverFileName(manga);
          const url = getCoverUrl(manga.id, fileName, '256');
          if (url) setCoverUrl(url);
        })
        .catch(() => {});
    }
  }, [item.mangaId, coverUrl]);

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.historyRow,
        {
          backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Cover thumbnail */}
      <View style={[styles.thumbnail, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.thumbnailImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Ionicons name="book-outline" size={18} color={colors.textMuted} />
        )}
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={[styles.mangaTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.chapterInfo, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.chapterTitle} · Page {item.pageIndex + 1}/{item.totalPages}
        </Text>
        <Text style={[styles.timestamp, { color: colors.textMuted }]}>
          {formatTimeAgo(item.timestamp)}
        </Text>
      </View>

      {/* Resume arrow */}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const colors = Colors.dark;
  const entries = useHistoryStore((s) => s.entries);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  const handleResume = useCallback(
    (entry: HistoryEntry) => {
      router.push(`/reader/${entry.chapterId}?mangaId=${entry.mangaId}` as any);
    },
    [router]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>History</Text>
        {entries.length > 0 && (
          <Pressable onPress={clearHistory}>
            <Text style={[styles.clearBtn, { color: colors.accent }]}>Clear all</Text>
          </Pressable>
        )}
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            No reading history
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Chapters you read will appear here automatically
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => `${item.chapterId}-${item.timestamp}`}
          renderItem={({ item }) => <HistoryRowItem item={item} onPress={handleResume} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
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
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  clearBtn: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: 40,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  thumbnail: {
    width: 48,
    height: 68,
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    flex: 1,
    gap: 2,
  },
  mangaTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  chapterInfo: {
    fontSize: Typography.sizes.footnote,
  },
  timestamp: {
    fontSize: Typography.sizes.caption,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
