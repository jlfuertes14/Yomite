/**
 * IntroWelcomeModal — Modern 1-Tap Introductory Welcome Screen
 * 
 * Features:
 * - Dynamic tilted manga/manhwa comic collage backdrop with obsidian gradient overlay.
 * - Yomite mascot icon + brand title.
 * - Clean "Welcome" headline (no pills).
 * - Value proposition: "#1 App to read comics, webcomics, manga, and manhwa".
 * - 1-tap "Get started" CTA with tactile haptics and smooth fluid dismissal.
 * - No skip pill, no footer microtext.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../hooks/useThemeColor';
import { triggerHaptic } from '../utils/haptics';
import { isExpoGo } from '../services/notificationService';

export const INTRO_COMPLETED_STORAGE_KEY = '@yomite_intro_completed_v1';

interface IntroWelcomeModalProps {
  forceVisible?: boolean;
  onDismiss?: () => void;
}

export function IntroWelcomeModal({ forceVisible = false, onDismiss }: IntroWelcomeModalProps) {
  // Do not render on web/browser platform
  if (Platform.OS === 'web') {
    return null;
  }

  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Always render in Expo Go environment for easy developer verification
  const isExpo = isExpoGo();
  const [visible, setVisible] = useState<boolean>(forceVisible || isExpo);
  const [pressedCta, setPressedCta] = useState(false);

  // Animations
  const opacityAnim = useRef(new Animated.Value(forceVisible || isExpo ? 1 : 0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // Check persistent status on cold start
  useEffect(() => {
    if (forceVisible || isExpo) {
      setVisible(true);
      opacityAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }

    let isMounted = true;
    AsyncStorage.getItem(INTRO_COMPLETED_STORAGE_KEY).then((value) => {
      if (!isMounted) return;
      if (value !== 'true') {
        setVisible(true);
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 450,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [forceVisible, isExpo, opacityAnim, slideAnim]);

  const handleComplete = useCallback(async () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    triggerHaptic();

    try {
      if (!isExpo) {
        await AsyncStorage.setItem(INTRO_COMPLETED_STORAGE_KEY, 'true');
      }
    } catch {}

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 250,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setVisible(false);
      isClosingRef.current = false;
      onDismiss?.();
    });
  }, [opacityAnim, slideAnim, onDismiss, isExpo]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlayRoot,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="auto"
    >
      {/* 1. Fullscreen Diagonal Manga Collage Background */}
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../assets/images/intro_bg.jpg')}
          style={styles.backgroundImage}
          contentFit="cover"
          priority="high"
          transition={0}
        />
        {/* Cinematic Multi-Stop Obsidian Gradient: Increased darkness over text and bottom CTA */}
        <LinearGradient
          colors={[
            'rgba(9, 9, 11, 0.10)',
            'rgba(9, 9, 11, 0.35)',
            'rgba(9, 9, 11, 0.76)',
            'rgba(9, 9, 11, 0.94)',
            '#09090B',
          ]}
          locations={[0, 0.32, 0.58, 0.78, 1.0]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Flexible spacer pushing the content to lower half */}
      <View style={{ flex: 1 }} />

      {/* 2. Hero Content: Yomite Mascot Icon, Brand, Welcome & Value Proposition */}
      <View
        style={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom + 16, 32) },
        ]}
      >
        <View style={styles.heroBlock}>
          {/* Yomite Icon & Brand Title */}
          <View style={styles.brandContainer}>
            <View style={styles.mascotWrapper}>
              <Image
                source={require('../../assets/images/mascot_transparent.png')}
                style={styles.mascotIcon}
                contentFit="contain"
                priority="high"
              />
            </View>
            <Text style={styles.brandTitle}>Yomite</Text>
          </View>

          {/* Clean "Welcome" text (no pill container) */}
          <Text style={styles.welcomeText}>Welcome</Text>

          {/* Value Proposition Headline matching reference */}
          <Text style={styles.headline}>
            #1 App to read{'\n'}comics, webcomics,{'\n'}manga, and manhwa
          </Text>
        </View>

        {/* 3. Bottom 1-Tap CTA Area (no text underneath) */}
        <View style={styles.ctaWrapper}>
          <Pressable
            onPress={handleComplete}
            onPressIn={() => setPressedCta(true)}
            onPressOut={() => setPressedCta(false)}
            accessibilityRole="button"
            accessibilityLabel="Get started with Yomite"
            style={[
              styles.ctaButton,
              {
                backgroundColor: colors.accent,
                transform: [{ scale: pressedCta ? 0.97 : 1 }],
              },
            ]}
          >
            <Text style={[styles.ctaButtonText, { color: colors.accentForeground }]}>
              Get started
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 999999,
    backgroundColor: '#09090B',
    justifyContent: 'space-between',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    paddingHorizontal: 24,
    zIndex: 2,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  heroBlock: {
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  mascotWrapper: {
    width: 82,
    height: 82,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  mascotIcon: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  welcomeText: {
    color: '#E4E4E7',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 35,
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  ctaWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 28,
  },
  ctaButton: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
