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
import { Platform } from 'react-native';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheManager } from '../utils/cacheManager';
import { ApiLogger } from '../services/apiLogger';
import type {
  Manga,
  Chapter,
  ChapterPages,
  MangaDexResponse,
  MangaTag,
  SearchFilters,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────

export function getMangaDexApiBase(): string {
  if (Platform.OS !== 'web') {
    return 'https://api.mangadex.org';
  }
  // In Web: on hosted environments (e.g. Vercel / production domain), route through the serverless proxy to bypass CORS
  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return '/api/mangadex';
    }
  }
  return 'https://api.mangadex.org';
}

const AUTH_BASE = 'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token';
const COVERS_BASE = 'https://uploads.mangadex.org/covers';
const APP_USER_AGENT = 'MangaReaderApp/1.0.0';
const POPULAR_NEW_TITLES_WINDOW_DAYS = 30;

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
  baseURL: getMangaDexApiBase(),
  timeout: 15000,
  headers: {
    // Web browsers forbid custom User-Agent in XHR/fetch; native platforms require it for MangaDex
    ...(Platform.OS !== 'web' ? { 'User-Agent': APP_USER_AGENT } : {}),
  },
});

function parseRateLimitHeaders(headers: any) {
  if (!headers) return undefined;
  const limitStr = headers['x-ratelimit-limit'] ?? headers['X-RateLimit-Limit'];
  const remainingStr = headers['x-ratelimit-remaining'] ?? headers['X-RateLimit-Remaining'];
  const retryAfterStr =
    headers['x-ratelimit-retry-after'] ??
    headers['X-RateLimit-Retry-After'] ??
    headers['retry-after'] ??
    headers['Retry-After'];

  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  const remaining = remainingStr ? parseInt(remainingStr, 10) : undefined;
  const retryAfter = retryAfterStr ? parseInt(retryAfterStr, 10) : undefined;

  return {
    limit: limit !== undefined && !isNaN(limit) ? limit : undefined,
    remaining: remaining !== undefined && !isNaN(remaining) ? remaining : undefined,
    retryAfter: retryAfter !== undefined && !isNaN(retryAfter) ? retryAfter : undefined,
  };
}

// Request interceptor: inject auth token when available & attach start time
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  (config as any)._startTime = Date.now();

  // Dynamically ensure the correct baseURL on Web vs Native
  config.baseURL = getMangaDexApiBase();

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

