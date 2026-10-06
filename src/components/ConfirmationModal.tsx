/**
 * ConfirmationModal — Modern Minimalist Centered Dialog Modal
 * Flat design, centered across all viewports (Mobile & Web), theme-aware UI.
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
import { Radius, Spacing, Typography } from '../../constants/Colors';
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
    triggerHaptic(confirmVariant === 'destructive' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    onConfirm();
  };

  const handleCancel = () => {
    triggerHaptic();
    onCancel();
  };

  const getConfirmBgColor = () => {
    switch (confirmVariant) {
      case 'success':
        return colors.emerald || '#10B981';
      case 'destructive':
        return '#EF4444';
      default:
        return colors.accent;
    }
  };

  const defaultIconColor = iconColor || (confirmVariant === 'destructive' ? '#EF4444' : colors.accent);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={handleCancel}
          accessibilityLabel="Dismiss dialog"
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Top Icon Badge */}
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: `${defaultIconColor}18` },
            ]}
          >
            <Ionicons name={iconName} size={24} color={defaultIconColor} />
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
                accessibilityRole="button"
                accessibilityLabel={cancelText}
                style={({ pressed, hovered }: any) => [
                  styles.btn,
                  {
                    backgroundColor: colors.surfaceElevated,
                    opacity: pressed ? 0.7 : hovered ? 0.9 : 1,
                  },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  {cancelText}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
              style={({ pressed, hovered }: any) => [
                styles.btn,
                {
                  backgroundColor: getConfirmBgColor(),
                  opacity: pressed ? 0.85 : hovered ? 0.95 : 1,
                },
                Platform.OS === 'web' && { cursor: 'pointer' as any },
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: Typography.sizes.footnote,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
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
