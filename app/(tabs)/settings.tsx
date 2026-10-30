/**
 * Settings Screen — Ultra-Clean Flat Minimalist Theme (Google Stitch Style)
 * Container-free, borderless, modern flat design with subtle dividers and tactile micro-interactions.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radius, ReaderThemes, Spacing, Typography } from '../../constants/Colors';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { useColorScheme } from '../../src/hooks/useColorScheme';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import {
  checkLibraryForUpdates,
  getBackgroundScanConfig,
  getLatestChapter,
  registerLibraryScanTask,
  saveBackgroundScanConfig,
  unregisterLibraryScanTask,
} from '../../src/services/backgroundScanner';
import {
  requestNotificationPermissions,
  registerReleasePushSubscription,
  sendNewChapterNotification,
  unregisterReleasePushSubscription,
} from '../../src/services/notificationService';
import { getUniversalMangaChapters, isExternalSource } from '../../src/sources/adapter';
import { SourceManager } from '../../src/sources/SourceManager';
import { useHistoryStore } from '../../src/store/historyStore';
import { useLibraryStore } from '../../src/store/libraryStore';
import { useReaderStore } from '../../src/store/readerStore';
import {
  AppThemeMode,
  THEME_SCHEME_PRESETS,
  useThemeStore,
} from '../../src/store/themeStore';
import type { ReaderTheme, ReadingMode } from '../../src/types';
import { triggerHaptic } from '../../src/utils/haptics';

import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
import {
  getDisplayDownloadDirectory,
  pickAndroidStorageDirectory,
  pickStorageDirectory,
} from '../../src/services/downloadService';
import { useDownloadStore } from '../../src/store/downloadStore';
import { getCurrentAppVersion } from '../../src/services/appUpdateService';

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{
        false: isDark ? '#3F3F46' : colors.surfaceElevated,
        true: activeColor,
      }}
      thumbColor={value ? getContrastTextColor(activeColor) : '#FFFFFF'}
      ios_backgroundColor={isDark ? '#3F3F46' : colors.surfaceElevated}
    />
  );
}

export default function SettingsScreen() {
  useDocumentTitle('Settings');
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [returnToProfile, setReturnToProfile] = useState(from === 'profile');
  const colors = useThemeColors();
  const currentAppVersion = getCurrentAppVersion();
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.045)';
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
  const downloadDirectory = useDownloadStore((s) => s.downloadDirectory);
  const setDataSaver = useReaderStore((s) => s.setDataSaver);
  const showPageNumber = useReaderStore((s) => s.showPageNumber);
  const hapticsEnabled = useReaderStore((s) => s.hapticsEnabled);
  const setMode = useReaderStore((s) => s.setMode);
  const setTheme = useReaderStore((s) => s.setTheme);
  const setShowPageNumber = useReaderStore((s) => s.setShowPageNumber);
  const setHapticsEnabled = useReaderStore((s) => s.setHapticsEnabled);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  const handleChangeDownloadFolder = useCallback(async () => {
    triggerHaptic();
    try {
      const selected =
        Platform.OS === 'android'
          ? await pickAndroidStorageDirectory()
          : await pickStorageDirectory();

      if (selected) {
        setConfirmModalConfig({
          visible: true,
          title: 'Download Folder Updated',
          message: `New downloads will be saved to:\n${getDisplayDownloadDirectory()}`,
          iconName: 'folder-outline',
          confirmText: 'Done',
          cancelText: '',
          confirmVariant: 'primary',
          onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch {
      setConfirmModalConfig({
        visible: true,
        title: 'Folder Not Changed',
        message: 'The download folder could not be changed. Please try again.',
        iconName: 'alert-circle-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  }, []);

  // Modal & Notification State
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [scanIntervalMinutes, setScanIntervalMinutes] = useState(360);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    getBackgroundScanConfig()
      .then((cfg) => {
        setNotificationsEnabled(cfg.enabled);
        setScanIntervalMinutes(cfg.intervalMinutes);
        setLastScanTimestamp(cfg.lastScanTimestamp);
        if (cfg.enabled) {
          registerReleasePushSubscription(currentAppVersion).catch(() => {});
        }
      })
      .catch(() => { });
  }, [currentAppVersion]);

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

  useEffect(() => {
    setReturnToProfile(from === 'profile');
  }, [from]);

  const handleSettingsBack = useCallback(() => {
    if (returnToProfile) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/profile' as any);
      }
      return;
    }
    router.replace('/(tabs)/more');
  }, [returnToProfile, router]);

  // Seamless Android Back Navigation: return to the previous screen instead of Discover
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (confirmModalConfig.visible) {
          setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
          return true;
        }
        if (drawerVisible) {
          setDrawerVisible(false);
          return true;
        }
        handleSettingsBack();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [confirmModalConfig.visible, drawerVisible, handleSettingsBack])
  );

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (granted) {
        setNotificationsEnabled(true);
        await registerReleasePushSubscription(currentAppVersion);
        await registerLibraryScanTask(scanIntervalMinutes);
        setConfirmModalConfig({
          visible: true,
          title: 'Notifications Enabled',
          message: 'Yomite will periodically check for new chapter releases of titles in your Reading list in the background.',
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
      await unregisterReleasePushSubscription();
      await unregisterLibraryScanTask();
    }
  };

  const handleSelectInterval = async (minutes: number) => {
    setScanIntervalMinutes(minutes);
    await saveBackgroundScanConfig({ intervalMinutes: minutes });
    if (notificationsEnabled) {
      await registerLibraryScanTask(minutes);
    }
  };

  const handleCheckUpdatesNow = async () => {
    setIsScanning(true);
    try {
      const result = await checkLibraryForUpdates({ forceNotify: true });
      setIsScanning(false);
      setLastScanTimestamp(Date.now());
      setConfirmModalConfig({
        visible: true,
        title: 'Library Scan Complete',
        message:
          result.newUpdates.length > 0
            ? `Found ${result.newUpdates.length} new chapter update(s) across your ${result.checkedCount} reading titles.`
            : `All ${result.checkedCount} reading titles in your library are up to date!`,
        iconName: result.newUpdates.length > 0 ? 'notifications' : 'checkmark-circle-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    } catch {
      setIsScanning(false);
    }
  };

  const handleTestNotification = async () => {
    setIsScanning(true);
    try {
      const libraryEntries = Object.values(useLibraryStore.getState().entries);
      const targetManga =
        libraryEntries.find((e) => e.category === 'reading') ||
        libraryEntries.find((e) => e.category === 'favorites') ||
        libraryEntries[0];

      if (!targetManga) {
        setIsScanning(false);
        setConfirmModalConfig({
          visible: true,
          title: 'Library is Empty',
          message:
            'You do not have any manga in your library yet! Add manga to your "Reading" list so Yomite can track and alert you about new chapters.',
          iconName: 'bookmarks-outline',
          confirmText: 'Go to Discover',
          cancelText: 'Cancel',
          confirmVariant: 'primary',
          onConfirm: () => {
            setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
            router.push('/(tabs)');
          },
        });
        return;
      }

      // Query latest real chapter for user's library manga via Universal Fetcher
      let chapterNum = 'New';
      let chapterId = targetManga.lastReadChapterId || 'latest';
      let sourceName = 'MangaDex';
      if (isExternalSource(targetManga.mangaId)) {
        const resolved = SourceManager.resolveSource(targetManga.mangaId);
        sourceName = resolved?.parser?.metadata?.name || 'External Catalog';
      }

      try {
        const chapters = await getUniversalMangaChapters(targetManga.mangaId);
        const latest = getLatestChapter(chapters);
        if (latest) {
          chapterId = latest.id;
          chapterNum = String(latest.attributes?.chapter || 'New');
        }
      } catch {
        // Fall back to stored info if network query fails
      }

      const delivered = await sendNewChapterNotification({
        mangaTitle: targetManga.title,
        chapterNum,
        mangaId: targetManga.mangaId,
        chapterId,
        sourceName,
      });
      setIsScanning(false);

      if (delivered) {
        setConfirmModalConfig({
          visible: true,
          title: 'Library Test Notification Sent',
          message: `A test alert for "${targetManga.title}" (Ch. ${chapterNum}) was sent. Tap the notification in your tray to test deep-linking straight into the chapter reader!`,
          confirmText: 'Got It',
          cancelText: '',
          confirmVariant: 'primary',
          onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
        });
      } else {
        setConfirmModalConfig({
          visible: true,
          title: 'Notification Failed',
          message: 'Could not send test notification. Please verify notification permissions in device settings.',
          confirmText: 'Understood',
          cancelText: '',
          confirmVariant: 'primary',
          onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch {
      setIsScanning(false);
    }
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
                  (pressed || hovered) && {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.035)',
                  },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.iconSquare, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={colors.text}
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
              {idx < 2 && <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />}
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
                {isSelected && <Ionicons name="checkmark" size={18} color={getContrastTextColor(preset.color)} />}
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
                  (pressed || hovered) && {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.035)',
                  },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.iconSquare, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons
                      name={m.icon}
                      size={18}
                      color={colors.text}
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
              {idx < READING_MODES.length - 1 && <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );

  /* ── SECTION 5: READER BACKGROUND (SLIDING CAROUSEL) ── */
  const renderReaderThemeSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Reader Background</Text>
      <Text style={[styles.sectionSubDescription, { color: colors.textMuted }]}>
        Canvas background tone for reading manga pages
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.schemeScrollRow}
      >
        {THEME_KEYS.map((key) => {
          const t = ReaderThemes[key];
          const isSelected = readerTheme === key;
          const isLightTone = key === 'white' || key === 'sepia';
          return (
            <Pressable
              key={key}
              onPress={() => {
                triggerHaptic();
                setTheme(key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Set reader theme to ${t.name}`}
              style={({ pressed, hovered }: any) => [
                styles.schemeChip,
                (pressed || hovered) && { opacity: 0.72 },
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <View
                style={[
                  styles.schemeSwatch,
                  {
                    backgroundColor: t.background,
                    borderColor: isSelected ? '#FFFFFF' : (key === 'white' ? '#52525B' : colors.border),
                  },
                  isSelected && styles.schemeSwatchSelected,
                ]}
              >
                {isSelected && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={isLightTone ? '#09090B' : '#FFFFFF'}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.schemeChipText,
                  { color: isSelected ? colors.text : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  /* ── SECTION 6: BACKGROUND UPDATES & NOTIFICATIONS ── */
  const SCAN_INTERVALS = [
    { label: '2 Hours', minutes: 120 },
    { label: '6 Hours', minutes: 360 },
    { label: '12 Hours', minutes: 720 },
    { label: '24 Hours', minutes: 1440 },
  ];

  const renderNotificationsSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        Background Updates & Notifications
      </Text>
      <View style={styles.flatDividedList}>
        <View style={styles.flatRow}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="notifications-outline" size={18} color={colors.text} />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>New Chapter Alerts</Text>
            </View>
          </View>
          <CustomSwitch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            activeColor={accentColor}
          />
        </View>

        {notificationsEnabled && (
          <>
            <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />
            <View style={styles.frequencyRow}>
              <Text style={[styles.frequencyLabel, { color: colors.textSecondary }]}>Check Frequency</Text>
              <View style={styles.intervalChipsRow}>
                {SCAN_INTERVALS.map((item) => {
                  const isSelected = scanIntervalMinutes === item.minutes;
                  return (
                    <Pressable
                      key={item.minutes}
                      onPress={() => handleSelectInterval(item.minutes)}
                      style={[
                        styles.intervalChip,
                        {
                          backgroundColor: isSelected ? accentColor : colors.cardBackground,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Set scan interval to ${item.label}`}
                    >
                      <Text
                        style={[
                          styles.intervalChipText,
                          { color: isSelected ? getContrastTextColor(accentColor) : colors.textMuted },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

            <Pressable
              onPress={handleCheckUpdatesNow}
              disabled={isScanning}
              accessibilityRole="button"
              accessibilityLabel="Check library updates now"
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
                  <Ionicons name="sync-outline" size={18} color={colors.text} />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>Check Updates Now</Text>
                  <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>
                    {lastScanTimestamp
                      ? `Last checked: ${new Date(lastScanTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Scan reading list immediately'}
                  </Text>
                </View>
              </View>
              {isScanning ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <Ionicons name="chevron-forward" size={16} color="#71717A" />
              )}
            </Pressable>
          </>
        )}

        <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

        <Pressable
          onPress={handleTestNotification}
          disabled={isScanning}
          accessibilityRole="button"
          accessibilityLabel="Send test chapter notification"
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
              <Ionicons name="paper-plane-outline" size={18} color={colors.text} />
            </View>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Send Test Notification</Text>
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
        <Pressable
          onPress={handleChangeDownloadFolder}
          accessibilityRole="button"
          accessibilityLabel="Change download folder"
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
              <Ionicons name="folder-outline" size={18} color={colors.text} />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Download Folder</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {downloadDirectory ? getDisplayDownloadDirectory() : 'Yomite app folder'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

        <View style={styles.flatRow}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="wifi-outline" size={18} color={colors.text} />
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

        <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

        <View style={styles.flatRow}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="stats-chart-outline" size={18} color={colors.text} />
            </View>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Show Page Number in Reader</Text>
          </View>
          <CustomSwitch
            value={showPageNumber}
            onValueChange={setShowPageNumber}
            activeColor={accentColor}
          />
        </View>

        <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

        <View style={styles.flatRow}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconSquare, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons
                name="phone-portrait-outline"
                size={18}
                color={colors.text}
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

        <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

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
              (pressed || hovered) && {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.035)',
              },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.iconSquare, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="cloud-download-outline" size={18} color={colors.text} />
              </View>
              <View style={styles.optionTextCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>Get Yomite for Mobile</Text>
                  <View style={[styles.promoBadge, { backgroundColor: `${accentColor}26` }]}>
                    <Text style={[styles.promoBadgeText, { color: accentColor }]}>APK v{currentAppVersion}</Text>
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
            {Platform.OS === 'web' && !returnToProfile ? (
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
                <Ionicons name="menu" size={24} color={colors.text} />
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSettingsBack}
                style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={returnToProfile ? 'Back to profile' : 'Back to More'}
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </Pressable>
            )}
            <View>
              <Text style={[styles.title, isDesktop && styles.titleDesktop, { color: colors.text }]}>Settings</Text>
              {isDesktop && (
                <Text style={[styles.desktopSubtitle, { color: colors.textMuted }]}>
                  Manage your reader preferences, themes, appearance, and storage.
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
                {renderThemeModeSection()}
                {renderColorSchemeSection()}
                {renderDataSection()}
              </View>
              <View style={styles.desktopCol}>
                {renderReadingModeSection()}
                {renderReaderThemeSection()}
                {renderNotificationsSection()}
                {renderMobilePromoSection()}
              </View>
            </View>
          ) : (
            /* ── MOBILE SINGLE-COLUMN FLAT STACK ── */
            <View style={styles.mobileStack}>
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
            <Text style={[styles.footerTitle, { color: colors.textMuted }]}>Yomite Manga Reader v{currentAppVersion}</Text>
            <Text style={[styles.footerSubtitle, { color: colors.textMuted }]}>
              Powered by MangaDex API, Kotatsu and Supabase Cloud Sync
            </Text>
          </View>
        </ScrollView>

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
  backButton: {
    padding: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 4,
  },
  profileActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    minHeight: 44,
  },
  profileActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
    height: StyleSheet.hairlineWidth,
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
    borderRadius: 10,
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

  /* Frequency Selection */
  frequencyRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 8,
  },
  frequencyLabel: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  intervalChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  intervalChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  intervalChipText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
  },
});
