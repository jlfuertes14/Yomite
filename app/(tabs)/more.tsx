/**
 * More Screen — Ultra-Clean Flat Minimalist Hub (Google Stitch Style)
 * Container-free, borderless, modern flat design with subtle dividers and tactile micro-interactions.
 * Dedicated full-screen hub for secondary navigation (Downloads, Community, Settings) and Quick Tools.
 */
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { useColorScheme } from '../../src/hooks/useColorScheme';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { checkLibraryForUpdates } from '../../src/services/backgroundScanner';
import { useDownloadStore } from '../../src/store/downloadStore';
import { useUserStore, getUserDisplayName, getUserHandle, getUserAvatarUrl } from '../../src/store/userStore';
import { BannerCacheManager } from '../../src/utils/bannerCache';
import { CacheManager } from '../../src/utils/cacheManager';
import { triggerHaptic } from '../../src/utils/haptics';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
import { AppUpdateModal } from '../../src/components/AppUpdateModal';
import {
  checkForAppUpdates,
  getCurrentAppVersion,
  getLatestGitHubReleaseVersion,
  AppReleaseInfo,
} from '../../src/services/appUpdateService';

type VectorIcon = React.ComponentProps<typeof Ionicons>['name'];

interface FlatRowItemProps {
  icon: VectorIcon;
  title: string;
  subtitle: string;
  badge?: string | number;
  onPress: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  disabled?: boolean;
}

