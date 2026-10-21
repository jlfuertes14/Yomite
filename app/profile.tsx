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
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius, Typography } from '../constants/Colors';
import { useThemeColors } from '../src/hooks/useThemeColor';
import { useUserStore, getUserDisplayName, getUserHandle, getUserAvatarUrl, getUserBannerUrl } from '../src/store/userStore';
import { useLibraryStore } from '../src/store/libraryStore';
import { useHistoryStore } from '../src/store/historyStore';
import { useDownloadStore } from '../src/store/downloadStore';
import { useCommunityStore } from '../src/store/communityStore';
import { triggerHaptic } from '../src/utils/haptics';

import { ConfirmationModal } from '../src/components/ConfirmationModal';
import { ProfileEditSheet } from '../src/components/ProfileEditSheet';
import { useDocumentTitle } from '../src/utils/useDocumentTitle';

const STREAK_DAY_ART = {
  Mon: require('../assets/images/streaks/monday.png'),
  Tue: require('../assets/images/streaks/tuesday.png'),
  Wed: require('../assets/images/streaks/wednesday.png'),
  Thu: require('../assets/images/streaks/thursday.png'),
  Fri: require('../assets/images/streaks/friday.png'),
  Sat: require('../assets/images/streaks/saturday.png'),
  Sun: require('../assets/images/streaks/sunday.png'),
} as const;

const STREAK_FLAME_ART = require('../assets/images/streaks/flame.png');

