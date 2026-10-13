import axios from 'axios';
import { CacheManager } from '../utils/cacheManager';
import { getMangaDexApiBase } from './mangadex';
import { supabase } from '../lib/supabase';

export interface ForumComment {
  id: string;
  username: string;
  avatarUrl?: string;
  postedAt: string;
  body: string;
  likes: number;
  isSpoiler?: boolean;
  imageUrls?: string[];
  replyTo?: string;
  user_id?: string;
  userId?: string;
}

export interface ForumThread {
  id: string;
  title: string;
  category: string;
  author: string;
  body: string;
  author_avatar_url?: string | null;
  authorAvatarUrl?: string;
  image_urls?: string[] | null;
  imageUrls?: string[];
  created_at?: string;
  createdAt: string;
  repliesCount: number;
  lastReplyAt: string;
  user_id?: string;
  userId?: string;
}

export interface AnimeNewsItem {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  url: string;
  imageUrl?: string;
  images?: string[];
  trailerUrl?: string;
  trailerUrls?: string[];
  source: 'Anime News Network';
}

export interface AnimeNewsArticle extends AnimeNewsItem {
  content: string[];
}

const ANIME_NEWS_API_BASE = 'https://yomite-parsers.onrender.com';

/**
 * Fetch the latest Anime News Network headlines for the read-only Community news tab.
 * The feed is cached so the mobile client does not request every time the tab opens.
 */
