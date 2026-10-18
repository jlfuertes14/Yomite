/**
 * Toonkotsu Parser
 * Fast SvelteKit-based manga, manhwa, and manhua reader
 * Real Domain: https://toonkotsu.com
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
import { sourceHttpClient, DEFAULT_USER_AGENT } from '../network/httpClient';
import { CloudFlareError, CloudFlareStatus } from '../network/cloudflare';
import fallbackCatalog from '../catalog/toonkotsuFallback.json';

export class ToonkotsuParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: MangaSourceMetadata) {
    super();
    this.metadata = metadata || {
      id: 'toonkotsu',
      name: 'Toonkotsu',
      domain: 'toonkotsu.com',
      baseUrl: 'https://toonkotsu.com',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      description: 'Toonkotsu - Read manga, manhwa, and manhua online with instant updates.',
      enabled: true,
      icon: 'https://www.google.com/s2/favicons?domain=toonkotsu.com&sz=64',
      availableSortOrders: ['popular', 'latest'],
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Updates' },
    ];
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'Action', label: 'Action', group: 'Genre' },
      { id: 'Adventure', label: 'Adventure', group: 'Genre' },
      { id: 'Comedy', label: 'Comedy', group: 'Genre' },
      { id: 'Drama', label: 'Drama', group: 'Genre' },
      { id: 'Fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'Historical', label: 'Historical', group: 'Genre' },
      { id: 'Horror', label: 'Horror', group: 'Genre' },
      { id: 'Mystery', label: 'Mystery', group: 'Genre' },
      { id: 'Romance', label: 'Romance', group: 'Genre' },
      { id: 'School Life', label: 'School Life', group: 'Genre' },
      { id: 'Sci-Fi', label: 'Sci-Fi', group: 'Genre' },
      { id: 'Seinen', label: 'Seinen', group: 'Genre' },
      { id: 'Shounen', label: 'Shounen', group: 'Genre' },
      { id: 'Slice of Life', label: 'Slice of Life', group: 'Genre' },
      { id: 'Sports', label: 'Sports', group: 'Genre' },
      { id: 'Supernatural', label: 'Supernatural', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    if (filter.query && filter.query.trim()) {
      return this.search(filter.query.trim(), page, filter);
    }
    if (filter.order === 'latest') {
      return this.getLatest(page, filter);
    }
    return this.getPopular(page, filter);
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      Referer: 'https://toonkotsu.com/',
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    };
  }

  private async fetchRawHtml(url: string): Promise<string> {
    try {
      return await sourceHttpClient.fetchText(this.toAbsoluteUrl(url), {
        referer: this.metadata.baseUrl,
        sourceId: this.metadata.name,
      });
    } catch (err: any) {
      if (err?.isCloudFlare || err?.name === 'CloudFlareError' || err?.status === 403) {
        throw err;
      }
      return '';
    }
  }

  private getFallbackMatches(query?: string): SourceManga[] {
    const all = (fallbackCatalog as unknown as SourceManga[]) || [];
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q))
    );
  }

  private parseMangaElements($: any): SourceManga[] {
    const list: SourceManga[] = [];
    const seen = new Set<string>();

    // Extract canonical titles from JSON-LD schema if available
    const structuredTitles = new Map<string, string>();
    try {
      const jsonLdText = $('#ui-structured-data').first().html();
      if (jsonLdText) {
        const jsonLd = JSON.parse(jsonLdText);
        const itemList = jsonLd?.['@graph']?.find((g: any) => g?.['@type'] === 'CollectionPage')?.mainEntity?.itemListElement;
        if (Array.isArray(itemList)) {
          for (const item of itemList) {
            if (item.url && item.name) {
              const m = item.url.match(/\/title\/([0-9a-zA-Z_-]+)/);
              if (m) structuredTitles.set(m[1], item.name);
            }
          }
        }
      }
    } catch {}

    $('a[href*="/title/"]').each((_: any, el: any) => {
      const link = $(el);
      const rawHref = link.attr('href') || '';
      // Only titles, not chapter links
      const m = rawHref.match(/^\/title\/([0-9a-zA-Z_-]+)$/);
      if (!m) return;
      const slug = m[1];
      if (seen.has(slug) || slug === 'browse') return;
      seen.add(slug);

      let img = link.find('img').first();
      if (!img.length) {
        img = link.closest('.card, figure, article, li, div').find('img').first();
      }

      let cover =
        img.attr('src') ||
        img.attr('data-src') ||
        img.attr('srcset')?.split(' ')[0] ||
        '';

      if (
        cover.includes('og-image.jpg') ||
        cover.includes('logo') ||
        cover.includes('icon-') ||
        cover.includes('avatar')
      ) {
        cover = '';
      }

      const cleanSlug = slug.replace(/^[a-z0-9]+-/, '');
      const fallbackItem = (fallbackCatalog as unknown as SourceManga[]).find(
        (m) =>
          m.id === `toonkotsu:${slug}` ||
          m.url === `/title/${slug}` ||
          m.url.includes(slug) ||
          m.id.includes(cleanSlug) ||
          m.url.includes(cleanSlug)
      );

      if (!cover && fallbackItem?.coverUrl) {
        cover = fallbackItem.coverUrl;
      }

      if (cover && !cover.startsWith('http')) {
        cover = `https://toonkotsu.com${cover.startsWith('/') ? '' : '/'}${cover}`;
      }

      let title =
        structuredTitles.get(slug) ||
        img.attr('alt')?.replace(/^Cover:\s*/i, '').trim() ||
        link.find('.title, h2, h3, h4, p, span').first().text().trim() ||
        link.attr('title') ||
        fallbackItem?.title ||
        '';

      if (!title || title.length < 2) {
        title = cleanSlug.replace(/-/g, ' ');
      }

      // Ensure clean Title Case if all lowercase (e.g. from slug fallback)
      if (title && (title === title.toLowerCase() || title.includes('-'))) {
        if (title === title.toLowerCase()) {
          title = title
            .replace(/^[a-z0-9]+-/, '')
            .replace(/-/g, ' ')
            .trim()
            .replace(/\b[a-z]/g, (c) => c.toUpperCase())
            .replace(/'([A-Z])\b/g, (_, c) => `'${c.toLowerCase()}`);
        }
      }

      list.push({
        id: `toonkotsu:${slug}`,
        sourceId: this.metadata.id,
        title: title.trim(),
        url: `/title/${slug}`,
        publicUrl: `https://toonkotsu.com/title/${slug}`,
        coverUrl: cover,
        coverHeaders: this.getRequestHeaders(),
        state: 'ongoing',
      });
    });

    return list;
  }

  public async getPopular(page = 1, _filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const url = page === 1 ? 'https://toonkotsu.com/' : `https://toonkotsu.com/manga/browse?page=${page}`;
      const $ = await this.fetchHtml(url);
      const mangas = this.parseMangaElements($);
      if (mangas.length > 0) return mangas;
    } catch {
      // Fallback
    }
    return this.getFallbackMatches();
  }

  public async getLatest(page = 1, _filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const url = `https://toonkotsu.com/updates?page=${page}`;
      const $ = await this.fetchHtml(url);
      const mangas = this.parseMangaElements($);
      if (mangas.length > 0) return mangas;
    } catch {
      // Fallback
    }
    return this.getFallbackMatches();
  }

  public async search(query: string, page = 1, _filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const url = `https://toonkotsu.com/search?q=${encodeURIComponent(query)}&page=${page}`;
      const $ = await this.fetchHtml(url);
      const mangas = this.parseMangaElements($);
      if (mangas.length > 0) return mangas;
    } catch {
      // Fallback
    }
    return this.getFallbackMatches(query);
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const rawId = manga.url || manga.id;
    const slug = rawId.replace(/^toonkotsu:/, '').replace(/^\/title\//, '');
    const mangaUrl = `https://toonkotsu.com/title/${slug}`;

    try {
      const $ = await this.fetchHtml(mangaUrl);
      let title =
        $('meta[property="og:title"]').attr('content')?.replace(/\s*-\s*Toonkotsu$/i, '').trim() ||
        $('h1').first().text().trim() ||
        slug.replace(/^[a-z0-9]+-/, '').replace(/-/g, ' ');

      if (title && title === title.toLowerCase()) {
        title = title
          .replace(/^[a-z0-9]+-/, '')
          .replace(/-/g, ' ')
          .trim()
          .replace(/\b[a-z]/g, (c) => c.toUpperCase())
          .replace(/'([A-Z])\b/g, (_, c) => `'${c.toLowerCase()}`);
      }

      const desc =
        $('meta[property="og:description"]').attr('content')?.trim() ||
        $('.description, .summary').first().text().trim() ||
        '';

      let cover = '';
      const cdnImg =
        $('img[src*="/cdn/c/"]').first().attr('src') ||
        $('a[href*="/cdn/c/"]').first().attr('href') ||
        $('.ui-cover').first().attr('src') ||
        '';
      if (cdnImg && !cdnImg.includes('og-image.jpg') && !cdnImg.includes('logo')) {
        cover = cdnImg;
      }

      if (!cover) {
        const metaImg = $('meta[property="og:image"]').attr('content') || '';
        if (metaImg && !metaImg.includes('og-image.jpg') && !metaImg.includes('logo')) {
          cover = metaImg;
        }
      }

      const tags: string[] = [];
      $('a[href*="/tag/"]').each((_: any, el: any) => {
        const text = $(el).text().trim();
        if (text && !tags.includes(text)) tags.push(text);
      });

      const fallbackCover = (fallbackCatalog as unknown as SourceManga[]).find(
        (m) => m.id === manga.id || m.url === `/title/${slug}` || m.url === slug
      )?.coverUrl;

      return {
        ...manga,
        id: `toonkotsu:${slug}`,
        sourceId: this.metadata.id,
        title,
        url: `/title/${slug}`,
        publicUrl: mangaUrl,
        coverUrl: cover || fallbackCover || manga.coverUrl,
        coverHeaders: this.getRequestHeaders(),
        description: desc || manga.description,
        tags: tags.length > 0 ? tags : manga.tags,
        state: 'ongoing',
      };
    } catch {
      // Do not rethrow Cloudflare error on getDetails so fallback catalog metadata can be returned
    }

    const fallback = (fallbackCatalog as unknown as SourceManga[]).find(
      (m) => m.id === manga.id || m.url === `/title/${slug}` || m.url === slug
    );
    if (fallback) return fallback;

    return {
      ...manga,
      id: `toonkotsu:${slug}`,
      sourceId: this.metadata.id,
      title: manga.title || slug.replace(/^[a-z0-9]+-/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      url: `/title/${slug}`,
      publicUrl: mangaUrl,
      coverUrl: manga.coverUrl || '',
      coverHeaders: this.getRequestHeaders(),
      state: 'ongoing',
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const rawId = manga.url || manga.id;
    const slug = rawId.replace(/^toonkotsu:/, '').replace(/^\/title\//, '');
    const mangaUrl = `https://toonkotsu.com/title/${slug}`;

    try {
      const html = await this.fetchRawHtml(mangaUrl);
      const list: SourceChapter[] = [];
      const seen = new Set<string>();

      // Matches: href="/title/[slug]/[chapterId]-chapter-[chapterNum]"
      const re = /href="(\/title\/[^"]*\/([0-9]+)-chapter-([0-9.]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        const chPath = m[1];
        const chId = m[2];
        const chNum = parseFloat(m[3]);
        const text = m[4].replace(/<[^>]+>/g, '').trim();
        if (seen.has(chId)) continue;
        seen.add(chId);

        list.push({
          id: `toonkotsu:${chPath.replace(/^\//, '')}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name: text || `Chapter ${chNum}`,
          number: chNum,
          url: chPath,
        });
      }

      if (list.length > 0) return list;
    } catch (err: any) {
      if (err?.isCloudFlare || err?.name === 'CloudFlareError' || err?.status === 403) {
        throw err;
      }
    }

    return [];
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let path = chapter.url || '';
    if (!path || path.startsWith('toonkotsu:')) {
      const clean = (chapter.url || chapter.id).replace(/^toonkotsu:/, '');
      path = clean.startsWith('/') ? clean : `/${clean}`;
    }
    const chapterUrl = `https://toonkotsu.com${path.startsWith('/') ? path : `/${path}`}`;

    try {
      const html = await this.fetchRawHtml(chapterUrl);
      const pagesList: SourcePage[] = [];

      // 1. Look for images inside reader viewport (strictly excluding covers & UI assets)
      const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/g;
      let match;
      const seen = new Set<string>();
      while ((match = imgRegex.exec(html)) !== null) {
        const u = match[1];
        // CRITICAL FIX: Strictly filter out cover images (/cdn/c/), group logos (/cdn/g/), avatars, icons, banners
        if (
          !seen.has(u) &&
          !u.includes('/cdn/c/') &&
          !u.includes('/cdn/g/') &&
          !u.includes('favicon') &&
          !u.includes('logo') &&
          !u.includes('avatar') &&
          !u.includes('og-image') &&
          !u.includes('icon-') &&
          !u.includes('banner') &&
          !u.includes('ad')
        ) {
          seen.add(u);
          pagesList.push({
            index: pagesList.length,
            url: u,
            headers: {
              Referer: 'https://toonkotsu.com/',
              'User-Agent': DEFAULT_USER_AGENT,
            },
          });
        }
      }

      if (pagesList.length > 0) return pagesList;

      // 2. If client-rendered or protected by Cloudflare Turnstile bot check
      if (
        html.includes('challenges.cloudflare.com') ||
        html.includes('Just a moment...') ||
        html.includes('data-reader-page')
      ) {
        throw new CloudFlareError(
          'Cloudflare verification challenge required for toonkotsu.com',
          this.metadata.id,
          chapterUrl,
          'toonkotsu.com',
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
    } catch (err: any) {
      if (err?.isCloudFlare || err?.name === 'CloudFlareError' || err?.status === 403) {
        throw err;
      }
      console.warn(`[ToonkotsuParser] Failed to get pages for chapter ${chapter.id}:`, err?.message || err);
    }

    return [];
  }
}
