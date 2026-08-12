/**
 * SidebarDrawer — Left Sidebar Navigation Menu
 * Branding: Yomite (with Anime Mascot Logo)
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';

type VectorIcon = React.ComponentProps<typeof Ionicons>['name'];

interface SidebarItem {
  id: string;
  label: string;
  icon: VectorIcon;
  action: () => void;
  badge?: string;
}

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSelectAdvancedSearch: () => void;
  onSelectLatest: () => void;
  onSelectRecentlyAdded: () => void;
  onSelectRandom: () => void;
  onSelectPopular: () => void;
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

  const navItems: SidebarItem[] = [
    {
      id: 'advanced_search',
      label: 'Advanced Search',
      icon: 'options-outline',
      action: () => {
        onClose();
        onSelectAdvancedSearch();
      },
      badge: 'Filter',
    },
    {
      id: 'popular',
      label: 'Popular New Titles',
      icon: 'sparkles-outline',
      action: () => {
        onClose();
        onSelectPopular();
      },
    },
    {
      id: 'latest',
      label: 'Latest Updates',
      icon: 'time-outline',
      action: () => {
        onClose();
        onSelectLatest();
      },
    },
    {
      id: 'recently_added',
      label: 'Recently Added',
      icon: 'add-circle-outline',
      action: () => {
        onClose();
        onSelectRecentlyAdded();
      },
    },
    {
      id: 'random',
      label: 'Random Manga',
      icon: 'dice-outline',
      action: () => {
        onClose();
        onSelectRandom();
      },
    },
  ];

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
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Navigation Items */}
          <ScrollView contentContainerStyle={styles.itemList}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              DISCOVER & NAVIGATION
            </Text>

            {navItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={item.action}
                style={({ pressed }) => [
                  styles.itemRow,
                  {
                    backgroundColor: pressed ? colors.surfaceElevated : 'transparent',
                    borderColor: colors.borderSubtle,
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
    width: 280,
    height: '100%',
    borderRightWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
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
  sectionHeading: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  itemList: {
    gap: Spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.md,
  },
  itemLabel: {
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
  drawerFooter: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: Typography.sizes.caption,
  },
});