export default function ProfileScreen() {
  useDocumentTitle('User Profile');
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const refreshUser = useUserStore((s) => s.refreshUser);

  const libraryEntries = useLibraryStore((s) => s.entries);
  const historyEntries = useHistoryStore((s) => s.entries);
  const downloadEntries = useDownloadStore((s) => s.chapters);
  const userThreads = useCommunityStore((s) => s.userThreads);

  const [isEditing, setIsEditing] = useState(false);

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
  const bannerUrl = getUserBannerUrl(user);
  const streakFill = [`${colors.accent}66`, `${colors.accent}1F`] as const;
  const contentWidth = Math.min(width, 720) - Spacing.lg * 2;
  const streakCircleSize = Math.min(
    48,
    Math.max(36, Math.floor(contentWidth / 7) - 2)
  );
  const streakImageSize = streakCircleSize - 4;
  const statNumberSize = width >= 768 ? 38 : width < 360 ? 28 : 32;

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

  const handleStartEdit = () => {
    triggerHaptic();
    setIsEditing(true);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[{ flex: 1, width: '100%' }, isWeb && styles.webCenteredContent]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── BANNER ── */}
          <View style={styles.banner}>
            <Image
              source={bannerUrl ? { uri: bannerUrl } : require('../assets/images/login_backdrop_collage.jpg')}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={250}
              cachePolicy="memory-disk"
              accessibilityLabel="Profile banner"
            />
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.72)', 'rgba(0, 0, 0, 0.42)', 'rgba(0, 0, 0, 0.52)']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['transparent', colors.background]}
              locations={[0.5, 1]}
              style={styles.bannerFade}
              pointerEvents="none"
            />

            <View style={[styles.bannerNav, { paddingTop: insets.top + 10 }]}>
              <Pressable
                onPress={handleBack}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={({ pressed, hovered }: any) => [
                  styles.bannerIconBtn,
                  (pressed || hovered) && { opacity: 0.7 },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.bannerTitle}>Profile</Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/settings',
                    params: { from: 'profile' },
                  } as any)
                }
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                style={({ pressed, hovered }: any) => [
                  styles.bannerIconBtn,
                  (pressed || hovered) && { opacity: 0.7 },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View
            style={[
              styles.body,
              { paddingBottom: 32 + insets.bottom },
            ]}
          >
            <View style={styles.identityRow}>
              <View
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: avatarUrl ? 'transparent' : colors.accent,
                    borderColor: colors.background,
                  },
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
                ) : user ? (
                  <Text style={[styles.avatarInitials, { color: colors.accentForeground }]}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                ) : (
                  <Ionicons name="person" size={38} color={colors.accentForeground} />
                )}
              </View>
            </View>

            {/* Name & Handle */}
            <View style={styles.nameBlock}>
              <View style={styles.userNameRow}>
                <Text style={[styles.userNameText, { color: colors.text }]} numberOfLines={1}>
                  {user ? displayName : 'Guest Reader'}
                </Text>
                {user && (
                  <Pressable
                    onPress={handleStartEdit}
                    style={styles.editBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Edit profile"
                  >
                    <Ionicons name="pencil" size={16} color={colors.accent} />
                  </Pressable>
                )}
              </View>

              <Text style={[styles.userHandleText, { color: colors.textSecondary }]} numberOfLines={1}>
                {user ? `@${handle}` : 'Sign in to sync your reading'}
              </Text>
            </View>

            {user ? (
              <>
              {/* ── 2. READING OVERVIEW ── */}
              <View style={styles.sectionWrapper}>
                <Text style={[styles.heroSectionTitle, { color: colors.text }]}>
                  Reading Overview
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statTile}>
                    <Text style={[styles.statNumber, { color: colors.accent, fontSize: statNumberSize }]} numberOfLines={1}>
                      {Object.keys(libraryEntries).length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                      Library Titles
                    </Text>
                  </View>

                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.statTile}>
                    <Text style={[styles.statNumber, { color: colors.accent, fontSize: statNumberSize }]} numberOfLines={1}>
                      {historyEntries.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                      Chapters Read
                    </Text>
                  </View>

                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.statTile}>
                    <Text style={[styles.statNumber, { color: colors.accent, fontSize: statNumberSize }]} numberOfLines={1}>
                      {Object.keys(downloadEntries).length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                      Downloads
                    </Text>
                  </View>

                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.statTile}>
                    <Text style={[styles.statNumber, { color: colors.accent, fontSize: statNumberSize }]} numberOfLines={1}>
                      {userThreads.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                      Discussions
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── 3. DAILY READING STREAK ── */}
              <View style={styles.sectionWrapper}>
                <View style={styles.streakHeaderRow}>
                  <View style={styles.streakTitleCol}>
                    <Text style={[styles.heroSectionTitle, { color: colors.text }]}>
                      Daily Reading Streak
                    </Text>
                    <Text style={[styles.streakSubtitleText, { color: colors.textMuted }]}>
                      {weekStreakData.completedThisWeek} of 7 days active this week
                    </Text>
                  </View>

                  <View style={styles.userStreakBadge}>
                    <Image
                      source={STREAK_FLAME_ART}
                      style={styles.userStreakFlame}
                      contentFit="contain"
                      transition={150}
                      cachePolicy="memory-disk"
                      accessibilityLabel="Reading streak"
                    />
                    <Text style={[styles.userStreakBadgeText, { color: colors.accent }]}>
                      {userStreak} {userStreak === 1 ? 'Day' : 'Days'}
                    </Text>
                  </View>
                </View>

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
                                width: streakCircleSize,
                                height: streakCircleSize,
                                borderRadius: streakCircleSize / 2,
                              },
                              {
                                backgroundColor: item.hasRead
                                  ? 'transparent'
                                  : item.isToday
                                  ? `${colors.accent}20`
                                  : colors.background,
                              },
                              item.isToday && !item.hasRead && {
                                borderWidth: 1.5,
                                borderColor: colors.accent,
                              },
                            ]}
                          >
                            {item.hasRead && (
                              <LinearGradient
                                colors={streakFill}
                                start={{ x: 0.15, y: 0 }}
                                end={{ x: 0.85, y: 1 }}
                                style={[
                                  StyleSheet.absoluteFill,
                                  styles.streakDayBackdrop,
                                  { borderRadius: streakCircleSize / 2 },
                                ]}
                                pointerEvents="none"
                              />
                            )}
                            {item.hasRead ? (
                              <Image
                                source={STREAK_DAY_ART[item.dayName as keyof typeof STREAK_DAY_ART]}
                                style={{
                                  width: streakImageSize,
                                  height: streakImageSize,
                                }}
                                contentFit="contain"
                                transition={150}
                                cachePolicy="memory-disk"
                                accessibilityLabel={`${item.dayName} reading streak completed`}
                              />
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
                  <View style={[styles.streakMotivationDivider, { backgroundColor: colors.border }]} />
                  <Text style={[styles.streakMotivationText, { color: colors.textMuted }]}>
                    {userStreak > 0
                      ? `${userStreak}-day reading streak! Read daily to keep your momentum going.`
                      : 'Read a chapter today to start your weekly reading streak!'}
                  </Text>
              </View>

              {/* ── 4. SIGN OUT ── */}
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
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                  <Text style={styles.flatSignOutText}>Sign out</Text>
                </Pressable>
              </View>
            </>
          ) : (
            /* ── LOGGED OUT GUEST VIEW ── */
            <View style={styles.guestSection}>
              <View style={[styles.guestIconCircle, { backgroundColor: `${colors.accent}14` }]}>
                <Ionicons name="cloud-upload-outline" size={28} color={colors.accent} />
              </View>
              <Text style={[styles.guestTitle, { color: colors.text }]}>Sync your library</Text>
              <Text style={[styles.guestSubtitle, { color: colors.textMuted }]}>
                Sign in to save bookmarks, sync reading progress across devices, and join community discussions.
              </Text>

              <Pressable
                onPress={() => {
                  triggerHaptic();
                  router.push({ pathname: '/auth/login', params: { redirect: '/profile' } } as any);
                }}
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
                <Ionicons name="log-in-outline" size={18} color={colors.accentForeground} />
                <Text style={[styles.guestSignInBtnText, { color: colors.accentForeground }]}>
                  Sign In / Create Account
                </Text>
              </Pressable>
            </View>
          )}
          </View>
        </ScrollView>

        {/* Edit Profile Sheet */}
        <ProfileEditSheet
          visible={isEditing}
          onClose={() => setIsEditing(false)}
          onSaved={(name) => {
            setIsEditing(false);
            setTimeout(() => {
              setConfirmModalConfig({
                visible: true,
                title: 'Profile Updated',
                message: `Your username has been updated to "${name}".`,
                iconName: 'checkmark-circle-outline',
                confirmText: 'Great',
                cancelText: '',
                confirmVariant: 'success',
                onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
              });
            }, 260);
          }}
        />


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
    </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  banner: {
    height: 230,
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  bannerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 130,
  },
  bannerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  bannerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    gap: 36,
  },
  identityRow: {
    marginTop: -46,
    zIndex: 2,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: Typography.weights.bold,
  },
  nameBlock: {
    gap: 6,
    marginTop: 4,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userNameText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    flexShrink: 1,
  },
  editBtn: {
    padding: 4,
  },
  userHandleText: {
    fontSize: 14,
    fontWeight: Typography.weights.medium,
  },

  /* 2. Reading Overview */
  sectionWrapper: {
    gap: 16,
  },
  heroSectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingHorizontal: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 28,
    paddingHorizontal: 2,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 44,
  },
  statNumber: {
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12.5,
    lineHeight: 16,
    minHeight: 32,
    fontWeight: '600',
    textAlign: 'center',
  },

  /* 3. Daily Reading Streak */
  streakHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    gap: 12,
  },
  streakTitleCol: {
    gap: 3,
    flexShrink: 1,
  },
  streakSubtitleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  userStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  userStreakFlame: {
    width: 26,
    height: 26,
  },
  userStreakBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  weekDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 26,
    paddingBottom: 10,
    paddingHorizontal: 0,
  },
  dayCol: {
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dayLabelText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  dayStatusCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayBackdrop: {
    overflow: 'hidden',
  },
  todayCenterDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  missedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.4,
  },
  futureDateNum: {
    fontSize: 12.5,
    fontWeight: '500',
    opacity: 0.6,
  },
  dayDateNumText: {
    fontSize: 12,
    fontWeight: '500',
  },
  streakMotivationDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 2,
    opacity: 0.7,
  },
  streakMotivationText: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 12,
  },

  /* 4. Flat Sign Out */
  signOutSection: {
    marginTop: 'auto',
    paddingTop: 12,
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
    fontSize: 16,
    fontWeight: Typography.weights.semibold,
  },

  /* 6. Guest State */
  guestSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 40,
    paddingHorizontal: 8,
    gap: 12,
  },
  guestIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  guestTitle: {
    fontSize: 18,
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
    alignSelf: 'stretch',
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  guestSignInBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: Typography.weights.bold,
  },
});
