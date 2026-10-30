/**
 * Tab Layout - Yomite navigation system with floating bottom tab bar.
 * 5 primary tabs: Discover, Library, History, Extensions, and More.
 * Interactive animated floating bar with active oval backdrop fill (isleetc menu style).
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, router, useNavigation } from 'expo-router';
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
import { Colors, getContrastTextColor } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { useUIStore } from '../../src/store/uiStore';
import { triggerHaptic } from '../../src/utils/haptics';

type TabIcon = React.ComponentProps<typeof Ionicons>['name'];
type NavigationBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0] & {
  navigation?: any;
  emitter?: any;
  navigateToTab?: (routeKey: string) => void;
};

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
  defaultColor: string;
}

/** Primary tabs shown in the bottom bar with outlined vectors */
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

function AnimatedTabIcon({ focused, tab, colors, selectedColor, defaultColor }: AnimatedTabIconProps) {
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
    scale.value = withSpring(focused ? 1 : 0.92, spring);
    translateY.value = withSpring(focused ? -1 : 0, spring);
    pulse.value = withSpring(focused ? 1.05 : 1, spring);

    if (!focused || reducedMotion) {
      rotate.value = withSpring(0, spring);
      return;
    }

    const rotation = selectedName === 'index' ? 360 : selectedName === 'settings' ? 180 : selectedName === 'history' ? 30 : 0;
    rotate.value = 0;
    rotate.value = withSpring(rotation, { dampingRatio: 0.72, duration: 520 });
  }, [focused, pulse, reducedMotion, rotate, scale, selectedName, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value * pulse.value },
      { rotate: `${rotate.value}deg` },
    ] as any,
  })) as any;

  const activeIconColor = focused ? selectedColor : defaultColor;

  return (
    <Animated.View style={[styles.iconSlot, animatedStyle]}>
      {selectedName === 'library' && focused ? (
        <View style={styles.libraryMotionIcon}>
          <Ionicons name="book" size={22} color={activeIconColor} />
        </View>
      ) : selectedName === 'extensions' && focused ? (
        <View style={styles.extensionsMotionIcon}>
          <View style={[styles.windowTile, { backgroundColor: activeIconColor }]} />
          <View style={[styles.windowTile, { backgroundColor: activeIconColor }]} />
          <View style={[styles.windowTile, { backgroundColor: activeIconColor }]} />
          <View style={[styles.windowTile, { backgroundColor: activeIconColor }]} />
        </View>
      ) : (
        <Ionicons
          name={focused ? tab.iconFocused : tab.icon}
          size={25}
          color={activeIconColor}
        />
      )}
    </Animated.View>
  );
}

/**
 * Animated Tab Button with Isleetc-style Solid Oval Backdrop Pill and Dynamic Spring Expansion
 */
