/**
 * Settings Screen — Modern Minimalist Theme & MangaDex Auth
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, ReaderThemes } from '../../constants/Colors';
import { useReaderStore } from '../../src/store/readerStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { useUserStore } from '../../src/store/userStore';
import type { ReadingMode, ReaderTheme } from '../../src/types';

type VectorIcon = React.ComponentProps<typeof Ionicons>['name'];

const READING_MODES: { key: ReadingMode; label: string; icon: VectorIcon }[] = [
  { key: 'webtoon', label: 'Webtoon (Vertical scroll)', icon: 'journal-outline' },
  { key: 'rtl', label: 'Right to left (Manga)', icon: 'arrow-back-outline' },
  { key: 'ltr', label: 'Left to right (Comic)', icon: 'arrow-forward-outline' },
  { key: 'single', label: 'Single page', icon: 'document-text-outline' },
  { key: 'double', label: 'Double spread', icon: 'book-outline' },
];

const THEME_KEYS = Object.keys(ReaderThemes) as ReaderTheme[];

export default function SettingsScreen() {
  const colors = Colors.dark;

  // Reader store
  const mode = useReaderStore((s) => s.mode);
  const theme = useReaderStore((s) => s.theme);
  const dataSaver = useReaderStore((s) => s.dataSaver);
  const showPageNumber = useReaderStore((s) => s.showPageNumber);
  const setMode = useReaderStore((s) => s.setMode);
  const setTheme = useReaderStore((s) => s.setTheme);
  const setDataSaver = useReaderStore((s) => s.setDataSaver);
  const setShowPageNumber = useReaderStore((s) => s.setShowPageNumber);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  // Supabase User store
  const user = useUserStore((s) => s.user);
  const initializeAuth = useUserStore((s) => s.initializeAuth);
  const signUpWithEmail = useUserStore((s) => s.signUpWithEmail);
  const signInWithEmail = useUserStore((s) => s.signInWithEmail);
  const signInWithGoogle = useUserStore((s) => s.signInWithGoogle);
  const signOut = useUserStore((s) => s.signOut);

  // Form state
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    setIsSubmitting(false);
    if (error) {
      Alert.alert('Google Sign In Error', error.message || 'Failed to authenticate with Google.');
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setIsSubmitting(true);
    if (authMode === 'signup') {
      const { error } = await signUpWithEmail(email.trim(), password.trim());
      setIsSubmitting(false);
      if (error) {
        Alert.alert('Registration Failed', error.message);
      } else {
        Alert.alert('Success', 'Account created successfully! Check your email to confirm registration.');
      }
    } else {
      const { error } = await signInWithEmail(email.trim(), password.trim());
      setIsSubmitting(false);
      if (error) {
        Alert.alert('Sign In Failed', error.message);
      }
    }
  };

  const handleLogout = async () => {
    await signOut();
    Alert.alert('Signed Out', 'You have been signed out.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Yomite Account & Cloud Sync (Supabase Auth) */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Yomite Account & Cloud Sync
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {user ? (
            <View style={styles.authStatusRow}>
              <View style={styles.authStatusLeft}>
                <Ionicons name="person-circle-outline" size={32} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>
                    {user.email ?? 'Signed In User'}
                  </Text>
                  <Text style={[styles.optionDesc, { color: colors.emerald }]}>
                    ● Cloud Sync & Registry Active
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleLogout}
                style={[styles.logoutBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={[styles.logoutBtnText, { color: colors.accent }]}>Sign out</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.authContainer}>
              {/* Google Sign In Button */}
              <Pressable
                onPress={handleGoogleSignIn}
                disabled={isSubmitting}
                style={[styles.googleBtn, { backgroundColor: '#4285F4' }]}
              >
                <Ionicons name="logo-google" size={18} color="#FFFFFF" />
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              </Pressable>

              <View style={styles.orDividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.orText, { color: colors.textMuted }]}>OR EMAIL</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              {/* Mode Toggle Tabs (Sign In / Register) */}
              <View style={styles.authTabRow}>
                <Pressable
                  onPress={() => setAuthMode('signin')}
                  style={[
                    styles.authTab,
                    authMode === 'signin' && { backgroundColor: colors.surfaceElevated, borderColor: colors.accent },
                  ]}
                >
                  <Text style={[styles.authTabText, { color: authMode === 'signin' ? colors.accent : colors.textMuted }]}>
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setAuthMode('signup')}
                  style={[
                    styles.authTab,
                    authMode === 'signup' && { backgroundColor: colors.surfaceElevated, borderColor: colors.accent },
                  ]}
                >
                  <Text style={[styles.authTabText, { color: authMode === 'signup' ? colors.accent : colors.textMuted }]}>
                    Register
                  </Text>
                </Pressable>
              </View>

              {/* Form inputs */}
              <View style={styles.formContent}>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  placeholder="Email Address"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <Pressable
                  onPress={handleEmailAuth}
                  disabled={isSubmitting}
                  style={[styles.loginBtn, { backgroundColor: colors.accent }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.loginBtnText}>
                      {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
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
            const isActive = theme === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTheme(key)}
                style={[
                  styles.themeCircle,
                  {
                    backgroundColor: t.background,
                    borderColor: isActive ? colors.accent : colors.border,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
              >
                {isActive && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={t.text}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Toggles */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Reader Options
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.toggleRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Data saver</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                Use compressed images to save bandwidth
              </Text>
            </View>
            <Switch
              value={dataSaver}
              onValueChange={setDataSaver}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Page number</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                Show page indicator overlay in reader
              </Text>
            </View>
            <Switch
              value={showPageNumber}
              onValueChange={setShowPageNumber}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Data */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Data Management</Text>
        <Pressable
          style={[styles.dangerButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={clearHistory}
        >
          <Ionicons name="trash-outline" size={16} color={colors.accent} />
          <Text style={[styles.dangerText, { color: colors.accent }]}>
            Clear reading history
          </Text>
        </Pressable>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appInfoText, { color: colors.textSecondary, fontWeight: 'bold' }]}>
            Yomite v1.0.0
          </Text>
          <Text style={[styles.appInfoText, { color: colors.textMuted }]}>
            Powered by MangaDex API v5
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 60,
  },
  sectionLabel: {
    fontSize: Typography.sizes.callout,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  authContainer: {
    padding: Spacing.lg,
  },
  authToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  authStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  authStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  logoutBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  logoutBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  formContent: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  formHelpText: {
    fontSize: Typography.sizes.caption,
    lineHeight: 16,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.footnote,
  },
  loginBtn: {
    height: 42,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: Typography.weights.semibold,
    fontSize: Typography.sizes.body,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  optionLabel: {
    flex: 1,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
  },
  optionDesc: {
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  themeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  themeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  toggleInfo: { flex: 1 },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  dangerText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: Spacing['3xl'],
    gap: 4,
  },
  appInfoText: {
    fontSize: Typography.sizes.caption,
  },
  googleBtn: {
    height: 44,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  googleBtnText: {
    color: '#FFFFFF',
    fontWeight: Typography.weights.semibold,
    fontSize: Typography.sizes.body,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
  },
  authTabRow: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  authTab: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  authTabText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
});
