import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

/**
 * Lazy resolver for expo-notifications.
 * Prevents side-effect module loading (DevicePushTokenAutoRegistration) on startup inside Expo Go.
 */
function getNotificationsModule() {
  if (isExpoGo || Platform.OS === 'web') return null;
  try {
    return require('expo-notifications');
  } catch (err) {
    return null;
  }
}

// Safely configure notification foreground handler outside Expo Go
if (!isExpoGo && Platform.OS !== 'web') {
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
  } catch (err) {
    // Ignore in Expo Go environments
  }
}

/**
 * Request local push notification permissions safely
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web' || isExpoGo) return true;

  try {
    const Notifications = getNotificationsModule();
    if (!Notifications) return true;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('yomite_new_chapters', {
        name: 'New Manga Chapters',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E11D48',
      });
    }

    return true;
  } catch (err) {
    return true;
  }
}

/**
 * Fire a local push notification for a new chapter release
 */
export async function sendNewChapterNotification(params: {
  mangaTitle: string;
  chapterNum: string;
  mangaId: string;
  chapterId: string;
}): Promise<void> {
  if (isExpoGo) return;

  const { mangaTitle, chapterNum, mangaId, chapterId } = params;

  try {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📖 New Chapter Alert!`,
        body: `${mangaTitle} Ch. ${chapterNum} is now available to read on Yomite!`,
        data: { mangaId, chapterId },
        sound: true,
      },
      trigger: null,
    });
  } catch (err) {
    // Ignore
  }
}
