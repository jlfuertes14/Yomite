/**
 * ConfirmationModal — Modern Minimalist Flat Dialog Modal
 * Styled after Messenger's clean confirmation/delete dialog:
 * - Distinct elevated dark gray card background (#242528) in dark mode, pure white in light mode
 * - Clean typography-first design with NO top icons or button icon clutter
 * - Flat design, zero borders, zero drop shadows
 * - Text-only action buttons (no filled pill backgrounds, the text is enough)
 * - 44x44pt touch targets with smooth press feedback
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
import { useColorScheme } from '../hooks/useColorScheme';
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
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  children,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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

  // Messenger-style color tokens: elevated dark gray dialog in dark mode, crisp white in light mode
  const cardBgColor = isDark ? '#242528' : '#FFFFFF';
  const titleColor = isDark ? '#F4F4F5' : '#111827';
  const messageColor = isDark ? '#B0B3B8' : '#64748B';
  const cancelTextColor = isDark ? '#A1A1AA' : '#64748B';

  const confirmTextColor =
    confirmVariant === 'destructive'
      ? '#EF4444'
      : confirmVariant === 'success'
        ? (colors.emerald || '#10B981')
        : colors.accent;

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

        {/* Messenger-style Flat Modern Dialog Card (Zero Icon Clutter, Clean Typography) */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: cardBgColor,
              opacity: cardOpacityAnim,
              transform: [{ scale: cardScaleAnim }],
            },
          ]}
          accessibilityRole="alert"
        >
          {/* Title & Message */}
          <Text
            style={[styles.title, { color: titleColor }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {Boolean(message) && (
            <Text
              style={[styles.message, { color: messageColor }]}
              numberOfLines={4}
              ellipsizeMode="tail"
            >
              {message}
            </Text>
          )}

          {children && <View style={styles.childrenWrapper}>{children}</View>}

          {/* Messenger-style Action Buttons Row (Text-Only, Right-Aligned) */}
          <View style={styles.buttonRow}>
            {cancelText ? (
              <Pressable
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
                style={({ pressed }: any) => [
                  styles.textBtn,
                  {
                    opacity: pressed ? 0.6 : 1,
                  },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: cancelTextColor }]}>
                  {cancelText}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
              style={({ pressed }: any) => [
                styles.textBtn,
                {
                  opacity: pressed ? 0.6 : 1,
                },
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <Text style={[styles.confirmBtnText, { color: confirmTextColor }]}>
                {confirmText}
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 0,
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 22,
    alignItems: 'flex-start',
    // Strictly flat design: zero skeuomorphic elevation & drop-shadows
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'left',
    marginBottom: 8,
    letterSpacing: -0.3,
    width: '100%',
  },
  message: {
    fontSize: 14,
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 20,
    width: '100%',
  },
  childrenWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    width: '100%',
  },
  textBtn: {
    minHeight: 44,
    minWidth: 64,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  cancelBtnText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  confirmBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});
