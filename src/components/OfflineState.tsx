/**
 * OfflineState — Animated No Connection Component & Banner
 * Prompts user to check offline downloaded chapters with pulse animation
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import { AnimatedPressable } from './AnimatedPressable';

interface OfflineStateProps {
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function OfflineState({ onRetry, style, compact = false }: OfflineStateProps) {
  const router = useRouter();
  const colors = useThemeColors();

  // Looping Pulse Animation for Wi-Fi icon
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1200,
            easing: Easing.bezier(0.4, 0, 0.6, 1),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.bezier(0.4, 0, 0.6, 1),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.bezier(0.4, 0, 0.6, 1),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 1200,
            easing: Easing.bezier(0.4, 0, 0.6, 1),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [pulseAnim, opacityAnim]);

  const handleGoToDownloads = () => {
    router.push('/(tabs)/downloads' as any);
  };

  if (compact) {
    return (
      <View
        style={[
          styles.compactContainer,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.compactIconBox,
            {
              backgroundColor: `${colors.accent}24`,
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <Ionicons name="wifi-outline" size={18} color={colors.accent} />
        </Animated.View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.compactTitle, { color: colors.text }]}>No Internet Connection</Text>
          <Text style={[styles.compactSub, { color: colors.textMuted }]}>
            Read saved chapters offline in Downloads
          </Text>
        </View>

        <AnimatedPressable
          onPress={handleGoToDownloads}
          style={[styles.compactBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.compactBtnText}>Downloads</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={[styles.fullContainer, style]}>
      {/* Animated Floating Wi-Fi Off Badge */}
      <Animated.View
        style={[
          styles.iconBadgeOuter,
          {
            backgroundColor: `${colors.accent}1A`,
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View style={[styles.iconBadgeInner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.accent} />
        </View>
      </Animated.View>

      {/* Headline & Subtitle */}
      <Text style={[styles.title, { color: colors.text }]}>You're Offline</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        No Wi-Fi or cellular network detected. Check your internet connection or read your saved chapters offline.
      </Text>

      {/* Action Buttons */}
      <View style={styles.actionsCol}>
        <AnimatedPressable
          onPress={handleGoToDownloads}
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        >
          <Ionicons name="download-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>View Downloaded Chapters</Text>
        </AnimatedPressable>

        {onRetry ? (
          <AnimatedPressable
            onPress={onRetry}
            style={[styles.secondaryBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.text} />
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Retry Connection</Text>
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing['2xl'],
    gap: Spacing.md,
  },
  iconBadgeOuter: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  iconBadgeInner: {
    width: 76,
    height: 76,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.footnote,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  actionsCol: {
    width: '100%',
    maxWidth: 280,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: Radius.md,
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },

  /* Compact Mode */
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
  },
  compactIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  compactSub: {
    fontSize: 11,
    marginTop: 1,
  },
  compactBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  compactBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
});
