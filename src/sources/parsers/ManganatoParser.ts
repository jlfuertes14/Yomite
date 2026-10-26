/**
 * Manganato Parser (manganato.gg)
 * Resilient catalog scrapers, in-memory query fallback,
 * async JSON chapter loader, WebP reader extraction,
 * and Referer-protected image delivery.
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
import { ParsedHtml } from '../network/htmlParser';
import { CloudFlareCookieManager } from '../network/cloudflare';

export class ManganatoParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'manganato',
      name: 'Manganato',
      domain: 'manganato.gg',
      baseUrl: 'https://www.manganato.gg',
      locale: 'en',
      isNsfw: false,
      version: '2.1.0',
      icon: 'https://www.google.com/s2/favicons?domain=www.manganato.gg&sz=64',
      description:
        'Massive manga catalog with fast page loads and extensive ongoing series.',
      availableSortOrders: ['latest', 'popular', 'newest'],
      enabled: true,
      ...metadata,
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'latest', label: 'Latest Updates' },
      { id: 'popular', label: 'Popular / Top View' },
      { id: 'newest', label: 'Newest Releases' },
    ];
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: 'https://www.manganato.gg/',
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'action', label: 'Action' },
      { id: 'adventure', label: 'Adventure' },
      { id: 'comedy', label: 'Comedy' },
      { id: 'cooking', label: 'Cooking' },
      { id: 'drama', label: 'Drama' },
      { id: 'fantasy', label: 'Fantasy' },
      { id: 'gender-bender', label: 'Gender Bender' },
      { id: 'harem', label: 'Harem' },
      { id: 'historical', label: 'Historical' },
      { id: 'horror', label: 'Horror' },
      { id: 'isekai', label: 'Isekai' },
      { id: 'josei', label: 'Josei' },
      { id: 'manhua', label: 'Manhua' },
      { id: 'manhwa', label: 'Manhwa' },
      { id: 'martial-arts', label: 'Martial Arts' },
      { id: 'mecha', label: 'Mecha' },
      { id: 'medical', label: 'Medical' },
      { id: 'mystery', label: 'Mystery' },
      { id: 'psychological', label: 'Psychological' },
      { id: 'romance', label: 'Romance' },
      { id: 'school-life', label: 'School Life' },
      { id: 'sci-fi', label: 'Sci-fi' },
      { id: 'seinen', label: 'Seinen' },
      { id: 'shoujo', label: 'Shoujo' },
      { id: 'shoujo-ai', label: 'Shoujo Ai' },
      { id: 'shounen', label: 'Shounen' },
      { id: 'shounen-ai', label: 'Shounen Ai' },
      { id: 'slice-of-life', label: 'Slice of Life' },
      { id: 'smut', label: 'Smut' },
      { id: 'sports', label: 'Sports' },
      { id: 'supernatural', label: 'Supernatural' },
      { id: 'tragedy', label: 'Tragedy' },
      { id: 'webtoons', label: 'Webtoons' },
    ];
  }

  /**
   * Helper to parse manga card elements with Referer-authenticated cover headers
   */
  private parseCards($: ParsedHtml): SourceManga[] {
    const mangaList: SourceManga[] = [];
    const seen = new Set<string>();

    const items = $(
      '.item, .content-genres-item, .search-story-item, .list-truyen-item-wrap, .item-story, .panel-content-genres .content-genres-item, .list-comic-item-wrap'
    );

    if (items.length > 0) {
      items.each((_, el) => {
        const item = $(el);
        const link = item
          .find('.slide-caption h3 a, h3 a, a.genres-item-name, a.item-title, .story-name a, a.list-story-item')
          .first();
        const href = link.attr('href') || '';
        const title = this.cleanText(link.attr('title') || link.text());
        const img = item.find('img').first();
        const cover = img.attr('data-src') || img.attr('src') || null;
        const ratingStr = item.find('.genres-item-rate, .rate, span[data-rating]').text();
        const rating = ratingStr ? parseFloat(ratingStr) : undefined;

        if (href && title && !seen.has(href)) {
          seen.add(href);
          const slugMatch = href.match(/\/manga\/([^/?#]+)/);
          const slug = slugMatch ? slugMatch[1] : href.replace(/^https?:\/\//, '').replace(/[/?#]+/g, '_');
          mangaList.push({
            id: `${this.metadata.id}:${slug}`,
            sourceId: this.metadata.id,
            title,
            url: href,
            publicUrl: href.startsWith('http') ? href : this.toAbsoluteUrl(href),
            coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : null,
            coverHeaders: {
              Referer: 'https://www.manganato.gg/',
              'User-Agent': DEFAULT_USER_AGENT,
            },
            rating,
            state: 'ongoing',
          });
        }
      });
    }

    // Direct anchor fallback
    $('a.list-story-item, a[href*="/manga/"]').each((_, el) => {
      const link = $(el);
      const href = link.attr('href') || '';
      if (!href || href.includes('/chapter-') || href.includes('/chapter/') || href.includes('/manga-list/')) return;
      const title = this.cleanText(link.attr('title') || link.text() || '');
      const img = link.find('img').first();
      const cover = img.attr('data-src') || img.attr('src') || null;

      if (href && title && !seen.has(href)) {
        seen.add(href);
        const slugMatch = href.match(/\/manga\/([^/?#]+)/);
        const slug = slugMatch ? slugMatch[1] : href.replace(/^https?:\/\//, '').replace(/[/?#]+/g, '_');
        mangaList.push({
          id: `${this.metadata.id}:${slug}`,
          sourceId: this.metadata.id,
          title,
          url: href,
          publicUrl: href.startsWith('http') ? href : this.toAbsoluteUrl(href),
          coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : null,
          coverHeaders: {
            Referer: 'https://www.manganato.gg/',
            'User-Agent': DEFAULT_USER_AGENT,
          },
          state: 'ongoing',
        });
      }
    });

    return mangaList;
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const hasQuery = !!(filter.query && filter.query.trim().length > 0);
    const q = filter.query ? filter.query.trim().toLowerCase() : '';

    // 1. Text Search Mode
    if (hasQuery) {
      const formattedQuery = q.replace(/[^a-z0-9]+/g, '_');
      const slugHyphen = q.replace(/[^a-z0-9]+/g, '-');
      const slugUnderscore = formattedQuery;

      const directMatches: SourceManga[] = [];
      const seen = new Set<string>();

      // A. Direct slug check (bypasses Cloudflare completely for exact titles like firefly-wedding, solo-leveling, etc.)
      for (const s of [slugHyphen, slugUnderscore]) {
        if (!s) continue;
        try {
          const directUrl = `${this.metadata.baseUrl}/manga/${s}`;
          const $ = await this.fetchHtml(directUrl, { silent: true });
          const title = this.cleanText(
            $('.story-info-right h1, .manga-info-text h1, .manga-info-top h1, h1').first().text()
          );
          if (title && !seen.has(directUrl)) {
            seen.add(directUrl);
            const cover =
              $('.thumbnail-wrap img, .story-info-left img, .manga-info-pic img, img[fetchpriority="high"]')
                .first()
                .attr('src') || null;

            directMatches.push({
              id: `${this.metadata.id}:${s}`,
              sourceId: this.metadata.id,
              title,
              url: directUrl,
              publicUrl: directUrl,
              coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : null,
              coverHeaders: {
                Referer: 'https://www.manganato.gg/',
                'User-Agent': DEFAULT_USER_AGENT,
              },
              state: 'ongoing',
            });
            break;
          }
        } catch {
          // Direct slug not found, continue
        }
      }

      // B. Check open catalog feeds (hot, latest, new) without Cloudflare
      const catalogMatches: SourceManga[] = [];
      try {
        const catalogUrls = [
          `${this.metadata.baseUrl}/manga-list/hot-manga?page=1`,
          `${this.metadata.baseUrl}/manga-list/hot-manga?page=2`,
          `${this.metadata.baseUrl}/manga-list/latest-manga?page=1`,
          `${this.metadata.baseUrl}/manga-list/latest-manga?page=2`,
          `${this.metadata.baseUrl}/manga-list/new-manga?page=1`,
        ];
        const docs = await Promise.all(catalogUrls.map((u) => this.fetchHtml(u)));
        const combined = docs.flatMap((doc) => this.parseCards(doc));
        for (const item of combined) {
          if (!seen.has(item.url) && item.title.toLowerCase().includes(q)) {
            seen.add(item.url);
            catalogMatches.push(item);
          }
        }
      } catch {
        // Ignore feed errors
      }

      const foundCombined = [...directMatches, ...catalogMatches];
      if (foundCombined.length > 0) {
        return foundCombined;
      }

      // C. Fallback: Query search endpoint
      const searchUrl = `${this.metadata.baseUrl}/search/story/${formattedQuery}?page=${page}`;
      try {
        const $ = await this.fetchHtml(searchUrl);
        const searchResults = this.parseCards($);
        if (searchResults.length > 0) {
          return searchResults;
        }
      } catch (err: any) {
        // Rethrow so user is prompted to verify in WebView modal if needed
        throw err;
      }

      return [];
    }

    // 2. Genre / Tag Filtering Mode
    if (filter.tags && filter.tags.length > 0) {
      const genre = filter.tags[0].toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      let sortType = 'latest';
      if (filter.order === 'popular') sortType = 'topview';
      else if (filter.order === 'newest') sortType = 'newest';
      const url = `${this.metadata.baseUrl}/genre/${genre}?type=${sortType}&page=${page}`;
      const $ = await this.fetchHtml(url);
      return this.parseCards($);
    }

    // 3. Sort Order Mode
    let url: string;
    if (filter.order === 'popular') {
      url = `${this.metadata.baseUrl}/manga-list/hot-manga?page=${page}`;
    } else if (filter.order === 'newest') {
      url = `${this.metadata.baseUrl}/manga-list/new-manga?page=${page}`;
    } else {
      url = `${this.metadata.baseUrl}/manga-list/latest-manga?page=${page}`;
    }

    const $ = await this.fetchHtml(url);
    return this.parseCards($);
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    let fullUrl = manga.url || '';
    if (!fullUrl.startsWith('http')) {
      const slug = manga.url.replace(/^manganato:/, '').replace(/^\/+/, '');
      fullUrl = `${this.metadata.baseUrl}/manga/${slug}`;
    }
    const $ = await this.fetchHtml(fullUrl);

    const title =
      this.cleanText(
        $('.manga-info-text h1, .story-info-right h1, .manga-info-top h1, h1').first().text()
      ) || manga.title;

    const cover =
      $('.thumbnail-wrap img, .story-info-left img, .manga-info-pic img, img[fetchpriority="high"]')
        .first()
        .attr('src') || manga.coverUrl;

    const description = this.cleanText(
      $('#contentBox, .panel-story-info-description, #noidungm')
        .first()
        .text()
        .replace(/^[^\n]*summary\s*:\s*/i, '')
        .replace(/Description\s*:\s*/i, '')
    );

    const authors: string[] = [];
    $('.manga-info-text li, .table-value, .story-info-right li').each((_, li) => {
      const text = $(li).text();
      if (/Author/i.test(text)) {
        $(li).find('a').each((__, a) => {
          const auth = this.cleanText($(a).text());
          if (auth) authors.push(auth);
        });
        if (authors.length === 0) {
          const cleaned = this.cleanText(text.replace(/Author(\(s\))?\s*:\s*/i, ''));
          if (cleaned && cleaned.toLowerCase() !== 'unknown') authors.push(cleaned);
        }
      }
    });

    const tags: string[] = [];
    $('.genres a, a[href*="/genre/"], a[href*="/genre-"]').each((_, a) => {
      const tag = this.cleanText($(a).text());
      if (tag && !tags.includes(tag)) tags.push(tag);
    });

    const bodyText = $('.manga-info-text, .story-info-right, .manga-info-top').text().toLowerCase();
    let state: SourceManga['state'] = 'ongoing';
    if (bodyText.includes('completed')) {
      state = 'completed';
    }

    return {
      ...manga,
      title,
      coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : manga.coverUrl,
      coverHeaders: {
        Referer: 'https://www.manganato.gg/',
        'User-Agent': DEFAULT_USER_AGENT,
      },
      description: description || manga.description,
      authors: authors.length > 0 ? authors : manga.authors,
      tags: tags.length > 0 ? tags : manga.tags,
      state,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    let fullUrl = manga.url || '';
    if (!fullUrl.startsWith('http')) {
      const cleanSlug = manga.url.replace(/^manganato:/, '').replace(/^\/+/, '');
      fullUrl = `${this.metadata.baseUrl}/manga/${cleanSlug}`;
    }
    const slug = fullUrl.includes('/manga/')
      ? fullUrl.split('/manga/')[1].replace(/\/.*$/, '')
      : fullUrl.split('/').filter(Boolean).pop() || '';

    if (slug) {
      try {
        const apiUrl = `${this.metadata.baseUrl}/api/manga/${slug}/chapters`;
        const json = await sourceHttpClient.fetchJson<any>(apiUrl, {
          referer: fullUrl,
          sourceId: this.metadata.name,
        });

        if (json?.success && Array.isArray(json?.data?.chapters)) {
          const chapters: SourceChapter[] = [];
          for (const ch of json.data.chapters) {
            const chSlug = ch.chapter_slug || `chapter-${ch.chapter_num}`;
            const chUrl = `${this.metadata.baseUrl}/manga/${slug}/${chSlug}`;
            const name = ch.chapter_name || `Chapter ${ch.chapter_num}`;
            // Use slash-free ID to prevent Expo Router multi-segment 404 errors
            const cleanChId = `${slug}__${chSlug}`;
            chapters.push({
              id: `${this.metadata.id}:${cleanChId}`,
              sourceId: this.metadata.id,
              mangaId: manga.id,
              url: chUrl,
              name,
              number: typeof ch.chapter_num === 'number' ? ch.chapter_num : this.parseChapterNumber(name),
              dateUpload: ch.updated_at ? Date.parse(ch.updated_at) || null : null,
            });
          }
          if (chapters.length > 0) {
            return chapters;
          }
        }
      } catch {
        // Fall back to HTML
      }
    }

    const $ = await this.fetchHtml(fullUrl);
    const chapters: SourceChapter[] = [];

    $('.row-content-chapter li, .chapter-list .row, #chapter-list-container li, .list-chapter li').each((_, el) => {
      const row = $(el);
      const link = row.find('a.chapter-name, a').first();
      const href = link.attr('href') || '';
      const name = this.cleanText(link.text());
      const dateText = this.cleanText(
        row.find('.chapter-time, .chapter-release-date').text() ||
        row.find('span').text()
      );

      if (href && name) {
        const chSlugMatch = href.match(/\/manga\/([^/]+)\/([^/?#]+)/);
        const cleanChId = chSlugMatch
          ? `${chSlugMatch[1]}__${chSlugMatch[2]}`
          : href.replace(/^https?:\/\//, '').replace(/[/?#]+/g, '__');
        chapters.push({
          id: `${this.metadata.id}:${cleanChId}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          url: href.startsWith('http') ? href : this.toAbsoluteUrl(href),
          name,
          number: this.parseChapterNumber(name),
          dateUpload: this.parseDate(dateText),
        });
      }
    });

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let fullUrl = chapter.url || '';
    if (fullUrl.startsWith('http')) {
      // Valid absolute URL
    } else if (fullUrl.includes('__')) {
      const [slug, chSlug] = fullUrl.split('__');
      fullUrl = `${this.metadata.baseUrl}/manga/${slug}/${chSlug}`;
    } else if (chapter.id && chapter.id.includes('__')) {
      const raw = chapter.id.replace(/^manganato:/, '');
      const [slug, chSlug] = raw.split('__');
      fullUrl = `${this.metadata.baseUrl}/manga/${slug}/${chSlug}`;
    } else {
      fullUrl = this.toAbsoluteUrl(fullUrl);
    }

    const $ = await this.fetchHtml(fullUrl);
    const pages: SourcePage[] = [];

    $('.container-chapter-reader img, .chapter-content img').each((i, el) => {
      const img = $(el);
      const src = img.attr('src') || img.attr('data-src') || '';
      if (
        src &&
        !src.includes('banner') &&
        !src.includes('ads') &&
        !src.includes('theodoi') &&
        !src.includes('loadingimg') &&
        !src.toLowerCase().endsWith('.gif')
      ) {
        pages.push({
          index: pages.length,
          url: src.startsWith('http') ? src : this.toAbsoluteUrl(src),
          headers: {
            Referer: 'https://www.manganato.gg/',
            'User-Agent': DEFAULT_USER_AGENT,
          },
        });
      }
    });

    if (pages.length === 0) {
      // Direct regex fallback on raw HTML to capture storage images
      const htmlText = $.html();
      const regex = /<img[^>]+(?:src|data-src)=['"](https?:\/\/[^'"]+\.[a-z0-9]+)['"]/gi;
      let m;
      while ((m = regex.exec(htmlText)) !== null) {
        const url = m[1];
        if (
          !url.includes('banner') &&
          !url.includes('ads') &&
          !url.includes('theodoi') &&
          !url.includes('loadingimg') &&
          !url.toLowerCase().endsWith('.gif') &&
          (url.includes('2xstorage') || url.includes('/manga/') || url.includes('chapter'))
        ) {
          pages.push({
            index: pages.length,
            url,
            headers: {
              Referer: 'https://www.manganato.gg/',
              'User-Agent': DEFAULT_USER_AGENT,
            },
          });
        }
      }
    }

    return pages;
  }
}
