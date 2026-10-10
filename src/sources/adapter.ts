/**
 * Unified Source Adapter & Interoperability Bridge
 * Converts SourceManga / SourceChapter into the app's internal domain models
 * and routes data loading to either MangaDex API or Kotatsu Extension Parsers.
 */
import { SourceManga, SourceChapter, SourcePage } from './types';
import { SourceManager } from './SourceManager';
import {
  getMangaDetails as getMangaDexDetails,
  getMangaChapters as getMangaDexChapters,
  getChapterPages as getMangaDexPages,
} from '../api/mangadex';
import type { Manga, Chapter } from '../types';

/**
 * Checks if an ID or URL represents an external Kotatsu source
 * e.g. "manganato:...", "manhuafast:...", "https://..."
 */
export function isExternalSource(idOrUrl: string): boolean {
  if (!idOrUrl) return false;
  if (idOrUrl.startsWith('mangadex:')) return false;

  // UUID format used by MangaDex: 8-4-4-4-12
  const isMangaDexUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    idOrUrl
  );
  if (isMangaDexUuid) return false;

  return idOrUrl.includes(':') || idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://');
}

/**
 * Converts a SourceManga into the app's standard Manga type
 */
export function sourceMangaToAppManga(s: SourceManga): Manga {
  const authorRel = s.authors?.[0]
    ? [
        {
          id: `author-${s.authors[0]}`,
          type: 'author',
          attributes: { name: s.authors[0] },
        },
      ]
    : [];

  const artistRel = s.artists?.[0]
    ? [
        {
          id: `artist-${s.artists[0]}`,
          type: 'artist',
          attributes: { name: s.artists[0] },
        },
      ]
    : [];

  const coverRel = s.coverUrl
    ? [
        {
          id: `cover-${s.id}`,
          type: 'cover_art',
          attributes: {
            fileName: s.coverUrl, // We store the full URL or relative path
          },
        },
      ]
    : [];

  return {
    id: s.id,
    type: 'manga',
    attributes: {
      title: { en: s.title },
      altTitles: s.altTitles ? s.altTitles.map((t) => ({ en: t })) : [],
      description: { en: s.description || '' },
      isLocked: false,
      links: s.publicUrl ? { raw: s.publicUrl } : null,
      originalLanguage: s.locale || (s.sourceId === 'mangadex' || s.sourceId === 'nhentai' || s.sourceId === 'hitomila' ? 'ja' : 'en'),
      lastVolume: null,
      lastChapter: s.chaptersCount ? String(s.chaptersCount) : null,
      publicationDemographic: null,
      status: (s.state as any) || 'ongoing',
      year: null,
      contentRating: (s.contentRating as any) || 'safe',
      tags: (s.tags || []).map((t, idx) => ({
        id: `tag-${idx}`,
        type: 'tag',
        attributes: {
          name: { en: t },
          group: 'genre',
        },
      })),
      state: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: s.lastUpdated ? new Date(s.lastUpdated).toISOString() : new Date().toISOString(),
      availableTranslatedLanguages: s.locale ? [s.locale] : ['en'],
    },
    relationships: [...authorRel, ...artistRel, ...coverRel],
  };
}

/**
 * Converts a SourceChapter into the app's standard Chapter type
 */
export function sourceChapterToAppChapter(c: SourceChapter): Chapter {
  const sourceParser = SourceManager.getParser(c.sourceId);
  const sourceName = sourceParser?.metadata.name || c.sourceId;
  const scanlatorName = c.scanlator || sourceName;

  return {
    id: c.id,
    type: 'chapter',
    attributes: {
      volume: null,
      chapter: c.number.toString(),
      title: c.name,
      translatedLanguage: c.locale || 'en',
      externalUrl: c.url,
      publishAt: c.dateUpload ? new Date(c.dateUpload).toISOString() : new Date().toISOString(),
      readableAt: c.dateUpload ? new Date(c.dateUpload).toISOString() : new Date().toISOString(),
      createdAt: c.dateUpload ? new Date(c.dateUpload).toISOString() : new Date().toISOString(),
      updatedAt: c.dateUpload ? new Date(c.dateUpload).toISOString() : new Date().toISOString(),
      pages: 0,
    },
    relationships: [
      {
        id: c.mangaId,
        type: 'manga',
      },
      {
        id: `scanlator-${scanlatorName}`,
        type: 'scanlation_group',
        attributes: { name: scanlatorName },
      },
    ],
  };
}

