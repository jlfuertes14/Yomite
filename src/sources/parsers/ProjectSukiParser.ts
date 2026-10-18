/**
 * Project Suki Parser (projectsuki.com)
 *
 * Scrapes manga catalog, details, chapters, and reader pages from projectsuki.com.
 * Features:
 * 1. Live HTML scraping of /browse, /book/:id, and /read/:bookId/:chapterId/:page.
 * 2. High-performance fallback dataset when offline or rate-limited.
 * 3. Gallery image reconstruction for multi-page chapter reader.
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
import projectSukiFallbackData from '../catalog/projectSukiFallback.json';

export class ProjectSukiParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'projectsuki',
      name: 'Project Suki',
      domain: 'projectsuki.com',
      baseUrl: 'https://projectsuki.com',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=projectsuki.com&sz=64',
      description: 'Extensive library of manhwa, manga, and webtoons with high quality scans from Project Suki.',
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
      { id: 'historical', label: 'Historical', group: 'Genre' },
      { id: 'isekai', label: 'Isekai', group: 'Genre' },
      { id: 'martial-arts', label: 'Martial Arts', group: 'Genre' },
      { id: 'mystery', label: 'Mystery', group: 'Genre' },
      { id: 'romance', label: 'Romance', group: 'Genre' },
      { id: 'school-life', label: 'School Life', group: 'Genre' },
      { id: 'sci-fi', label: 'Sci-fi', group: 'Genre' },
      { id: 'shounen', label: 'Shounen', group: 'Genre' },
      { id: 'slice-of-life', label: 'Slice of Life', group: 'Genre' },
      { id: 'supernatural', label: 'Supernatural', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const query = filter.query?.trim();

    try {
      let targetUrl = `${this.metadata.baseUrl}/`;
      if (query) {
        targetUrl = `${this.metadata.baseUrl}/browse?search=${encodeURIComponent(query)}&page=${page}`;
      } else if (filter.order === 'latest') {
        targetUrl = `${this.metadata.baseUrl}/browse?order=latest&page=${page}`;
      } else if (page > 1) {
        targetUrl = `${this.metadata.baseUrl}/browse?page=${page}`;
      }

      const html = await sourceHttpClient.fetchText(targetUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);
      const items: SourceManga[] = [];

      const cardNodes = root.querySelectorAll('div.item, div.book-item, div.col-6.col-sm-4.col-md-3');
      for (const node of cardNodes) {
        const linkEl = node.querySelector('a[href^="/book/"]') || node.querySelector('a[href*="/book/"]');
        const href = linkEl?.getAttribute('href');
        if (!href) continue;

        const slugOrId = href.replace(/^\/book\//, '').replace(/\/$/, '');
        const imgEl = node.querySelector('img.thumbnail, img');
        let cover = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || null;
        if (cover && !cover.startsWith('http')) {
          cover = this.toAbsoluteUrl(cover);
        }

        const titleEl = node.querySelector('p.title a, .book-title a') || linkEl;
        const title = this.cleanText(titleEl.text || imgEl?.getAttribute('title') || imgEl?.getAttribute('alt') || slugOrId);
        if (!title) continue;

        const chEl = node.querySelector('a[href^="/read/"], .chapter');
        const latestCh = chEl ? this.cleanText(chEl.text) : undefined;

        if (!items.some((i) => i.url === href)) {
          items.push({
            id: `${this.metadata.id}:${slugOrId}`,
            sourceId: this.metadata.id,
            url: href.startsWith('/') ? href : `/${href}`,
            publicUrl: this.toAbsoluteUrl(href),
            title,
            coverUrl: cover,
            coverHeaders: this.getImageHeaders(),
            locale: 'en',
            state: 'ongoing',
            description: latestCh ? `Latest: ${latestCh}` : undefined,
          });
        }
      }

      if (items.length > 0) {
        return items;
      }
    } catch {
      // Fall through to fallback catalog
    }

    // Fallback: match against static dataset
    const q = filter.query?.toLowerCase().trim();
    const fallbackList = (projectSukiFallbackData as any[]) || [];
    const filtered = q
      ? fallbackList.filter(
          (item) =>
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.href && item.href.toLowerCase().includes(q))
        )
      : fallbackList;

    return filtered.map((item) => {
      const slugOrId = item.href.replace(/^\/book\//, '').replace(/\/$/, '');
      return {
        id: `${this.metadata.id}:${slugOrId}`,
        sourceId: this.metadata.id,
        url: item.href,
        publicUrl: this.toAbsoluteUrl(item.href),
        title: this.cleanText(item.title),
        coverUrl: item.coverUrl || null,
        coverHeaders: this.getImageHeaders(),
        locale: 'en',
        state: 'ongoing',
        description: item.ch ? `Latest: ${item.ch}` : undefined,
      };
    });
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const cleanId = manga.id.replace(`${this.metadata.id}:`, '').replace(/^\/book\//, '');
    const pageUrl = `${this.metadata.baseUrl}/book/${cleanId}`;

    try {
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);

      const titleNode = root.querySelector('h2, .book-title, h1, meta[property="og:title"], title');
      let title = this.cleanText(titleNode?.text || titleNode?.getAttribute('content') || manga.title);
      title = title.replace(/\s*\|\s*Project Suki\s*$/i, '').trim();

      const descNode = root.querySelector('#description, .description, .synopsis, p[itemprop="description"]');
      const description = this.cleanText(descNode?.text || manga.description || '');

      const imgNode = root.querySelector('img.thumbnail, img[itemprop="image"], .book-poster img');
      let cover = imgNode?.getAttribute('src') || imgNode?.getAttribute('data-src') || manga.coverUrl;
      if (cover && !cover.startsWith('http')) {
        cover = this.toAbsoluteUrl(cover);
      }

      const authors = root
        .querySelectorAll('a[href*="/author/"]')
        .map((a) => this.cleanText(a.text))
        .filter(Boolean);

      const artists = root
        .querySelectorAll('a[href*="/artist/"]')
        .map((a) => this.cleanText(a.text))
        .filter(Boolean);

      const tags = root
        .querySelectorAll('a[href*="/genre/"], a[href*="/categories/"], .badge')
        .map((a) => this.cleanText(a.text))
        .filter(Boolean);

      const chaptersCount = root.querySelectorAll('a[href^="/read/"]').length || manga.chaptersCount;

      return {
        ...manga,
        title: title || manga.title,
        description: description || manga.description,
        coverUrl: cover || manga.coverUrl,
        coverHeaders: this.getImageHeaders(),
        authors: authors.length > 0 ? authors : manga.authors,
        artists: artists.length > 0 ? artists : manga.artists,
        tags: tags.length > 0 ? tags : manga.tags,
        chaptersCount,
      };
    } catch {
      return manga;
    }
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const cleanId = manga.id.replace(`${this.metadata.id}:`, '').replace(/^\/book\//, '');
    const pageUrl = `${this.metadata.baseUrl}/book/${cleanId}`;

    try {
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);
      const chapters: SourceChapter[] = [];
      const seen = new Set<string>();

      const links = root.querySelectorAll('a[href*="/read/"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) continue;

        // format: /read/:bookId/:chapterId/:page
        const cleanHref = href.split('?')[0];
        if (seen.has(cleanHref)) continue;
        seen.add(cleanHref);

        const parts = cleanHref.replace(/^\/read\//, '').split('/');
        const bookId = parts[0] || cleanId;
        const chapterId = parts[1] || '0';

        const name = this.cleanText(link.text) || `Chapter ${chapterId}`;
        const numMatch = name.match(/chapter\s*(\d+(?:\.\d+)?)/i) || name.match(/(\d+(?:\.\d+)?)/);
        const chapterNumber = numMatch ? parseFloat(numMatch[1]) : 0;

        chapters.push({
          id: `${this.metadata.id}:${bookId}:${chapterId}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name,
          number: chapterNumber,
          url: cleanHref.startsWith('/') ? cleanHref : `/${cleanHref}`,
          dateUpload: Date.now(),
          scanlator: 'Project Suki',
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
        id: `${this.metadata.id}:${cleanId}:1`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: 'Chapter 1',
        number: 1,
        url: `/read/${cleanId}/1/1`,
        dateUpload: Date.now(),
        scanlator: 'Project Suki',
      },
    ];
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let bookId = '';
    let chapterId = '';

    if (chapter.id && chapter.id.startsWith('projectsuki:')) {
      const parts = chapter.id.replace(/^projectsuki:/, '').split(':');
      bookId = parts[0];
      chapterId = parts[1];
    }
    if (!bookId || !chapterId) {
      if (chapter.url.includes(':')) {
        const parts = chapter.url.split(':');
        bookId = parts[0];
        chapterId = parts[1];
      } else if (chapter.url.includes('/read/')) {
        const parts = chapter.url.replace(/^\/read\//, '').split('/');
        bookId = parts[0];
        chapterId = parts[1];
      }
    }

    const pages: SourcePage[] = [];
    const seenUrls = new Set<string>();

    try {
      // 1. Fetch initial reader page (/read/:bookId/:chapterId/1)
      const pageUrl = `${this.metadata.baseUrl}/read/${bookId || '0'}/${chapterId || '0'}/1`;
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      // Extract page 1 image
      const root = parse(html);
      const imgNodes = root.querySelectorAll('div.strip-reader img, img.img-fluid.center-block, img[src*="/images/gallery/"]');
      for (const node of imgNodes) {
        const src = node.getAttribute('src');
        if (src && src.includes('/images/gallery/') && !src.includes('thumb.png') && !src.includes('placeholder')) {
          const abs = this.toAbsoluteUrl(src);
          if (!seenUrls.has(abs)) {
            seenUrls.add(abs);
            pages.push({
              index: 0,
              url: abs,
              headers: this.getImageHeaders(),
            });
          }
          break; // First image is page 1
        }
      }

      // 2. Fetch all subsequent pages via official POST /callpage endpoint
      if (bookId && chapterId) {
        try {
          const callRes = await sourceHttpClient.post<any>(
            `${this.metadata.baseUrl}/callpage`,
            { bookid: bookId, chapterid: chapterId, first: true },
            {
              headers: {
                ...this.getRequestHeaders(),
                Referer: pageUrl,
                'Content-Type': 'application/json;charset=UTF-8',
              },
              sourceId: this.metadata.id,
            }
          );

          const srcHtml = callRes.data?.src || '';
          if (srcHtml) {
            const matches = srcHtml.match(/src=['"]([^'"]*images\/gallery\/[^'"]*)['"]/gi) || [];
            for (const m of matches) {
              const urlMatch = m.match(/src=['"]([^'"]+)['"]/i);
              if (urlMatch && urlMatch[1]) {
                const abs = this.toAbsoluteUrl(urlMatch[1]);
                if (!seenUrls.has(abs) && !abs.includes('placeholder')) {
                  seenUrls.add(abs);
                  pages.push({
                    index: pages.length,
                    url: abs,
                    headers: this.getImageHeaders(),
                  });
                }
              }
            }
          }
        } catch {
          // If callpage fails, fall through to hash reconstruction if first page succeeded
        }
      }

      // 3. Fallback: If only 1 page was found and callpage didn't populate, extrapolate hash pattern
      if (pages.length === 1 && pages[0].url.includes('/images/gallery/')) {
        const firstUrl = pages[0].url;
        const match = firstUrl.match(/\/images\/gallery\/(\d+)\/([a-f0-9]+)\/(\d+)\??/i);
        if (match) {
          const bId = match[1];
          const hash = match[2];
          for (let p = 2; p <= 35; p++) {
            const pad = String(p).padStart(3, '0');
            const pageUrlExt = `https://projectsuki.com/images/gallery/${bId}/${hash}/${pad}?`;
            pages.push({
              index: pages.length,
              url: pageUrlExt,
              headers: this.getImageHeaders(),
            });
          }
        }
      }

      if (pages.length > 0) {
        return pages;
      }
    } catch {
      // Fallback
    }

    return [];
  }
}
