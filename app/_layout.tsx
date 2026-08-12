/**
 * Root Layout — App-wide providers and navigation stack with Dark Theme & dark transition backgrounds
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import { Colors } from '../constants/Colors';
import { requestStoragePermissionOnLaunch } from '../src/services/storagePermission';

SplashScreen.preventAutoHideAsync().catch(() => {});
try {
  if (typeof (SplashScreen as any).setOptions === 'function') {
    (SplashScreen as any).setOptions({
      duration: 350,
      fade: true,
    });
  }
} catch (_e) {}

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
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Set native Android window background to dark & request storage permissions on initial launch
    SystemUI.setBackgroundColorAsync('#09090B').catch(() => {});
    requestStoragePermissionOnLaunch();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={YomiteDarkTheme}>
      <StatusBar style="light" />
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
          name="+not-found"
          options={{ title: 'Not Found', headerShown: true }}
        />
      </Stack>
    </ThemeProvider>
  );
}
