/**
 * ConfirmationModal — Modern Premium Dark Glassmorphic Dialog Modal
 * Replaces default OS Alert.alert dialogs with sleek, theme-aware UI
 * Adheres dynamically to the user's preferred app theme accent color
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import { triggerHaptic } from '../utils/haptics';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'destructive' | 'primary' | 'success';
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  visible,
  title,
  message,
  iconName = 'alert-circle-outline',
  iconColor,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  children,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const colors = useThemeColors();

  if (!visible) return null;

  const handleConfirm = () => {
    triggerHaptic(confirmVariant === 'destructive' ?  Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    onConfirm();
  };

  const handleCancel = () => {
    triggerHaptic();
    onCancel();
  };

  // Button background color adheres to the user's preferred app accent theme
  const getConfirmBgColor = () => {
    switch (confirmVariant) {
      case 'success':
        return colors.emerald;
      case 'destructive':
        return colors.accent;
      default:
        return colors.accent;
    }
  };

  const defaultIconColor = iconColor || colors.accent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleCancel} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Top Icon Pill Badge */}
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: `${defaultIconColor}1F` },
            ]}
          >
            <Ionicons name={iconName} size={26} color={defaultIconColor} />
          </View>

          {/* Title & Message */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          {children}

          {/* Action Buttons Row */}
          <View style={styles.buttonRow}>
            {cancelText ? (
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderWidth: 1,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                  {cancelText}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: getConfirmBgColor(),
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.confirmBtnText}>{confirmText}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: Typography.sizes.footnote,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
});
