/**
 * SkeletonLoader — Shimmer loading placeholder
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, Platform } from 'react-native';
import { Colors, Radius } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = Radius.md, style }: SkeletonProps) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function MangaCardSkeleton() {
  const { width: CARD_WIDTH, height: CARD_HEIGHT } = {
    width: 110,
    height: 160,
  };
  return (
    <View style={{ marginBottom: 12 }}>
      <Skeleton width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={Radius.lg} />
      <Skeleton
        width={CARD_WIDTH * 0.8}
        height={12}
        borderRadius={Radius.sm}
        style={{ marginTop: 8 }}
      />
    </View>
  );
}

export function ChapterSkeleton() {
  return (
    <View style={skeletonStyles.chapterRow}>
      <View>
        <Skeleton width={120} height={14} />
        <Skeleton width={80} height={11} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={60} height={11} />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  chapterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
