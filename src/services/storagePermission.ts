import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Prompt initial device storage permissions on app launch.
 *
 * Uses React Native's built-in PermissionsAndroid API instead of
 * expo-media-library, which requires a custom dev client and crashes
 * inside Expo Go (missing ExpoMediaLibraryNext native module).
 *
 * expo-file-system writes to the app's own documentDirectory by default,
 * which does NOT require external storage permissions. This helper is
 * a forward-looking guard for users who pick a custom SAF storage path.
 */
export async function requestStoragePermissionOnLaunch(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    // Android 13+ (API 33) uses granular media permissions
    const apiLevel = Platform.Version;

    if (typeof apiLevel === 'number' && apiLevel >= 33) {
      const result = await PermissionsAndroid.request(
        'android.permission.READ_MEDIA_IMAGES' as any,
        {
          title: 'Storage Permission',
          message: 'Yomite needs access to save and read downloaded manga chapters.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }

    // Android 12 and below
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'Yomite needs access to save downloaded manga chapters.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (_err) {
    // Gracefully swallow — app document directory works without this
    return true;
  }
}
