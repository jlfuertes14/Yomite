import React from 'react';
import { StyleProp, ImageStyle, Platform, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

interface ZoomableImageProps {
  source: any;
  style: StyleProp<ImageStyle>;
  contentFit?: 'contain' | 'cover' | 'fill';
  onTap?: (pageX: number) => void;
  onLoad?: (e: any) => void;
  onError?: () => void;
  recyclingKey?: string;
}

export function ZoomableImage({
  source,
  style,
  contentFit = 'contain',
  onTap,
  onLoad,
  onError,
  recyclingKey,
}: ZoomableImageProps) {
  if (Platform.OS === 'web') {
    return (
      <Pressable
        onPress={(e: any) => {
          if (onTap) {
            const pageX =
              e?.nativeEvent?.pageX ??
              e?.nativeEvent?.clientX ??
              e?.nativeEvent?.locationX ??
              0;
            onTap(pageX);
          }
        }}
        style={[{ justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }, style as any]}
      >
        <Image
          source={source}
          style={style}
          contentFit={contentFit}
          onLoad={onLoad}
          onError={onError}
          recyclingKey={recyclingKey}
        />
      </Pressable>
    );
  }
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const handleTapOnJS = (pageX: number) => {
    if (onTap) {
      onTap(pageX);
    }
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 4));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1.05) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      if (scale.value <= 1.05) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      if (scale.value <= 1.05 && onTap) {
        runOnJS(handleTapOnJS)(e.absoluteX);
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    tapGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ] as any,
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[{ justifyContent: 'center', alignItems: 'center' }, animatedStyle as any]}>
        <Image
          source={source}
          style={style}
          contentFit={contentFit}
          onLoad={onLoad}
          onError={onError}
          recyclingKey={recyclingKey}
        />
      </Animated.View>
    </GestureDetector>
  );
}
