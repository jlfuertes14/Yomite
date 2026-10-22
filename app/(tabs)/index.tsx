/**
 * Discover Screen — Edge-to-Edge Layout with Embedded Left Navigation Sidebar
 * Features: Embedded Left Navigation Column (Non-Modal), MangaDex Filter Modal,
 * Popular New Titles Hero Banner, Latest Updates, Recently Added, Random Manga.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useGlobalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  View,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../../constants/Colors';
import {
  extractAuthorName,
  extractCoverFileName,
  getBatchMangaStatistics,
  getCoverUrl,
  getLatestUpdates,
  getMangaDescription,
  getMangaTitle,
  getMostPopularManga,
  getPopularManga,
  getRandomManga,
  getRecentlyAdded,
  getTopRatedManga,
  MangaStatistics,
} from '../../src/api/mangadex';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { CARD_GAP, MangaCard } from '../../src/components/MangaCard';
import { OfflineState } from '../../src/components/OfflineState';
import { SearchResultsModal } from '../../src/components/SearchResultsModal';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { Skeleton } from '../../src/components/Skeleton';
import { useColorScheme } from '../../src/hooks/useColorScheme';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { syncUserDataWithCloud } from '../../src/services/cloudSync';
import { useCatalogStore } from '../../src/store/catalogStore';
import { useUIStore } from '../../src/store/uiStore';
import { getUserAvatarUrl, getUserDisplayName, getUserHandle, useUserStore } from '../../src/store/userStore';
import type { Manga } from '../../src/types';
import { BannerCacheManager } from '../../src/utils/bannerCache';
import { dedupeMangaList, getUniversalDiscoverData, sourceMangaToAppManga } from '../../src/sources/adapter';
import { SourceManager } from '../../src/sources/SourceManager';
import type { MangaSourceMetadata } from '../../src/sources/types';
import { triggerHaptic } from '../../src/utils/haptics';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';

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

const getDefaultFeedList = (data: { recentlyAdded: Manga[]; latestUpdates: Manga[] }) =>
  data.recentlyAdded.length > 0 ? data.recentlyAdded : data.latestUpdates;

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

const getMangaCover = (manga: Manga, size: '256' | '512' | 'original' = '512'): string | null => {
  const fileName = extractCoverFileName(manga);
  if (!fileName) return null;
  return getCoverUrl(manga.id, fileName, size);
};

const getCoverSource = (uri: string | null) => {
  if (!uri) return undefined;
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return {
      uri,
      headers: {
        'User-Agent': 'Yomite/1.0 (https://github.com/jlfuertes14/Yomite)',
        Referer: 'https://mangadex.org',
      },
    };
  }
  return { uri };
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

function ExtensionSourceFavicon({
  icon,
  letter,
  accentColor,
}: {
  icon?: string;
  letter: string;
  accentColor: string;
}) {
  const [imgError, setImgError] = useState(false);
  const isValidUrl = icon && (icon.startsWith('http://') || icon.startsWith('https://')) && !imgError;

  if (isValidUrl) {
    return (
      <Image
        source={{ uri: icon }}
        style={{ width: 20, height: 20, borderRadius: 5 }}
        contentFit="cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '700', color: accentColor }}>
        {letter.toUpperCase()}
      </Text>
    </View>
  );
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
                      ? 'transparent'
                      : 'transparent',
                    ...(Platform.OS === 'web'
                      ? ({
                        boxShadow: isSearchFocused
                          ? 'none'
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
                  color={isSearchFocused ? '#FAFAFA' : 'rgba(255,255,255,0.55)'}
                  style={{ marginRight: 2 }}
                />
                <TextInput
                  ref={searchInputRef as any}
                  style={[
                    styles.webSearchInput,
                    isMobile && { fontSize: 12 },
                    Platform.OS === 'web' && ({ outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any),
                  ]}
                  placeholder={isMobile ? 'Search…' : 'Search'}
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  value={searchQuery}
                  multiline={false}
                  numberOfLines={1}
                  onChangeText={(text) => {
                    const sanitized = text.replace(/[\r\n]+/g, ' ');
                    setSearchQuery(sanitized);
                    setIsWebDropdownVisible(true);
                    if (sanitized.trim().length > 0) {
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
                        Enter a manga name or search query…
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

            {/* Get Mobile App Web Pill (Hidden on Mobile viewports where space is tight) */}
            {!isMobile && (
              <Pressable
                onPress={() => router.push('/download' as any)}
                style={({ pressed }) => [
                  styles.webGetAppBtn,
                  {
                    backgroundColor: isTransparentAtTop ? 'rgba(255, 255, 255, 0.14)' : colors.surfaceElevated,
                    borderColor: isTransparentAtTop ? 'rgba(255, 255, 255, 0.28)' : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="download-outline" size={14} color={isTransparentAtTop ? '#FAFAFA' : colors.text} />
                <Text
                  style={[
                    styles.webGetAppBtnText,
                    { color: isTransparentAtTop ? '#FAFAFA' : colors.text },
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
                          <Text style={[styles.dropdownAvatarText, { color: colors.accentForeground }]}>
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
  const colorScheme = useColorScheme();
  const isLightTheme = colorScheme === 'light';
  const { isOffline } = useNetworkStatus();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const heroCardWidth = windowWidth - Spacing.md * 2;
  const HERO_CARD_GAP = 24;
  const mobileHeroScrollRef = useRef<ScrollView>(null);
  const isUserInteractingHeroRef = useRef(false);

  // Responsive Layout Constants
  const sidebarWidth = isDesktop ? 260 : 0;
  const isFeedMobile = windowWidth < 600;
  const feedAvailableWidth = isDesktop ? windowWidth - sidebarWidth : windowWidth;
  const feedHorizontalPadding = isFeedMobile ? 24 : 32;
  const feedColumns = isDesktop || feedAvailableWidth >= 900 ? 9 : isFeedMobile ? 3 : 6;
  const feedTotalGap = (feedColumns - 1) * CARD_GAP;
  const feedNativeWidth = Math.floor((feedAvailableWidth - feedHorizontalPadding - feedTotalGap - 2) / feedColumns);
  const feedCardWidth = Platform.OS === 'web'
    ? (isDesktop || windowWidth >= 900
        ? ('calc((100% - 80px) / 9)' as any)
        : isFeedMobile
        ? ('calc((100% - 20px) / 3)' as any)
        : ('calc((100% - 50px) / 6)' as any))
    : feedNativeWidth;
  const feedCardHeight = typeof feedCardWidth === 'number' ? Math.floor(feedCardWidth * 1.44) : 160;

  // Data states
  const [popular, setPopular] = useState<Manga[]>([]);
  const [feedManga, setFeedManga] = useState<Manga[]>([]);
  const [mangaStatsMap, setMangaStatsMap] = useState<Record<string, MangaStatistics>>({});
  const [totalMangaCount, setTotalMangaCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Mobile Multi-Carousel Discover States
  const [topRatedManga, setTopRatedManga] = useState<Manga[]>([]);
  const [mostPopularManga, setMostPopularManga] = useState<Manga[]>([]);
  const [recentlyAddedManga, setRecentlyAddedManga] = useState<Manga[]>([]);
  const [latestUpdatesManga, setLatestUpdatesManga] = useState<Manga[]>([]);
  const [isLoadingCarousels, setIsLoadingCarousels] = useState(true);
  const [activeSeeAllSection, setActiveSeeAllSection] = useState<'top_rated' | 'most_popular' | 'recently_added' | 'latest' | null>(null);

  // Primary Discover Source States
  const [primarySourceName, setPrimarySourceName] = useState<string>('MangaDex');
  const [primarySourceId, setPrimarySourceId] = useState<string>('mangadex');

  // Search & Navigation Feed States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Manga[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [activeFeedTitle, setActiveFeedTitle] = useState('Recently Added');
  const [activeNavId, setActiveNavId] = useState('recently_added');

  // Cross-Extension Mobile Search States
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);
  const [groupedExtensionResults, setGroupedExtensionResults] = useState<
    { source: MangaSourceMetadata; mangaList: Manga[] }[]
  >([]);
  const [activeSeeAllExtension, setActiveSeeAllExtension] = useState<{
    source: MangaSourceMetadata;
    mangaList: Manga[];
  } | null>(null);

  // Retractable Sidebar states
  const [sidebarVisible, setSidebarVisible] = useState(false); // Inline desktop sidebar
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false); // Mobile slide modal drawer
  const user = useUserStore((s) => s.user);
  const avatarUrl = getUserAvatarUrl(user);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  // Restores from the source catalog appear instantly instead of sliding up
  // (the sheet is an in-scene overlay; the catalog slides away to reveal it).
  const [searchModalAnimateIn, setSearchModalAnimateIn] = useState(true);

  // Returning from the Extensions source catalog reopens the search sheet
  // with the query that was used to open the catalog.
  const { searchQuery: routeSearchQuery, searchRequestId: routeSearchRequestId } =
    useGlobalSearchParams<{ searchQuery?: string; searchRequestId?: string }>();
  const handledSearchRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!routeSearchRequestId) return;
    const requestKey = String(routeSearchRequestId);
    if (handledSearchRequestRef.current === requestKey) return;

    const query = typeof routeSearchQuery === 'string' ? routeSearchQuery : '';
    if (!query.trim()) return;

    handledSearchRequestRef.current = requestKey;
    setSearchInitialQuery(query);
    setSearchModalAnimateIn(false);
    setSearchModalVisible(true);
  }, [routeSearchRequestId, routeSearchQuery]);

  // `searchModalAnimateIn` is only ever changed while the sheet is hidden
  // (openSearchModal restores it), so a restored sheet never replays the
  // entrance on top of the catalog's slide-away.

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
    const ids = list
      .map((m) => m.id)
      .filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );
    if (ids.length === 0) return;
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

  const isSeeAllChromeHiddenRef = useRef(false);
  const seeAllHeaderTranslateY = useRef(new Animated.Value(0)).current;
  const seeAllLastScrollYRef = useRef(0);
  const setTabBarVisible = useUIStore((s) => s.setTabBarVisible);

  const seeAllHeaderOpacity = seeAllHeaderTranslateY.interpolate({
    inputRange: [-60, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const hideSeeAllChrome = useCallback(() => {
    if (!isSeeAllChromeHiddenRef.current) {
      isSeeAllChromeHiddenRef.current = true;
      setTabBarVisible(false);
      Animated.timing(seeAllHeaderTranslateY, {
        toValue: -140,
        duration: 220,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [setTabBarVisible, seeAllHeaderTranslateY]);

  const showSeeAllChrome = useCallback(() => {
    if (isSeeAllChromeHiddenRef.current) {
      isSeeAllChromeHiddenRef.current = false;
      setTabBarVisible(true);
      Animated.timing(seeAllHeaderTranslateY, {
        toValue: 0,
        duration: 240,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [setTabBarVisible, seeAllHeaderTranslateY]);

  const handleScrollBeginDrag = useCallback(() => {
    // The header follows the actual scroll direction. Do not hide it merely
    // because a drag started, since that also happens when pulling upward.
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    setIsScrolled(y > 50);

    if (activeSeeAllSection !== null) {
      const previousY = seeAllLastScrollYRef.current;
      seeAllLastScrollYRef.current = y;

      if (y <= 10) {
        showSeeAllChrome();
        return;
      }

      if (y > previousY + 2) hideSeeAllChrome();
      else if (y < previousY - 2) showSeeAllChrome();
    }
  }, [activeSeeAllSection, hideSeeAllChrome, showSeeAllChrome]);

  const handleScrollEndDrag = useCallback(() => {
    // Keep the current chrome state after the gesture ends.
  }, []);

  const handleMomentumScrollEnd = useCallback(() => {
    // Keep the current chrome state after momentum ends.
  }, []);

  useEffect(() => {
    if (activeSeeAllSection === null) {
      showSeeAllChrome();
    }
  }, [activeSeeAllSection, showSeeAllChrome]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        showSeeAllChrome();
      };
    }, [showSeeAllChrome])
  );

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
    setActiveSeeAllSection(null);
    setSearchQuery('');
    setIsWebDropdownVisible(false);
    contractSearchBar();
    setSearchResults([]);
    setGroupedExtensionResults([]);
    setActiveSeeAllExtension(null);
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

  const handleOpenSeeAll = useCallback(async (section: 'top_rated' | 'most_popular' | 'recently_added' | 'latest') => {
    if (section === 'recently_added' && primarySourceId === 'asurascans') {
      section = 'latest';
    }
    setActiveSeeAllSection(section);
    setCurrentPage(1);
    showSeeAllChrome();
    seeAllLastScrollYRef.current = 0;
    mainScrollViewRef.current?.scrollTo({ y: 0, animated: false });

    let title = 'Top Rated Manga';
    if (section === 'most_popular') {
      title = primarySourceId === 'asurascans' ? 'Most Popular All Time' : 'Most Popular';
    } else if (section === 'recently_added') title = 'Recently Added';
    else if (section === 'latest') title = 'Latest Updates';
    setActiveFeedTitle(title);

    if (primarySourceId !== 'mangadex') {
      const sectionManga =
        section === 'top_rated'
          ? topRatedManga
          : section === 'most_popular'
            ? mostPopularManga
            : section === 'latest'
              ? latestUpdatesManga
              : recentlyAddedManga;
      setFeedManga(sectionManga);
      setTotalMangaCount(sectionManga.length);
      fetchStatsForList(sectionManga);
      setIsLoadingFeed(false);
      return;
    }

    try {
      setIsLoadingFeed(true);
      let res: { data: Manga[]; total: number };
      if (section === 'top_rated') {
        res = await getTopRatedManga(PAGE_SIZE, 0);
      } else if (section === 'most_popular') {
        res = await getMostPopularManga(PAGE_SIZE, 0);
      } else if (section === 'latest') {
        res = await getLatestUpdates(PAGE_SIZE, 0);
      } else {
        res = await getRecentlyAdded(PAGE_SIZE, 0);
      }
      setFeedManga(res.data);
      setTotalMangaCount(res.total);
      fetchStatsForList(res.data);
    } catch (err) {
      console.error('Failed to load see-all section:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [
    showSeeAllChrome,
    primarySourceId,
    topRatedManga,
    mostPopularManga,
    latestUpdatesManga,
    recentlyAddedManga,
  ]);

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
  const [cachedHeroBanners, setCachedHeroBanners] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      setIsLoadingPopular(true);
      setIsLoadingFeed(true);
      setIsLoadingCarousels(true);
      setCurrentPage(1);

      const data = await getUniversalDiscoverData(undefined, false);
      setPrimarySourceName(data.primarySourceName);
      setPrimarySourceId(data.primarySourceId);

      setPopular(data.popular || []);
      setTopRatedManga(data.topRated || []);
      setMostPopularManga(data.mostPopular || []);
      setRecentlyAddedManga(data.recentlyAdded || []);
      setLatestUpdatesManga(data.latestUpdates || []);
      const defaultFeed = getDefaultFeedList(data);
      setFeedManga(defaultFeed);
      setTotalMangaCount(defaultFeed.length);
      setActiveFeedTitle(data.recentlyAdded.length > 0 ? 'Recently Added' : 'Latest Updates');
      setActiveNavId(data.recentlyAdded.length > 0 ? 'recently_added' : 'latest');

      if (data.popular && data.popular.length > 0) {
        const heroItems = data.popular.slice(0, POPULAR_TOP_LIMIT).map((m) => ({
          id: m.id,
          url: getMangaCover(m, '512'),
        }));
        const heroCoverUrls = heroItems.map((h) => h.url).filter(Boolean) as string[];
        if (heroCoverUrls.length > 0) {
          Image.prefetch(heroCoverUrls, 'disk');
        }
        BannerCacheManager.prefetchHeroBanners(heroItems).then((resolved) => {
          if (Object.keys(resolved).length > 0) {
            setCachedHeroBanners((prev) => ({ ...prev, ...resolved }));
          }
        });
      }

      const allLoaded = [
        ...(data.popular || []),
        ...(data.topRated || []),
        ...(data.mostPopular || []),
        ...(data.recentlyAdded || []),
        ...(data.latestUpdates || []),
      ];
      fetchStatsForList(allLoaded);
    } catch (err) {
      console.error('Failed to fetch discover data:', err);
    } finally {
      setIsLoadingPopular(false);
      setIsLoadingFeed(false);
      setIsLoadingCarousels(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const nextHeroRef = useRef<() => void>(() => { });
  const prevHeroRef = useRef<() => void>(() => { });
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      const currentDefault = SourceManager.getDefaultDiscoverSourceId();
      if (currentDefault !== primarySourceId) {
        fetchData();
      }
      return () => {
        setIsScreenFocused(false);
      };
    }, [primarySourceId, fetchData])
  );

  // Auto-advance hero banner every 7 seconds: instant state change with NO swipe animation if not swiped by user
  useEffect(() => {
    if (popular.length <= 1 || !isScreenFocused) return;
    const interval = setInterval(() => {
      if (Platform.OS !== 'web') {
        if (isUserInteractingHeroRef.current) return;
        const count = Math.min(popular.length, POPULAR_TOP_LIMIT);
        const snapInterval = heroCardWidth + HERO_CARD_GAP;
        setHeroIndex((prev) => {
          const nextIdx = (prev + 1) % count;
          mobileHeroScrollRef.current?.scrollTo({ x: nextIdx * snapInterval, animated: false });
          return nextIdx;
        });
      } else {
        if (nextHeroRef.current) {
          nextHeroRef.current();
        }
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [popular.length, isScreenFocused, heroCardWidth, HERO_CARD_GAP]);

  const isShowingSearch =
    activeNavId === 'search_results' ||
    searchQuery.trim().length > 0;

  // Android Hardware Back Button & Edge-Swipe Navigation Handler
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (searchModalVisible) {
          setSearchModalVisible(false);
          return true;
        }
        if (activeSeeAllSection !== null) {
          triggerHaptic();
          showSeeAllChrome();
          setActiveSeeAllSection(null);
          return true;
        }
        if (isShowingSearch || activeNavId === 'search_results') {
          triggerHaptic();
          handleResetToDiscover();
          return true;
        }
        if (activeNavId === 'popular') {
          triggerHaptic();
          handleResetToDiscover();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        subscription.remove();
      };
    }, [activeSeeAllSection, isShowingSearch, activeNavId, searchModalVisible, showSeeAllChrome, handleResetToDiscover])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);

    // Completely flush hero banner cache & native image RAM cache on Discover pull-to-refresh
    try {
      await BannerCacheManager.clearCache();
      setCachedHeroBanners({});
    } catch {}

    try {
      const data = await getUniversalDiscoverData(
        primarySourceId === 'mangadex' ? undefined : primarySourceId,
        true
      );
      setPrimarySourceName(data.primarySourceName);
      setPrimarySourceId(data.primarySourceId);

      setPopular(data.popular || []);
      setTopRatedManga(data.topRated || []);
      setMostPopularManga(data.mostPopular || []);
      setRecentlyAddedManga(data.recentlyAdded || []);
      setLatestUpdatesManga(data.latestUpdates || []);

      let feedList = getDefaultFeedList(data);
      if (activeSeeAllSection === 'top_rated') feedList = data.topRated || [];
      else if (activeSeeAllSection === 'most_popular') feedList = data.mostPopular || [];
      else if (activeSeeAllSection === 'latest') feedList = data.latestUpdates || [];
      else if (activeNavId === 'latest') feedList = data.latestUpdates || [];

      setFeedManga(feedList);
      setTotalMangaCount(feedList.length);
      if (data.recentlyAdded.length === 0 && activeSeeAllSection === null) {
        setActiveFeedTitle('Latest Updates');
        setActiveNavId('latest');
      }

      fetchStatsForList([
        ...(data.popular || []),
        ...(data.topRated || []),
        ...(data.mostPopular || []),
        ...(data.recentlyAdded || []),
        ...(data.latestUpdates || []),
      ]);
    } catch (err) {
      console.error('Mobile refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [activeNavId, activeSeeAllSection, primarySourceId]);

  const handleSearch = useCallback(async (overrideQuery?: string) => {
    const query = (overrideQuery ?? searchQuery).trim();
    if (!query) {
      setSearchResults([]);
      setGroupedExtensionResults([]);
      setActiveSeeAllExtension(null);
      return;
    }
    try {
      setIsSearching(true);
      setCurrentPage(1);
      setActiveFeedTitle('Search Results');
      setActiveNavId('search_results');
      setActiveSeeAllExtension(null);

      const rawResults = await SourceManager.searchAll(query);
      const grouped = rawResults
        .map((item) => ({
          source: item.source,
          mangaList: dedupeMangaList((item.results || []).map((sm) => sourceMangaToAppManga(sm))),
        }))
        .filter((item) => item.mangaList.length > 0);

      setGroupedExtensionResults(grouped);
      const allFoundManga = grouped.flatMap((g) => g.mangaList);
      setSearchResults(allFoundManga);
      setTotalMangaCount(allFoundManga.length);
      fetchStatsForList(allFoundManga);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timeout = setTimeout(() => handleSearch(), 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, handleSearch]);

  const openSearchModal = () => {
    triggerHaptic();
    setSearchInitialQuery('');
    setSearchModalAnimateIn(true);
    setSearchModalVisible(true);
  };

  const clearSearchState = () => {
    setSearchQuery('');
    setSearchResults([]);
    setGroupedExtensionResults([]);
    setActiveSeeAllExtension(null);
  };

  // Sidebar Actions
  const handleSelectPopular = () => {
    clearSearchState();
    setCurrentPage(1);
    setActiveFeedTitle(primarySourceId === 'asurascans' ? 'Trending This Week' : 'Popular New Titles');
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
      if (primarySourceId !== 'mangadex') {
        setFeedManga(latestUpdatesManga);
        setTotalMangaCount(latestUpdatesManga.length);
        fetchStatsForList(latestUpdatesManga);
        return;
      }
      const result = await getLatestUpdates(PAGE_SIZE, 0);
      setFeedManga(result.data);
      setTotalMangaCount(result.total);
      fetchStatsForList(result.data);
    } catch (err) {
      console.warn('MangaDex latest updates failed; using cached discover data.', err);
      setFeedManga(latestUpdatesManga);
      setTotalMangaCount(latestUpdatesManga.length);
      fetchStatsForList(latestUpdatesManga);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const handleSelectRecentlyAdded = async () => {
    if (primarySourceId !== 'mangadex' && recentlyAddedManga.length === 0) {
      await handleSelectLatest();
      return;
    }
    try {
      setIsLoadingFeed(true);
      setCurrentPage(1);
      clearSearchState();
      setActiveFeedTitle('Recently Added');
      setActiveNavId('recently_added');
      setSidebarVisible(false);
      setMobileDrawerVisible(false);
      if (primarySourceId !== 'mangadex') {
        setFeedManga(recentlyAddedManga);
        setTotalMangaCount(recentlyAddedManga.length);
        fetchStatsForList(recentlyAddedManga);
        return;
      }
      const result = await getRecentlyAdded(PAGE_SIZE, 0);
      setFeedManga(result.data);
      setTotalMangaCount(result.total);
      fetchStatsForList(result.data);
    } catch (err) {
      console.warn('MangaDex recently added failed; using cached discover data.', err);
      setFeedManga(recentlyAddedManga);
      setTotalMangaCount(recentlyAddedManga.length);
      fetchStatsForList(recentlyAddedManga);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  // Page Change Handlers
  const handlePageChange = async (newPage: number) => {
    if (primarySourceId !== 'mangadex') return;
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
      } else {
        mainScrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }

      let result: { data: Manga[]; total: number };
      if (activeSeeAllSection === 'top_rated') {
        result = await getTopRatedManga(PAGE_SIZE, offset);
      } else if (activeSeeAllSection === 'most_popular') {
        result = await getMostPopularManga(PAGE_SIZE, offset);
      } else if (activeSeeAllSection === 'latest' || activeNavId === 'latest') {
        result = await getLatestUpdates(PAGE_SIZE, offset);
      } else {
        result = await getRecentlyAdded(PAGE_SIZE, offset);
      }
      setFeedManga(result.data);
      setTotalMangaCount(result.total);
      fetchStatsForList(result.data);
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

  const handleOpenSourceCatalog = useCallback(
    (source: MangaSourceMetadata, query: string) => {
      const { hostMounted, openCatalog } = useCatalogStore.getState();

      if (hostMounted && Platform.OS !== 'ios') {
        // The Extensions screen hosts the catalog as a native dialog and is
        // kept mounted, so the catalog slides in directly over the search
        // results — no tab switch, no intermediate renders. The sheet stays
        // visible underneath and is revealed again when the catalog slides
        // away.
        //
        // iOS is excluded: react-native-screens detaches inactive tab screens,
        // so a modal presented from the blurred Extensions screen would have
        // no view controller in the window hierarchy. There we fall back to
        // the navigation flow below.
        openCatalog({
          sourceId: source.id,
          name: source.name,
          domain: source.domain,
          query,
        });
        return;
      }

      // Fallback (iOS, or host not mounted yet): navigate to the Extensions
      // tab and let its deep-link restore open the catalog.
      setSearchModalVisible(false);
      router.push(
        `/(tabs)/extensions?reopenCatalog=${encodeURIComponent(source.id)}&catalogQuery=${encodeURIComponent(
          query
        )}&catalogRequestId=${Date.now()}&catalogFrom=search` as any
      );
    },
    [router]
  );



  const heroSlideAnim = useRef(new Animated.Value(0)).current;
  const heroOpacityAnim = useRef(new Animated.Value(1)).current;
  const isAnimatingHero = useRef(false);

  const popularRef = useRef<Manga[]>([]);
  useEffect(() => {
    popularRef.current = popular;
  }, [popular]);

  const changeHeroIndex = useCallback((newIndex: number, direction: 'next' | 'prev') => {
    if (popular.length === 0) return;
    if (Platform.OS !== 'web') {
      const snapInterval = heroCardWidth + HERO_CARD_GAP;
      setHeroIndex(newIndex);
      mobileHeroScrollRef.current?.scrollTo({ x: newIndex * snapInterval, animated: false });
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
  }, [popular.length, heroCardWidth, HERO_CARD_GAP, heroSlideAnim, heroOpacityAnim]);

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
    prevHeroRef.current = prevHero;
  }, [nextHero, prevHero]);

  const popularSlice = useMemo(() => popular.slice(0, POPULAR_TOP_LIMIT), [popular]);
  const loopHeroCards = useMemo(
    () => (popularSlice.length > 1 ? [...popularSlice, popularSlice[0]] : popularSlice),
    [popularSlice]
  );

  const currentHeroManga = popular[heroIndex] ?? null;
  const currentHeroStats = currentHeroManga ? mangaStatsMap[currentHeroManga.id] : null;
  const currentHeroRating = currentHeroStats?.rating?.bayesian || currentHeroStats?.rating?.average || null;
  const currentHeroFollows = currentHeroStats?.follows ?? null;

  // Prioritize persistent local file-system cached cover to avoid blank screens
  const localCachedHeroUri = currentHeroManga
    ? (cachedHeroBanners[currentHeroManga.id] || BannerCacheManager.getCachedUri(currentHeroManga.id))
    : null;
  const currentHeroCover = localCachedHeroUri || (currentHeroManga ? getMangaCover(currentHeroManga, '512') : null);
  const currentHeroPlaceholder = currentHeroManga ? getMangaCover(currentHeroManga, '512') : null;
  const currentHeroTitle = currentHeroManga ? getMangaTitle(currentHeroManga) : '';
  const currentHeroAuthor = currentHeroManga ? extractAuthorName(currentHeroManga) : '';
  const currentHeroDesc = currentHeroManga
    ? (getMangaDescription(currentHeroManga) || 'No description available for this title.')
    : '';
  const currentHeroTags = currentHeroManga?.attributes.tags?.slice(0, 3) ?? [];

  // Proactively cache active banner to persistent disk
  useEffect(() => {
    if (!currentHeroManga || Platform.OS === 'web') return;
    const coverUrl = getMangaCover(currentHeroManga, '512');
    if (!coverUrl) return;
    BannerCacheManager.getOrCacheBanner(currentHeroManga.id, coverUrl).then((localUri) => {
      if (localUri && localUri.startsWith('file://')) {
        setCachedHeroBanners((prev) => {
          if (prev[currentHeroManga.id] === localUri) return prev;
          return { ...prev, [currentHeroManga.id]: localUri };
        });
      }
    });
  }, [currentHeroManga]);



  const mobileHeroRatingDisplay = useMemo(() => {
    if (currentHeroRating == null || isNaN(currentHeroRating)) return null;
    const val = currentHeroRating > 5 ? currentHeroRating / 2 : currentHeroRating;
    return val.toFixed(1);
  }, [currentHeroRating]);

  const mobileHeroRatingCount = useMemo(() => {
    if (currentHeroStats?.rating?.distribution) {
      const total = Object.values(currentHeroStats.rating.distribution).reduce(
        (acc, v) => acc + (typeof v === 'number' ? v : 0),
        0
      );
      if (total > 0) {
        return `${total.toLocaleString()} ratings`;
      }
    }
    if (currentHeroFollows != null && currentHeroFollows > 0) {
      return `${formatCompactNumber(currentHeroFollows)} ratings`;
    }
    return null;
  }, [currentHeroStats, currentHeroFollows]);

  const navItems: SidebarNavItem[] = [
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
    ...(primarySourceId === 'asurascans'
      ? []
      : [{
          id: 'recently_added',
          label: 'Recently Added',
          icon: 'add-circle-outline' as const,
          action: handleSelectRecentlyAdded,
        }]),
    {
      id: 'random',
      label: 'Random Manga',
      icon: 'dice-outline',
      action: handleSelectRandom,
    },
  ];

  return (
    <>
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
              onOpenAuth={() => router.push('/auth/login' as any)}
            />
          )}

          {/* Top Header (Mobile Native Only) */}
          {Platform.OS !== 'web' && (
            activeSeeAllSection !== null ? (
              <Animated.View
                style={[
                  styles.stickySeeAllHeader,
                  {
                    backgroundColor: colors.background,
                    borderBottomColor: colors.border,
                    transform: [{ translateY: seeAllHeaderTranslateY }],
                    opacity: seeAllHeaderOpacity,
                  },
                ]}
              >
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setActiveSeeAllSection(null);
                  }}
                  style={({ pressed }) => [styles.seeAllBackBtn, pressed && { opacity: 0.6 }]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Back to Discover"
                >
                  <Ionicons name="chevron-back" size={24} color={colors.accent} />
                </Pressable>
                <View style={styles.seeAllTitleWrap}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
                    {activeFeedTitle}
                  </Text>
                  <Text style={[styles.sectionItemCount, { color: colors.textMuted }]}>
                    ({totalMangaCount.toLocaleString()} titles)
                  </Text>
                </View>
              </Animated.View>
            ) : (
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Pressable
                    onPress={handleResetToDiscover}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Discover home"
                  >
                    <Text style={[styles.appTitle, { color: colors.text }]}>Discover</Text>
                  </Pressable>
                </View>

                <View style={styles.headerRight}>
                  <Pressable
                    onPress={openSearchModal}
                    style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1, padding: 6 }]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Search titles"
                  >
                    <Ionicons name="search-outline" size={24} color={colors.text} />
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      triggerHaptic();
                      if (user) {
                        router.push('/profile' as any);
                      } else {
                        router.push('/auth/login' as any);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.plainIconButton,
                      styles.headerProfileBtn,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={user ? 'Open profile' : 'Sign in to Yomite'}
                  >
                    {user ? (
                      avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          style={styles.headerAvatarImg}
                          contentFit="cover"
                          cachePolicy="disk"
                        />
                      ) : (
                        <Ionicons name="person-circle" size={26} color={colors.accent} />
                      )
                    ) : (
                      <Ionicons name="person-circle-outline" size={26} color={colors.text} />
                    )}
                  </Pressable>
                </View>
              </View>
            )
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
              onScrollBeginDrag={handleScrollBeginDrag}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              scrollEventThrottle={16}
              contentContainerStyle={[
                activeSeeAllSection !== null && Platform.OS !== 'web' && { paddingTop: 54 },
                { paddingBottom: activeSeeAllSection !== null ? 70 : (Platform.OS === 'web' ? 32 : 76) },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#F59E0B"
                />
              }
            >
              {isShowingSearch ? (
                /* ─── Search Results ─── */
                <View style={[styles.section, Platform.OS === 'web' && styles.webCenteredContent]}>
                  {Platform.OS !== 'web' ? (
                    activeSeeAllExtension ? (
                      /* Expanded "See All" view for a specific extension */
                      <View>
                        <View style={styles.seeAllHeaderRow}>
                          <Pressable
                            onPress={() => {
                              triggerHaptic();
                              setActiveSeeAllExtension(null);
                            }}
                            style={({ pressed }) => [styles.seeAllBackBtn, pressed && { opacity: 0.6 }]}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Back to cross-extension results"
                          >
                            <Ionicons name="chevron-back" size={24} color={colors.accent} />
                          </Pressable>
                          <View style={styles.seeAllTitleWrap}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
                              {activeSeeAllExtension.source.name} Search Results
                            </Text>
                            <Text style={[styles.sectionItemCount, { color: colors.textMuted }]}>
                              ({activeSeeAllExtension.mangaList.length} titles)
                            </Text>
                          </View>
                        </View>

                        <View style={styles.mangaGrid}>
                          {activeSeeAllExtension.mangaList.map((manga, idx) => {
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
                      </View>
                    ) : (
                      /* Cross-Extension Search Carousels */
                      <View>
                        <View style={styles.sectionHeader}>
                          <View style={styles.sectionHeaderLeft}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                              Extension Search Results
                            </Text>
                            {groupedExtensionResults.length > 0 && (
                              <Text style={[styles.sectionItemCount, { color: colors.textMuted }]}>
                                ({groupedExtensionResults.reduce((acc, g) => acc + g.mangaList.length, 0)} titles)
                              </Text>
                            )}
                          </View>
                        </View>

                        {isSearching ? (
                          <View style={{ gap: 16 }}>
                            {Array.from({ length: 3 }).map((_, i) => (
                              <View key={i} style={{ gap: 8 }}>
                                <Skeleton width={140} height={18} borderRadius={Radius.xs} />
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                                  {Array.from({ length: 4 }).map((_, j) => (
                                    <View key={j} style={{ width: 124 }}>
                                      <Skeleton width={124} height={178} borderRadius={Radius.md} />
                                      <View style={{ marginTop: 8, gap: 5 }}>
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
                        ) : groupedExtensionResults.length === 0 ? (
                          <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                              {searchQuery.trim()
                                ? `No titles match "${searchQuery}" across active extensions`
                                : 'Type a title to search across installed extensions'}
                            </Text>
                          </View>
                        ) : (
                          <View style={{ gap: 20 }}>
                            {groupedExtensionResults.map((group) => (
                              <View key={group.source.id} style={styles.carouselSection}>
                                {/* Header Row: Title & Right Arrow on the SAME row */}
                                <View style={styles.carouselHeaderRow}>
                                  <Pressable
                                    onPress={() => {
                                      triggerHaptic();
                                      setActiveSeeAllExtension(group);
                                    }}
                                    style={({ pressed }) => [
                                      styles.carouselTitleLeft,
                                      { flexDirection: 'row', alignItems: 'center', gap: 8 },
                                      pressed && { opacity: 0.7 },
                                    ]}
                                    hitSlop={8}
                                  >
                                    <ExtensionSourceFavicon
                                      icon={group.source.icon}
                                      letter={group.source.name.charAt(0)}
                                      accentColor={colors.accent}
                                    />
                                    <Text style={[styles.carouselTitle, { color: colors.text }]}>
                                      {group.source.name}
                                    </Text>
                                    <Text style={[styles.sectionItemCount, { color: colors.textMuted }]}>
                                      ({group.mangaList.length})
                                    </Text>
                                  </Pressable>

                                  <Pressable
                                    onPress={() => {
                                      triggerHaptic();
                                      setActiveSeeAllExtension(group);
                                    }}
                                    style={({ pressed }) => [
                                      styles.carouselArrowBtn,
                                      pressed && { opacity: 0.6 },
                                    ]}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                    accessibilityLabel={`See all search results for ${group.source.name}`}
                                  >
                                    <Ionicons name="arrow-forward" size={16} color={colors.accent} />
                                  </Pressable>
                                </View>

                                {/* Horizontal Carousel */}
                                <ScrollView
                                  horizontal
                                  showsHorizontalScrollIndicator={false}
                                  contentContainerStyle={styles.carouselContent}
                                >
                                  {group.mangaList.map((manga, idx) => {
                                    const stat = mangaStatsMap[manga.id];
                                    const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                                    return (
                                      <MangaCard
                                        key={manga.id}
                                        id={manga.id}
                                        index={idx}
                                        width={124}
                                        title={getMangaTitle(manga)}
                                        coverUrl={getMangaCover(manga)}
                                        author={extractAuthorName(manga)}
                                        rating={ratingVal}
                                        follows={stat?.follows ?? null}
                                        onPress={navigateToManga}
                                      />
                                    );
                                  })}
                                </ScrollView>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )
                  ) : (
                    /* Web Search View */
                    <>
                      <View style={styles.sectionHeader}>
                        <View style={styles.sectionHeaderLeft}>
                          <Text style={[styles.sectionTitle, { color: colors.text }]}>Search Results</Text>
                          {searchResults.length > 0 && (
                            <Text style={[styles.sectionItemCount, { color: colors.textMuted }]}>
                              ({totalMangaCount.toLocaleString()} titles)
                            </Text>
                          )}
                        </View>
                      </View>
                      {(isSearching || isChangingPage) ? (
                        <View style={styles.mangaGrid}>
                          {Array.from({ length: 9 }).map((_, i) => (
                            <View
                              key={i}
                              style={{
                                width: 'calc((100% - 80px) / 9)' as any,
                                marginBottom: 12,
                              }}
                            >
                              <Skeleton width="100%" height={feedCardHeight} borderRadius={Radius.md} />
                              <View style={{ marginTop: 6, gap: 4 }}>
                                <Skeleton width="85%" height={12} borderRadius={Radius.xs} />
                                <Skeleton width="50%" height={10} borderRadius={Radius.xs} />
                              </View>
                            </View>
                          ))}
                        </View>
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
                                disabled={currentPage <= 1 || isSearching || isChangingPage}
                                onPress={() => handlePageChange(currentPage - 1)}
                                style={({ pressed }) => [
                                  styles.pageBtn,
                                  { backgroundColor: colors.surfaceElevated },
                                  (currentPage <= 1 || isSearching || isChangingPage) && { opacity: 0.3 },
                                  pressed && { opacity: 0.7 },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel="Previous page"
                              >
                                <Ionicons name="chevron-back" size={15} color={colors.text} />
                                <Text style={[styles.pageBtnText, { color: colors.text }]}>Prev</Text>
                              </Pressable>

                              <View style={styles.pageIndicatorPill}>
                                <Text style={[styles.pageIndicatorText, { color: colors.text }]}>
                                  Page {currentPage} of {Math.ceil(totalMangaCount / PAGE_SIZE)}
                                </Text>
                              </View>

                              <Pressable
                                disabled={currentPage >= Math.ceil(totalMangaCount / PAGE_SIZE) || isSearching || isChangingPage}
                                onPress={() => handlePageChange(currentPage + 1)}
                                style={({ pressed }) => [
                                  styles.pageBtn,
                                  { backgroundColor: colors.surfaceElevated },
                                  (currentPage >= Math.ceil(totalMangaCount / PAGE_SIZE) || isSearching || isChangingPage) && { opacity: 0.3 },
                                  pressed && { opacity: 0.7 },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel="Next page"
                              >
                                <Text style={[styles.pageBtnText, { color: colors.text }]}>Next</Text>
                                <Ionicons name="chevron-forward" size={15} color={colors.text} />
                              </Pressable>
                            </View>
                          )}
                        </>
                      )}
                    </>
                  )}
                </View>
              ) : activeNavId === 'popular' ? (
                <View style={[styles.section, Platform.OS === 'web' && styles.webCenteredContent]}>
                  {/* Flat Feed Segment Switcher */}
                  <View style={styles.feedSegmentContainer}>
                    <View style={styles.feedSegmentTrack}>
                      <Pressable
                        onPress={handleSelectLatest}
                        style={[
                          styles.feedSegmentPill,
                          String(activeNavId) === 'latest' && styles.feedSegmentPillActive,
                          {
                            backgroundColor: String(activeNavId) === 'latest' ? colors.accent : colors.surfaceElevated,
                            borderWidth: 0,
                          },
                        ]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: String(activeNavId) === 'latest' }}
                      >
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={String(activeNavId) === 'latest' ? colors.accentForeground : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.feedSegmentText,
                            String(activeNavId) === 'latest'
                              ? [styles.feedSegmentTextActive, { color: colors.accentForeground }]
                              : styles.feedSegmentTextInactive,
                            String(activeNavId) !== 'latest' && { color: colors.textSecondary },
                          ]}
                        >
                          Latest Updates
                        </Text>
                      </Pressable>

                      {primarySourceId !== 'asurascans' && (
                        <Pressable
                          onPress={handleSelectRecentlyAdded}
                          style={[
                            styles.feedSegmentPill,
                            String(activeNavId) === 'recently_added' && styles.feedSegmentPillActive,
                            {
                              backgroundColor: String(activeNavId) === 'recently_added' ? colors.accent : colors.surfaceElevated,
                              borderWidth: 0,
                            },
                          ]}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: String(activeNavId) === 'recently_added' }}
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={14}
                            color={String(activeNavId) === 'recently_added' ? colors.accentForeground : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.feedSegmentText,
                              String(activeNavId) === 'recently_added'
                                ? [styles.feedSegmentTextActive, { color: colors.accentForeground }]
                                : styles.feedSegmentTextInactive,
                              String(activeNavId) !== 'recently_added' && { color: colors.textSecondary },
                            ]}
                          >
                            Recently Added
                          </Text>
                        </Pressable>
                      )}

                    </View>
                  </View>

                  <View style={styles.flatRankListHeader}>
                    <View style={styles.sectionHeaderLeft}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Top Ranked Titles
                      </Text>
                      <Text style={[styles.sectionItemCount, { color: colors.textMuted }]}>
                        (Top {popular.length} by follows)
                      </Text>
                    </View>
                  </View>

                  {isLoadingPopular ? (
                    <View style={styles.flatRankList}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} width="100%" height={92} borderRadius={Radius.sm} />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.flatRankList}>
                      {popular.slice(0, POPULAR_TOP_LIMIT).map((manga, idx) => {
                        const stat = mangaStatsMap[manga.id];
                        const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                        const tags = manga.attributes.tags.slice(0, 3);
                        const isTopThree = idx < 3;
                        return (
                          <Pressable
                            key={manga.id}
                            onPress={() => navigateToManga(manga.id)}
                            style={({ pressed, hovered }: any) => [
                              styles.flatRankRow,
                              (pressed || hovered) && { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
                              Platform.OS === 'web' && { cursor: 'pointer' as any },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Rank ${idx + 1}: ${getMangaTitle(manga)}`}
                          >
                            <View style={styles.flatRankBadge}>
                              <Text
                                style={[
                                  styles.flatRankNumber,
                                  { color: isTopThree ? '#F59E0B' : '#71717A' },
                                ]}
                              >
                                {String(idx + 1).padStart(2, '0')}
                              </Text>
                            </View>

                            <Image
                              source={{ uri: getMangaCover(manga) ?? undefined }}
                              style={styles.flatRankCover}
                              contentFit="cover"
                              transition={180}
                            />

                            <View style={styles.flatRankBody}>
                              <View style={styles.flatRankTitleRow}>
                                <Text style={[styles.flatRankTitle, { color: colors.text }]} numberOfLines={1}>
                                  {getMangaTitle(manga)}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color="#71717A" />
                              </View>

                              <Text style={[styles.flatRankAuthor, { color: colors.textMuted }]} numberOfLines={1}>
                                {extractAuthorName(manga)}
                              </Text>

                              <View style={styles.flatRankMetaRow}>
                                {ratingVal != null && (
                                  <View style={styles.flatMetaPill}>
                                    <Ionicons name="star" size={11} color="#F59E0B" />
                                    <Text style={styles.flatMetaText}>{ratingVal.toFixed(1)}</Text>
                                  </View>
                                )}
                                {stat?.follows != null && (
                                  <View style={styles.flatMetaPill}>
                                    <Ionicons name="bookmark-outline" size={11} color="#94A3B8" />
                                    <Text style={styles.flatMetaText}>
                                      {formatCompactNumber(stat.follows)} follows
                                    </Text>
                                  </View>
                                )}
                                {tags.map((tag) => (
                                  <View key={tag.id} style={styles.flatTagChip}>
                                    <Text style={styles.flatTagText} numberOfLines={1}>
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
                  {/* ─── Trending Spotlight Hero (Flat & Premium, Container-Free) ─── */}
                  {(Platform.OS === 'web' || activeSeeAllSection === null) && (
                    <View style={[styles.heroSection, Platform.OS === 'web' && styles.webHeroSection]}>
                      {isLoadingPopular || !currentHeroManga ? (
                        <View style={[styles.heroSkeletonWrap, Platform.OS === 'web' && styles.webCenteredContent]}>
                          <Skeleton width="100%" height={Platform.OS === 'web' ? 340 : 380} borderRadius={Platform.OS === 'web' ? Radius.md : 22} />
                        </View>
                      ) : Platform.OS !== 'web' ? (
                        /* Mobile Hero Card: Native Horizontal Pager with Spaced Cards & Infinite Loop */
                        <View style={styles.mobileHeroCardWrap}>
                          <ScrollView
                            ref={mobileHeroScrollRef}
                            horizontal
                            pagingEnabled={false}
                            showsHorizontalScrollIndicator={false}
                            decelerationRate="fast"
                            snapToInterval={heroCardWidth + HERO_CARD_GAP}
                            snapToAlignment="start"
                            disableIntervalMomentum={true}
                            bounces={false}
                            nestedScrollEnabled={true}
                            onScrollBeginDrag={() => {
                              isUserInteractingHeroRef.current = true;
                            }}
                            onScrollEndDrag={(e) => {
                              setTimeout(() => {
                                isUserInteractingHeroRef.current = false;
                              }, 3500);
                              if (e?.nativeEvent && popularSlice.length > 1) {
                                const velX = Math.abs(e.nativeEvent.velocity?.x || 0);
                                if (velX < 0.05) {
                                  const snapInterval = heroCardWidth + HERO_CARD_GAP;
                                  const rawIdx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
                                  if (rawIdx >= popularSlice.length) {
                                    mobileHeroScrollRef.current?.scrollTo({ x: 0, animated: false });
                                    if (heroIndex !== 0) setHeroIndex(0);
                                  }
                                }
                              }
                            }}
                            onMomentumScrollEnd={(e) => {
                              const snapInterval = heroCardWidth + HERO_CARD_GAP;
                              const rawIdx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
                              if (popularSlice.length > 1 && rawIdx >= popularSlice.length) {
                                // Silently snap back to the actual 1st card at offset 0
                                mobileHeroScrollRef.current?.scrollTo({ x: 0, animated: false });
                                if (heroIndex !== 0) {
                                  setHeroIndex(0);
                                }
                              } else if (rawIdx >= 0 && rawIdx < popularSlice.length) {
                                if (rawIdx !== heroIndex) {
                                  setHeroIndex(rawIdx);
                                }
                              }
                              setTimeout(() => {
                                isUserInteractingHeroRef.current = false;
                              }, 2000);
                            }}
                            contentContainerStyle={{
                              paddingRight: 0,
                            }}
                          >
                            {loopHeroCards.map((heroManga, idx) => {
                              const heroStats = mangaStatsMap[heroManga.id];
                              const heroRating = heroStats?.rating?.bayesian || heroStats?.rating?.average || null;
                              const ratingDisplay = heroRating != null && !isNaN(heroRating)
                                ? (heroRating > 5 ? (heroRating / 2).toFixed(1) : heroRating.toFixed(1))
                                : '4.5';
                              let ratingCount: string | null = null;
                              if (heroStats?.rating?.distribution) {
                                const total = Object.values(heroStats.rating.distribution).reduce(
                                  (acc, v) => acc + (typeof v === 'number' ? v : 0),
                                  0
                                );
                                if (total > 0) ratingCount = formatCompactNumber(total);
                              }
                              const coverUri = cachedHeroBanners[heroManga.id] || BannerCacheManager.getCachedUri(heroManga.id) || getMangaCover(heroManga, '512');
                              const placeholderUri = getMangaCover(heroManga, '512');
                              const mangaTitle = getMangaTitle(heroManga);
                              const authorName = extractAuthorName(heroManga);
                              const tags = heroManga.attributes.tags?.slice(0, 3) ?? [];
                              const isLast = idx === loopHeroCards.length - 1;

                              return (
                                <View
                                  key={`${heroManga.id}_loop_${idx}`}
                                  style={{
                                    width: heroCardWidth,
                                    height: 380,
                                    marginRight: isLast ? 0 : HERO_CARD_GAP,
                                  }}
                                >
                                  <Pressable
                                    onPress={() => navigateToManga(heroManga.id)}
                                    style={({ pressed }) => [
                                      styles.mobileHeroCard,
                                      pressed && { opacity: 0.94 },
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Featured: ${mangaTitle}`}
                                  >
                                    {/* 1. Full-Bleed High-Res Background Image */}
                                    {coverUri ? (
                                      <Image
                                        source={getCoverSource(coverUri)}
                                        style={styles.mobileHeroImage}
                                        contentFit="cover"
                                        contentPosition="top"
                                        priority={idx === 0 || idx === loopHeroCards.length - 1 ? 'high' : 'normal'}
                                        cachePolicy="disk"
                                        recyclingKey={coverUri || undefined}
                                        transition={150}
                                      />
                                    ) : (
                                      <View style={[styles.mobileHeroImage, styles.trendingCoverPlaceholder]}>
                                        <Ionicons name="book-outline" size={48} color="#71717A" />
                                      </View>
                                    )}

                                    {/* 2. Seamless Bottom-Fade Gradient */}
                                    <LinearGradient
                                      colors={[
                                        'transparent',
                                        'rgba(15, 17, 23, 0.05)',
                                        'rgba(15, 17, 23, 0.60)',
                                        'rgba(15, 17, 23, 0.94)',
                                      ]}
                                      locations={[0, 0.38, 0.68, 1.0]}
                                      style={styles.mobileHeroGradient}
                                    />

                                    {/* 3. Bottom-Left Overlay Content */}
                                    <View style={styles.mobileHeroOverlayContent} pointerEvents="box-none">
                                      {/* Author Name */}
                                      {authorName ? (
                                        <Text style={styles.mobileHeroAuthor} numberOfLines={1}>
                                          {authorName}
                                        </Text>
                                      ) : null}

                                      {/* Manga Title */}
                                      <Text style={styles.mobileHeroTitle} numberOfLines={2}>
                                        {mangaTitle}
                                      </Text>

                                      {/* Genre / Tag Pills */}
                                      {tags.length > 0 && (
                                        <View style={styles.mobileHeroTagRow}>
                                          {tags.map((t) => {
                                            const tagLabel = t.attributes.name.en ?? Object.values(t.attributes.name)[0];
                                            return (
                                              <View key={t.id} style={styles.mobileHeroTagPill}>
                                                <Text style={styles.mobileHeroTagText} numberOfLines={1}>
                                                  {tagLabel}
                                                </Text>
                                              </View>
                                            );
                                          })}
                                        </View>
                                      )}

                                      {/* Rating & Ratings Count Row */}
                                      <View style={styles.mobileHeroRatingRow}>
                                        <Ionicons name="star" size={13} color="#F59E0B" />
                                        <Text style={styles.mobileHeroRatingVal}>
                                          {ratingDisplay}
                                        </Text>
                                        {ratingCount ? (
                                          <Text style={styles.mobileHeroRatingCount}>
                                            ({ratingCount})
                                          </Text>
                                        ) : null}
                                      </View>
                                    </View>
                                  </Pressable>
                                </View>
                              );
                            })}
                          </ScrollView>
                        </View>
                      ) : (
                        <Animated.View
                          style={[
                            styles.heroBannerFrame,
                            isLightTheme && { backgroundColor: colors.surface, borderWidth: 0 },
                            Platform.OS === 'web' && styles.webHeroBannerFrame,
                            Platform.OS === 'web' && {
                              transform: [{ translateX: heroSlideAnim }],
                              opacity: heroOpacityAnim,
                            },
                          ]}
                        >
                          {/* Cinematic Ambient Backdrop Cover (Soft Blurred & Feathered into Background) */}
                          {currentHeroCover && (
                            <Image
                              source={getCoverSource(currentHeroCover)}
                              style={[styles.heroBackdrop, isLightTheme && { opacity: 0.5 }]}
                              contentFit="cover"
                              blurRadius={Platform.OS === 'web' ? 24 : 18}
                              transition={250}
                            />
                          )}

                          {!isLightTheme && (
                            <LinearGradient
                              colors={[
                                'rgba(11, 12, 14, 0.40)',
                                'rgba(11, 12, 14, 0.72)',
                                colors.background,
                              ]}
                              locations={[0, 0.55, 1.0]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 0, y: 1 }}
                              style={styles.heroBackdropGradient}
                            />
                          )}

                          <View style={[styles.heroInnerContainer, Platform.OS === 'web' && styles.webCenteredContent]}>
                            {/* Carousel header */}
                            <View style={styles.trendingEyebrowRow}>
                              <Text style={[styles.trendingEyebrowText, { color: isLightTheme ? colors.text : '#E4E4E7' }]}>
                                {primarySourceId === 'asurascans' ? 'Trending This Week' : 'Popular New Titles'}
                              </Text>

                              <View style={styles.heroHeaderControls}>
                                <View style={styles.trendingSlideDots}>
                                  {popular.slice(0, 5).map((_, i) => (
                                    <Pressable
                                      key={i}
                                      onPress={() => changeHeroIndex(i, i > heroIndex ? 'next' : 'prev')}
                                      hitSlop={6}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Go to slide ${i + 1}`}
                                    >
                                      <View
                                        style={[
                                          styles.slideDot,
                                          i === (heroIndex % 5) ? styles.slideDotActive : styles.slideDotInactive,
                                          i === (heroIndex % 5)
                                            ? { backgroundColor: colors.accent }
                                            : { backgroundColor: colors.textMuted },
                                        ]}
                                      />
                                    </Pressable>
                                  ))}
                                </View>
                                <View style={styles.heroControls}>
                                  <Pressable
                                    onPress={prevHero}
                                    style={({ pressed }) => [styles.heroArrowBtn, pressed && { opacity: 0.5 }]}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                    accessibilityLabel="Previous title"
                                  >
                                    <Ionicons name="chevron-back" size={18} color={isLightTheme ? colors.text : '#FAFAFA'} />
                                  </Pressable>
                                  <Pressable
                                    onPress={nextHero}
                                    style={({ pressed }) => [styles.heroArrowBtn, pressed && { opacity: 0.5 }]}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                    accessibilityLabel="Next title"
                                  >
                                    <Ionicons name="chevron-forward" size={18} color={isLightTheme ? colors.text : '#FAFAFA'} />
                                  </Pressable>
                                </View>
                              </View>
                            </View>

                            {/* Hero Main Content Row */}
                            <View style={[styles.heroContentRow, Platform.OS === 'web' && styles.webHeroContentRow]}>
                              {/* Left: Floating Borderless Manga Cover Artwork */}
                              <Pressable
                                onPress={() => navigateToManga(currentHeroManga.id)}
                                style={({ pressed }) => [
                                  styles.trendingCoverWrapper,
                                  Platform.OS === 'web' && styles.webTrendingCoverWrapper,
                                  pressed && { opacity: 0.88 },
                                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`View ${currentHeroTitle}`}
                              >
                                {currentHeroCover ? (
                                  <Image
                                    source={getCoverSource(currentHeroCover)}
                                    style={styles.trendingCoverImage}
                                    contentFit="cover"
                                    transition={200}
                                  />
                                ) : (
                                  <View style={[styles.trendingCoverImage, styles.trendingCoverPlaceholder]}>
                                    <Ionicons name="book-outline" size={32} color="#71717A" />
                                  </View>
                                )}
                              </Pressable>

                              {/* Right: Editorial Information & Action Column */}
                              <View style={styles.heroMetaCol}>
                                {/* Title */}
                                <Pressable
                                  onPress={() => navigateToManga(currentHeroManga.id)}
                                  style={({ pressed }) => [
                                    pressed && { opacity: 0.8 },
                                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                                  ]}
                                >
                                  <Text
                                    style={[styles.heroTitleText, Platform.OS === 'web' && styles.webHeroTitleText, isLightTheme && { color: colors.text }]}
                                    numberOfLines={2}
                                  >
                                    {currentHeroTitle}
                                  </Text>
                                </Pressable>

                                {/* Meta Line: Rating, Follows, Author */}
                                <View style={styles.trendingMetaRow}>
                                  {currentHeroRating != null && (
                                    <View style={styles.trendingMetaBadge}>
                                      <Ionicons name="star" size={12} color={colors.accent} />
                                      <Text style={[styles.trendingRatingText, isLightTheme && { color: colors.text }]}>
                                        {currentHeroRating.toFixed(1)}
                                      </Text>
                                    </View>
                                  )}

                                  {currentHeroFollows != null && (
                                    <View style={styles.trendingMetaBadge}>
                                      <Ionicons name="bookmark-outline" size={12} color={isLightTheme ? colors.textSecondary : '#94A3B8'} />
                                      <Text style={[styles.trendingMetaText, isLightTheme && { color: colors.text }]}>
                                        {formatCompactNumber(currentHeroFollows)} follows
                                      </Text>
                                    </View>
                                  )}

                                  {currentHeroAuthor ? (
                                    <Text style={[styles.heroAuthorText, isLightTheme && { color: colors.text }]} numberOfLines={1}>
                                      by {currentHeroAuthor}
                                    </Text>
                                  ) : null}
                                </View>

                                {/* Flat Genre Chips */}
                                <View style={styles.heroTagRow}>
                                  {currentHeroTags.map((t) => {
                                    const tagLabel = (t.attributes.name.en ?? Object.values(t.attributes.name)[0]);
                                    return (
                                      <View key={t.id} style={[styles.heroTagPill, isLightTheme && { backgroundColor: colors.cardBackground, borderWidth: 0 }]}>
                                        <Text style={[styles.heroTagText, isLightTheme && { color: colors.text }]} numberOfLines={1}>
                                          {tagLabel}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                </View>

                                {/* Synopsis Preview */}
                                <Text
                                  style={[
                                    styles.heroSynopsisText,
                                    Platform.OS === 'web' && styles.webHeroSynopsisText,
                                    isLightTheme && { color: colors.text },
                                  ]}
                                  numberOfLines={Platform.OS === 'web' ? 3 : 2}
                                >
                                  {currentHeroDesc}
                                </Text>

                              </View>
                            </View>
                          </View>
                        </Animated.View>
                      )}
                    </View>
                  )}

                  {Platform.OS !== 'web' && activeSeeAllSection === null ? (
                    <View style={{ paddingTop: Spacing.xs }}>
                      {/* 1. Top Rated Manga Carousel */}
                      {(isLoadingCarousels || topRatedManga.length > 0) && (
                        <View style={styles.carouselSection}>
                          <View style={styles.carouselHeaderRow}>
                            <View style={styles.carouselTitleLeft}>
                              <Text style={[styles.carouselTitle, { color: colors.text }]}>Top Rated Manga</Text>
                            </View>
                            <Pressable
                              onPress={() => handleOpenSeeAll('top_rated')}
                              style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.6 }]}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel="See all top rated manga"
                            >
                              <Text style={[styles.seeAllBtnText, { color: colors.accent }]}>See All</Text>
                              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                            </Pressable>
                          </View>

                          {isLoadingCarousels ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                              {Array.from({ length: 4 }).map((_, i) => (
                                <View key={i} style={{ width: 124 }}>
                                  <Skeleton width={124} height={178} borderRadius={Radius.md} />
                                  <View style={{ height: 6 }} />
                                  <Skeleton width={100} height={14} borderRadius={Radius.xs} />
                                </View>
                              ))}
                            </ScrollView>
                          ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                              {topRatedManga.map((manga, idx) => {
                                const stat = mangaStatsMap[manga.id];
                                const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                                return (
                                  <MangaCard
                                    key={manga.id}
                                    id={manga.id}
                                    index={idx}
                                    width={124}
                                    title={getMangaTitle(manga)}
                                    coverUrl={getMangaCover(manga)}
                                    author={extractAuthorName(manga)}
                                    rating={ratingVal}
                                    follows={stat?.follows ?? null}
                                    onPress={navigateToManga}
                                  />
                                );
                              })}
                            </ScrollView>
                          )}
                        </View>
                      )}

                      {/* 2. Most Popular Carousel */}
                      {(isLoadingCarousels || mostPopularManga.length > 0) && (
                        <View style={styles.carouselSection}>
                          <View style={styles.carouselHeaderRow}>
                            <View style={styles.carouselTitleLeft}>
                              <Text style={[styles.carouselTitle, { color: colors.text }]}>
                                {primarySourceId === 'asurascans' ? 'Most Popular All Time' : 'Most Popular'}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => handleOpenSeeAll('most_popular')}
                              style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.6 }]}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel="See all most popular manga"
                            >
                              <Text style={[styles.seeAllBtnText, { color: colors.accent }]}>See All</Text>
                              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                            </Pressable>
                          </View>

                          {isLoadingCarousels ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                              {Array.from({ length: 4 }).map((_, i) => (
                                <View key={i} style={{ width: 124 }}>
                                  <Skeleton width={124} height={178} borderRadius={Radius.md} />
                                  <View style={{ height: 6 }} />
                                  <Skeleton width={100} height={14} borderRadius={Radius.xs} />
                                </View>
                              ))}
                            </ScrollView>
                          ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                              {mostPopularManga.map((manga, idx) => {
                                const stat = mangaStatsMap[manga.id];
                                const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                                return (
                                  <MangaCard
                                    key={manga.id}
                                    id={manga.id}
                                    index={idx}
                                    width={124}
                                    title={getMangaTitle(manga)}
                                    coverUrl={getMangaCover(manga)}
                                    author={extractAuthorName(manga)}
                                    rating={ratingVal}
                                    follows={stat?.follows ?? null}
                                    onPress={navigateToManga}
                                  />
                                );
                              })}
                            </ScrollView>
                          )}
                        </View>
                      )}
                      {/* 3. Recently Added Carousel */}
                      {primarySourceId !== 'asurascans' && (isLoadingCarousels || recentlyAddedManga.length > 0) && (
                        <View style={styles.carouselSection}>
                          <View style={styles.carouselHeaderRow}>
                            <View style={styles.carouselTitleLeft}>
                              <Text style={[styles.carouselTitle, { color: colors.text }]}>Recently Added</Text>
                            </View>
                            <Pressable
                              onPress={() => handleOpenSeeAll('recently_added')}
                              style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.6 }]}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel="See all recently added manga"
                            >
                              <Text style={[styles.seeAllBtnText, { color: colors.accent }]}>See All</Text>
                              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                            </Pressable>
                          </View>

                          {isLoadingCarousels ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                              {Array.from({ length: 4 }).map((_, i) => (
                                <View key={i} style={{ width: 124 }}>
                                  <Skeleton width={124} height={178} borderRadius={Radius.md} />
                                  <View style={{ height: 6 }} />
                                  <Skeleton width={100} height={14} borderRadius={Radius.xs} />
                                </View>
                              ))}
                            </ScrollView>
                          ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                              {recentlyAddedManga.map((manga, idx) => {
                                const stat = mangaStatsMap[manga.id];
                                const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                                return (
                                  <MangaCard
                                    key={manga.id}
                                    id={manga.id}
                                    index={idx}
                                    width={124}
                                    title={getMangaTitle(manga)}
                                    coverUrl={getMangaCover(manga)}
                                    author={extractAuthorName(manga)}
                                    rating={ratingVal}
                                    follows={stat?.follows ?? null}
                                    onPress={navigateToManga}
                                  />
                                );
                              })}
                            </ScrollView>
                          )}
                        </View>
                      )}

                      {/* 4. Latest Updates Carousel */}
                      {(isLoadingCarousels || latestUpdatesManga.length > 0) && (
                        <View style={styles.carouselSection}>
                          <View style={styles.carouselHeaderRow}>
                            <View style={styles.carouselTitleLeft}>
                              <Text style={[styles.carouselTitle, { color: colors.text }]}>Latest Updates</Text>
                            </View>
                            <Pressable
                              onPress={() => handleOpenSeeAll('latest')}
                              style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.6 }]}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel="See all latest updates"
                            >
                              <Text style={[styles.seeAllBtnText, { color: colors.accent }]}>See All</Text>
                              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                            </Pressable>
                          </View>

                          {isLoadingCarousels ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                              {Array.from({ length: 4 }).map((_, i) => (
                                <View key={i} style={{ width: 124 }}>
                                  <Skeleton width={124} height={178} borderRadius={Radius.md} />
                                  <View style={{ height: 6 }} />
                                  <Skeleton width={100} height={14} borderRadius={Radius.xs} />
                                </View>
                              ))}
                            </ScrollView>
                          ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                              {latestUpdatesManga.map((manga, idx) => {
                                const stat = mangaStatsMap[manga.id];
                                const ratingVal = stat?.rating?.bayesian || stat?.rating?.average || null;
                                return (
                                  <MangaCard
                                    key={manga.id}
                                    id={manga.id}
                                    index={idx}
                                    width={124}
                                    title={getMangaTitle(manga)}
                                    coverUrl={getMangaCover(manga)}
                                    author={extractAuthorName(manga)}
                                    rating={ratingVal}
                                    follows={stat?.follows ?? null}
                                    onPress={navigateToManga}
                                  />
                                );
                              })}
                            </ScrollView>
                          )}
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      {/* Web Segment Switcher or Mobile See-All Header */}
                      {Platform.OS === 'web' ? (
                        <View style={[styles.feedSegmentContainer, styles.webCenteredContent]}>
                          <View style={styles.feedSegmentTrack}>
                            <Pressable
                              onPress={handleSelectLatest}
                              style={[
                                styles.feedSegmentPill,
                                activeNavId === 'latest' && styles.feedSegmentPillActive,
                                {
                                  backgroundColor: activeNavId === 'latest' ? colors.accent : colors.surfaceElevated,
                                  borderWidth: 0,
                                },
                              ]}
                              accessibilityRole="tab"
                              accessibilityState={{ selected: activeNavId === 'latest' }}
                            >
                              <Ionicons
                                name="time-outline"
                                size={14}
                                color={activeNavId === 'latest' ? colors.accentForeground : colors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.feedSegmentText,
                                  activeNavId === 'latest'
                                    ? [styles.feedSegmentTextActive, { color: colors.accentForeground }]
                                    : styles.feedSegmentTextInactive,
                                  activeNavId !== 'latest' && { color: colors.textSecondary },
                                ]}
                              >
                                Latest Updates
                              </Text>
                            </Pressable>

                            {primarySourceId !== 'asurascans' && (
                              <Pressable
                                onPress={handleSelectRecentlyAdded}
                                style={[
                                  styles.feedSegmentPill,
                                  activeNavId === 'recently_added' && styles.feedSegmentPillActive,
                                  {
                                    backgroundColor: activeNavId === 'recently_added' ? colors.accent : colors.surfaceElevated,
                                    borderWidth: 0,
                                  },
                                ]}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: activeNavId === 'recently_added' }}
                              >
                                <Ionicons
                                  name="add-circle-outline"
                                  size={14}
                                  color={activeNavId === 'recently_added' ? colors.accentForeground : colors.textSecondary}
                                />
                                <Text
                                  style={[
                                    styles.feedSegmentText,
                                    activeNavId === 'recently_added'
                                      ? [styles.feedSegmentTextActive, { color: colors.accentForeground }]
                                      : styles.feedSegmentTextInactive,
                                    activeNavId !== 'recently_added' && { color: colors.textSecondary },
                                  ]}
                                >
                                  Recently Added
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      ) : null}

                      {/* ─── Dynamic Feed (Latest Updates / Recently Added) ─── */}
                      <View
                        nativeID="feed-section"
                        {...(Platform.OS === 'web' ? { id: 'feed-section' } as any : {})}
                        style={[
                          styles.section,
                          activeSeeAllSection !== null && { marginBottom: 0 },
                          Platform.OS === 'web' && styles.webCenteredContent,
                        ]}
                      >
                        {Platform.OS === 'web' && (
                          <View style={styles.sectionHeader}>
                            <View style={styles.sectionHeaderLeft}>
                              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                {activeFeedTitle}
                              </Text>
                              <Text style={[styles.sectionItemCount, { color: colors.textMuted }]}>
                                ({totalMangaCount.toLocaleString()} titles)
                              </Text>
                            </View>
                          </View>
                        )}

                        {(isLoadingFeed || isChangingPage) ? (
                          <View style={styles.mangaGrid}>
                            {Array.from({ length: Platform.OS === 'web' ? 27 : 18 }).map((_, i) => (
                              <View
                                key={i}
                                style={{
                                  width: Platform.OS === 'web' ? ('calc((100% - 80px) / 9)' as any) : feedCardWidth,
                                  marginBottom: 12,
                                }}
                              >
                                <Skeleton width="100%" height={feedCardHeight} borderRadius={Radius.md} />
                                <View style={{ marginTop: 6, gap: 4 }}>
                                  <Skeleton width="85%" height={12} borderRadius={Radius.xs} />
                                  <Skeleton width="50%" height={10} borderRadius={Radius.xs} />
                                </View>
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
                              disabled={currentPage <= 1 || isLoadingFeed || isChangingPage}
                              onPress={() => handlePageChange(currentPage - 1)}
                              style={({ pressed }) => [
                                styles.pageBtn,
                                { backgroundColor: colors.surfaceElevated },
                                (currentPage <= 1 || isLoadingFeed || isChangingPage) && { opacity: 0.3 },
                                pressed && { opacity: 0.7 },
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Previous page"
                            >
                              <Ionicons name="chevron-back" size={15} color={colors.text} />
                              <Text style={[styles.pageBtnText, { color: colors.text }]}>Prev</Text>
                            </Pressable>

                            <View style={styles.pageIndicatorPill}>
                              <Text style={[styles.pageIndicatorText, { color: colors.text }]}>
                                Page {currentPage} of {Math.ceil(totalMangaCount / PAGE_SIZE)}
                              </Text>
                            </View>

                            <Pressable
                              disabled={currentPage >= Math.ceil(totalMangaCount / PAGE_SIZE) || isLoadingFeed || isChangingPage}
                              onPress={() => handlePageChange(currentPage + 1)}
                              style={({ pressed }) => [
                                styles.pageBtn,
                                { backgroundColor: colors.surfaceElevated },
                                (currentPage >= Math.ceil(totalMangaCount / PAGE_SIZE) || isLoadingFeed || isChangingPage) && { opacity: 0.3 },
                                pressed && { opacity: 0.7 },
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Next page"
                            >
                              <Text style={[styles.pageBtnText, { color: colors.text }]}>Next</Text>
                              <Ionicons name="chevron-forward" size={15} color={colors.text} />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Web Left Overlay Slide Drawer Modal */}
      {Platform.OS === 'web' && (
        <SidebarDrawer
          visible={mobileDrawerVisible}
          onClose={() => setMobileDrawerVisible(false)}
          onSelectLatest={handleSelectLatest}
          onSelectRecentlyAdded={handleSelectRecentlyAdded}
          onSelectRandom={handleSelectRandom}
          onSelectPopular={handleSelectPopular}
          showRecentlyAdded={primarySourceId !== 'asurascans'}
        />
      )}


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

      {/* Cross-extension search — rendered as an overlay above the whole
          Discover scene (incl. the floating tab bar) so the source catalog
          can slide away on top of it and reveal the restored results. */}
      <SearchResultsModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onSelectManga={(id) => {
          setSearchModalVisible(false);
          navigateToManga(id);
        }}
        onViewAll={handleOpenSourceCatalog}
        initialQuery={searchInitialQuery}
        animateIn={searchModalAnimateIn}
      />
    </>
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

  /* Mobile Multi-Carousel Discover Styles */
  carouselSection: {
    marginBottom: Spacing.xl,
  },
  carouselHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  carouselTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carouselTitle: {
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.3,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 0,
  },
  seeAllBtnText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
  },
  carouselArrowBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselContent: {
    paddingHorizontal: Spacing.md,
    gap: CARD_GAP,
  },
  seeAllHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  seeAllBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 0,
    paddingLeft: 0,
  },
  seeAllBackText: {
    fontSize: 15,
    fontWeight: '600',
  },
  seeAllTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
    borderWidth: 0,
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
    overflow: Platform.OS !== 'web' ? 'hidden' : 'visible',
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  mobileSearchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    height: 40,
  },
  mobileSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  stickySeeAllHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
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
  headerProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  appTitle: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
    lineHeight: 30,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    maxHeight: 44,
    borderRadius: Radius.lg,
    borderWidth: 0,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    height: '100%',
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
    borderWidth: 0,
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
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  activeFilterText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },

  /* Hero Section (MangaDex Popular New Titles) */
  heroSection: {
    paddingHorizontal: Platform.OS === 'web' ? 0 : Spacing.md,
    paddingTop: Platform.OS === 'web' ? 0 : Spacing.xs,
    marginBottom: 18,
  },
  heroSectionTitle: {
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.md,
  },
  /* Mobile Featured Banner (Poster Card with Bottom-Left Overlay) */
  mobileHeroCardWrap: {
    width: '100%',
  },
  mobileHeroCard: {
    width: '100%',
    height: 380,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#18181B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  mobileHeroImage: {
    width: '100%',
    height: '100%',
  },
  mobileHeroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mobileHeroTopControls: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
  },
  mobileHeroSlideDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
  },
  mobileHeroDot: {
    height: 4,
    borderRadius: 2,
  },
  mobileHeroDotActive: {
    width: 16,
    backgroundColor: '#FFFFFF',
  },
  mobileHeroDotInactive: {
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  mobileHeroOverlayContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 40,
  },
  mobileHeroAuthor: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mobileHeroTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.3,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  mobileHeroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  mobileHeroTagPill: {
    backgroundColor: 'rgba(28, 28, 34, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mobileHeroTagText: {
    color: '#F4F4F5',
    fontSize: 11,
    fontWeight: '600',
  },
  mobileHeroRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mobileHeroRatingVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  mobileHeroRatingCount: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '400',
  },
  heroBannerFrame: {
    borderRadius: Radius.xl,
    borderWidth: 0,
    backgroundColor: '#12141A',
    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
    position: 'relative',
    minHeight: 240,
    zIndex: 100,
  },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.32,
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
    padding: Spacing.md,
    gap: 14,
    alignItems: 'flex-start',
  },
  heroCoverCard: {
    width: 135,
    height: 200,
    borderRadius: Radius.sm,
    borderWidth: 0,
    overflow: 'hidden',
  },
  heroCoverImage: {
    width: '100%',
    height: '100%',
  },
  heroMetaCol: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 7,
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 0,
    paddingHorizontal: Platform.OS === 'web' ? 10 : 6,
    paddingVertical: Platform.OS === 'web' ? 4 : 2,
    borderRadius: Radius.sm,
  },
  heroTagText: {
    color: '#FAFAFA',
    fontSize: Platform.OS === 'web' ? 11 : 9,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  heroSynopsisText: {
    color: '#D4D4D8',
    fontSize: Platform.OS === 'web' ? 15 : 11,
    lineHeight: Platform.OS === 'web' ? 23 : 15,
    fontStyle: 'italic',
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
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 20,
    height: 36,
    maxHeight: 36,
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

  /* Borderless discovery controls and ranked feed */
  feedSegmentContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  feedSegmentTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    padding: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  feedSegmentPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    backgroundColor: '#14161D',
  },
  feedSegmentPillActive: {
    backgroundColor: '#F59E0B',
    borderWidth: 0,
  },
  feedSegmentText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  feedSegmentTextActive: { fontWeight: '700' },
  feedSegmentTextInactive: { color: '#D4D4D8' },
  flatRankListHeader: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  flatRankList: { paddingHorizontal: Spacing.md },
  flatRankRow: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  flatRankBadge: { width: 28, alignItems: 'flex-start' },
  flatRankNumber: {
    fontSize: Typography.sizes.callout,
    fontWeight: Typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  flatRankCover: {
    width: 54,
    height: 76,
    borderRadius: Radius.sm,
    backgroundColor: '#1F1F23',
  },
  flatRankBody: { flex: 1, minWidth: 0, gap: 5 },
  flatRankTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flatRankTitle: { flex: 1, fontSize: Typography.sizes.callout, fontWeight: Typography.weights.semibold },
  flatRankAuthor: { fontSize: Typography.sizes.caption, fontWeight: Typography.weights.medium },
  flatRankMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  flatMetaPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flatMetaText: { color: '#A1A1AA', fontSize: 10, fontWeight: Typography.weights.medium },
  flatTagChip: { maxWidth: 110, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.xs, backgroundColor: '#27272A' },
  flatTagText: { color: '#A1A1AA', fontSize: 9, fontWeight: Typography.weights.medium },

  /* Trending spotlight, intentionally image-led and container-free */
  heroSkeletonWrap: { paddingHorizontal: 0 },
  heroInnerContainer: { flex: 1, padding: Spacing.lg },
  trendingEyebrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  heroHeaderControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trendingEyebrowText: { fontSize: Typography.sizes.headline, fontWeight: Typography.weights.bold },
  trendingSlideDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  slideDot: { width: 5, height: 5, borderRadius: 3 },
  slideDotActive: { width: 18, backgroundColor: '#FAFAFA' },
  slideDotInactive: { backgroundColor: 'rgba(255,255,255,0.38)' },
  trendingCoverWrapper: {
    width: 112,
    height: 160,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  webTrendingCoverWrapper: { width: 180, height: 260 },
  trendingCoverImage: { width: '100%', height: '100%' },
  trendingCoverPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#27272A' },
  trendingMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  trendingMetaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendingRatingText: { color: '#FAFAFA', fontSize: Typography.sizes.footnote, fontWeight: Typography.weights.bold },
  trendingMetaText: { color: '#D4D4D8', fontSize: Typography.sizes.footnote, fontWeight: Typography.weights.medium },

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
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    minWidth: 0,
  },
  sectionItemCount: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
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
    borderWidth: 0,
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
    borderWidth: 0,
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
    borderWidth: 0,
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
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
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
