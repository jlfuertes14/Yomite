/**
 * HiveToon & HiveComic Engine Parser
 * Active Domain: https://hivetoons.org
 * CDN: https://storage.hivetoon.com
 * Supports catalog browsing, tag/genre filtering, series details, chapters, and high-res webtoon pages.
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

const HIVETOON_GENRES: string[] = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Murim',
  'Martial Arts',
  'Reincarnation',
  'Regression',
  'System',
  'Supernatural',
  'Mystery',
  'Thriller',
  'Psychological',
  'Romance',
  'School Life',
  'Sci-Fi',
  'Isekai',
  'Harem',
  'Survival',
  'Magic',
  'Overpowered',
  'Historical',
  'Tragedy',
  'Slice of Life',
  'Shounen',
  'Seinen',
  'Apocalypse',
];

export class HiveToonParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: MangaSourceMetadata) {
    super();
    this.metadata = metadata || {
      id: 'hivetoon',
      name: 'HiveToon',
      domain: 'hivetoons.org',
      baseUrl: 'https://hivetoons.org',
      locale: 'en',
      isNsfw: false,
      version: '1.1.0',
      description: 'HiveToon - Fast webtoon and manhwa releases with high quality scans.',
      enabled: true,
      icon: 'https://www.google.com/s2/favicons?domain=hivetoons.org&sz=64',
      availableSortOrders: ['popular', 'latest'],
    };
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: 'https://hivetoons.org/',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return HIVETOON_GENRES.map((g) => ({
      id: g.toLowerCase().replace(/\s+/g, '-'),
      label: g,
      group: 'Genre',
    }));
  }

  private toSeriesUrl(rawUrlOrSlug: string): string {
    if (!rawUrlOrSlug) return '';
    if (rawUrlOrSlug.startsWith('http://') || rawUrlOrSlug.startsWith('https://')) {
      return rawUrlOrSlug;
    }
    const clean = rawUrlOrSlug
      .replace(/^hivetoon:/, '')
      .replace(/^hivecomic:/, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    if (clean.startsWith('series/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/series/${clean}`;
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url: string;

    const selectedTags = filter.tags || filter.includedTags;
    const tag = selectedTags && selectedTags.length > 0 ? selectedTags[0] : null;

    if (filter.query && filter.query.trim().length > 0) {
      const q = encodeURIComponent(filter.query.trim());
      url = `${this.metadata.baseUrl}/?s=${q}`;
    } else if (tag) {
      const cleanTag = encodeURIComponent(tag.toLowerCase().replace(/\s+/g, '-'));
      url = `${this.metadata.baseUrl}/genre/${cleanTag}?page=${page}`;
    } else {
      url = `${this.metadata.baseUrl}/series/?page=${page}`;
    }

    const $ = await this.fetchHtml(url);
    const mangaList: SourceManga[] = [];
    const seenSlugs = new Set<string>();

    const cards = $('div.rounded-xl.border.bg-card, div.relative.h-full.p-1, div.relative.overflow-hidden');
    cards.each((_, el) => {
      const card = $(el);
      const link = card.find('a[href*="/series/"]').first();
      const rawHref = link.attr('href') || '';
      if (!rawHref) return;

      const slugMatch = rawHref.match(/\/series\/([^/?#]+)/);
      const slug = slugMatch ? slugMatch[1] : '';
      if (!slug || slug === 'series' || seenSlugs.has(slug)) return;
      seenSlugs.add(slug);

      const img = card.find('img').first();
      const rawTitle = link.attr('title') || img.attr('alt') || '';
      let title = this.cleanText(rawTitle);
      if (!title || /^(manhwa|manhua|manga|60% off|pinned)$/i.test(title)) {
        // Fallback: format title from slug
        title = slug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }

      const cover =
        img.attr('src') ||
        img.attr('data-src') ||
        null;

      const fullUrl = rawHref.startsWith('http') ? rawHref : `${this.metadata.baseUrl}${rawHref}`;

      mangaList.push({
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        title,
        url: fullUrl,
        publicUrl: fullUrl,
        coverUrl: cover ? (cover.startsWith('http') ? cover : `${this.metadata.baseUrl}${cover}`) : null,
        coverHeaders: {
          Referer: 'https://hivetoons.org/',
          'User-Agent': DEFAULT_USER_AGENT,
        },
        state: 'ongoing',
      });
    });

    return mangaList;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const fullUrl = this.toSeriesUrl(manga.url || manga.id);
    const $ = await this.fetchHtml(fullUrl);

    // Title
    const titleEl = $('h1.text-2xl, h1, .text-xl.font-bold').first();
    const title = this.cleanText(titleEl.text()) || manga.title;

    // Cover
    let cover: string | null = null;
    const coverImg = $('img[alt*="Cover of"], div.relative.aspect-w-3 img, .series-poster img').first();
    cover = coverImg.attr('src') || coverImg.attr('data-src') || null;

    if (!cover) {
      const allImgs = $('img');
      allImgs.each((_, el) => {
        const src = $(el).attr('src') || '';
        if (src.includes('storage.hivetoon.com') || src.includes('cover')) {
          cover = src;
          return false;
        }
      });
    }

    if (!cover) {
      cover = manga.coverUrl;
    }

    // Synopsis
    const synopsisEl = $('p.text-muted-foreground, div.prose p, .synopsis').first();
    const description = this.cleanText(synopsisEl.text()) || undefined;

    // Genres / tags
    const tags: string[] = [];
    $('a[href*="/genre/"], span.badge, .tag-item').each((_, el) => {
      const t = this.cleanText($(el).text());
      if (t && !tags.includes(t) && !/^(ongoing|completed|manhwa|manhua|manga)$/i.test(t)) {
        tags.push(t);
      }
    });

    return {
      ...manga,
      title,
      coverUrl: cover ? (cover.startsWith('http') ? cover : `${this.metadata.baseUrl}${cover}`) : null,
      coverHeaders: {
        Referer: 'https://hivetoons.org/',
        'User-Agent': DEFAULT_USER_AGENT,
      },
      description,
      tags: tags.slice(0, 15),
      state: 'ongoing',
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const fullUrl = this.toSeriesUrl(manga.url || manga.id);
    const $ = await this.fetchHtml(fullUrl);
    const chapters: SourceChapter[] = [];
    const seenNumbers = new Set<number>();
    const seenHrefs = new Set<string>();

    const slug = manga.id.replace(`${this.metadata.id}:`, '');

    $('a[href*="/chapter-"]').each((_, el) => {
      const link = $(el);
      const rawHref = link.attr('href') || '';
      if (!rawHref) return;

      const numMatch = rawHref.match(/chapter-(\d+(?:\.\d+)?)/i);
      const num = numMatch ? parseFloat(numMatch[1]) : 0;
      if (seenNumbers.has(num)) return;
      if (seenHrefs.has(rawHref)) return;

      seenNumbers.add(num);
      seenHrefs.add(rawHref);

      const text = this.cleanText(link.text());
      const displayName = text && text.toLowerCase().includes('chapter')
        ? text
        : `Chapter ${num}`;

      const fullChapterUrl = rawHref.startsWith('http') ? rawHref : `${this.metadata.baseUrl}${rawHref}`;

      chapters.push({
        id: `${this.metadata.id}:${slug}:chapter-${num}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: displayName,
        number: num,
        url: fullChapterUrl,
      });
    });

    // Sort chapters descending
    chapters.sort((a, b) => b.number - a.number);

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let fullUrl = chapter.url.startsWith('http') ? chapter.url : `${this.metadata.baseUrl}${chapter.url}`;
    const $ = await this.fetchHtml(fullUrl);

    const pages: SourcePage[] = [];
    const seenUrls = new Set<string>();

    // HiveToon webtoon strip images
    const images = $(
      'div.comic-images-wrapper img, figure.image-container img, div.reading-content img, div.relative.w-full img'
    );

    images.each((index, el) => {
      const img = $(el);
      const src =
        img.attr('src') ||
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        '';

      if (!src || src.includes('data:image') || seenUrls.has(src)) return;

      // Filter out icons, logo, avatars
      if (src.includes('avatar') || src.includes('logo') || src.includes('icon')) return;

      seenUrls.add(src);
      const absUrl = src.startsWith('http') ? src : `${this.metadata.baseUrl}${src}`;

      pages.push({
        index,
        url: absUrl,
        headers: {
          Referer: 'https://hivetoons.org/',
          'User-Agent': DEFAULT_USER_AGENT,
        },
      });
    });

    // Fallback if structured selector returned few results: inspect all storage.hivetoon.com images
    if (pages.length === 0) {
      $('img').each((index, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src.includes('storage.hivetoon.com') && !seenUrls.has(src)) {
          seenUrls.add(src);
          pages.push({
            index,
            url: src,
            headers: {
              Referer: 'https://hivetoons.org/',
              'User-Agent': DEFAULT_USER_AGENT,
            },
          });
        }
      });
    }

    return pages;
  }
}
