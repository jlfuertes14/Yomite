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
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../../constants/Colors';
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
import { AuthModal } from '../../src/components/AuthModal';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { CARD_GAP, MangaCard } from '../../src/components/MangaCard';
import { OfflineState } from '../../src/components/OfflineState';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { Skeleton } from '../../src/components/Skeleton';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { useUserStore, getUserDisplayName, getUserHandle, getUserAvatarUrl } from '../../src/store/userStore';
import { syncUserDataWithCloud } from '../../src/services/cloudSync';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
import type { Manga, SearchFilters } from '../../src/types';
import { formatChapterDate } from '../../src/utils/date';

type VectorIcon = React.ComponentProps<typeof Ionicons>['name'];

interface SidebarNavItem {
  id: string;
  label: string;
  icon: VectorIcon;
  action: () => void;
  badge?: string;
}

const PAGE_SIZE = 27;
const POPULAR_TOP_LIMIT = 10;

const getMangaStatusColor = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'ongoing':
      return '#22C55E';
    case 'completed':
      return '#3B82F6';
    case 'hiatus':
      return '#F97316';
    case 'cancelled':
      return '#EF4444';
    default:
      return '#A1A1AA';
  }
};

const formatCompactNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
  return num.toLocaleString();
};

const getMangaCover = (manga: Manga): string | null => {
  const fileName = extractCoverFileName(manga);
  if (!fileName) return null;
  return getCoverUrl(manga.id, fileName, '256');
};

interface WebHeaderProps {
  webHeaderContainerRef: React.RefObject<any>;
  handleToggleMenu: () => void;
  searchInputRef: React.RefObject<TextInput | null>;
  searchBarWidthAnim: Animated.Value;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearchFocus: () => void;
  handleSearchBlur: () => void;
  handleSearchSubmit: () => void;
  isWebDropdownVisible: boolean;
  setIsWebDropdownVisible: (v: boolean) => void;
  contractSearchBar: () => void;
  setAdvancedSearchVisible: (v: boolean) => void;
  setActiveNavId: (id: string) => void;
  isSearching: boolean;
  searchResults: Manga[];
  mangaStatsMap: Record<string, any>;
  navigateToManga: (id: string) => void;
  setSearchResults: React.Dispatch<React.SetStateAction<Manga[]>>;
  colors: any;
  isShowingSearch: boolean;
  activeNavId: string;
  isScrolled: boolean;
  onResetToDiscover?: () => void;
  onOpenAuth: () => void;
}

