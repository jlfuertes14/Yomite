/**
 * AnimatedPressable — Modern Micro-Interaction Button with Spring Scale Touch Feedback
 * Follows emil-design-eng micro-interaction principles with custom cubic easing
 */
import React, { useRef } from 'react';
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

interface AnimatedPressableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
  children: React.ReactNode;
}

export function AnimatedPressable({
  style,
  scaleTo = 0.95,
  haptic = true,
  onPressIn,
  onPressOut,
  children,
  ...props
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    if (haptic) triggerHaptic();
    Animated.timing(scaleAnim, {
      toValue: scaleTo,
      duration: 120,
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
      {...props}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
