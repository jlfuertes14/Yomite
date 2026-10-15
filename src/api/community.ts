import axios from 'axios';
import { parse } from 'node-html-parser';
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
  source: 'Anime News Network' | 'Anime Corner';
}

export interface AnimeNewsArticle extends AnimeNewsItem {
  content: string[];
}

export function getNewsSourceFavicon(source?: string | null): string {
  if (source === 'Anime Corner') {
    return 'https://static.animecorner.me/2023/02/icon-180x180-1.png';
  }
  return 'https://www.google.com/s2/favicons?domain=animenewsnetwork.com&sz=128';
}

const ANIME_NEWS_API_BASE = 'https://yomite-parsers.onrender.com';

/**
 * Direct fallback parser for Anime Corner's public RSS feed
 */
async function fetchAnimeCornerDirect(): Promise<AnimeNewsItem[]> {
  try {
    const res = await axios.get('https://animecorner.me/feed/', { timeout: 12000 });
    const root = parse(res.data);
    const items = root.querySelectorAll('item');
    return items.map((item, idx) => {
      const title = item.querySelector('title')?.text?.trim() || 'Anime Corner update';
      const link = item.querySelector('link')?.text?.trim() || item.querySelector('guid')?.text?.trim() || '';
      const pubDate = item.querySelector('pubDate')?.text?.trim() || new Date().toISOString();
      const desc = item.querySelector('description')?.text?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
      return {
        id: link || `ac-${idx}`,
        title,
        summary: desc || 'Read the latest update from Anime Corner.',
        publishedAt: new Date(pubDate).toISOString(),
        url: link,
        source: 'Anime Corner' as const,
      };
    }).filter((i) => i.url);
  } catch {
    return [];
  }
}

/**
 * Fetch aggregated anime news from Anime News Network and Anime Corner.
 * Results are sorted chronologically by publishedAt timestamp (newest first).
 */
export async function getAnimeNews(bypassCache = false): Promise<AnimeNewsItem[]> {
  const cacheKey = 'community_anime_news_v4';
  if (!bypassCache) {
    const cached = await CacheManager.get<AnimeNewsItem[]>(cacheKey);
    if (cached) return cached;
  }

  const itemsMap = new Map<string, AnimeNewsItem>();

  // 1. Fetch aggregated news from Yomite Parser service
  try {
    const response = await axios.get<{ items?: AnimeNewsItem[] }>(`${ANIME_NEWS_API_BASE}/api/news`, {
      timeout: 30000,
    });
    const remoteItems = response.data?.items || [];
    for (const item of remoteItems) {
      if (item.url) itemsMap.set(item.url, item);
    }
  } catch (err) {
    console.warn('Failed to fetch anime news from Yomite parser:', err);
  }

  // 2. Client-side direct fetch for Anime Corner to guarantee instant updates
  try {
    const acItems = await fetchAnimeCornerDirect();
    for (const item of acItems) {
      if (item.url && !itemsMap.has(item.url)) {
        itemsMap.set(item.url, item);
      }
    }
  } catch {}

  const merged = Array.from(itemsMap.values());

  // 3. Arrange all news based on posting timestamp (newest first)
  merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  if (merged.length > 0) {
    await CacheManager.set(cacheKey, merged, 15 * 60 * 1000);
  }

  return merged;
}

function getClientYoutubeEmbedUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const raw = String(value).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
      const embedUrl = new URL(`https://www.youtube.com/embed/${raw}`);
      embedUrl.searchParams.set('origin', 'https://yomite.vercel.app');
      embedUrl.searchParams.set('enablejsapi', '1');
      return embedUrl.toString();
    }
    const url = new URL(raw, 'https://animecorner.me');
    let videoId: string | null | undefined;
    if (url.searchParams.get('yt_embed')) {
      videoId = url.searchParams.get('yt_embed');
    } else if (url.hostname === 'youtu.be') {
      videoId = url.pathname.replace(/^\/+/, '').split('/')[0];
    } else if (url.hostname.includes('youtube.com')) {
      videoId = url.searchParams.get('v')
        || url.pathname.match(/\/embed\/([^/?]+)/)?.[1]
        || url.pathname.match(/\/shorts\/([^/?]+)/)?.[1];
    }
    if (!videoId) return undefined;
    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    embedUrl.searchParams.set('origin', 'https://yomite.vercel.app');
    embedUrl.searchParams.set('enablejsapi', '1');
    return embedUrl.toString();
  } catch {
    return undefined;
  }
}

