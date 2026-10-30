/**
 * Login Screen — Full-screen dedicated authentication for Yomite Manga Reader
 * Replaces cramped modal sheets with an uninterrupted, keyboard-friendly auth experience.
 * Supports Google OAuth, Email/Password sign in, user registration with preferred username,
 * native haptics, and accessible design tokens.
 */
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleLogoIcon } from '../../src/components/GoogleLogoIcon';
import { useColorScheme } from '../../src/hooks/useColorScheme';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { getSignInToastMessage, useUserStore } from '../../src/store/userStore';
import { triggerHaptic } from '../../src/utils/haptics';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';

function getContrastTextColor(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#1B1B1F' : '#FFFFFF';
}

const authLayoutTransition = LinearTransition.duration(240).easing(Easing.inOut(Easing.ease));
const usernameEntering = FadeIn.duration(220).easing(Easing.out(Easing.ease));
const usernameExiting = FadeOut.duration(140);

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const signUpWithEmail = useUserStore((s) => s.signUpWithEmail);
  const signInWithEmail = useUserStore((s) => s.signInWithEmail);
  const signInWithGoogle = useUserStore((s) => s.signInWithGoogle);
  const user = useUserStore((s) => s.user);

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useDocumentTitle(authMode === 'signin' ? 'Sign In — Yomite' : 'Sign Up — Yomite');

  const handleNavigateBack = () => {
    triggerHaptic();
    if (params.redirect) {
      router.replace(params.redirect as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/more' as any);
    }
  };

  const handleAuthSuccess = (freshUser?: any) => {
    triggerHaptic();
    const targetUser = freshUser || useUserStore.getState().user;
    useUserStore.getState().setAuthSuccessMessage(getSignInToastMessage(targetUser));
    if (params.redirect) {
      router.replace(params.redirect as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/more' as any);
    }
  };

  const handleGoogleSignIn = async () => {
    triggerHaptic();
    setIsSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        Alert.alert('Google Sign In Error', error.message || 'Failed to authenticate with Google.');
      } else {
        handleAuthSuccess();
      }
    } catch (err: any) {
      Alert.alert('Sign In Error', err?.message || 'Failed to complete Google Sign In.');
    } finally {
      setIsSubmitting(false);
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
    try {
      if (authMode === 'signup') {
        const { error, session } = await signUpWithEmail(email.trim(), password.trim(), username.trim());
        if (error) {
          Alert.alert('Registration Failed', error.message || 'Could not create account.');
        } else if (!session) {
          Alert.alert(
            'Check Your Email',
            'A confirmation link has been sent to your email. Click the verification link to activate your Yomite account!',
            [{ text: 'OK', onPress: handleNavigateBack }]
          );
        } else {
          Alert.alert('Success', 'Account created successfully! Welcome to Yomite.');
          handleAuthSuccess();
        }
      } else {
        const { error } = await signInWithEmail(email.trim(), password.trim());
        if (error) {
          Alert.alert('Sign In Failed', error.message || 'Invalid credentials or connection error.');
        } else {
          handleAuthSuccess();
        }
      }
    } catch (err: any) {
      Alert.alert('Authentication Error', err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const accentColor = colors.accent;
  const accentTextColor = getContrastTextColor(accentColor);
  const strongText = isDark ? colors.text : '#000000';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <View style={styles.rootContainer}>
      {/* 9:16 Vibrant Colored Manga Cover Collage Backdrop */}
      <Image
        source={require('../../assets/images/login_backdrop_collage.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityLabel="Manga and anime covers collage backdrop"
      />
      {/* Translucent Glass Scrim for Maximum Contrast & Readability */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark
              ? 'rgba(9, 9, 11, 0.70)'
              : 'rgba(255, 255, 255, 0.70)',
          },
        ]}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.backRow}>
          <Pressable
            onPress={handleNavigateBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed, hovered }: any) => [
              styles.backButton,
              (pressed || hovered) && { opacity: 0.7 },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            <MaterialIcons
              name="arrow-back"
              size={28}
              color={strongText}
            />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.content, isDesktop && styles.contentDesktop]}>
            <Animated.View
              style={[styles.cardWrapper, { backgroundColor: isDesktop ? colors.surface : 'transparent' }]}
              layout={authLayoutTransition}
            >
              {/* Branding Hero */}
              <View style={styles.brandingHeader}>
                <Image
                  source={require('../../assets/images/yomiite_transparent.png')}
                  style={styles.brandLogo}
                  contentFit="contain"
                  accessibilityLabel="Yomite Logo"
                />
                <Text
                  style={[
                    styles.heroTitle,
                    {
                      color: strongText,
                    },
                  ]}
                >
                  {authMode === 'signin' ? 'Welcome Back' : 'Sign Up'}
                </Text>
                <Text
                  style={[
                    styles.heroSubtitle,
                    {
                      color: strongText,
                    },
                  ]}
                >
                  {authMode === 'signin'
                    ? 'Sign in to access your cloud library, reading history & bookmarks across devices.'
                    : 'Join the Yomite community to sync progress, post comments, and back up bookmarks.'}
                </Text>
              </View>

              {/* Segmented Auth Mode Switcher */}
              <View style={[styles.segmentedControl, { backgroundColor: colors.surfaceElevated }]}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setAuthMode('signin');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Switch to Sign In"
                  style={[
                    styles.segmentTab,
                    authMode === 'signin' && [
                      styles.segmentTabActive,
                      { backgroundColor: isDark ? '#27272A' : colors.surface, shadowColor: '#000' },
                    ],
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: isDark && authMode !== 'signin' ? colors.textSecondary : strongText },
                      authMode === 'signin' && styles.segmentTextActive,
                    ]}
                  >
                    Sign In
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setAuthMode('signup');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Switch to Sign Up"
                  style={[
                    styles.segmentTab,
                    authMode === 'signup' && [
                      styles.segmentTabActive,
                      { backgroundColor: isDark ? '#27272A' : colors.surface, shadowColor: '#000' },
                    ],
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: isDark && authMode !== 'signup' ? colors.textSecondary : strongText },
                      authMode === 'signup' && styles.segmentTextActive,
                    ]}
                  >
                    Sign Up
                  </Text>
                </Pressable>
              </View>

              {/* Email / Password Form */}
              <Animated.View style={styles.formSection} layout={authLayoutTransition}>
                {authMode === 'signup' && (
                  <Animated.View
                    entering={usernameEntering}
                    exiting={usernameExiting}
                    layout={authLayoutTransition}
                    style={styles.inputGroup}
                  >
                    <Text style={[styles.inputLabel, { color: strongText }]}>
                      Preferred Username
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={18}
                        color={colors.textSecondary}
                        style={styles.inputLeadingIcon}
                      />
                      <TextInput
                        style={[
                          styles.textInputField,
                          { color: colors.text },
                          Platform.OS === 'web' && ({ outlineStyle: 'none', outline: 'none' } as any),
                        ]}
                        placeholder="e.g. OtakuReader"
                        placeholderTextColor={colors.textMuted}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="username"
                        editable={!isSubmitting}
                      />
                    </View>
                  </Animated.View>
                )}

                <Animated.View style={styles.inputGroup} layout={authLayoutTransition}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Email Address
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={colors.textSecondary}
                      style={styles.inputLeadingIcon}
                    />
                    <TextInput
                      style={[
                        styles.textInputField,
                        { color: colors.text },
                        Platform.OS === 'web' && ({ outlineStyle: 'none', outline: 'none' } as any),
                      ]}
                      placeholder="name@example.com"
                      placeholderTextColor={colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      editable={!isSubmitting}
                    />
                  </View>
                </Animated.View>

                <Animated.View style={styles.inputGroup} layout={authLayoutTransition}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Password
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={colors.textSecondary}
                      style={styles.inputLeadingIcon}
                    />
                    <TextInput
                      style={[
                        styles.textInputField,
                        { color: colors.text },
                        Platform.OS === 'web' && ({ outlineStyle: 'none', outline: 'none' } as any),
                      ]}
                      placeholder={authMode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                      placeholderTextColor={colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType={authMode === 'signup' ? 'newPassword' : 'password'}
                      editable={!isSubmitting}
                      onSubmitEditing={handleEmailAuth}
                      returnKeyType="done"
                    />
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        setShowPassword(!showPassword);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      style={({ pressed, hovered }: any) => [
                        styles.eyeIconButton,
                        (pressed || hovered) && { opacity: 0.7 },
                        Platform.OS === 'web' && { cursor: 'pointer' as any },
                      ]}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  </View>
                </Animated.View>

                {/* Submit Button */}
                <Animated.View layout={authLayoutTransition}>
                  <Pressable
                    onPress={handleEmailAuth}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel={authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                    style={({ pressed, hovered }: any) => [
                      styles.submitButton,
                      { backgroundColor: accentColor },
                      (pressed || hovered || isSubmitting) && { opacity: 0.88 },
                      Platform.OS === 'web' && { cursor: isSubmitting ? 'default' : ('pointer' as any) },
                    ]}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={accentTextColor} />
                    ) : (
                      <>
                        <Ionicons
                          name={authMode === 'signin' ? 'log-in-outline' : 'person-add-outline'}
                          size={20}
                          color={accentTextColor}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={[styles.submitButtonText, { color: accentTextColor }]}>
                          {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </Animated.View>
              </Animated.View>

              {/* Subtle Divider */}
              <Animated.View style={styles.dividerRow} layout={authLayoutTransition}>
                <View style={[styles.hairline, { backgroundColor: dividerColor }]} />
                <Text style={[styles.dividerText, { color: strongText }]}>
                  or continue with Google
                </Text>
                <View style={[styles.hairline, { backgroundColor: dividerColor }]} />
              </Animated.View>

              {/* Google Fast Sign In */}
              <Animated.View layout={authLayoutTransition}>
                <Pressable
                  onPress={handleGoogleSignIn}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={authMode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
                  style={({ pressed, hovered }: any) => [
                    styles.googleButton,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                    (pressed || hovered) && { opacity: 0.85 },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <GoogleLogoIcon size={20} />
                  <Text style={[styles.googleButtonText, { color: colors.text }]}>
                    {authMode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}
                  </Text>
                </Pressable>
              </Animated.View>

              {/* Bottom Guest Link */}
              <Animated.View style={styles.footerWrap} layout={authLayoutTransition}>
                <Pressable
                  onPress={handleNavigateBack}
                  accessibilityRole="button"
                  accessibilityLabel="Continue as guest"
                  style={({ pressed, hovered }: any) => [
                    styles.guestLink,
                    (pressed || hovered) && { opacity: 0.6 },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <Text style={[styles.guestLinkText, { color: strongText }]}>
                    Continue as Guest
                  </Text>
                </Pressable>
              </Animated.View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  backRow: {
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  contentDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    paddingVertical: 12,
  },
  brandingHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandLogo: {
    width: 200,
    height: 64,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  segmentTab: {
    paddingHorizontal: 26,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  segmentTabActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 260,
    paddingHorizontal: 32,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  hairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formSection: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    paddingLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 52,
    paddingHorizontal: 14,
  },
  inputLeadingIcon: {
    marginRight: 10,
  },
  textInputField: {
    flex: 1,
    fontSize: 16, // Critical: >=16px prevents iOS auto-zoom
    height: '100%',
    paddingVertical: 0,
  },
  eyeIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 170,
    paddingHorizontal: 32,
    height: 52,
    borderRadius: 14,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  guestLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  guestLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
