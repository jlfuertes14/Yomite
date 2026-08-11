/**
 * Discover Screen — Edge-to-Edge Layout with Embedded Left Navigation Sidebar
 * Features: Embedded Left Navigation Column (Non-Modal), MangaDex Filter Modal,
 * Popular New Titles Hero Banner, Latest Updates, Recently Added, Random Manga.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import {
  getPopularManga,
  getLatestUpdates,
  getRecentlyAdded,
  getRandomManga,
  searchManga,
  getMangaTitle,
  getMangaDescription,
  extractCoverFileName,
  getCoverUrl,
  extractAuthorName,
  extractArtistName,
  getBatchMangaStatistics,
  MangaStatistics,
} from '../../src/api/mangadex';
import { MangaCard, CARD_GAP } from '../../src/components/MangaCard';
import { Skeleton } from '../../src/components/Skeleton';
import { AdvancedSearchModal } from '../../src/components/AdvancedSearchModal';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import type { Manga, SearchFilters } from '../../src/types';

type VectorIcon = React.ComponentProps<typeof Ionicons>['name'];

interface SidebarNavItem {
  id: string;
  label: string;
  icon: VectorIcon;
  action: () => void;
  badge?: string;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const colors = Colors.dark;
  const { width: windowWidth } = useWindowDimensions();

  // Desktop vs Mobile mode breakpoint (768px)
  const isDesktop = windowWidth >= 768;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFeedTitle, setActiveFeedTitle] = useState<'Latest Updates' | 'Recently Added' | 'Search Results'>('Latest Updates');
  const [activeNavId, setActiveNavId] = useState<string>('latest');

  const [popular, setPopular] = useState<Manga[]>([]);
  const [feedManga, setFeedManga] = useState<Manga[]>([]);
  const [searchResults, setSearchResults] = useState<Manga[]>([]);
  const [mangaStatsMap, setMangaStatsMap] = useState<Record<string, MangaStatistics>>({});
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatsForList = async (list: Manga[]) => {
    if (!list || list.length === 0) return;
    const ids = list.map((m) => m.id);
    const stats = await getBatchMangaStatistics(ids);
    setMangaStatsMap((prev) => ({ ...prev, ...stats }));
  };

  // Retractable Sidebar states
  const [sidebarVisible, setSidebarVisible] = useState(false); // Inline desktop sidebar
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false); // Mobile slide modal drawer
  const [advancedSearchVisible, setAdvancedSearchVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilters | null>(null);

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
      const [pop, lat] = await Promise.all([
        getPopularManga(10),
        getLatestUpdates(30),
      ]);
      setPopular(pop);
      setFeedManga(lat);
      setActiveFeedTitle('Latest Updates');
      setActiveNavId('latest');
      fetchStatsForList([...pop, ...lat]);
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      if (activeFilters === null) {
        setSearchResults([]);
      }
      return;
    }
    try {
      setIsSearching(true);
      setActiveFeedTitle('Search Results');
      const result = await searchManga({ title: searchQuery.trim() }, 36);
      setSearchResults(result.data);
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
      setActiveFilters(filters);
      setActiveFeedTitle('Search Results');
      setActiveNavId('advanced_search');
      setSidebarVisible(false);
      const result = await searchManga(filters, 36);
      setSearchResults(result.data);
      fetchStatsForList(result.data);
    } catch (err) {
      Alert.alert('Search Error', 'Failed to execute advanced search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearAdvancedSearch = () => {
    setActiveFilters(null);
    setSearchQuery('');
    setSearchResults([]);
    setActiveFeedTitle('Latest Updates');
    setActiveNavId('latest');
  };

  // Sidebar Actions
  const handleSelectLatest = async () => {
    try {
      setIsLoadingFeed(true);
      setActiveFeedTitle('Latest Updates');
      setActiveNavId('latest');
      setSidebarVisible(false);
      handleClearAdvancedSearch();
      const data = await getLatestUpdates(30);
      setFeedManga(data);
      fetchStatsForList(data);
    } catch (err) {
      console.error('Failed to load latest updates:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const handleSelectRecentlyAdded = async () => {
    try {
      setIsLoadingFeed(true);
      setActiveFeedTitle('Recently Added');
      setActiveNavId('recently_added');
      setSidebarVisible(false);
      handleClearAdvancedSearch();
      const data = await getRecentlyAdded(30);
      setFeedManga(data);
      fetchStatsForList(data);
    } catch (err) {
      console.error('Failed to load recently added:', err);
    } finally {
      setIsLoadingFeed(false);
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
      Alert.alert('Error', 'Failed to fetch a random manga. Please try again.');
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

  const isShowingSearch = searchQuery.trim().length > 0 || activeFilters !== null;
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
      action: () => {
        setActiveNavId('popular');
        setSidebarVisible(false);
      },
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
                style={[styles.menuButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <Ionicons name="menu" size={20} color={colors.text} />
              </Pressable>
              <Text style={[styles.appTitle, { color: colors.text }]}>Discover</Text>
            </View>

            <View style={styles.headerRight}>
              <Pressable
                onPress={() => setAdvancedSearchVisible(true)}
                style={[styles.filterButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <Ionicons name="options-outline" size={16} color={colors.accent} />
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
                  <View style={styles.mangaGrid}>
                    {searchResults.map((manga) => {
                      const stat = mangaStatsMap[manga.id];
                      const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                      return (
                        <MangaCard
                          key={manga.id}
                          id={manga.id}
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
                      {feedManga.map((manga) => {
                        const stat = mangaStatsMap[manga.id];
                        const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                        return (
                          <MangaCard
                            key={manga.id}
                            id={manga.id}
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
                </View>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
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
        onSelectPopular={() => setActiveNavId('popular')}
      />

      {/* Advanced Search Filter Modal */}
      <AdvancedSearchModal
        visible={advancedSearchVisible}
        onClose={() => setAdvancedSearchVisible(false)}
        onApplyFilters={handleApplyAdvancedSearch}
        onRandomManga={handleSelectRandom}
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
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
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
});
