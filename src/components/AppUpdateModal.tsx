/**
 * AppUpdateModal — Tachiyomi / Mihon Style In-App Update Dialog
 * Sleek flat dark UI displaying GitHub release changelog, live APK download progress,
 * and direct launch into Android Package Installer.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../hooks/useThemeColor';
import { useColorScheme } from '../hooks/useColorScheme';
import {
  AppReleaseInfo,
  DownloadProgress,
  downloadAndInstallUpdate,
  getCurrentAppVersion,
  snoozeUpdateVersion,
} from '../services/appUpdateService';
import { triggerHaptic } from '../utils/haptics';

interface AppUpdateModalProps {
  visible: boolean;
  release: AppReleaseInfo | null;
  onDismiss: () => void;
  /** Development-only local progress simulation; never downloads or installs an APK. */
  previewDownload?: boolean;
}

type UpdateStatus = 'idle' | 'downloading' | 'ready' | 'error';

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Lightweight native markdown changelog parser that formats GitHub release notes
 * into clean typography blocks without bulky third-party dependencies.
 */
function MarkdownChangelog({ content, textColor, textMutedColor }: { content: string; textColor: string; textMutedColor: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  return (
    <View style={styles.changelogContainer}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={index} style={{ height: 6 }} />;
        }

        // Heading 1 & 2 (## Title)
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          const text = trimmed.replace(/^#+\s*/, '');
          return (
            <Text key={index} style={[styles.heading2, { color: textColor }]}>
              {text}
            </Text>
          );
        }

        // Heading 3 (### Subtitle)
        if (trimmed.startsWith('### ')) {
          const text = trimmed.replace(/^###\s*/, '');
          return (
            <Text key={index} style={[styles.heading3, { color: textColor }]}>
              {text}
            </Text>
          );
        }

        // Bullet list item (- Item or * Item)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const rawText = trimmed.substring(2);
          // Strip basic bold asterisks
          const cleanText = rawText.replace(/\*\*(.*?)\*\*/g, '$1');
          return (
            <View key={index} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: textMutedColor }]} />
              <Text style={[styles.bulletText, { color: textColor }]}>
                {cleanText}
              </Text>
            </View>
          );
        }

        // Standard Paragraph
        const cleanParagraph = trimmed.replace(/\*\*(.*?)\*\*/g, '$1');
        return (
          <Text key={index} style={[styles.paragraph, { color: textMutedColor }]}>
            {cleanParagraph}
          </Text>
        );
      })}
    </View>
  );
}