// Response interceptor: auto-retry on network errors/5xx/429 & auto-refresh on 401 & log to ApiLogger
api.interceptors.response.use(
  (response) => {
    const startTime = (response.config as any)._startTime || Date.now();
    const durationMs = Date.now() - startTime;
    const url = response.config.url || '';
    const method = (response.config.method || 'GET').toUpperCase();
    const rateLimit = parseRateLimitHeaders(response.headers);

    ApiLogger.logRequest({
      timestamp: Date.now(),
      method,
      url,
      status: response.status,
      statusText: response.statusText,
      durationMs,
      rateLimit,
    });

    return response;
  },
  async (error) => {
    const original = error.config;
    if (original) {
      const startTime = (original as any)._startTime || Date.now();
      const durationMs = Date.now() - startTime;
      const url = original.url || '';
      const method = (original.method || 'GET').toUpperCase();
      const status = error.response?.status ?? null;
      const statusText = error.response?.statusText || (error.message ? error.message : 'Network Error');
      const rateLimit = parseRateLimitHeaders(error.response?.headers);

      ApiLogger.logRequest({
        timestamp: Date.now(),
        method,
        url,
        status,
        statusText,
        durationMs,
        error: error.response?.data?.errors?.[0]?.detail || error.message || 'Request failed',
        rateLimit,
      });
    }

    if (!original) return Promise.reject(error);

    // Auto-retry up to 3 times on network errors or 5xx/429 status codes
    if (!original._retryCount) original._retryCount = 0;
    if (
      original._retryCount < 3 &&
      (!error.response || error.response.status === 429 || error.response.status >= 500)
    ) {
      original._retryCount += 1;
      const delay = Math.pow(2, original._retryCount) * 800;
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
    await AsyncStorage.setItem(TOKEN_KEYS.clientId, clientId);
    await AsyncStorage.setItem(TOKEN_KEYS.clientSecret, clientSecret);

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
    const expiry = Date.now() + (expires_in ?? 900) * 1000;

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

export function getMangaDexCoversBase(): string {
  if (Platform.OS !== 'web') {
    return 'https://uploads.mangadex.org/covers';
  }
  // In Web: on hosted environments (e.g. Vercel), route through reverse proxy to bypass MangaDex anti-hotlink placeholder
  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return '/api/mangadex-covers';
    }
  }
  return 'https://uploads.mangadex.org/covers';
}

export function getCoverUrl(
  mangaId: string,
  coverFileName: string | null,
  size: '256' | '512' | 'original' = '512'
): string | null {
  if (!coverFileName) return null;
  const suffix = size === 'original' ? '' : `.${size}.jpg`;
  const base = getMangaDexCoversBase();
  return `${base}/${mangaId}/${coverFileName}${suffix}`;
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

export async function searchManga(
  filters: SearchFilters = {},
  limit = 27,
  offset = 0
): Promise<{ data: Manga[]; total: number }> {
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

export async function getPopularManga(limit = 10, bypassCache = false): Promise<Manga[]> {
  const createdAtSinceDate = new Date();
  createdAtSinceDate.setUTCHours(0, 0, 0, 0);
  createdAtSinceDate.setUTCDate(createdAtSinceDate.getUTCDate() - POPULAR_NEW_TITLES_WINDOW_DAYS);

  // MangaDex's "Popular New Titles" is not a separate endpoint. It is a
  // recent-title search sorted by follow count: new enough to be a fresh title,
  // then popular within that window.
  const createdAtSince = createdAtSinceDate.toISOString().slice(0, 19);
  const cacheKey = `popular_new_titles_${limit}_${createdAtSince.slice(0, 10)}`;
  if (!bypassCache) {
    const cached = await CacheManager.get<Manga[]>(cacheKey);
    if (cached) return cached;
  }

  const res = await api.get<MangaDexResponse<Manga[]>>('/manga', {
    params: {
      limit,
      includes: ['cover_art', 'author', 'artist'],
      'contentRating[]': ['safe', 'suggestive'],
      createdAtSince,
      'order[followedCount]': 'desc',
      hasAvailableChapters: true,
    },
  });

  const data = res.data.data;
  await CacheManager.set(cacheKey, data, 10 * 60 * 1000); // 10 min TTL
  return data;
}

export async function getLatestUpdates(
  limit = 27,
  offset = 0,
  bypassCache = false
): Promise<{ data: Manga[]; total: number }> {
  const cacheKey = `latest_updates_${limit}_${offset}`;
  if (!bypassCache) {
    const cached = await CacheManager.get<{ data: Manga[]; total: number }>(cacheKey);
    if (cached) return cached;
  }

  // The manga sort field is only an index of each title's latest chapter and
  // does not expose that chapter's timestamp. Use the chapter list instead so
  // "Latest Updates" is ordered by the actual date users can read the chapter.
  //
  // Avoid publishAt for this feed: some chapters have far-future publishAt
  // values while their readableAt/uploaded date is years old, which makes old
  // uploads appear as the latest results.
  const chapterRes = await api.get<MangaDexResponse<Chapter[]>>('/chapter', {
    params: {
      // Fetch extra rows because several chapters can belong to one manga.
      limit: Math.min(100, Math.max(limit * 4, 50)),
      offset,
      includes: ['manga', 'scanlation_group', 'user'],
      'contentRating[]': ['safe', 'suggestive', 'erotica'],
      'translatedLanguage[]': ['en'],
      'order[readableAt]': 'desc',
    },
  });

  const mangaIds: string[] = [];
  const seen = new Set<string>();
  for (const chapter of chapterRes.data.data) {
    const mangaId = chapter.relationships?.find((rel) => rel.type === 'manga')?.id;
    if (mangaId && !seen.has(mangaId)) {
      seen.add(mangaId);
      mangaIds.push(mangaId);
      if (mangaIds.length >= limit) break;
    }
  }

  const data = (await Promise.all(mangaIds.map(async (mangaId) => {
    try {
      return await getMangaDetails(mangaId);
    } catch {
      return null;
    }
  }))).filter((manga): manga is Manga => manga !== null);

  const result = { data, total: chapterRes.data.total ?? data.length };
  await CacheManager.set(cacheKey, result, 5 * 60 * 1000); // 5 min TTL
  return result;
}

export async function getRecentlyAdded(
  limit = 27,
  offset = 0,
  bypassCache = false
): Promise<{ data: Manga[]; total: number }> {
  const cacheKey = `recently_added_${limit}_${offset}`;
  if (!bypassCache) {
    const cached = await CacheManager.get<{ data: Manga[]; total: number }>(cacheKey);
    if (cached) return cached;
  }

  const res = await api.get<MangaDexResponse<Manga[]>>('/manga', {
    params: {
      limit,
      offset,
      includes: ['cover_art', 'author', 'artist'],
      'contentRating[]': ['safe', 'suggestive', 'erotica'],
      'order[createdAt]': 'desc',
      hasAvailableChapters: true,
    },
  });

  const result = { data: res.data.data, total: res.data.total ?? 0 };
  await CacheManager.set(cacheKey, result, 5 * 60 * 1000); // 5 min TTL
  return result;
}

export async function getRandomManga(): Promise<Manga> {
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
  const cacheKey = `manga_detail_${mangaId}`;
  const cached = await CacheManager.get<Manga>(cacheKey);
  if (cached) return cached;

  const res = await api.get<MangaDexResponse<Manga>>(`/manga/${mangaId}`, {
    params: { includes: ['cover_art', 'author', 'artist'] },
  });

  const data = res.data.data;
  await CacheManager.set(cacheKey, data, 30 * 60 * 1000); // 30 min TTL
  return data;
}

export async function getChapterDetails(chapterId: string): Promise<Chapter> {
  const cacheKey = `chapter_detail_${chapterId}`;
  const cached = await CacheManager.get<Chapter>(cacheKey);
  if (cached) return cached;

  const res = await api.get<MangaDexResponse<Chapter>>(`/chapter/${chapterId}`, {
    params: { includes: ['manga', 'scanlation_group'] },
  });

  const data = res.data.data;
  await CacheManager.set(cacheKey, data, 30 * 60 * 1000); // 30 min TTL
  return data;
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
  const cacheKey = `stats_${mangaId}`;
  const cached = await CacheManager.get<MangaStatistics>(cacheKey);
  if (cached) return cached;

  try {
    const res = await api.get(`/statistics/manga/${mangaId}`);
    const stats = res.data.statistics?.[mangaId] ?? null;
    if (stats) {
      await CacheManager.set(cacheKey, stats, 15 * 60 * 1000); // 15 min TTL
    }
    return stats;
  } catch {
    return null;
  }
}

export async function getBatchMangaStatistics(
  mangaIds: string[]
): Promise<Record<string, MangaStatistics>> {
  if (!mangaIds || mangaIds.length === 0) return {};

  const missingIds: string[] = [];
  const resultStats: Record<string, MangaStatistics> = {};

  for (const id of mangaIds) {
    const cached = await CacheManager.get<MangaStatistics>(`stats_${id}`);
    if (cached) {
      resultStats[id] = cached;
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) return resultStats;

  try {
    const params = new URLSearchParams();
    missingIds.forEach((id) => params.append('manga[]', id));
    const res = await api.get(`/statistics/manga?${params.toString()}`);
    const fetchedStats = res.data.statistics ?? {};

    for (const [id, stat] of Object.entries(fetchedStats)) {
      resultStats[id] = stat as MangaStatistics;
      await CacheManager.set(`stats_${id}`, stat, 15 * 60 * 1000);
    }

    return resultStats;
  } catch {
    return resultStats;
  }
}

// ─── Chapters ────────────────────────────────────────────────────

export async function getMangaChapters(
  mangaId: string,
  language = 'en',
  limit = 100,
  offset = 0,
  order: 'asc' | 'desc' = 'asc'
): Promise<{ data: Chapter[]; total: number }> {
  if (offset + limit > 10000) {
    offset = Math.max(0, 10000 - limit);
  }

  const cacheKey = `manga_chapters_${mangaId}_${language}_${limit}_${offset}_${order}`;
  const cached = await CacheManager.get<{ data: Chapter[]; total: number }>(cacheKey);
  if (cached) return cached;

  const languages = language === 'en' ? ['en', 'en-us', 'en-gb'] : [language];

  const res = await api.get<MangaDexResponse<Chapter[]>>(`/manga/${mangaId}/feed`, {
    params: {
      'translatedLanguage[]': languages,
      limit: Math.min(limit, 500),
      offset,
      includes: ['scanlation_group', 'user'],
      'order[chapter]': order,
      'contentRating[]': ['safe', 'suggestive', 'erotica'],
    },
  });

  const result = { data: res.data.data, total: res.data.total ?? 0 };
  await CacheManager.set(cacheKey, result, 10 * 60 * 1000); // 10 min TTL
  return result;
}

// ─── Chapter Pages (MangaDex@Home Caching) ──────────────────────
// Rate limit: 40 req/min for /at-home/server/{id}
// baseUrl validity: ~15 minutes. We cache pages for 15 mins.

export async function getChapterPages(
  chapterId: string,
  dataSaver = false
): Promise<{ pages: string[]; hash: string; baseUrl: string }> {
  const cacheKey = `chapter_pages_${chapterId}_${dataSaver ? 'saver' : 'full'}`;
  const cached = await CacheManager.get<{ pages: string[]; hash: string; baseUrl: string }>(cacheKey);
  if (cached) return cached;

  const res = await api.get<{ baseUrl: string; chapter: ChapterPages['chapter'] }>(
    `/at-home/server/${chapterId}`
  );
  const { baseUrl, chapter } = res.data;
  const quality = dataSaver ? 'data-saver' : 'data';
  const files = dataSaver ? chapter.dataSaver : chapter.data;
  const pages = files.map((f) => `${baseUrl}/${quality}/${chapter.hash}/${f}`);

  const result = { pages, hash: chapter.hash, baseUrl };
  await CacheManager.set(cacheKey, result, 14 * 60 * 1000); // 14 min TTL (safe margin under 15 min expiration)
  return result;
}

// ─── Authenticated Endpoints ─────────────────────────────────────

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

export async function followManga(mangaId: string): Promise<boolean> {
  try {
    await api.post(`/manga/${mangaId}/follow`);
    return true;
  } catch {
    return false;
  }
}

export async function unfollowManga(mangaId: string): Promise<boolean> {
  try {
    await api.delete(`/manga/${mangaId}/follow`);
    return true;
  } catch {
    return false;
  }
}

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
  const cacheKey = 'mangadex_tags';
  const cached = await CacheManager.get<MangaTag[]>(cacheKey);
  if (cached) return cached;

  const res = await api.get<MangaDexResponse<MangaTag[]>>('/manga/tag');
  const data = res.data.data;
  await CacheManager.set(cacheKey, data, 24 * 60 * 60 * 1000); // 24 hours TTL
  return data;
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
