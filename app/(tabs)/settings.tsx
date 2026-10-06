/**
 * Settings Screen — Ultra-Clean Flat Minimalist Theme (Google Stitch Style)
 * Container-free, borderless, modern flat design with subtle dividers and tactile micro-interactions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { ReaderThemes } from '../../constants/Colors';
import { useReaderStore } from '../../src/store/readerStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { useUserStore, getUserDisplayName, getUserHandle, getUserAvatarUrl } from '../../src/store/userStore';
import {
  useThemeStore,
  AppThemeMode,
  THEME_SCHEME_PRESETS,
} from '../../src/store/themeStore';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { requestNotificationPermissions, sendNewChapterNotification } from '../../src/services/notificationService';
import { registerLibraryScanTask } from '../../src/services/backgroundScanner';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { YomiteMascotIcon } from '../../src/components/YomiteMascotIcon';
import type { ReadingMode, ReaderTheme } from '../../src/types';
import { triggerHaptic } from '../../src/utils/haptics';

import { AuthModal } from '../../src/components/AuthModal';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { syncUserDataWithCloud } from '../../src/services/cloudSync';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';

type VectorIcon = React.ComponentProps<typeof Ionicons>['name'];

const READING_MODES: { key: ReadingMode; label: string; icon: VectorIcon }[] = [
  { key: 'webtoon', label: 'Webtoon (Vertical scroll)', icon: 'journal-outline' },
  { key: 'rtl', label: 'Right to left (Manga)', icon: 'arrow-back-outline' },
  { key: 'ltr', label: 'Left to right (Comic)', icon: 'arrow-forward-outline' },
  { key: 'single', label: 'Single page', icon: 'document-text-outline' },
  { key: 'double', label: 'Double spread', icon: 'book-outline' },
];

const THEME_KEYS = Object.keys(ReaderThemes) as ReaderTheme[];

function getContrastTextColor(hex: string): string {
  try {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#09090B' : '#FFFFFF';
  } catch {
    return '#09090B';
  }
}

function CustomSwitch({
  value,
  onValueChange,
  activeColor,
}: {
  value: boolean;
  onValueChange: (val: boolean) => void;
  activeColor: string;
}) {
  const colors = useThemeColors();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.surfaceElevated, true: activeColor }}
      thumbColor={value ? getContrastTextColor(activeColor) : colors.textMuted}
      ios_backgroundColor={colors.surfaceElevated}
    />
  );
}

export default function SettingsScreen() {
  useDocumentTitle('Settings');
  const router = useRouter();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;

  const accentColor = colors.accent;
  const appThemeMode = useThemeStore((s) => s.appThemeMode);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const setAppThemeMode = useThemeStore((s) => s.setAppThemeMode);
  const setColorScheme = useThemeStore((s) => s.setColorScheme);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Global reader preferences
  const mode = useReaderStore((s) => s.mode);
  const readerTheme = useReaderStore((s) => s.theme);
  const dataSaver = useReaderStore((s) => s.dataSaver);
  const setDataSaver = useReaderStore((s) => s.setDataSaver);
  const showPageNumber = useReaderStore((s) => s.showPageNumber);
  const hapticsEnabled = useReaderStore((s) => s.hapticsEnabled);
  const setMode = useReaderStore((s) => s.setMode);
  const setTheme = useReaderStore((s) => s.setTheme);
  const setShowPageNumber = useReaderStore((s) => s.setShowPageNumber);
  const setHapticsEnabled = useReaderStore((s) => s.setHapticsEnabled);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  // Supabase User store
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const refreshUser = useUserStore((s) => s.refreshUser);

  // Sync fresh user details from Supabase on mount and whenever Settings tab gains focus
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser])
  );

  // Modal & Notification State
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleManualSync = async () => {
    if (!user?.id) return;
    setIsSyncing(true);
    const res = await syncUserDataWithCloud(user.id);
    setIsSyncing(false);
    setConfirmModalConfig({
      visible: true,
      title: res.success ? 'Cloud Sync Complete' : 'Sync Failed',
      message: res.success
        ? 'Your reading history and library bookmarks have been synchronized with Supabase.'
        : res.message,
      iconName: res.success ? 'checkmark-done-circle-outline' : 'alert-circle-outline',
      confirmText: 'OK',
      cancelText: '',
      confirmVariant: 'primary',
      onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
    });
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (granted) {
        setNotificationsEnabled(true);
        await registerLibraryScanTask();
        setConfirmModalConfig({
          visible: true,
          title: 'Notifications Enabled',
          message: 'You will receive alerts when new chapters drop for titles in your Reading or Favorites lists.',
          iconName: 'notifications-outline',
          confirmText: 'Got It',
          cancelText: '',
          confirmVariant: 'primary',
          onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
        });
      } else {
        setNotificationsEnabled(false);
        setConfirmModalConfig({
          visible: true,
          title: 'Permission Required',
          message: 'Please allow notification permissions in your device settings to get chapter alerts.',
          iconName: 'alert-circle-outline',
          confirmText: 'OK',
          cancelText: '',
          confirmVariant: 'primary',
          onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  const handleTestNotification = async () => {
    setIsScanning(true);
    await sendNewChapterNotification({
      mangaTitle: 'Yomite Manga Reader',
      chapterNum: '100',
      mangaId: 'test',
      chapterId: 'test',
    });
    setIsScanning(false);
    setConfirmModalConfig({
      visible: true,
      title: 'Test Local Push Sent',
      message: 'A test chapter alert push notification has been delivered to your device.',
      iconName: 'paper-plane-outline',
      confirmText: 'OK',
      cancelText: '',
      confirmVariant: 'primary',
      onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
    });
  };

  const handleLogout = async () => {
    await signOut();
    setConfirmModalConfig({
      visible: true,
      title: 'Signed Out',
      message: 'You have been signed out from Yomite Cloud Sync.',
      iconName: 'log-out-outline',
      confirmText: 'OK',
      cancelText: '',
      confirmVariant: 'primary',
      onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
    });
  };

  const handleClearHistoryPrompt = () => {
    setConfirmModalConfig({
      visible: true,
      title: 'Clear Reading History',
      message: 'Are you sure you want to clear your entire reading history? This action cannot be undone.',
      iconName: 'trash-outline',
      confirmText: 'Clear All History',
      confirmVariant: 'destructive',
      onConfirm: () => {
        clearHistory();
        setConfirmModalConfig({
          visible: true,
          title: 'History Cleared',
          message: 'Your reading history has been completely cleared.',
          iconName: 'checkmark-circle-outline',
          confirmText: 'OK',
          cancelText: '',
          confirmVariant: 'primary',
          onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
        });
      },
    });
  };

  /* ── SECTION 1: ACCOUNT & PROFILE (FLAT) ── */
  const renderAccountSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}> 
        Yomite Account & Profile Settings
      </Text>

      {user ? (
        <View style={styles.flatSectionBody}>
          <Pressable
            onPress={() => router.push('/profile' as any)}
            accessibilityRole="button"
            accessibilityLabel="View profile settings"
            style={({ pressed, hovered }: any) => [
              styles.profileCardRow,
              (pressed || hovered) && { opacity: 0.8 },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            <View style={styles.profileInfoLeft}>
              <View
                style={[
                  styles.avatarBox,
                  {
                    backgroundColor: colors.surfaceElevated,
                  },
                ]}
              >
                {getUserAvatarUrl(user) ? (
                  <Image
                    source={{ uri: getUserAvatarUrl(user)! }}
                    style={styles.avatarImg}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <YomiteMascotIcon size={38} />
                )}
              </View>
              <View style={styles.profileTextCol}>
                <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                  {getUserDisplayName(user)}
                </Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={styles.profileActionRow}>
            <AnimatedPressable
              onPress={() => router.push('/profile' as any)}
              accessibilityRole="button"
              accessibilityLabel="Open profile settings"
              style={[
                styles.profileActionBtn,
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <Ionicons name="person-outline" size={15} color={accentColor} />
              <Text style={[styles.profileActionBtnText, { color: accentColor }]}>
                Profile
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={handleManualSync}
              disabled={isSyncing}
              accessibilityRole="button"
              accessibilityLabel="Synchronize library with cloud"
              style={[
                styles.profileActionBtn,
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Ionicons name="sync-outline" size={15} color="#10B981" />
              )}
              <Text style={[styles.profileActionBtnText, { color: '#10B981' }]}>
                {isSyncing ? 'Syncing…' : 'Sync Now'}
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Sign out of Yomite"
              style={[
                styles.profileActionBtn,
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <Ionicons name="log-out-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.profileActionBtnText, { color: colors.textSecondary }]}> 
                Sign out
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      ) : (
        <View style={styles.flatSectionBody}>
          <View style={styles.signedOutHeader}>
            <View style={[styles.avatarBox, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.profileTextCol}>
              <Text style={[styles.signedOutTitle, { color: colors.text }]}>Cloud Backup & Sync</Text>
              <Text style={[styles.signedOutSubtitle, { color: colors.textSecondary }]}>
                Sign in to sync library & bookmarks across devices
              </Text>
            </View>
          </View>

          <AnimatedPressable
            onPress={() => setAuthModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Sign in or create account"
            style={[
              styles.openAuthBtn,
              { backgroundColor: accentColor },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            <Ionicons name="log-in-outline" size={18} color={getContrastTextColor(accentColor)} />
            <Text style={[styles.openAuthBtnText, { color: getContrastTextColor(accentColor) }]}>
              Sign In / Create Account
            </Text>
          </AnimatedPressable>
        </View>
      )}
    </View>
  );

  /* ── SECTION 2: APP THEME & MODE (FLAT DIVIDED LIST) ── */
  const renderThemeModeSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>App Theme & Mode</Text>
      <View style={styles.flatDividedList}>
        {[
          {
            key: 'system',
            label: 'System Default',
            icon: 'hardware-chip-outline' as const,
            desc: 'Follow device OS theme setting',
          },
          {
            key: 'dark',
            label: 'Dark Mode',
            icon: 'moon-outline' as const,
            desc: 'Neutral Zinc dark theme',
          },
          {
            key: 'light',
            label: 'Light Mode',
            icon: 'sunny-outline' as const,
            desc: 'Clean paper white light theme',
          },
        ].map((item, idx) => {
          const isSelected = appThemeMode === item.key;
          return (
            <React.Fragment key={item.key}>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setAppThemeMode(item.key as AppThemeMode);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Set theme to ${item.label}`}
                style={({ pressed, hovered }: any) => [
                  styles.flatRow,
                  (pressed || hovered) && { backgroundColor: 'rgba(39, 39, 42, 0.25)' },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.iconSquare, { backgroundColor: colors.cardBackground }]}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={accentColor}
                    />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={[styles.optionTitle, { color: colors.text }, isSelected && { color: colors.text }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>{item.desc}</Text>
                  </View>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark" size={20} color={accentColor} style={styles.rowCheckmark} />
                )}
              </Pressable>
              {idx < 2 && <View style={styles.hairlineDivider} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );

  /* ── SECTION 3: ACCENT THEME COLOR (FLAT WITH SCROLLABLE SWATCHES) ── */
  const renderColorSchemeSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Color Scheme</Text>
      <Text style={[styles.sectionSubDescription, { color: colors.textMuted }]}>
        Kotatsu-inspired Material palettes for the whole app
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.schemeScrollRow}
      >
        {THEME_SCHEME_PRESETS.map((preset) => {
          const isSelected = colorScheme === preset.id;
          return (
            <Pressable
              key={preset.id}
              onPress={() => {
                triggerHaptic();
                setColorScheme(preset.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.schemeChip,
                pressed && { opacity: 0.72 },
              ]}
            >
              <View
                style={[
                  styles.schemeSwatch,
                  { backgroundColor: preset.color, borderColor: isSelected ? preset.color : colors.border },
                  isSelected && styles.schemeSwatchSelected,
                ]}
              >
                {isSelected && <Ionicons name="checkmark" size={18} color={preset.id === 'kanade' ? '#1C1B1C' : '#FFFFFF'} />}
              </View>
              <Text style={[styles.schemeChipText, { color: isSelected ? colors.text : colors.textSecondary }]}>
                {preset.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  /* ── SECTION 4: READING MODE (FLAT DIVIDED LIST) ── */
  const renderReadingModeSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Default Reading Mode</Text>
      <View style={styles.flatDividedList}>
        {READING_MODES.map((m, idx) => {
          const isSelected = mode === m.key;
          return (
            <React.Fragment key={m.key}>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setMode(m.key);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Set reading mode to ${m.label}`}
                style={({ pressed, hovered }: any) => [
                  styles.flatRow,
                  (pressed || hovered) && { backgroundColor: 'rgba(39, 39, 42, 0.25)' },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.iconSquare, { backgroundColor: colors.cardBackground }]}>
                    <Ionicons
                      name={m.icon}
                      size={18}
                      color={accentColor}
                    />
                  </View>
                  <Text style={[styles.optionTitle, { color: colors.text }, isSelected && { color: colors.text }]}>
                    {m.label}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark" size={20} color={accentColor} style={styles.rowCheckmark} />
                )}
              </Pressable>
              {idx < READING_MODES.length - 1 && <View style={styles.hairlineDivider} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );

  /* ── SECTION 5: READER BACKGROUND (FLAT CHIPS) ── */
  const renderReaderThemeSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Reader Background</Text>
      <View style={styles.themeChipsGrid}>
        {THEME_KEYS.map((key) => {
          const t = ReaderThemes[key];
          const isActive = readerTheme === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                triggerHaptic();
                setTheme(key);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Set reader theme to ${t.name}`}
              style={({ pressed, hovered }: any) => [
                styles.themeChip,
                {
                  backgroundColor: t.background,
                  borderColor: isActive ? 'rgba(255, 255, 255, 0.28)' : '#27272A',
                },
                (pressed || hovered) && { opacity: 0.8 },
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <Text style={[styles.themeChipText, { color: t.text }]}>
                {t.name}
              </Text>
              {isActive && (
                <Ionicons name="checkmark-circle" size={14} color={accentColor} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  /* ── SECTION 6: NOTIFICATIONS (FLAT DIVIDED LIST) ── */
  const renderNotificationsSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}> 
        Background Updates & Notifications
      </Text>
      <View style={styles.flatDividedList}>
        <View style={styles.flatRow}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: colors.cardBackground }]}>
              <Ionicons name="notifications-outline" size={18} color={accentColor} />
            </View>
            <View style={styles.optionTextCol}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>New Chapter Alerts</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>
                Notify when library titles get new chapters
              </Text>
            </View>
          </View>
          <CustomSwitch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            activeColor={accentColor}
          />
        </View>

        <View style={styles.hairlineDivider} />

        <Pressable
          onPress={handleTestNotification}
          disabled={isScanning}
          accessibilityRole="button"
          accessibilityLabel="Send test chapter notification"
          style={({ pressed, hovered }: any) => [
            styles.flatRow,
            (pressed || hovered) && { backgroundColor: 'rgba(39, 39, 42, 0.25)' },
            Platform.OS === 'web' && { cursor: 'pointer' as any },
          ]}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: colors.cardBackground }]}>
              <Ionicons name="paper-plane-outline" size={18} color={accentColor} />
            </View>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Send Test Local Push Notification</Text>
          </View>
          {isScanning ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color="#71717A" />
          )}
        </Pressable>
      </View>
    </View>
  );

  /* ── SECTION 7: DATA & PERFORMANCE (FLAT DIVIDED LIST) ── */
  const renderDataSection = () => (
    <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Data & Performance</Text>
      <View style={styles.flatDividedList}>
        <View style={styles.flatRow}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: colors.cardBackground }]}>
              <Ionicons name="wifi-outline" size={18} color={accentColor} />
            </View>
            <View style={styles.optionTextCol}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Data Saver (Compressed images)</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>
                Load lower resolution images to save mobile data
              </Text>
            </View>
          </View>
          <CustomSwitch
            value={dataSaver}
            onValueChange={setDataSaver}
            activeColor={accentColor}
          />
        </View>

        <View style={styles.hairlineDivider} />

        <View style={styles.flatRow}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: colors.cardBackground }]}>
              <Ionicons name="stats-chart-outline" size={18} color={accentColor} />
            </View>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Show Page Number in Reader</Text>
          </View>
          <CustomSwitch
            value={showPageNumber}
            onValueChange={setShowPageNumber}
            activeColor={accentColor}
          />
        </View>

        <View style={styles.hairlineDivider} />

        <View style={styles.flatRow}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: colors.cardBackground }]}>
              <Ionicons
                name="phone-portrait-outline"
                size={18}
                color={accentColor}
              />
            </View>
            <View style={styles.optionTextCol}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Subtle Haptic Feedback</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>
                Vibrate lightly when tapping buttons and controls
              </Text>
            </View>
          </View>
          <CustomSwitch
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            activeColor={accentColor}
          />
        </View>

        <View style={styles.hairlineDivider} />

        <Pressable
          onPress={handleClearHistoryPrompt}
          accessibilityRole="button"
          accessibilityLabel="Clear reading history"
          style={({ pressed, hovered }: any) => [
            styles.flatRow,
            (pressed || hovered) && { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
            Platform.OS === 'web' && { cursor: 'pointer' as any },
          ]}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.optionTitle, { color: '#EF4444' }]}>
              Clear Reading History
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#71717A" />
        </Pressable>
      </View>
    </View>
  );

  /* ── SECTION 8: MOBILE PROMO (FLAT ROW) ── */
  const renderMobilePromoSection = () => (
    Platform.OS === 'web' ? (
      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Mobile Application</Text>
        <View style={styles.flatDividedList}>
          <Pressable
            onPress={() => router.push('/download' as any)}
            accessibilityRole="button"
            accessibilityLabel="Download Yomite mobile APK"
            style={({ pressed, hovered }: any) => [
              styles.flatRow,
              (pressed || hovered) && { backgroundColor: 'rgba(39, 39, 42, 0.25)' },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.iconSquare, { backgroundColor: colors.cardBackground }]}>
                <Ionicons name="cloud-download-outline" size={18} color={accentColor} />
              </View>
              <View style={styles.optionTextCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>Get Yomite for Mobile</Text>
                  <View style={[styles.promoBadge, { backgroundColor: `${accentColor}26` }]}>
                    <Text style={[styles.promoBadgeText, { color: accentColor }]}>APK v1.2.2</Text>
                  </View>
                </View>
                <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>
                  Download direct Android APK or install iOS Web PWA with full offline capabilities
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#71717A" />
          </Pressable>
        </View>
      </View>
    ) : null
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.contentWrapper}>
        {/* Top Header Section */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <View style={styles.headerRow}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={() => setDrawerVisible(true)}
                style={({ pressed, hovered }: any) => [
                  styles.menuButton,
                  (pressed || hovered) && { opacity: 0.7, backgroundColor: 'rgba(63, 63, 70, 0.8)' },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Open navigation drawer"
                hitSlop={8}
              >
                <Ionicons name="menu" size={24} color="#FFFFFF" />
              </Pressable>
            )}
            <View>
                  <Text style={[styles.title, isDesktop && styles.titleDesktop, { color: colors.text }]}>Settings</Text>
              {isDesktop && (
                <Text style={[styles.desktopSubtitle, { color: colors.textMuted }]}>
                  Manage your account, reader preferences, themes, and storage.
                </Text>
              )}
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        >
          {isDesktop ? (
            /* ── DESKTOP 2-COLUMN BALANCED FLAT GRID ── */
            <View style={styles.desktopGrid}>
              <View style={styles.desktopCol}>
                {renderAccountSection()}
                {renderThemeModeSection()}
                {renderColorSchemeSection()}
              </View>
              <View style={styles.desktopCol}>
                {renderReadingModeSection()}
                {renderReaderThemeSection()}
                {renderNotificationsSection()}
                {renderDataSection()}
                {renderMobilePromoSection()}
              </View>
            </View>
          ) : (
            /* ── MOBILE SINGLE-COLUMN FLAT STACK ── */
            <View style={styles.mobileStack}>
              {renderAccountSection()}
              {renderThemeModeSection()}
              {renderColorSchemeSection()}
              {renderReadingModeSection()}
              {renderReaderThemeSection()}
              {renderNotificationsSection()}
              {renderDataSection()}
              {renderMobilePromoSection()}
            </View>
          )}

          {/* App Info Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerTitle, { color: colors.textMuted }]}>Yomite Manga Reader v1.2.2</Text>
            <Text style={[styles.footerSubtitle, { color: colors.textMuted }]}>
              Powered by MangaDex API & Supabase Cloud Sync
            </Text>
          </View>
        </ScrollView>

        {/* Supabase Auth Modal */}
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />

        {/* Custom Confirmation Modal */}
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

        {/* Sidebar Drawer */}
        <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  headerDesktop: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(39, 39, 42, 0.6)',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  titleDesktop: {
    fontSize: 32,
  },
  desktopSubtitle: {
    fontSize: 13,
    color: '#A1A1AA',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 110,
  },
  scrollContentDesktop: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  /* Desktop Grid */
  desktopGrid: {
    flexDirection: 'row',
    gap: 32,
    alignItems: 'flex-start',
  },
  desktopCol: {
    flex: 1,
    gap: 24,
  },
  mobileStack: {
    gap: 24,
  },

  section: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
    letterSpacing: 0.3,
    paddingHorizontal: 4,
  },
  sectionSubDescription: {
    fontSize: 12,
    color: '#A1A1AA',
    paddingHorizontal: 4,
    marginBottom: 4,
  },

  /* Flat Section Body (No containers, completely borderless) */
  flatSectionBody: {
    paddingHorizontal: 4,
  },
  schemeScrollRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  schemeChip: {
    alignItems: 'center',
    gap: 7,
    justifyContent: 'flex-start',
    minWidth: 64,
  },
  schemeSwatch: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 2,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  schemeSwatchSelected: {
    borderColor: '#FFFFFF',
  },
  schemeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Profile Section */
  profileCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  profileInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
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
  profileTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  profileActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    minHeight: 36,
  },
  profileActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Signed out state */
  signedOutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  signedOutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signedOutSubtitle: {
    fontSize: 12,
    color: '#A1A1AA',
    lineHeight: 16,
  },
  openAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 44,
  },
  openAuthBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Flat Divided List (divide-y divide-zinc-800/80 without container box) */
  flatDividedList: {
    backgroundColor: 'transparent',
  },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    minHeight: 52,
  },
  hairlineDivider: {
    height: 1,
    backgroundColor: 'rgba(39, 39, 42, 0.6)',
    marginHorizontal: 4,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconSquare: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(39, 39, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E4E4E7',
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#A1A1AA',
  },
  rowCheckmark: {
    marginLeft: 8,
  },

  /* Reader Background Chips */
  themeChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  themeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Mobile App Promo Badge */
  promoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  promoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    marginTop: 28,
    gap: 4,
  },
  footerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  footerSubtitle: {
    fontSize: 11,
    color: '#52525B',
  },
});
