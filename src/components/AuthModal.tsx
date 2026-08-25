/**
 * AuthModal — Modern Bottom Sheet / Web Dialog Auth Modal for Google & Email Sign In / Registration
 * Features official 4-color Google G logo, preferred username field for registration,
 * password toggle, and native haptics.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { triggerHaptic } from '../utils/haptics';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import { GoogleLogoIcon } from './GoogleLogoIcon';
import { useUserStore } from '../store/userStore';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AuthModal({ visible, onClose }: AuthModalProps) {
  const colors = useThemeColors();

  const signUpWithEmail = useUserStore((s) => s.signUpWithEmail);
  const signInWithEmail = useUserStore((s) => s.signInWithEmail);
  const signInWithGoogle = useUserStore((s) => s.signInWithGoogle);

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    triggerHaptic();
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    setIsSubmitting(false);
    if (error) {
      Alert.alert('Google Sign In Error', error.message || 'Failed to authenticate with Google.');
    } else {
      onClose();
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }

    if (authMode === 'signup' && !username.trim()) {
      Alert.alert('Username Required', 'Please choose a preferred username for your public display name.');
      return;
    }

    if (authMode === 'signup' && username.trim().length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters long.');
      return;
    }

    triggerHaptic();
    setIsSubmitting(true);
    if (authMode === 'signup') {
      const { error } = await signUpWithEmail(email.trim(), password.trim(), username.trim());
      setIsSubmitting(false);
      if (error) {
        Alert.alert('Registration Failed', error.message);
      } else {
        Alert.alert('Success', 'Account created successfully! Welcome to Yomite.');
        onClose();
      }
    } else {
      const { error } = await signInWithEmail(email.trim(), password.trim());
      setIsSubmitting(false);
      if (error) {
        Alert.alert('Sign In Failed', error.message);
      } else {
        onClose();
      }
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      animationType={isWeb ? 'fade' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isWeb && styles.webBackdrop]}>
        <Pressable style={styles.overlayPress} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            isWeb && styles.webSheetContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {!isWeb && <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  Sync your library & reading history across all your devices
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Official Google Sign In Button */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.googleButton,
                { opacity: pressed || isSubmitting ? 0.8 : 1 },
              ]}
            >
              <GoogleLogoIcon size={20} />
              <Text style={styles.googleButtonText}>
                {authMode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>
                OR WITH EMAIL
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Segmented Auth Mode Switcher */}
            <View style={styles.tabContainer}>
              <Pressable
                onPress={() => setAuthMode('signin')}
                style={[
                  styles.tabBtn,
                  authMode === 'signin' && {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: authMode === 'signin' ? colors.accent : colors.textMuted },
                  ]}
                >
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAuthMode('signup')}
                style={[
                  styles.tabBtn,
                  authMode === 'signup' && {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: authMode === 'signup' ? colors.accent : colors.textMuted },
                  ]}
                >
                  Create Account
                </Text>
              </Pressable>
            </View>

            {/* Form Inputs */}
            <View style={styles.formGroup}>
              {/* Preferred Username (Only for Sign Up) */}
              {authMode === 'signup' && (
                <View>
                  <View style={[styles.inputBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      placeholder="Preferred Username / Display Name"
                      placeholderTextColor={colors.textMuted}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Text style={[styles.helperText, { color: colors.textMuted }]}>
                    Your public display name in community discussions & reviews.
                  </Text>
                </View>
              )}

              <View style={[styles.inputBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={[styles.inputBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={handleEmailAuth}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.submitBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: pressed || isSubmitting ? 0.8 : 1,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  webBackdrop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  overlayPress: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '90%',
  },
  webSheetContainer: {
    width: '100%',
    maxWidth: 480,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 10,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
  },
  subtitle: {
    fontSize: Typography.sizes.footnote,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  googleButton: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  googleButtonText: {
    color: '#1F1F23',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xs,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tabBtn: {
    flex: 1,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  formGroup: {
    gap: Spacing.md,
  },
  inputBox: {
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.sizes.body,
    paddingVertical: 0,
  },
  helperText: {
    fontSize: 10,
    marginTop: 4,
    marginLeft: 4,
  },
  eyeBtn: {
    padding: 4,
  },
  submitBtn: {
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
});