function getOriginalWordPressUrl(url?: string | null): string {
  if (!url) return '';
  // Remove WordPress resize dimension suffix e.g. -1024x576.jpg -> .jpg
  return url.replace(/-\d+x\d+(\.[a-zA-Z0-9]+)(\?.*)?$/, '$1');
}

function normalizeImageKey(url?: string | null): string {
  if (!url) return '';
  const clean = getOriginalWordPressUrl(url).split('?')[0];
  const filename = clean.split('/').pop() || clean;
  return filename.toLowerCase();
}

function parseHighestResFromSrcset(srcset?: string | null): string | null {
  if (!srcset) return null;
  const parts = srcset.split(',').map((part) => {
    const [u, w] = part.trim().split(/\s+/);
    const width = parseInt(w?.replace(/\D/g, '') || '0', 10);
    return { url: u, width };
  }).filter((p) => p.url && !p.url.startsWith('data:'));
  if (parts.length === 0) return null;
  parts.sort((a, b) => b.width - a.width);
  return parts[0].url;
}

function toClientAbsoluteUrl(value?: string | null, baseUrl?: string): string | undefined {
  if (!value) return undefined;
  try {
    let clean = String(value).trim();
    if (clean.startsWith('//')) clean = 'https:' + clean;
    if (clean.includes('animenewsnetwork.com/thumbnails/max300x600/')) {
      clean = clean.replace('thumbnails/max300x600/', 'thumbnails/max600x600/');
    }
    return new URL(clean, baseUrl || 'https://www.animenewsnetwork.com').toString();
  } catch {
    return undefined;
  }
}

