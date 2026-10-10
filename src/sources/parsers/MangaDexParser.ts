/**
 * MangaDex Unified Adapter Parser
 * Wraps MangaDex API into the standard MangaParser contract
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
import {
  getPopularManga,
  getLatestUpdates,
  searchManga,
  getMangaDetails,
  getMangaChapters,
  getChapterPages,
  getCoverUrl,
  getMangaTitle,
  getMangaDescription,
  extractCoverFileName,
  extractAuthorName,
  extractArtistName,
} from '../../api/mangadex';
import type { Manga as MangaDexManga, Chapter as MangaDexChapter } from '../../types';

export class MangaDexParser extends BaseParser {
  private cachedTags: SourceTag[] | null = null;

  public readonly metadata: MangaSourceMetadata = {
    id: 'mangadex',
    name: 'MangaDex',
    domain: 'mangadex.org',
    baseUrl: 'https://mangadex.org',
    locale: 'all',
    isNsfw: false,
    version: '2.5.0',
    icon: 'globe-outline',
    description:
      'Official API integration with high quality scans, community translations, and multi-language support.',
    availableSortOrders: ['popular', 'latest', 'alphabetical', 'rating', 'newest'],
    enabled: true,
  };

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Followed' },
      { id: 'latest', label: 'Latest Upload' },
      { id: 'newest', label: 'Recently Created' },
      { id: 'rating', label: 'Highest Rating' },
      { id: 'alphabetical', label: 'Title A-Z' },
    ];
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    if (this.cachedTags && this.cachedTags.length > 0) return this.cachedTags;

    try {
      const res = await fetch('https://api.mangadex.org/manga/tag');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) {
          this.cachedTags = json.data.map((t: any) => ({
            id: t.id,
            label: t.attributes?.name?.en || t.attributes?.name?.['ja-ro'] || t.id,
            group: t.attributes?.group
              ? t.attributes.group.charAt(0).toUpperCase() + t.attributes.group.slice(1)
              : 'Genre',
          }));
          return this.cachedTags;
        }
      }
    } catch {
      // Fallback
    }

    this.cachedTags = [
      { id: '423e2eae-a7a2-4a8b-ac03-a8351462d71d', label: 'Romance', group: 'Genre' },
      { id: '4d32cc48-9f00-4cca-9b5a-a839f0764984', label: 'Comedy', group: 'Genre' },
      { id: 'b9af3a63-f058-424f-a1f0-a1f50431538c', label: 'Drama', group: 'Genre' },
      { id: 'cdc58593-87dd-4cc7-bbc0-2ec27bf404cc', label: 'Fantasy', group: 'Genre' },
      { id: '391b0423-d847-456f-aff0-8b0cfc03066b', label: 'Action', group: 'Genre' },
      { id: '87cc87cd-a395-47af-b27a-93258283bbc6', label: 'Adventure', group: 'Genre' },
      { id: 'cdad7e68-07dd-4270-a3ee-6344d6ee4321', label: 'Horror', group: 'Genre' },
      { id: '256325d6-3d75-43c4-973c-ecd34df48668', label: 'Sci-Fi', group: 'Genre' },
      { id: 'ee9634b1-638e-4da0-a125-667adc0b4b24', label: 'Mystery', group: 'Genre' },
      { id: '3b60b75c-a2d7-4860-ab56-05f391bb889c', label: 'Psychological', group: 'Genre' },
      { id: 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9', label: 'Slice of Life', group: 'Genre' },
      { id: 'eabc5b4c-6aff-42f3-b657-3e190adc48b6', label: 'Supernatural', group: 'Genre' },
      { id: 'ace04997-f6bd-436e-b261-779182193d3d', label: 'Isekai', group: 'Theme' },
    ];
    return this.cachedTags;
  }

  private mapManga(m: MangaDexManga): SourceManga {
    const title = getMangaTitle(m);
    const fileName = extractCoverFileName(m);
    const cover = getCoverUrl(m.id, fileName);
    const author = extractAuthorName(m);
    const artist = extractArtistName(m);
    const desc = getMangaDescription(m);

    return {
      id: `mangadex:${m.id}`,
      sourceId: 'mangadex',
      url: `/title/${m.id}`,
      publicUrl: `https://mangadex.org/title/${m.id}`,
      title,
      coverUrl: cover,
      authors: author ? [author] : [],
      artists: artist ? [artist] : [],
      description: desc,
      tags: m.attributes.tags?.map((t) => t.attributes.name.en).filter(Boolean) || [],
      state: m.attributes.status as any,
    };
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const limit = 24;
    const offset = (page - 1) * limit;

    let orders: Record<string, 'asc' | 'desc'> = { followedCount: 'desc' };
    if (filter.order === 'latest') orders = { latestUploadedChapter: 'desc' };
    else if (filter.order === 'newest') orders = { createdAt: 'desc' };
    else if (filter.order === 'rating') orders = { rating: 'desc' };
    else if (filter.order === 'alphabetical') orders = { title: 'asc' };

    let results: MangaDexManga[] = [];

    const hasQuery = filter.query && filter.query.trim().length > 0;
    const hasTags = filter.tags && filter.tags.length > 0;

    if (hasQuery || hasTags) {
      const searchRes = await searchManga(
        {
          title: hasQuery ? filter.query!.trim() : undefined,
          includedTags: hasTags ? filter.tags : undefined,
          orders,
        },
        limit,
        offset
      );
      results = searchRes.data;
    } else if (filter.order === 'popular' && page === 1) {
      results = await getPopularManga(limit);
    } else {
      const latestRes = await getLatestUpdates(limit, offset);
      results = latestRes.data;
    }

    return results.map((m) => this.mapManga(m));
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const cleanId = manga.id.replace(/^mangadex:/, '');
    const m = await getMangaDetails(cleanId);
    return this.mapManga(m);
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const cleanId = manga.id.replace(/^mangadex:/, '');
    const chaptersRes = await getMangaChapters(cleanId, 'en', 100, 0, 'desc');
    const chapters = chaptersRes.data || [];

    return chapters.map((ch: MangaDexChapter) => {
      const numStr = ch.attributes.chapter || '0';
      const num = parseFloat(numStr) || 0;
      const title = ch.attributes.title
        ? `Ch. ${numStr} - ${ch.attributes.title}`
        : `Chapter ${numStr}`;

      return {
        id: `mangadex:${ch.id}`,
        sourceId: 'mangadex',
        mangaId: manga.id,
        url: `/chapter/${ch.id}`,
        name: title,
        number: num,
        dateUpload: ch.attributes.publishAt ? Date.parse(ch.attributes.publishAt) : null,
      };
    });
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const cleanId = chapter.id.replace(/^mangadex:/, '');
    const pagesData = await getChapterPages(cleanId, false);

    return pagesData.pages.map((url: string, idx: number) => ({
      index: idx,
      url,
      headers: {
        'User-Agent': 'MangaReaderApp/1.0.0',
      },
    }));
  }
}
