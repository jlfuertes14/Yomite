import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, Animated, Easing } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/Colors';
import { requestStoragePermissionOnLaunch } from '../src/services/storagePermission';
import { useUserStore } from '../src/store/userStore';
import { CacheManager } from '../src/utils/cacheManager';
import { useDocumentTitle } from '../src/utils/useDocumentTitle';
import { webViewBridge } from '../src/sources/network/webViewBridge';
import { DEFAULT_USER_AGENT } from '../src/sources/network/httpClient';
import '../src/services/backgroundScanner';
import { getNotificationsModule } from '../src/services/notificationService';
import { IntroWelcomeModal } from '../src/components/IntroWelcomeModal';


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

function AuthSuccessToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const translateY = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  const handleDismiss = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 160,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  useEffect(() => {
    isClosingRef.current = false;
    translateY.setValue(-16);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    const timer = setTimeout(() => {
      handleDismiss();
    }, 3800);

    return () => clearTimeout(timer);
  }, [message]);

  // Strip any emoji characters to guarantee clean typography
  const cleanMessage = message.replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, '').trim();

  return (
    <View style={styles.toastOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toastContainer,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={17} color="#10B981" />
        <Text style={styles.toastText}>{cleanMessage}</Text>
        <Pressable
          onPress={handleDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          style={({ pressed, hovered }: any) => [
            styles.toastCloseBtn,
            (pressed || hovered) && { opacity: 0.6 },
            Platform.OS === 'web' && { cursor: 'pointer' as any },
          ]}
        >
          <Ionicons name="close" size={15} color="#A1A1AA" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  useDocumentTitle();
  const router = useRouter();
  const authSuccessMessage = useUserStore((s) => s.authSuccessMessage);
  const clearAuthSuccessMessage = useUserStore((s) => s.clearAuthSuccessMessage);
  const globalBridgeRef = useRef<any>(null);

  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Handle local notification tap response & deep-linking directly into chapter/manga
  useEffect(() => {
    if (Platform.OS === 'web') return;

    try {
      const Notifications = getNotificationsModule();
      if (!Notifications) return;

      // 1. Cold start response (App opened from a closed state by tapping notification)
      Notifications.getLastNotificationResponseAsync?.().then((response: any) => {
        const data = response?.notification?.request?.content?.data;
        if (data?.chapterId) {
          router.push(`/reader/${data.chapterId}`);
        } else if (data?.mangaId) {
          router.push(`/manga/${data.mangaId}`);
        } else if (data?.url) {
          router.push(data.url);
        }
      }).catch(() => {});

      // 2. Foreground / background resume listener (App active or minimized when tapped)
      const subscription = Notifications.addNotificationResponseReceivedListener?.((response: any) => {
        const data = response?.notification?.request?.content?.data;
        if (data?.chapterId) {
          router.push(`/reader/${data.chapterId}`);
        } else if (data?.mangaId) {
          router.push(`/manga/${data.mangaId}`);
        } else if (data?.url) {
          router.push(data.url);
        }
      });

      return () => {
        subscription?.remove?.();
      };
    } catch (err) {
      console.warn('Failed to bind notification response listener:', err);
    }
  }, [router]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      webViewBridge.registerGlobalSender((script: string) => {
        globalBridgeRef.current?.injectJavaScript(script);
      });

      const unsubscribe = webViewBridge.onCloudflareSolved(() => {
        globalBridgeRef.current?.reload();
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

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
          {authSuccessMessage && (
            <AuthSuccessToast
              message={authSuccessMessage}
              onDismiss={clearAuthSuccessMessage}
            />
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

          {/* First-Install Introductory Welcome Screen (1-Tap) */}
          {Platform.OS !== 'web' && <IntroWelcomeModal />}

          {/* Persistent Global Background WebView for Cloudflare & MangaDot Authenticated Requests */}
          {Platform.OS !== 'web' && (
            <View
              style={{
                position: 'absolute',
                top: -9999,
                left: -9999,
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: 'none',
              }}
            >
              <WebView
                ref={globalBridgeRef}
                source={{ uri: 'https://mangadot.net/' }}
                userAgent={
                  Platform.OS === 'android'
                    ? 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
                    : DEFAULT_USER_AGENT
                }
                javaScriptEnabled={true}
                domStorageEnabled={true}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                onMessage={(event) => {
                  try {
                    const parsed = JSON.parse(event.nativeEvent.data);
                    webViewBridge.handleMessage(parsed);
                  } catch {}
                }}
              />
            </View>
          )}
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
    backgroundColor: '#18181B',
    borderWidth: 0,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  toastText: {
    color: '#FAFAFA',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  toastCloseBtn: {
    padding: 2,
    marginLeft: 2,
  },
});