export async function getAnimeNewsArticle(url: string): Promise<AnimeNewsArticle | null> {
  const cacheKey = `community_anime_news_article_v7_${encodeURIComponent(url)}`;
  const cached = await CacheManager.get<AnimeNewsArticle>(cacheKey);
  if (cached) return cached;

  // 1. Try remote parser service
  try {
    const response = await axios.get<AnimeNewsArticle>(`${ANIME_NEWS_API_BASE}/api/news/article`, {
      params: { url },
      timeout: 30000,
    });
    if (response.data && response.data.title) {
      await CacheManager.set(cacheKey, response.data, 60 * 60 * 1000);
      return response.data;
    }
  } catch {}

  // 2. Direct client fallback for Anime Corner or ANN if parser is spinning up
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Yomite/1.0',
      },
    });
    const root = parse(res.data);
    const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute('content');
    const isAc = url.includes('animecorner.me');

    // 1. Trailers & PV
    const trailerUrls: string[] = [];
    root.querySelectorAll('iframe, a, div[data-video-id], div[data-youtube-id]').forEach((el) => {
      const candidate = el.getAttribute('src')
        || el.getAttribute('data-src')
        || el.getAttribute('data-lazy-src')
        || el.getAttribute('href')
        || el.getAttribute('data-video-id')
        || el.getAttribute('data-youtube-id');
      const embed = getClientYoutubeEmbedUrl(candidate);
      if (embed && !trailerUrls.includes(embed)) {
        trailerUrls.push(embed);
      }
    });

    // 2. High-res Visuals & Key Art
    const targetScope = isAc
      ? (root.querySelector('.entry-content') || root.querySelector('.ac-single-entry') || root.querySelector('article'))
      : (root.querySelector('#content-zone .meat') || root.querySelector('.meat') || root.querySelector('article'));

    const rawOgImage =
      root.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      root.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
      root.querySelector('link[rel="image_src"]')?.getAttribute('href') ||
      ogImage ||
      '';
    const cleanOgImage = rawOgImage ? getOriginalWordPressUrl(toClientAbsoluteUrl(rawOgImage, url)) : '';

    const rawBodyImages: string[] = [];
    const seenKeys = new Set<string>();

    if (targetScope) {
      targetScope.querySelectorAll('img').forEach((img) => {
        const cls = img.getAttribute('class') || '';
        const src = img.getAttribute('src') || '';
        const parentCls = img.parentNode?.getAttribute('class') || '';
        const grandParentCls = img.parentNode?.parentNode?.getAttribute('class') || '';

        if (
          cls.includes('avatar') ||
          cls.includes('author') ||
          cls.includes('wp-smiley') ||
          parentCls.includes('author') ||
          parentCls.includes('avatar') ||
          parentCls.includes('penci-post-related') ||
          grandParentCls.includes('penci-post-related') ||
          src.includes('150x150') ||
          src.includes('gravatar') ||
          src.includes('/system/') ||
          src.includes('icon-') ||
          src.includes('favicon')
        ) {
          return;
        }

        const srcsetBest = parseHighestResFromSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset'));
        const candidate =
          srcsetBest ||
          img.getAttribute('data-src') ||
          img.getAttribute('data-lazy-src') ||
          src;

        if (candidate && !candidate.startsWith('data:') && !candidate.includes('150x150') && !candidate.includes('gravatar')) {
          const absUrl = toClientAbsoluteUrl(candidate, url);
          if (absUrl) {
            const originalUrl = getOriginalWordPressUrl(absUrl);
            const key = normalizeImageKey(originalUrl);
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              rawBodyImages.push(originalUrl);
            }
          }
        }
      });
    }

    const primaryCover = cleanOgImage || rawBodyImages[0] || ogImage || '';
    const coverKey = normalizeImageKey(primaryCover);

    const nonCoverBodyImages = rawBodyImages.filter((img) => normalizeImageKey(img) !== coverKey);
    const visuals = nonCoverBodyImages.length > 0
      ? nonCoverBodyImages
      : (rawBodyImages.length > 1 ? rawBodyImages : []);

    // 3. Clean content blocks (Intro, Paragraphs, Lists, Quotes)
    const content: string[] = [];
    const introEl = root.querySelector('.intro');
    const introText = introEl ? introEl.text.replace(/\s+/g, ' ').trim() : '';

    if (targetScope) {
      targetScope.querySelectorAll('p, ul, blockquote').forEach((el) => {
        const parentClass = el.parentNode?.getAttribute('class') || '';
        if (
          parentClass.includes('author') ||
          parentClass.includes('comment') ||
          parentClass.includes('panel') ||
          parentClass.includes('ezoic') ||
          parentClass.includes('ezmob') ||
          parentClass.includes('social')
        ) {
          return;
        }

        const tagName = el.tagName?.toUpperCase();
        if (tagName === 'UL') {
          el.querySelectorAll('li').forEach((li) => {
            const item = li.text.replace(/\s+/g, ' ').trim();
            if (item.length > 3) content.push(`• ${item}`);
          });
        } else if (tagName === 'BLOCKQUOTE') {
          const quote = el.text.replace(/\s+/g, ' ').trim();
          if (quote.length > 15) content.push(`“${quote}”`);
        } else {
          const text = el.text.replace(/\s+/g, ' ').trim();
          if (
            text.length > 20 &&
            !text.startsWith('Disclosure:') &&
            !text.includes('discuss this in the forum') &&
            !text.includes('bookmark/share with')
          ) {
            content.push(text);
          }
        }
      });
    }

    // Clean title
    let ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || '';
    if (!ogTitle) {
      const pageHeader = root.querySelector('#page_header');
      if (pageHeader) {
        pageHeader.querySelector('.sub-title')?.remove();
        ogTitle = pageHeader.text.replace(/\s+/g, ' ').trim();
      } else {
        ogTitle = root.querySelector('title')?.text?.replace(/\s+/g, ' ').trim() || '';
      }
    }

    let ogDesc = root.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '';
    if (!ogDesc && introText) {
      ogDesc = introText;
    }

    const publishedAt = root.querySelector('meta[property="article:published_time"]')?.getAttribute('content')
      || root.querySelector('time')?.getAttribute('datetime')
      || new Date().toISOString();

    const articleData: AnimeNewsArticle = {
      id: url,
      title: ogTitle,
      summary: ogDesc,
      imageUrl: primaryCover,
      images: visuals,
      trailerUrl: trailerUrls[0],
      trailerUrls,
      publishedAt,
      url,
      source: isAc ? 'Anime Corner' : 'Anime News Network',
      content: content.slice(0, 100),
    };

    await CacheManager.set(cacheKey, articleData, 60 * 60 * 1000);
    return articleData;
  } catch (err) {
    console.warn('Failed to fetch article directly:', err);
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
    const cached = await CacheManager.get<AnimeNewsItem[]>('community_anime_news_v4');
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
    await CacheManager.set('community_anime_news_v4', merged, 15 * 60 * 1000);
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

