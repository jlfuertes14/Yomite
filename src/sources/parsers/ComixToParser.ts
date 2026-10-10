/**
 * Comix.to Parser
 *
 * Scrapes manga catalog, details, chapters, and reader pages from comix.to.
 * Supports SSR initial-data extraction and full Cloudflare Turnstile challenge detection.
 */
import { BaseParser } from './BaseParser';
import {
  MangaSourceMetadata,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
  SourceTag,
} from '../types';
import { DEFAULT_USER_AGENT } from '../network/httpClient';
import { CloudFlareError, CloudFlareStatus } from '../network/cloudflare';

export class ComixToParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'comix-to',
      name: 'Comix',
      domain: 'comix.to',
      baseUrl: 'https://comix.to',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=comix.to&sz=64',
      description: 'Massive library of manga, manhwa, and comics from Comix.to.',
      availableSortOrders: ['popular', 'latest', 'alphabetical', 'rating'],
      enabled: true,
      ...metadata,
    };
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: '6', label: 'Action', group: 'Genre' },
      { id: '87264', label: 'Adult', group: 'Genre' },
      { id: '7', label: 'Adventure', group: 'Genre' },
      { id: '8', label: 'Boys Love', group: 'Genre' },
      { id: '9', label: 'Comedy', group: 'Genre' },
      { id: '10', label: 'Crime', group: 'Genre' },
      { id: '11', label: 'Drama', group: 'Genre' },
      { id: '87265', label: 'Ecchi', group: 'Genre' },
      { id: '12', label: 'Fantasy', group: 'Genre' },
      { id: '13', label: 'Girls Love', group: 'Genre' },
      { id: '40', label: 'Harem', group: 'Genre' },
      { id: '87266', label: 'Hentai', group: 'Genre' },
      { id: '14', label: 'Historical', group: 'Genre' },
      { id: '15', label: 'Horror', group: 'Genre' },
      { id: '16', label: 'Isekai', group: 'Genre' },
      { id: '17', label: 'Magical Girls', group: 'Genre' },
      { id: '87267', label: 'Mature', group: 'Genre' },
      { id: '18', label: 'Mecha', group: 'Genre' },
      { id: '19', label: 'Medical', group: 'Genre' },
      { id: '20', label: 'Mystery', group: 'Genre' },
      { id: '21', label: 'Philosophical', group: 'Genre' },
      { id: '22', label: 'Psychological', group: 'Genre' },
      { id: '23', label: 'Romance', group: 'Genre' },
      { id: '24', label: 'Sci-Fi', group: 'Genre' },
      { id: '25', label: 'Slice of Life', group: 'Genre' },
      { id: '87268', label: 'Smut', group: 'Genre' },
      { id: '26', label: 'Sports', group: 'Genre' },
      { id: '27', label: 'Superhero', group: 'Genre' },
      { id: '28', label: 'Thriller', group: 'Genre' },
      { id: '29', label: 'Tragedy', group: 'Genre' },
      { id: '30', label: 'Wuxia', group: 'Genre' },
    ];
  }

  private parseInitialData(rawHtml: string): any {
    const startTag = 'id="initial-data">';
    const idx = rawHtml.indexOf(startTag);
    if (idx === -1) return null;
    const end = rawHtml.indexOf('</script>', idx);
    if (end === -1) return null;
    try {
      return JSON.parse(rawHtml.slice(idx + startTag.length, end));
    } catch {
      return null;
    }
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url: string;

    const hasQuery = !!filter.query?.trim();
    const hasTags = !!(filter.tags && filter.tags.length > 0);

    if (hasQuery) {
      const q = encodeURIComponent(filter.query!.trim());
      url = `${this.metadata.baseUrl}/browse?q=${q}&page=${page}`;
    } else if (hasTags) {
      const tag = filter.tags![0];
      const tagParam = /^\d+$/.test(tag) ? `genres=${tag}` : `genre=${encodeURIComponent(tag.toLowerCase())}`;
      url = `${this.metadata.baseUrl}/browse?${tagParam}&page=${page}`;
    } else if (page === 1 && (filter.order === 'popular' || !filter.order)) {
      // Home page contains 100+ curated trending and popular titles in SSR initial-data
      url = `${this.metadata.baseUrl}/`;
    } else {
      let sort = 'views:desc';
      if (filter.order === 'latest') sort = 'updated_at:desc';
      else if (filter.order === 'rating') sort = 'rating:desc';
      else if (filter.order === 'alphabetical') sort = 'title:asc';
      else if (filter.order === 'popular') sort = 'views:desc';

      url = `${this.metadata.baseUrl}/browse?sort=${sort}&page=${page}`;
    }

    const $ = await this.fetchHtml(url);
    const results: SourceManga[] = [];
    const seen = new Set<string>();

    // 1. Try DOM extraction
    $('a[href*="/title/"]').each((_, el) => {
      const href = el.attr('href') || '';
      if (!href || href.includes('-chapter-') || href.includes('/chapter/')) return;
      const slugMatch = href.match(/\/title\/([a-z0-9]+-[^/?#]+)/i);
      if (!slugMatch) return;
      const slug = slugMatch[1];
      if (seen.has(slug)) return;
      seen.add(slug);

      const title = this.cleanText(
        el.find('h3, h4, .title, .mpage__title, span').first().text() ||
        el.attr('title') ||
        el.find('img').first().attr('alt') ||
        this.titleFromSlug(slug)
      );

      if (!title || /chapter/i.test(title)) return;

      const img = el.find('img').first();
      const coverUrl = img.attr('src') || img.attr('data-src') || null;

      results.push({
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        url: `${this.metadata.baseUrl}/title/${slug}`,
        publicUrl: `${this.metadata.baseUrl}/title/${slug}`,
        title,
        coverUrl: coverUrl ? this.toAbsoluteUrl(coverUrl) : null,
      });
    });

    // 2. Try JSON initial-data extraction
    const rawHtml = $.root?.innerHTML || '';
    const initialData = this.parseInitialData(rawHtml);
    if (initialData?.queries) {
      for (const [key, val] of Object.entries(initialData.queries)) {
        if (Array.isArray(val)) {
          for (const item of val as any[]) {
            if (item && item.title && (item.url || item.hid)) {
              const itemUrl = item.url || `/title/${item.hid}`;
              const slug = itemUrl.replace(/^\/title\//, '').replace(/^\/+/, '');
              if (seen.has(slug)) continue;
              seen.add(slug);

              results.push({
                id: `${this.metadata.id}:${slug}`,
                sourceId: this.metadata.id,
                url: `${this.metadata.baseUrl}/title/${slug}`,
                publicUrl: `${this.metadata.baseUrl}/title/${slug}`,
                title: this.cleanText(item.title),
                coverUrl: item.poster?.large || item.poster?.medium || null,
                rating: item.ratedAvg ? Number(item.ratedAvg.toFixed(1)) : undefined,
                description: item.synopsis ? this.cleanText(item.synopsis) : undefined,
                state: item.status === 'releasing' ? 'ongoing' : item.status === 'finished' ? 'completed' : undefined,
              });
            }
          }
        }
      }
    }

    // 3. If browse page returned 0 cards because Comix.to renders /browse on client-side,
    // fallback gracefully to home page SSR catalog (100+ titles) filtered by query or tag!
    if (results.length === 0 && (hasQuery || hasTags || url !== `${this.metadata.baseUrl}/`)) {
      try {
        const homeManga = await this.getList({ page: 1, order: 'popular' });
        if (hasQuery) {
          const q = filter.query!.trim().toLowerCase();
          return homeManga.filter(
            (m) =>
              m.title.toLowerCase().includes(q) ||
              m.description?.toLowerCase().includes(q)
          );
        }
        if (hasTags) {
          const tagLower = filter.tags![0].toLowerCase().trim();
          const tagObj = (await this.getAvailableTags()).find(
            (t) => t.id === tagLower || t.label.toLowerCase() === tagLower
          );
          const tagKeyword = tagObj ? tagObj.label.toLowerCase() : tagLower;
          const filtered = homeManga.filter(
            (m) =>
              m.title.toLowerCase().includes(tagKeyword) ||
              m.description?.toLowerCase().includes(tagKeyword)
          );
          return filtered.length > 0 ? filtered : homeManga;
        }
        return homeManga;
      } catch {}
    }

    // 4. Only throw CloudFlareError if the page is an actual Cloudflare Challenge page
    if (results.length === 0) {
      const lower = rawHtml.toLowerCase();
      const isTrueChallenge =
        lower.includes('just a moment...') ||
        lower.includes('cf-turnstile') ||
        lower.includes('challenge-error-title') ||
        lower.includes('checking your browser before accessing');

      if (isTrueChallenge) {
        throw new CloudFlareError(
          `[${this.metadata.name}] Cloudflare verification required for comix.to.`,
          this.metadata.id,
          url,
          this.metadata.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
    }

    return results;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const url = this.toTitleUrl(manga.url);
    const $ = await this.fetchHtml(url);

    let title = this.cleanText(
      $('h1.mpage__title, .mpage__title, h1').first().text() ||
      manga.title
    );

    let cover =
      $('img.mpage__poster, .mpage__poster img').first().attr('src') ||
      $('img.mpage__poster, .mpage__poster img').first().attr('data-src') ||
      manga.coverUrl;

    let description = this.cleanText(
      $('.mpage__desc, .mpage__synopsis, [class*="desc"]').first().text()
    );

    const tags: string[] = [];
    $('a[href*="/genre/"], a[href*="/tag/"], .badge, .genre').each((_, el) => {
      const tagText = this.cleanText(el.text());
      if (tagText && !tags.includes(tagText)) tags.push(tagText);
    });

    let rating = manga.rating;
    let state = manga.state;

    // Enhance from initial-data if present
    const rawHtml = $.root?.innerHTML || '';
    const initialData = this.parseInitialData(rawHtml);
    if (initialData?.queries) {
      for (const [key, val] of Object.entries(initialData.queries)) {
        if (key.includes('detail') && val && (val as any).title) {
          const detail = val as any;
          if (detail.title) title = this.cleanText(detail.title);
          if (detail.synopsis) description = this.cleanText(detail.synopsis);
          if (detail.poster?.large || detail.poster?.medium) {
            cover = detail.poster.large || detail.poster.medium;
          }
          if (typeof detail.ratedAvg === 'number') {
            rating = Number(detail.ratedAvg.toFixed(1));
          }
          if (detail.status === 'releasing') state = 'ongoing';
          else if (detail.status === 'finished') state = 'completed';

          if (Array.isArray(detail.genres)) {
            for (const g of detail.genres) {
              const name = typeof g === 'string' ? g : g?.name || g?.label || g?.slug;
              if (name && !tags.includes(name)) tags.push(name);
            }
          }
          break;
        }
      }
    }

    const chapters = this.parseChapterLinks($, manga.id, url);

    // If detail page is completely empty and true Turnstile challenge is active
    const lower = rawHtml.toLowerCase();
    if (!description && !cover && (lower.includes('just a moment...') || lower.includes('cf-turnstile'))) {
      throw new CloudFlareError(
        `[${this.metadata.name}] Cloudflare verification required for comix.to.`,
        this.metadata.id,
        url,
        this.metadata.domain,
        CloudFlareStatus.CAPTCHA_CHALLENGE
      );
    }

    return {
      ...manga,
      title,
      url,
      publicUrl: url,
      coverUrl: cover ? this.toAbsoluteUrl(cover) : manga.coverUrl,
      description: description || manga.description,
      chaptersCount: chapters.length || manga.chaptersCount,
      rating: rating ?? manga.rating,
      state: state ?? manga.state,
      tags: tags.length ? tags : manga.tags,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const url = this.toTitleUrl(manga.url);
    const $ = await this.fetchHtml(url);
    let chapters = this.parseChapterLinks($, manga.id, url);

    const rawHtml = $.root?.innerHTML || '';
    const initialData = this.parseInitialData(rawHtml);
    let detail: any = null;
    if (initialData?.queries) {
      for (const [k, v] of Object.entries(initialData.queries)) {
        if (k.includes('detail') && v) {
          detail = v;
          break;
        }
      }
    }

    // If chapters were not in static HTML, synthesize from initialData URLs
    if (chapters.length === 0 && detail) {
      const comicSlug = manga.url.replace(/^.*\/title\//, '').replace(/^\/+/, '').split('/')[0];
      const seenUrls = new Set<string>();

      // Latest Chapter
      if (detail.latestChapterUrl) {
        const latestMatch = detail.latestChapterUrl.match(/\/title\/([^/]+)\/([^/?#]+)/i);
        const chSlug = latestMatch?.[2] || '';
        const num = detail.latestChapter || this.parseChapterNumber(chSlug) || 1;
        const absUrl = this.toAbsoluteUrl(detail.latestChapterUrl, this.metadata.baseUrl);
        seenUrls.add(absUrl);
        chapters.push({
          id: `${this.metadata.id}:${comicSlug}:${chSlug}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          url: absUrl,
          name: `Chapter ${num}`,
          number: num,
          scanlator: 'Comix',
        });
      }

      // First Chapter
      if (detail.firstChapterUrl) {
        const absUrl = this.toAbsoluteUrl(detail.firstChapterUrl, this.metadata.baseUrl);
        if (!seenUrls.has(absUrl)) {
          seenUrls.add(absUrl);
          const firstMatch = detail.firstChapterUrl.match(/\/title\/([^/]+)\/([^/?#]+)/i);
          const chSlug = firstMatch?.[2] || '';
          const num = this.parseChapterNumber(chSlug) || 1;
          chapters.push({
            id: `${this.metadata.id}:${comicSlug}:${chSlug}`,
            sourceId: this.metadata.id,
            mangaId: manga.id,
            url: absUrl,
            name: `Chapter ${num}`,
            number: num,
            scanlator: 'Comix',
          });
        }
      }

      // Sort chapters descending
      chapters.sort((a, b) => b.number - a.number);
    }

    if (chapters.length === 0) {
      const lower = rawHtml.toLowerCase();
      if (
        lower.includes('just a moment...') ||
        lower.includes('cf-turnstile') ||
        lower.includes('challenge-error-title')
      ) {
        throw new CloudFlareError(
          `[${this.metadata.name}] Cloudflare verification required for comix.to.`,
          this.metadata.id,
          url,
          this.metadata.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
    }

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const raw = chapter.url || chapter.id.replace(/^[^:]+:/, '');
    const url = this.toChapterUrl(raw);
    const $ = await this.fetchHtml(url);
    const pages: SourcePage[] = [];
    const seen = new Set<string>();

    $('img.rpage__img, .rpage-item img, .rpage__main img, #viewer img, .reader img').each((index, el) => {
      const src =
        el.attr('data-src') ||
        el.attr('data-lazy-src') ||
        el.attr('src') ||
        '';
      if (src && !src.includes('data:image') && !/logo|avatar|icon|banner|placeholder/i.test(src)) {
        const absUrl = this.toAbsoluteUrl(src);
        if (!seen.has(absUrl)) {
          seen.add(absUrl);
          pages.push({
            index: pages.length,
            url: absUrl,
            headers: this.getRequestHeaders(),
          });
        }
      }
    });

    // Check embedded JSON or script if no images found directly
    if (!pages.length) {
      const html = $.root?.innerHTML || '';
      const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:webp|jpg|jpeg|png)(?:\?[^\s"'<>]*)?/gi;
      let idx = 0;
      for (const match of html.matchAll(imgRegex)) {
        const u = match[0];
        if (/\/chapters?\/|\/pages?\/|\/upload\//i.test(u) && !seen.has(u)) {
          seen.add(u);
          pages.push({
            index: idx++,
            url: u,
            headers: this.getRequestHeaders(),
          });
        }
      }

      if (
        pages.length === 0 &&
        (html.includes('challenge-platform') ||
          html.includes('challenges.cloudflare.com') ||
          html.includes('__cf$cv$params'))
      ) {
        throw new CloudFlareError(
          `[${this.metadata.name}] Cloudflare verification required for comix.to.`,
          this.metadata.id,
          url,
          this.metadata.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
    }

    return pages;
  }

  private parseChapterLinks($: any, mangaId: string, baseUrl: string): SourceChapter[] {
    const chapters: SourceChapter[] = [];
    const seen = new Set<string>();

    $('a.mchap-row__primary, a[href*="/title/"][href*="-chapter-"]').each((_, el) => {
      const href = el.attr('href') || '';
      if (!href) return;
      const url = this.toAbsoluteUrl(href, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);

      const titleMatch = url.match(/\/title\/([^/]+)\/([^/?#]+)/i);
      const comicSlug = titleMatch?.[1] || '';
      const chapterSlug = titleMatch?.[2] || '';

      const number = this.parseChapterNumber(el.text()) || this.parseChapterNumber(chapterSlug);
      const name = this.cleanText(el.text()) || `Chapter ${number}`;

      const groupName = this.cleanText(el.parent().find('a.mchap-row__group, .group').first().text()) || 'Comix';

      chapters.push({
        id: `${this.metadata.id}:${comicSlug}:${chapterSlug}`,
        sourceId: this.metadata.id,
        mangaId,
        url,
        name,
        number,
        scanlator: groupName,
      });
    });

    return chapters;
  }

  private toTitleUrl(slugOrUrl: string): string {
    if (/^https?:\/\//i.test(slugOrUrl)) return slugOrUrl;
    const clean = slugOrUrl.replace(/^[^:]+:/, '').replace(/^\/+/, '');
    if (clean.startsWith('title/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/title/${clean}`;
  }

  private toChapterUrl(rawIdOrUrl: string): string {
    if (/^https?:\/\//i.test(rawIdOrUrl)) return rawIdOrUrl;
    const parts = rawIdOrUrl.split(':');
    if (parts.length >= 3) {
      const comicSlug = parts[parts.length - 2];
      const chSlug = parts[parts.length - 1];
      return `${this.metadata.baseUrl}/title/${comicSlug}/${chSlug}`;
    }
    const clean = rawIdOrUrl.replace(/^\/+/, '');
    if (clean.startsWith('title/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/title/${clean}`;
  }

  private titleFromSlug(slug: string): string {
    const withoutId = slug.replace(/^[a-z0-9]+-/i, '');
    return withoutId
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
