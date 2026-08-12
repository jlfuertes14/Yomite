import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

/**
 * Prompt initial device storage & media permissions on app launch
 */
export async function requestStoragePermissionOnLaunch(): Promise<boolean> {
  if (Platform.OS === 'web') return true;

  try {
    // Pass false so MediaLibrary does NOT request audio permissions
    const permissions = await MediaLibrary.getPermissionsAsync(false);
    if (permissions.status !== 'granted') {
      const response = await MediaLibrary.requestPermissionsAsync(false);
      return response.granted;
    }
    return true;
  } catch (err) {
    // Gracefully handle missing audio permission in manifest / Expo Go
    return true;
  }
}
