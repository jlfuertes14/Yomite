/**
 * Discover Screen — Edge-to-Edge Layout with Embedded Left Navigation Sidebar
 * Features: Embedded Left Navigation Column (Non-Modal), MangaDex Filter Modal,
 * Popular New Titles Hero Banner, Latest Updates, Recently Added, Random Manga.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import {
  extractArtistName,
  extractAuthorName,
  extractCoverFileName,
  getBatchMangaStatistics,
  getCoverUrl,
  getLatestUpdates,
  getMangaDescription,
  getMangaTitle,
  getPopularManga,
  getRandomManga,
  getRecentlyAdded,
  MangaStatistics,
  searchManga,
} from '../../src/api/mangadex';
import { AdvancedSearchModal } from '../../src/components/AdvancedSearchModal';
import { CARD_GAP, MangaCard } from '../../src/components/MangaCard';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { Skeleton } from '../../src/components/Skeleton';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { OfflineState } from '../../src/components/OfflineState';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { formatChapterDate } from '../../src/utils/date';
import type { Manga, SearchFilters } from '../../src/types';

type VectorIcon = React.ComponentProps<typeof Ionicons>['name'];

interface SidebarNavItem {
  id: string;
  label: string;
  icon: VectorIcon;
  action: () => void;
  badge?: string;
}

const PAGE_SIZE = 24;
const POPULAR_TOP_LIMIT = 10;

export default function DiscoverScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { isOffline } = useNetworkStatus();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Responsive Layout Constants
  const sidebarWidth = isDesktop ? 260 : 0;

  // Data states
  const [popular, setPopular] = useState<Manga[]>([]);
  const [feedManga, setFeedManga] = useState<Manga[]>([]);
  const [mangaStatsMap, setMangaStatsMap] = useState<Record<string, MangaStatistics>>({});
  const [totalMangaCount, setTotalMangaCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Navigation Feed States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Manga[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFeedTitle, setActiveFeedTitle] = useState('Recently Added');
  const [activeNavId, setActiveNavId] = useState('recently_added');

  // Retractable Sidebar states
  const [sidebarVisible, setSidebarVisible] = useState(false); // Inline desktop sidebar
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false); // Mobile slide modal drawer
  const [advancedSearchVisible, setAdvancedSearchVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilters | null>(null);

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

  const fetchStatsForList = async (list: Manga[]) => {
    if (!list || list.length === 0) return;
    const ids = list.map((m) => m.id);
    const stats = await getBatchMangaStatistics(ids);
    setMangaStatsMap((prev) => ({ ...prev, ...stats }));
  };

  // Toggle menu handler (Mobile = Modal Slide Drawer, Desktop = Embedded Inline Sidebar)
  const handleToggleMenu = () => {
    if (isDesktop) {
      setSidebarVisible(!sidebarVisible);
    } else {
      setMobileDrawerVisible(true);
    }
  };

  // Smooth Retractable Sidebar Animation (emil-design-eng cubic-bezier curve)
  const sidebarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: isDesktop && sidebarVisible ? 1 : 0,
      duration: 300,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: false,
    }).start();
  }, [sidebarVisible, isDesktop, sidebarAnim]);

  const animatedSidebarWidth = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 260],
  });

  const animatedSidebarOpacity = sidebarAnim.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.3, 1],
  });

  // Hero carousel active index
  const [heroIndex, setHeroIndex] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setIsLoadingPopular(true);
      setIsLoadingFeed(true);
      setCurrentPage(1);
      const [pop, feedResult] = await Promise.all([
        getPopularManga(POPULAR_TOP_LIMIT),
        getRecentlyAdded(24, 0),
      ]);
      setPopular(pop);
      setFeedManga(feedResult.data);
      setTotalMangaCount(feedResult.total);
      setActiveFeedTitle('Recently Added');
      setActiveNavId('recently_added');
      fetchStatsForList([...pop, ...feedResult.data]);
    } catch (err) {
      console.error('Failed to fetch discover data:', err);
    } finally {
      setIsLoadingPopular(false);
      setIsLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-advance hero banner every 7 seconds
  useEffect(() => {
    if (popular.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % popular.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [popular.length]);

  const isShowingSearch = searchQuery.trim().length > 0 || activeFilters !== null;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    const feedRequest =
      activeNavId === 'latest'
        ? getLatestUpdates(PAGE_SIZE, 0, true)
        : getRecentlyAdded(PAGE_SIZE, 0, true);
    const [pop, feedResult] = await Promise.all([
      getPopularManga(POPULAR_TOP_LIMIT, true),
      feedRequest,
    ]);
    setPopular(pop);
    if (!isShowingSearch && activeNavId === 'popular') {
      setTotalMangaCount(pop.length);
      fetchStatsForList(pop);
    } else {
      setFeedManga(feedResult.data);
      setTotalMangaCount(feedResult.total);
      fetchStatsForList([...pop, ...feedResult.data]);
    }
    setRefreshing(false);
  }, [activeNavId, isShowingSearch]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      if (activeFilters === null) {
        setSearchResults([]);
      }
      return;
    }
    try {
      setIsSearching(true);
      setCurrentPage(1);
      setActiveFeedTitle('Search Results');
      const result = await searchManga({ title: searchQuery.trim() }, PAGE_SIZE, 0);
      setSearchResults(result.data);
      setTotalMangaCount(result.total);
      fetchStatsForList(result.data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, activeFilters]);

  useEffect(() => {
    const timeout = setTimeout(handleSearch, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, handleSearch]);

  const handleApplyAdvancedSearch = async (filters: SearchFilters) => {
    try {
      setIsSearching(true);
      setCurrentPage(1);
      setActiveFilters(filters);
      setActiveFeedTitle('Search Results');
      setActiveNavId('advanced_search');
      setSidebarVisible(false);
      const result = await searchManga(filters, PAGE_SIZE, 0);
      setSearchResults(result.data);
      setTotalMangaCount(result.total);
      fetchStatsForList(result.data);
    } catch (err) {
      setConfirmModalConfig({
        visible: true,
        title: 'Search Failed',
        message: 'Failed to execute search. Please check your internet connection and try again.',
        iconName: 'search-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearchState = () => {
    setActiveFilters(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleClearAdvancedSearch = () => {
    clearSearchState();
    setActiveFeedTitle('Recently Added');
    setActiveNavId('recently_added');
  };

  // Sidebar Actions
  const handleSelectPopular = () => {
    clearSearchState();
    setCurrentPage(1);
    setActiveFeedTitle('Popular New Titles');
    setActiveNavId('popular');
    setSidebarVisible(false);
    setMobileDrawerVisible(false);
    setTotalMangaCount(popular.length);
    fetchStatsForList(popular);
  };

  const handleSelectLatest = async () => {
    try {
      setIsLoadingFeed(true);
      setCurrentPage(1);
      clearSearchState();
      setActiveFeedTitle('Latest Updates');
      setActiveNavId('latest');
      setSidebarVisible(false);
      setMobileDrawerVisible(false);
      const result = await getLatestUpdates(PAGE_SIZE, 0);
      setFeedManga(result.data);
      setTotalMangaCount(result.total);
      fetchStatsForList(result.data);
    } catch (err) {
      console.error('Failed to load latest updates:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const handleSelectRecentlyAdded = async () => {
    try {
      setIsLoadingFeed(true);
      setCurrentPage(1);
      clearSearchState();
      setActiveFeedTitle('Recently Added');
      setActiveNavId('recently_added');
      setSidebarVisible(false);
      setMobileDrawerVisible(false);
      const result = await getRecentlyAdded(PAGE_SIZE, 0);
      setFeedManga(result.data);
      setTotalMangaCount(result.total);
      fetchStatsForList(result.data);
    } catch (err) {
      console.error('Failed to load recently added:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  // Page Change Handlers
  const handlePageChange = async (newPage: number) => {
    try {
      const offset = (newPage - 1) * PAGE_SIZE;
      setCurrentPage(newPage);

      if (searchResults.length > 0 || activeFilters || searchQuery.trim()) {
        setIsSearching(true);
        const filters: SearchFilters = activeFilters ?? (searchQuery.trim() ? { title: searchQuery.trim() } : {});
        const result = await searchManga(filters, PAGE_SIZE, offset);
        setSearchResults(result.data);
        setTotalMangaCount(result.total);
        fetchStatsForList(result.data);
        setIsSearching(false);
      } else {
        setIsLoadingFeed(true);
        let result: { data: Manga[]; total: number };
        if (activeNavId === 'latest') {
          result = await getLatestUpdates(PAGE_SIZE, offset);
        } else {
          result = await getRecentlyAdded(PAGE_SIZE, offset);
        }
        setFeedManga(result.data);
        setTotalMangaCount(result.total);
        fetchStatsForList(result.data);
        setIsLoadingFeed(false);
      }
    } catch (err) {
      console.error('Page change failed:', err);
    }
  };

  const handleSelectRandom = async () => {
    try {
      setActiveNavId('random');
      setSidebarVisible(false);
      const randomManga = await getRandomManga();
      if (randomManga?.id) {
        router.push(`/manga/${randomManga.id}` as any);
      }
    } catch (err) {
      setConfirmModalConfig({
        visible: true,
        title: 'Random Selection Failed',
        message: 'Failed to fetch a random title from MangaDex. Please try again.',
        iconName: 'dice-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  };

  const navigateToManga = useCallback(
    (mangaId: string) => {
      router.push(`/manga/${mangaId}` as any);
    },
    [router]
  );

  const getMangaCover = (manga: Manga): string | null => {
    const fileName = extractCoverFileName(manga);
    return getCoverUrl(manga.id, fileName, '512');
  };

  const nextHero = useCallback(() => {
    if (popular.length === 0) return;
    setHeroIndex((prev) => (prev + 1) % popular.length);
  }, [popular.length]);

  const prevHero = useCallback(() => {
    if (popular.length === 0) return;
    setHeroIndex((prev) => (prev - 1 + popular.length) % popular.length);
  }, [popular.length]);

  const currentHeroManga = popular[heroIndex] ?? null;

  const navItems: SidebarNavItem[] = [
    {
      id: 'advanced_search',
      label: 'Advanced Search',
      icon: 'options-outline',
      action: () => {
        setSidebarVisible(false);
        setAdvancedSearchVisible(true);
      },
      badge: 'Filter',
    },
    {
      id: 'popular',
      label: 'Popular New Titles',
      icon: 'sparkles-outline',
      action: handleSelectPopular,
    },
    {
      id: 'latest',
      label: 'Latest Updates',
      icon: 'time-outline',
      action: handleSelectLatest,
    },
    {
      id: 'recently_added',
      label: 'Recently Added',
      icon: 'add-circle-outline',
      action: handleSelectRecentlyAdded,
    },
    {
      id: 'random',
      label: 'Random Manga',
      icon: 'dice-outline',
      action: handleSelectRandom,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.layoutRow}>
        {/* ─── RETRACTABLE EMBEDDED LEFT SIDEBAR (SMOOTH ANIMATION) ─── */}
        <Animated.View
          style={[
            styles.embeddedSidebar,
            {
              width: animatedSidebarWidth,
              opacity: animatedSidebarOpacity,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              overflow: 'hidden',
            },
          ]}
        >
          <View style={styles.sidebarInnerContainer}>
            {/* Sidebar Brand Header */}
            <View style={styles.sidebarHeader}>
              <View style={styles.brandRow}>
                <View style={[styles.mascotAvatar, { borderColor: colors.border }]}>
                  <Image
                    source={require('../../assets/images/mascot.png')}
                    style={styles.mascotImage}
                    contentFit="cover"
                  />
                </View>
                <Text style={[styles.brandTitle, { color: colors.text }]}>Yomite</Text>
              </View>
              <Pressable onPress={() => setSidebarVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Navigation List */}
            <ScrollView contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
                DISCOVER & NAVIGATION
              </Text>

              {navItems.map((item) => {
                const isActive = activeNavId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={item.action}
                    style={({ pressed }) => [
                      styles.navItemRow,
                      {
                        backgroundColor: isActive ? colors.surfaceElevated : 'transparent',
                        borderColor: isActive ? colors.accent : 'transparent',
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isActive ? colors.accent : colors.text}
                    />
                    <Text
                      style={[
                        styles.navItemLabel,
                        { color: isActive ? colors.accent : colors.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.badge && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: colors.accentSubtle, borderColor: colors.accent },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: colors.accent }]}>
                          {item.badge}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Sidebar Footer */}
            <View style={[styles.sidebarFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                Yomite v1.0.0 · MangaDex v5
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ─── MAIN RIGHT CONTENT COLUMN ─── */}
        <View style={styles.mainContentColumn}>
          {/* Top Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable
                onPress={handleToggleMenu}
                style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
                hitSlop={8}
              >
                <Ionicons name="menu" size={26} color={colors.text} />
              </Pressable>
              <Text style={[styles.appTitle, { color: colors.text }]}>Discover</Text>
            </View>

            <View style={styles.headerRight}>
              <Pressable
                onPress={() => setAdvancedSearchVisible(true)}
                style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
                hitSlop={8}
              >
                <Ionicons name="options-outline" size={24} color={colors.accent} />
              </Pressable>
            </View>
          </View>

          {/* Search Input Bar */}
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search titles, authors..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Active Filter Pill Badge */}
          {activeFilters !== null && (
            <View style={styles.activeFilterRow}>
              <View style={[styles.activeFilterPill, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}>
                <Ionicons name="options" size={12} color={colors.accent} />
                <Text style={[styles.activeFilterText, { color: colors.accent }]}>
                  Advanced Filters Active
                </Text>
                <Pressable onPress={handleClearAdvancedSearch}>
                  <Ionicons name="close" size={14} color={colors.accent} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Compact Offline Notification Banner when device is offline */}
          {isOffline && <OfflineState compact />}

          {isOffline && feedManga.length === 0 ? (
            <OfflineState onRetry={handleRefresh} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.accent}
                />
              }
            >
            {isShowingSearch ? (
              /* ─── Search Results ─── */
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Search Results</Text>
                </View>
                {isSearching ? (
                  <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
                ) : searchResults.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                      No titles match your search filters
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.mangaGrid}>
                      {searchResults.map((manga, idx) => {
                        const stat = mangaStatsMap[manga.id];
                        const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                        return (
                          <MangaCard
                            key={manga.id}
                            id={manga.id}
                            index={idx}
                            title={getMangaTitle(manga)}
                            coverUrl={getMangaCover(manga)}
                            author={extractAuthorName(manga)}
                            rating={ratingVal}
                            follows={stat?.follows ?? null}
                            onPress={navigateToManga}
                          />
                        );
                      })}
                    </View>

                    {/* Search Results Pagination */}
                    {searchResults.length > 0 && totalMangaCount > PAGE_SIZE && (
                      <View style={styles.paginationRow}>
                        <Pressable
                          disabled={currentPage <= 1 || isSearching}
                          onPress={() => handlePageChange(currentPage - 1)}
                          style={({ pressed }) => [
                            styles.pageBtn,
                            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                            (currentPage <= 1 || isSearching) && { opacity: 0.3 },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Ionicons name="chevron-back" size={16} color={colors.text} />
                          <Text style={[styles.pageBtnText, { color: colors.text }]}>Prev</Text>
                        </Pressable>

                        <View style={styles.pageIndicatorPill}>
                          <Text style={[styles.pageIndicatorText, { color: colors.text }]}>
                            Page {currentPage} of {Math.ceil(totalMangaCount / PAGE_SIZE)}
                          </Text>
                          <Text style={[styles.pageTotalCountText, { color: colors.textMuted }]}>
                            ({totalMangaCount.toLocaleString()} titles)
                          </Text>
                        </View>

                        <Pressable
                          disabled={currentPage >= Math.ceil(totalMangaCount / PAGE_SIZE) || isSearching}
                          onPress={() => handlePageChange(currentPage + 1)}
                          style={({ pressed }) => [
                            styles.pageBtn,
                            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                            (currentPage >= Math.ceil(totalMangaCount / PAGE_SIZE) || isSearching) && { opacity: 0.3 },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={[styles.pageBtnText, { color: colors.text }]}>Next</Text>
                          <Ionicons name="chevron-forward" size={16} color={colors.text} />
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : activeNavId === 'popular' ? (
              <View style={styles.section}>
                <View style={styles.popularListHeader}>
                  <View style={styles.popularHeaderCopy}>
                    <View style={[styles.popularEyebrowPill, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}>
                      <Ionicons name="sparkles-outline" size={12} color={colors.accent} />
                      <Text style={[styles.popularEyebrowText, { color: colors.accent }]}>Top 10</Text>
                    </View>
                    <Text style={[styles.popularScreenTitle, { color: colors.text }]}>
                      Popular New Titles
                    </Text>
                    <Text style={[styles.popularScreenSubtext, { color: colors.textMuted }]}>
                      Recently-created MangaDex titles ranked by follow count.
                    </Text>
                  </View>
                </View>

                {isLoadingPopular ? (
                  <View style={styles.popularRankList}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} width="100%" height={132} borderRadius={Radius.lg} />
                    ))}
                  </View>
                ) : (
                  <View style={styles.popularRankList}>
                    {popular.slice(0, POPULAR_TOP_LIMIT).map((manga, idx) => {
                      const stat = mangaStatsMap[manga.id];
                      const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                      const tags = manga.attributes.tags.slice(0, 3);
                      return (
                        <Pressable
                          key={manga.id}
                          onPress={() => navigateToManga(manga.id)}
                          style={({ pressed }) => [
                            styles.popularRankCard,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                              opacity: pressed ? 0.82 : 1,
                            },
                          ]}
                        >
                          <View style={styles.popularRankBadge}>
                            <Text style={styles.popularRankNumber}>{String(idx + 1).padStart(2, '0')}</Text>
                          </View>

                          <Image
                            source={{ uri: getMangaCover(manga) ?? undefined }}
                            style={styles.popularRankCover}
                            contentFit="cover"
                            transition={180}
                          />

                          <View style={styles.popularRankBody}>
                            <View style={styles.popularRankTitleRow}>
                              <Text style={[styles.popularRankTitle, { color: colors.text }]} numberOfLines={2}>
                                {getMangaTitle(manga)}
                              </Text>
                              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                            </View>

                            <Text style={[styles.popularRankAuthor, { color: colors.textMuted }]} numberOfLines={1}>
                              {extractAuthorName(manga)}
                            </Text>

                            <View style={styles.popularRankMetaRow}>
                              <View style={[styles.popularMetaPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                                <Ionicons name="people-outline" size={12} color={colors.accent} />
                                <Text style={[styles.popularMetaText, { color: colors.textSecondary }]}>
                                  {stat?.follows != null ? `${stat.follows.toLocaleString()} follows` : 'Follows loading'}
                                </Text>
                              </View>
                              {ratingVal != null && (
                                <View style={[styles.popularMetaPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                                  <Ionicons name="star" size={12} color="#F59E0B" />
                                  <Text style={[styles.popularMetaText, { color: colors.textSecondary }]}>
                                    {ratingVal.toFixed(1)}
                                  </Text>
                                </View>
                              )}
                              <View style={[styles.popularMetaPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                                <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                                <Text style={[styles.popularMetaText, { color: colors.textSecondary }]}>
                                  Added {formatChapterDate(manga.attributes.createdAt)}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.popularTagRow}>
                              {tags.map((tag) => (
                                <View key={tag.id} style={[styles.popularTagPill, { backgroundColor: colors.accentSubtle }]}>
                                  <Text style={[styles.popularTagText, { color: colors.accent }]} numberOfLines={1}>
                                    {tag.attributes.name.en ?? Object.values(tag.attributes.name)[0]}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* ─── MangaDex Popular New Titles Hero Banner ─── */}
                <View style={styles.heroSection}>
                  <Text style={[styles.heroSectionTitle, { color: colors.text }]}>
                    Popular New Titles
                  </Text>

                  {isLoadingPopular || !currentHeroManga ? (
                    <Skeleton width="100%" height={280} borderRadius={Radius.md} />
                  ) : (
                    <Pressable
                      onPress={() => navigateToManga(currentHeroManga.id)}
                      style={[styles.heroBannerFrame, { borderColor: colors.border }]}
                    >
                      {/* Backdrop Cover Image */}
                      {getMangaCover(currentHeroManga) && (
                        <Image
                          source={{ uri: getMangaCover(currentHeroManga)! }}
                          style={styles.heroBackdrop}
                          contentFit="cover"
                        />
                      )}
                      {/* Subtle Dark Gradient Overlay for text contrast */}
                      <LinearGradient
                        colors={['rgba(9,9,11,0.88)', 'rgba(9,9,11,0.45)', 'rgba(9,9,11,0.75)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.heroBackdropGradient}
                      />

                      {/* Banner Content Layout */}
                      <View style={styles.heroContentRow}>
                        {/* Left Cover Image Card */}
                        <View style={styles.heroCoverCard}>
                          <Image
                            source={{ uri: getMangaCover(currentHeroManga) ?? undefined }}
                            style={styles.heroCoverImage}
                            contentFit="cover"
                            transition={200}
                          />
                        </View>

                        {/* Right Meta Info */}
                        <View style={styles.heroMetaCol}>
                          {/* Title */}
                          <Text style={styles.heroTitleText} numberOfLines={2}>
                            {getMangaTitle(currentHeroManga)}
                          </Text>

                          {/* Genre Tag Pills */}
                          <View style={styles.heroTagRow}>
                            {currentHeroManga.attributes.tags.slice(0, 5).map((t) => (
                              <View key={t.id} style={styles.heroTagPill}>
                                <Text style={styles.heroTagText}>
                                  {(t.attributes.name.en ?? Object.values(t.attributes.name)[0]).toUpperCase()}
                                </Text>
                              </View>
                            ))}
                          </View>

                          {/* Synopsis Preview */}
                          <Text style={styles.heroSynopsisText} numberOfLines={3}>
                            {getMangaDescription(currentHeroManga) || 'No description available for this title.'}
                          </Text>

                          {/* Author & Pagination Footer */}
                          <View style={styles.heroFooterRow}>
                            <Text style={styles.heroAuthorText} numberOfLines={1}>
                              {extractAuthorName(currentHeroManga)}
                              {extractArtistName(currentHeroManga) !== extractAuthorName(currentHeroManga)
                                ? `, ${extractArtistName(currentHeroManga)}`
                                : ''}
                            </Text>

                            {/* Pagination Controls */}
                            <View style={styles.heroControls}>
                              <Text style={styles.heroNumberText}>
                                NO. {heroIndex + 1}
                              </Text>
                              <Pressable onPress={prevHero} style={styles.heroArrowBtn}>
                                <Ionicons name="chevron-back" size={16} color="#FAFAFA" />
                              </Pressable>
                              <Pressable onPress={nextHero} style={styles.heroArrowBtn}>
                                <Ionicons name="chevron-forward" size={16} color="#FAFAFA" />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  )}
                </View>

                {/* ─── Dynamic Feed (Latest Updates / Recently Added) ─── */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons
                      name={activeFeedTitle === 'Recently Added' ? 'add-circle-outline' : 'time-outline'}
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {activeFeedTitle}
                    </Text>
                  </View>
                  {isLoadingFeed ? (
                    <View style={styles.mangaGrid}>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <View key={i} style={{ marginBottom: 12 }}>
                          <Skeleton width={110} height={160} borderRadius={Radius.md} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.mangaGrid}>
                      {feedManga.map((manga, idx) => {
                        const stat = mangaStatsMap[manga.id];
                        const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                        return (
                          <MangaCard
                            key={manga.id}
                            id={manga.id}
                            index={idx}
                            title={getMangaTitle(manga)}
                            coverUrl={getMangaCover(manga)}
                            author={extractAuthorName(manga)}
                            rating={ratingVal}
                            follows={stat?.follows ?? null}
                            onPress={navigateToManga}
                          />
                        );
                      })}
                    </View>
                  )}

                  {/* Feed Grid Pagination */}
                  {feedManga.length > 0 && totalMangaCount > PAGE_SIZE && (
                    <View style={styles.paginationRow}>
                      <Pressable
                        disabled={currentPage <= 1 || isLoadingFeed}
                        onPress={() => handlePageChange(currentPage - 1)}
                        style={({ pressed }) => [
                          styles.pageBtn,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                          (currentPage <= 1 || isLoadingFeed) && { opacity: 0.3 },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Ionicons name="chevron-back" size={16} color={colors.text} />
                        <Text style={[styles.pageBtnText, { color: colors.text }]}>Prev</Text>
                      </Pressable>

                      <View style={styles.pageIndicatorPill}>
                        <Text style={[styles.pageIndicatorText, { color: colors.text }]}>
                          Page {currentPage} of {Math.ceil(totalMangaCount / PAGE_SIZE)}
                        </Text>
                        <Text style={[styles.pageTotalCountText, { color: colors.textMuted }]}>
                          ({totalMangaCount.toLocaleString()} titles)
                        </Text>
                      </View>

                      <Pressable
                        disabled={currentPage >= Math.ceil(totalMangaCount / PAGE_SIZE) || isLoadingFeed}
                        onPress={() => handlePageChange(currentPage + 1)}
                        style={({ pressed }) => [
                          styles.pageBtn,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                          (currentPage >= Math.ceil(totalMangaCount / PAGE_SIZE) || isLoadingFeed) && { opacity: 0.3 },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={[styles.pageBtnText, { color: colors.text }]}>Next</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </>
            )}

             <View style={{ height: 60 }} />
           </ScrollView>
           )}
         </View>
      </View>

      {/* Mobile Left Overlay Slide Drawer Modal */}
      <SidebarDrawer
        visible={mobileDrawerVisible}
        onClose={() => setMobileDrawerVisible(false)}
        onSelectAdvancedSearch={() => setAdvancedSearchVisible(true)}
        onSelectLatest={handleSelectLatest}
        onSelectRecentlyAdded={handleSelectRecentlyAdded}
        onSelectRandom={handleSelectRandom}
        onSelectPopular={handleSelectPopular}
      />

      {/* Advanced Search Filter Modal */}
      <AdvancedSearchModal
        visible={advancedSearchVisible}
        onClose={() => setAdvancedSearchVisible(false)}
        onApplyFilters={handleApplyAdvancedSearch}
        onRandomManga={handleSelectRandom}
      />

      {/* Sleek Custom Confirmation Dialog */}
      <ConfirmationModal
        visible={confirmModalConfig.visible}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        iconName={confirmModalConfig.iconName || 'information-circle-outline'}
        confirmVariant={confirmModalConfig.confirmVariant || 'primary'}
        confirmText={confirmModalConfig.confirmText || 'OK'}
        cancelText={confirmModalConfig.cancelText}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  layoutRow: {
    flex: 1,
    flexDirection: 'row',
  },

  /* Embedded Left Sidebar Styles (Non-Modal) */
  embeddedSidebar: {
    borderRightWidth: 1,
  },
  sidebarInnerContainer: {
    width: 260,
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mascotAvatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mascotImage: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 4,
  },
  sidebarContent: {
    gap: Spacing.xs,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  navItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: Spacing.md,
  },
  navItemLabel: {
    flex: 1,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
  },
  sidebarFooter: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: Typography.sizes.caption,
  },

  /* Main Content Column */
  mainContentColumn: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  plainIconButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.body,
    paddingVertical: 0,
  },
  activeFilterRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  activeFilterText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },

  /* Hero Section (MangaDex Popular New Titles) */
  heroSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing['2xl'],
  },
  heroSectionTitle: {
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.md,
  },
  heroBannerFrame: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 250,
  },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.75,
  },
  heroBackdropGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroContentRow: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  heroCoverCard: {
    width: 135,
    height: 200,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  heroCoverImage: {
    width: '100%',
    height: '100%',
  },
  heroMetaCol: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 8,
  },
  heroTitleText: {
    color: '#FAFAFA',
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
    lineHeight: 24,
  },
  heroTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroTagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  heroTagText: {
    color: '#FAFAFA',
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  heroSynopsisText: {
    color: '#D4D4D8',
    fontSize: Typography.sizes.footnote,
    lineHeight: 18,
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  heroAuthorText: {
    color: '#FAFAFA',
    fontSize: Typography.sizes.footnote,
    fontStyle: 'italic',
    fontWeight: Typography.weights.semibold,
    flex: 1,
    marginRight: Spacing.md,
  },
  heroControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroNumberText: {
    color: '#FAFAFA',
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
    marginRight: 4,
  },
  heroArrowBtn: {
    padding: 4,
  },

  /* Grid Section */
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: 6,
  },
  sectionTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  popularListHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  popularHeaderCopy: {
    gap: Spacing.sm,
  },
  popularEyebrowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  popularEyebrowText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  popularScreenTitle: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.4,
  },
  popularScreenSubtext: {
    fontSize: Typography.sizes.body,
    lineHeight: 20,
  },
  popularRankList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  popularRankCard: {
    minHeight: 132,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  popularRankBadge: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularRankNumber: {
    color: '#F43F5E',
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
  },
  popularRankCover: {
    width: 74,
    height: 104,
    borderRadius: Radius.sm,
    backgroundColor: '#1F1F23',
  },
  popularRankBody: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  popularRankTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  popularRankTitle: {
    flex: 1,
    fontSize: Typography.sizes.callout,
    fontWeight: Typography.weights.bold,
    lineHeight: 20,
  },
  popularRankAuthor: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },
  popularRankMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  popularMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  popularMetaText: {
    fontSize: 10,
    fontWeight: Typography.weights.semibold,
  },
  popularTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  popularTagPill: {
    maxWidth: 120,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  popularTagText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  mangaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: CARD_GAP,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.sizes.body,
  },

  /* Pagination Bar */
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.md,
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
});
