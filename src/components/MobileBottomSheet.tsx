import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Modal, Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface MobileBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  backdropColor?: string;
}

interface MobileModalRootProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const SHEET_SPRING = {
  damping: 20,
  stiffness: 220,
  mass: 0.85,
};

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;

function runCloseCallback(onClose: () => void) {
  'worklet';
  scheduleOnRN(onClose);
}

/**
 * React Native modals mount in a separate native root. This restores Gesture
 * Handler support without changing the layout of the sheet it contains.
 */
export function MobileModalRoot({ children, style }: MobileModalRootProps) {
  if (Platform.OS === 'web') return <View style={style}>{children}</View>;

  return (
    <GestureHandlerRootView style={style} unstable_forceActive>
      {children}
    </GestureHandlerRootView>
  );
}

/** Native-only sheet motion. Web callers should keep their existing dialog presentation. */
export function MobileBottomSheet({
  visible,
  onClose,
  children,
  contentStyle,
  backdropColor = 'rgba(0, 0, 0, 0.72)',
}: MobileBottomSheetProps) {
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(height);
  const startY = useSharedValue(0);
  const isClosing = useSharedValue(false);

  const closeWithAnimation = () => {
    if (isClosing.value) return;
    isClosing.value = true;
    cancelAnimation(translateY);
    translateY.value = withTiming(height, { duration: 180 }, (finished) => {
      if (finished) runCloseCallback(onClose);
    });
  };

  useEffect(() => {
    if (!visible) return;
    isClosing.value = false;
    translateY.value = height;
    translateY.value = withSpring(0, SHEET_SPRING);
  }, [height, isClosing, translateY, visible]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([6, 1000])
    .failOffsetX([-24, 24])
    .onStart(() => {
      cancelAnimation(translateY);
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (!isClosing.value) {
        translateY.value = Math.max(0, startY.value + event.translationY);
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        isClosing.value = true;
        translateY.value = withTiming(height, { duration: 180 }, (finished) => {
          if (finished) runCloseCallback(onClose);
        });
      } else {
        translateY.value = withSpring(0, { ...SHEET_SPRING, velocity: event.velocityY });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (Platform.OS === 'web') return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithAnimation}>
      <MobileModalRoot style={[styles.root, { backgroundColor: backdropColor }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation} />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheet, contentStyle, animatedStyle]}>
            <View style={styles.handleHitArea}>
              <View style={styles.handle} />
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </MobileModalRoot>
    </Modal>
  );
}

export interface MobileSheetPanelRef {
  close: () => void;
}

interface MobileSheetPanelProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  showHandle?: boolean;
  /** Keep vertical scrolling inside child ScrollViews; only the handle dismisses the sheet. */
  gestureHandleOnly?: boolean;
}

/** Animated panel for screens that already own a transparent Modal/backdrop. */
export const MobileSheetPanel = forwardRef<MobileSheetPanelRef, MobileSheetPanelProps>(function MobileSheetPanel(
  { visible, onClose, children, style, showHandle = true, gestureHandleOnly = false },
  ref,
) {
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(height);
  const startY = useSharedValue(0);
  const isClosing = useSharedValue(false);

  const closeWithAnimation = () => {
    if (isClosing.value) return;
    isClosing.value = true;
    cancelAnimation(translateY);
    translateY.value = withTiming(height, { duration: 180 }, (finished) => {
      if (finished) runCloseCallback(onClose);
    });
  };

  useImperativeHandle(ref, () => ({ close: closeWithAnimation }), [height]);

  useEffect(() => {
    if (!visible) return;
    isClosing.value = false;
    translateY.value = height;
    translateY.value = withSpring(0, SHEET_SPRING);
  }, [height, isClosing, translateY, visible]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([6, 1000])
    .failOffsetX([-24, 24])
    .onStart(() => {
      cancelAnimation(translateY);
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (!isClosing.value) {
        translateY.value = Math.max(0, startY.value + event.translationY);
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        isClosing.value = true;
        translateY.value = withTiming(height, { duration: 180 }, (finished) => {
          if (finished) runCloseCallback(onClose);
        });
      } else {
        translateY.value = withSpring(0, { ...SHEET_SPRING, velocity: event.velocityY });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (Platform.OS === 'web') return <View style={style}>{children}</View>;

  if (gestureHandleOnly) {
    return (
      <Animated.View style={[style, animatedStyle]}>
        {showHandle && (
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleHitArea}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
        )}
        {children}
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[style, animatedStyle]}>
        {showHandle && (
          <View style={styles.handleHitArea}>
            <View style={styles.handle} />
          </View>
        )}
        {children}
      </Animated.View>
    </GestureDetector>
  );
});

/** Left-edge counterpart for navigation drawers; it intentionally does not use bottom-sheet motion. */
export const MobileSideSheetPanel = forwardRef<MobileSheetPanelRef, MobileSheetPanelProps>(function MobileSideSheetPanel(
  { visible, onClose, children, style },
  ref,
) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(-width);
  const startX = useSharedValue(0);
  const isClosing = useSharedValue(false);

  const closeWithAnimation = () => {
    if (isClosing.value) return;
    isClosing.value = true;
    cancelAnimation(translateX);
    translateX.value = withTiming(-width, { duration: 180 }, (finished) => {
      if (finished) runCloseCallback(onClose);
    });
  };

  useImperativeHandle(ref, () => ({ close: closeWithAnimation }), [width]);

  useEffect(() => {
    if (!visible) return;
    isClosing.value = false;
    translateX.value = -width;
    translateX.value = withSpring(0, SHEET_SPRING);
  }, [isClosing, translateX, visible, width]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-1000, -6])
    .failOffsetY([-24, 24])
    .onStart(() => {
      cancelAnimation(translateX);
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      if (!isClosing.value) {
        translateX.value = Math.min(0, startX.value + event.translationX);
      }
    })
    .onEnd((event) => {
      if (event.translationX < -DISMISS_DISTANCE || event.velocityX < -DISMISS_VELOCITY) {
        isClosing.value = true;
        translateX.value = withTiming(-width, { duration: 180 }, (finished) => {
          if (finished) runCloseCallback(onClose);
        });
      } else {
        translateX.value = withSpring(0, { ...SHEET_SPRING, velocity: event.velocityX });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (Platform.OS === 'web') return <View style={style}>{children}</View>;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleHitArea: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});
