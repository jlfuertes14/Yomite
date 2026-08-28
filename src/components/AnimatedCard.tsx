/**
 * AnimatedCard — Modern Staggered Entrance & Touch Scale Card
 * Staggered entrance animation (30-50ms delay) + spring scale touch feedback
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  Easing,
  Platform,
} from 'react-native';
import { triggerHaptic } from '../utils/haptics';

interface AnimatedCardProps extends PressableProps {
  index?: number;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
  children: React.ReactNode;
}

export function AnimatedCard({
  index = 0,
  style,
  scaleTo = 0.97,
  haptic = true,
  onPressIn,
  onPressOut,
  children,
  ...props
}: AnimatedCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const delay = Math.min(index * 45, 360);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [index]);

  const handlePressIn = (e: any) => {
    if (haptic) triggerHaptic();
    Animated.timing(scaleAnim, {
      toValue: scaleTo,
      duration: 100,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    if (onPressOut) onPressOut(e);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      {...props}
    >
      <Animated.View
        style={{
          width: '100%',
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
