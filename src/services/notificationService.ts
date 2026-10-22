import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Asset } from 'expo-asset';

const isExpoGoClient = (): boolean => {
  if (Platform.OS === 'web') return false;
  try {
    const { requireNativeModule } = require('expo-modules-core');
    if (requireNativeModule && requireNativeModule('ExpoGo') != null) {
      return true;
    }
  } catch {}

  try {
    return (
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      (Constants as any).appOwnership === 'expo'
    );
  } catch {}

  return false;
};

export const isExpoGo = isExpoGoClient;

export const NOTIFICATION_CHANNEL_ID = 'yomite_chapter_updates';
export const RELEASE_SERVICE_URL = 'https://yomite-parsers.onrender.com';
const LAST_APP_UPDATE_NOTIFICATION_KEY = '@yomite_last_app_update_notification';
const RELEASE_PUSH_TOKEN_KEY = '@yomite_release_push_token';

let cachedIconUri: string | null = null;
let cachedNotificationsModule: any = undefined;

/**
 * Resolves local file URI for the Yomite app icon asset to attach to notifications
 */
export async function getAppIconLocalUri(): Promise<string | null> {
  if (cachedIconUri) return cachedIconUri;
  if (Platform.OS === 'web') return null;

  try {
    const iconAsset =
      Platform.OS === 'android'
        ? require('../../assets/images/android-icon-monochrome.png')
        : require('../../assets/images/icon.png');
    const asset = Asset.fromModule(iconAsset);
    if (!asset.localUri) {
      await asset.downloadAsync();
    }
    cachedIconUri = asset.localUri || asset.uri || null;
    return cachedIconUri;
  } catch (err) {
    console.warn('Failed to resolve notification icon asset:', err);
    return null;
  }
}

/**
 * Lazy resolver for expo-notifications.
 * Prevents side-effect module loading on unsupported platforms or during web SSR.
 * 
 * Critical Expo SDK 53+ safeguard:
 * In Expo Go on Android, remote push notifications were removed. Requiring 'expo-notifications'
 * evaluates DevicePushTokenAutoRegistration.fx which calls warnOfExpoGoPushUsage() and throws:
 * "Android Push notifications (remote notifications) functionality provided by expo-notifications
 * was removed from Expo Go with the release of SDK 53".
 * 
 * To allow local notifications (chapter updates, test alerts) to work seamlessly in Expo Go
 * without crashing, we resolve only the local notification submodules.
 * In a standalone APK or EAS development build, require('expo-notifications') is loaded directly.
 */
export function getNotificationsModule(): any {
  if (Platform.OS === 'web') return null;
  if (cachedNotificationsModule !== undefined) return cachedNotificationsModule;

  if (Platform.OS === 'android' && isExpoGo()) {
    try {
      const scheduleMod = require('expo-notifications/build/scheduleNotificationAsync');
      const channelMod = require('expo-notifications/build/setNotificationChannelAsync');
      const handlerMod = require('expo-notifications/build/NotificationsHandler');
      const emitterMod = require('expo-notifications/build/NotificationsEmitter');
      const permsMod = require('expo-notifications/build/NotificationPermissions');
      const typesMod = require('expo-notifications/build/NotificationChannelManager.types');

      let cancelScheduledNotificationAsync: any = null;
      let cancelAllScheduledNotificationsAsync: any = null;
      try {
        cancelScheduledNotificationAsync =
          require('expo-notifications/build/cancelScheduledNotificationAsync')?.cancelScheduledNotificationAsync;
        cancelAllScheduledNotificationsAsync =
          require('expo-notifications/build/cancelAllScheduledNotificationsAsync')?.cancelAllScheduledNotificationsAsync;
      } catch {}

      cachedNotificationsModule = {
        scheduleNotificationAsync: scheduleMod?.scheduleNotificationAsync,
        cancelScheduledNotificationAsync,
        cancelAllScheduledNotificationsAsync,
        setNotificationChannelAsync: channelMod?.setNotificationChannelAsync,
        getNotificationChannelsAsync: channelMod?.getNotificationChannelsAsync,
        setNotificationHandler: handlerMod?.setNotificationHandler,
        addNotificationResponseReceivedListener: emitterMod?.addNotificationResponseReceivedListener,
        getLastNotificationResponseAsync: emitterMod?.getLastNotificationResponseAsync,
        requestPermissionsAsync: permsMod?.requestPermissionsAsync,
        getPermissionsAsync: permsMod?.getPermissionsAsync,
        AndroidImportance: typesMod?.AndroidImportance || {
          UNKNOWN: 0,
          NONE: 1,
          MIN: 2,
          LOW: 3,
          DEFAULT: 4,
          HIGH: 5,
          MAX: 5,
        },
      };
      return cachedNotificationsModule;
    } catch (subErr) {
      console.warn('[Yomite] Expo Go local notification submodules unavailable:', subErr);
      cachedNotificationsModule = null;
      return null;
    }
  }

  try {
    cachedNotificationsModule = require('expo-notifications');
    return cachedNotificationsModule;
  } catch (err) {
    console.warn('[Yomite] Failed to load expo-notifications module:', err);
    cachedNotificationsModule = null;
    return null;
  }
}

