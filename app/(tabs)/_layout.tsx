/**
 * Tab Layout - Yomite navigation system with floating bottom tab bar.
 * 5 primary tabs: Discover, Library, History, Extensions, and More.
 * Frosted-glass blur backdrop behind the navigation pill.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import {
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing as ReanimatedEasing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { useUIStore } from '../../src/store/uiStore';
import { triggerHaptic } from '../../src/utils/haptics';

type TabIcon = React.ComponentProps<typeof Ionicons>['name'];
type NavigationBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

interface TabConfig {
  name: string;
  title: string;
  icon: TabIcon;
  iconFocused: TabIcon;
}

interface AnimatedTabIconProps {
  focused: boolean;
  tab: TabConfig;
  colors: ReturnType<typeof useThemeColors>;
  selectedColor: string;
}

/** Primary tabs shown in the bottom bar */
const PRIMARY_TABS: TabConfig[] = [
  { name: 'index', title: 'Discover', icon: 'compass-outline', iconFocused: 'compass' },
  { name: 'library', title: 'Library', icon: 'library-outline', iconFocused: 'library' },
  { name: 'history', title: 'History', icon: 'time-outline', iconFocused: 'time' },
  { name: 'extensions', title: 'Extensions', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'more', title: 'More', icon: 'ellipsis-horizontal-outline', iconFocused: 'ellipsis-horizontal' },
];