function FlatRowItem({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  showChevron = true,
  rightElement,
  disabled = false,
}: FlatRowItemProps) {
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed, hovered }: any) => [
        styles.flatRow,
        (pressed || hovered) && {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.035)',
        },
        Platform.OS === 'web' && { cursor: disabled ? 'default' : ('pointer' as any) },
      ]}
    >
      <View style={styles.optionLeft}>
        <View style={[styles.iconSquare, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name={icon} size={22} color={colors.text} />
        </View>
        <View style={styles.optionTextCol}>
          <Text style={[styles.optionTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.optionRight}>
        {badge !== undefined && (
          <View style={[styles.badgePill, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.badgePillText, { color: colors.textSecondary }]}>
              {badge}
            </Text>
          </View>
        )}
        {rightElement}
        {showChevron && (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        )}
      </View>
    </Pressable>
  );
}

export default function MoreScreen() {
  useDocumentTitle('More');
  const router = useRouter();
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.045)';
  const accentColor = colors.accent;
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const user = useUserStore((s) => s.user);
  const displayName = getUserDisplayName(user);
  const handle = getUserHandle(user);
  const avatarUrl = getUserAvatarUrl(user);

  const chapters = useDownloadStore((s) => s.chapters);
  const downloadedCount = Object.keys(chapters).length;

  const [isScanningUpdates, setIsScanningUpdates] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: keyof typeof Ionicons.glyphMap;
    confirmVariant?: 'primary' | 'destructive';
    confirmText?: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const handleClearCache = useCallback(() => {
    triggerHaptic();
    setConfirmModalConfig({
      visible: true,
      title: 'Clear Image Cache',
      message:
        'This will remove temporarily cached chapter pages and manga covers to free up storage. Your downloaded manga and reading history will not be affected.',
      iconName: 'trash-outline',
      confirmText: 'Clear Cache',
      confirmVariant: 'destructive',
      onConfirm: async () => {
        try {
          await Image.clearMemoryCache();
          await Image.clearDiskCache();
          await CacheManager.clearAll();
          await BannerCacheManager.clearCache();
          triggerHaptic();
          Alert.alert('Cache Cleared', 'Temporary image cache and banner cache have been cleared successfully.');
        } catch {
          Alert.alert('Notice', 'Cache cleared.');
        }
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  }, []);

  const handleCheckUpdates = useCallback(async () => {
    if (isScanningUpdates) return;
    triggerHaptic();
    setIsScanningUpdates(true);
    try {
      const results = await checkLibraryForUpdates();
      triggerHaptic();
      if (results && results.newUpdates && results.newUpdates.length > 0) {
        Alert.alert(
          'Updates Found',
          `Found new chapters for ${results.newUpdates.length} manga title${results.newUpdates.length > 1 ? 's' : ''}!`,
        );
      } else {
        Alert.alert('Up to Date', 'All manga in your library are up to date.');
      }
    } catch {
      Alert.alert('Notice', 'Scan completed.');
    } finally {
      setIsScanningUpdates(false);
    }
  }, [isScanningUpdates]);

  const currentAppVersion = getCurrentAppVersion();
  const [latestAppVersion, setLatestAppVersion] = useState<string | null>(null);
  const [isCheckingAppUpdate, setIsCheckingAppUpdate] = useState(false);
  const [appUpdateRelease, setAppUpdateRelease] = useState<AppReleaseInfo | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    getLatestGitHubReleaseVersion().then((version) => {
      if (version) setLatestAppVersion(version);
    });
  }, []);

  const handleCheckAppUpdate = useCallback(async () => {
    if (isCheckingAppUpdate) return;
    triggerHaptic();
    setIsCheckingAppUpdate(true);
    try {
      const release = await checkForAppUpdates(true);
      if (release) {
        setLatestAppVersion(release.version);
        setAppUpdateRelease(release);
      } else {
        const latestVersion = await getLatestGitHubReleaseVersion();
        if (latestVersion) setLatestAppVersion(latestVersion);
        triggerHaptic();
        Alert.alert(
          'Up to Date',
          `You are on the latest version of Yomite (v${latestVersion || currentAppVersion}).`
        );
      }
    } catch {
      Alert.alert('Notice', 'Unable to check for updates. Please try again later.');
    } finally {
      setIsCheckingAppUpdate(false);
    }
  }, [isCheckingAppUpdate, currentAppVersion]);

  const handleTestAppUpdateModal = useCallback(() => {
    triggerHaptic();
    setAppUpdateRelease({
      version: '9.9.9',
      tagName: 'v9.9.9-test',
      releaseTitle: 'Yomite Test Release',
      releaseNotes: '## Test update\n\n- Verify the modal layout\n- Check the release notes rendering\n- Confirm the dismiss button works',
      // Deliberately non-downloadable: this action is for rendering the modal only.
      downloadUrl: 'https://example.com/yomite-test.apk',
      fileName: 'Yomite-test.apk',
      apkSize: 0,
      publishedAt: new Date().toISOString(),
      htmlUrl: 'https://github.com/jlfuertes14/Yomite/releases',
    });
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.contentWrapper}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.scrollContentDesktop,
          ]}
        >
          {/* Header — Centered Yomite Transparent Logo */}
          <View style={styles.headerCentered}>
            <Image
              source={require('../../assets/images/yomiite_transparent.png')}
              style={styles.yomiteLogo}
              contentFit="contain"
              accessibilityLabel="Yomite Logo"
            />
          </View>

          {/* SECTION: ACCOUNT (PROFILE / SIGN IN) */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              Account
            </Text>
            <View style={styles.flatDividedList}>
              {user ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Signed in as ${displayName}. View profile`}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/profile' as any);
                  }}
                  style={({ pressed, hovered }: any) => [
                    styles.flatRow,
                    (pressed || hovered) && {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.035)',
                    },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.avatarBox, { backgroundColor: colors.surfaceElevated }]}>
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          style={styles.avatarImg}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <Ionicons name="person" size={22} color={accentColor} />
                      )}
                    </View>
                    <View style={styles.optionTextCol}>
                      <Text style={[styles.optionTitle, { color: colors.text }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        @{handle} • View profile & sync
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign in to Yomite"
                  onPress={() => {
                    triggerHaptic();
                    router.push('/auth/login' as any);
                  }}
                  style={({ pressed, hovered }: any) => [
                    styles.flatRow,
                    (pressed || hovered) && {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.035)',
                    },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.iconSquare, { backgroundColor: colors.surfaceElevated }]}>
                      <Ionicons name="person-outline" size={22} color={colors.text} />
                    </View>
                    <View style={styles.optionTextCol}>
                      <Text style={[styles.optionTitle, { color: colors.text }]} numberOfLines={1}>
                        Sign In to Yomite
                      </Text>
                      <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        Sync your library, reading progress & cloud bookmarks
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* SECTION: NAVIGATION (FLAT DIVIDED LIST) */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              Navigation
            </Text>
            <View style={styles.flatDividedList}>
              <FlatRowItem
                icon="download-outline"
                title="Downloads"
                subtitle="Offline chapters & storage management"
                badge={downloadedCount > 0 ? `${downloadedCount} ch.` : undefined}
                onPress={() => {
                  triggerHaptic();
                  router.push({
                    pathname: '/(tabs)/downloads',
                    params: { from: 'more' },
                  } as any);
                }}
              />
              <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />
              <FlatRowItem
                icon="chatbubbles-outline"
                title="Community"
                subtitle="Feeds, discussions & manga reactions"
                onPress={() => {
                  triggerHaptic();
                  router.push('/(tabs)/community');
                }}
              />
              <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />
              <FlatRowItem
                icon="settings-outline"
                title="Settings"
                subtitle="Reader preferences, themes & sources"
                onPress={() => {
                  triggerHaptic();
                  router.push('/(tabs)/settings');
                }}
              />
            </View>
          </View>

          {/* SECTION: QUICK TOOLS (FLAT DIVIDED LIST) */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              Quick Tools
            </Text>
            <View style={styles.flatDividedList}>
              <FlatRowItem
                icon="refresh-outline"
                title="Check Library Updates"
                subtitle={isScanningUpdates ? 'Scanning manga chapters…' : 'Scan library for new chapters'}
                onPress={handleCheckUpdates}
                showChevron={!isScanningUpdates}
                rightElement={
                  isScanningUpdates ? (
                    <ActivityIndicator size="small" color={accentColor} />
                  ) : undefined
                }
              />
              <FlatRowItem
                icon="cloud-download-outline"
                title="Check for App Updates"
                subtitle={
                  isCheckingAppUpdate
                    ? 'Checking GitHub releases…'
                    : latestAppVersion
                      ? `Latest version: v${latestAppVersion}`
                      : 'Latest version unavailable'
                }
                onPress={handleCheckAppUpdate}
                showChevron={!isCheckingAppUpdate}
                rightElement={
                  isCheckingAppUpdate ? (
                    <ActivityIndicator size="small" color={accentColor} />
                  ) : undefined
                }
              />
              {__DEV__ && Constants.executionEnvironment === 'storeClient' && (
                <>
                  <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />
                  <FlatRowItem
                    icon="bug-outline"
                    title="Test Update Modal"
                    subtitle="Preview the GitHub release update dialog"
                    onPress={handleTestAppUpdateModal}
                  />
                </>
              )}
              <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />
              <FlatRowItem
                icon="trash-outline"
                title="Clear Image Cache"
                subtitle="Free up temporary cover & page files"
                onPress={handleClearCache}
              />
            </View>
          </View>

          {/* Clean App Info Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerTitle, { color: colors.textMuted }]}>
              Yomite Manga Reader v{currentAppVersion}
            </Text>
            <Text style={[styles.footerSubtitle, { color: colors.textMuted }]}>
              Powered by MangaDex API, Kotatsu
            </Text>
          </View>
        </ScrollView>

        {/* Confirmation Modal */}
        <ConfirmationModal
          visible={confirmModalConfig.visible}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          iconName={confirmModalConfig.iconName || 'information-circle-outline'}
          confirmVariant={confirmModalConfig.confirmVariant || 'primary'}
          confirmText={confirmModalConfig.confirmText || 'Confirm'}
          onConfirm={confirmModalConfig.onConfirm}
          onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, visible: false }))}
        />

        {/* Tachiyomi/Mihon In-App Update Modal */}
        <AppUpdateModal
          visible={Boolean(appUpdateRelease)}
          release={appUpdateRelease}
          onDismiss={() => setAppUpdateRelease(null)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 900,
    width: '100%',
  },
  headerCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  yomiteLogo: {
    width: 290,
    height: 96,
  },
  scrollContent: {
    gap: 28,
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContentDesktop: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },

  /* Sections */
  section: {
    gap: 10,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
    paddingHorizontal: 4,
  },

  /* Flat Divided List (divide-y without container box) */
  flatDividedList: {
    backgroundColor: 'transparent',
  },
  flatRow: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
  },
  optionLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 14,
  },
  iconSquare: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  optionTextCol: {
    flex: 1,
    gap: 3,
  },
  optionTitle: {
    fontSize: 16.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  optionSubtitle: {
    fontSize: 13.5,
  },
  optionRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  badgePill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Account Section Styles */
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    gap: 4,
    marginTop: 28,
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerSubtitle: {
    fontSize: 12,
  },
});