export function AppUpdateModal({ visible, release, onDismiss, previewDownload = false }: AppUpdateModalProps) {
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const currentVersion = getCurrentAppVersion();

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.95)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const contentTranslateYAnim = useRef(new Animated.Value(28)).current;

  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState<DownloadProgress>({
    writtenBytes: 0,
    totalBytes: 0,
    fraction: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPreviewTimer = useCallback(() => {
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearPreviewTimer, [clearPreviewTimer]);

  useEffect(() => {
    if (visible && release) {
      clearPreviewTimer();
      setStatus('idle');
      setProgress({ writtenBytes: 0, totalBytes: 0, fraction: 0 });
      setErrorMessage('');

      backdropAnim.setValue(0);
      cardScaleAnim.setValue(0.95);
      cardOpacityAnim.setValue(0);
      contentTranslateYAnim.setValue(28);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(cardOpacityAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(cardScaleAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(contentTranslateYAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [visible, release, backdropAnim, cardOpacityAnim, cardScaleAnim, contentTranslateYAnim, clearPreviewTimer]);

  const handleClose = useCallback(() => {
    clearPreviewTimer();
    triggerHaptic();
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 140,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 0,
        duration: 140,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(cardScaleAnim, {
        toValue: 0.97,
        duration: 140,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(contentTranslateYAnim, {
        toValue: 22,
        duration: 160,
        easing: Easing.bezier(0.7, 0, 0.84, 0),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [onDismiss, backdropAnim, cardOpacityAnim, cardScaleAnim, contentTranslateYAnim, clearPreviewTimer]);

  const handleStartUpdate = useCallback(async () => {
    if (!release) return;
    triggerHaptic();
    setStatus('downloading');
    setErrorMessage('');

    if (previewDownload) {
      clearPreviewTimer();
      let simulatedProgress = 0;
      previewTimerRef.current = setInterval(() => {
        simulatedProgress = Math.min(simulatedProgress + 4, 100);
        setProgress({
          writtenBytes: simulatedProgress,
          totalBytes: 100,
          fraction: simulatedProgress / 100,
        });
        if (simulatedProgress >= 100) {
          clearPreviewTimer();
          setStatus('ready');
        }
      }, 90);
      return;
    }

    try {
      await downloadAndInstallUpdate(release, (prog) => {
        setProgress(prog);
      });
      setStatus('ready');
      triggerHaptic();
    } catch (err: any) {
      console.warn('[AppUpdateModal] Install failed:', err);
      setStatus('error');
      setErrorMessage(err?.message || 'Failed to download or launch package installer.');
    }
  }, [clearPreviewTimer, previewDownload, release]);

  const handleIgnore = useCallback(async () => {
    if (release) {
      await snoozeUpdateVersion(release.version);
    }
    handleClose();
  }, [release, handleClose]);

  const handleOpenGitHub = useCallback(async () => {
    if (release?.htmlUrl) {
      await WebBrowser.openBrowserAsync(release.htmlUrl);
    }
  }, [release]);

  if (!visible || !release) return null;

  const percentage = Math.round(progress.fraction * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[styles.fullScreen, { backgroundColor: colors.background, opacity: backdropAnim }]}
        accessibilityRole="alert"
      >
        <View style={styles.screenTopBar}>
          <Pressable
            onPress={status === 'downloading' ? undefined : handleClose}
            disabled={status === 'downloading'}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close update screen"
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.55 }]}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={handleOpenGitHub}
            accessibilityRole="button"
            accessibilityLabel="View release on GitHub"
            style={({ pressed }) => [styles.githubLink, pressed && { opacity: 0.55 }]}
          >
            <Ionicons name="logo-github" size={21} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.screenScrollContent}
        >
        <Animated.View
          style={[
            styles.screenContent,
            {
              opacity: cardOpacityAnim,
              transform: [{ translateY: contentTranslateYAnim }, { scale: cardScaleAnim }],
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                source={require('../../assets/images/icon_transparent.png')}
                style={styles.appIcon}
                contentFit="contain"
                accessibilityLabel="Yomite app icon"
              />
              <View style={styles.headerTextCol}>
                <Text style={[styles.eyebrow, { color: colors.accent }]}>Yomite</Text>
                <Text style={[styles.title, { color: colors.text }]}> 
                  New version available
                </Text>
                <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>Better reading. Smoother experience.</Text>
                <Text style={[styles.versionBadge, { color: colors.textSecondary }]}>
                  v{currentVersion} → <Text style={{ color: colors.accent, fontWeight: '700' }}>v{release.version}</Text>
                  {release.publishedAt ? ` • ${formatDate(release.publishedAt)}` : ''}
                </Text>
              </View>
            </View>

          </View>

          {/* Release notes */}
          <View style={[styles.notesWrapper, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.releaseVersionInline, { color: colors.text }]}>Version v{release.version}</Text>
            <Text style={[styles.notesLabel, { color: colors.textMuted }]}>WHAT'S NEW</Text>
            <View style={styles.notesScroll}>
              <MarkdownChangelog
                content={release.releaseNotes}
                textColor={colors.text}
                textMutedColor={colors.textSecondary}
              />
            </View>
          </View>

          {/* Error Message */}
          {status === 'error' && (
            <View style={[styles.errorBox, { borderColor: 'rgba(239, 68, 68, 0.35)' }]}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText} numberOfLines={2}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {status !== 'downloading' && (
              <Pressable
                onPress={handleIgnore}
                accessibilityRole="button"
                accessibilityLabel="Ignore this version"
                style={({ pressed, hovered }: any) => [
                  styles.btn,
                  styles.cancelBtn,
                  {
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    opacity: hovered ? 0.65 : 1,
                  },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  Later
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={status === 'downloading' ? undefined : handleStartUpdate}
              disabled={status === 'downloading'}
              accessibilityRole="button"
              accessibilityLabel={status === 'error' ? 'Retry Download' : 'Install Update'}
              style={({ pressed, hovered }: any) => [
                styles.btn,
                styles.confirmBtn,
                {
                  backgroundColor: colors.accent,
                  transform: [{ scale: pressed && status !== 'downloading' ? 0.97 : 1 }],
                  opacity: status === 'downloading' ? 0.8 : hovered ? 0.92 : 1,
                },
              ]}
            >
            {status === 'downloading' ? (
              <View style={[styles.downloadProgressButton, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <View style={[styles.downloadProgressButtonFill, { width: `${Math.max(percentage, 2)}%` }]} />
                <Text style={styles.confirmBtnText}>{percentage}%</Text>
              </View>
              ) : (
                <View style={styles.loadingBtnContent}>
                  <Text style={styles.confirmBtnText}>
                    {status === 'error' ? 'Retry Download' : 'Install Update'}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </Animated.View>
        </ScrollView>

        <View
          style={[
            styles.fixedActions,
            {
              // Keep the floating actions clear of Android's navigation bar,
              // including devices using gesture navigation.
              paddingBottom: Math.max(insets.bottom + 20, 28),
            },
          ]}
        >
          {status !== 'downloading' && (
            <Pressable
              onPress={handleIgnore}
              accessibilityRole="button"
              accessibilityLabel="Ignore this version"
              style={({ pressed, hovered }: any) => [
                styles.btn,
                styles.cancelBtn,
                { backgroundColor: isDark ? '#F4F4F5' : '#18181B' },
                { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: hovered ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: isDark ? '#18181B' : '#FAFAFA' }]}>Later</Text>
            </Pressable>
          )}

          <Pressable
            onPress={status === 'downloading' ? undefined : handleStartUpdate}
            disabled={status === 'downloading'}
            accessibilityRole="button"
            accessibilityLabel={status === 'error' ? 'Retry Download' : 'Install Update'}
            style={({ pressed, hovered }: any) => [
              styles.btn,
              styles.confirmBtn,
              { backgroundColor: colors.accent },
              { transform: [{ scale: pressed && status !== 'downloading' ? 0.97 : 1 }], opacity: status === 'downloading' ? 0.8 : hovered ? 0.92 : 1 },
            ]}
          >
            {status === 'downloading' ? (
              <View style={[styles.downloadProgressButton, { backgroundColor: isDark ? 'rgba(9,9,11,0.24)' : 'rgba(255,255,255,0.22)' }]}>
                <View style={[styles.downloadProgressButtonFill, { width: `${Math.max(percentage, 2)}%`, backgroundColor: isDark ? '#09090B' : '#FFFFFF' }]} />
                <Text style={[styles.confirmBtnText, { color: isDark ? '#09090B' : '#FFFFFF' }]}>{percentage}%</Text>
              </View>
            ) : (
              <Text style={[styles.confirmBtnText, { color: isDark ? '#09090B' : '#FFFFFF' }]}>
                {status === 'error' ? 'Retry Download' : 'Install Update'}
              </Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0B0F18',
  },
  fullScreen: {
    flex: 1,
    paddingHorizontal: 20,
  },
  screenTopBar: {
    position: 'absolute',
    top: 34,
    left: 20,
    right: 20,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    zIndex: 2,
    elevation: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingTop: 16,
    paddingBottom: 20,
  },
  screenScrollContent: {
    flexGrow: 1,
    paddingTop: 92,
    paddingBottom: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 0,
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 24,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: 116,
    height: 116,
    borderRadius: 30,
  },
  headerTextCol: {
    alignItems: 'center',
    marginTop: 16,
  },
  eyebrow: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  versionBadge: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  githubLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  githubLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notesWrapper: {
    minHeight: 360,
    overflow: 'hidden',
    marginBottom: 16,
    borderRadius: 22,
    paddingTop: 22,
    paddingHorizontal: 24,
  },
  releaseVersionInline: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.35,
    marginBottom: 24,
  },
  notesLabel: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    paddingTop: 0,
    paddingHorizontal: 0,
    marginBottom: 6,
  },
  notesScroll: {
    flexGrow: 1,
  },
  notesScrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  changelogContainer: {
    gap: 4,
  },
  heading2: {
    fontSize: 14.5,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  heading3: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 2,
    paddingRight: 8,
  },
  bulletDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 3,
    marginTop: 7,
  },
  bulletText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
  },
  paragraph: {
    fontSize: 12.5,
    lineHeight: 18,
    marginVertical: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  buttonRow: {
    display: 'none',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  fixedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  cancelBtn: {
    borderWidth: 0,
  },
  confirmBtn: {
    borderWidth: 0,
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  loadingBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadProgressButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  downloadProgressButtonFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    opacity: 0.28,
  },
});