// Safely configure notification foreground behavior outside web
if (Platform.OS !== 'web') {
  try {
    const Notifications = getNotificationsModule();
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch {
    // Ignore in unsupported environments
  }
}

/**
 * Setup notification channels on Android
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const Notifications = getNotificationsModule();
    if (!Notifications?.setNotificationChannelAsync) return;

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Chapter Updates',
      description: 'Alerts when new chapters are available for manga in your reading list',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E11D48',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  } catch (err) {
    console.warn('Failed to configure Android notification channel:', err);
  }
}

/**
 * Request notification permissions safely
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const Notifications = getNotificationsModule();
    if (!Notifications) return false;

    // Android 13+ does not show the permission prompt until a channel exists.
    await setupNotificationChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Failed to request notification permissions:', err);
    return false;
  }
}

/**
 * Check if notifications are currently permitted
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const Notifications = getNotificationsModule();
    if (!Notifications) return false;
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Registers the opted-in device with the Yomite release service. Remote push
 * tokens are intentionally not requested in Expo Go on Android.
 */
export async function registerReleasePushSubscription(appVersion: string): Promise<boolean> {
  if (Platform.OS !== 'android' || isExpoGo() || !(await checkNotificationPermissions())) return false;

  try {
    const Notifications = getNotificationsModule();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!Notifications?.getExpoPushTokenAsync || !projectId) return false;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenResponse?.data;
    if (!pushToken) return false;

    const response = await fetch(`${RELEASE_SERVICE_URL}/api/releases/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pushToken,
        platform: 'android',
        channel: 'stable',
        appVersion,
      }),
    });
    if (!response.ok) return false;

    await AsyncStorage.setItem(RELEASE_PUSH_TOKEN_KEY, pushToken).catch(() => {});
    return true;
  } catch (err) {
    console.warn('[Yomite] Failed to subscribe to release notifications:', err);
    return false;
  }
}

export async function unregisterReleasePushSubscription(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const pushToken = await AsyncStorage.getItem(RELEASE_PUSH_TOKEN_KEY);
    if (!pushToken) return true;

    const response = await fetch(`${RELEASE_SERVICE_URL}/api/releases/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pushToken }),
    });
    if (!response.ok) return false;

    await AsyncStorage.removeItem(RELEASE_PUSH_TOKEN_KEY).catch(() => {});
    return true;
  } catch (err) {
    console.warn('[Yomite] Failed to unsubscribe from release notifications:', err);
    return false;
  }
}

/**
 * Announces a newly detected app release to users who opted into notifications.
 * The same release is only announced once on a device.
 */
