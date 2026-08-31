import React, { useEffect } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import { Colors } from '../constants/Colors';
import { requestStoragePermissionOnLaunch } from '../src/services/storagePermission';
import { useUserStore } from '../src/store/userStore';
import { CacheManager } from '../src/utils/cacheManager';
import { useDocumentTitle } from '../src/utils/useDocumentTitle';

// Ensure pending OAuth web sessions complete immediately on redirect
WebBrowser.maybeCompleteAuthSession();

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
  const authSuccessMessage = useUserStore((s) => s.authSuccessMessage);
  const clearAuthSuccessMessage = useUserStore((s) => s.clearAuthSuccessMessage);

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
    if (authSuccessMessage) {
      const timer = setTimeout(() => {
        clearAuthSuccessMessage();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [authSuccessMessage, clearAuthSuccessMessage]);

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
          {authSuccessMessage && (
            <View style={styles.toastOverlay}>
              <View style={styles.toastContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.toastText}>{authSuccessMessage}</Text>
                <Pressable onPress={clearAuthSuccessMessage} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                  <Ionicons name="close" size={16} color="#A1A1AA" />
                </Pressable>
              </View>
            </View>
          )}
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
              name="auth/callback"
              options={{
                headerShown: false,
                animation: 'fade',
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
  toastOverlay: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.94)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    gap: 10,
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
    elevation: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
