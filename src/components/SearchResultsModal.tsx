/**
 * SearchResultsModal — Full-screen cross-extension search sheet.
 *
 * Combines the search field, recent searches (quick-search pills) and the
 * grouped per-extension result carousels into a single sheet that slides up
 * from the Discover search icon.
 *
 * Rendered as an absolute overlay inside the Discover screen (not an RN
 * Modal), so the source catalog can slide away on top of it and reveal the
 * restored results in one continuous motion.
 */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput, type TextInputInstance,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../../constants/Colors';
import {
  extractAuthorName,
  getBatchMangaStatistics,
  getMangaTitle,
} from '../api/mangadex';
import { useThemeColors } from '../hooks/useThemeColor';
import { sourceMangaToAppManga } from '../sources/adapter';
import { SourceManager } from '../sources/SourceManager';
import type { MangaSourceMetadata } from '../sources/types';
import { useUIStore } from '../store/uiStore';
import type { Manga } from '../types';
import { triggerHaptic } from '../utils/haptics';
import { CARD_GAP, MangaCard } from './MangaCard';
import { Skeleton } from './Skeleton';

const RECENT_SEARCHES_KEY = '@mangaapp_recent_searches_v1';
const MAX_RECENT_SEARCHES = 8;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface GroupedExtensionResult {
  source: MangaSourceMetadata;
  mangaList: Manga[];
  coverMap: Record<string, SourceCoverInfo>;
}

export interface SearchResultsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectManga: (id: string) => void;
  /** Query to pre-fill when the sheet is reopened from a source catalog. */
  initialQuery?: string;
  /** Opens the source catalog browser (Extensions screen) for a single source. */
  onViewAll: (source: MangaSourceMetadata, query: string) => void;
  /** Disable the slide-up entrance when restoring from the source catalog. */
  animateIn?: boolean;
}

interface SourceCoverInfo {
  url: string | null;
  headers?: Record<string, string>;
}

function resolveCoverInfo(sm: { coverUrl?: string | null; coverHeaders?: Record<string, string> }): SourceCoverInfo {
  let url = sm.coverUrl || null;
  if (url && url.startsWith('//')) url = `https:${url}`;
  return { url, headers: sm.coverHeaders };
}