export async function sendAppUpdateNotification(params: {
  version: string;
  releaseTitle?: string;
  releaseNotes?: string;
}): Promise<boolean> {
  if (Platform.OS === 'web' || !(await checkNotificationPermissions())) return false;

  try {
    const lastNotifiedVersion = await AsyncStorage.getItem(LAST_APP_UPDATE_NOTIFICATION_KEY);
    if (lastNotifiedVersion === params.version) return false;

    const Notifications = getNotificationsModule();
    if (!Notifications?.scheduleNotificationAsync) return false;

    await setupNotificationChannel();
    const appIconUri = await getAppIconLocalUri();
    const summary = params.releaseTitle || `Yomite v${params.version} is now available.`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Yomite v${params.version} is available`,
        body: summary,
        data: { type: 'app-update', version: params.version, url: '/(tabs)/more' },
        color: '#E11D48',
        sound: 'default',
        channelId: NOTIFICATION_CHANNEL_ID,
        badge: 1,
        attachments: appIconUri
          ? [{ identifier: 'yomite-app-icon', url: appIconUri, typeHint: 'public.png' }]
          : undefined,
      },
      trigger: null,
    });

    await AsyncStorage.setItem(LAST_APP_UPDATE_NOTIFICATION_KEY, params.version);
    return true;
  } catch (err) {
    console.warn('Failed to dispatch app update notification:', err);
    return false;
  }
}

export interface ChapterNotificationPayload {
  mangaTitle: string;
  chapterNum: string;
  mangaId: string;
  chapterId: string;
  sourceName?: string;
}

/**
 * Fire a local push notification for a single new chapter release (with app icon)
 */
export async function sendNewChapterNotification(params: ChapterNotificationPayload): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { mangaTitle, chapterNum, mangaId, chapterId, sourceName } = params;
  const sourceLabel = sourceName ? ` on ${sourceName}` : '';

  try {
    const Notifications = getNotificationsModule();
    if (!Notifications?.scheduleNotificationAsync) return false;

    await setupNotificationChannel();
    const appIconUri = await getAppIconLocalUri();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${mangaTitle} Ch. ${chapterNum} Out!`,
        body: `Chapter ${chapterNum} just dropped${sourceLabel} — Read Now.`,
        data: {
          url: `/reader/${chapterId}?mangaId=${mangaId}`,
          mangaId,
          chapterId,
        },
        color: '#E11D48',
        sound: 'default',
        channelId: NOTIFICATION_CHANNEL_ID,
        badge: 1,
        attachments: appIconUri
          ? [
              {
                identifier: 'yomite-app-icon',
                url: appIconUri,
                typeHint: 'public.png',
              },
            ]
          : undefined,
      },
      trigger: null,
    });
    return true;
  } catch (err) {
    console.warn('Failed to dispatch chapter notification:', err);
    return false;
  }
}

/**
 * Fire a consolidated local notification when multiple manga updated in background (with app icon)
 */
export async function sendBatchChapterNotification(params: {
  totalCount: number;
  titles: string[];
  firstMangaId?: string;
  firstChapterId?: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { totalCount, titles, firstMangaId, firstChapterId } = params;
  if (totalCount <= 0) return false;

  try {
    const Notifications = getNotificationsModule();
    if (!Notifications?.scheduleNotificationAsync) return false;

    await setupNotificationChannel();
    const appIconUri = await getAppIconLocalUri();

    const previewTitles = titles.slice(0, 3).join(', ');
    const moreSuffix = titles.length > 3 ? ` and ${titles.length - 3} more` : '';
    const body = `${totalCount} new ${totalCount === 1 ? 'chapter is' : 'chapters are'} available across your Library (${previewTitles}${moreSuffix}).`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Library Updates Available',
        body,
        data: {
          url: firstChapterId && firstMangaId ? `/reader/${firstChapterId}?mangaId=${firstMangaId}` : '/library',
          mangaId: firstMangaId || null,
          chapterId: firstChapterId || null,
        },
        color: '#E11D48',
        sound: 'default',
        channelId: NOTIFICATION_CHANNEL_ID,
        badge: 1,
        attachments: appIconUri
          ? [
              {
                identifier: 'yomite-app-icon',
                url: appIconUri,
                typeHint: 'public.png',
              },
            ]
          : undefined,
      },
      trigger: null,
    });
    return true;
  } catch (err) {
    console.warn('Failed to dispatch batch chapter notification:', err);
    return false;
  }
}
