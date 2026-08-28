/**
 * Root Layout — App-wide providers and navigation stack with Dark Theme & dark transition backgrounds
 */
import React, { useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import { Colors } from '../constants/Colors';
import { requestStoragePermissionOnLaunch } from '../src/services/storagePermission';
import { useUserStore } from '../src/store/userStore';
import { CacheManager } from '../src/utils/cacheManager';
import { useDocumentTitle } from '../src/utils/useDocumentTitle';

SplashScreen.preventAutoHideAsync().catch(() => {});

const YomiteDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#09090B',
    card: '#09090B',
    border: Colors.dark.border,
    text: Colors.dark.text,
  },
};

export default function RootLayout() {
  useDocumentTitle();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Set native Android window background to dark, request storage permissions & initialize auth sync on launch
    SystemUI.setBackgroundColorAsync('#09090B').catch(() => {});
    CacheManager.cleanLegacyStorageCache();
    requestStoragePermissionOnLaunch();
    useUserStore.getState().initializeAuth();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={YomiteDarkTheme}>
        <StatusBar style="light" />
        <View
          style={
            Platform.OS === 'web'
              ? styles.webGlobalContainer
              : styles.nativeGlobalContainer
          }
        >
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#09090B' },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="manga/[id]"
              options={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: '#09090B' },
              }}
            />
            <Stack.Screen
              name="reader/[chapterId]"
              options={{
                headerShown: false,
                animation: 'fade',
                gestureEnabled: false,
                contentStyle: { backgroundColor: '#000000' },
              }}
            />
            <Stack.Screen
              name="profile"
              options={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: '#09090B' },
              }}
            />
            <Stack.Screen
              name="+not-found"
              options={{ title: 'Not Found', headerShown: true }}
            />
          </Stack>
        </View>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  nativeGlobalContainer: {
    flex: 1,
  },
  webGlobalContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#09090B',
  },
});