const WebHeader: React.FC<WebHeaderProps> = ({
  webHeaderContainerRef,
  handleToggleMenu,
  searchInputRef,
  searchBarWidthAnim,
  searchQuery,
  setSearchQuery,
  handleSearchFocus,
  handleSearchBlur,
  handleSearchSubmit,
  isWebDropdownVisible,
  setIsWebDropdownVisible,
  contractSearchBar,
  setAdvancedSearchVisible,
  setActiveNavId,
  isSearching,
  searchResults,
  mangaStatsMap,
  navigateToManga,
  setSearchResults,
  colors,
  isShowingSearch,
  activeNavId,
  isScrolled,
  onResetToDiscover,
  onOpenAuth,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  const isHeroActive = !isShowingSearch && activeNavId !== 'popular';
  const isTransparentAtTop = isHeroActive && !isScrolled;

  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const [profileDropdownVisible, setProfileDropdownVisible] = useState(false);
  const [isSyncingHeader, setIsSyncingHeader] = useState(false);

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleBrandClick = () => {
    if (onResetToDiscover) {
      onResetToDiscover();
    } else {
      setActiveNavId('recently_added');
      setSearchQuery('');
      setIsWebDropdownVisible(false);
      contractSearchBar();
      setSearchResults([]);
    }
  };

  const onFocusHandler = () => {
    setIsSearchFocused(true);
    handleSearchFocus();
  };

  const onBlurHandler = () => {
    setIsSearchFocused(false);
    handleSearchBlur();
  };
  const headerTextColor = isTransparentAtTop ? '#FAFAFA' : colors.text;

  return (
    <>
      {/* Full-screen Dark Dim Spotlight Backdrop when search expander is active */}
      {Platform.OS === 'web' && isWebDropdownVisible && (
        <Pressable
          onPress={() => {
            setIsWebDropdownVisible(false);
            if (searchQuery.trim().length === 0) {
              contractSearchBar();
            }
          }}
          style={styles.webSearchDimBackdrop}
        />
      )}

      <View
        ref={webHeaderContainerRef}
        style={[
          styles.webHeroTopContainer,
          {
            pointerEvents: 'auto',
            position: Platform.OS === 'web' ? ('sticky' as any) : 'relative',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            marginBottom: isHeroActive ? -68 : 0,
            backgroundColor: isTransparentAtTop ? 'transparent' : colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: isTransparentAtTop ? 'transparent' : colors.border,
            ...(Platform.OS === 'web'
              ? ({
                  transition:
                    'background-color 0.25s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.25s cubic-bezier(0.23, 1, 0.32, 1), margin-bottom 0.2s ease',
                } as any)
              : {}),
          },
        ]}
      >
        <View
          style={[
            styles.webHeaderRow,
            styles.webCenteredContent,
            isMobile && { paddingHorizontal: 12, gap: 8 },
          ]}
        >
          {/* Left Group: Menu + Mascot Logo + Brand Title */}
          <View style={[styles.webHeaderLeft, isMobile && { gap: 8 }]}>
            <Pressable
              onPress={handleToggleMenu}
              style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={8}
            >
              <Ionicons name="menu" size={isMobile ? 24 : 26} color={headerTextColor} />
            </Pressable>

            <Pressable
              onPress={handleBrandClick}
              style={({ pressed }) => [
                styles.webBrandGroup,
                { opacity: pressed ? 0.7 : 1, cursor: 'pointer' as any },
                isMobile && { gap: 6 },
              ]}
              hitSlop={8}
            >
              <Image
                source={require('../../assets/images/mascot.png')}
                style={[styles.webHeaderMascot, isMobile && { width: 26, height: 26 }]}
                contentFit="contain"
              />
              {(!isMobile || windowWidth >= 370) && (
                <Text style={[styles.webBrandTitle, { color: headerTextColor }, isMobile && { fontSize: 18 }]}>
                  Yomite
                </Text>
              )}
            </Pressable>
          </View>

          {/* Right Group: Inline Search Bar Pill + Filter + (Get App) + Profile */}
          <View style={[styles.webHeaderRight, isMobile && { gap: 6, flex: 1, justifyContent: 'flex-end' }]}>
            <Animated.View
              style={[
                { position: 'relative', zIndex: 100 },
                Platform.OS === 'web' &&
                  (isMobile
                    ? { flex: 1, minWidth: 90, maxWidth: isSearchFocused ? 280 : 160 }
                    : { width: searchBarWidthAnim }),
              ]}
            >
              <View
                style={[
                  styles.webSearchPill,
                  isMobile && { height: 34, paddingHorizontal: 8, gap: 4 },
                  {
                    borderColor: isSearchFocused
                      ? (colors.accent || '#8B5CF6')
                      : 'rgba(255, 255, 255, 0.14)',
                    ...(Platform.OS === 'web'
                      ? ({
                          boxShadow: isSearchFocused
                            ? `0 0 0 2px ${colors.accent || '#8B5CF6'}50`
                            : 'none',
                          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                        } as any)
                      : {}),
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={isMobile ? 15 : 16}
                  color={isSearchFocused ? (colors.accent || '#8B5CF6') : 'rgba(255,255,255,0.55)'}
                  style={{ marginRight: 2 }}
                />
                <TextInput
                  ref={searchInputRef as any}
                  style={[
                    styles.webSearchInput,
                    isMobile && { fontSize: 12 },
                    Platform.OS === 'web' && ({ outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any),
                  ]}
                  placeholder={isMobile ? 'Search...' : 'Search'}
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setIsWebDropdownVisible(true);
                    if (text.trim().length > 0) {
                      onFocusHandler();
                    }
                  }}
                  onFocus={onFocusHandler}
                  onBlur={onBlurHandler}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      setSearchQuery('');
                      contractSearchBar();
                      setIsWebDropdownVisible(false);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                ) : !isMobile ? (
                  <View style={styles.webSearchRightGroup}>
                    <View style={styles.kbdBadge}>
                      <Text style={styles.kbdText}>Ctrl</Text>
                    </View>
                    <View style={styles.kbdBadge}>
                      <Text style={styles.kbdText}>K</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Web Live Search Modal / Dropdown Card Overlay (Matched & Aligned 100% with Search Bar) */}
              {isWebDropdownVisible && (
                <View
                  style={[
                    styles.webDropdownOverlayContainer,
                    isMobile && {
                      left: undefined,
                      right: -48,
                      width: Math.min(windowWidth - 24, 380),
                      maxHeight: 380,
                    },
                  ]}
                >
                  {searchQuery.trim().length === 0 ? (
                    /* Initial search query helper prompt when empty */
                    <View style={styles.webDropdownEmptyPrompt}>
                      <Text style={styles.webDropdownEmptyPromptText}>
                        Enter a manga name or search query...
                      </Text>
                    </View>
                  ) : (
                    <>
                      {/* Dropdown Header Row */}
                      <View style={styles.webDropdownHeaderRow}>
                        <Text style={styles.webDropdownHeaderTitle}>Manga</Text>
                        <Pressable
                          onPress={handleSearchSubmit}
                          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                        >
                          <Ionicons name="arrow-forward" size={18} color="#FAFAFA" />
                        </Pressable>
                      </View>

                      {/* Dropdown Live Results List */}
                      {isSearching ? (
                        <View style={styles.webDropdownLoading}>
                          <ActivityIndicator size="small" color={colors.accent || '#8B5CF6'} />
                        </View>
                      ) : searchResults.length === 0 ? (
                        <View style={styles.webDropdownEmpty}>
                          <Ionicons name="search-outline" size={24} color="rgba(255, 255, 255, 0.4)" />
                          <Text style={styles.webDropdownEmptyText}>No manga found</Text>
                        </View>
                      ) : (
                        <ScrollView
                          style={styles.webDropdownScroll}
                          showsVerticalScrollIndicator={false}
                          nestedScrollEnabled
                        >
                          <View style={styles.webDropdownList}>
                            {searchResults.slice(0, 5).map((manga) => {
                              const coverUrl = getMangaCover(manga);
                              const title = getMangaTitle(manga);
                              const stats = mangaStatsMap[manga.id];
                              const status = manga.attributes.status;

                              return (
                                <Pressable
                                  key={manga.id}
                                  onPress={() => {
                                    setIsWebDropdownVisible(false);
                                    contractSearchBar();
                                    navigateToManga(manga.id);
                                  }}
                                  style={({ pressed }) => [
                                    styles.webDropdownCardRow,
                                    {
                                      opacity: pressed ? 0.75 : 1,
                                      cursor: 'pointer' as any,
                                    },
                                  ]}
                                >
                                  {coverUrl ? (
                                    <Image
                                      source={{ uri: coverUrl }}
                                      style={styles.webDropdownCover}
                                      contentFit="cover"
                                      transition={150}
                                    />
                                  ) : (
                                    <View style={[styles.webDropdownCover, { justifyContent: 'center', alignItems: 'center' }]}>
                                      <Ionicons name="book-outline" size={20} color="rgba(255,255,255,0.4)" />
                                    </View>
                                  )}

                                  <View style={styles.webDropdownBody}>
                                    <Text style={styles.webDropdownMangaTitle} numberOfLines={2}>
                                      {title}
                                    </Text>
                                    <View style={styles.webDropdownMetaRow}>
                                      {stats?.rating?.bayesian ? (
                                        <View style={styles.webDropdownMetaItem}>
                                          <Ionicons name="star" size={12} color="#F59E0B" />
                                          <Text style={styles.webDropdownMetaText}>
                                            {stats.rating.bayesian.toFixed(2)}
                                          </Text>
                                        </View>
                                      ) : null}
                                      {stats?.follows ? (
                                        <View style={styles.webDropdownMetaItem}>
                                          <Ionicons name="bookmark" size={12} color="rgba(255,255,255,0.6)" />
                                          <Text style={styles.webDropdownMetaText}>
                                            {formatCompactNumber(stats.follows)}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>

                                    {status && (
                                      <View style={styles.webDropdownStatusPill}>
                                        <View
                                          style={[
                                            styles.webStatusDot,
                                            { backgroundColor: getMangaStatusColor(status) },
                                          ]}
                                        />
                                        <Text style={styles.webStatusText}>
                                          {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        </ScrollView>
                      )}
                    </>
                  )}
                </View>
              )}
            </Animated.View>

            <Pressable
              onPress={() => setAdvancedSearchVisible(true)}
              style={({ pressed }) => [
                styles.webFilterBtn,
                isMobile && { width: 34, height: 34, flexShrink: 0 },
                {
                  backgroundColor: isTransparentAtTop ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.06)',
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              hitSlop={8}
            >
              <Ionicons name="options-outline" size={isMobile ? 20 : 22} color={headerTextColor} />
            </Pressable>

            {/* Get Mobile App Web Pill (Hidden on Mobile viewports where space is tight) */}
            {!isMobile && (
              <Pressable
                onPress={() => router.push('/download' as any)}
                style={({ pressed }) => [
                  styles.webGetAppBtn,
                  {
                    backgroundColor: isTransparentAtTop ? 'rgba(255, 255, 255, 0.14)' : colors.accentSubtle,
                    borderColor: isTransparentAtTop ? 'rgba(255, 255, 255, 0.28)' : colors.accent,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="download-outline" size={14} color={isTransparentAtTop ? '#FAFAFA' : colors.accent} />
                <Text
                  style={[
                    styles.webGetAppBtnText,
                    { color: isTransparentAtTop ? '#FAFAFA' : colors.accent },
                  ]}
                >
                  Get App
                </Text>
              </Pressable>
            )}

            {/* Profile Icon Button & Floating Dropdown (Always visible and anchored with flexShrink: 0) */}
            <View style={[styles.webProfileContainer, { flexShrink: 0 }]}>
              <Pressable
                onPress={() => {
                  if (!user) {
                    onOpenAuth();
                  } else {
                    setProfileDropdownVisible((prev) => !prev);
                  }
                }}
                style={({ pressed }) => [
                  styles.webProfileBtn,
                  isMobile && { width: 34, height: 34, borderRadius: 17 },
                  {
                    borderColor: isTransparentAtTop ? 'rgba(255, 255, 255, 0.28)' : colors.border,
                    backgroundColor: isTransparentAtTop ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.06)',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={8}
              >
                {user ? (
                  getUserAvatarUrl(user) ? (
                    <Image
                      source={{ uri: getUserAvatarUrl(user)! }}
                      style={styles.webProfileAvatarImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={[styles.webProfileAvatarText, { color: headerTextColor }]}>
                      {getUserDisplayName(user).charAt(0).toUpperCase()}
                    </Text>
                  )
                ) : (
                  <Ionicons name="person-circle-outline" size={isMobile ? 22 : 24} color={headerTextColor} />
                )}
              </Pressable>

            {/* Profile Dropdown Menu */}
            {profileDropdownVisible && user && (
              <>
                <Pressable
                  style={styles.dropdownBackdrop}
                  onPress={() => setProfileDropdownVisible(false)}
                />
                <View
                  style={[
                    styles.webProfileDropdown,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* User Info Header */}
                  <View style={[styles.dropdownUserHeader, { borderBottomColor: colors.border }]}>
                    <View style={[styles.dropdownAvatarCircle, { backgroundColor: colors.accent, overflow: 'hidden' }]}>
                      {getUserAvatarUrl(user) ? (
                        <Image
                          source={{ uri: getUserAvatarUrl(user)! }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                        />
                      ) : (
                        <Text style={styles.dropdownAvatarText}>
                          {getUserDisplayName(user).charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.dropdownUserName, { color: colors.text }]} numberOfLines={1}>
                        {getUserDisplayName(user)}
                      </Text>
                      <Text style={[styles.dropdownUserHandle, { color: colors.textMuted }]} numberOfLines={1}>
                        @{getUserHandle(user)}
                      </Text>
                      <Text style={[styles.dropdownUserEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                        {user.email}
                      </Text>
                    </View>
                  </View>

                  {/* Menu Links */}
                  <View style={styles.dropdownMenuList}>
                    <Pressable
                      onPress={() => {
                        setProfileDropdownVisible(false);
                        router.push('/profile' as any);
                      }}
                      style={({ pressed }) => [
                        styles.dropdownMenuItem,
                        { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
                      ]}
                    >
                      <Ionicons name="person-outline" size={17} color={colors.accent} />
                      <Text style={[styles.dropdownMenuText, { color: colors.text }]}>My Profile</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setProfileDropdownVisible(false);
                        router.push('/(tabs)/library' as any);
                      }}
                      style={({ pressed }) => [
                        styles.dropdownMenuItem,
                        { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
                      ]}
                    >
                      <Ionicons name="library-outline" size={17} color={colors.textSecondary} />
                      <Text style={[styles.dropdownMenuText, { color: colors.text }]}>My Library</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setProfileDropdownVisible(false);
                        router.push('/(tabs)/history' as any);
                      }}
                      style={({ pressed }) => [
                        styles.dropdownMenuItem,
                        { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
                      ]}
                    >
                      <Ionicons name="time-outline" size={17} color={colors.textSecondary} />
                      <Text style={[styles.dropdownMenuText, { color: colors.text }]}>Reading History</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setProfileDropdownVisible(false);
                        router.push('/(tabs)/settings' as any);
                      }}
                      style={({ pressed }) => [
                        styles.dropdownMenuItem,
                        { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
                      ]}
                    >
                      <Ionicons name="settings-outline" size={17} color={colors.textSecondary} />
                      <Text style={[styles.dropdownMenuText, { color: colors.text }]}>Settings</Text>
                    </Pressable>

                    <Pressable
                      onPress={async () => {
                        if (user?.id) {
                          setIsSyncingHeader(true);
                          await syncUserDataWithCloud(user.id);
                          setIsSyncingHeader(false);
                          setProfileDropdownVisible(false);
                        }
                      }}
                      disabled={isSyncingHeader}
                      style={({ pressed }) => [
                        styles.dropdownMenuItem,
                        { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
                      ]}
                    >
                      {isSyncingHeader ? (
                        <ActivityIndicator size="small" color={colors.emerald} />
                      ) : (
                        <Ionicons name="sync-outline" size={17} color={colors.emerald} />
                      )}
                      <Text style={[styles.dropdownMenuText, { color: colors.text }]}>
                        {isSyncingHeader ? 'Syncing...' : 'Sync with Cloud'}
                      </Text>
                    </Pressable>

                    <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />

                    <Pressable
                      onPress={async () => {
                        setProfileDropdownVisible(false);
                        await signOut();
                      }}
                      style={({ pressed }) => [
                        styles.dropdownMenuItem,
                        { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
                      ]}
                    >
                      <Ionicons name="log-out-outline" size={17} color={colors.accent} />
                      <Text style={[styles.dropdownMenuText, { color: colors.accent, fontWeight: 'bold' }]}>
                        Sign Out
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  </>
);
};

export default function DiscoverScreen() {
  useDocumentTitle();
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
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [activeFeedTitle, setActiveFeedTitle] = useState('Recently Added');
  const [activeNavId, setActiveNavId] = useState('recently_added');

  // Retractable Sidebar states
  const [sidebarVisible, setSidebarVisible] = useState(false); // Inline desktop sidebar
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false); // Mobile slide modal drawer
  const [advancedSearchVisible, setAdvancedSearchVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilters | null>(null);

  const refreshUser = useUserStore((s) => s.refreshUser);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

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
    onConfirm: () => { },
  });

  const fetchStatsForList = async (list: Manga[]) => {
    if (!list || list.length === 0) return;
    const ids = list.map((m) => m.id);
    const stats = await getBatchMangaStatistics(ids);
    setMangaStatsMap((prev) => ({ ...prev, ...stats }));
  };

  // Toggle menu handler (Opens unified SidebarDrawer across Web & Mobile)
  const handleToggleMenu = () => {
    setMobileDrawerVisible(true);
  };

  const [isWebDropdownVisible, setIsWebDropdownVisible] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const webHeaderContainerRef = useRef<any>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchBarWidthAnim = useRef(new Animated.Value(260)).current;

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    setIsScrolled(y > 50);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWinScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(y > 50);
    };

    window.addEventListener('scroll', handleWinScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWinScroll);
  }, []);

  // Web Click-Outside Listener to hide search dropdown and collapse search bar
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (webHeaderContainerRef.current) {
        const element = webHeaderContainerRef.current;
        if (element && typeof element.contains === 'function') {
          if (!element.contains(event.target)) {
            setIsWebDropdownVisible(false);
            if (searchQuery.trim().length === 0) {
              contractSearchBar();
            }
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchQuery]);

  const expandSearchBar = () => {
    if (Platform.OS === 'web') {
      const isMob = windowWidth < 640;
      const targetWidth = isMob ? Math.min(windowWidth - 140, 320) : 680;
      Animated.timing(searchBarWidthAnim, {
        toValue: targetWidth,
        duration: 280,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: false,
      }).start();
    }
  };

  const contractSearchBar = () => {
    if (Platform.OS === 'web') {
      const isMob = windowWidth < 640;
      const targetWidth = isMob ? Math.min(160, windowWidth * 0.35) : 260;
      Animated.timing(searchBarWidthAnim, {
        toValue: targetWidth,
        duration: 280,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: false,
      }).start();
    }
  };

  const handleSearchFocus = () => {
    expandSearchBar();
    setIsWebDropdownVisible(true);
  };

  const handleSearchBlur = () => {
    if (Platform.OS === 'web' && searchQuery.trim().length === 0) {
      contractSearchBar();
    }
  };

  const handleSearchSubmit = () => {
    setIsWebDropdownVisible(false);
    contractSearchBar();
    searchInputRef.current?.blur();
    if (searchQuery.trim().length > 0) {
      setActiveNavId('search_results');
    }
  };

  const mainScrollViewRef = useRef<ScrollView>(null);

  const handleResetToDiscover = useCallback(async () => {
    setSearchQuery('');
    setIsWebDropdownVisible(false);
    contractSearchBar();
    setSearchResults([]);
    setActiveFilters(null);
    setCurrentPage(1);
    setActiveFeedTitle('Latest Updates');
    setActiveNavId('latest');
    if (Platform.OS === 'web') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    mainScrollViewRef.current?.scrollTo({ y: 0, animated: true });

    try {
      setIsLoadingFeed(true);
      const result = await getLatestUpdates(PAGE_SIZE, 0);
      setFeedManga(result.data);
      setTotalMangaCount(result.total);
      fetchStatsForList(result.data);
    } catch (err) {
      console.error('Failed to load latest updates on reset:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [contractSearchBar]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        getRecentlyAdded(PAGE_SIZE, 0),
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

  const nextHeroRef = useRef<() => void>(() => {});

  // Auto-advance hero banner every 7 seconds with slide animation
  useEffect(() => {
    if (popular.length === 0) return;
    const interval = setInterval(() => {
      if (nextHeroRef.current) {
        nextHeroRef.current();
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [popular.length]);

  const isShowingSearch =
    activeNavId === 'search_results' ||
    activeFilters !== null ||
    (Platform.OS !== 'web' && searchQuery.trim().length > 0);

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
      setIsChangingPage(true);

      // Smooth scroll to top of feed grid section
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const feedEl = document.getElementById('feed-section');
        if (feedEl) {
          feedEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 380, behavior: 'smooth' });
        }
      }

      if (searchResults.length > 0 || activeFilters || searchQuery.trim()) {
        const filters: SearchFilters = activeFilters ?? (searchQuery.trim() ? { title: searchQuery.trim() } : {});
        const result = await searchManga(filters, PAGE_SIZE, offset);
        setSearchResults(result.data);
        setTotalMangaCount(result.total);
        fetchStatsForList(result.data);
      } else {
        let result: { data: Manga[]; total: number };
        if (activeNavId === 'latest') {
          result = await getLatestUpdates(PAGE_SIZE, offset);
        } else {
          result = await getRecentlyAdded(PAGE_SIZE, offset);
        }
        setFeedManga(result.data);
        setTotalMangaCount(result.total);
        fetchStatsForList(result.data);
      }
    } catch (err) {
      console.error('Page change failed:', err);
    } finally {
      setIsChangingPage(false);
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



  const heroSlideAnim = useRef(new Animated.Value(0)).current;
  const heroOpacityAnim = useRef(new Animated.Value(1)).current;
  const isAnimatingHero = useRef(false);

  const changeHeroIndex = useCallback((newIndex: number, direction: 'next' | 'prev') => {
    if (popular.length === 0) return;
    if (Platform.OS !== 'web') {
      setHeroIndex(newIndex);
      return;
    }
    if (isAnimatingHero.current) return;
    isAnimatingHero.current = true;

    const slideOutTarget = direction === 'next' ? -280 : 280;
    const slideInStart = direction === 'next' ? 280 : -280;

    Animated.parallel([
      Animated.timing(heroSlideAnim, {
        toValue: slideOutTarget,
        duration: 320,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        useNativeDriver: false,
      }),
      Animated.timing(heroOpacityAnim, {
        toValue: 0.15,
        duration: 320,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setHeroIndex(newIndex);
      heroSlideAnim.setValue(slideInStart);
      Animated.parallel([
        Animated.timing(heroSlideAnim, {
          toValue: 0,
          duration: 480,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: false,
        }),
        Animated.timing(heroOpacityAnim, {
          toValue: 1,
          duration: 480,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]).start(() => {
        isAnimatingHero.current = false;
      });
    });
  }, [popular.length, heroSlideAnim, heroOpacityAnim]);

  const nextHero = useCallback(() => {
    if (popular.length === 0) return;
    const nextIdx = (heroIndex + 1) % popular.length;
    changeHeroIndex(nextIdx, 'next');
  }, [popular.length, heroIndex, changeHeroIndex]);

  const prevHero = useCallback(() => {
    if (popular.length === 0) return;
    const prevIdx = (heroIndex - 1 + popular.length) % popular.length;
    changeHeroIndex(prevIdx, 'prev');
  }, [popular.length, heroIndex, changeHeroIndex]);

  useEffect(() => {
    nextHeroRef.current = nextHero;
  }, [nextHero]);

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
      icon: 'trending-up-outline',
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
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: colors.background },
        Platform.OS === 'web' && ({ paddingTop: 0 } as any),
      ]}
    >
      <View style={styles.layoutRow}>
        {/* ─── MAIN RIGHT CONTENT COLUMN ─── */}
        <View style={styles.mainContentColumn}>
          {/* Top Header (Web Native Component - Single Persistent Instance) */}
          {Platform.OS === 'web' && (
            <WebHeader
              webHeaderContainerRef={webHeaderContainerRef}
              handleToggleMenu={handleToggleMenu}
              searchInputRef={searchInputRef}
              searchBarWidthAnim={searchBarWidthAnim}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              handleSearchFocus={handleSearchFocus}
              handleSearchBlur={handleSearchBlur}
              handleSearchSubmit={handleSearchSubmit}
              isWebDropdownVisible={isWebDropdownVisible}
              setIsWebDropdownVisible={setIsWebDropdownVisible}
              contractSearchBar={contractSearchBar}
              setAdvancedSearchVisible={setAdvancedSearchVisible}
              setActiveNavId={setActiveNavId}
              isSearching={isSearching}
              searchResults={searchResults}
              mangaStatsMap={mangaStatsMap}
              navigateToManga={navigateToManga}
              setSearchResults={setSearchResults}
              colors={colors}
              isShowingSearch={isShowingSearch}
              activeNavId={activeNavId}
              isScrolled={isScrolled}
              onResetToDiscover={handleResetToDiscover}
              onOpenAuth={() => setAuthModalVisible(true)}
            />
          )}

          {/* Top Header (Mobile Native Only) */}
          {Platform.OS !== 'web' && (
            <>
              <View style={styles.header}>
                <Pressable
                  onPress={handleResetToDiscover}
                  style={({ pressed }) => [styles.headerLeft, { opacity: pressed ? 0.7 : 1 }]}
                  hitSlop={8}
                >
                  <Pressable
                    onPress={handleToggleMenu}
                    style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
                    hitSlop={8}
                  >
                    <Ionicons name="menu" size={26} color={colors.text} />
                  </Pressable>
                  <Text style={[styles.appTitle, { color: colors.text }]}>Discover</Text>
                </Pressable>

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
            </>
          )}

          {/* Compact Offline Notification Banner when device is offline */}
          {isOffline && <OfflineState compact />}

          {isOffline && feedManga.length === 0 ? (
            <OfflineState onRetry={handleRefresh} />
          ) : (
            <ScrollView
              ref={mainScrollViewRef}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
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
                <View style={[styles.section, Platform.OS === 'web' && styles.webCenteredContent]}>
                  {/* Active Filter Pill Badge on top of Search Results */}
                  {activeFilters !== null && (
                    <View style={styles.searchResultsFilterRow}>
                      <View
                        style={[
                          styles.activeFilterPill,
                          {
                            backgroundColor: colors.accentSubtle,
                            borderColor: colors.accent,
                          },
                        ]}
                      >
                        <Pressable
                          onPress={() => setAdvancedSearchVisible(true)}
                          style={({ pressed }) => [
                            styles.activeFilterPillBody,
                            pressed && { opacity: 0.75 },
                            Platform.OS === 'web' && { cursor: 'pointer' },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Edit Advanced Filters"
                        >
                          <Ionicons name="options" size={13} color={colors.accent} />
                          <Text style={[styles.activeFilterText, { color: colors.accent }]}>
                            Advanced Filters Active
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={handleClearAdvancedSearch}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.activeFilterCloseBtn,
                            pressed && { opacity: 0.5 },
                            Platform.OS === 'web' && { cursor: 'pointer' },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Clear filters"
                        >
                          <Ionicons name="close" size={14} color={colors.accent} />
                        </Pressable>
                      </View>
                    </View>
                  )}

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
                        <Ionicons name="trending-up-outline" size={13} color={colors.accent} />
                        <Text style={[styles.popularEyebrowText, { color: colors.accent }]}>Top Ranked</Text>
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
                              <Text style={[styles.popularRankNumber, { color: colors.accent }]}>
                                {String(idx + 1).padStart(2, '0')}
                              </Text>
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
                  <View style={[styles.heroSection, Platform.OS === 'web' && styles.webHeroSection]}>
                    {isLoadingPopular || !currentHeroManga ? (
                      <Skeleton width="100%" height={Platform.OS === 'web' ? 420 : 280} borderRadius={Radius.md} />
                    ) : (
                      <Animated.View
                        style={[
                          styles.heroBannerFrame,
                          { borderColor: colors.border },
                          Platform.OS === 'web' && styles.webHeroBannerFrame,
                          Platform.OS === 'web' && {
                            transform: [{ translateX: heroSlideAnim }],
                            opacity: heroOpacityAnim,
                          },
                        ]}
                      >
                        {/* Backdrop Cover Image Spanning Full Width (Unblurred on Web, Blurred on Mobile) */}
                        {getMangaCover(currentHeroManga) && (
                          <Image
                            source={{ uri: getMangaCover(currentHeroManga)! }}
                            style={[styles.heroBackdrop, Platform.OS === 'web' && { opacity: 0.55 }]}
                            contentFit="cover"
                            blurRadius={Platform.OS === 'web' ? 0 : 12}
                          />
                        )}
                        {/* Subtle Dark Gradient Overlay for text contrast */}
                        <LinearGradient
                          colors={
                            Platform.OS === 'web'
                              ? [
                                'rgba(9,9,11,0.65)',
                                'rgba(9,9,11,0.45)',
                                'rgba(9,9,11,0.85)',
                              ]
                              : [
                                'rgba(9,9,11,0.88)',
                                'rgba(9,9,11,0.60)',
                                'rgba(9,9,11,0.92)',
                              ]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={styles.heroBackdropGradient}
                        />





                        {/* Title & Banner Content */}
                        <View style={Platform.OS === 'web' ? styles.webCenteredContent : undefined}>
                          {Platform.OS !== 'web' && (
                            <Text style={[styles.heroSectionTitle, { color: colors.text }]}>
                              Popular New Titles
                            </Text>
                          )}
                          {Platform.OS === 'web' && (
                            <Text style={[styles.heroSectionTitle, styles.webHeroTitleHeader, { color: '#FAFAFA' }]}>
                              Popular New Titles
                            </Text>
                          )}

                          <Pressable
                            onPress={() => navigateToManga(currentHeroManga.id)}
                            style={[styles.heroContentRow, Platform.OS === 'web' && styles.webHeroContentRow]}
                          >
                            {/* Left Cover Image Card */}
                            <View style={[styles.heroCoverCard, Platform.OS === 'web' && styles.webHeroCoverCard]}>
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
                              <Text
                                style={[styles.heroTitleText, Platform.OS === 'web' && styles.webHeroTitleText]}
                                numberOfLines={2}
                              >
                                {getMangaTitle(currentHeroManga)}
                              </Text>

                              {/* Genre Tag Pills */}
                              <View style={styles.heroTagRow}>
                                {currentHeroManga.attributes.tags.slice(0, 5).map((t) => {
                                  const tagLabel = (t.attributes.name.en ?? Object.values(t.attributes.name)[0]).toUpperCase();
                                  const isSuggestive =
                                    tagLabel.includes('SUGGESTIVE') ||
                                    tagLabel.includes('MATURE') ||
                                    tagLabel.includes('EROTICA');
                                  return (
                                    <View
                                      key={t.id}
                                      style={[
                                        styles.heroTagPill,
                                        isSuggestive && { backgroundColor: '#EA580C', borderColor: '#F97316' },
                                      ]}
                                    >
                                      <Text style={styles.heroTagText}>{tagLabel}</Text>
                                    </View>
                                  );
                                })}
                              </View>

                              {/* Synopsis Preview */}
                              <Text
                                style={[styles.heroSynopsisText, Platform.OS === 'web' && styles.webHeroSynopsisText]}
                                numberOfLines={Platform.OS === 'web' ? 4 : 3}
                              >
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
                                    <Ionicons name="chevron-back" size={18} color="#FAFAFA" />
                                  </Pressable>
                                  <Pressable onPress={nextHero} style={styles.heroArrowBtn}>
                                    <Ionicons name="chevron-forward" size={18} color="#FAFAFA" />
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          </Pressable>
                        </View>
                      </Animated.View>
                    )}
                  </View>

                  {/* ─── Dynamic Feed (Latest Updates / Recently Added) ─── */}
                  <View
                    nativeID="feed-section"
                    {...(Platform.OS === 'web' ? { id: 'feed-section' } as any : {})}
                    style={[styles.section, Platform.OS === 'web' && styles.webCenteredContent]}
                  >
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
                        {Array.from({ length: 27 }).map((_, i) => (
                          <View
                            key={i}
                            style={{
                              width: Platform.OS === 'web' ? ('calc((100% - 80px) / 9)' as any) : 110,
                              marginBottom: 12,
                            }}
                          >
                            <Skeleton width="100%" height={160} borderRadius={Radius.md} />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={[styles.mangaGrid, isChangingPage && { opacity: 0.45 }]}>
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

      {/* Auth Modal for Unauthenticated Users */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
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
  searchResultsFilterRow: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 4,
  },
  activeFilterPillBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeFilterCloseBtn: {
    padding: 3,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
    position: 'relative',
    minHeight: 250,
    zIndex: 100,
  },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.75,
    pointerEvents: 'none',
  },
  heroBackdropGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
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
    paddingHorizontal: Platform.OS === 'web' ? 10 : 6,
    paddingVertical: Platform.OS === 'web' ? 4 : 2,
    borderRadius: Radius.xs,
  },
  heroTagText: {
    color: '#FAFAFA',
    fontSize: Platform.OS === 'web' ? 11 : 9,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  heroSynopsisText: {
    color: '#D4D4D8',
    fontSize: Platform.OS === 'web' ? 15 : Typography.sizes.footnote,
    lineHeight: Platform.OS === 'web' ? 23 : 18,
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  heroAuthorText: {
    color: '#FAFAFA',
    fontSize: Platform.OS === 'web' ? 14 : Typography.sizes.footnote,
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
    fontSize: Platform.OS === 'web' ? 13 : 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
    marginRight: 4,
  },
  heroArrowBtn: {
    padding: 4,
  },

  /* Web Specific Full-Bleed Spanning Styles */
  webCenteredContent: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
  },
  webHeroTopContainer: {
    paddingTop: 0,
    paddingBottom: 4,
    zIndex: 10,
  },
  webHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 16,
  },
  webHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  webBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webHeaderMascot: {
    width: 30,
    height: 30,
    borderRadius: 6,
  },
  webBrandTitle: {
    fontSize: 22,
    fontWeight: Typography.weights.bold,
    color: '#FAFAFA',
    letterSpacing: -0.3,
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'flex-end',
    position: 'relative',
    zIndex: 100,
  },
  webSearchDimBackdrop: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    zIndex: 998,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(1px)',
          transition: 'background-color 0.2s ease, opacity 0.2s ease',
        } as any)
      : {}),
  },
  webDropdownOverlayContainer: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: '#18181B',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 12px 20px rgba(0, 0, 0, 0.6)',
    elevation: 25,
    zIndex: 9999,
  },
  webDropdownEmptyPrompt: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  webDropdownEmptyPromptText: {
    color: '#D4D4D8',
    fontSize: 14,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.1,
  },
  webDropdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  webDropdownHeaderTitle: {
    fontSize: 18,
    fontWeight: Typography.weights.bold,
    color: '#FAFAFA',
  },
  webDropdownScroll: {
    maxHeight: 460,
  },
  webDropdownList: {
    gap: 8,
  },
  webDropdownCardRow: {
    flexDirection: 'row',
    backgroundColor: '#27272A',
    borderRadius: 10,
    padding: 10,
    gap: 12,
    alignItems: 'center',
  },
  webDropdownCover: {
    width: 48,
    height: 68,
    borderRadius: 6,
    backgroundColor: '#3F3F46',
  },
  webDropdownBody: {
    flex: 1,
    gap: 4,
  },
  webDropdownMangaTitle: {
    fontSize: 14,
    fontWeight: Typography.weights.bold,
    color: '#FAFAFA',
    lineHeight: 18,
  },
  webDropdownMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  webDropdownMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  webDropdownMetaText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: Typography.weights.semibold,
  },
  webDropdownStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 6,
    marginTop: 2,
  },
  webStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  webStatusText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: Typography.weights.semibold,
  },
  webDropdownLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  webDropdownEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  webDropdownEmptyText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  webSearchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 32, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderRadius: 20,
    height: 36,
    paddingHorizontal: 12,
    width: '100%',
    gap: 8,
    overflow: 'hidden',
  },
  webSearchInput: {
    flex: 1,
    color: '#FAFAFA',
    fontSize: 13,
    paddingVertical: 0,
    height: '100%',
    paddingHorizontal: 0,
  },
  webSearchRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kbdBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  kbdText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: Typography.weights.semibold,
  },
  webFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webGetAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  webGetAppBtnText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
  },
  webProfileContainer: {
    position: 'relative',
    zIndex: 9999,
  },
  webProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  webProfileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  webProfileAvatarText: {
    fontSize: 14,
    fontWeight: Typography.weights.bold,
  },
  dropdownBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
  webProfileDropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 250,
    borderRadius: Radius.lg,
    borderWidth: 1,
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.5)',
    elevation: 10,
    zIndex: 9999,
    overflow: 'hidden',
  },
  dropdownUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  dropdownAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dropdownAvatarText: {
    fontSize: 15,
    fontWeight: Typography.weights.bold,
  },
  dropdownUserName: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  dropdownUserHandle: {
    fontSize: 11,
  },
  dropdownUserEmail: {
    fontSize: 10,
  },
  dropdownMenuList: {
    paddingVertical: Spacing.xs,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: Spacing.sm,
  },
  dropdownMenuText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },
  dropdownDivider: {
    height: 1,
    marginVertical: 4,
  },
  webHeroTitleHeader: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 4,
    fontSize: Platform.OS === 'web' ? 22 : Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
  },
  webHeroSection: {
    width: '100%',
    marginHorizontal: 0,
    paddingHorizontal: 0,
    marginBottom: Spacing['2xl'],
    zIndex: 100,
    overflow: 'visible',
  },
  webHeroBannerFrame: {
    width: '100%',
    borderRadius: 0,
    borderWidth: 0,
    minHeight: 520,
    marginTop: -68,
    paddingTop: 116,
    zIndex: 1,
    overflow: 'hidden',
  },
  webHeroContentRow: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 28,
  },
  webHeroCoverCard: {
    width: 180,
    height: 260,
    borderRadius: Radius.md,
  },
  webHeroTitleText: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: Typography.weights.bold,
  },
  webHeroSynopsisText: {
    fontSize: 15,
    lineHeight: 23,
    color: '#E4E4E7',
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
    fontSize: Platform.OS === 'web' ? 20 : Typography.sizes.headline,
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
    paddingHorizontal: Platform.OS === 'web' ? Spacing.lg : Spacing.md,
    paddingVertical: Platform.OS === 'web' ? Spacing.sm + 2 : Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 4,
  },
  pageBtnText: {
    fontSize: Platform.OS === 'web' ? 14 : Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  pageIndicatorPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  pageIndicatorText: {
    fontSize: Platform.OS === 'web' ? 15 : Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  pageTotalCountText: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
  },
});