/**
 * Universal Manga Details Fetcher
 * Automatically dispatches to either MangaDex or the corresponding Kotatsu extension
 */
export async function getUniversalMangaDetails(mangaId: string): Promise<Manga> {
  if (!isExternalSource(mangaId)) {
    const cleanId = mangaId.replace(/^mangadex:/, '');
    return getMangaDexDetails(cleanId);
  }

  const resolved = SourceManager.resolveSource(mangaId);
  if (!resolved) {
    throw new Error(`Unable to resolve manga source for: ${mangaId}`);
  }

  const dummyManga: SourceManga = {
    id: mangaId,
    sourceId: resolved.parser.metadata.id,
    title: '',
    url: resolved.rawId,
    publicUrl: resolved.rawId.startsWith('http')
      ? resolved.rawId
      : `${resolved.parser.metadata.baseUrl}/${resolved.rawId.replace(/^\/+/, '')}`,
    coverUrl: null,
  };

  const detailed = await resolved.parser.getDetails(dummyManga);
  return sourceMangaToAppManga(detailed);
}

/**
 * Universal Manga Chapters Fetcher
 */
export async function getUniversalMangaChapters(mangaId: string): Promise<Chapter[]> {
  if (!isExternalSource(mangaId)) {
    const cleanId = mangaId.replace(/^mangadex:/, '');
    const { getMangaChapters } = await import('../api/mangadex');
    const res = await getMangaChapters(cleanId, 'en', 100, 0, 'desc');
    return res.data || [];
  }

  const resolved = SourceManager.resolveSource(mangaId);
  if (!resolved) {
    throw new Error(`Unable to resolve manga source for: ${mangaId}`);
  }

  const dummyManga: SourceManga = {
    id: mangaId,
    sourceId: resolved.parser.metadata.id,
    title: '',
    url: resolved.rawId,
    publicUrl: resolved.rawId.startsWith('http')
      ? resolved.rawId
      : `${resolved.parser.metadata.baseUrl}/${resolved.rawId.replace(/^\/+/, '')}`,
    coverUrl: null,
  };

  const sourceChapters = await resolved.parser.getChapters(dummyManga);
  return sourceChapters.map((sc) => sourceChapterToAppChapter(sc));
}

/**
 * Universal Chapter Pages Fetcher
 */
export async function getUniversalChapterPages(
  chapterId: string
): Promise<{ pages: string[]; headers?: Record<string, string> }> {
  if (!isExternalSource(chapterId)) {
    const cleanId = chapterId.replace(/^mangadex:/, '');
    const { getChapterPages } = await import('../api/mangadex');
    const res = await getChapterPages(cleanId, false);
    return { pages: res.pages };
  }

  const resolved = SourceManager.resolveSource(chapterId);
  if (!resolved) {
    throw new Error(`Unable to resolve chapter source for: ${chapterId}`);
  }

  const dummyChapter: SourceChapter = {
    id: chapterId,
    sourceId: resolved.parser.metadata.id,
    mangaId: '',
    url: resolved.rawId,
    name: '',
    number: 0,
  };

  const sourcePages = await resolved.parser.getPages(dummyChapter);
  const pages = sourcePages.map((p) => p.url);
  const headers = sourcePages[0]?.headers || (resolved.parser as any).getRequestHeaders?.();

  return {
    pages,
    headers,
  };
}
