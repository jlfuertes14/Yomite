/**
 * Settings Screen — Modern Minimalist Theme & MangaDex Auth
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Colors, Spacing, Radius, Typography, ReaderThemes } from '../../constants/Colors';
import { useReaderStore } from '../../src/store/readerStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { useUserStore, getUserDisplayName, getUserHandle, getUserAvatarUrl } from '../../src/store/userStore';
import { useThemeStore, AppThemeMode, ACCENT_PRESETS } from '../../src/store/themeStore';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { requestNotificationPermissions, sendNewChapterNotification } from '../../src/services/notificationService';
import { registerLibraryScanTask } from '../../src/services/backgroundScanner';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
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

function CustomSwitch({
  value,
  onValueChange,
  activeColor,
}: {
  value: boolean;
  onValueChange: (val: boolean) => void;
  activeColor: string;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#27272A', true: activeColor }}
      thumbColor={value ? '#FFFFFF' : '#A1A1AA'}
      ios_backgroundColor="#27272A"
    />
  );
}

export default function SettingsScreen() {
  useDocumentTitle('Settings');
  const router = useRouter();
  const colors = useThemeColors();
  const accentColor = useThemeStore((s) => s.accentColor);
  const appThemeMode = useThemeStore((s) => s.appThemeMode);
  const setAccentColor = useThemeStore((s) => s.setAccentColor);
  const setAppThemeMode = useThemeStore((s) => s.setAppThemeMode);
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
  const [customHex, setCustomHex] = useState('');

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[{ flex: 1, width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>
        <View style={styles.header}>
        <View style={styles.titleRow}>
          {Platform.OS === 'web' && (
            <Pressable
              onPress={() => setDrawerVisible(true)}
              style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={8}
            >
              <Ionicons name="menu" size={26} color={colors.text} />
            </Pressable>
          )}
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Yomite Account & Cloud Sync (Supabase Auth) */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Yomite Account & Profile Settings
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          {user ? (
            <View style={{ gap: Spacing.sm }}>
              <Pressable
                onPress={() => router.push('/profile' as any)}
                style={({ pressed }) => [styles.profileCardHeader, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={styles.authStatusLeft}>
                  <View
                    style={[
                      styles.profileAvatarCircle,
                      {
                        backgroundColor: getUserAvatarUrl(user) ? 'transparent' : colors.accent,
                        borderColor: colors.border,
                        borderWidth: 1.5,
                        overflow: 'hidden',
                      },
                    ]}
                  >
                    {getUserAvatarUrl(user) ? (
                      <Image
                        source={{ uri: getUserAvatarUrl(user)! }}
                        style={styles.profileAvatarImage}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Text style={styles.profileAvatarText}>
                        {getUserDisplayName(user).charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.profileNameText, { color: colors.text }]}>
                      {getUserDisplayName(user)}
                    </Text>
                    <Text style={[styles.profileHandleText, { color: colors.textMuted }]}>
                      @{getUserHandle(user)} · {user.email}
                    </Text>
                    <Text style={[styles.optionDesc, { color: colors.emerald, marginTop: 2 }]}>
                      ● Cloud Sync & Multi-Device Active
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>

              <View style={[styles.accountDivider, { backgroundColor: colors.border }]} />

              <View style={styles.accountActionRow}>
                <Pressable
                  onPress={() => router.push('/profile' as any)}
                  style={({ pressed }) => [
                    styles.profileActionBtn,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="person-outline" size={14} color={colors.accent} />
                  <Text style={[styles.profileActionBtnText, { color: colors.accent }]}>
                    Profile Settings
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleManualSync}
                  disabled={isSyncing}
                  style={({ pressed }) => [
                    styles.profileActionBtn,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      opacity: isSyncing ? 0.6 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={colors.emerald} />
                  ) : (
                    <Ionicons name="sync-outline" size={14} color={colors.emerald} />
                  )}
                  <Text style={[styles.profileActionBtnText, { color: colors.emerald }]}>
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleLogout}
                  style={({ pressed }) => [
                    styles.profileActionBtn,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="log-out-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.profileActionBtnText, { color: colors.textSecondary }]}>
                    Sign out
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.signedOutCard}>
              <View style={styles.signedOutHeader}>
                <View style={[styles.cloudIconBox, { backgroundColor: `${colors.accent}24` }]}>
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>
                    Cloud Backup & Sync
                  </Text>
                  <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                    Sign in with Google or Email to sync library & bookmarks across devices
                  </Text>
                </View>
              </View>

              <AnimatedPressable
                onPress={() => setAuthModalVisible(true)}
                style={[
                  styles.openAuthBtn,
                  { backgroundColor: colors.accent },
                  Platform.OS === 'web' && {
                    alignSelf: 'flex-start',
                    paddingHorizontal: 24,
                  },
                ]}
              >
                <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                <Text style={styles.openAuthBtnText}>Sign In / Create Account</Text>
              </AnimatedPressable>
            </View>
          )}
        </View>

        {/* App Appearance Theme */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          App Theme & Mode
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { key: 'system', label: 'System Default', icon: 'hardware-chip-outline' as const, desc: 'Follow device OS theme setting' },
            { key: 'dark', label: 'Dark Mode', icon: 'moon-outline' as const, desc: 'Neutral Zinc dark theme' },
            { key: 'light', label: 'Light Mode', icon: 'sunny-outline' as const, desc: 'Clean paper white light theme' },
          ].map((item, idx) => (
            <Pressable
              key={item.key}
              onPress={() => setAppThemeMode(item.key as AppThemeMode)}
              style={[
                styles.optionRow,
                idx < 2 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={appThemeMode === item.key ? colors.accent : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{item.desc}</Text>
              </View>
              {appThemeMode === item.key && (
                <Ionicons name="checkmark" size={18} color={colors.accent} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Dynamic Accent Color Theme Picker */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Accent Theme Color
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: Spacing.md, gap: Spacing.md }]}>
          <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
            Personalize your primary accent color across the app
          </Text>

          {/* Color Presets Swatches */}
          <View style={styles.colorPresetsGrid}>
            {ACCENT_PRESETS.map((preset) => {
              const isSelected = accentColor.toLowerCase() === preset.color.toLowerCase();
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => {
                    triggerHaptic();
                    setAccentColor(preset.color);
                    setCustomHex('');
                  }}
                  style={({ pressed }) => [
                    styles.colorCircle,
                    { backgroundColor: preset.color, borderColor: isSelected ? '#FFFFFF' : 'transparent' },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </Pressable>
              );
            })}
          </View>

          {/* Custom Hex Color Input */}
          <View style={[styles.customHexRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.md }]}>
            <View style={[styles.customColorPreviewCircle, { backgroundColor: accentColor }]} />
            <TextInput
              style={[styles.hexInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
              placeholder="Custom Hex (e.g. #8B5CF6)"
              placeholderTextColor={colors.textMuted}
              value={customHex}
              onChangeText={setCustomHex}
              autoCapitalize="characters"
              maxLength={7}
            />
            <AnimatedPressable
              onPress={() => {
                let formatted = customHex.trim();
                if (!formatted.startsWith('#')) formatted = `#${formatted}`;
                if (/^#([0-9A-F]{3}){1,2}$/i.test(formatted)) {
                  setAccentColor(formatted);
                  setConfirmModalConfig({
                    visible: true,
                    title: 'Accent Theme Applied',
                    message: `Accent color updated to ${formatted}`,
                    iconName: 'color-palette-outline',
                    confirmText: 'OK',
                    cancelText: '',
                    confirmVariant: 'primary',
                    onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
                  });
                } else {
                  setConfirmModalConfig({
                    visible: true,
                    title: 'Invalid Hex Code',
                    message: 'Please enter a valid hex color code (e.g. #8B5CF6 or #00E5FF).',
                    iconName: 'alert-circle-outline',
                    confirmText: 'OK',
                    cancelText: '',
                    confirmVariant: 'primary',
                    onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
                  });
                }
              }}
              disabled={!customHex.trim()}
              style={[
                styles.applyHexBtn,
                { backgroundColor: colors.accent, opacity: customHex.trim() ? 1 : 0.4 },
              ]}
            >
              <Text style={styles.applyHexBtnText}>Apply</Text>
            </AnimatedPressable>
          </View>
        </View>

        {/* Default Reading Mode */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Default Reading Mode
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {READING_MODES.map((m, idx) => (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[
                styles.optionRow,
                idx < READING_MODES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Ionicons name={m.icon} size={18} color={mode === m.key ? colors.accent : colors.textMuted} />
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                {m.label}
              </Text>
              {mode === m.key && (
                <Ionicons name="checkmark" size={18} color={colors.accent} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Reader Theme */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Reader Background
        </Text>
        <View style={styles.themeRow}>
          {THEME_KEYS.map((key) => {
            const t = ReaderThemes[key];
            const isActive = readerTheme === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTheme(key)}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: t.background,
                    borderColor: isActive ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={[styles.themeChipText, { color: t.text }]}>
                  {t.name}
                </Text>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Updates & Push Notifications */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Background Updates & Notifications
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.optionRow}>
            <Ionicons name="notifications-outline" size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                New Chapter Alerts
              </Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                Notify when library titles get new chapters
              </Text>
            </View>
            <CustomSwitch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              activeColor={colors.accent}
            />
          </View>

          <Pressable
            onPress={handleTestNotification}
            disabled={isScanning}
            style={({ pressed }) => [
              styles.optionRow,
              { borderTopWidth: 1, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="paper-plane-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.optionLabel, { color: colors.text, flex: 1 }]}>
              Send Test Local Push Notification
            </Text>
            {isScanning ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            )}
          </Pressable>
        </View>

        {/* Data & Performance */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Data & Performance
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.optionRow}>
            <Ionicons name="wifi-outline" size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                Data Saver (Compressed images)
              </Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                Load lower resolution images to save mobile data
              </Text>
            </View>
            <CustomSwitch
              value={dataSaver}
              onValueChange={setDataSaver}
              activeColor={colors.accent}
            />
          </View>

          <View style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: colors.border }]}> 
            <Ionicons name="stats-chart-outline" size={18} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                Show Page Number in Reader
              </Text>
            </View>
            <CustomSwitch
              value={showPageNumber}
              onValueChange={setShowPageNumber}
              activeColor={colors.accent}
            />
          </View>

          <View style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: colors.border }]}> 
            <Ionicons name="phone-portrait-outline" size={18} color={hapticsEnabled ? colors.accent : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Subtle Haptic Feedback</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>Vibrate lightly when tapping buttons and controls</Text>
            </View>
            <CustomSwitch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              activeColor={colors.accent}
            />
          </View>

          <Pressable
            onPress={handleClearHistoryPrompt}
            style={({ pressed }) => [
              styles.optionRow,
              { borderTopWidth: 1, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={[styles.optionLabel, { color: '#EF4444', flex: 1 }]}>
              Clear Reading History
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Mobile App & APK Download Promo (Only shown on Web) */}
        {Platform.OS === 'web' && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Mobile Application
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                onPress={() => router.push('/download' as any)}
                style={({ pressed }) => [
                  styles.optionRow,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="cloud-download-outline" size={20} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      Get Yomite for Mobile
                    </Text>
                    <View style={[styles.promoBadge, { backgroundColor: colors.accentSubtle }]}>
                      <Text style={[styles.promoBadgeText, { color: colors.accent }]}>APK v1.2.2</Text>
                    </View>
                  </View>
                  <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                    Download direct Android APK or install iOS Web PWA with full offline capabilities
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </>
        )}

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Yomite Manga Reader v1.2.2
          </Text>
          <Text style={[styles.footerSubText, { color: colors.textMuted }]}>
            Powered by MangaDex API & Supabase Cloud Sync
          </Text>
        </View>
      </ScrollView>

      {/* Supabase Auth Sheet Modal */}
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />

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

      {/* Hamburger Slide Drawer */}
      <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webCenteredContent: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  plainIconButton: {
    padding: 4,
  },
  title: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 110,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  optionLabel: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
  },
  optionDesc: {
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  themeChipText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },

  /* Auth Status & Profile Card */
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  profileAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: Typography.weights.bold,
  },
  profileNameText: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  profileHandleText: {
    fontSize: Typography.sizes.caption,
  },
  accountDivider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },
  accountActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  profileActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 4,
  },
  profileActionBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  authStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  authStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  logoutBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  logoutBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  signedOutCard: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  signedOutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cloudIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    gap: 8,
  },
  openAuthBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },

  /* Accent Color Presets */
  colorPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'flex-start',
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.25)',
    elevation: 3,
  },
  customHexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customColorPreviewCircle: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hexInput: {
    flex: 1,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.footnote,
  },
  applyHexBtn: {
    paddingHorizontal: Spacing.md,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyHexBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },

  promoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  promoBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: 4,
  },
  footerText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
  },
  footerSubText: {
    fontSize: 10,
  },
});
