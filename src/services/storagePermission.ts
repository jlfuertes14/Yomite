import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export const YOMITE_DOWNLOAD_FOLDER = 'Yomite';

/** Creates Yomite's private download folder during first app startup. */
export async function ensureYomiteDownloadFolder(): Promise<boolean> {
  if (Platform.OS === 'web') return true;

  try {
    const documentDirectory = (FileSystem as any).documentDirectory || '';
    if (!documentDirectory) return false;

    const folderUri = `${documentDirectory}${YOMITE_DOWNLOAD_FOLDER}/`;
    const info = await FileSystem.getInfoAsync(folderUri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
    }
    return true;
  } catch (error) {
    console.warn('[storage] Could not create the Yomite download folder:', error);
    return false;
  }
}

/**
 * Initializes Yomite's app-private download folder.
 * Custom shared folders request access later through Android's SAF picker.
 */
export async function requestStoragePermissionOnLaunch(): Promise<boolean> {
  return ensureYomiteDownloadFolder();
}
