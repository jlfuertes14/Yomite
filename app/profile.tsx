/**
 * Profile Screen — Comprehensive Yomite User Profile & Account Settings
 * Features user display name, preferred @handle, reading statistics,
 * cloud sync controls, inline profile editing, and quick shortcuts.
 */
import React, { useState, useEffect, useCallback } from 'react';
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
import { AnimatedCard } from '../src/components/AnimatedCard';
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
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Profile</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/settings' as any)}
            style={styles.settingsBtn}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {user ? (
            <>
              {/* Profile Hero Card */}
              <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.profileCardTop}>
                  <View style={styles.avatarContainer}>
                    <Pressable
                      onPress={handlePickAvatar}
                      disabled={isUploadingImage}
                      style={({ pressed }) => [
                        styles.avatarLarge,
                        {
                          backgroundColor: avatarUrl ? 'transparent' : colors.accent,
                          borderColor: colors.border,
                          borderWidth: 2,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          style={styles.avatarLargeImage}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <Text style={styles.avatarLargeText}>
                          {displayName.charAt(0).toUpperCase()}
                        </Text>
                      )}

                      {isUploadingImage && (
                        <View style={styles.avatarUploadingOverlay}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        </View>
                      )}
                    </Pressable>

                    {/* Camera upload badge */}
                    <Pressable
                      onPress={handlePickAvatar}
                      disabled={isUploadingImage}
                      style={({ pressed }) => [
                        styles.cameraBadge,
                        {
                          backgroundColor: colors.accent,
                          borderColor: colors.surface,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                      hitSlop={8}
                    >
                      <Ionicons name="camera" size={13} color="#FFFFFF" />
                    </Pressable>
                  </View>

                  <View style={styles.profileDetails}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Pressable
                        onPress={handleStartEdit}
                        style={[styles.editIconBtn, { backgroundColor: colors.surfaceElevated }]}
                        hitSlop={8}
                      >
                        <Ionicons name="pencil" size={14} color={colors.accent} />
                      </Pressable>
                    </View>

                    <Text style={[styles.profileHandle, { color: colors.textMuted }]}>
                      @{handle}
                    </Text>

                    <View style={styles.emailRow}>
                      <Ionicons name="mail-outline" size={13} color={colors.textSecondary} />
                      <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                        {email}
                      </Text>
                    </View>

                    <View style={styles.memberSinceRow}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                      <Text style={[styles.memberSinceText, { color: colors.textMuted }]}>
                        Joined {memberSince}
                      </Text>
                    </View>

                    {/* Avatar Actions (Upload / Remove) */}
                    <View style={styles.avatarActionRow}>
                      <Pressable
                        onPress={handlePickAvatar}
                        disabled={isUploadingImage}
                        style={({ pressed }) => [
                          styles.avatarTextBtn,
                          {
                            backgroundColor: colors.surfaceElevated,
                            borderColor: colors.border,
                            opacity: isUploadingImage ? 0.6 : pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Ionicons name="image-outline" size={12} color={colors.accent} />
                        <Text style={[styles.avatarTextBtnLabel, { color: colors.accent }]}>
                          {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                        </Text>
                      </Pressable>

                      {avatarUrl && (
                        <Pressable
                          onPress={handleRemoveAvatarPrompt}
                          disabled={isUploadingImage}
                          style={({ pressed }) => [
                            styles.avatarTextBtn,
                            {
                              backgroundColor: colors.surfaceElevated,
                              borderColor: colors.border,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Ionicons name="trash-outline" size={12} color={colors.textSecondary} />
                          <Text style={[styles.avatarTextBtnLabel, { color: colors.textSecondary }]}>
                            Remove
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>

                {/* Cloud Sync Status Badge */}
                <View style={[styles.syncStatusBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <View style={styles.syncStatusLeft}>
                    <View style={[styles.statusDot, { backgroundColor: colors.emerald }]} />
                    <Text style={[styles.syncStatusText, { color: colors.textSecondary }]}>
                      Cloud Sync & Multi-Device Active
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleManualSync}
                    disabled={isSyncing}
                    style={[styles.syncActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <>
                        <Ionicons name="sync-outline" size={13} color={colors.accent} />
                        <Text style={[styles.syncActionBtnText, { color: colors.accent }]}>Sync Now</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Statistics Grid */}
              <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                COLLECTION & READING STATS
              </Text>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.statIconBox, { backgroundColor: `${colors.accent}18` }]}>
                    <Ionicons name="library-outline" size={20} color={colors.accent} />
                  </View>
                  <Text style={[styles.statNumber, { color: colors.text }]}>{Object.keys(libraryEntries).length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Library Titles</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.statIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Ionicons name="book-outline" size={20} color={colors.emerald} />
                  </View>
                  <Text style={[styles.statNumber, { color: colors.text }]}>{historyEntries.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Chapters Read</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.statIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                    <Ionicons name="download-outline" size={20} color="#3B82F6" />
                  </View>
                  <Text style={[styles.statNumber, { color: colors.text }]}>{Object.keys(downloadEntries).length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Offline Chapters</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.statIconBox, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                    <Ionicons name="chatbubbles-outline" size={20} color="#EAB308" />
                  </View>
                  <Text style={[styles.statNumber, { color: colors.text }]}>{userThreads.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Community Topics</Text>
                </View>
              </View>

              {/* Quick Navigation Links */}
              <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                QUICK ACCESS
              </Text>
              <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                  onPress={() => router.push('/(tabs)/library' as any)}
                  style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name="library-outline" size={20} color={colors.accent} />
                    <Text style={[styles.menuItemText, { color: colors.text }]}>My Manga Library</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

                <Pressable
                  onPress={() => router.push('/(tabs)/history' as any)}
                  style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name="time-outline" size={20} color={colors.accent} />
                    <Text style={[styles.menuItemText, { color: colors.text }]}>Reading History</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

                <Pressable
                  onPress={() => router.push('/(tabs)/community' as any)}
                  style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name="chatbubbles-outline" size={20} color={colors.accent} />
                    <Text style={[styles.menuItemText, { color: colors.text }]}>Community Discussions</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

                <Pressable
                  onPress={() => router.push('/(tabs)/settings' as any)}
                  style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name="settings-outline" size={20} color={colors.accent} />
                    <Text style={[styles.menuItemText, { color: colors.text }]}>App & Reader Preferences</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* Sign Out Button */}
              <Pressable
                onPress={handleLogoutPrompt}
                style={({ pressed }) => [
                  styles.logoutCardBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: 'rgba(244, 63, 94, 0.3)',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.accent} />
                <Text style={[styles.logoutCardBtnText, { color: colors.accent }]}>
                  Sign Out of Account
                </Text>
              </Pressable>
            </>
          ) : (
            /* Logged Out Guest Banner */
            <View style={[styles.guestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.guestIconCircle, { backgroundColor: `${colors.accent}18` }]}>
                <Ionicons name="person-circle-outline" size={64} color={colors.accent} />
              </View>
              <Text style={[styles.guestTitle, { color: colors.text }]}>Sign In to Yomite</Text>
              <Text style={[styles.guestSubtitle, { color: colors.textMuted }]}>
                Create an account or sign in with Google to sync your bookmarks, record reading progress across all devices, and participate in community discussions.
              </Text>

              <Pressable
                onPress={() => setAuthModalVisible(true)}
                style={[styles.guestSignInBtn, { backgroundColor: colors.accent }]}
              >
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
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
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
  },
  settingsBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  profileCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  profileCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarLargeImage: {
    width: '100%',
    height: '100%',
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: Typography.weights.bold,
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 3px rgba(0, 0, 0, 0.3)',
    elevation: 3,
  },
  avatarActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 6,
  },
  avatarTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  avatarTextBtnLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
  },
  profileDetails: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  profileName: {
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
  },
  editIconBtn: {
    padding: 5,
    borderRadius: Radius.full,
  },
  profileHandle: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  profileEmail: {
    fontSize: Typography.sizes.caption,
  },
  memberSinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  memberSinceText: {
    fontSize: Typography.sizes.caption,
  },
  syncStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncStatusText: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
  },
  syncActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  syncActionBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  statLabel: {
    fontSize: Typography.sizes.caption,
  },
  menuCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  menuItemText: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
  },
  menuDivider: {
    height: 1,
    marginLeft: Spacing.lg + 20 + Spacing.md,
  },
  logoutCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  logoutCardBtnText: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  guestCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  guestIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: Typography.sizes.footnote,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 380,
  },
  guestSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  guestSignInBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
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
