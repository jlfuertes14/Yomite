/**
 * MangaDot Parser (mangadot.net)
 * Fast REST JSON API client with full search,
 * genre filtering, multi-metric sorting, and direct WebP CDN delivery.
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

export class MangaDotParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'mangadot',
      name: 'MangaDot',
      domain: 'mangadot.net',
      baseUrl: 'https://mangadot.net',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://icon.horse/icon/mangadot.net',
      description:
        'Fast and modern manga platform with extensive licensed & scanlated series, high-res WebP pages, and open APIs.',
      availableSortOrders: ['popular', 'latest', 'rating', 'chapters'],
      enabled: true,
      ...metadata,
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Popular / Most Viewed' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'rating', label: 'Top Rated' },
      { id: 'chapters', label: 'Most Chapters' },
    ];
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'Action', label: 'Action' },
      { id: 'Adventure', label: 'Adventure' },
      { id: 'Comedy', label: 'Comedy' },
      { id: 'Drama', label: 'Drama' },
      { id: 'Fantasy', label: 'Fantasy' },
      { id: 'Horror', label: 'Horror' },
      { id: 'Mystery', label: 'Mystery' },
      { id: 'Romance', label: 'Romance' },
      { id: 'Sci-Fi', label: 'Sci-Fi' },
      { id: 'Slice of Life', label: 'Slice of Life' },
      { id: 'Sports', label: 'Sports' },
      { id: 'Supernatural', label: 'Supernatural' },
      { id: 'Manga', label: 'Manga' },
      { id: 'Manhwa', label: 'Manhwa' },
      { id: 'Manhua', label: 'Manhua' },
      { id: 'Isekai', label: 'Isekai' },
      { id: 'Psychological', label: 'Psychological' },
      { id: 'Thriller', label: 'Thriller' },
      { id: 'Tragedy', label: 'Tragedy' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const params = new URLSearchParams();
    params.set('page', String(page));

    // 1. Text Search Query
    if (filter.query && filter.query.trim().length > 0) {
      params.set('search', filter.query.trim());
    }

    // 2. Genre / Tag Filtering
    if (filter.tags && filter.tags.length > 0) {
      params.set('genres', filter.tags[0]);
    }

    // 3. Sort & Order Handling
    switch (filter.order) {
      case 'latest':
        params.set('sortBy', 'updated_at');
        params.set('sortOrder', 'desc');
        break;
      case 'rating':
        params.set('sortBy', 'rating');
        params.set('sortOrder', 'desc');
        break;
      case 'chapters':
        params.set('sortBy', 'chapters');
        params.set('sortOrder', 'desc');
        break;
      case 'popular':
      default:
        params.set('sortBy', 'views');
        params.set('sortOrder', 'desc');
        break;
    }

    const apiUrl = `${this.metadata.baseUrl}/api/search?${params.toString()}`;
    const data = await sourceHttpClient.fetchJson<any>(apiUrl, {
      referer: `${this.metadata.baseUrl}/`,
      sourceId: this.metadata.name,
    });

    const mangaList: SourceManga[] = [];
    const items = Array.isArray(data?.manga_list) ? data.manga_list : [];

    for (const item of items) {
      const id = String(item.id);
      const url = `${this.metadata.baseUrl}/manga/${id}`;
      const cover = item.photo
        ? item.photo.startsWith('http')
          ? item.photo
          : `${this.metadata.baseUrl}${item.photo}`
        : null;

      const state: SourceManga['state'] =
        item.status?.toLowerCase() === 'completed' ? 'completed' : 'ongoing';

      mangaList.push({
        id: `${this.metadata.id}:${id}`,
        sourceId: this.metadata.id,
        title: item.title || 'Untitled',
        url,
        publicUrl: url,
        coverUrl: cover,
        coverHeaders: {
          Referer: `${this.metadata.baseUrl}/`,
          'User-Agent': DEFAULT_USER_AGENT,
        },
        rating: typeof item.avg_rating === 'number' ? item.avg_rating : undefined,
        tags: Array.isArray(item.genres) ? item.genres : undefined,
        state,
      });
    }

    return mangaList;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const mangaId = manga.id.includes(':')
      ? manga.id.split(':')[1]
      : manga.url.split('/').pop() || manga.id;
    const apiUrl = `${this.metadata.baseUrl}/api/manga/${mangaId}`;

    const data = await sourceHttpClient.fetchJson<any>(apiUrl, {
      referer: `${this.metadata.baseUrl}/manga/${mangaId}`,
      sourceId: this.metadata.name,
    });

    const m = data?.manga || data || {};
    const cover = m.photo
      ? m.photo.startsWith('http')
        ? m.photo
        : `${this.metadata.baseUrl}${m.photo}`
      : manga.coverUrl;

    const authors: string[] = [];
    if (Array.isArray(m.authors)) {
      authors.push(...m.authors.filter(Boolean));
    } else if (m.author) {
      authors.push(m.author);
    }
    if (Array.isArray(m.artists)) {
      for (const a of m.artists) {
        if (a && !authors.includes(a)) authors.push(a);
      }
    } else if (m.artist && !authors.includes(m.artist)) {
      authors.push(m.artist);
    }

    const state: SourceManga['state'] =
      m.status?.toLowerCase() === 'completed' ? 'completed' : 'ongoing';

    return {
      ...manga,
      title: m.title || manga.title,
      coverUrl: cover,
      coverHeaders: {
        Referer: `${this.metadata.baseUrl}/`,
        'User-Agent': DEFAULT_USER_AGENT,
      },
      description: m.description ? this.cleanText(m.description) : manga.description,
      authors: authors.length > 0 ? authors : manga.authors,
      tags: Array.isArray(m.genres) ? m.genres : manga.tags,
      state,
      rating: typeof m.avg_rating === 'number' ? m.avg_rating : manga.rating,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const mangaId = manga.id.includes(':')
      ? manga.id.split(':')[1]
      : manga.url.split('/').pop() || manga.id;
    const apiUrl = `${this.metadata.baseUrl}/api/manga/${mangaId}/chapters/list`;

    const data = await sourceHttpClient.fetchJson<any>(apiUrl, {
      referer: `${this.metadata.baseUrl}/manga/${mangaId}`,
      sourceId: this.metadata.name,
    });

    const rawList: any[] = Array.isArray(data) ? data : data?.chapters || [];
    const chapters: SourceChapter[] = [];

    for (const ch of rawList) {
      const chId = String(ch.id);
      const chUrl = `${this.metadata.baseUrl}/chapter/${chId}`;
      const chNum =
        typeof ch.chapter_number === 'number'
          ? ch.chapter_number
          : this.parseChapterNumber(ch.chapter_title);
      const chName =
        ch.chapter_title && ch.chapter_title.trim().length > 0
          ? ch.chapter_title
          : `Chapter ${chNum}`;

      const dateUpload = ch.date_added ? Date.parse(ch.date_added) || null : null;

      chapters.push({
        id: `${this.metadata.id}:${chId}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        url: chUrl,
        name: chName,
        number: chNum,
        dateUpload,
      });
    }

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const chId = chapter.id.includes(':')
      ? chapter.id.split(':')[1]
      : chapter.url.split('/').pop() || chapter.id;
    const apiUrl = `${this.metadata.baseUrl}/chapter/${chId}.data?source=user`;

    const data = await sourceHttpClient.fetchJson<any>(apiUrl, {
      referer: `${this.metadata.baseUrl}/chapter/${chId}`,
      sourceId: this.metadata.name,
    });

    const pages: SourcePage[] = [];
    if (Array.isArray(data)) {
      const rawPaths = data.filter((s) => typeof s === 'string' && s.startsWith('/chapters/'));
      const uniquePaths = [...new Set(rawPaths)];

      // Sort ascending by page number
      uniquePaths.sort((a, b) => {
        const numA = parseInt(a.split('/').pop()?.replace(/\D+/g, '') || '0', 10);
        const numB = parseInt(b.split('/').pop()?.replace(/\D+/g, '') || '0', 10);
        return numA - numB;
      });

      uniquePaths.forEach((path, i) => {
        const fullUrl = path.startsWith('http') ? path : `${this.metadata.baseUrl}${path}`;
        pages.push({
          index: i,
          url: fullUrl,
          headers: {
            Referer: `${this.metadata.baseUrl}/`,
            'User-Agent': DEFAULT_USER_AGENT,
          },
        });
      });
    }

    return pages;
  }
}
