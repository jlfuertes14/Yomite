/**
 * WordPress Madara Engine Parser
 * Ported from Kotatsu's site/madara/MadaraParser.kt
 * Powers 50+ scanlation and aggregator websites.
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
import { loadHtml } from '../network/htmlParser';

export class MadaraParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'alphabetical', label: 'A to Z' },
      { id: 'rating', label: 'Highest Rated' },
      { id: 'newest', label: 'Recently Added' },
    ];
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    const TOONILY_GENRES = [
      'Action',
      'Adventure',
      'Comedy',
      'Crime',
      'Drama',
      'Fantasy',
      'Gossip',
      'Historical',
      'Horror',
      'Isekai',
      'Josei',
      'Magic',
      'Mature',
      'Mystery',
      'Psychological',
      'Romance',
      'School Life',
      'Sci-Fi',
      'Seinen',
      'Shoujo',
      'Shounen',
      'Slice of Life',
      'Sports',
      'Supernatural',
      'Thriller',
      'Tragedy',
      'Villainess',
      'Wuxia',
      'Yaoi',
      'Yuri',
    ];
    return TOONILY_GENRES.map((g) => ({
      id: g.toLowerCase().replace(/\s+/g, '-'),
      label: g,
      group: 'Genre',
    }));
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let orderParam = 'latest';
    if (filter.order === 'popular') orderParam = 'views';
    else if (filter.order === 'newest') orderParam = 'new-manga';
    else if (filter.order === 'alphabetical') orderParam = 'alphabet';
    else if (filter.order === 'rating') orderParam = 'rating-manga';

    const isToonily =
      this.metadata.id === 'toonily' ||
      this.metadata.domain?.includes('toonily') ||
      this.metadata.baseUrl?.includes('toonily');

    const selectedTags = filter.tags || filter.includedTags;
    const tag = selectedTags && selectedTags.length > 0 ? selectedTags[0] : null;

    let url: string;
    if (filter.query && filter.query.trim().length > 0) {
      const q = encodeURIComponent(filter.query.trim());
      url = `${this.metadata.baseUrl}/page/${page}/?s=${q}&post_type=wp-manga&m_orderby=${orderParam}`;
    } else if (tag) {
      let cleanTag = tag.toLowerCase().trim().replace(/\s+/g, '-');
      if (isToonily && (cleanTag === 'sci-fi' || cleanTag === 'scifi')) {
        cleanTag = 'scifi-webtoon';
      }
      const tagSlug = encodeURIComponent(cleanTag);
      const prefix = isToonily ? 'webtoon-genre' : 'genre';
      url = `${this.metadata.baseUrl}/${prefix}/${tagSlug}/page/${page}/?m_orderby=${orderParam}`;
    } else {
      const basePath = isToonily ? 'webtoons' : 'manga';
      url = `${this.metadata.baseUrl}/${basePath}/page/${page}/?m_orderby=${orderParam}`;
    }

    let $;
    try {
      $ = await this.fetchHtml(url);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Fallback sequence: try alternative paths
        const fallbackPaths = isToonily
          ? [
              tag ? `/genre/${encodeURIComponent(tag.toLowerCase().trim().replace(/\s+/g, '-'))}/page/${page}/?m_orderby=${orderParam}` : '',
              `/page/${page}/?m_orderby=${orderParam}`,
            ].filter(Boolean)
          : [
              `/webtoons/page/${page}/?m_orderby=${orderParam}`,
              `/series/page/${page}/?m_orderby=${orderParam}`,
              `/page/${page}/?m_orderby=${orderParam}`,
            ];

        let loaded = false;
        for (const fbPath of fallbackPaths) {
          try {
            const fallbackUrl = `${this.metadata.baseUrl}${fbPath.startsWith('/') ? '' : '/'}${fbPath}`;
            $ = await this.fetchHtml(fallbackUrl);
            loaded = true;
            break;
          } catch {
            // continue next fallback
          }
        }
        if (!loaded) {
          const homeUrl = `${this.metadata.baseUrl}/?page=${page}`;
          $ = await this.fetchHtml(homeUrl);
        }
      } else {
        throw err;
      }
    }

    const mangaList: SourceManga[] = [];

    // Madara uses .page-item-detail, .c-tabs-item__content, or .badge-pos-1
    const items = $('.page-item-detail, .c-tabs-item__content, .manga-item');

    items.each((_, el) => {
      const item = $(el);
      const link = item.find('.post-title h3 a, .post-title h4 a, .item-title a, h3 a').first();
      const href = link.attr('href') || '';
      const title = this.cleanText(link.text());

      const img = item.find('img').first();
      const cover = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || null;

      const ratingStr = item.find('.score, .total_votes').text();
      const rating = ratingStr ? parseFloat(ratingStr) : undefined;

      if (href && title) {
        mangaList.push({
          id: `${this.metadata.id}:${href}`,
          sourceId: this.metadata.id,
          title,
          url: href,
          publicUrl: href.startsWith('http') ? href : this.toAbsoluteUrl(href),
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

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const fullUrl = manga.url.startsWith('http') ? manga.url : this.toAbsoluteUrl(manga.url);
    const $ = await this.fetchHtml(fullUrl);

    const title =
      this.cleanText($('.post-title h1, .manga-title h1').text()) || manga.title;

    const img = $('.summary_image img, .manga-poster img').first();
    const cover =
      img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || manga.coverUrl;

    const description = this.cleanText(
      $('.description-summary .summary__content, .manga-excerpt, .manga-summary').text()
    );

    const authors: string[] = [];
    $('.author-content a, .artist-content a').each((_, a) => {
      const auth = this.cleanText($(a).text());
      if (auth && !authors.includes(auth)) authors.push(auth);
    });

    const tags: string[] = [];
    $('.genres-content a, .manga-genres a').each((_, a) => {
      const tag = this.cleanText($(a).text());
      if (tag && !tags.includes(tag)) tags.push(tag);
    });

    const statusText = $('.post-content_item:contains("Status")').text().toLowerCase();
    let state: SourceManga['state'] = 'ongoing';
    if (statusText.includes('completed') || statusText.includes('end')) {
      state = 'completed';
    } else if (statusText.includes('on hold') || statusText.includes('hiatus')) {
      state = 'hiatus';
    }

    return {
      ...manga,
      title,
      coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : manga.coverUrl,
      description: description || manga.description,
      authors: authors.length > 0 ? authors : manga.authors,
      tags: tags.length > 0 ? tags : manga.tags,
      state,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const fullUrl = manga.url.startsWith('http') ? manga.url : this.toAbsoluteUrl(manga.url);
    let $ = await this.fetchHtml(fullUrl);
    const chapters: SourceChapter[] = [];

    // Check if chapters are directly on page
    let chapterRows = $('li.wp-manga-chapter');

    // If chapters are dynamically loaded via AJAX, load them
    if (chapterRows.length === 0) {
      try {
        const ajaxUrl = `${fullUrl.replace(/\/+$/, '')}/ajax/chapters/`;
        const ajaxHtml = await sourceHttpClient.postForm(
          ajaxUrl,
          {},
          { referer: fullUrl, sourceId: this.metadata.name }
        );
        $ = loadHtml(ajaxHtml);
        chapterRows = $('li.wp-manga-chapter');
      } catch {
        // Fallback to existing DOM
      }
    }

    chapterRows.each((_, el) => {
      const row = $(el);
      const link = row.find('a').first();
      const href = link.attr('href') || '';
      const name = this.cleanText(link.text());
      const dateText = this.cleanText(row.find('.chapter-release-date').text());

      if (href && name) {
        chapters.push({
          id: `${this.metadata.id}:${href}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          url: href,
          name,
          number: this.parseChapterNumber(name),
          dateUpload: this.parseDate(dateText),
        });
      }
    });

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const fullUrl = chapter.url.startsWith('http') ? chapter.url : this.toAbsoluteUrl(chapter.url);
    const $ = await this.fetchHtml(fullUrl);
    const pages: SourcePage[] = [];

    // Madara stores reader images in .page-break img or .reading-content img
    $('.page-break img, .reading-content img, .entry-content img').each((i, el) => {
      const img = $(el);
      const src =
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('src') ||
        '';
      const cleanSrc = src.trim();
      if (cleanSrc && !cleanSrc.includes('logo') && !cleanSrc.includes('banner')) {
        pages.push({
          index: i,
          url: cleanSrc.startsWith('http') ? cleanSrc : this.toAbsoluteUrl(cleanSrc),
          headers: {
            Referer: this.metadata.baseUrl,
            'User-Agent': DEFAULT_USER_AGENT,
          },
        });
      }
    });

    return pages;
  }
}
