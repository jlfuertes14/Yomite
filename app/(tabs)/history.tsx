/**
 * History Screen — Clean & Flat Design (Google Stitch Style)
 * Container-free, borderless, modern reading history with date headers, progress bars, search, and selective deletion.
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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { useHistoryStore } from '../../src/store/historyStore';
import { useDownloadStore } from '../../src/store/downloadStore';
import { downloadChapter, removeDownloadedChapter } from '../../src/services/downloadService';
import { getMangaDetails, extractCoverFileName, getCoverUrl } from '../../src/api/mangadex';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
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

function getDateGroup(timestamp: number): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - 6 * 86400000;

  if (timestamp >= startOfToday) return 'Today';
  if (timestamp >= startOfYesterday) return 'Yesterday';
  if (timestamp >= startOfWeek) return 'Earlier this week';
  return 'Older';
}

function HistoryRowItem({
  item,
  isSelectMode,
  isSelected,
  showDateHeader,
  dateHeaderTitle,
  onPress,
  onToggleSelect,
  onDeleteSingle,
}: {
  item: HistoryEntry;
  isSelectMode: boolean;
  isSelected: boolean;
  showDateHeader: boolean;
  dateHeaderTitle: string;
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
    triggerHaptic();
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

  const progressPercent =
    item.totalPages > 0
      ? Math.min(100, Math.max(5, Math.round(((item.pageIndex + 1) / item.totalPages) * 100)))
      : 0;

  const isCompleted = item.totalPages > 0 && item.pageIndex + 1 >= item.totalPages;

  return (
    <View>
      {/* Date Section Header */}
      {showDateHeader && (
        <View style={styles.dateHeaderWrapper}>
          <Text style={styles.dateHeaderText}>{dateHeaderTitle}</Text>
        </View>
      )}

      {/* Flat Item Row (No container box, sits directly on background) */}
      <Pressable
        onPress={() => {
          if (isSelectMode) {
            onToggleSelect(item.chapterId);
          } else {
            onPress(item);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`Resume reading ${item.title}`}
        style={({ pressed, hovered }: any) => [
          styles.flatHistoryRow,
          isSelected && { backgroundColor: `${colors.accent}14` },
          (pressed || hovered) && !isSelected && { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
          Platform.OS === 'web' && { cursor: 'pointer' as any },
        ]}
      >
        {/* Selection Checkbox in Select Mode */}
        {isSelectMode && (
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={isSelected ? colors.accent : '#71717A'}
            style={styles.selectCheckbox}
          />
        )}

        {/* Manga Cover Thumbnail */}
        <View style={styles.coverThumbnail}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.coverImg}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Ionicons name="book-outline" size={20} color={colors.textMuted} />
          )}
        </View>

        {/* Metadata & Progress Bar */}
        <View style={styles.itemMetaCol}>
          <Text style={[styles.mangaTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.chapterSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.chapterTitle || `Page ${item.pageIndex + 1}`}
          </Text>

          {/* Reading Progress Bar & Timestamp */}
          <View style={styles.progressRow}>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%`, backgroundColor: colors.accent },
                ]}
              />
            </View>
            <Text style={[styles.progressInfoText, { color: colors.textMuted }]}>
              {isCompleted
                ? `Completed · ${formatTimeAgo(item.timestamp)}`
                : `Page ${item.pageIndex + 1}/${item.totalPages} · ${formatTimeAgo(item.timestamp)}`}
            </Text>
          </View>
        </View>

        {/* Inline Flat Actions */}
        {!isSelectMode && (
          <View style={styles.inlineActions}>
            <Pressable
              onPress={handleDownload}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Download options"
              style={({ pressed, hovered }: any) => [
                styles.actionBtn,
                (pressed || hovered) && { opacity: 0.7 },
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : isDownloaded ? (
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              ) : (
                <Ionicons name="download-outline" size={18} color={colors.textMuted} />
              )}
            </Pressable>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDeleteSingle(item);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Remove from history"
              style={({ pressed, hovered }: any) => [
                styles.actionBtn,
                (pressed || hovered) && { opacity: 0.7 },
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={styles.chevronWrapper}>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </View>
        )}
      </Pressable>

      {/* Hairline Divider between items */}
      <View style={styles.hairlineDivider} />
    </View>
  );
}

export default function HistoryScreen() {
  useDocumentTitle('History');
  const router = useRouter();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;

  const [drawerVisible, setDrawerVisible] = useState(false);
  const entries = useHistoryStore((s) => s.entries);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const removeEntries = useHistoryStore((s) => s.removeEntries);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  // Search & Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));

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
    triggerHaptic();
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.contentWrapper}>
        {/* Header Section */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <View style={styles.titleRow}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={() => setDrawerVisible(true)}
                style={({ pressed, hovered }: any) => [
                  styles.menuButton,
                  (pressed || hovered) && { opacity: 0.7, backgroundColor: 'rgba(63, 63, 70, 0.8)' },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Open navigation drawer"
                hitSlop={8}
              >
                <Ionicons name="menu" size={24} color={colors.text} />
              </Pressable>
            )}
            <Text style={[styles.title, isDesktop && styles.titleDesktop, { color: colors.text }]}>History</Text>
          </View>

          {entries.length > 0 && (
            <View style={styles.headerRightActions}>
              {isSelectMode ? (
                <>
                  <Pressable
                    onPress={handleSelectAll}
                    style={styles.headerBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle select all items"
                  >
                    <Text style={styles.headerBtnTextMuted}>
                      {selectedIds.size === filteredEntries.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setIsSelectMode(false);
                      setSelectedIds(new Set());
                    }}
                    style={styles.headerBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Exit select mode"
                  >
                    <Text style={[styles.headerBtnTextAccent, { color: colors.accent }]}>
                      Done
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => setIsSelectMode(true)}
                    style={styles.headerBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Enter selection mode"
                  >
                    <Text style={styles.headerBtnTextMuted}>Select</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleClearAll}
                    style={styles.headerBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Clear all history"
                  >
                    <Text style={[styles.headerBtnTextAccent, { color: colors.accent }]}>
                      Clear all
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>

        {/* Modern Flat Search Input (Directly on screen) */}
        {entries.length > 0 && (
          <View style={[styles.searchWrapper, isDesktop && styles.searchWrapperDesktop]}>
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search history by title or chapter…"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search text"
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Empty States */}
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="time-outline" size={38} color="#71717A" />
            </View>
            <Text style={styles.emptyTitle}>No reading history</Text>
            <Text style={styles.emptySubtitle}>
              Chapters you read will appear here automatically
            </Text>
          </View>
        ) : filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="search-outline" size={34} color="#71717A" />
            </View>
            <Text style={styles.emptyTitle}>No matching titles</Text>
            <Text style={styles.emptySubtitle}>
              No reading history found matching "{searchQuery}"
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={paginatedEntries}
              keyExtractor={(item) => `${item.chapterId}-${item.timestamp}`}
              renderItem={({ item, index }) => {
                const group = getDateGroup(item.timestamp);
                const prevGroup =
                  index > 0 ? getDateGroup(paginatedEntries[index - 1].timestamp) : null;
                const showDateHeader = index === 0 || group !== prevGroup;

                return (
                  <HistoryRowItem
                    item={item}
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds.has(item.chapterId)}
                    showDateHeader={showDateHeader}
                    dateHeaderTitle={group}
                    onPress={handleResume}
                    onToggleSelect={handleToggleSelect}
                    onDeleteSingle={handleDeleteSingle}
                  />
                );
              }}
              contentContainerStyle={[
                styles.listContent,
                isDesktop && styles.listContentDesktop,
                isSelectMode && selectedIds.size > 0 && { paddingBottom: 120 },
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
                      accessibilityRole="button"
                      accessibilityLabel="Previous page"
                      style={({ pressed, hovered }: any) => [
                        styles.pageBtn,
                        currentPage <= 1 && { opacity: 0.3 },
                        (pressed || hovered) && currentPage > 1 && { opacity: 0.7 },
                        Platform.OS === 'web' && { cursor: 'pointer' as any },
                      ]}
                    >
                      <Ionicons name="chevron-back" size={16} color="#E4E4E7" />
                      <Text style={styles.pageBtnText}>Prev</Text>
                    </Pressable>

                    <View style={styles.pageIndicatorPill}>
                      <Text style={styles.pageIndicatorText}>
                        Page {currentPage} of {totalPages}
                      </Text>
                      <Text style={styles.pageTotalCountText}>
                        ({filteredEntries.length} items)
                      </Text>
                    </View>

                    <Pressable
                      disabled={currentPage >= totalPages}
                      onPress={() => {
                        if (currentPage < totalPages) setCurrentPage((p) => p + 1);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Next page"
                      style={({ pressed, hovered }: any) => [
                        styles.pageBtn,
                        currentPage >= totalPages && { opacity: 0.3 },
                        (pressed || hovered) && currentPage < totalPages && { opacity: 0.7 },
                        Platform.OS === 'web' && { cursor: 'pointer' as any },
                      ]}
                    >
                      <Text style={styles.pageBtnText}>Next</Text>
                      <Ionicons name="chevron-forward" size={16} color="#E4E4E7" />
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ height: 40 }} />
                )
              }
            />

            {/* Floating Delete Selected Bar (Only in Selection Mode) */}
            {isSelectMode && selectedIds.size > 0 && (
              <View style={styles.floatingDeleteBar}>
                <Text style={styles.floatingBarText}>
                  {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
                </Text>
                <Pressable
                  onPress={handleDeleteSelected}
                  accessibilityRole="button"
                  accessibilityLabel="Delete selected reading history items"
                  style={({ pressed }: any) => [
                    styles.deleteSelectedBtn,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <Ionicons name="trash" size={16} color="#09090B" />
                  <Text style={styles.deleteSelectedText}>Delete Selected</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Confirmation Dialog */}
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

        {/* Sidebar Drawer */}
        <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F11',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerDesktop: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(39, 39, 42, 0.6)',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  titleDesktop: {
    fontSize: 32,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  headerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  headerBtnTextMuted: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D4D4D8',
  },
  headerBtnTextAccent: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Flat Search Input */
  searchWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchWrapperDesktop: {
    paddingHorizontal: 28,
    paddingBottom: 14,
  },
  searchBox: {
    height: 42,
    borderRadius: 12,
    backgroundColor: '#18181C',
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#E4E4E7',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },

  /* Flat List Feed */
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  listContentDesktop: {
    paddingHorizontal: 28,
  },
  dateHeaderWrapper: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(161, 161, 170, 0.9)',
    letterSpacing: 0.2,
  },
  flatHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 14,
  },
  hairlineDivider: {
    height: 1,
    backgroundColor: 'rgba(39, 39, 42, 0.4)',
    marginHorizontal: 4,
  },
  selectCheckbox: {
    marginRight: -4,
  },
  coverThumbnail: {
    width: 56,
    height: 78,
    borderRadius: 8,
    backgroundColor: '#27272A',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  itemMetaCol: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    gap: 2,
  },
  mangaTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  chapterSubtitle: {
    fontSize: 12,
    color: '#A1A1AA',
    marginTop: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  progressBarTrack: {
    width: 64,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#27272A',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressInfoText: {
    fontSize: 11,
    color: '#A1A1AA',
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronWrapper: {
    paddingLeft: 2,
  },

  /* Empty State */
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 60,
  },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(39, 39, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E4E4E7',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    paddingHorizontal: 40,
    maxWidth: 360,
  },

  /* Pagination */
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 40,
    gap: 12,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E4E4E7',
  },
  pageIndicatorPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pageIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E4E4E7',
  },
  pageTotalCountText: {
    fontSize: 10,
    color: '#71717A',
    marginTop: 1,
  },

  /* Floating Delete Bar */
  floatingDeleteBar: {
    position: 'absolute',
    bottom: 85,
    left: 20,
    right: 20,
    maxWidth: 420,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    elevation: 12,
  },
  floatingBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E4E4E7',
  },
  deleteSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
  },
  deleteSelectedText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '700',
  },
});
