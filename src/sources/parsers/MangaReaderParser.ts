/**
 * MangaReader Engine Parser
 * Ported from Kotatsu's site/mangareader/MangaReaderParser.kt
 * Powers 260+ scanlation and aggregator websites.
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
import { DEFAULT_USER_AGENT } from '../network/httpClient';

export class MangaReaderParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Chapters' },
      { id: 'alphabetical', label: 'A to Z' },
      { id: 'rating', label: 'Highest Rated' },
      { id: 'newest', label: 'Recently Added' },
    ];
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: this.metadata.baseUrl,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: '4', label: 'Action', group: 'Genre' },
      { id: '43', label: 'Adult', group: 'Genre' },
      { id: '27', label: 'Adventure', group: 'Genre' },
      { id: '5', label: 'Comedy', group: 'Genre' },
      { id: '12', label: 'Drama', group: 'Genre' },
      { id: '13', label: 'Ecchi', group: 'Genre' },
      { id: '6', label: 'Fantasy', group: 'Genre' },
      { id: '51', label: 'Harem', group: 'Genre' },
      { id: '14', label: 'Historical', group: 'Genre' },
      { id: '7', label: 'Isekai', group: 'Genre' },
      { id: '33', label: 'Josei', group: 'Genre' },
      { id: '44', label: 'Magic', group: 'Genre' },
      { id: '8', label: 'Martial Arts', group: 'Genre' },
      { id: '45', label: 'Mature', group: 'Genre' },
      { id: '34', label: 'Mystery', group: 'Genre' },
      { id: '9', label: 'Psychological', group: 'Genre' },
      { id: '10', label: 'Romance', group: 'Genre' },
      { id: '15', label: 'School Life', group: 'Genre' },
      { id: '16', label: 'Sci-Fi', group: 'Genre' },
      { id: '11', label: 'Seinen', group: 'Genre' },
      { id: '35', label: 'Shoujo', group: 'Genre' },
      { id: '17', label: 'Shounen', group: 'Genre' },
      { id: '18', label: 'Slice of Life', group: 'Genre' },
      { id: '19', label: 'Supernatural', group: 'Genre' },
      { id: '20', label: 'Tragedy', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url: string;

    const selectedTags = filter.tags || filter.includedTags;
    const tag = selectedTags && selectedTags.length > 0 ? selectedTags[0] : null;

    let order = 'popular';
    if (filter.order === 'latest') order = 'update';
    else if (filter.order === 'newest') order = 'latest';
    else if (filter.order === 'alphabetical') order = 'title';
    else if (filter.order === 'rating') order = 'rating';
    else if (filter.order === 'popular') order = 'popular';

    if (filter.query && filter.query.trim().length > 0) {
      const q = encodeURIComponent(filter.query.trim());
      url = `${this.metadata.baseUrl}/page/${page}/?s=${q}`;
    } else if (tag) {
      url = `${this.metadata.baseUrl}/manga/?genre[]=${encodeURIComponent(tag)}&order=${order}&page=${page}`;
    } else {
      url = `${this.metadata.baseUrl}/manga/?order=${order}&page=${page}`;
    }

    let $;
    try {
      $ = await this.fetchHtml(url);
    } catch (err: any) {
      // Fallback for sites where /manga/?order= is /manga?page=
      if (err.response?.status === 404) {
        url = `${this.metadata.baseUrl}/manga?page=${page}`;
        $ = await this.fetchHtml(url);
      } else {
        throw err;
      }
    }

    const mangaList: SourceManga[] = [];

    // MangaReader theme item selectors
    const items = $('.postbody .listupd .bs .bsx, .listupd .bs .bsx, .bs .bsx, .flw-item');

    items.each((_, el) => {
      const item = $(el);
      const link = item.find('a').first();
      const rawHref = link.attr('href') || '';

      let rawTitle =
        item.find('div.tt, .tt').first().text() ||
        item.find('.film-name a, h4, h3').first().text() ||
        link.attr('title') ||
        item.find('a[title]').first().attr('title') ||
        '';
      const title = this.cleanText(rawTitle)
        .replace(/^color\s+/i, '')
        .replace(/\s+chapter\s+[\d.]+.*$/i, '')
        .trim();

      const img = item.find('img.ts-post-image, img.film-poster-img, img').first();
      const cover =
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('data-original') ||
        img.attr('src') ||
        null;

      const ratingStr = item.find('.numscore, .rating, .score').first().text();
      const rating = ratingStr ? parseFloat(ratingStr) : undefined;

      if (rawHref && title) {
        const slugMatch = rawHref.match(/\/manga\/([^/?#]+)\/?/);
        const slug = slugMatch
          ? slugMatch[1]
          : rawHref.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').replace(/\/+$/, '');
        const fullUrl = rawHref.startsWith('http') ? rawHref : this.toAbsoluteUrl(rawHref);

        mangaList.push({
          id: `${this.metadata.id}:${slug || rawHref}`,
          sourceId: this.metadata.id,
          title,
          url: fullUrl,
          publicUrl: fullUrl,
          coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : null,
          rating,
          state: 'ongoing',
        });
      }
    });

    if (filter.order === 'alphabetical') {
      mangaList.sort((a, b) => a.title.localeCompare(b.title));
    }

    return mangaList;
  }

  private toSeriesUrl(rawUrlOrSlug: string): string {
    if (!rawUrlOrSlug) return '';
    if (rawUrlOrSlug.startsWith('http://') || rawUrlOrSlug.startsWith('https://')) {
      return rawUrlOrSlug;
    }
    const clean = rawUrlOrSlug.replace(/^\/+/, '').replace(/\/+$/, '');
    if (clean.startsWith('manga/')) {
      return `${this.metadata.baseUrl}/${clean}/`;
    }
    return `${this.metadata.baseUrl}/manga/${clean}/`;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const fullUrl = this.toSeriesUrl(manga.url);
    const $ = await this.fetchHtml(fullUrl);

    const title =
      this.cleanText($('h1.entry-title, .entry-title, h1').first().text()) || manga.title;

    const coverEl = $('.thumb img, .infox img, img.wp-post-image').first();
    const cover =
      coverEl.attr('data-src') ||
      coverEl.attr('data-lazy-src') ||
      coverEl.attr('data-original') ||
      coverEl.attr('src') ||
      manga.coverUrl;

    const desc = this.cleanText($('.entry-content, .wd-full, .description, .synopsis').first().text());

    const author = this.cleanText(
      $('.tsinfo .imptdt:contains(Author) i, .fmed:contains(Author) span').first().text()
    );

    const genres: string[] = [];
    $('.mgen a, .genres-container a').each((_, el) => {
      const g = this.cleanText($(el).text());
      if (g && !genres.includes(g)) genres.push(g);
    });

    const statusText = $('.tsinfo .imptdt:contains(Status) i').first().text().toLowerCase();
    const state = statusText.includes('complete') ? 'completed' : 'ongoing';

    return {
      ...manga,
      title,
      coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : null,
      description: desc || undefined,
      authors: author ? [author] : undefined,
      tags: genres.slice(0, 15),
      state,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const fullUrl = this.toSeriesUrl(manga.url);
    const $ = await this.fetchHtml(fullUrl);
    const chapters: SourceChapter[] = [];

    $('#chapterlist li, ul.clstyle li, .eplister li').each((_, el) => {
      const item = $(el);
      const link = item.find('a').first();
      const rawHref = link.attr('href') || '';
      const name = this.cleanText(item.find('.chapternum, .chap-title').text() || link.text());
      const num = this.parseChapterNumber(name);
      const dateStr = item.find('.chapterdate').text();
      const releaseDate = this.parseDate(dateStr) || undefined;

      if (rawHref && name) {
        const chSlugMatch = rawHref.match(/\/([^/?#]+)\/?$/);
        const chSlug = chSlugMatch
          ? chSlugMatch[1]
          : rawHref.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').replace(/\/+$/, '');
        const fullHref = rawHref.startsWith('http') ? rawHref : this.toAbsoluteUrl(rawHref);

        chapters.push({
          id: `${this.metadata.id}:${chSlug || rawHref}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name,
          number: num,
          url: fullHref,
          dateUpload: releaseDate,
        });
      }
    });

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const fullUrl = chapter.url.startsWith('http') ? chapter.url : this.toAbsoluteUrl(chapter.url);
    const $ = await this.fetchHtml(fullUrl);
    const pages: SourcePage[] = [];

    // 1. Try ts_reader.run JSON payload (standard MangaReader high-res array)
    const rawHtml = $.html();
    const tsMatch = rawHtml.match(/ts_reader\.run\((\{[\s\S]*?\})\);/);
    if (tsMatch) {
      try {
        const data = JSON.parse(tsMatch[1]);
        const images: string[] = data.sources?.[0]?.images || [];
        if (Array.isArray(images) && images.length > 0) {
          images.forEach((imgUrl, index) => {
            if (imgUrl && typeof imgUrl === 'string') {
              pages.push({
                index,
                url: imgUrl.startsWith('http') ? imgUrl : this.toAbsoluteUrl(imgUrl),
                headers: this.getRequestHeaders(),
              });
            }
          });
          if (pages.length > 0) {
            return pages;
          }
        }
      } catch {
        // Fallback to DOM parsing below
      }
    }

    // 2. DOM parsing: #readerarea img, including noscript
    $('#readerarea img, #readerarea noscript img, .container-reading img').each((index, el) => {
      const img = $(el);
      const src =
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('data-original') ||
        img.attr('src') ||
        '';

      if (src && !src.includes('data:image')) {
        pages.push({
          index,
          url: src.startsWith('http') ? src : this.toAbsoluteUrl(src),
          headers: this.getRequestHeaders(),
        });
      }
    });

    return pages;
  }
}
