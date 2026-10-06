/**
 * Library Screen — Flat & Modern UI (Google Stitch Design System)
 * Container-free, borderless, clean aesthetic matching the Stitch Yomite Manga Reader.
 * Includes category pill filters, live search, 3-dots sheet with View Modes (Grid, Details, Compact),
 * Sort & Filter options, unread badges, bottom-right read percentage text, and long-press category switcher.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  TextInput,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { useLibraryStore, LibraryDisplayMode } from '../../src/store/libraryStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { useDownloadStore } from '../../src/store/downloadStore';
import { getMangaChapters } from '../../src/api/mangadex';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { LibraryCategoryModal } from '../../src/components/LibraryCategoryModal';
import { ListOptionsModal, SortOption } from '../../src/components/ListOptionsModal';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
import { triggerHaptic } from '../../src/utils/haptics';
import type { LibraryEntry, LibraryCategory, HistoryEntry } from '../../src/types';

type VectorIcon = keyof typeof Ionicons.glyphMap;

function getContrastTextColor(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#1B1B1F' : '#FFFFFF';
}

interface CategoryTab {
  key: LibraryCategory;
  label: string;
  icon: VectorIcon;
}

const CATEGORIES: CategoryTab[] = [
  { key: 'reading', label: 'Reading', icon: 'book-outline' },
  { key: 'plan_to_read', label: 'Plan to read', icon: 'bookmark-outline' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-outline' },
  { key: 'favorites', label: 'Favorites', icon: 'star-outline' },
  { key: 'dropped', label: 'Dropped', icon: 'trash-outline' },
];

type SortCriteria =
  | 'updatedAt'
  | 'lastRead'
  | 'titleAsc'
  | 'titleDesc'
  | 'addedNewest'
  | 'addedOldest'
  | 'unread'
  | 'progress'
  | 'totalChapters';

const LIBRARY_SORT_OPTIONS: SortOption<SortCriteria>[] = [
  { key: 'updatedAt', label: 'Recently updated' },
  { key: 'lastRead', label: 'Last read' },
  { key: 'titleAsc', label: 'By name (A–Z)' },
  { key: 'titleDesc', label: 'By name (Z–A)' },
  { key: 'addedNewest', label: 'Date added (Newest)' },
  { key: 'addedOldest', label: 'Date added (Oldest)' },
  { key: 'unread', label: 'Unread chapters' },
  { key: 'progress', label: 'Reading progress' },
  { key: 'totalChapters', label: 'Total chapters' },
];

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return 'Recently';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getCardMetadata(entry: LibraryEntry, historyEntry?: HistoryEntry) {
  let percent = 0;
  if (entry.category === 'completed') {
    percent = 100;
  } else if (entry.totalChapters > 0 && entry.unreadCount !== undefined) {
    const read = Math.max(0, entry.totalChapters - entry.unreadCount);
    percent = Math.min(100, Math.max(read > 0 ? 8 : 0, Math.round((read / entry.totalChapters) * 100)));
  } else if (historyEntry && historyEntry.totalPages > 0) {
    percent = Math.min(
      100,
      Math.max(8, Math.round(((historyEntry.pageIndex + 1) / historyEntry.totalPages) * 100))
    );
  } else if (entry.lastReadChapterId) {
    percent = 35;
  }

  let chapterMeta = '';
  if (historyEntry?.chapterTitle) {
    const match = historyEntry.chapterTitle.match(/(?:chapter|ch\.?)\s*([\d.]+)/i);
    chapterMeta = match ? `Ch. ${match[1]}` : historyEntry.chapterTitle.slice(0, 16);
  } else if (entry.totalChapters > 0) {
    chapterMeta = `Ch. ${entry.totalChapters}`;
  } else {
    chapterMeta = 'Ch. 1';
  }

  const timeLabel = formatTimeAgo(historyEntry?.timestamp || entry.updatedAt || entry.addedAt);
  const subtitle = `${chapterMeta} • ${timeLabel}`;
  const hasUnread = Boolean(entry.unreadCount && entry.unreadCount > 0);

  return { progressPercent: percent, chapterMeta, timeLabel, subtitle, hasUnread };
}

interface LibraryCardProps {
  entry: LibraryEntry;
  historyEntry?: HistoryEntry;
  onPress: (id: string) => void;
  onLongPress: (entry: LibraryEntry) => void;
}

/** 1. Grid Mode Card */
function LibraryGridCard({
  entry,
  historyEntry,
  cardWidth,
  onPress,
  onLongPress,
}: LibraryCardProps & { cardWidth: number }) {
  const colors = useThemeColors();
  const [hovered, setHovered] = useState(false);
  const { progressPercent, subtitle, hasUnread } = useMemo(
    () => getCardMetadata(entry, historyEntry),
    [entry, historyEntry]
  );

  return (
    <Pressable
      onPress={() => {
        triggerHaptic();
        onPress(entry.mangaId);
      }}
      onLongPress={() => {
        triggerHaptic();
        onLongPress(entry);
      }}
      // @ts-ignore - web hover support
      onMouseEnter={() => setHovered(true)}
      // @ts-ignore - web hover support
      onMouseLeave={() => setHovered(false)}
      style={({ pressed }) => [
        styles.cardContainer,
        {
          width: cardWidth,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${subtitle}${hasUnread ? `, ${entry.unreadCount} unread chapters` : ''}`}
    >
      <View
        style={[
          styles.coverWrapper,
          { backgroundColor: colors.surfaceElevated, borderWidth: 0 },
          {
            borderWidth: 0,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {entry.coverUrl ? (
          <Image
            source={{ uri: entry.coverUrl }}
            style={[
              styles.coverImage,
              hovered && Platform.OS === 'web' ? { transform: [{ scale: 1.04 }] } : null,
            ]}
            contentFit="cover"
            transition={250}
            recyclingKey={entry.mangaId}
          />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="book-outline" size={32} color={colors.textMuted} />
          </View>
        )}

        {/* Unread Amber Pill Badge */}
        {hasUnread && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.unreadBadgeText, { color: getContrastTextColor(colors.accent) }]}>
              {entry.unreadCount! > 99 ? '99+' : entry.unreadCount}
            </Text>
          </View>
        )}

        {/* Read Percentage Badge on Bottom Right */}
        {progressPercent > 0 && (
          <View style={[styles.percentBadge, { backgroundColor: colors.surface, borderWidth: 0 }]}>
            <Text
              style={[
                styles.percentText,
                { color: colors.text },
                progressPercent === 100 && { color: '#10B981' },
              ]}
            >
              {progressPercent}%
            </Text>
          </View>
        )}
      </View>

      <View style={styles.metaContainer}>
        <Text
          style={[
            styles.mangaTitle,
            { color: hovered ? colors.accent : colors.text },
          ]}
          numberOfLines={2}
        >
          {entry.title}
        </Text>
        <View style={styles.metaRow}>
          <View
            style={[
              styles.metaDot,
              { backgroundColor: hasUnread ? colors.accent : '#64748B' },
            ]}
          />
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** 2. Details Mode Card (Right side cover + Titles, details, etc. on the left) */
function LibraryDetailsCard({
  entry,
  historyEntry,
  onPress,
  onLongPress,
}: LibraryCardProps) {
  const colors = useThemeColors();
  const [hovered, setHovered] = useState(false);
  const { progressPercent, chapterMeta, timeLabel, hasUnread } = useMemo(
    () => getCardMetadata(entry, historyEntry),
    [entry, historyEntry]
  );

  return (
    <Pressable
      onPress={() => {
        triggerHaptic();
        onPress(entry.mangaId);
      }}
      onLongPress={() => {
        triggerHaptic();
        onLongPress(entry);
      }}
      // @ts-ignore
      onMouseEnter={() => setHovered(true)}
      // @ts-ignore
      onMouseLeave={() => setHovered(false)}
      style={({ pressed }) => [
        styles.detailsCard,
        {
          backgroundColor: hovered ? colors.surfaceElevated : 'transparent',
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${chapterMeta}, ${timeLabel}${hasUnread ? `, ${entry.unreadCount} unread chapters` : ''}`}
    >
      {/* Right side: Manga title, details, chapter info, badges */}
      <View style={styles.detailsLeft}>
        <Text
          style={[
            styles.detailsTitle,
            { color: hovered ? colors.accent : colors.text },
          ]}
          numberOfLines={2}
        >
          {entry.title}
        </Text>

        <View style={styles.detailsMetaRow}>
          <View
            style={[
              styles.metaDot,
              { backgroundColor: hasUnread ? colors.accent : '#64748B' },
            ]}
          />
          <Text style={[styles.detailsMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {chapterMeta} • {timeLabel}
          </Text>
        </View>

        <View style={styles.detailsBadgesRow}>
          {hasUnread && (
            <View
              style={[
                styles.detailsUnreadPill,
                { backgroundColor: colors.accentSubtle, borderWidth: 0 },
              ]}
            >
              <Text style={[styles.detailsUnreadText, { color: colors.accent }]}>
                {entry.unreadCount} unread
              </Text>
            </View>
          )}
          {progressPercent > 0 && (
            <View style={[styles.detailsProgressPill, { backgroundColor: colors.surfaceElevated, borderWidth: 0 }]}>
              <Text
                style={[
                  styles.detailsProgressText,
                  progressPercent === 100 && { color: '#10B981' },
                ]}
              >
                {progressPercent}% read
              </Text>
            </View>
          )}
          {entry.totalChapters > 0 && (
            <Text style={[styles.detailsTotalText, { color: colors.textMuted }]}>
              {entry.totalChapters} chapters
            </Text>
          )}
        </View>
      </View>

      {/* Left side: Manga Cover */}
      <View style={[styles.detailsCoverWrapper, { backgroundColor: colors.surfaceElevated, borderWidth: 0 }]}>
        {entry.coverUrl ? (
          <Image
            source={{ uri: entry.coverUrl }}
            style={styles.coverImage}
            contentFit="cover"
            transition={250}
            recyclingKey={entry.mangaId}
          />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="book-outline" size={24} color={colors.textMuted} />
          </View>
        )}

        {/* Top-Right Unread Badge */}
        {hasUnread && (
          <View style={[styles.unreadBadgeMini, { backgroundColor: colors.accent }]}>
            <Text style={styles.unreadBadgeTextMini}>
              {entry.unreadCount! > 99 ? '99+' : entry.unreadCount}
            </Text>
          </View>
        )}

        {/* Bottom-Right Percentage Badge */}
        {progressPercent > 0 && (
          <View style={styles.percentBadgeMini}>
            <Text
              style={[
                styles.percentTextMini,
                progressPercent === 100 && { color: '#10B981' },
              ]}
            >
              {progressPercent}%
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** 3. Compact Mode Card (Tile Mode) */
function LibraryCompactCard({
  entry,
  historyEntry,
  onPress,
  onLongPress,
}: LibraryCardProps) {
  const colors = useThemeColors();
  const [hovered, setHovered] = useState(false);
  const { progressPercent, chapterMeta, timeLabel, hasUnread } = useMemo(
    () => getCardMetadata(entry, historyEntry),
    [entry, historyEntry]
  );

  return (
    <Pressable
      onPress={() => {
        triggerHaptic();
        onPress(entry.mangaId);
      }}
      onLongPress={() => {
        triggerHaptic();
        onLongPress(entry);
      }}
      // @ts-ignore
      onMouseEnter={() => setHovered(true)}
      // @ts-ignore
      onMouseLeave={() => setHovered(false)}
      style={({ pressed }) => [
        styles.compactCard,
        {
          backgroundColor: hovered ? colors.surfaceElevated : 'transparent',
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${chapterMeta}, ${timeLabel}`}
    >
      {/* Left: Mini Cover Thumbnail */}
      <View style={[styles.compactCoverWrapper, { backgroundColor: colors.surfaceElevated, borderWidth: 0 }]}>
        {entry.coverUrl ? (
          <Image
            source={{ uri: entry.coverUrl }}
            style={styles.coverImage}
            contentFit="cover"
            transition={200}
            recyclingKey={entry.mangaId}
          />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="book-outline" size={16} color={colors.textMuted} />
          </View>
        )}
      </View>

      {/* Middle: Title & Subtitle */}
      <View style={styles.compactCenter}>
        <Text
          style={[styles.compactTitle, { color: hovered ? colors.accent : colors.text }]}
          numberOfLines={1}
        >
          {entry.title}
        </Text>
        <View style={styles.compactMetaRow}>
          <View
            style={[
              styles.metaDot,
              { backgroundColor: hasUnread ? colors.accent : '#64748B' },
            ]}
          />
          <Text style={[styles.compactMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {chapterMeta} • {timeLabel}
          </Text>
        </View>
      </View>

      {/* Right: Percentage & Unread Pill */}
      <View style={styles.compactRight}>
        {progressPercent > 0 && (
          <Text
            style={[
              styles.compactPercentText,
              progressPercent === 100 && { color: '#10B981' },
            ]}
          >
            {progressPercent}%
          </Text>
        )}
        {hasUnread && (
          <View style={[styles.compactUnreadBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.compactUnreadText, { color: getContrastTextColor(colors.accent) }]}>
              {entry.unreadCount! > 99 ? '99+' : entry.unreadCount}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function LibraryScreen() {
  useDocumentTitle('Library');
  const router = useRouter();
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();

  // Stores
  const entries = useLibraryStore((s) => s.entries);
  const displayMode = useLibraryStore((s) => s.displayMode || 'grid');
  const setDisplayMode = useLibraryStore((s) => s.setDisplayMode);
  const gridColumns = useLibraryStore((s) => s.gridColumns || 2);
  const setGridColumns = useLibraryStore((s) => s.setGridColumns);
  const updateCategory = useLibraryStore((s) => s.updateCategory);
  const removeFromLibrary = useLibraryStore((s) => s.removeFromLibrary);
  const historyEntries = useHistoryStore((s) => s.entries);
  const downloadedChapters = useDownloadStore((s) => s.chapters);

  // Local state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('reading');
  const [refreshing, setRefreshing] = useState(false);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 3-Dots List options modal state
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('updatedAt');

  // Category change modal on long press
  const [selectedManga, setSelectedManga] = useState<LibraryEntry | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // Manga ID to History Entry map for fast lookup
  const historyMap = useMemo(() => {
    const map = new Map<string, HistoryEntry>();
    historyEntries.forEach((h) => {
      if (h.mangaId && !map.has(h.mangaId)) {
        map.set(h.mangaId, h);
      }
    });
    return map;
  }, [historyEntries]);

  // Set of downloaded manga IDs
  const downloadedMangaIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(downloadedChapters).forEach((ch) => {
      if (ch.status === 'completed' && ch.mangaId) {
        ids.add(ch.mangaId);
      }
    });
    return ids;
  }, [downloadedChapters]);

  const navigateToManga = useCallback(
    (mangaId: string) => {
      router.push(`/manga/${mangaId}` as any);
    },
    [router]
  );

  const handleCardLongPress = useCallback((entry: LibraryEntry) => {
    setSelectedManga(entry);
    setCategoryModalVisible(true);
  }, []);

  // Auto-reconcile unread counts when returning to the Library tab
  useFocusEffect(
    useCallback(() => {
      const allEntries = Object.values(useLibraryStore.getState().entries);
      const hist = useHistoryStore.getState().entries;
      const hMap = new Map<string, string>();
      hist.forEach((h) => {
        if (h.mangaId && h.chapterId) {
          hMap.set(h.mangaId, h.chapterId);
        }
      });

      allEntries.forEach((item) => {
        const lastRead = hMap.get(item.mangaId);
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
              useLibraryStore
                .getState()
                .updateChapterCounts(entry.mangaId, chs.length, Math.max(0, unread));
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

  // Filtered and Sorted Manga Entries
  const filteredEntries = useMemo(() => {
    let list = Object.values(entries).filter((e) => e.category === activeCategory);

    // Filter by search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }

    // Sorting matching Kotatsu ListSortOrder
    list.sort((a, b) => {
      switch (sortCriteria) {
        case 'titleAsc':
          return a.title.localeCompare(b.title);
        case 'titleDesc':
          return b.title.localeCompare(a.title);
        case 'lastRead': {
          const aTime = historyMap.get(a.mangaId)?.timestamp || 0;
          const bTime = historyMap.get(b.mangaId)?.timestamp || 0;
          return bTime - aTime;
        }
        case 'addedNewest':
          return (b.addedAt || 0) - (a.addedAt || 0);
        case 'addedOldest':
          return (a.addedAt || 0) - (b.addedAt || 0);
        case 'unread':
          return (b.unreadCount || 0) - (a.unreadCount || 0);
        case 'progress': {
          const aProg = getCardMetadata(a, historyMap.get(a.mangaId)).progressPercent;
          const bProg = getCardMetadata(b, historyMap.get(b.mangaId)).progressPercent;
          return bProg - aProg;
        }
        case 'totalChapters':
          return (b.totalChapters || 0) - (a.totalChapters || 0);
        case 'updatedAt':
        default: {
          const aTime = historyMap.get(a.mangaId)?.timestamp || a.updatedAt || a.addedAt || 0;
          const bTime = historyMap.get(b.mangaId)?.timestamp || b.updatedAt || b.addedAt || 0;
          return bTime - aTime;
        }
      }
    });

    return list;
  }, [
    entries,
    activeCategory,
    searchQuery,
    sortCriteria,
    historyMap,
    downloadedMangaIds,
  ]);

  // Responsive Grid Geometry with user-configured grid columns
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;
  const columns = isDesktop ? Math.max(gridColumns, 4) : isTablet ? Math.max(gridColumns, 3) : gridColumns;
  const cardGap = 16;
  const horizontalPadding = isDesktop ? 32 : 20;
  const maxContainerWidth = isDesktop ? Math.min(windowWidth - 40, 1280) : windowWidth;
  const availableGridWidth = maxContainerWidth - horizontalPadding * 2;
  const totalGapWidth = (columns - 1) * cardGap;
  const cardWidth = Math.floor((availableGridWidth - totalGapWidth) / columns);

  // Active category label
  const activeCategoryObj = CATEGORIES.find((c) => c.key === activeCategory) || CATEGORIES[0];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View
        style={[
          styles.mainWrapper,
          Platform.OS === 'web' && isDesktop && styles.desktopCenteredWrapper,
        ]}
      >
        {/* Flat Header: Title & Clean Action Toolbar (Only Search and 3 Dots) */}
        <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
          <View style={styles.titleRow}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={() => setDrawerVisible(true)}
                style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Open navigation menu"
                hitSlop={8}
              >
                <Ionicons name="menu" size={22} color={colors.text} />
              </Pressable>
            )}
            <View style={styles.titleWithBadge}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Library</Text>
              <View style={[styles.titleBadge, { backgroundColor: colors.surfaceElevated, borderWidth: 0 }]}>
                <Text style={[styles.titleBadgeText, { color: colors.textMuted }]}>
                  {filteredEntries.length} {filteredEntries.length === 1 ? 'title' : 'titles'}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons: Search Toggle & 3 Dots Options */}
          <View style={styles.headerActions}>
            {refreshing && (
              <View style={styles.syncingPill}>
                <Text style={[styles.syncingText, { color: colors.accent }]}>Updating…</Text>
              </View>
            )}

            {/* Search Toggle Button */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setIsSearchOpen((prev) => !prev);
                if (isSearchOpen) setSearchQuery('');
              }}
              style={({ pressed }) => [
                styles.actionButton,
                isSearchOpen && { backgroundColor: colors.surfaceElevated },
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Search library"
              hitSlop={8}
            >
              <Ionicons
                name={isSearchOpen ? 'close' : 'search-outline'}
                size={20}
                color={isSearchOpen ? colors.text : colors.textMuted}
              />
            </Pressable>

            {/* 3 Dots Menu Button (Contains View Mode, Sort, Filter, Refresh) */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setOptionsModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Library options, view mode, and sort order"
              hitSlop={8}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={sortCriteria !== 'updatedAt' ? colors.accent : '#94A3B8'}
              />
            </Pressable>
          </View>
        </View>

        {/* Collapsible Search Input Bar */}
        {isSearchOpen && (
          <View style={[styles.searchBarWrapper, { paddingHorizontal: horizontalPadding }]}>
            <View style={[styles.searchInputContainer, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={`Search in ${activeCategoryObj.label}…`}
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.text }]}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClearBtn}
                  hitSlop={8}
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Category Filter Tabs Bar */}
        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.tabsScrollContent, { paddingHorizontal: horizontalPadding }]}
          >
            {CATEGORIES.map((cat) => {
              const isActive = cat.key === activeCategory;
              const count = Object.values(entries).filter((e) => e.category === cat.key).length;

              return (
                <Pressable
                  key={cat.key}
                  onPress={() => {
                    triggerHaptic();
                    setActiveCategory(cat.key);
                  }}
                  style={({ pressed }) => [
                    styles.tabPill,
                    isActive
                      ? [styles.tabPillActive, { backgroundColor: colors.text }]
                      : [styles.tabPillInactive, { backgroundColor: colors.surfaceElevated }],
                    { transform: [{ scale: pressed ? 0.96 : 1 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${cat.label} category, ${count} titles`}
                >
                  <Ionicons
                    name={cat.icon}
                    size={15}
                    color={isActive ? colors.background : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      isActive ? [styles.tabLabelActive, { color: colors.background }] : [styles.tabLabelInactive, { color: colors.textSecondary }],
                    ]}
                  >
                    {cat.label}
                  </Text>
                  {count > 0 && (
                    <View
                      style={[
                        styles.tabCountBadge,
                        isActive
                          ? [styles.tabCountBadgeActive, { backgroundColor: `${colors.background}30` }]
                          : [styles.tabCountBadgeInactive, { backgroundColor: colors.surface }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabCountText,
                          isActive
                            ? [styles.tabCountTextActive, { color: colors.background }]
                            : [styles.tabCountTextInactive, { color: colors.textMuted }],
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Bookshelf Content according to Display Mode (Grid / Details / Compact) */}
        {filteredEntries.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
          >
            <View style={styles.emptyContent}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceElevated, borderWidth: 0 }]}>
                <Ionicons
                  name={searchQuery ? 'search-outline' : activeCategoryObj.icon}
                  size={36}
                  color={colors.textMuted}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {searchQuery ? 'No matching titles' : `No titles in ${activeCategoryObj.label}`}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {searchQuery
                  ? `No manga found matching "${searchQuery}" in this category.`
                  : `Explore Discover to find and bookmark manga to your ${activeCategoryObj.label} shelf.`}
              </Text>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  router.push('/' as any);
                }}
                style={({ pressed }) => [
                  styles.emptyCtaButton,
                  { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Explore Discover"
              >
                <Ionicons name="compass-outline" size={18} color={getContrastTextColor(colors.accent)} />
                <Text style={[styles.emptyCtaText, { color: getContrastTextColor(colors.accent) }]}>Browse Discover</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: horizontalPadding },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
          >
            {/* Mode 1: Grid Mode */}
            {displayMode === 'grid' && (
              <View style={styles.mangaGrid}>
                {filteredEntries.map((entry) => (
                  <LibraryGridCard
                    key={entry.mangaId}
                    entry={entry}
                    historyEntry={historyMap.get(entry.mangaId)}
                    cardWidth={cardWidth}
                    onPress={navigateToManga}
                    onLongPress={handleCardLongPress}
                  />
                ))}
              </View>
            )}

            {/* Mode 2: Details Mode (Right side cover + titles & details on left) */}
            {displayMode === 'details' && (
              <View style={styles.detailsList}>
                {filteredEntries.map((entry) => (
                  <LibraryDetailsCard
                    key={entry.mangaId}
                    entry={entry}
                    historyEntry={historyMap.get(entry.mangaId)}
                    onPress={navigateToManga}
                    onLongPress={handleCardLongPress}
                  />
                ))}
              </View>
            )}

            {/* Mode 3: Compact Mode (Tile Mode) */}
            {displayMode === 'compact' && (
              <View style={styles.compactList}>
                {filteredEntries.map((entry) => (
                  <LibraryCompactCard
                    key={entry.mangaId}
                    entry={entry}
                    historyEntry={historyMap.get(entry.mangaId)}
                    onPress={navigateToManga}
                    onLongPress={handleCardLongPress}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Kotatsu Curtain List Options Bottom Sheet Modal */}
        <ListOptionsModal
          visible={optionsModalVisible}
          onClose={() => setOptionsModalVisible(false)}
          displayMode={displayMode}
          onSelectDisplayMode={(m) => {
            setDisplayMode(m);
          }}
          gridColumns={gridColumns}
          onSelectGridColumns={(cols) => {
            setGridColumns(cols);
          }}
          sortOrder={sortCriteria}
          onSelectSortOrder={(order) => {
            setSortCriteria(order);
          }}
          sortOptions={LIBRARY_SORT_OPTIONS}
        />

        {/* Long Press Category Switcher Modal */}
        {selectedManga && (
          <LibraryCategoryModal
            visible={categoryModalVisible}
            onClose={() => {
              setCategoryModalVisible(false);
              setSelectedManga(null);
            }}
            currentCategory={selectedManga.category}
            isInLibrary={true}
            onSelectCategory={(newCat) => {
              updateCategory(selectedManga.mangaId, newCat);
              setCategoryModalVisible(false);
              setSelectedManga(null);
            }}
            onRemoveFromLibrary={() => {
              removeFromLibrary(selectedManga.mangaId);
              setCategoryModalVisible(false);
              setSelectedManga(null);
            }}
          />
        )}

        {/* Web Sidebar Drawer */}
        <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
    width: '100%',
  },
  desktopCenteredWrapper: {
    maxWidth: 1280,
    alignSelf: 'center',
  },

  /* Flat Header */
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  titleBadge: {
    backgroundColor: '#1B1E28',
    borderWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  titleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncingPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
  },
  syncingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },

  /* Collapsible Search Bar */
  searchBarWrapper: {
    paddingBottom: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FAFAFA',
    fontSize: 16,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },

  /* Horizontal Category Tabs */
  tabsWrapper: {
    paddingBottom: 12,
  },
  tabsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tabPillActive: {
    borderWidth: 0,
  },
  tabPillInactive: {
    backgroundColor: '#18181C',
    borderWidth: 0,
  },
  tabLabel: {
    fontSize: 13,
  },
  tabLabelActive: {
    color: '#090A0F',
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: '#CBD5E1',
    fontWeight: '500',
  },
  tabCountBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountBadgeActive: {
    backgroundColor: 'rgba(9, 10, 15, 0.22)',
  },
  tabCountBadgeInactive: {
    backgroundColor: '#11131A',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabCountTextActive: {
    color: '#090A0F',
  },
  tabCountTextInactive: {
    color: '#94A3B8',
  },

  /* Scroll Content & Empty State */
  scrollContent: {
    paddingTop: 6,
    paddingBottom: 110,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 90,
  },
  emptyContent: {
    alignItems: 'center',
    maxWidth: 380,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#161820',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F3F4F6',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyCtaText: {
    color: '#090A0F',
    fontSize: 13.5,
    fontWeight: '700',
  },

  /* Mode 1: Grid Mode Styles */
  mangaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  cardContainer: {
    flexDirection: 'column',
    marginBottom: 8,
  },
  coverWrapper: {
    width: '100%',
    aspectRatio: 1 / 1.42,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#151821',
    borderWidth: 0,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: '#11131A',
  },
  unreadBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadBadgeText: {
    color: '#090A0F',
    fontSize: 11,
    fontWeight: '900',
  },
  percentBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(9, 10, 15, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  percentText: {
    color: '#F3F4F6',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  metaContainer: {
    marginTop: 8,
    gap: 3,
  },
  mangaTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    marginRight: 6,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    flex: 1,
  },

  /* Mode 2: Details Mode Styles */
  detailsList: {
    flexDirection: 'column',
    gap: 8,
  },
  detailsCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#161820',
  },
  detailsLeft: {
    flex: 1,
    paddingRight: 14,
    gap: 5,
  },
  detailsTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  detailsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  detailsBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  detailsUnreadPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0,
  },
  detailsUnreadText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailsProgressPill: {
    backgroundColor: '#161820',
    borderWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detailsProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  detailsTotalText: {
    fontSize: 11,
    color: '#64748B',
  },
  detailsCoverWrapper: {
    width: 76,
    aspectRatio: 1 / 1.42,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#151821',
    borderWidth: 0,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  unreadBadgeMini: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeTextMini: {
    color: '#090A0F',
    fontSize: 10,
    fontWeight: '900',
  },
  percentBadgeMini: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(9, 10, 15, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 0,
  },
  percentTextMini: {
    color: '#F3F4F6',
    fontSize: 9.5,
    fontWeight: '700',
  },

  /* Mode 3: Compact Mode Styles (Tile Mode) */
  compactList: {
    flexDirection: 'column',
    gap: 4,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#14161F',
  },
  compactCoverWrapper: {
    width: 42,
    aspectRatio: 1 / 1.42,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#151821',
    borderWidth: 0,
  },
  compactCenter: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    gap: 3,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactMetaText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#94A3B8',
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  compactUnreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactUnreadText: {
    color: '#090A0F',
    fontSize: 10.5,
    fontWeight: '900',
  },

  /* 3-Dots Modal Sheet */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '85%',
    backgroundColor: '#11131A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2330',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2330',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FAFAFA',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161820',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollArea: {
    marginTop: 8,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },

  /* View Mode Selector Row */
  viewModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  viewModePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#161820',
    borderWidth: 1,
    borderColor: '#1F2330',
  },
  viewModeText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
  },

  modalOptionGroup: {
    gap: 4,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#161820',
  },
  modalOptionRowActive: {
    backgroundColor: '#1B1E28',
  },
  modalOptionText: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  modalDirectionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  directionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#161820',
    borderWidth: 1,
    borderColor: '#1F2330',
  },
  directionText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  modalBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    marginBottom: 10,
  },
  modalResetBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#161820',
    borderWidth: 1,
    borderColor: '#1F2330',
  },
  modalResetText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  modalApplyBtn: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  modalApplyText: {
    color: '#090A0F',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Quick Actions Menu Items */
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#161820',
    gap: 12,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#11131A',
    borderWidth: 1,
    borderColor: '#1F2330',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextBox: {
    flex: 1,
  },
  menuTextTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FAFAFA',
  },
  menuTextSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 1,
  },
});
