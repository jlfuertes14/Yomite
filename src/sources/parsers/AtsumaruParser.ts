/**
 * Atsumaru Parser (atsu.moe)
 *
 * Scrapes manga catalog, details, chapters, and reader pages from atsu.moe.
 * Features:
 * 1. High-speed Typesense search API (/collections/manga/documents/search).
 * 2. Embedded page state (window.mangaPage) parser for instant metadata & chapters.
 * 3. Official readChapter REST endpoint (/api/read/chapter) delivering CDN pages.
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
import atsumaruFallbackData from '../catalog/atsumaruFallback.json';

export class AtsumaruParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'atsumaru',
      name: 'Atsumaru',
      domain: 'atsu.moe',
      baseUrl: 'https://atsu.moe',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=atsu.moe&sz=64',
      description: 'Modern, high-performance reader for official webcomics and manga from Atsumaru.',
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
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
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
      { id: 'historical', label: 'Historical', group: 'Genre' },
      { id: 'romance', label: 'Romance', group: 'Genre' },
      { id: 'sci-fi', label: 'Sci-fi', group: 'Genre' },
      { id: 'shounen', label: 'Shounen', group: 'Genre' },
      { id: 'slice-of-life', label: 'Slice of Life', group: 'Genre' },
      { id: 'supernatural', label: 'Supernatural', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const query = filter.query?.trim();

    // 1. If query is provided, query Atsumaru's Typesense search collection
    if (query) {
      try {
        const searchUrl = `${this.metadata.baseUrl}/collections/manga/documents/search?q=${encodeURIComponent(query)}&query_by=title`;
        const res = await sourceHttpClient.get<any>(searchUrl, {
          headers: this.getRequestHeaders(),
        });

        const hits = res.data?.hits || [];
        if (Array.isArray(hits) && hits.length > 0) {
          return hits.map((hit: any) => {
            const doc = hit.document || {};
            const slug = doc.id || '';
            let coverUrl: string | null = null;
            if (doc.poster) {
              const posterPath = typeof doc.poster === 'string' ? doc.poster : doc.poster.smallImage || doc.poster.image;
              coverUrl = posterPath.startsWith('http') ? posterPath : `https://cdn.atsu.moe/static/${posterPath.replace(/^\/+/, '')}`;
            }

            return {
              id: `${this.metadata.id}:${slug}`,
              sourceId: this.metadata.id,
              url: `/manga/${slug}`,
              publicUrl: `${this.metadata.baseUrl}/manga/${slug}`,
              title: this.cleanText(doc.title || slug),
              coverUrl,
              coverHeaders: this.getImageHeaders(),
              locale: 'en',
              state: doc.status === 'completed' ? 'completed' : 'ongoing',
              description: doc.synopsis ? this.cleanText(doc.synopsis) : undefined,
              tags: Array.isArray(doc.tags) ? doc.tags : [],
            } as SourceManga;
          });
        }
      } catch {
        // Fall through to HTML or static
      }
    }

    // 2. Fetch live homepage / cards
    try {
      const html = await sourceHttpClient.fetchText(`${this.metadata.baseUrl}/`, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);
      const items: SourceManga[] = [];
      const seen = new Set<string>();

      const cardLinks = root.querySelectorAll('a[href*="/manga/"]');
      for (const link of cardLinks) {
        const href = link.getAttribute('href');
        if (!href || href === '/manga' || href.includes('/manga/tag')) continue;

        const cleanHref = href.split('?')[0];
        if (seen.has(cleanHref)) continue;

        const imgEl = link.querySelector('img');
        let cover = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || null;
        if (cover && !cover.startsWith('http')) {
          cover = `https://cdn.atsu.moe${cover.startsWith('/') ? '' : '/'}${cover}`;
        }

        const titleEl = link.querySelector('.text-foreground2, h3, h4, span') || link;
        const title = this.cleanText(titleEl.text || imgEl?.getAttribute('alt') || '');
        if (!title || title.length <= 1) continue;

        const slug = cleanHref.replace(/^\/manga\//, '').replace(/\/$/, '');
        seen.add(cleanHref);

        items.push({
          id: `${this.metadata.id}:${slug}`,
          sourceId: this.metadata.id,
          url: cleanHref.startsWith('/') ? cleanHref : `/${cleanHref}`,
          publicUrl: `${this.metadata.baseUrl}${cleanHref}`,
          title,
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
      // Fall through to fallback
    }

    // 3. Fallback: match against static dataset
    const q = filter.query?.toLowerCase().trim();
    const fallbackList = (atsumaruFallbackData as any[]) || [];
    const filtered = q
      ? fallbackList.filter(
          (item) =>
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.href && item.href.toLowerCase().includes(q))
        )
      : fallbackList;

    return filtered.map((item) => {
      const slug = item.href.replace(/^\/manga\//, '').replace(/\/$/, '');
      return {
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        url: item.href,
        publicUrl: `${this.metadata.baseUrl}${item.href}`,
        title: this.cleanText(item.title),
        coverUrl: item.coverUrl || null,
        coverHeaders: this.getImageHeaders(),
        locale: 'en',
        state: 'ongoing',
      };
    });
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const slug = manga.id.replace(`${this.metadata.id}:`, '').replace(/^\/manga\//, '');
    const pageUrl = `${this.metadata.baseUrl}/manga/${slug}`;

    try {
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      // Atsumaru embeds complete structured data in window.mangaPage
      const match = html.match(/window\.mangaPage\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
      if (match) {
        const pageData = JSON.parse(match[1])?.mangaPage || {};

        let cover = manga.coverUrl;
        if (pageData.poster) {
          const posterPath = typeof pageData.poster === 'string' ? pageData.poster : pageData.poster.image || pageData.poster.smallImage;
          cover = posterPath.startsWith('http') ? posterPath : `https://cdn.atsu.moe/static/${posterPath.replace(/^\/+/, '')}`;
        }

        const authors = Array.isArray(pageData.authors)
          ? pageData.authors.map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean)
          : [];

        const tags = Array.isArray(pageData.tags)
          ? pageData.tags.map((t: any) => typeof t === 'string' ? t : t.name).filter(Boolean)
          : [];

        return {
          ...manga,
          title: pageData.title ? this.cleanText(pageData.title) : manga.title,
          description: pageData.synopsis ? this.cleanText(pageData.synopsis) : manga.description,
          coverUrl: cover || manga.coverUrl,
          coverHeaders: this.getImageHeaders(),
          authors: authors.length > 0 ? authors : manga.authors,
          tags: tags.length > 0 ? tags : manga.tags,
          chaptersCount: Array.isArray(pageData.chapters) ? pageData.chapters.length : manga.chaptersCount,
          state: pageData.status === 'completed' ? 'completed' : 'ongoing',
        };
      }

      // Fallback HTML parsing
      const root = parse(html);
      const titleNode = root.querySelector('h1, meta[property="og:title"]');
      const title = this.cleanText(titleNode?.text || titleNode?.getAttribute('content') || manga.title);

      const descNode = root.querySelector('p.text-foreground2, .synopsis, meta[name="description"]');
      const description = this.cleanText(descNode?.text || descNode?.getAttribute('content') || manga.description || '');

      return {
        ...manga,
        title: title || manga.title,
        description: description || manga.description,
        coverHeaders: this.getImageHeaders(),
      };
    } catch {
      return manga;
    }
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const slug = manga.id.replace(`${this.metadata.id}:`, '').replace(/^\/manga\//, '');
    const pageUrl = `${this.metadata.baseUrl}/manga/${slug}`;

    try {
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const match = html.match(/window\.mangaPage\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
      if (match) {
        const pageData = JSON.parse(match[1])?.mangaPage || {};
        const rawChapters = pageData.chapters || [];

        if (Array.isArray(rawChapters) && rawChapters.length > 0) {
          return rawChapters.map((ch: any) => ({
            id: `${this.metadata.id}:${slug}:${ch.id}`,
            sourceId: this.metadata.id,
            mangaId: manga.id,
            name: ch.title || `Chapter ${ch.number}`,
            number: typeof ch.number === 'number' ? ch.number : parseFloat(ch.number || '0'),
            url: `/read/${slug}/${ch.id}`,
            dateUpload: typeof ch.createdAt === 'number' ? ch.createdAt : Date.now(),
            scanlator: 'Atsumaru',
          })).sort((a: SourceChapter, b: SourceChapter) => b.number - a.number);
        }
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
        url: `/read/${slug}/1`,
        dateUpload: Date.now(),
        scanlator: 'Atsumaru',
      },
    ];
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let mangaId = '';
    let chapterId = '';

    if (chapter.id && chapter.id.startsWith('atsumaru:')) {
      const parts = chapter.id.replace(/^atsumaru:/, '').split(':');
      mangaId = parts[0];
      chapterId = parts[1];
    }

    if (!mangaId || !chapterId) {
      if (chapter.url.includes(':')) {
        const parts = chapter.url.split(':');
        mangaId = parts[0];
        chapterId = parts[1];
      } else if (chapter.url.includes('/read/')) {
        const parts = chapter.url.replace(/^\/read\//, '').split('/');
        mangaId = parts[0];
        chapterId = parts[1];
      }
    }

    if (!mangaId || !chapterId) {
      return [];
    }

    try {
      // Official Atsumaru reading endpoint discovered via RPC reflection
      const apiUrl = `${this.metadata.baseUrl}/api/read/chapter?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`;
      const res = await sourceHttpClient.get<any>(apiUrl, {
        headers: {
          ...this.getRequestHeaders(),
          Referer: `${this.metadata.baseUrl}/read/${mangaId}/${chapterId}`,
        },
      });

      const readData = res.data?.readChapter || {};
      const pages = readData.pages || [];

      if (Array.isArray(pages) && pages.length > 0) {
        return pages.map((p: any, index: number) => {
          const imgPath = p.image || '';
          const fullImgUrl = imgPath.startsWith('http')
            ? imgPath
            : `https://cdn.atsu.moe${imgPath.startsWith('/') ? '' : '/'}${imgPath}`;

          return {
            index: typeof p.number === 'number' ? p.number : index,
            url: fullImgUrl,
            width: p.width,
            height: p.height,
            headers: this.getImageHeaders(),
          };
        });
      }
    } catch {
      // Fallback
    }

    return [];
  }
}
