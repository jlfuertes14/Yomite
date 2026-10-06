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

    let results: MangaDexManga[] = [];

    if (filter.query && filter.query.trim().length > 0) {
      const searchRes = await searchManga({ title: filter.query.trim() }, limit, offset);
      results = searchRes.data;
    } else if (filter.order === 'popular') {
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