export async function getAnimeNews(bypassCache = false): Promise<AnimeNewsItem[]> {
  const cacheKey = 'community_anime_news_v1';
  if (!bypassCache) {
    const cached = await CacheManager.get<AnimeNewsItem[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await axios.get<{ items?: AnimeNewsItem[] }>(`${ANIME_NEWS_API_BASE}/api/news`, {
      timeout: 30000,
    });
    const items = response.data?.items || [];
    await CacheManager.set(cacheKey, items, 15 * 60 * 1000);
    return items;
  } catch (err) {
    console.warn('Failed to fetch Anime News Network from Yomite parser:', err);
  }

  return [];
}

export async function getAnimeNewsArticle(url: string): Promise<AnimeNewsArticle | null> {
  const cacheKey = `community_anime_news_article_${encodeURIComponent(url)}`;
  const cached = await CacheManager.get<AnimeNewsArticle>(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get<AnimeNewsArticle>(`${ANIME_NEWS_API_BASE}/api/news/article`, {
      params: { url },
      timeout: 30000,
    });
    await CacheManager.set(cacheKey, response.data, 60 * 60 * 1000);
    return response.data;
  } catch (err) {
    console.warn('Failed to fetch Anime News Network article from Yomite parser:', err);
    return null;
  }
}

/**
 * Merge freshly-fetched article covers back into the cached news feed so list
 * thumbnails persist after opening an article or background hydration runs.
 */
export async function mergeNewsCoversIntoFeedCache(
  updates: Array<
    Pick<AnimeNewsItem, 'url'> &
      Partial<Pick<AnimeNewsItem, 'imageUrl' | 'images' | 'trailerUrl' | 'trailerUrls'>>
  >
): Promise<void> {
  try {
    const cached = await CacheManager.get<AnimeNewsItem[]>('community_anime_news_v1');
    if (!cached) return;
    const byUrl = new Map(updates.map((u) => [u.url, u]));
    const merged = cached.map((item) => {
      const u = byUrl.get(item.url);
      if (!u) return item;
      const cover = u.imageUrl || u.images?.[0];
      return {
        ...item,
        imageUrl: item.imageUrl || cover || item.imageUrl,
        images: item.images || u.images,
        trailerUrl: item.trailerUrl || u.trailerUrl,
        trailerUrls: item.trailerUrls || u.trailerUrls,
      };
    });
    await CacheManager.set('community_anime_news_v1', merged, 15 * 60 * 1000);
  } catch {
    // Cache is best-effort only
  }
}

/**
 * Look up stored profile photos by author username from the public community
 * tables. SELECT is public, so this resolves for signed-in and signed-out
 * viewers alike. Returns username → avatar URL (missing columns / offline
 * yield an empty map; callers fall back to letter avatars).
 */
export async function fetchAuthorAvatarMap(usernames: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const uniq = [...new Set((usernames || []).filter((n) => n && n.trim()))].slice(0, 60);
  if (uniq.length === 0) return map;

  try {
    const { data: threads } = await supabase
      .from('community_threads')
      .select('author,author_avatar_url')
      .in('author', uniq);
    for (const row of threads || []) {
      const url = (row as any)?.author_avatar_url;
      const name = (row as any)?.author;
      if (name && url && !map[name]) map[name] = url;
    }
  } catch {
    // Column not migrated yet or offline — fall through to replies lookup
  }

  try {
    const { data: replies } = await supabase
      .from('thread_replies')
      .select('username,avatar_url')
      .in('username', uniq);
    for (const row of replies || []) {
      const url = (row as any)?.avatar_url;
      const name = (row as any)?.username;
      if (name && url && !map[name]) map[name] = url;
    }
  } catch {
    // Column not migrated yet or offline
  }

  return map;
}

/**
 * Fetch comments for a specific chapter
 */
export async function getChapterComments(chapterId: string): Promise<ForumComment[]> {
  const cacheKey = `chapter_comments_${chapterId}`;
  const cached = await CacheManager.get<ForumComment[]>(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = getMangaDexApiBase();
    const res = await axios.get(`${baseUrl}/chapter/${chapterId}`);
    const threadId = res.data?.data?.attributes?.threadId;

    if (threadId) {
      const threadRes = await axios.get(`${baseUrl}/forum/thread/${threadId}`);
      const posts = threadRes.data?.data || [];
      if (posts.length > 0) {
        const comments = posts.map((p: any) => ({
          id: p.id,
          username: p.attributes?.username || 'MangaDex Reader',
          avatarUrl: p.attributes?.avatarUrl,
          postedAt: p.attributes?.createdAt || new Date().toISOString(),
            body: p.attributes?.body || '',
            likes: p.attributes?.voteCount || 0,
            isSpoiler: p.attributes?.isSpoiler || false,
            imageUrls: p.attributes?.imageUrls,
            replyTo: p.attributes?.replyTo,
        }));
        await CacheManager.set(cacheKey, comments, 10 * 60 * 1000);
        return comments;
      }
    }
  } catch (err) {
    // Return fallback discussion feed on error or 404
  }

  // Fallback demo community comments feed
  const fallback = [
    {
      id: 'c1',
      username: 'MangaFan99',
      postedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      body: 'That page transition on panel 4 was absolutely insane! Peak chapter right here.',
      likes: 24,
    },
    {
      id: 'c2',
      username: 'ShadowReader',
      postedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      body: 'Can someone explain the plot twist at the end? Did not expect that character to show up!',
      likes: 12,
    },
    {
      id: 'c3',
      username: 'OtakuCentral',
      postedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      body: 'Art style in this chapter took a huge step up. Props to the author & scanlation team!',
      likes: 41,
    },
  ];
  await CacheManager.set(cacheKey, fallback, 10 * 60 * 1000);
  return fallback;
}

/**
 * Fetch all public community discussion threads from Supabase
 */
export async function getCommunityThreads(): Promise<ForumThread[]> {
  try {
    const { data, error } = await supabase
      .from('community_threads')
      .select('id, user_id, title, category, author, body, author_avatar_url, image_urls, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      user_id: row.user_id || undefined,
      userId: row.user_id || undefined,
      title: row.title,
      category: row.category || 'General',
      author: row.author || 'Anonymous Reader',
      body: row.body || '',
      author_avatar_url: row.author_avatar_url || null,
      authorAvatarUrl: row.author_avatar_url || undefined,
      image_urls: row.image_urls || null,
      imageUrls: row.image_urls || undefined,
      created_at: row.created_at,
      createdAt: row.created_at || new Date().toISOString(),
      repliesCount: 0,
      lastReplyAt: row.created_at || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch replies for a specific forum discussion thread from Supabase
 */
export async function getThreadReplies(threadId: string): Promise<ForumComment[]> {
  try {
    const { data, error } = await supabase
      .from('thread_replies')
      .select('id, user_id, thread_id, username, body, avatar_url, image_urls, reply_to, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: String(row.id),
      user_id: row.user_id || undefined,
      userId: row.user_id || undefined,
      username: row.username || 'Yomite Reader',
      avatarUrl: row.avatar_url || undefined,
      postedAt: row.created_at || new Date().toISOString(),
      body: row.body || '',
      likes: 1,
      imageUrls: row.image_urls || undefined,
      replyTo: row.reply_to || undefined,
    }));
  } catch {
    return [];
  }
}

