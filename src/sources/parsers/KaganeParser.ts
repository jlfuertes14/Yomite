/**
 * Kagane Parser (kagane.moe)
 *
 * Scrapes manga catalog, details, chapters, and reader pages from kagane.moe.
 * Integrates with Kagane's v2 REST APIs and reader grant integrity protocol.
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

export class KaganeParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'kagane',
      name: 'Kagane',
      domain: 'kagane.moe',
      baseUrl: 'https://kagane.moe',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://kagane.moe/favicons/android-icon-192x192.png',
      description: 'Modern manga, manhwa, and webtoons reader from Kagane.moe.',
      availableSortOrders: ['popular', 'latest', 'rating', 'newest', 'alphabetical'],
      enabled: true,
      ...metadata,
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'rating', label: 'Top Rated' },
      { id: 'newest', label: 'Recently Added' },
      { id: 'alphabetical', label: 'A to Z' },
    ];
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json, text/plain, */*',
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
      { id: '019c1b6f-b682-7fee-9a9b-86e648b77e9e', label: 'Adventure', group: 'Genre' },
      { id: '019c1b6f-51ed-7991-a796-a8ca26e86666', label: 'Fantasy', group: 'Genre' },
      { id: '019beb9a-a36a-718c-b551-d917a0818cc7', label: 'Romance', group: 'Genre' },
      { id: '019c1fe5-51fe-7f26-aee3-f057ac50f81d', label: 'Comedy', group: 'Genre' },
      { id: '019c1b6f-3d3b-7528-a3e2-a791cfdcc4f7', label: 'Drama', group: 'Genre' },
      { id: '019c1fe5-84d9-7a67-9240-1f303dc231bc', label: 'Slice of Life', group: 'Genre' },
      { id: '019c1fea-983f-7279-944e-8fb6e2cccdbc', label: 'Seinen', group: 'Genre' },
      { id: '019c200d-6238-7364-9422-c50bd75e4e0d', label: 'Ecchi', group: 'Genre' },
    ];
  }

  /**
   * Search or browse Kagane series catalog
   */
  public override async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page && filter.page > 0 ? filter.page - 1 : 0;
    const size = 24;

    let sortParam = 'avg_views_week,desc';
    switch (filter.order) {
      case 'latest':
        sortParam = 'updated_at,desc';
        break;
      case 'rating':
        sortParam = 'bayesian_rating,desc';
        break;
      case 'newest':
        sortParam = 'created_at,desc';
        break;
      case 'alphabetical':
        sortParam = 'title,asc';
        break;
      case 'popular':
      default:
        sortParam = 'avg_views_week,desc';
        break;
    }

    const searchUrl = `${this.metadata.baseUrl}/api/v2/search/series?sort=${sortParam}&page=${page}&size=${size}`;
    const payload: Record<string, any> = {};

    if (filter.query && filter.query.trim().length > 0) {
      payload.title = filter.query.trim();
    }

    const res = await sourceHttpClient.post<any>(searchUrl, payload, {
      headers: {
        ...this.getRequestHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const content: any[] = res.data?.content || [];

    return content.map((item) => {
      const seriesId = item.series_id;
      const slug = item.slug || seriesId;
      const coverId = item.cover_image_id;
      const coverUrl = coverId
        ? `${this.metadata.baseUrl}/api/v2/image/${coverId}/compressed`
        : null;

      const genres = Array.isArray(item.genre_list)
        ? item.genre_list.map((g: any) => g.name).filter(Boolean)
        : [];

      return {
        id: `${this.metadata.id}:${seriesId}`,
        sourceId: this.metadata.id,
        url: `/series/${slug}-${seriesId}`,
        publicUrl: `${this.metadata.baseUrl}/series/${slug}-${seriesId}`,
        title: this.cleanText(item.title || slug),
        coverUrl,
        coverHeaders: this.getImageHeaders(),
        tags: genres,
        state: item.publication_status?.toLowerCase() === 'ongoing' ? 'ongoing' : 'completed',
        chaptersCount: item.current_books || undefined,
        locale: item.translated_language || 'en',
      } as SourceManga;
    });
  }

  /**
   * Extract series ID from URL or global ID
   */
  private extractSeriesId(manga: SourceManga): string {
    if (manga.id && manga.id.includes(':')) {
      const scopedId = manga.id.split(':').pop() || '';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scopedId)) {
        return scopedId;
      }
    }

    const urlMatch = manga.url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (urlMatch) {
      return urlMatch[1];
    }

    return manga.url.split('/').pop() || '';
  }

  /**
   * Fetch complete series details
   */
  public override async getDetails(manga: SourceManga): Promise<SourceManga> {
    const seriesId = this.extractSeriesId(manga);
    const detailUrl = `${this.metadata.baseUrl}/api/v2/series/${seriesId}`;

    const res = await sourceHttpClient.get<any>(detailUrl, {
      headers: this.getRequestHeaders(),
    });

    const data = res.data;
    if (!data) return manga;

    // Use main cover image_id or fallback to cover_image_id (data.main_cover_id is a series_covers table ID, not an image ID)
    const mainCover = data.series_covers?.find((c: any) => c.is_main) || data.series_covers?.[0];
    const coverId = mainCover?.image_id || data.cover_image_id;
    const coverUrl = coverId
      ? `${this.metadata.baseUrl}/api/v2/image/${coverId}/compressed`
      : manga.coverUrl;

    const authors: string[] = [];
    if (Array.isArray(data.series_staff)) {
      data.series_staff.forEach((s: any) => {
        if (s.name && !authors.includes(s.name)) authors.push(s.name);
      });
    }

    const tags: string[] = [];
    if (Array.isArray(data.genres)) {
      data.genres.forEach((g: any) => {
        if (g.genre_name && !tags.includes(g.genre_name)) tags.push(g.genre_name);
      });
    }

    return {
      ...manga,
      title: this.cleanText(data.title || manga.title),
      description: this.cleanText(data.description || manga.description),
      coverUrl,
      coverHeaders: this.getImageHeaders(),
      authors: authors.length > 0 ? authors : manga.authors,
      tags: tags.length > 0 ? tags : manga.tags,
      state: data.publication_status?.toLowerCase() === 'ongoing' ? 'ongoing' : 'completed',
      chaptersCount: data.current_books || manga.chaptersCount,
    };
  }

  /**
   * Fetch all chapters (books) for the series
   */
  public override async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const seriesId = this.extractSeriesId(manga);
    const booksUrl = `${this.metadata.baseUrl}/api/v2/series/${seriesId}/books`;

    const res = await sourceHttpClient.get<any>(booksUrl, {
      headers: this.getRequestHeaders(),
    });

    const items: any[] = res.data?.items || [];
    const cleanMangaId = manga.id.startsWith(`${this.metadata.id}:`)
      ? manga.id.slice(this.metadata.id.length + 1)
      : manga.id;
    const cleanSeriesId = seriesId || cleanMangaId.split('/').pop() || cleanMangaId;

    return items.map((item) => {
      const bookId = item.book_id;
      const chNo = item.chapter_no || String(item.sort_no || '1');
      const name = item.title && !item.title.startsWith('Chapter')
        ? `Chapter ${chNo}: ${this.cleanText(item.title)}`
        : item.title || `Chapter ${chNo}`;

      // Kagane reader web route requires /series/s-${seriesId}/reader/${bookId}
      const readerUrl = `/series/s-${cleanSeriesId}/reader/${bookId}`;

      return {
        id: `${this.metadata.id}:${cleanSeriesId}/${bookId}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name,
        number: parseFloat(chNo) || item.sort_no || 0,
        url: readerUrl,
        dateUpload: item.created_at ? new Date(item.created_at).getTime() : null,
        locale: 'en',
      };
    });
  }

  /**
   * Fetch chapter reader pages via token grant
   */
  public override async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    // Extract all UUIDs from chapter url, id, and mangaId
    const uuids = `${chapter.url} ${chapter.id} ${chapter.mangaId || ''}`.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
    ) || [];

    let seriesId = '';
    let bookId = '';

    if (uuids.length >= 2) {
      seriesId = uuids[0];
      bookId = uuids[1];
    } else if (uuids.length === 1) {
      bookId = uuids[0];
      const sMatch = chapter.url.match(/series\/s-([^/]+)/);
      if (sMatch) {
        seriesId = sMatch[1];
      } else if (chapter.mangaId) {
        seriesId = this.extractSeriesId({ url: chapter.url, id: chapter.mangaId } as any);
      }
    } else {
      bookId = chapter.url.split('/').pop() || '';
    }

    // Always ensure readerUrl points to the canonical Kagane web route /series/s-${seriesId}/reader/${bookId}
    const readerUrl = seriesId
      ? `${this.metadata.baseUrl}/series/s-${seriesId}/reader/${bookId}`
      : this.toAbsoluteUrl(chapter.url);


    // 1. Fetch reader page HTML to extract fresh integrity token
    const pageRes = await sourceHttpClient.get<string>(readerUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: `${this.metadata.baseUrl}/`,
      },
    });

    const html = pageRes.data;
    const tokenMatch = html.match(/tok\s*=\s*"([^"]+)"|tok\s*:\s*"([^"]+)"/);
    const integrityToken = tokenMatch ? tokenMatch[1] || tokenMatch[2] : '';

    if (!integrityToken) {
      throw new Error(`Failed to extract reader integrity token for Kagane chapter ${chapter.name}`);
    }

    // 2. Request read grant with integrity token
    const grantUrl = `${this.metadata.baseUrl}/api/v2/books/${bookId}?intent=Read`;
    const grantRes = await sourceHttpClient.post<any>(
      grantUrl,
      {},
      {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'application/json',
          'x-integrity-token': integrityToken,
          Referer: readerUrl,
        },
      }
    );

    const grantData = grantRes.data;
    const manifestPages: any[] = grantData?.manifest?.pages || grantData?.pages || [];
    const cacheUrl = grantData?.cache_url || 'https://kstatic.to';
    const accessToken = grantData?.access_token || integrityToken;

    return manifestPages.map((p, idx) => {
      const ext = p.ext || 'webp';
      const imgUrl = `${cacheUrl}/api/v2/books/page/${encodeURIComponent(bookId)}/${encodeURIComponent(p.page_id)}.${ext}?token=${encodeURIComponent(accessToken)}`;

      return {
        index: idx,
        url: imgUrl,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Referer: `${this.metadata.baseUrl}/`,
        },
      };
    });
  }
}
