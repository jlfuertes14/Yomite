/**
 * MangaCard — Edge-to-edge full width responsive grid card with Micro-Interaction Spring Scale
 */
import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import { AnimatedCard } from './AnimatedCard';

export const CARD_GAP = 10;

interface MangaCardProps {
  id: string;
  title: string;
  coverUrl: string | null;
  author?: string;
  rating?: number | null;
  follows?: number | null;
  unreadCount?: number;
  index?: number;
  onPress: (id: string) => void;
}

function formatStatNumber(num?: number | null): string | null {
  if (!num || num <= 0) return null;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

function MangaCardComponent({
  id,
  title,
  coverUrl,
  author,
  rating,
  follows,
  unreadCount,
  index = 0,
  onPress,
}: MangaCardProps) {
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();

  const isDesktop = windowWidth >= 1024;
  const isMobile = windowWidth < 600;

  // On Web, use exact percentage calculation: 9 columns = calc((100% - 80px) / 9)
  const webWidth = isDesktop || windowWidth >= 900
    ? ('calc((100% - 80px) / 9)' as any)
    : isMobile
    ? ('calc((100% - 20px) / 3)' as any)
    : ('calc((100% - 50px) / 6)' as any);

  // On Native Android/iOS, use pixel calculation
  const availableContentWidth = isDesktop ? windowWidth - 260 : windowWidth;
  const horizontalPadding = isMobile ? 24 : 32;
  const columns = isDesktop || availableContentWidth >= 900 ? 9 : isMobile ? 3 : 6;
  const totalGap = (columns - 1) * CARD_GAP;
  const nativeWidth = Math.floor((availableContentWidth - horizontalPadding - totalGap - 2) / columns);

  const cardWidth = Platform.OS === 'web' ? webWidth : nativeWidth;
  const cardHeight = typeof cardWidth === 'number' ? Math.floor(cardWidth * 1.44) : undefined;

  const formattedFollows = formatStatNumber(follows);

  return (
    <AnimatedCard
      index={index}
      onPress={() => onPress(id)}
      style={[styles.container, { width: cardWidth }]}
    >
      {/* Cover Image Box */}
      <View
        style={[
          styles.imageContainer,
          cardHeight ? { height: cardHeight } : null,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.coverImage}
            contentFit="cover"
            transition={300}
            recyclingKey={id}
          />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="book-outline" size={24} color={colors.textMuted} />
          </View>
        )}

        {/* Rating overlay badge */}
        {rating && rating > 0 ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        ) : null}

        {/* Unread badge */}
        {unreadCount && unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        ) : null}
      </View>

      {/* Title & Author below cover */}
      <View style={styles.textMetaContainer}>
        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <View style={styles.subMetaRow}>
          {author ? (
            <Text
              style={[styles.author, { color: colors.textSecondary, flex: 1 }]}
              numberOfLines={1}
            >
              {author}
            </Text>
          ) : null}
          {formattedFollows ? (
            <View style={styles.followsRow}>
              <Ionicons name="bookmark" size={9} color={colors.accent} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {formattedFollows}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </AnimatedCard>
  );
}

export const MangaCard = memo(MangaCardComponent);

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1 / 1.44,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textMetaContainer: {
    marginTop: 6,
    gap: 2,
  },
  title: {
    fontSize: Platform.OS === 'web' ? 14 : Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
    lineHeight: Platform.OS === 'web' ? 19 : 16,
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  author: {
    fontSize: Platform.OS === 'web' ? 12 : Typography.sizes.caption,
    fontWeight: Typography.weights.regular,
  },
  followsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statText: {
    fontSize: Platform.OS === 'web' ? 11 : 10,
    fontWeight: Typography.weights.medium,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(9,9,11,0.85)',
    paddingHorizontal: Platform.OS === 'web' ? 8 : 6,
    paddingVertical: Platform.OS === 'web' ? 3 : 2,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ratingText: {
    color: '#FAFAFA',
    fontSize: Platform.OS === 'web' ? 11 : 10,
    fontWeight: Typography.weights.bold,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: '#09090B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeText: {
    color: '#09090B',
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
});
