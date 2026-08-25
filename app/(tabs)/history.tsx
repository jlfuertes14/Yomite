/**
 * History Screen — Modern Minimalist Reading History with Search, Pagination, and Selective Deletion
 */
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { useHistoryStore } from '../../src/store/historyStore';
import { useDownloadStore } from '../../src/store/downloadStore';
import { downloadChapter, removeDownloadedChapter } from '../../src/services/downloadService';
import { getMangaDetails, extractCoverFileName, getCoverUrl } from '../../src/api/mangadex';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import type { HistoryEntry } from '../../src/types';
import { triggerHaptic } from '../../src/utils/haptics';

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
  isSelectMode,
  isSelected,
  onPress,
  onToggleSelect,
  onDeleteSingle,
}: {
  item: HistoryEntry;
  isSelectMode: boolean;
  isSelected: boolean;
  onPress: (entry: HistoryEntry) => void;
  onToggleSelect: (chapterId: string) => void;
  onDeleteSingle: (entry: HistoryEntry) => void;
}) {
  const colors = useThemeColors();
  const [coverUrl, setCoverUrl] = useState<string | null>(item.coverUrl);

  const dlItem = useDownloadStore((s) => s.chapters[item.chapterId]);
  const isDownloading = dlItem?.status === 'downloading';
  const isDownloaded = dlItem?.status === 'completed';

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

  const handleDownload = (e: any) => {
    e.stopPropagation();
    if (isDownloaded) {
      removeDownloadedChapter(item.chapterId, item.mangaId);
      return;
    }
    if (isDownloading) return;

    downloadChapter({
      chapterId: item.chapterId,
      mangaId: item.mangaId,
      mangaTitle: item.title,
      chapterNum: item.chapterTitle ? item.chapterTitle.replace(/[^0-9.]/g, '') || '1' : '1',
      chapterTitle: item.chapterTitle || '',
      coverUrl,
    });
  };

  return (
    <Pressable
      onPress={() => {
        if (isSelectMode) {
          onToggleSelect(item.chapterId);
        } else {
          onPress(item);
        }
      }}
      style={({ pressed }) => [
        styles.historyRow,
        {
          backgroundColor: isSelected
            ? colors.accentSubtle
            : pressed
            ? colors.surfaceElevated
            : colors.surface,
          borderColor: isSelected ? colors.accent : colors.border,
        },
      ]}
    >
      {/* Selection Checkbox in Select Mode */}
      {isSelectMode && (
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={isSelected ? colors.accent : colors.textMuted}
          style={{ marginRight: 4 }}
        />
      )}

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

      {/* Action: Download, Trash button or Resume arrow */}
      {!isSelectMode ? (
        <View style={styles.actionGroup}>
          <Pressable
            onPress={handleDownload}
            hitSlop={8}
            style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : isDownloaded ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.emerald} />
            ) : (
              <Ionicons name="download-outline" size={18} color={colors.textSecondary} />
            )}
          </Pressable>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDeleteSingle(item);
            }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.deleteBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>

          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const entries = useHistoryStore((s) => s.entries);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const removeEntries = useHistoryStore((s) => s.removeEntries);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  // Search & Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // Selection state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirmation Modal state
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: keyof typeof Ionicons.glyphMap;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Filtered History Entries
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase().trim();
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.chapterTitle && e.chapterTitle.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));

  // Paginated Entries for current page
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEntries.slice(start, start + PAGE_SIZE);
  }, [filteredEntries, currentPage]);

  const handleResume = useCallback(
    (entry: HistoryEntry) => {
      router.push(`/reader/${entry.chapterId}?mangaId=${entry.mangaId}&page=${entry.pageIndex}` as any);
    },
    [router]
  );

  const handleToggleSelect = useCallback((chapterId: string) => {
    triggerHaptic();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map((e) => e.chapterId)));
    }
  }, [selectedIds.size, filteredEntries]);

  const handleDeleteSingle = useCallback(
    (entry: HistoryEntry) => {
      setConfirmModalConfig({
        visible: true,
        title: 'Delete History Item',
        message: `Are you sure you want to remove "${entry.title}" from your reading history?`,
        iconName: 'trash-outline',
        confirmText: 'Delete Item',
        onConfirm: () => {
          removeEntry(entry.chapterId);
          setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
        },
      });
    },
    [removeEntry]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setConfirmModalConfig({
      visible: true,
      title: 'Delete Selected Items',
      message: `Are you sure you want to delete ${selectedIds.size} selected reading history ${selectedIds.size === 1 ? 'item' : 'items'}?`,
      iconName: 'trash-outline',
      confirmText: `Delete (${selectedIds.size})`,
      onConfirm: () => {
        removeEntries(Array.from(selectedIds));
        setSelectedIds(new Set());
        setIsSelectMode(false);
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  }, [selectedIds, removeEntries]);

  const handleClearAll = useCallback(() => {
    setConfirmModalConfig({
      visible: true,
      title: 'Clear Reading History',
      message: 'Are you sure you want to clear your entire reading history? This action cannot be undone.',
      iconName: 'trash-outline',
      confirmText: 'Clear All',
      onConfirm: () => {
        clearHistory();
        setSelectedIds(new Set());
        setIsSelectMode(false);
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  }, [clearHistory]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[{ flex: 1, width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>
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
          <Text style={[styles.title, { color: colors.text }]}>History</Text>
        </View>

        {entries.length > 0 && (
          <View style={styles.headerRightActions}>
            {isSelectMode ? (
              <>
                <Pressable onPress={handleSelectAll} style={styles.headerBtn}>
                  <Text style={[styles.headerBtnText, { color: colors.textSecondary }]}>
                    {selectedIds.size === filteredEntries.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setIsSelectMode(false);
                    setSelectedIds(new Set());
                  }}
                  style={styles.headerBtn}
                >
                  <Text style={[styles.headerBtnText, { color: colors.accent }]}>Done</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => setIsSelectMode(true)}
                  style={styles.headerBtn}
                >
                  <Text style={[styles.headerBtnText, { color: colors.textSecondary }]}>
                    Select
                  </Text>
                </Pressable>
                <Pressable onPress={handleClearAll} style={styles.headerBtn}>
                  <Text style={[styles.headerBtnText, { color: colors.accent }]}>
                    Clear all
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      {/* Search Input Bar when history is present */}
      {entries.length > 0 && (
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search history by title or chapter..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
      )}

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
      ) : filteredEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={44} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            No matching titles
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            No reading history found matching "{searchQuery}"
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={paginatedEntries}
            keyExtractor={(item) => `${item.chapterId}-${item.timestamp}`}
            renderItem={({ item }) => (
              <HistoryRowItem
                item={item}
                isSelectMode={isSelectMode}
                isSelected={selectedIds.has(item.chapterId)}
                onPress={handleResume}
                onToggleSelect={handleToggleSelect}
                onDeleteSingle={handleDeleteSingle}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              isSelectMode && selectedIds.size > 0 && { paddingBottom: 110 },
            ]}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              filteredEntries.length > PAGE_SIZE ? (
                <View style={styles.paginationRow}>
                  <Pressable
                    disabled={currentPage <= 1}
                    onPress={() => {
                      if (currentPage > 1) setCurrentPage((p) => p - 1);
                    }}
                    style={({ pressed }) => [
                      styles.pageBtn,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      currentPage <= 1 && { opacity: 0.3 },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="chevron-back" size={16} color={colors.text} />
                    <Text style={[styles.pageBtnText, { color: colors.text }]}>Prev</Text>
                  </Pressable>

                  <View style={styles.pageIndicatorPill}>
                    <Text style={[styles.pageIndicatorText, { color: colors.text }]}>
                      Page {currentPage} of {totalPages}
                    </Text>
                    <Text style={[styles.pageTotalCountText, { color: colors.textMuted }]}>
                      ({filteredEntries.length} items)
                    </Text>
                  </View>

                  <Pressable
                    disabled={currentPage >= totalPages}
                    onPress={() => {
                      if (currentPage < totalPages) setCurrentPage((p) => p + 1);
                    }}
                    style={({ pressed }) => [
                      styles.pageBtn,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      currentPage >= totalPages && { opacity: 0.3 },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.pageBtnText, { color: colors.text }]}>Next</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.text} />
                  </Pressable>
                </View>
              ) : null
            }
          />

          {/* Floating Delete Selected Bar */}
          {isSelectMode && selectedIds.size > 0 && (
            <View style={[styles.floatingDeleteBar, { backgroundColor: '#18181B', borderColor: colors.border }]}>
              <Text style={[styles.floatingBarText, { color: colors.text }]}>
                {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
              </Text>
              <Pressable
                onPress={handleDeleteSelected}
                style={({ pressed }) => [
                  styles.deleteSelectedBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="trash" size={16} color="#FFFFFF" />
                <Text style={styles.deleteSelectedText}>Delete Selected</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Sleek Custom Deletion Confirmation Dialog */}
      <ConfirmationModal
        visible={confirmModalConfig.visible}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        iconName={confirmModalConfig.iconName || 'trash-outline'}
        confirmVariant="destructive"
        confirmText={confirmModalConfig.confirmText || 'Delete'}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, visible: false }))}
      />

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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  plainIconButton: {
    padding: 4,
  },
  title: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  headerBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  searchBox: {
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.footnote,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: 80,
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
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  deleteBtn: {
    padding: 6,
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

  /* Pagination Controls */
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 4,
  },
  pageBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  pageIndicatorPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  pageIndicatorText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  pageTotalCountText: {
    fontSize: 10,
  },

  /* Floating Delete Selected Bar */
  floatingDeleteBar: {
    position: 'absolute',
    bottom: 80,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingBarText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  deleteSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    gap: 6,
  },
  deleteSelectedText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
});
