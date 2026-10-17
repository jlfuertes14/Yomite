/**
 * SkeletonLoader — Shimmer loading placeholder
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, Platform } from 'react-native';
import { Colors, Radius } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';

interface SkeletonProps {
  width: number | string;
  height: number | string;
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
          height: height as any,
          borderRadius,
          backgroundColor: colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function MangaCardSkeleton({
  width,
  height,
  borderRadius = Radius.md,
  style,
}: {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
} = {}) {
  const CARD_WIDTH = width ?? 110;
  const CARD_HEIGHT = height ?? (typeof CARD_WIDTH === 'number' ? Math.floor(CARD_WIDTH * 1.44) : 160);
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <Skeleton width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={borderRadius} />
      <View style={{ marginTop: 8, gap: 4 }}>
        <Skeleton
          width={typeof CARD_WIDTH === 'number' ? Math.floor(CARD_WIDTH * 0.85) : '85%'}
          height={12}
          borderRadius={Radius.xs}
        />
        <Skeleton
          width={typeof CARD_WIDTH === 'number' ? Math.floor(CARD_WIDTH * 0.5) : '50%'}
          height={10}
          borderRadius={Radius.xs}
        />
      </View>
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

export function ThreadCardSkeleton({ withImage = false }: { withImage?: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={[skeletonStyles.threadCardRow, { borderBottomColor: colors.border }]}>
      {/* Left Column: Avatar + Connector */}
      <View style={skeletonStyles.threadLeftCol}>
        <Skeleton width={38} height={38} borderRadius={19} />
        <View style={[skeletonStyles.threadConnectorLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Right Column: Header, Body & Actions */}
      <View style={skeletonStyles.threadRightCol}>
        <View style={skeletonStyles.threadHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Skeleton width={100} height={14} borderRadius={Radius.xs} />
            <Skeleton width={52} height={16} borderRadius={Radius.xs} />
          </View>
          <Skeleton width={38} height={11} borderRadius={Radius.xs} />
        </View>

        <Skeleton width="86%" height={15} borderRadius={Radius.xs} style={{ marginTop: 4 }} />
        <Skeleton width="96%" height={13} borderRadius={Radius.xs} style={{ marginTop: 6 }} />
        <Skeleton width="72%" height={13} borderRadius={Radius.xs} style={{ marginTop: 4 }} />

        {withImage && (
          <Skeleton width="100%" height={150} borderRadius={10} style={{ marginTop: 10 }} />
        )}

        <View style={skeletonStyles.threadActionsRow}>
          <Skeleton width={20} height={14} borderRadius={Radius.xs} />
          <Skeleton width={20} height={14} borderRadius={Radius.xs} />
          <Skeleton width={20} height={14} borderRadius={Radius.xs} />
          <Skeleton width={20} height={14} borderRadius={Radius.xs} />
        </View>
      </View>
    </View>
  );
}

export function AnimeNewsCardSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={[skeletonStyles.newsCardRow, { borderBottomColor: colors.border }]}>
      {/* Left Column: Favicon + Connector */}
      <View style={skeletonStyles.newsLeftCol}>
        <Skeleton width={38} height={38} borderRadius={10} />
        <View style={[skeletonStyles.threadConnectorLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Right Column: News Content */}
      <View style={skeletonStyles.newsRightCol}>
        <View style={skeletonStyles.threadHeaderRow}>
          <Skeleton width={88} height={14} borderRadius={Radius.xs} />
          <Skeleton width={42} height={11} borderRadius={Radius.xs} />
        </View>

        <Skeleton width="94%" height={16} borderRadius={Radius.xs} style={{ marginTop: 4 }} />
        <Skeleton width="65%" height={16} borderRadius={Radius.xs} style={{ marginTop: 4 }} />

        <Skeleton width="96%" height={12} borderRadius={Radius.xs} style={{ marginTop: 8 }} />
        <Skeleton width="78%" height={12} borderRadius={Radius.xs} style={{ marginTop: 4 }} />

        <Skeleton width="100%" height={160} borderRadius={10} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

export function AnimeNewsArticleSkeleton() {
  return (
    <View style={skeletonStyles.articleSkeletonWrap}>
      <View style={skeletonStyles.articleParagraphWrap}>
        <Skeleton width="100%" height={14} borderRadius={Radius.xs} />
        <Skeleton width="96%" height={14} borderRadius={Radius.xs} />
        <Skeleton width="91%" height={14} borderRadius={Radius.xs} />
        <Skeleton width="72%" height={14} borderRadius={Radius.xs} />
      </View>
      <View style={skeletonStyles.articleParagraphWrap}>
        <Skeleton width="100%" height={14} borderRadius={Radius.xs} />
        <Skeleton width="94%" height={14} borderRadius={Radius.xs} />
        <Skeleton width="88%" height={14} borderRadius={Radius.xs} />
        <Skeleton width="58%" height={14} borderRadius={Radius.xs} />
      </View>
      <View style={skeletonStyles.articleParagraphWrap}>
        <Skeleton width="100%" height={14} borderRadius={Radius.xs} />
        <Skeleton width="92%" height={14} borderRadius={Radius.xs} />
        <Skeleton width="68%" height={14} borderRadius={Radius.xs} />
      </View>
    </View>
  );
}

export function ThreadReplySkeleton() {
  const colors = useThemeColors();
  return (
    <View style={[skeletonStyles.replyRow, { borderBottomColor: colors.border }]}>
      <View style={skeletonStyles.replyLeftCol}>
        <Skeleton width={32} height={32} borderRadius={16} />
      </View>
      <View style={skeletonStyles.replyRightCol}>
        <View style={skeletonStyles.threadHeaderRow}>
          <Skeleton width={80} height={13} borderRadius={Radius.xs} />
          <Skeleton width={35} height={10} borderRadius={Radius.xs} />
        </View>
        <Skeleton width="90%" height={12} borderRadius={Radius.xs} style={{ marginTop: 4 }} />
        <Skeleton width="65%" height={12} borderRadius={Radius.xs} style={{ marginTop: 4 }} />
      </View>
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
  threadCardRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  threadLeftCol: {
    width: 40,
    alignItems: 'center',
  },
  threadConnectorLine: {
    width: 1.5,
    flex: 1,
    minHeight: 50,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 1,
  },
  threadRightCol: {
    flex: 1,
    marginLeft: 12,
  },
  threadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  threadActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 10,
  },
  newsCardRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  newsLeftCol: {
    width: 40,
    alignItems: 'center',
  },
  newsRightCol: {
    flex: 1,
    marginLeft: 12,
  },
  articleSkeletonWrap: {
    gap: 16,
    paddingVertical: 8,
  },
  articleParagraphWrap: {
    gap: 8,
  },
  replyRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyLeftCol: {
    width: 36,
    alignItems: 'center',
  },
  replyRightCol: {
    flex: 1,
    marginLeft: 10,
  },
});
