/**
 * ConfirmationModal — Modern Minimalist Flat Dialog Modal
 * Flat design, crisp borders, zero drop shadows, centered across all viewports (Mobile & Web), theme-aware UI.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.95)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);
  const isDismissingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      isDismissingRef.current = false;
      backdropAnim.setValue(0);
      cardScaleAnim.setValue(0.95);
      cardOpacityAnim.setValue(0);

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
      ]).start();
    } else {
      setRendered(false);
    }
  }, [visible, backdropAnim, cardOpacityAnim, cardScaleAnim]);

  const handleCancel = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
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
    ]).start(() => {
      onCancel();
    });
  }, [onCancel, backdropAnim, cardOpacityAnim, cardScaleAnim]);

  const handleConfirm = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    triggerHaptic(
      confirmVariant === 'destructive'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );

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
    ]).start(() => {
      onConfirm();
    });
  }, [onConfirm, confirmVariant, backdropAnim, cardOpacityAnim, cardScaleAnim]);

  if (!rendered && !visible) return null;

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

  const defaultIconColor =
    iconColor || (confirmVariant === 'destructive' ? '#EF4444' : colors.accent);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Animated backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Dismiss dialog"
          />
        </Animated.View>

        {/* Flat Modern Dialog Card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              opacity: cardOpacityAnim,
              transform: [{ scale: cardScaleAnim }],
            },
          ]}
          accessibilityRole="alert"
        >
          {/* Flat Minimal Icon Pill */}
          {iconName && (
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: `${defaultIconColor}14` },
              ]}
            >
              <Ionicons name={iconName} size={20} color={defaultIconColor} />
            </View>
          )}

          {/* Title & Message */}
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {Boolean(message) && (
            <Text
              style={[styles.message, { color: colors.textSecondary }]}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {message}
            </Text>
          )}

          {children && <View style={styles.childrenWrapper}>{children}</View>}

          {/* Action Buttons Row */}
          <View style={styles.buttonRow}>
            {cancelText ? (
              <Pressable
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
                style={({ pressed, hovered }: any) => [
                  styles.btn,
                  styles.cancelBtn,
                  {
                    backgroundColor: colors.surfaceElevated,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    opacity: hovered ? 0.9 : 1,
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
                styles.confirmBtn,
                {
                  backgroundColor: getConfirmBgColor(),
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  opacity: hovered ? 0.92 : 1,
                },
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <Text style={styles.confirmBtnText}>{confirmText}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: 0,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    // Strictly flat design: zero skeuomorphic elevation & drop-shadows
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  childrenWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
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
});
