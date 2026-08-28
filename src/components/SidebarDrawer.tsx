/**
 * SidebarDrawer — Left Slide Drawer Navigation Menu
 * Branding: Yomite (with Anime Mascot Logo)
 * Contains both Main Navigation Links and Discover Quick Filters.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';

type VectorIcon = React.ComponentProps<typeof Ionicons>['name'];

interface NavigationItem {
  id: string;
  label: string;
  icon: VectorIcon;
  path: string;
}

interface FilterItem {
  id: string;
  label: string;
  icon: VectorIcon;
  action: () => void;
  badge?: string;
}

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSelectAdvancedSearch?: () => void;
  onSelectLatest?: () => void;
  onSelectRecentlyAdded?: () => void;
  onSelectRandom?: () => void;
  onSelectPopular?: () => void;
}

export function SidebarDrawer({
  visible,
  onClose,
  onSelectAdvancedSearch,
  onSelectLatest,
  onSelectRecentlyAdded,
  onSelectRandom,
  onSelectPopular,
}: SidebarDrawerProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();

  const mainPages: NavigationItem[] = [
    { id: 'discover', label: 'Discover', icon: 'compass-outline', path: '/' },
    ...(Platform.OS === 'web'
      ? [{ id: 'download', label: 'Get Mobile App', icon: 'cloud-download-outline' as const, path: '/download' }]
      : []),
    { id: 'library', label: 'Library', icon: 'library-outline', path: '/library' },
    { id: 'downloads', label: 'Downloads', icon: 'download-outline', path: '/downloads' },
    { id: 'extensions', label: 'Extensions', icon: 'grid-outline', path: '/extensions' },
    { id: 'community', label: 'Community', icon: 'chatbubbles-outline', path: '/community' },
    { id: 'history', label: 'History', icon: 'time-outline', path: '/history' },
    { id: 'profile', label: 'My Profile', icon: 'person-outline', path: '/profile' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline', path: '/settings' },
  ];

  const filterItems: FilterItem[] = [
    {
      id: 'advanced_search',
      label: 'Advanced Search',
      icon: 'options-outline',
      action: () => {
        onClose();
        if (onSelectAdvancedSearch) {
          onSelectAdvancedSearch();
        } else {
          router.push('/(tabs)' as any);
        }
      },
      badge: 'Filter',
    },
    {
      id: 'popular',
      label: 'Popular New Titles',
      icon: 'trending-up-outline',
      action: () => {
        onClose();
        if (onSelectPopular) {
          onSelectPopular();
        } else {
          router.push('/(tabs)' as any);
        }
      },
    },
    {
      id: 'latest',
      label: 'Latest Updates',
      icon: 'time-outline',
      action: () => {
        onClose();
        if (onSelectLatest) {
          onSelectLatest();
        } else {
          router.push('/(tabs)' as any);
        }
      },
    },
    {
      id: 'recently_added',
      label: 'Recently Added',
      icon: 'add-circle-outline',
      action: () => {
        onClose();
        if (onSelectRecentlyAdded) {
          onSelectRecentlyAdded();
        } else {
          router.push('/(tabs)' as any);
        }
      },
    },
    {
      id: 'random',
      label: 'Random Manga',
      icon: 'dice-outline',
      action: () => {
        onClose();
        if (onSelectRandom) {
          onSelectRandom();
        } else {
          router.push('/(tabs)' as any);
        }
      },
    },
  ];

  const isPageActive = (path: string) => {
    if (path === '/') {
      return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index' || pathname === '';
    }
    if (path === '/download') {
      return pathname === '/download';
    }
    if (path === '/profile') {
      return pathname === '/profile';
    }
    return pathname.includes(path);
  };

  const handleNavigate = (path: string) => {
    onClose();
    if (path === '/') {
      router.push('/(tabs)' as any);
    } else if (path === '/profile' || path === '/download') {
      router.push(path as any);
    } else {
      router.push(`/(tabs)${path}` as any);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={[styles.drawerContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Drawer Header with Anime Mascot & Yomite */}
          <View style={styles.drawerHeader}>
            <Pressable
              onPress={() => handleNavigate('/')}
              style={({ pressed }) => [
                styles.brandRow,
                pressed && { opacity: 0.75 },
                Platform.OS === 'web' && { cursor: 'pointer' },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Navigate to Discover Home"
            >
              <View style={[styles.mascotAvatar, { borderColor: colors.border }]}>
                <Image
                  source={require('../../assets/images/mascot.png')}
                  style={styles.mascotImage}
                  contentFit="cover"
                />
              </View>
              <View>
                <Text style={[styles.brandTitle, { color: colors.text }]}>Yomite</Text>
                <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>Manga & Comic Reader</Text>
              </View>
            </Pressable>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.itemList}>
            {/* Section 1: Main App Navigation (Web Only) */}
            {Platform.OS === 'web' && (
              <>
                <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
                  MAIN NAVIGATION
                </Text>

                {mainPages.map((page) => {
                  const active = isPageActive(page.path);
                  return (
                    <Pressable
                      key={page.id}
                      onPress={() => handleNavigate(page.path)}
                      style={({ pressed }) => [
                        styles.itemRow,
                        {
                          backgroundColor: pressed ? colors.surfaceElevated : 'transparent',
                          borderColor: 'transparent',
                        },
                      ]}
                    >
                      <Ionicons
                        name={page.icon}
                        size={18}
                        color={active ? colors.accent : colors.text}
                      />
                      <Text
                        style={[
                          styles.itemLabel,
                          {
                            color: active ? colors.accent : colors.text,
                            fontWeight: active ? Typography.weights.bold : Typography.weights.medium,
                          },
                        ]}
                      >
                        {page.label}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={active ? colors.accent : colors.textMuted}
                      />
                    </Pressable>
                  );
                })}

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
              </>
            )}

            {/* Section 2: Discover & Filters */}
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              DISCOVER & QUICK FILTERS
            </Text>

            {filterItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={item.action}
                style={({ pressed }) => [
                  styles.itemRow,
                  {
                    backgroundColor: pressed ? colors.surfaceElevated : 'transparent',
                    borderColor: 'transparent',
                  },
                ]}
              >
                <Ionicons name={item.icon} size={18} color={colors.text} />
                <Text style={[styles.itemLabel, { color: colors.text }]}>
                  {item.label}
                </Text>
                {item.badge ? (
                  <View style={[styles.badge, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}>
                    <Text style={[styles.badgeText, { color: colors.accent }]}>{item.badge}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                )}
              </Pressable>
            ))}
          </ScrollView>

          {/* Drawer Footer */}
          <View style={[styles.drawerFooter, { borderTopColor: colors.border }]}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              Yomite v1.0.0 · MangaDex v5
            </Text>
          </View>
        </SafeAreaView>

        <Pressable style={styles.overlayPress} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
  },
  overlayPress: {
    flex: 1,
  },
  drawerContent: {
    width: 290,
    height: '100%',
    borderRightWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mascotAvatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 1.5,
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
  brandSubtitle: {
    fontSize: 10,
    marginTop: -2,
  },
  closeBtn: {
    padding: 4,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  itemList: {
    gap: 4,
    paddingBottom: Spacing.md,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  itemLabel: {
    flex: 1,
    fontSize: Typography.sizes.body - 1,
    fontWeight: Typography.weights.medium,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  drawerFooter: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    marginTop: 'auto',
    gap: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: Typography.weights.medium,
  },
  footerText: {
    fontSize: Typography.sizes.caption,
  },
});
