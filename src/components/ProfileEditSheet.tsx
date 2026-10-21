import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import {
  useUserStore,
  getUserDisplayName,
  getUserAvatarUrl,
  getUserBannerUrl,
} from '../store/userStore';
import { processAndUploadAvatar } from '../services/avatarService';
import { processAndUploadBanner } from '../services/bannerService';
import { triggerHaptic } from '../utils/haptics';
import { MobileModalRoot, MobileSheetPanel, MobileSheetPanelRef } from './MobileBottomSheet';

const DEFAULT_BANNER = require('../../assets/images/login_backdrop_collage.jpg');

interface ProfileEditSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (displayName: string) => void;
}

type UploadTarget = 'avatar' | 'banner';

export function ProfileEditSheet({ visible, onClose, onSaved }: ProfileEditSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isWeb = Platform.OS === 'web';
  const sheetRef = useRef<MobileSheetPanelRef>(null);

  const user = useUserStore((s) => s.user);
  const updateProfile = useUserStore((s) => s.updateProfile);

  const displayName = getUserDisplayName(user);
  const avatarUrl = getUserAvatarUrl(user);
  const bannerUrl = getUserBannerUrl(user);

  const [draftName, setDraftName] = useState(displayName);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadTarget | null>(null);
  const isBusy = isSaving || uploading !== null;

  useEffect(() => {
    if (visible) {
      setDraftName(displayName);
    }
  }, [visible, displayName]);

  const closeSheet = () => {
    if (isWeb) {
      onClose();
    } else {
      sheetRef.current?.close();
    }
  };

  const pickImage = async (target: UploadTarget) => {
    if (!user || uploading || isSaving) return;

    try {
      triggerHaptic();

      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please grant photo library access to update your profile.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: Platform.OS !== 'web',
        aspect: target === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;

      setUploading(target);
      const res =
        target === 'avatar'
          ? await processAndUploadAvatar(user.id, result.assets[0])
          : await processAndUploadBanner(user.id, result.assets[0]);
      setUploading(null);

      if (!res.success) {
        Alert.alert(
          'Upload Failed',
          res.error ||
            (target === 'avatar'
              ? 'Could not update your profile photo.'
              : 'Could not update your banner.')
        );
      } else {
        triggerHaptic();
      }
    } catch (err) {
      console.error('Profile image upload error:', err);
      setUploading(null);
      Alert.alert('Error', 'Something went wrong while selecting your image.');
    }
  };

  const handleSave = async () => {
    if (isBusy) return;

    const trimmedName = draftName.trim();
    if (!trimmedName) {
      Alert.alert('Invalid Username', 'Username cannot be empty.');
      return;
    }
    if (trimmedName.length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters.');
      return;
    }

    triggerHaptic();

    if (trimmedName === displayName) {
      closeSheet();
      return;
    }

    setIsSaving(true);
    const { error } = await updateProfile({
      username: trimmedName,
      display_name: trimmedName,
    });
    setIsSaving(false);

    if (error) {
      Alert.alert('Update Failed', error.message || 'Could not update your profile.');
      return;
    }

    if (onSaved) {
      onSaved(trimmedName);
    } else {
      onClose();
    }
  };

  const previewInitial =
    (draftName.trim() || displayName).charAt(0).toUpperCase() || 'Y';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? 'fade' : 'none'}
      onRequestClose={closeSheet}
    >
      <MobileModalRoot style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeSheet}
          accessibilityRole="button"
          accessibilityLabel="Close edit profile"
        />

        <KeyboardAvoidingView
          style={styles.keyboardWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <MobileSheetPanel
            ref={isWeb ? undefined : sheetRef}
            visible={visible}
            onClose={onClose}
            showHandle={!isWeb}
            gestureHandleOnly
            style={[
              styles.sheet,
              isDesktop && styles.desktopSheet,
              { backgroundColor: colors.surface },
            ]}
          >
            {isWeb && <View style={[styles.webHandle, { backgroundColor: colors.border }]} />}

            <View style={styles.header}>
              <View style={styles.headerTextCol}>
                <Text style={[styles.title, { color: colors.text }]}>Edit Profile</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  Update your username, photo and banner
                </Text>
              </View>

              <Pressable
                onPress={closeSheet}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close edit profile"
                style={({ pressed, hovered }: any) => [
                  styles.closeBtn,
                  { backgroundColor: colors.surfaceElevated },
                  (pressed || hovered) && { opacity: 0.7 },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <Ionicons name="close" size={19} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                onPress={() => pickImage('banner')}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Change profile banner"
                style={({ pressed, hovered }: any) => [
                  styles.bannerPreview,
                  { backgroundColor: colors.surfaceElevated },
                  (pressed || hovered) && { opacity: 0.9 },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <Image
                  source={bannerUrl ? { uri: bannerUrl } : DEFAULT_BANNER}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0, 0, 0, 0.55)']}
                  locations={[0.45, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                <View style={styles.bannerEditPill}>
                  {uploading === 'banner' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="camera-outline" size={15} color="#FFFFFF" />
                  )}
                  <Text style={styles.bannerEditText}>
                    {uploading === 'banner' ? 'Uploading…' : 'Change Banner'}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.avatarRow}>
                <Pressable
                  onPress={() => pickImage('avatar')}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                  style={({ pressed, hovered }: any) => [
                    styles.avatarPressable,
                    (pressed || hovered) && { opacity: 0.9 },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <View
                    style={[
                      styles.avatarCircle,
                      {
                        borderColor: colors.surface,
                        backgroundColor: avatarUrl ? 'transparent' : colors.accent,
                      },
                    ]}
                  >
                    {avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={styles.avatarImage}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Text style={[styles.avatarInitial, { color: colors.accentForeground }]}>
                        {previewInitial}
                      </Text>
                    )}

                    {uploading === 'avatar' && (
                      <View style={styles.avatarLoadingOverlay}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    )}
                  </View>

                  <View
                    style={[
                      styles.avatarCameraBadge,
                      { backgroundColor: colors.accent, borderColor: colors.surface },
                    ]}
                  >
                    <Ionicons name="camera" size={13} color={colors.accentForeground} />
                  </View>
                </Pressable>

                <View style={styles.avatarTextCol}>
                  <Text style={[styles.avatarTitle, { color: colors.text }]}>Profile Photo</Text>
                  <Text style={[styles.avatarHint, { color: colors.textMuted }]}>
                    Tap the camera to upload a new photo
                  </Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Username</Text>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Your username"
                  placeholderTextColor={colors.textMuted}
                  maxLength={32}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  selectionColor={colors.accent}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  This is how your name appears across Yomite. At least 3 characters.
                </Text>
              </View>
            </ScrollView>

            <View
              style={[
                styles.footer,
                {
                  borderTopColor: colors.border,
                  backgroundColor: colors.surface,
                  paddingBottom: Math.max(insets.bottom, Spacing.lg),
                },
              ]}
            >
              <Pressable
                onPress={handleSave}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Save profile changes"
                style={({ pressed, hovered }: any) => [
                  styles.saveBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: isBusy ? 0.55 : pressed ? 0.85 : hovered ? 0.95 : 1,
                  },
                  Platform.OS === 'web' && { cursor: isBusy ? 'default' : ('pointer' as any) },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.accentForeground} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: colors.accentForeground }]}>
                    Save Changes
                  </Text>
                )}
              </Pressable>
            </View>
          </MobileSheetPanel>
        </KeyboardAvoidingView>
      </MobileModalRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  keyboardWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingTop: 4,
  },
  desktopSheet: {
    maxWidth: 500,
    alignSelf: 'center',
    borderRadius: 28,
    marginBottom: 20,
  },
  webHandle: {
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTextCol: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },
  bannerPreview: {
    height: 136,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  bannerEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    margin: 12,
  },
  bannerEditText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    marginTop: -60,
  },
  avatarPressable: {
    width: 88,
    height: 88,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextCol: {
    flex: 1,
    gap: 2,
    paddingBottom: Spacing.xs,
  },
  avatarTitle: {
    fontSize: 14,
    fontWeight: Typography.weights.semibold,
  },
  avatarHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  field: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
  },
  input: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
    fontWeight: Typography.weights.medium,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    marginTop: Spacing.xs,
  },
  saveBtn: {
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: Typography.weights.bold,
  },
});
