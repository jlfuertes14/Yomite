/**
 * Tab Layout - Yomite floating navigation.
 */
import React from 'react';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';

type TabIcon = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: TabIcon;
  iconFocused: TabIcon;
}

const TABS: TabConfig[] = [
  { name: 'index', title: 'Discover', icon: 'compass-outline', iconFocused: 'compass' },
  { name: 'library', title: 'Library', icon: 'library-outline', iconFocused: 'library' },
  { name: 'extensions', title: 'Sources', icon: 'extension-puzzle-outline', iconFocused: 'extension-puzzle' },
  { name: 'history', title: 'History', icon: 'time-outline', iconFocused: 'time' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
];

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.tabBarFrame, { bottom: Math.max(insets.bottom, 16) + 12 }]}
    >
      <View style={styles.tabBarPill}>
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
              <View style={styles.iconSlot}>
                {isFocused ? (
                  <View style={styles.activeIconCircle}>
                    <Ionicons name={tab.iconFocused} size={19} color="#FFFFFF" />
                  </View>
                ) : (
                  <Ionicons name={tab.icon} size={19} color={Colors.dark.tabIconDefault} />
                )}
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]} numberOfLines={1}>
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
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.dark.background },
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
    bottom: 0,
    height: 64,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  tabBarPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 27, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 32,
    borderTopWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    height: '100%',
    overflow: 'hidden',
    paddingHorizontal: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    width: '92%',
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
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  activeIconCircle: {
    alignItems: 'center',
    backgroundColor: '#F43F5E',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 32,
  },
  tabLabel: {
    color: Colors.dark.tabIconDefault,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  tabLabelActive: {
    color: Colors.dark.text,
  },
});
