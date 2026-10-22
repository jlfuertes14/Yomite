/**
 * App Update Service — In-App Update Engine (Mihon / Tachiyomi Style)
 * Checks GitHub Releases API for Yomite updates, parses markdown changelogs,
 * manages APK downloads with live progress, and delegates installation to the Android Package Installer.
 *
 * Uses expo-file-system v2 class-based API (File, Directory, Paths, DownloadTask).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Directory, DownloadTask, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

export const GITHUB_REPO = 'jlfuertes14/Yomite';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const STORAGE_KEY_LAST_CHECK = 'yomite_last_app_update_check';
const STORAGE_KEY_IGNORED_VERSION = 'yomite_ignored_update_version';
const CHECK_CADENCE_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface AppReleaseInfo {
  version: string;
  tagName: string;
  releaseTitle: string;
  releaseNotes: string;
  downloadUrl: string;
  fileName: string;
  apkSize: number;
  publishedAt: string;
  htmlUrl: string;
}

export interface DownloadProgress {
  writtenBytes: number;
  totalBytes: number;
  fraction: number;
}

/**
 * Returns the currently running app version string (e.g. "1.2.9").
 */
export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

/**
 * Returns the latest published GitHub release tag, without requiring an APK asset.
 * This is used for displaying release metadata in the app update row.
 */
export async function getLatestGitHubReleaseVersion(): Promise<string | null> {
  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Yomite-App',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.tag_name) return null;

    return String(data.tag_name).trim().replace(/^v/i, '');
  } catch (error) {
    console.warn('[appUpdateService] Failed to fetch latest release version:', error);
    return null;
  }
}

/**
 * Compares two SemVer strings: returns true if remoteVersion > localVersion.
 */
export function isNewerVersion(remoteVersion: string, localVersion: string): boolean {
  const cleanRemote = remoteVersion.replace(/^v/i, '').trim();
  const cleanLocal = localVersion.replace(/^v/i, '').trim();

  const r = cleanRemote.split('.').map((n) => parseInt(n, 10) || 0);
  const l = cleanLocal.split('.').map((n) => parseInt(n, 10) || 0);

  const len = Math.max(r.length, l.length, 3);
  for (let i = 0; i < len; i++) {
    const rVal = r[i] ?? 0;
    const lVal = l[i] ?? 0;
    if (rVal > lVal) return true;
    if (rVal < lVal) return false;
  }
  return false;
}

/**
 * Checks GitHub Releases for a newer version of Yomite.
 * @param force Skip the 12-hour cadence and ignored-version checks (manual "Check for Updates").
 */
export async function checkForAppUpdates(force = false): Promise<AppReleaseInfo | null> {
  // Direct APK sideloading is Android-only
  if (Platform.OS !== 'android') return null;

  const now = Date.now();

  if (!force) {
    try {
      const lastCheckStr = await AsyncStorage.getItem(STORAGE_KEY_LAST_CHECK);
      if (lastCheckStr) {
        const lastCheck = parseInt(lastCheckStr, 10);
        if (now - lastCheck < CHECK_CADENCE_MS) return null;
      }
    } catch {
      // Storage errors are non-fatal
    }
  }

  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Yomite-App',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.tag_name) return null;

    // Persist last-check timestamp regardless of whether there's an update
    await AsyncStorage.setItem(STORAGE_KEY_LAST_CHECK, String(now)).catch(() => {});

    const tagName = String(data.tag_name).trim();
    const remoteVersion = tagName.replace(/^v/i, '');
    const currentVersion = getCurrentAppVersion();

    if (!isNewerVersion(remoteVersion, currentVersion)) return null;

    // Check if user previously dismissed this specific version
    if (!force) {
      const ignored = await AsyncStorage.getItem(STORAGE_KEY_IGNORED_VERSION).catch(() => null);
      if (ignored === remoteVersion) return null;
    }

    // Prefer arm64-v8a APK (smallest, works on ~98% of modern Android), fall back to universal
    const assets: any[] = Array.isArray(data.assets) ? data.assets : [];
    const apkAsset =
      assets.find((a) => typeof a.name === 'string' && a.name.includes('arm64-v8a.apk')) ||
      assets.find((a) => typeof a.name === 'string' && a.name.includes('universal.apk')) ||
      assets.find((a) => typeof a.name === 'string' && a.name.endsWith('.apk'));

    if (!apkAsset?.browser_download_url) return null;

    return {
      version: remoteVersion,
      tagName,
      releaseTitle: data.name || `Yomite v${remoteVersion}`,
      releaseNotes: data.body || 'No release notes provided for this version.',
      downloadUrl: apkAsset.browser_download_url,
      fileName: apkAsset.name || `Yomite-${remoteVersion}.apk`,
      apkSize: apkAsset.size || 0,
      publishedAt: data.published_at || new Date().toISOString(),
      htmlUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases/tag/${tagName}`,
    };
  } catch (error) {
    console.warn('[appUpdateService] Failed to check for app updates:', error);
    return null;
  }
}

/**
 * Marks a version as "ignored" so the user isn't prompted again on startup.
 */
export async function ignoreUpdateVersion(version: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_IGNORED_VERSION, version).catch(() => {});
}

/**
 * Downloads the APK to the app cache directory and fires the Android Package Installer.
 * Uses expo-file-system v2 (DownloadTask, File, Directory, Paths).
 */
export async function downloadAndInstallUpdate(
  release: AppReleaseInfo,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('In-app APK installation is only supported on Android.');
  }

  // Create (or reuse) a dedicated updates sub-directory inside the cache
  const updatesDir = new Directory(Paths.cache, 'updates');
  if (!updatesDir.exists) {
    updatesDir.create();
  }

  // Keep only the APK currently being prepared. Older release APKs are no
  // longer useful after the installer has been launched and can otherwise
  // accumulate in the app cache across releases.
  for (const entry of updatesDir.list()) {
    if (entry instanceof File && entry.name.endsWith('.apk') && entry.name !== release.fileName) {
      try {
        entry.delete();
      } catch {
        // Cache cleanup is best-effort and must not block an update.
      }
    }
  }

  const destFile = new File(updatesDir, release.fileName);

  // Remove stale/partial download for this filename
  if (destFile.exists) {
    destFile.delete();
  }

  // DownloadTask with onProgress — uses expo-file-system v2 DownloadTaskOptions
  const task = new DownloadTask(release.downloadUrl, destFile, {
    onProgress: (progress) => {
      const written = progress.bytesWritten ?? 0;
      const total =
        progress.totalBytes != null && progress.totalBytes > 0
          ? progress.totalBytes
          : release.apkSize || written;
      const fraction = total > 0 ? Math.min(Math.max(written / total, 0), 1) : 0;

      onProgress?.({ writtenBytes: written, totalBytes: total, fraction });
    },
  });

  const downloadedFile = await task.downloadAsync();
  if (!downloadedFile) {
    throw new Error('Download was paused or cancelled before completing.');
  }

  // getContentUriAsync converts the file:// URI to a content:// URI that
  // the Android Package Installer can securely access via FileProvider.
  const contentUri = await getContentUriAsync(downloadedFile.uri);

  // Fire the native package installer intent
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
