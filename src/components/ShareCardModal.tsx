import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';

interface ShareCardModalProps {
  visible: boolean;
  onClose: () => void;
  mangaTitle: string;
  chapterTitle: string;
  coverUrl?: string | null;
}

const CARD_THEMES = [
  { id: 'crimson', colors: ['#E11D48', '#881337', '#09090B'] as const },
  { id: 'violet', colors: ['#7C3AED', '#4C1D95', '#09090B'] as const },
  { id: 'emerald', colors: ['#059669', '#064E3B', '#09090B'] as const },
  { id: 'amber', colors: ['#D97706', '#78350F', '#09090B'] as const },
];

export function ShareCardModal({
  visible,
  onClose,
  mangaTitle,
  chapterTitle,
  coverUrl,
}: ShareCardModalProps) {
  const colors = useThemeColors();
  const cardRef = useRef<View>(null);

  const [quoteText, setQuoteText] = useState('');
  const [activeTheme, setActiveTheme] = useState(CARD_THEMES[0]);
  const [isSharing, setIsSharing] = useState(false);

  const handleShareCard = async () => {
    try {
      setIsSharing(true);
      if (!cardRef.current) return;

      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Share ${mangaTitle} Quote Card`,
          mimeType: 'image/png',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
      }
    } catch (err) {
      console.error('Failed to capture card snapshot:', err);
      Alert.alert('Error', 'Failed to generate quote card image.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: '#141417', borderColor: '#27272A' }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Share Manga Quote Card</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
            {/* Card Preview Container */}
            <View ref={cardRef} collapsable={false} style={styles.cardPreviewWrapper}>
              <LinearGradient colors={activeTheme.colors} style={styles.cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.brandBadge}>
                    <Text style={styles.brandBadgeText}>YOMITE MANGA</Text>
                  </View>
                  <Ionicons name="bookmark" size={16} color="#FFF" />
                </View>

                {/* Quote / Panel Snippet */}
                <View style={styles.quoteBox}>
                  <Text style={styles.quoteMark}>“</Text>
                  <Text style={styles.quoteBodyText}>
                    {quoteText.trim() ? quoteText.trim() : 'Insert your favorite dialogue quote or chapter reaction here...'}
                  </Text>
                </View>

                {/* Footer Metadata */}
                <View style={styles.cardFooter}>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.footerCover} contentFit="cover" />
                  ) : null}
                  <View style={styles.footerCol}>
                    <Text style={styles.footerMangaTitle} numberOfLines={1}>
                      {mangaTitle}
                    </Text>
                    <Text style={styles.footerChapterTitle} numberOfLines={1}>
                      {chapterTitle}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Controls */}
            <View style={styles.controlsSection}>
              <Text style={styles.controlLabel}>Quote / Reaction Text</Text>
              <TextInput
                style={styles.quoteInput}
                placeholder="Type a favorite line or reaction..."
                placeholderTextColor="#71717A"
                multiline
                numberOfLines={3}
                value={quoteText}
                onChangeText={setQuoteText}
              />

              <Text style={styles.controlLabel}>Card Gradient Theme</Text>
              <View style={styles.themesRow}>
                {CARD_THEMES.map((theme) => (
                  <Pressable
                    key={theme.id}
                    onPress={() => setActiveTheme(theme)}
                    style={[
                      styles.themeCircle,
                      { backgroundColor: theme.colors[0] },
                      activeTheme.id === theme.id && styles.themeCircleActive,
                    ]}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Action Button */}
          <View style={styles.actionFooter}>
            <Pressable
              onPress={handleShareCard}
              disabled={isSharing}
              style={[styles.shareBtn, { backgroundColor: colors.accent, opacity: isSharing ? 0.6 : 1 }]}
            >
              <Ionicons name="share-social-outline" size={18} color="#FFF" />
              <Text style={styles.shareBtnText}>{isSharing ? 'Generating Card...' : 'Share Card'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '85%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  headerTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  cardPreviewWrapper: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    boxShadow: '0 6px 10px rgba(0, 0, 0, 0.4)',
    elevation: 8,
  },
  cardGradient: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  brandBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  quoteBox: {
    paddingVertical: Spacing.xs,
  },
  quoteMark: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 32,
    fontWeight: 'bold',
    height: 24,
  },
  quoteBodyText: {
    color: '#FFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  footerCover: {
    width: 36,
    height: 48,
    borderRadius: Radius.xs,
  },
  footerCol: {
    flex: 1,
  },
  footerMangaTitle: {
    color: '#FFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  footerChapterTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.sizes.caption,
  },
  controlsSection: {
    gap: Spacing.sm,
  },
  controlLabel: {
    color: '#A1A1AA',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  quoteInput: {
    backgroundColor: '#18181B',
    borderColor: '#27272A',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: '#FAFAFA',
    fontSize: Typography.sizes.footnote,
    textAlignVertical: 'top',
  },
  themesRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  themeCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeCircleActive: {
    borderColor: '#FFF',
  },
  actionFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  shareBtnText: {
    color: '#FFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
});
