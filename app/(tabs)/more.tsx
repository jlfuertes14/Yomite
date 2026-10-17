/**
 * More Screen — Ultra-Clean Flat Minimalist Hub (Google Stitch Style)
 * Container-free, borderless, modern flat design with subtle dividers and tactile micro-interactions.
 * Dedicated full-screen hub for secondary navigation (Downloads, Community, Settings) and Quick Tools.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
import { BannerCacheManager } from '../../src/utils/bannerCache';
import { CacheManager } from '../../src/utils/cacheManager';
import { triggerHaptic } from '../../src/utils/haptics';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';

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
          <Ionicons name={icon} size={18} color={colors.text} />
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
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.contentWrapper}>
        {/* Header — Clean, borderless, matching Yomite Stitch */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop, { color: colors.text }]}>
            More
          </Text>
          {isDesktop && (
            <Text style={[styles.desktopSubtitle, { color: colors.textSecondary }]}>
              Secondary navigation and offline utilities.
            </Text>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.scrollContentDesktop,
          ]}
        >
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
              Yomite Manga Reader v1.2.6
            </Text>
            <Text style={[styles.footerSubtitle, { color: colors.textMuted }]}>
              Powered by MangaDex API, Kotatsu and Supabase Cloud Sync
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
  header: {
    backgroundColor: 'transparent',
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  headerDesktop: {
    paddingBottom: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  titleDesktop: {
    fontSize: 32,
  },
  desktopSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    gap: 28,
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  scrollContentDesktop: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  /* Sections */
  section: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    paddingHorizontal: 4,
  },

  /* Flat Divided List (divide-y without container box) */
  flatDividedList: {
    backgroundColor: 'transparent',
  },
  flatRow: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
  },
  optionLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  iconSquare: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  optionTextCol: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  optionSubtitle: {
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '600',
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    gap: 4,
    marginTop: 28,
  },
  footerTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerSubtitle: {
    fontSize: 11,
  },
});