function AnimatedTabItem({
  tab,
  isFocused,
  navigationAccent,
  colors,
  onPress,
  onLongPress,
  options,
}: {
  tab: TabConfig;
  isFocused: boolean;
  navigationAccent: string;
  colors: ReturnType<typeof useThemeColors>;
  onPress: () => void;
  onLongPress: () => void;
  options: any;
}) {
  const contrastColor = getContrastTextColor(navigationAccent);

  // Tighter active width for lesser text padding
  const targetActiveWidth =
    tab.title.length > 8 ? 112 : tab.title.length > 6 ? 100 : tab.title.length > 4 ? 94 : 76;
  const targetInactiveWidth = 44;

  const widthAnim = useSharedValue(isFocused ? targetActiveWidth : targetInactiveWidth);
  const pillScale = useSharedValue(isFocused ? 1 : 0.88);

  useEffect(() => {
    widthAnim.value = withTiming(isFocused ? targetActiveWidth : targetInactiveWidth, {
      duration: 220,
      easing: ReanimatedEasing.bezier(0.23, 1, 0.32, 1),
    });
    pillScale.value = withTiming(isFocused ? 1 : 0.88, {
      duration: 220,
      easing: ReanimatedEasing.bezier(0.23, 1, 0.32, 1),
    });
  }, [isFocused, targetActiveWidth, targetInactiveWidth, widthAnim, pillScale]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    width: widthAnim.value,
    maxWidth: 116,
  }));

  const animatedPillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pillScale.value }],
  }));

  return (
    <Animated.View style={[styles.tabItemWrapper, animatedContainerStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel || tab.title}
        testID={options.tabBarButtonTestID}
        android_ripple={{ color: 'transparent' }}
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          styles.tabPressable,
          pressed && styles.tabItemPressed,
        ]}
      >
        {isFocused ? (
          /* Active Selected Tab: Isleetc-style Solid Oval Backdrop Pill Fill */
          <Animated.View
            style={[
              styles.activeOvalPill,
              { backgroundColor: navigationAccent },
              animatedPillStyle,
            ]}
          >
            <AnimatedTabIcon
              focused={true}
              tab={tab}
              colors={colors}
              selectedColor={contrastColor}
              defaultColor={colors.tabIconDefault}
            />
            <Text
              style={[styles.tabLabelActive, { color: contrastColor }]}
              numberOfLines={1}
            >
              {tab.title}
            </Text>
          </Animated.View>
        ) : (
          /* Inactive Tab: Icon Only */
          <View style={styles.inactiveTabContent}>
            <AnimatedTabIcon
              focused={false}
              tab={tab}
              colors={colors}
              selectedColor={contrastColor}
              defaultColor={colors.tabIconDefault}
            />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Floating Bottom Tab Bar — frosted glass, 5 primary tabs with Isleetc-style active oval pill backdrops
 */
function FloatingTabBar({ state, descriptors, emitter, navigateToTab, navigation: navProp }: NavigationBarProps) {
  const routerNav = useNavigation<any>();
  const navigation = navProp || routerNav;
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
  const bgHex = colors.background || (isDark ? '#000000' : '#FFFFFF');

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
            { height: 64 + bottomOffset + 24 },
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

                  if (tab.name === 'more' && isSecondaryActive) {
                    if (route && navigateToTab) {
                      navigateToTab(route.key);
                    } else if (navigation?.navigate) {
                      navigation.navigate('more');
                    } else {
                      router.navigate('/(tabs)/more' as any);
                    }
                    return;
                  }

                  if (route) {
                    const event = emitter?.emit
                      ? emitter.emit({
                          type: 'tabPress',
                          target: route.key,
                          canPreventDefault: true,
                        })
                      : navigation?.emit
                      ? navigation.emit({
                          type: 'tabPress',
                          target: route.key,
                          canPreventDefault: true,
                        })
                      : { defaultPrevented: false };

                    if (!isFocused && !event?.defaultPrevented) {
                      if (navigateToTab) {
                        navigateToTab(route.key);
                      } else if (navigation?.navigate) {
                        navigation.navigate(route.name);
                      } else {
                        router.navigate(`/(tabs)/${route.name}` as any);
                      }
                    }
                  } else {
                    if (navigation?.navigate) {
                      navigation.navigate(tab.name);
                    } else {
                      router.navigate(`/(tabs)/${tab.name}` as any);
                    }
                  }
                };

                const onLongPress = () => {
                  if (route) {
                    if (emitter?.emit) {
                      emitter.emit({ type: 'tabLongPress', target: route.key });
                    } else if (navigation?.emit) {
                      navigation.emit({ type: 'tabLongPress', target: route.key });
                    }
                  }
                };

                return (
                  <AnimatedTabItem
                    key={tab.name}
                    tab={tab}
                    isFocused={isFocused}
                    navigationAccent={navigationAccent}
                    colors={colors}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    options={options}
                  />
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
      id="tabs"
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
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            // The Extensions screen hosts the source catalog dialog, which the
            // Discover search sheet opens directly — so it must already be
            // mounted before its tab is ever focused.
            ...(tab.name === 'extensions' ? { lazy: false } : null),
          }}
        />
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
    height: 64, // Wammy exact outer container height (64.dp)
    position: 'relative',
    alignSelf: 'center', // Centers the pill
    maxWidth: '92%',
    overflow: 'hidden',
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
    height: 64, // Wammy exact outer container height
    paddingHorizontal: 8, // Wammy exact outer padding (8.dp)
    position: 'relative',
    justifyContent: 'center',
    gap: 4, // Wammy exact item gap (4.dp)
    overflow: 'hidden',
  },
  tabItemWrapper: {
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 116,
    overflow: 'hidden',
  },
  tabPressable: {
    width: '100%',
    height: 48, // Wammy exact item height (48.dp)
    borderRadius: 24, // Wammy exact CircleShape radius
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabItemPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  activeOvalPill: {
    width: '100%',
    height: 48, // Wammy exact item height (48.dp)
    borderRadius: 24, // Wammy exact CircleShape radius
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  inactiveTabContent: {
    width: '100%',
    height: 48, // Wammy exact item height
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28, // Fuller icon slot for 25px outline vectors
    width: 28,
  },
  tabLabelActive: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500', // Wammy exact font weight
    letterSpacing: 0,
  },
  libraryMotionIcon: {
    height: 22,
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extensionsMotionIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2.5,
    height: 20,
    transform: [{ rotate: '-8deg' }],
    width: 20,
  },
  windowTile: {
    height: 8.5,
    width: 8.5,
    borderRadius: 2,
  },
});
