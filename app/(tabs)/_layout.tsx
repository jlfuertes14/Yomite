/**
 * Tab Layout - Yomite navigation system with floating bottom tab bar.
 */
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';

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

const TABS: TabConfig[] = [
  { name: 'index', title: 'Discover', icon: 'compass-outline', iconFocused: 'compass' },
  { name: 'library', title: 'Library', icon: 'library-outline', iconFocused: 'library' },
  { name: 'downloads', title: 'Downloads', icon: 'download-outline', iconFocused: 'download' },
  { name: 'extensions', title: 'Extensions', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'community', title: 'Community', icon: 'chatbubbles-outline', iconFocused: 'chatbubbles' },
  { name: 'history', title: 'History', icon: 'time-outline', iconFocused: 'time' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
];

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
      ) : selectedName === 'community' && focused ? (
        <View style={[styles.communityMotionIcon, { transform: [{ scaleX: -1 }] }]}>
          <Ionicons
            name="chatbubble"
            size={21}
            color={selectedColor}
          />
          <Ionicons
            name="chatbubble-outline"
            size={12}
            color={selectedColor}
            style={{ position: 'absolute', right: 1, bottom: 0, transform: [{ scaleX: -1 }] }}
          />
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
          size={21}
          color={focused ? selectedColor : colors.tabIconDefault}
        />
      )}
    </Animated.View>
  );
}

/**
 * Floating Bottom Tab Bar
 */
function FloatingTabBar({ state, descriptors, navigation }: NavigationBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const navigationAccent = colors.accent;
  const reducedMotion = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const itemWidth = barWidth / state.routes.length;

  useEffect(() => {
    if (!itemWidth) return;
    indicatorX.set(
      withSpring(state.index * itemWidth, {
        dampingRatio: 0.82,
        duration: 300,
        reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System,
      }),
    );
  }, [indicatorX, itemWidth, reducedMotion, state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: Math.max(0, itemWidth - 8),
    transform: [{ translateX: indicatorX.get() + 4 }],
  })) as any;

  const onBarLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={[
        styles.tabBarFrame,
        { bottom: Math.max(insets.bottom, 12) + 8, pointerEvents: 'box-none' },
      ]}
    >
      <View
        onLayout={onBarLayout}
        style={[styles.tabBarPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.activeIndicator, { backgroundColor: `${navigationAccent}33` }, indicatorStyle]}
        />
        {state.routes.map((route, index) => {
          const tab = TABS.find((item) => item.name === route.name);
          if (!tab) return null;

          const isFocused = state.index === index;
          const options = descriptors[route.key].options;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              android_ripple={{ color: 'transparent' }}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
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
                  { color: isFocused ? navigationAccent : colors.tabIconDefault },
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
  );
}

export default function TabLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      tabBar={(props) =>
        Platform.OS === 'web' ? null : <FloatingTabBar {...props} />
      }
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      {TABS.map((tab) => (
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
  tabBarPill: {
    alignItems: 'center',
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    flexDirection: 'row',
    height: 60,
    overflow: 'hidden',
    paddingHorizontal: 4,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    width: '94%',
  },
  tabItem: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  tabItemPressed: {
    opacity: 0.68,
  },
  iconSlot: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 30,
  },
  activeIndicator: {
    borderRadius: 16,
    height: 34,
    left: 0,
    position: 'absolute',
    top: 6,
  },
  tabLabel: {
    color: Colors.dark.tabIconDefault,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  libraryMotionIcon: {
    height: 22,
    position: 'relative',
    width: 23,
  },
  communityMotionIcon: {
    height: 23,
    position: 'relative',
    width: 24,
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
