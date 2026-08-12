/**
 * LibraryCategoryModal — Bottom sheet action modal to select library category
 * Options: Reading, Plan to Read, Completed, Favorites, Dropped, and Remove from Library.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { triggerHaptic } from '../utils/haptics';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import type { LibraryCategory } from '../types';

interface LibraryCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  currentCategory?: LibraryCategory | null;
  isInLibrary: boolean;
  onSelectCategory: (category: LibraryCategory) => void;
  onRemoveFromLibrary: () => void;
}

const CATEGORY_OPTIONS: {
  key: LibraryCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}[] = [
  {
    key: 'reading',
    label: 'Reading',
    icon: 'book-outline',
    description: 'Manga you are currently actively reading',
  },
  {
    key: 'plan_to_read',
    label: 'Plan to Read',
    icon: 'bookmark-outline',
    description: 'Titles saved to read later in your queue',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: 'checkmark-done-outline',
    description: 'Manga you have finished reading completely',
  },
  {
    key: 'favorites',
    label: 'Favorites',
    icon: 'star-outline',
    description: 'Your top favorite and highlighted manga',
  },
  {
    key: 'dropped',
    label: 'Dropped',
    icon: 'trash-outline',
    description: 'Titles you have put on hold or stopped reading',
  },
];

export function LibraryCategoryModal({
  visible,
  onClose,
  currentCategory,
  isInLibrary,
  onSelectCategory,
  onRemoveFromLibrary,
}: LibraryCategoryModalProps) {
  const colors = useThemeColors();

  const handleSelect = (cat: LibraryCategory) => {
    triggerHaptic();
    onSelectCategory(cat);
    onClose();
  };

  const handleRemove = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    onRemoveFromLibrary();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.overlayPress} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: '#141417', borderColor: colors.border },
          ]}
        >
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isInLibrary ? 'Library Category' : 'Add to Library Category'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Category List Options */}
          <View style={styles.categoryList}>
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = isInLibrary && currentCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => handleSelect(cat.key)}
                  style={({ pressed }) => [
                    styles.categoryRow,
                    {
                      backgroundColor: isSelected
                        ? 'rgba(244, 63, 94, 0.15)'
                        : pressed
                        ? colors.surfaceElevated
                        : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: isSelected
                          ? 'rgba(244, 63, 94, 0.2)'
                          : colors.surfaceElevated,
                      },
                    ]}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={20}
                      color={isSelected ? colors.accent : colors.textSecondary}
                    />
                  </View>

                  <View style={styles.categoryTextCol}>
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: isSelected ? colors.accent : colors.text },
                      ]}
                    >
                      {cat.label}
                    </Text>
                    <Text
                      style={[styles.categoryDesc, { color: colors.textMuted }]}
                    >
                      {cat.description}
                    </Text>
                  </View>

                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.accent}
                    />
                  )}
                </Pressable>
              );
            })}

            {/* Remove from Library option if already in library */}
            {isInLibrary && (
              <Pressable
                onPress={handleRemove}
                style={({ pressed }) => [
                  styles.removeRow,
                  {
                    backgroundColor: pressed ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.removeText}>Remove from Library</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  overlayPress: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  closeBtn: {
    padding: 4,
  },
  categoryList: {
    gap: Spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTextCol: {
    flex: 1,
    gap: 2,
  },
  categoryLabel: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  categoryDesc: {
    fontSize: Typography.sizes.footnote,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 8,
    marginTop: Spacing.xs,
  },
  removeText: {
    color: '#EF4444',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
});
