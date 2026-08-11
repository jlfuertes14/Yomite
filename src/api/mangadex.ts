/**
 * MangaDex API v5 Service
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * IMPORTANT API RULES (from official docs):
 *
 * 1. User-Agent header is REQUIRED on every request.
 * 2. Global rate limit: ~5 req/sec per IP.
 * 3. GET /at-home/server/{id}: 40 req/min.
 * 4. offset + limit CANNOT exceed 10,000.
 * 5. DO NOT send auth headers to image domains
 *    (uploads.mangadex.org, *.mangadex.network).
 * 6. baseUrl from /at-home/server is valid for ~15 minutes.
 * 7. Authentication: OAuth2 via personal client POST form
 *    to auth.mangadex.org (application/x-www-form-urlencoded).
 * 8. CORS is blocked for non-MangaDex origins — but React
 *    Native runs natively so CORS does NOT apply to us.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Manga,
  Chapter,
  ChapterPages,
  MangaDexResponse,
  MangaTag,
  SearchFilters,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────

const API_BASE = 'https://api.mangadex.org';
const AUTH_BASE = 'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token';
const COVERS_BASE = 'https://uploads.mangadex.org/covers';
const APP_USER_AGENT = 'MangaReaderApp/1.0.0';

// Auth token storage keys
const TOKEN_KEYS = {
  access: 'mangadex_access_token',
  refresh: 'mangadex_refresh_token',
  expiry: 'mangadex_token_expiry',
  clientId: 'mangadex_client_id',
  clientSecret: 'mangadex_client_secret',
};

// ─── API Instance ─────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'User-Agent': APP_USER_AGENT,  // REQUIRED by MangaDex
  },
});

// Request interceptor: inject auth token when available
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Never send auth headers to image servers
  const url = config.url ?? '';
  if (url.includes('uploads.mangadex.org') || url.includes('mangadex.network')) {
    delete config.headers?.['Authorization'];
    return config;
  }

  const token = await getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Response interceptor: auto-retry on network errors/5xx/429 & auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original) return Promise.reject(error);

    // Auto-retry up to 3 times on network errors or 5xx/429 status codes
    if (!original._retryCount) original._retryCount = 0;
    if (
      original._retryCount < 3 &&
      (!error.response || error.response.status === 429 || error.response.status >= 500)
    ) {
      original._retryCount += 1;
      const delay = Math.pow(2, original._retryCount) * 600;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(original);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        if (!original.headers) original.headers = {};
        original.headers['Authorization'] = `Bearer ${refreshed}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Authentication (OAuth2 Personal Client) ──────────────────────

export async function login(
  username: string,
  password: string,
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  try {
    // Save client credentials for refresh flow
    await AsyncStorage.setItem(TOKEN_KEYS.clientId, clientId);
    await AsyncStorage.setItem(TOKEN_KEYS.clientSecret, clientSecret);

    // OAuth2 password grant — MUST be form-urlencoded, NOT JSON
    const formData = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString();

    const res = await axios.post(AUTH_BASE, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': APP_USER_AGENT,
      },
    });

    const { access_token, refresh_token, expires_in } = res.data;
    const expiry = Date.now() + (expires_in ?? 900) * 1000; // default 15 min

    await AsyncStorage.setItem(TOKEN_KEYS.access, access_token);
    if (refresh_token) await AsyncStorage.setItem(TOKEN_KEYS.refresh, refresh_token);
    await AsyncStorage.setItem(TOKEN_KEYS.expiry, expiry.toString());

    return true;
  } catch (err) {
    console.error('MangaDex login failed:', err);
    return false;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await AsyncStorage.getItem(TOKEN_KEYS.refresh);
    const clientId = await AsyncStorage.getItem(TOKEN_KEYS.clientId);
    const clientSecret = await AsyncStorage.getItem(TOKEN_KEYS.clientSecret);

    if (!refreshToken || !clientId || !clientSecret) return null;

    const formData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString();

    const res = await axios.post(AUTH_BASE, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': APP_USER_AGENT,
      },
    });

    const { access_token, refresh_token: newRefresh, expires_in } = res.data;
    const expiry = Date.now() + (expires_in ?? 900) * 1000;

    await AsyncStorage.setItem(TOKEN_KEYS.access, access_token);
    await AsyncStorage.setItem(TOKEN_KEYS.expiry, expiry.toString());
    if (newRefresh) {
      await AsyncStorage.setItem(TOKEN_KEYS.refresh, newRefresh);
    }

    return access_token;
  } catch (err) {
    console.error('Token refresh failed:', err);
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(TOKEN_KEYS.access);
  const expiry = await AsyncStorage.getItem(TOKEN_KEYS.expiry);
  if (!token) return null;

  // Token expired? Refresh it
  if (expiry && Date.now() > parseInt(expiry, 10)) {
    return refreshAccessToken();
  }
  return token;
}

export async function logout(): Promise<void> {
  await Promise.all(Object.values(TOKEN_KEYS).map((k) => AsyncStorage.removeItem(k)));
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

// ─── Cover Art Helpers ────────────────────────────────────────────
// Format: https://uploads.mangadex.org/covers/:mangaId/:filename.{256,512}.jpg
// The full original filename is kept — thumbnail suffix is appended after the extension.

export function getCoverUrl(
  mangaId: string,
  coverFileName: string | null,
  size: '256' | '512' | 'original' = '512'
): string | null {
  if (!coverFileName) return null;
  const suffix = size === 'original' ? '' : `.${size}.jpg`;
  return `${COVERS_BASE}/${mangaId}/${coverFileName}${suffix}`;
}

export function extractCoverFileName(manga: Manga): string | null {
  const coverRel = manga.relationships.find((r) => r.type === 'cover_art');
  return coverRel?.attributes?.fileName ?? null;
}

export function extractAuthorName(manga: Manga): string {
  const author = manga.relationships.find((r) => r.type === 'author');
  return author?.attributes?.name ?? 'Unknown';
}

export function extractArtistName(manga: Manga): string {
  const artist = manga.relationships.find((r) => r.type === 'artist');
  return artist?.attributes?.name ?? 'Unknown';
}

export function extractScanlationGroupName(chapter: Chapter): string {
  const group = chapter.relationships?.find((r) => r.type === 'scanlation_group');
  return group?.attributes?.name ?? 'No Scanlation Group';
}

export function extractUploaderUsername(chapter: Chapter): string {
  const user = chapter.relationships?.find((r) => r.type === 'user');
  return user?.attributes?.username ?? 'Anonymous Uploader';
}

export function getMangaTitle(manga: Manga): string {
  const titles = manga.attributes.title;
  return titles.en ?? titles['ja-ro'] ?? titles.ja ?? Object.values(titles)[0] ?? 'Untitled';
}

export function getMangaDescription(manga: Manga): string {
  const desc = manga.attributes.description;
  return desc.en ?? Object.values(desc)[0] ?? '';
}

// ─── Search & Discovery ──────────────────────────────────────────
// Pornographic titles hidden by default.
// Default order: latestUploadedChapter desc.
// Tag filtering: includedTags mode = AND, excludedTags mode = OR.

export async function searchManga(
  filters: SearchFilters,
  limit = 20,
  offset = 0
): Promise<{ data: Manga[]; total: number }> {
  // API rule: offset + limit must not exceed 10,000
  if (offset + limit > 10000) {
    offset = Math.max(0, 10000 - limit);
  }

  const params: Record<string, any> = {
    limit,
    offset,
    includes: ['cover_art', 'author', 'artist'],
    'contentRating[]': filters.contentRating ?? ['safe', 'suggestive'],
  };

  if (filters.title) params.title = filters.title;
  if (filters.includedTags?.length) params['includedTags[]'] = filters.includedTags;
  if (filters.excludedTags?.length) params['excludedTags[]'] = filters.excludedTags;
  if (filters.status?.length) params['status[]'] = filters.status;
  if (filters.publicationDemographic?.length)
    params['publicationDemographic[]'] = filters.publicationDemographic;
  if (filters.translatedLanguage?.length)
    params['availableTranslatedLanguages[]'] = filters.translatedLanguage;

  if (filters.sort) {
    const order = filters.order ?? 'desc';
    params[`order[${filters.sort}]`] = order;
  }

  const res = await api.get<MangaDexResponse<Manga[]>>('/manga', { params });
  return { data: res.data.data, total: res.data.total ?? 0 };
}

export async function getPopularManga(limit = 10): Promise<Manga[]> {
  const res = await api.get<MangaDexResponse<Manga[]>>('/manga', {
    params: {
      limit,
      includes: ['cover_art', 'author', 'artist'],
      'contentRating[]': ['safe', 'suggestive'],
      'order[followedCount]': 'desc',
      hasAvailableChapters: true,
    },
  });
  return res.data.data;
}

export async function getLatestUpdates(limit = 20): Promise<Manga[]> {
  const res = await api.get<MangaDexResponse<Manga[]>>('/manga', {
    params: {
      limit,
      includes: ['cover_art', 'author', 'artist'],
      'contentRating[]': ['safe', 'suggestive'],
      'order[latestUploadedChapter]': 'desc',
      hasAvailableChapters: true,
    },
  });
  return res.data.data;
}

export async function getRecentlyAdded(limit = 20): Promise<Manga[]> {
  const res = await api.get<MangaDexResponse<Manga[]>>('/manga', {
    params: {
      limit,
      includes: ['cover_art', 'author', 'artist'],
      'contentRating[]': ['safe', 'suggestive'],
      'order[createdAt]': 'desc',
      hasAvailableChapters: true,
    },
  });
  return res.data.data;
}

export async function getRandomManga(): Promise<Manga> {
  // Rate limit: 60 req/min for /manga/random
  const res = await api.get<MangaDexResponse<Manga>>('/manga/random', {
    params: {
      includes: ['cover_art', 'author', 'artist'],
      'contentRating[]': ['safe', 'suggestive'],
    },
  });
  return res.data.data;
}

// ─── Manga Details ───────────────────────────────────────────────

export async function getMangaDetails(mangaId: string): Promise<Manga> {
  const res = await api.get<MangaDexResponse<Manga>>(`/manga/${mangaId}`, {
    params: { includes: ['cover_art', 'author', 'artist'] },
  });
  return res.data.data;
}

export async function getChapterDetails(chapterId: string): Promise<Chapter> {
  const res = await api.get<MangaDexResponse<Chapter>>(`/chapter/${chapterId}`, {
    params: { includes: ['manga', 'scanlation_group'] },
  });
  return res.data.data;
}

// ─── Manga Statistics ────────────────────────────────────────────

export interface MangaStatistics {
  rating: {
    average: number | null;
    bayesian: number | null;
    distribution: Record<string, number>;
  };
  follows: number;
  comments?: {
    threadId: number;
    repliesCount: number;
  } | null;
}

export async function getMangaStatistics(
  mangaId: string
): Promise<MangaStatistics | null> {
  try {
    const res = await api.get(`/statistics/manga/${mangaId}`);
    return res.data.statistics?.[mangaId] ?? null;
  } catch {
    return null;
  }
}

export async function getBatchMangaStatistics(
  mangaIds: string[]
): Promise<Record<string, MangaStatistics>> {
  if (!mangaIds || mangaIds.length === 0) return {};
  try {
    const params = new URLSearchParams();
    mangaIds.forEach((id) => params.append('manga[]', id));
    const res = await api.get(`/statistics/manga?${params.toString()}`);
    return res.data.statistics ?? {};
  } catch {
    return {};
  }
}

// ─── Chapters ────────────────────────────────────────────────────
// Uses /manga/{id}/feed (recommended by docs) instead of /chapter?manga=
// Supports: translatedLanguage, order, includeEmptyPages,
// includeFuturePublishAt, includeExternalUrl filters.

export async function getMangaChapters(
  mangaId: string,
  language = 'en',
  limit = 100,
  offset = 0,
  order: 'asc' | 'desc' = 'asc'
): Promise<{ data: Chapter[]; total: number }> {
  // Clamp to API max: offset + limit <= 10,000
  if (offset + limit > 10000) {
    offset = Math.max(0, 10000 - limit);
  }

  const res = await api.get<MangaDexResponse<Chapter[]>>(`/manga/${mangaId}/feed`, {
    params: {
      'translatedLanguage[]': [language],
      limit: Math.min(limit, 500), // feed endpoints allow up to 500
      offset,
      includes: ['scanlation_group', 'user'],
      'order[chapter]': order,
      'contentRating[]': ['safe', 'suggestive'],
      includeExternalUrl: 0, // exclude external-only chapters
    },
  });
  return { data: res.data.data, total: res.data.total ?? 0 };
}

// ─── Chapter Pages (MangaDex@Home) ──────────────────────────────
// Rate limit: 40 req/min for /at-home/server/{id}
// baseUrl validity: ~15 minutes (re-fetch if 403 on image load)
// DO NOT send auth headers when fetching images from baseUrl.
// URL format: baseUrl/quality/chapterHash/filename

export async function getChapterPages(
  chapterId: string,
  dataSaver = false
): Promise<{ pages: string[]; hash: string; baseUrl: string }> {
  const res = await api.get<{ baseUrl: string; chapter: ChapterPages['chapter'] }>(
    `/at-home/server/${chapterId}`
  );
  const { baseUrl, chapter } = res.data;
  const quality = dataSaver ? 'data-saver' : 'data';
  const files = dataSaver ? chapter.dataSaver : chapter.data;
  const pages = files.map((f) => `${baseUrl}/${quality}/${chapter.hash}/${f}`);
  return { pages, hash: chapter.hash, baseUrl };
}

// ─── Authenticated Endpoints ─────────────────────────────────────

// Set reading status (requires auth)
export async function setMangaReadingStatus(
  mangaId: string,
  status: 'reading' | 'on_hold' | 'plan_to_read' | 'dropped' | 're_reading' | 'completed' | null
): Promise<boolean> {
  try {
    await api.post(`/manga/${mangaId}/status`, { status });
    return true;
  } catch {
    return false;
  }
}

// Follow manga (requires auth)
export async function followManga(mangaId: string): Promise<boolean> {
  try {
    await api.post(`/manga/${mangaId}/follow`);
    return true;
  } catch {
    return false;
  }
}

// Unfollow manga (requires auth)
export async function unfollowManga(mangaId: string): Promise<boolean> {
  try {
    await api.delete(`/manga/${mangaId}/follow`);
    return true;
  } catch {
    return false;
  }
}

// Get followed manga feed (requires auth)
export async function getFollowedMangaFeed(
  limit = 100,
  offset = 0
): Promise<{ data: Chapter[]; total: number }> {
  const res = await api.get<MangaDexResponse<Chapter[]>>('/user/follows/manga/feed', {
    params: {
      limit: Math.min(limit, 500),
      offset,
      'translatedLanguage[]': ['en'],
      'order[publishAt]': 'desc',
      includes: ['scanlation_group', 'manga'],
    },
  });
  return { data: res.data.data, total: res.data.total ?? 0 };
}

// Mark chapter as read (requires auth)
export async function markChapterRead(chapterId: string): Promise<boolean> {
  try {
    await api.post(`/chapter/${chapterId}/read`);
    return true;
  } catch {
    return false;
  }
}

// ─── Tags ────────────────────────────────────────────────────────

export async function getTags(): Promise<MangaTag[]> {
  const res = await api.get<MangaDexResponse<MangaTag[]>>('/manga/tag');
  return res.data.data;
}

// ─── URL Parsing ─────────────────────────────────────────────────

const MANGADEX_TITLE_REGEX = /mangadex\.org\/title\/([a-f0-9-]+)/i;
const MANGADEX_CHAPTER_REGEX = /mangadex\.org\/chapter\/([a-f0-9-]+)/i;

export function parseMangaDexUrl(url: string): { type: 'title' | 'chapter'; id: string } | null {
  const titleMatch = url.match(MANGADEX_TITLE_REGEX);
  if (titleMatch) return { type: 'title', id: titleMatch[1] };

  const chapterMatch = url.match(MANGADEX_CHAPTER_REGEX);
  if (chapterMatch) return { type: 'chapter', id: chapterMatch[1] };

  return null;
}

export default api;
