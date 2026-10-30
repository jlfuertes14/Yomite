import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, Pressable, Platform, StyleSheet, Animated, Easing } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/Colors';
import { requestStoragePermissionOnLaunch } from '../src/services/storagePermission';
import { useUserStore } from '../src/store/userStore';
import { CacheManager } from '../src/utils/cacheManager';
import { useDocumentTitle } from '../src/utils/useDocumentTitle';
import { webViewBridge } from '../src/sources/network/webViewBridge';
import { DEFAULT_USER_AGENT } from '../src/sources/network/httpClient';
import {
  getNotificationsModule,
  registerReleasePushSubscription,
  requestNotificationPermissions,
} from '../src/services/notificationService';
import { IntroWelcomeModal } from '../src/components/IntroWelcomeModal';
import { AppUpdateModal } from '../src/components/AppUpdateModal';
import { checkForAppUpdates, AppReleaseInfo, getCurrentAppVersion } from '../src/services/appUpdateService';
import { useColorScheme } from '../src/hooks/useColorScheme';
import { useThemeColors } from '../src/hooks/useThemeColor';


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
  let insetsTop = 0;
  try {
    const insets = useSafeAreaInsets();
    insetsTop = insets?.top || 0;
  } catch (_) {
    insetsTop = 0;
  }

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
    }, 2500);

    return () => clearTimeout(timer);
  }, [message]);

  // Strip any emoji characters to guarantee clean typography
  const cleanMessage = message.replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, '').trim();
  const isSignOut = cleanMessage.toLowerCase().includes('sign out') || cleanMessage.toLowerCase().includes('signed out');

  return (
    <View
      style={[
        styles.toastOverlay,
        { top: Platform.OS === 'web' ? 16 : Math.max(insetsTop + 8, 48) },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.toastContainer,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Ionicons
          name={isSignOut ? 'log-out-outline' : 'checkmark-circle'}
          size={17}
          color={isSignOut ? '#A1A1AA' : '#10B981'}
        />
        <Text style={styles.toastText}>{cleanMessage}</Text>
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  useDocumentTitle();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const themeColors = useThemeColors();
  const isDark = colorScheme === 'dark';
  const authSuccessMessage = useUserStore((s) => s.authSuccessMessage);
  const clearAuthSuccessMessage = useUserStore((s) => s.clearAuthSuccessMessage);
  const globalBridgeRef = useRef<any>(null);
  const templetoonsBridgeRef = useRef<any>(null);

  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [updateRelease, setUpdateRelease] = useState<AppReleaseInfo | null>(null);
  const lastUpdateCheckAtRef = useRef(0);

  // Check on every Android app open. The service still protects manual/background
  // checks with its cadence, but an existing installation must be able to see a
  // newly published release immediately after it is opened.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const checkOnOpen = () => {
      // Avoid duplicate requests from the initial timer and the first active
      // AppState event while still checking again after a real resume.
      if (Date.now() - lastUpdateCheckAtRef.current < 5000) return;
      lastUpdateCheckAtRef.current = Date.now();
      checkForAppUpdates(false, { ignoreCadence: true })
        .then((release) => {
          if (release) {
            setUpdateRelease(release);
          }
        })
        .catch(() => {});
    };

    const timer = setTimeout(checkOnOpen, 3500);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkOnOpen();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  // Handle local notification tap response & deep-linking directly into chapter/manga
  useEffect(() => {
    if (Platform.OS === 'web') return;

    try {
      const Notifications = getNotificationsModule();
      if (!Notifications) return;

      const handleNotificationData = (data: any) => {
        if (data?.type === 'app-update') {
          checkForAppUpdates(true)
            .then((release) => {
              if (release) setUpdateRelease(release);
            })
            .catch(() => {});
          return;
        }

        if (data?.chapterId) {
          router.push(`/reader/${data.chapterId}`);
        } else if (data?.mangaId) {
          router.push(`/manga/${data.mangaId}`);
        } else if (data?.url) {
          router.push(data.url);
        }
      };

      // 1. Cold start response (App opened from a closed state by tapping notification)
      Notifications.getLastNotificationResponseAsync?.().then((response: any) => {
        const data = response?.notification?.request?.content?.data;
        handleNotificationData(data);
      }).catch(() => {});

      // 2. Foreground / background resume listener (App active or minimized when tapped)
      const subscription = Notifications.addNotificationResponseReceivedListener?.((response: any) => {
        const data = response?.notification?.request?.content?.data;
        handleNotificationData(data);
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

      webViewBridge.registerDomainSender('templetoons.com', (script: string) => {
        templetoonsBridgeRef.current?.injectJavaScript(script);
      });

      const unsubscribe = webViewBridge.onCloudflareSolved((domain) => {
        globalBridgeRef.current?.reload();
        if (domain === 'templetoons.com') {
          templetoonsBridgeRef.current?.reload();
        }
      });

      return () => {
        unsubscribe();
        webViewBridge.unregisterDomainSender('templetoons.com');
      };
    }
  }, []);

  useEffect(() => {
    // Keep the Android system/status-bar area aligned with the active app theme.
    SystemUI.setBackgroundColorAsync(themeColors.background).catch(() => {});
  }, [themeColors.background]);

  useEffect(() => {
    const initializeAppPermissions = async () => {
      CacheManager.cleanLegacyStorageCache();
      await requestStoragePermissionOnLaunch();

      // Request notification permission on the first native app launch. The
      // service is idempotent, so Android will not show the prompt repeatedly;
      // once granted, the device is also subscribed to server release alerts.
      const notificationsGranted = await requestNotificationPermissions();
      if (notificationsGranted) {
        await registerReleasePushSubscription(getCurrentAppVersion());
      }

      useUserStore.getState().initializeAuth();
    };

    initializeAppPermissions().catch(() => {
      useUserStore.getState().initializeAuth();
    });
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
        <StatusBar
          style={isDark ? 'light' : 'dark'}
        />
        <View
          style={
            Platform.OS === 'web'
              ? styles.webGlobalContainer
              : styles.nativeGlobalContainer
          }
        >
          <Stack
            id="root"
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
              name="auth/login"
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
          {authSuccessMessage && (
            <AuthSuccessToast
              message={authSuccessMessage}
              onDismiss={clearAuthSuccessMessage}
            />
          )}

          {/* First-Install Introductory Welcome Screen (1-Tap) */}
          {Platform.OS !== 'web' && <IntroWelcomeModal />}

          {/* GitHub Release App Update Modal (Mihon / Tachiyomi In-App Install) */}
          {Platform.OS !== 'web' && (
            <AppUpdateModal
              visible={Boolean(updateRelease)}
              release={updateRelease}
              onDismiss={() => setUpdateRelease(null)}
            />
          )}

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

          {/* Persistent TempleToons session for same-origin requests after Cloudflare verification */}
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
                ref={templetoonsBridgeRef}
                source={{ uri: 'https://templetoons.com/' }}
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
