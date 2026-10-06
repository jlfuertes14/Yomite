/**
 * Profile Screen — Comprehensive Yomite User Profile & Account Settings
 * Features user display name, preferred @handle, reading statistics,
 * cloud sync controls, inline profile editing, and quick shortcuts.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius, Typography } from '../constants/Colors';
import { useThemeColors } from '../src/hooks/useThemeColor';
import { useUserStore, getUserDisplayName, getUserHandle, getUserAvatarUrl } from '../src/store/userStore';
import { useLibraryStore } from '../src/store/libraryStore';
import { useHistoryStore } from '../src/store/historyStore';
import { useDownloadStore } from '../src/store/downloadStore';
import { useCommunityStore } from '../src/store/communityStore';
import { syncUserDataWithCloud } from '../src/services/cloudSync';
import { processAndUploadAvatar } from '../src/services/avatarService';
import { formatChapterDate } from '../src/utils/date';
import { triggerHaptic } from '../src/utils/haptics';

import { AuthModal } from '../src/components/AuthModal';
import { ConfirmationModal } from '../src/components/ConfirmationModal';
import { useDocumentTitle } from '../src/utils/useDocumentTitle';

export default function ProfileScreen() {
  useDocumentTitle('User Profile');
  const colors = useThemeColors();
  const router = useRouter();

  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const refreshUser = useUserStore((s) => s.refreshUser);

  const libraryEntries = useLibraryStore((s) => s.entries);
  const historyEntries = useHistoryStore((s) => s.entries);
  const downloadEntries = useDownloadStore((s) => s.chapters);
  const userThreads = useCommunityStore((s) => s.userThreads);

  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Sync user state on mount & focus
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser])
  );

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

  const displayName = getUserDisplayName(user);
  const handle = getUserHandle(user);
  const avatarUrl = getUserAvatarUrl(user);
  const email = user?.email || 'No email attached';
  const memberSince = user?.created_at
    ? formatChapterDate(user.created_at)
    : 'Recently';

  // Calculate dynamic reading streak in days from history timestamps
  const userStreak = useMemo(() => {
    if (!historyEntries || historyEntries.length === 0) return 0;
    const dateStrings = Array.from(
      new Set(
        historyEntries
          .map((e) => {
            if (!e.timestamp) return null;
            const d = new Date(e.timestamp);
            return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
          })
          .filter(Boolean) as string[]
      )
    ).sort().reverse();

    if (dateStrings.length === 0) return 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // If latest read date is not today or yesterday, streak is broken
    const latestDate = dateStrings[0];
    if (latestDate !== todayStr && latestDate !== yesterdayStr) {
      return 0;
    }

    let streak = 1;
    let currentDate = new Date(latestDate);

    for (let i = 1; i < dateStrings.length; i++) {
      const prevDate = new Date(dateStrings[i]);
      const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
        currentDate = prevDate;
      } else {
        break;
      }
    }
    return streak;
  }, [historyEntries]);

  // Weekly Day Streak calculation
  const weekStreakData = useMemo(() => {
    const readDatesSet = new Set(
      (historyEntries || [])
        .map((e) => {
          if (!e.timestamp) return null;
          const d = new Date(e.timestamp);
          return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
        })
        .filter(Boolean) as string[]
    );

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Monday-based week (0 = Monday, 6 = Sunday)
    const currentDayOfWeek = now.getDay();
    const mondayOffset = (currentDayOfWeek + 6) % 7;
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() - mondayOffset);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const days = [];
    let completedThisWeek = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      const hasRead = readDatesSet.has(dStr);
      const isToday = dStr === todayStr;
      const isPast = dStr < todayStr;
      const isFuture = dStr > todayStr;

      if (hasRead) completedThisWeek++;

      days.push({
        dayName: dayLabels[i],
        dateNum: d.getDate(),
        dateStr: dStr,
        hasRead,
        isToday,
        isPast,
        isFuture,
      });
    }

    return {
      days,
      completedThisWeek,
    };
  }, [historyEntries]);

  const handlePickAvatar = async () => {
    if (!user) {
      setAuthModalVisible(true);
      return;
    }

    try {
      triggerHaptic();
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please grant photo library access to change your profile picture.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setIsUploadingImage(true);

        const res = await processAndUploadAvatar(user.id, asset);
        setIsUploadingImage(false);

        if (!res.success) {
          Alert.alert('Upload Failed', res.error || 'Could not update profile photo.');
        } else {
          triggerHaptic();
          setConfirmModalConfig({
            visible: true,
            title: 'Profile Photo Updated',
            message: 'Your profile avatar has been saved and synchronized across all your devices!',
            iconName: 'checkmark-circle-outline',
            confirmText: 'Great',
            cancelText: '',
            confirmVariant: 'success',
            onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
          });
        }
      }
    } catch (err: any) {
      setIsUploadingImage(false);
      console.error('Error picking avatar image:', err);
      Alert.alert('Error', 'An error occurred while selecting your profile photo.');
    }
  };

  const handleRemoveAvatarPrompt = () => {
    triggerHaptic();
    setConfirmModalConfig({
      visible: true,
      title: 'Remove Profile Photo',
      message: 'Are you sure you want to remove your profile picture? It will reset to your initial letter.',
      iconName: 'trash-outline',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      confirmVariant: 'destructive',
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
        setIsUploadingImage(true);
        await updateProfile({ avatar_url: '' });
        setIsUploadingImage(false);
      },
    });
  };

  const handleStartEdit = () => {
    setEditUsername(displayName);
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      Alert.alert('Invalid Name', 'Display name cannot be empty.');
      return;
    }
    if (editUsername.trim().length < 3) {
      Alert.alert('Invalid Name', 'Display name must be at least 3 characters.');
      return;
    }

    triggerHaptic();
    setIsSaving(true);
    const { error } = await updateProfile({
      username: editUsername.trim(),
      display_name: editUsername.trim(),
    });
    setIsSaving(false);

    if (error) {
      Alert.alert('Update Failed', error.message || 'Could not update profile.');
    } else {
      setIsEditing(false);
      setConfirmModalConfig({
        visible: true,
        title: 'Profile Updated',
        message: `Your public display name has been updated to "${editUsername.trim()}".`,
        iconName: 'checkmark-circle-outline',
        confirmText: 'Great',
        cancelText: '',
        confirmVariant: 'success',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  };

  const handleManualSync = async () => {
    if (!user?.id) return;
    triggerHaptic();
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

  const handleLogoutPrompt = () => {
    setConfirmModalConfig({
      visible: true,
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of your Yomite account?',
      iconName: 'log-out-outline',
      confirmText: 'Sign Out',
      confirmVariant: 'destructive',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
        await signOut();
      },
    });
  };

  const isWeb = Platform.OS === 'web';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)' as any);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[{ flex: 1, width: '100%' }, isWeb && styles.webCenteredContent]}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.headerIconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/settings' as any)}
            style={styles.headerIconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={21} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {user ? (
            <>
              {/* ── 1. FLAT USER HERO ── */}
              <View style={styles.userHeroSection}>
                <View style={styles.avatarWrapper}>
                  <Pressable
                    onPress={handlePickAvatar}
                    disabled={isUploadingImage}
                    accessibilityRole="button"
                    accessibilityLabel="Change profile picture"
                    style={({ pressed, hovered }: any) => [
                      styles.avatarCircle,
                      {
                        backgroundColor: avatarUrl ? 'transparent' : colors.accent,
                        opacity: pressed ? 0.85 : hovered ? 0.95 : 1,
                      },
                      Platform.OS === 'web' && { cursor: 'pointer' as any },
                    ]}
                  >
                    {avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={styles.avatarImg}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Text style={styles.avatarInitials}>
                        {displayName.charAt(0).toUpperCase()}
                      </Text>
                    )}

                    {isUploadingImage && (
                      <View style={styles.avatarLoadingOverlay}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>

                  {/* Minimal Camera Badge */}
                  <Pressable
                    onPress={handlePickAvatar}
                    disabled={isUploadingImage}
                    style={[styles.cameraBadge, { backgroundColor: colors.accent }]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Upload photo"
                  >
                    <Ionicons name="camera" size={12} color="#FFFFFF" />
                  </Pressable>
                </View>

                {/* User Info & Edit */}
                <View style={styles.userInfoCol}>
                  <View style={styles.userNameRow}>
                    <Text style={[styles.userNameText, { color: colors.text }]} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <Pressable
                      onPress={handleStartEdit}
                      style={styles.editBtn}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Edit display name"
                    >
                      <Ionicons name="pencil" size={13} color={colors.accent} />
                    </Pressable>
                  </View>

                  <Text style={[styles.userHandleText, { color: colors.textMuted }]}>
                    @{handle}
                  </Text>

                  {/* Flat Action Buttons Row */}
                  <View style={styles.profileActionRow}>
                    <Pressable
                      onPress={handlePickAvatar}
                      disabled={isUploadingImage}
                      style={({ pressed, hovered }: any) => [
                        styles.flatActionPill,
                        (pressed || hovered) && { opacity: 0.7 },
                        Platform.OS === 'web' && { cursor: 'pointer' as any },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Change profile picture"
                    >
                      <Ionicons name="image-outline" size={13} color={colors.accent} />
                      <Text style={[styles.flatActionPillText, { color: colors.accent }]}>
                        {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                      </Text>
                    </Pressable>

                    {avatarUrl ? (
                      <Pressable
                        onPress={handleRemoveAvatarPrompt}
                        disabled={isUploadingImage}
                        style={({ pressed, hovered }: any) => [
                          styles.flatActionPill,
                          (pressed || hovered) && { opacity: 0.7 },
                          Platform.OS === 'web' && { cursor: 'pointer' as any },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo"
                      >
                        <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
                        <Text style={[styles.flatActionPillText, { color: colors.textMuted }]}>
                          Remove
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      onPress={handleManualSync}
                      disabled={isSyncing}
                      style={({ pressed, hovered }: any) => [
                        styles.flatActionPill,
                        (pressed || hovered) && { opacity: 0.7 },
                        Platform.OS === 'web' && { cursor: 'pointer' as any },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Sync library data"
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color={colors.emerald || '#10B981'} />
                      ) : (
                        <Ionicons name="sync-outline" size={13} color={colors.emerald || '#10B981'} />
                      )}
                      <Text style={[styles.flatActionPillText, { color: colors.emerald || '#10B981' }]}>
                        {isSyncing ? 'Syncing…' : 'Sync Now'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* ── 2. FLAT COLLECTION & READING STATS ── */}
              <View style={styles.sectionWrapper}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Reading Overview
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statTile}>
                    <Text style={[styles.statNumber, { color: colors.text }]}>
                      {Object.keys(libraryEntries).length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                      Library Titles
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statTile}>
                    <Text style={[styles.statNumber, { color: colors.text }]}>
                      {historyEntries.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                      Chapters Read
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statTile}>
                    <Text style={[styles.statNumber, { color: colors.text }]}>
                      {Object.keys(downloadEntries).length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                      Downloads
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statTile}>
                    <Text style={[styles.statNumber, { color: colors.text }]}>
                      {userThreads.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                      Discussions
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── 3. FLAT WEEKLY DAY STREAK ── */}
              <View style={styles.sectionWrapper}>
                <View style={styles.streakHeaderRow}>
                  <View style={styles.streakTitleCol}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      Daily Reading Streak
                    </Text>
                    <Text style={[styles.streakSubtitleText, { color: colors.textMuted }]}>
                      {weekStreakData.completedThisWeek} of 7 days active this week
                    </Text>
                  </View>

                  <View style={[styles.userStreakBadge, { backgroundColor: `${colors.accent}18` }]}>
                    <Ionicons name="flame" size={15} color={colors.accent} />
                    <Text style={[styles.userStreakBadgeText, { color: colors.accent }]}>
                      {userStreak} Day Streak
                    </Text>
                  </View>
                </View>

                {/* 7-Day Flat Tracker Row */}
                <View style={styles.weekDaysRow}>
                  {weekStreakData.days.map((item) => {
                    return (
                      <View key={item.dateStr} style={styles.dayCol}>
                        <Text
                          style={[
                            styles.dayLabelText,
                            { color: item.isToday ? colors.text : colors.textMuted },
                            item.isToday && { fontWeight: '700' },
                          ]}
                        >
                          {item.dayName}
                        </Text>

                        {/* Day Status Circle */}
                        <View
                          style={[
                            styles.dayStatusCircle,
                            {
                              backgroundColor: item.hasRead
                                ? colors.accent
                                : item.isToday
                                ? `${colors.accent}20`
                                : colors.surfaceElevated,
                            },
                            item.isToday && !item.hasRead && {
                              borderWidth: 1.5,
                              borderColor: colors.accent,
                            },
                          ]}
                        >
                          {item.hasRead ? (
                            <Ionicons name="flame" size={16} color="#FFFFFF" />
                          ) : item.isToday ? (
                            <View style={[styles.todayCenterDot, { backgroundColor: colors.accent }]} />
                          ) : item.isPast ? (
                            <View style={[styles.missedDot, { backgroundColor: colors.textMuted }]} />
                          ) : (
                            <Text style={[styles.futureDateNum, { color: colors.textMuted }]}>
                              {item.dateNum}
                            </Text>
                          )}
                        </View>

                        <Text
                          style={[
                            styles.dayDateNumText,
                            { color: item.isToday ? colors.accent : colors.textMuted },
                            item.isToday && { fontWeight: '700' },
                          ]}
                        >
                          {item.dateNum}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Motivational Status Micro-Text */}
                <Text style={[styles.streakMotivationText, { color: colors.textMuted }]}>
                  {userStreak > 0
                    ? `🔥 ${userStreak}-day reading streak! Read daily to keep your momentum going.`
                    : 'Read a chapter today to start your weekly reading streak!'}
                </Text>
              </View>

              {/* ── 4. FLAT QUICK ACCESS LIST ── */}
              <View style={styles.sectionWrapper}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Quick Access
                </Text>
                <View style={styles.flatDividedList}>
                  <Pressable
                    onPress={() => router.push('/(tabs)/library' as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Go to library"
                    style={({ pressed, hovered }: any) => [
                      styles.flatListItem,
                      (pressed || hovered) && { opacity: 0.7 },
                      Platform.OS === 'web' && { cursor: 'pointer' as any },
                    ]}
                  >
                    <View style={styles.flatListItemLeft}>
                      <Ionicons name="library-outline" size={18} color={colors.accent} />
                      <Text style={[styles.flatListItemText, { color: colors.text }]}>
                        My Manga Library
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>

                  <View style={[styles.flatSeparator, { backgroundColor: colors.border }]} />

                  <Pressable
                    onPress={() => router.push('/(tabs)/history' as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Go to reading history"
                    style={({ pressed, hovered }: any) => [
                      styles.flatListItem,
                      (pressed || hovered) && { opacity: 0.7 },
                      Platform.OS === 'web' && { cursor: 'pointer' as any },
                    ]}
                  >
                    <View style={styles.flatListItemLeft}>
                      <Ionicons name="time-outline" size={18} color={colors.accent} />
                      <Text style={[styles.flatListItemText, { color: colors.text }]}>
                        Reading History
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>

                  <View style={[styles.flatSeparator, { backgroundColor: colors.border }]} />

                  <Pressable
                    onPress={() => router.push('/(tabs)/community' as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Go to community discussions"
                    style={({ pressed, hovered }: any) => [
                      styles.flatListItem,
                      (pressed || hovered) && { opacity: 0.7 },
                      Platform.OS === 'web' && { cursor: 'pointer' as any },
                    ]}
                  >
                    <View style={styles.flatListItemLeft}>
                      <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
                      <Text style={[styles.flatListItemText, { color: colors.text }]}>
                        Community Discussions
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>

                  <View style={[styles.flatSeparator, { backgroundColor: colors.border }]} />

                  <Pressable
                    onPress={() => router.push('/(tabs)/settings' as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Go to settings"
                    style={({ pressed, hovered }: any) => [
                      styles.flatListItem,
                      (pressed || hovered) && { opacity: 0.7 },
                      Platform.OS === 'web' && { cursor: 'pointer' as any },
                    ]}
                  >
                    <View style={styles.flatListItemLeft}>
                      <Ionicons name="settings-outline" size={18} color={colors.accent} />
                      <Text style={[styles.flatListItemText, { color: colors.text }]}>
                        App & Reader Preferences
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>

              {/* ── 5. FLAT SIGN OUT ── */}
              <View style={styles.signOutSection}>
                <Pressable
                  onPress={handleLogoutPrompt}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out of Yomite"
                  style={({ pressed, hovered }: any) => [
                    styles.flatSignOutBtn,
                    (pressed || hovered) && { opacity: 0.7 },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                  <Text style={styles.flatSignOutText}>Sign out</Text>
                </Pressable>
              </View>
            </>
          ) : (
            /* ── LOGGED OUT GUEST VIEW (FLAT) ── */
            <View style={styles.guestSection}>
              <View style={[styles.guestIconCircle, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="person-outline" size={36} color={colors.accent} />
              </View>
              <Text style={[styles.guestTitle, { color: colors.text }]}>Account & Cloud Sync</Text>
              <Text style={[styles.guestSubtitle, { color: colors.textMuted }]}>
                Sign in to sync your bookmarks, record reading progress across devices, and participate in discussions.
              </Text>

              <Pressable
                onPress={() => setAuthModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Sign in or create account"
                style={({ pressed, hovered }: any) => [
                  styles.guestSignInBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: pressed ? 0.85 : hovered ? 0.95 : 1,
                  },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                <Text style={styles.guestSignInBtnText}>Sign In / Create Account</Text>
              </Pressable>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Edit Profile Modal Dialog */}
        <ConfirmationModal
          visible={isEditing}
          title="Edit Display Name"
          message="Enter your preferred username / display name for Yomite."
          iconName="person-circle-outline"
          confirmText={isSaving ? 'Saving...' : 'Save Changes'}
          cancelText="Cancel"
          confirmVariant="primary"
          onConfirm={handleSaveProfile}
          onCancel={() => setIsEditing(false)}
        >
          <View style={styles.editInputWrapper}>
            <TextInput
              style={[
                styles.editTextInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. OtakuLegend"
              placeholderTextColor={colors.textMuted}
              value={editUsername}
              onChangeText={setEditUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>
        </ConfirmationModal>

        {/* Auth Modal for Guests */}
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />

        {/* General Confirmation Modal */}
        <ConfirmationModal
          visible={confirmModalConfig.visible}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          iconName={confirmModalConfig.iconName || 'alert-circle-outline'}
          confirmVariant={confirmModalConfig.confirmVariant || 'primary'}
          confirmText={confirmModalConfig.confirmText || 'OK'}
          cancelText={confirmModalConfig.cancelText}
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
  webCenteredContent: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerIconBtn: {
    padding: 6,
    borderRadius: Radius.full,
  },
  headerTitle: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: 28,
  },

  /* 1. Flat User Hero Section */
  userHeroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: Typography.weights.bold,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoCol: {
    flex: 1,
    gap: 2,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.3,
  },
  editBtn: {
    padding: 4,
  },
  userHandleText: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
    marginBottom: 4,
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 2,
  },
  flatActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 0,
    minHeight: 28,
  },
  flatActionPillText: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
  },

  /* 2. Flat Stats Overview */
  sectionWrapper: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    paddingHorizontal: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.medium,
  },

  /* 3. Flat Weekly Day Streak */
  streakHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  streakTitleCol: {
    gap: 2,
  },
  streakSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  userStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  userStreakBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  weekDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dayLabelText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  dayStatusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCenterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  missedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.4,
  },
  futureDateNum: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },
  dayDateNumText: {
    fontSize: 11,
    fontWeight: '500',
  },
  streakMotivationText: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 2,
  },

  /* 4. Flat Divided List for Quick Access */
  flatDividedList: {
    paddingVertical: 2,
  },
  flatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  flatListItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  flatListItemText: {
    fontSize: 14,
    fontWeight: Typography.weights.medium,
  },
  flatSeparator: {
    height: 1,
    opacity: 0.4,
    marginLeft: 32,
  },

  /* 5. Flat Sign Out */
  signOutSection: {
    paddingTop: 8,
  },
  flatSignOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  flatSignOutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: Typography.weights.semibold,
  },

  /* 6. Flat Guest State */
  guestSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
    gap: 12,
  },
  guestIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  guestSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 340,
  },
  guestSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    paddingHorizontal: 24,
    borderRadius: Radius.md,
    gap: 8,
    marginTop: 8,
  },
  guestSignInBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: Typography.weights.bold,
  },

  /* Edit Name Modal Input */
  editInputWrapper: {
    marginVertical: Spacing.sm,
    width: '100%',
  },
  editTextInput: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.body,
  },
});