export function SearchResultsModal({
  visible,
  onClose,
  onSelectManga,
  onViewAll,
  initialQuery,
  animateIn = true,
}: SearchResultsModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputInstance>(null);
  const requestIdRef = useRef(0);
  // Query whose results are currently rendered (used to avoid refetching when
  // the sheet is reopened from the source catalog).
  const resultsQueryRef = useRef('');
  // Query with an in-flight request, so we never start a duplicate one.
  const pendingQueryRef = useRef<string | null>(null);

  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<GroupedExtensionResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, any>>({});
  // Slide-up / slide-down overlay animation (1 = parked below the screen).
  const slideAnim = useRef(new Animated.Value(1)).current;
  const [isDisplayed, setIsDisplayed] = useState(false);
  const setTabBarVisible = useUIStore((s) => s.setTabBarVisible);

  // Show / hide the overlay. External closes (navigation, Android back) drop
  // it instantly; the sheet's own back button plays the exit slide first.
  useEffect(() => {
    if (!visible) {
      setIsDisplayed(false);
      slideAnim.setValue(1);
      return;
    }

    setIsDisplayed(true);
    if (animateIn) {
      slideAnim.setValue(1);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, animateIn, slideAnim]);

  // The sheet covers the floating tab bar, so hide it while it is open.
  useEffect(() => {
    if (!visible) return;
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [visible, setTabBarVisible]);

  // Load persisted recent searches + focus the field every time it opens.
  useEffect(() => {
    if (!visible) return;

    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((item) => typeof item === 'string'));
        }
      })
      .catch(() => { });

    const focusTimeout = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(focusTimeout);
  }, [visible]);

  const fetchStatsForList = useCallback(async (list: Manga[]) => {
    const ids = list.map((m) => m.id).filter((id) => UUID_REGEX.test(id));
    if (ids.length === 0) return;
    try {
      const stats = await getBatchMangaStatistics(ids);
      setStatsMap((prev) => ({ ...prev, ...stats }));
    } catch {
      // Stats are a best-effort enhancement — ignore failures.
    }
  }, []);

  const runSearch = useCallback(
    async (term: string) => {
      const q = term.trim();
      const requestId = ++requestIdRef.current;

      if (!q) {
        resultsQueryRef.current = '';
        pendingQueryRef.current = null;
        setGroups([]);
        setIsSearching(false);
        return;
      }

      pendingQueryRef.current = q;
      // A fresh query invalidates the previous cached result set.
      resultsQueryRef.current = '';
      setIsSearching(true);
      setGroups([]);

      try {
        // Render each source's carousel as soon as that source responds instead
        // of waiting for the slowest extension.
        await SourceManager.searchAllProgressive(q, ({ source, results }) => {
          if (requestId !== requestIdRef.current) return;

          // One group per source, duplicate manga ids dropped.
          const seenMangaIds = new Set<string>();
          const mangaList: Manga[] = [];
          const coverMap: Record<string, SourceCoverInfo> = {};
          for (const sm of results || []) {
            const manga = sourceMangaToAppManga(sm);
            if (!manga?.id || seenMangaIds.has(manga.id)) continue;
            seenMangaIds.add(manga.id);
            mangaList.push(manga);
            coverMap[manga.id] = resolveCoverInfo(sm);
          }
          if (mangaList.length === 0) return;

          setGroups((prev) =>
            prev.some((group) => group.source.id === source.id)
              ? prev
              : [...prev, { source, mangaList, coverMap }]
          );
          fetchStatsForList(mangaList);
        });

        if (requestId !== requestIdRef.current) return;
        resultsQueryRef.current = q;
      } catch {
        if (requestId === requestIdRef.current) {
          // Keep whatever sources already delivered their results.
        }
      } finally {
        if (pendingQueryRef.current === q) pendingQueryRef.current = null;
        if (requestId === requestIdRef.current) setIsSearching(false);
      }
    },
    [fetchStatsForList]
  );

  // Restore the previous query when the sheet is reopened from a source
  // catalog, but only refetch if those results are not already cached.
  useEffect(() => {
    if (!visible) return;
    const q = (initialQuery ?? '').trim();
    if (!q) return;
    if (resultsQueryRef.current === q) return;
    if (pendingQueryRef.current === q) return;

    setQuery(q);
    runSearch(q);
  }, [visible, initialQuery, runSearch]);

  // Debounced live search.
  useEffect(() => {
    if (!visible) return;

    const q = query.trim();
    if (!q) {
      requestIdRef.current++;
      resultsQueryRef.current = '';
      pendingQueryRef.current = null;
      setGroups([]);
      setIsSearching(false);
      return;
    }

    // Results for this exact query are already cached (e.g. the user went to
    // the source catalog and came back) — keep them, no skeleton flash.
    if (resultsQueryRef.current === q || pendingQueryRef.current === q) return;

    const timeout = setTimeout(() => runSearch(q), 450);
    return () => clearTimeout(timeout);
  }, [query, visible, runSearch]);

  // Keep cached results when the sheet closes so returning from the catalog is
  // instant; only in-flight state is invalidated.
  useEffect(() => {
    if (visible) return;
    setIsSearching(false);
    pendingQueryRef.current = null;
    requestIdRef.current++;
  }, [visible]);

  const persistRecentSearches = useCallback((list: string[]) => {
    setRecentSearches(list);
    AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list)).catch(() => { });
  }, []);

  const addRecentSearch = useCallback(
    (term: string) => {
      const clean = term.trim();
      if (!clean) return;
      setRecentSearches((prev) => {
        const next = [
          clean,
          ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
        ].slice(0, MAX_RECENT_SEARCHES);
        AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => { });
        return next;
      });
    },
    []
  );

  const removeRecentSearch = useCallback(
    (term: string) => {
      persistRecentSearches(recentSearches.filter((item) => item !== term));
    },
    [persistRecentSearches, recentSearches]
  );

  const clearRecentSearches = useCallback(() => {
    triggerHaptic();
    persistRecentSearches([]);
  }, [persistRecentSearches]);

  const handleSubmit = useCallback(() => {
    const term = query.trim();
    if (!term) return;
    triggerHaptic();
    addRecentSearch(term);
    Keyboard.dismiss();
    runSearch(term);
  }, [addRecentSearch, query, runSearch]);

  const handleQuickSearch = useCallback(
    (term: string) => {
      triggerHaptic();
      setQuery(term);
      addRecentSearch(term);
      runSearch(term);
    },
    [addRecentSearch, runSearch]
  );

  const handleSelect = useCallback(
    (id: string) => {
      Keyboard.dismiss();
      onSelectManga(id);
    },
    [onSelectManga]
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [onClose, slideAnim]);

  const renderRating = (manga: Manga) => {
    const stat = statsMap[manga.id];
    return stat?.rating?.bayesian || stat?.rating?.average || null;
  };

  const renderSearchSkeleton = () => (
    <View style={styles.skeletonStack}>
      {Array.from({ length: 3 }).map((_, rowIndex) => (
        <View key={rowIndex} style={styles.skeletonRow}>
          <Skeleton width={140} height={16} borderRadius={Radius.xs} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
          >
            {Array.from({ length: 4 }).map((_, cardIndex) => (
              <View key={cardIndex} style={{ width: 124 }}>
                <Skeleton width={124} height={178} borderRadius={Radius.md} />
                <View style={styles.skeletonCardMeta}>
                  <Skeleton width={112} height={12} borderRadius={Radius.xs} />
                  <Skeleton width={80} height={12} borderRadius={Radius.xs} />
                  <Skeleton width={50} height={10} borderRadius={Radius.xs} />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );

  const renderRecentSearches = () => {
    if (recentSearches.length === 0) {
      return (
        <View style={styles.hintState}>
          <Ionicons name="search-outline" size={38} color={colors.textMuted} />
          <Text style={[styles.hintTitle, { color: colors.text }]}>Search every extension</Text>
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            Type a title to search across all of your installed sources at once.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.recentsSection}>
        <View style={styles.recentsHeader}>
          <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>Recent searches</Text>
          <Pressable onPress={clearRecentSearches} hitSlop={8}>
            <Text style={[styles.clearText, { color: colors.accent }]}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.pillWrap}>
          {recentSearches.map((term) => (
            <Pressable
              key={term}
              onPress={() => handleQuickSearch(term)}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: colors.surfaceElevated },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Search ${term}`}
            >
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.pillText, { color: colors.text }]} numberOfLines={1}>
                {term}
              </Text>
              <Pressable
                onPress={() => removeRecentSearch(term)}
                hitSlop={8}
                accessibilityLabel={`Remove ${term} from recent searches`}
              >
                <Ionicons name="close" size={13} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  const renderResults = () => {
    // Only show skeletons while nothing has arrived yet; afterwards each
    // source's carousel fills in as its search completes.
    if (isSearching && groups.length === 0) return renderSearchSkeleton();

    if (groups.length === 0) {
      return (
        <View style={styles.hintState}>
          <Ionicons name="search-outline" size={38} color={colors.textMuted} />
          <Text style={[styles.hintTitle, { color: colors.text }]}>No results</Text>
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            No titles matched "{query.trim()}" across your installed extensions.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.groupStack}>
        {groups.map((group) => (
          <View key={group.source.id} style={styles.carouselSection}>
            <View style={styles.carouselHeaderRow}>
              <View style={styles.carouselTitleWrap}>
                <Text style={[styles.carouselTitle, { color: colors.text }]} numberOfLines={1}>
                  {group.source.name}
                </Text>
                <Text style={[styles.carouselCount, { color: colors.textMuted }]}>
                  ({group.mangaList.length})
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  // The catalog opens over this sheet; drop the keyboard so it
                  // does not float above the incoming catalog.
                  Keyboard.dismiss();
                  onViewAll(group.source, query.trim());
                }}
                style={({ pressed }) => [
                  styles.carouselArrowBtn,
                  pressed && { opacity: 0.6 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`See all results from ${group.source.name}`}
              >
                <Ionicons name="arrow-forward" size={22} color={colors.accent} />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {group.mangaList.map((manga, index) => {
                const stat = statsMap[manga.id];
                const cover = group.coverMap[manga.id];
                return (
                  <MangaCard
                    key={manga.id}
                    id={manga.id}
                    index={index}
                    width={124}
                    title={getMangaTitle(manga)}
                    coverUrl={cover?.url ?? null}
                    coverHeaders={cover?.headers}
                    author={extractAuthorName(manga)}
                    rating={renderRating(manga)}
                    follows={stat?.follows ?? null}
                    onPress={handleSelect}
                  />
                );
              })}
            </ScrollView>
          </View>
        ))}

        {isSearching && (
          <View style={styles.searchingMoreRow}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Text style={[styles.searchingMoreText, { color: colors.textMuted }]}>
              Searching more sources…
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (!isDisplayed) return null;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.xs,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close search"
        >
          <Ionicons name="arrow-back" size={28} color={colors.text} />
        </Pressable>

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search a manga or manhwa..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={colors.accent}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentScroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {query.trim().length === 0 ? renderRecentSearches() : renderResults()}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 46,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 16,
  },
  contentScroll: {
    paddingBottom: Spacing['3xl'],
  },

  /* Recent searches */
  recentsSection: {
    paddingTop: Spacing.md,
  },
  recentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionEyebrow: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clearText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  pillText: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
    flexShrink: 1,
  },

  /* Hint / empty states */
  hintState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['3xl'],
  },
  hintTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.sm,
  },
  hintText: {
    fontSize: Typography.sizes.body,
    lineHeight: 20,
    textAlign: 'center',
  },

  /* Result carousels */
  groupStack: {
    gap: Spacing.xl,
    paddingTop: Spacing.md,
  },
  searchingMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
  },
  searchingMoreText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  carouselSection: {
    gap: Spacing.sm,
  },
  carouselHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  carouselTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  carouselTitle: {
    fontSize: 16,
    fontWeight: Typography.weights.bold,
    flexShrink: 1,
  },
  carouselCount: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  carouselArrowBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselContent: {
    paddingHorizontal: Spacing.md,
    gap: CARD_GAP,
  },

  /* Skeleton loading */
  skeletonStack: {
    gap: Spacing.xl,
    paddingTop: Spacing.md,
  },
  skeletonRow: {
    gap: Spacing.sm,
  },
  skeletonCardMeta: {
    marginTop: 8,
    gap: 5,
  },
});
