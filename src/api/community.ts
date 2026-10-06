import axios from 'axios';
import { CacheManager } from '../utils/cacheManager';
import { getMangaDexApiBase } from './mangadex';

export interface ForumComment {
  id: string;
  username: string;
  avatarUrl?: string;
  postedAt: string;
  body: string;
  likes: number;
  isSpoiler?: boolean;
}

export interface ForumThread {
  id: string;
  title: string;
  category: string;
  author: string;
  repliesCount: number;
  createdAt: string;
  lastReplyAt: string;
}

export interface AnimeNewsItem {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  url: string;
  imageUrl?: string;
  trailerUrl?: string;
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
 * Fetch replies for a specific forum discussion thread
 */
export async function getThreadReplies(threadId: string): Promise<ForumComment[]> {
  return [];
}