/** Secondary screens accessible via the "More" page hub */
const SECONDARY_SCREENS: TabConfig[] = [
  { name: 'downloads', title: 'Downloads', icon: 'download-outline', iconFocused: 'download' },
  { name: 'community', title: 'Community', icon: 'chatbubbles-outline', iconFocused: 'chatbubbles' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
];

/** Complete tab list for Tabs.Screen registration (order matters for expo-router) */
const ALL_TABS: TabConfig[] = [
  ...PRIMARY_TABS,
  ...SECONDARY_SCREENS,
];

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== 'string') {
    return `rgba(5, 5, 5, ${alpha})`;
  }
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex.charAt(0) + cleanHex.charAt(0), 16);
    const g = parseInt(cleanHex.charAt(1) + cleanHex.charAt(1), 16);
    const b = parseInt(cleanHex.charAt(2) + cleanHex.charAt(2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(5, 5, 5, ${alpha})`;
}

function AnimatedTabIcon({ focused, tab, colors, selectedColor }: AnimatedTabIconProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(focused ? 1 : 0.92);
  const translateY = useSharedValue(focused ? -1 : 0);
  const rotate = useSharedValue(0);
  const pulse = useSharedValue(1);
  const selectedName = tab.name;

  useEffect(() => {
    const spring = {
      dampingRatio: 0.8,
      duration: 260,
      reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System,
    };
    scale.set(withSpring(focused ? 1 : 0.92, spring));
    const verticalTarget = focused ? -1 : 0;
    translateY.set(withSpring(verticalTarget, spring));
    pulse.set(withSpring(focused ? 1.08 : 1, spring));

    if (!focused || reducedMotion) {
      rotate.set(withSpring(0, spring));
      return;
    }

    const rotation = selectedName === 'index' ? 360 : selectedName === 'settings' ? 180 : selectedName === 'history' ? 30 : 0;
    rotate.set(0);
    rotate.set(withSpring(rotation, { dampingRatio: 0.72, duration: 520 }));
  }, [focused, pulse, reducedMotion, rotate, scale, selectedName, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.get() },
      { scale: scale.get() * pulse.get() },
      { rotate: `${rotate.get()}deg` },
    ] as any,
  })) as any;

  return (
    <Animated.View style={[styles.iconSlot, animatedStyle]}>
      {selectedName === 'library' && focused ? (
        <View style={[styles.libraryMotionIcon, { transform: [{ translateY: 2 }] }]}>
          <Ionicons name="book" size={18} color={selectedColor} />
        </View>
      ) : selectedName === 'extensions' && focused ? (
        <View style={styles.extensionsMotionIcon}>
          <View style={[styles.windowTile, { backgroundColor: selectedColor }]} />
          <View style={[styles.windowTile, { backgroundColor: selectedColor }]} />
          <View style={[styles.windowTile, { backgroundColor: selectedColor }]} />
          <View style={[styles.windowTile, { backgroundColor: selectedColor }]} />
        </View>
      ) : (
        <Ionicons
          name={focused ? tab.iconFocused : tab.icon}
          size={22}
          color={focused ? selectedColor : colors.tabIconDefault}
        />
      )}
    </Animated.View>
  );
}

/**
 * Floating Bottom Tab Bar — frosted glass, 5 primary tabs
 */
function FloatingTabBar({ state, descriptors, navigation }: NavigationBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const navigationAccent = colors.accent;

  const currentRouteName = state.routes[state.index]?.name;
  const isSecondaryActive = SECONDARY_SCREENS.some((t) => t.name === currentRouteName);

  const isDark = colors.background === Colors.dark.background ||
    colors.background === '#0F1415' ||
    colors.background === '#1A1110' ||
    colors.background === '#10140F' ||
    colors.background === '#151218' ||
    colors.background === '#191113' ||
    colors.background === '#121318' ||
    colors.background === '#141314' ||
    colors.background === '#10141C' ||
    (colors.background ?? '').charAt(1) <= '3';

  const bottomOffset = Math.max(insets.bottom, 12) + 8;
  const bgHex = colors.background || (isDark ? '#050505' : '#FFFFFF');

  const isTabBarVisible = useUIStore((s) => s.isTabBarVisible);
  const barTranslateY = useSharedValue(0);

  useEffect(() => {
    barTranslateY.value = withTiming(isTabBarVisible ? 0 : 120, {
      duration: 240,
      easing: ReanimatedEasing.bezier(0.23, 1, 0.32, 1),
    });
  }, [isTabBarVisible, barTranslateY]);

  const barAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: barTranslateY.value }],
    opacity: barTranslateY.value > 100 ? 0 : 1,
  }));

  return (
    <View
      style={[
        styles.tabBarFrame,
        { pointerEvents: 'box-none' },
      ]}
    >
      <Animated.View style={[{ width: '100%' }, barAnimatedStyle]}>
        {/* Ambient dim/blur backdrop below and behind the floating menu app bar */}
        <View
          pointerEvents="none"
          style={[
            styles.bottomBlurStrip,
            { height: 60 + bottomOffset + 24 },
          ]}
        >
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={40}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={[
            hexToRgba(bgHex, 0),
            hexToRgba(bgHex, 0.25),
            hexToRgba(bgHex, 0.65),
            hexToRgba(bgHex, 0.92),
            hexToRgba(bgHex, 0.98),
          ]}
          locations={[0, 0.35, 0.65, 0.88, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Floating Navigation Pill */}
      <View style={[styles.floatingPillWrapper, { marginBottom: bottomOffset }]}>
        <View
          style={[
            styles.pillShadowContainer,
            {
              shadowColor: isDark ? '#000000' : '#0F172A',
              shadowOffset: { width: 0, height: isDark ? 6 : 4 },
              shadowOpacity: isDark ? 0.38 : 0.12,
              shadowRadius: isDark ? 16 : 14,
              elevation: isDark ? 8 : 6,
            },
          ]}
        >
          {/* Frosted & Tinted Surface (clipped with overflow: hidden) */}
          <View style={styles.blurWrapper}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            {/* Tactile Flat / Skeuomorphic Tinted Base: Dirty white / porcelain in light mode, full black in dark mode */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark
                    ? '#000000'
                    : 'rgba(238, 241, 246, 0.95)',
                  borderRadius: 32,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
                },
              ]}
            />
            {/* Skeuomorphic Top Specular Rim & Bottom Subtle Shading */}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: 32,
                  borderTopWidth: 1.2,
                  borderTopColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.95)',
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            />
          </View>

          <View style={styles.tabBarPill}>
            {PRIMARY_TABS.map((tab) => {
              const route = state.routes.find((r) => r.name === tab.name);
              const isFocused =
                currentRouteName === tab.name ||
                (tab.name === 'more' && isSecondaryActive);

              const options = route ? descriptors[route.key]?.options ?? {} : {};

              const onPress = () => {
                triggerHaptic();

                // When viewing secondary screens (downloads, community, settings), tapping More returns to the More hub
                if (tab.name === 'more' && isSecondaryActive) {
                  navigation.navigate('more');
                  return;
                }

                if (route) {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });

                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                } else {
                  navigation.navigate(tab.name);
                }
              };

              const onLongPress = () => {
                if (route) {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
                }
              };

              return (
                <Pressable
                  key={tab.name}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel || tab.title}
                  testID={options.tabBarButtonTestID}
                  android_ripple={{ color: 'transparent' }}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={({ pressed }) => [
                    styles.tabItem,
                    pressed && styles.tabItemPressed,
                  ]}
                >
                  <AnimatedTabIcon
                    focused={isFocused}
                    tab={tab}
                    colors={colors}
                    selectedColor={navigationAccent}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isFocused ? navigationAccent : (isDark ? colors.tabIconDefault : '#4A5568'),
                        fontWeight: isFocused ? '700' : '600',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();

  // Pure horizontal slide: screens remain 100% solid & opaque to eliminate ghosting/shadow bleed-through
  const sceneStyleInterpolator = useMemo(() => {
    return ({ current }: { current: { progress: any } }) => ({
      sceneStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-windowWidth, 0, windowWidth],
            }),
          },
        ],
      },
    });
  }, [windowWidth]);

  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) =>
        Platform.OS === 'web' ? null : <FloatingTabBar {...props} />
      }
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        sceneStyleInterpolator,
        transitionSpec: {
          animation: 'timing',
          config: {
            duration: 240,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          },
        },
        freezeOnBlur: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      {ALL_TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarFrame: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  bottomBlurStrip: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    width: '100%',
  },
  floatingPillWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  pillShadowContainer: {
    borderRadius: 32,
    height: 60,
    position: 'relative',
    width: '94%',
  },
  blurWrapper: {
    borderRadius: 32,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  tabBarPill: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 60,
    paddingHorizontal: 4,
    position: 'relative',
    width: '100%',
  },
  tabItem: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 22,
    flex: 1,
    height: 52,
    justifyContent: 'center',
    marginHorizontal: 1,
    minWidth: 0,
  },
  tabItemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  iconSlot: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 30,
  },
  tabLabel: {
    color: Colors.dark.tabIconDefault,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginTop: 1,
  },
  libraryMotionIcon: {
    height: 22,
    position: 'relative',
    width: 23,
  },
  extensionsMotionIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    height: 18,
    transform: [{ rotate: '-8deg' }],
    width: 18,
  },
  windowTile: {
    height: 8,
    width: 8,
  },
});

