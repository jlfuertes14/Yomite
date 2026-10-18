/**
 * MangaBall Parser (mangaball.com)
 *
 * Scrapes manga catalog, details, chapters, and reader pages from mangaball.com.
 * Features:
 * 1. Live SSR extraction from mangaball.com and /recently-updated.
 * 2. Next.js Flight Data stream parsing for chapter images from bulbasaur storage.
 * 3. Verified static fallback dataset with high-resolution covers.
 */
import { BaseParser } from './BaseParser';
import {
  MangaSourceMetadata,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
  SourceSortOption,
  SourceTag,
} from '../types';
import { DEFAULT_USER_AGENT, sourceHttpClient } from '../network/httpClient';
import { parse } from '../network/htmlParser';
import mangaBallFallbackData from '../catalog/mangaBallFallback.json';

export class MangaBallParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'mangaball',
      name: 'MangaBall',
      domain: 'mangaball.com',
      baseUrl: 'https://mangaball.com',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://mangaball.com/images/favicon.png',
      description: 'Fast multi-language reader for trending manhwa, manga, and comics from MangaBall.',
      availableSortOrders: ['popular', 'latest', 'newest'],
      enabled: true,
      ...metadata,
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Trending / Popular' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'newest', label: 'Recently Added' },
    ];
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public override getImageHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'action', label: 'Action', group: 'Genre' },
      { id: 'adventure', label: 'Adventure', group: 'Genre' },
      { id: 'comedy', label: 'Comedy', group: 'Genre' },
      { id: 'drama', label: 'Drama', group: 'Genre' },
      { id: 'fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'martial-arts', label: 'Martial Arts', group: 'Genre' },
      { id: 'mystery', label: 'Mystery', group: 'Genre' },
      { id: 'romance', label: 'Romance', group: 'Genre' },
      { id: 'shounen', label: 'Shounen', group: 'Genre' },
      { id: 'supernatural', label: 'Supernatural', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const query = filter.query?.trim();

    try {
      let targetUrl = `${this.metadata.baseUrl}/`;
      if (query) {
        targetUrl = `${this.metadata.baseUrl}/search-advanced?keyword=${encodeURIComponent(query)}&page=${page}`;
      } else if (filter.order === 'latest' || page > 1) {
        targetUrl = `${this.metadata.baseUrl}/recently-updated?page=${page}`;
      }

      const html = await sourceHttpClient.fetchText(targetUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);
      const items: SourceManga[] = [];
      const seenUrls = new Set<string>();

      // In MangaBall, visual cards have a[href*="/title-detail/"] containing an <img> cover
      const cardLinks = root.querySelectorAll('a[href*="/title-detail/"]');
      for (const link of cardLinks) {
        const href = link.getAttribute('href');
        if (!href) continue;

        const imgEl = link.querySelector('img');
        if (!imgEl) continue; // Skip text-only links in sidebar/footer

        let cover = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || null;
        if (!cover) continue;

        let title = imgEl.getAttribute('alt') || link.text?.trim() || '';
        title = title
          .replace(/^Read\s+/i, '')
          .replace(/\s+(?:Online\s+Free|Read\s+Online).*$/i, '')
          .replace(/\s*-\s*MangaBall$/i, '')
          .trim();
        if (!title || title.length <= 1) continue;

        const cleanHref = href.split('?')[0];
        if (seenUrls.has(cleanHref)) continue;
        seenUrls.add(cleanHref);

        const slug = cleanHref.replace(/^\/title-detail\//, '').replace(/\/$/, '');

        items.push({
          id: `${this.metadata.id}:${slug}`,
          sourceId: this.metadata.id,
          url: cleanHref.startsWith('/') ? cleanHref : `/${cleanHref}`,
          publicUrl: this.toAbsoluteUrl(cleanHref),
          title: this.cleanText(title),
          coverUrl: cover,
          coverHeaders: this.getImageHeaders(),
          locale: 'en',
          state: 'ongoing',
        });
      }

      if (items.length > 0) {
        return items;
      }
    } catch {
      // Fall through to fallback catalog
    }

    // Fallback: match against static dataset
    const q = filter.query?.toLowerCase().trim();
    const fallbackList = (mangaBallFallbackData as any[]) || [];
    const filtered = q
      ? fallbackList.filter(
          (item) =>
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.href && item.href.toLowerCase().includes(q))
        )
      : fallbackList;

    return filtered.map((item) => {
      const slug = item.href.replace(/^\/title-detail\//, '').replace(/\/$/, '');
      let title = item.title || '';
      title = title
        .replace(/^Read\s+/i, '')
        .replace(/\s+(?:Online\s+Free|Read\s+Online).*$/i, '')
        .replace(/\s*-\s*MangaBall$/i, '')
        .trim();

      return {
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        url: item.href,
        publicUrl: this.toAbsoluteUrl(item.href),
        title: this.cleanText(title),
        coverUrl: item.coverUrl || null,
        coverHeaders: this.getImageHeaders(),
        locale: 'en',
        state: 'ongoing',
      };
    });
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const slug = manga.id.replace(`${this.metadata.id}:`, '').replace(/^\/title-detail\//, '');
    const pageUrl = `${this.metadata.baseUrl}/title-detail/${slug}`;

    try {
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);

      const titleNode = root.querySelector('h1, meta[property="og:title"]');
      let title = this.cleanText(titleNode?.text || titleNode?.getAttribute('content') || manga.title);
      title = title
        .replace(/^Read\s+/i, '')
        .replace(/\s+(?:Online\s+Free|Read\s+Online).*$/i, '')
        .replace(/\s*-\s*MangaBall$/i, '')
        .trim();

      const descNode = root.querySelector('.synopsis, .description, p.text-gray-300, meta[name="description"]');
      const description = this.cleanText(descNode?.text || descNode?.getAttribute('content') || manga.description || '');

      const imgNode = root.querySelector('img[src*="covers"], .title-poster img');
      let cover = imgNode?.getAttribute('src') || manga.coverUrl;

      const genres = root
        .querySelectorAll('a[href*="/genres/"], span.rounded-full')
        .map((el) => this.cleanText(el.text))
        .filter(Boolean);

      const chapterNodes = root.querySelectorAll('a[href*="/chapter-detail/"]');

      return {
        ...manga,
        title: title || manga.title,
        description: description || manga.description,
        coverUrl: cover || manga.coverUrl,
        coverHeaders: this.getImageHeaders(),
        tags: genres.length > 0 ? genres : manga.tags,
        chaptersCount: chapterNodes.length || manga.chaptersCount,
      };
    } catch {
      return manga;
    }
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const slug = manga.id.replace(`${this.metadata.id}:`, '').replace(/^\/title-detail\//, '');
    const pageUrl = `${this.metadata.baseUrl}/title-detail/${slug}`;

    try {
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);
      const chapters: SourceChapter[] = [];
      const seen = new Set<string>();

      const links = root.querySelectorAll('a[href*="/chapter-detail/"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href || seen.has(href)) continue;
        seen.add(href);

        const name = this.cleanText(link.text) || 'Chapter';
        const numMatch = href.match(/chapter=(\d+(?:\.\d+)?)/i) || name.match(/chapter\s*(\d+(?:\.\d+)?)/i) || name.match(/(\d+(?:\.\d+)?)/);
        const chapterNum = numMatch ? parseFloat(numMatch[1]) : 0;

        const idMatch = href.match(/\/chapter-detail\/([a-f0-9]+)/i);
        const chapterId = idMatch ? idMatch[1] : `ch-${chapterNum}`;

        chapters.push({
          id: `${this.metadata.id}:${slug}:${chapterId}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name: name.includes('Chapter') ? name : `Chapter ${chapterNum}`,
          number: chapterNum,
          url: href.startsWith('/') ? href : `/${href}`,
          dateUpload: Date.now(),
          scanlator: 'MangaBall',
        });
      }

      if (chapters.length > 0) {
        return chapters.sort((a, b) => b.number - a.number);
      }
    } catch {
      // Fallback
    }

    return [
      {
        id: `${this.metadata.id}:${slug}:1`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: 'Chapter 1',
        number: 1,
        url: `/chapter-detail/${slug}?chapter=1`,
        dateUpload: Date.now(),
        scanlator: 'MangaBall',
      },
    ];
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let targetUrl = chapter.url;
    if (!targetUrl.startsWith('/chapter-detail/')) {
      const parts = (chapter.url || chapter.id || '').split(':');
      const cleanChId = parts[parts.length - 1];
      targetUrl = `/chapter-detail/${cleanChId}`;
    }
    const pageUrl = this.toAbsoluteUrl(targetUrl);

    try {
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      // MangaBall delivers chapter pages via Next.js flight data stream and/or standard HTML img tags
      const matches = html.match(/https?:\/\/[^\"\'\s<>\\]+\/storage\/[^\"\'\s<>\\]+\.(?:webp|jpg|jpeg|png|avif)/gi) || [];
      const uniqueImages = [...new Set(matches)];

      if (uniqueImages.length > 0) {
        return uniqueImages.map((imgUrl, index) => ({
          index,
          url: imgUrl,
          headers: this.getImageHeaders(),
        }));
      }

      // Check standard <img> tags
      const root = parse(html);
      const standardImgs = root.querySelectorAll('img[src*="storage"], img[src*="chapter"]');
      if (standardImgs.length > 0) {
        return standardImgs.map((node, index) => ({
          index,
          url: node.getAttribute('src') || '',
          headers: this.getImageHeaders(),
        }));
      }
    } catch {
      // Fallback
    }

    return [];
  }
}
