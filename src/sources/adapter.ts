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
  extractCoverFileName,
  getMangaTitle,
} from '../api/mangadex';
import { CacheManager } from '../utils/cacheManager';
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

  return (
    idOrUrl.includes(':') ||
    idOrUrl.startsWith('http://') ||
    idOrUrl.startsWith('https://') ||
    idOrUrl.startsWith('/') ||
    idOrUrl.includes('/')
  );
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
export async function getUniversalMangaDetails(
  mangaId: string,
  initialCoverUrl?: string | null,
  initialTitle?: string | null
): Promise<Manga> {
  const cacheKey = `manga_details_${mangaId}`;
  const cached = await CacheManager.get<Manga>(cacheKey);
  if (cached) {
    const cachedCover = extractCoverFileName(cached);
    const cachedTitle = getMangaTitle(cached);
    const isCorruptedSpa =
      !cachedTitle ||
      cachedTitle.toLowerCase().includes('read manga online free') ||
      cachedTitle.toLowerCase().includes('mangafire -');

    if (!isCorruptedSpa && (cachedCover || !initialCoverUrl)) {
      return cached;
    }
  }

  let result: Manga;
  if (!isExternalSource(mangaId)) {
    const cleanId = mangaId.replace(/^mangadex:/, '');
    result = await getMangaDexDetails(cleanId);
  } else {
    const resolved = SourceManager.resolveSource(mangaId);
    if (!resolved) {
      throw new Error(`Unable to resolve manga source for: ${mangaId}`);
    }

    const dummyManga: SourceManga = {
      id: mangaId,
      sourceId: resolved.parser.metadata.id,
      title: initialTitle || '',
      url: resolved.rawId,
      publicUrl: resolved.rawId.startsWith('http')
        ? resolved.rawId
        : resolved.parser.metadata.id === 'reimanga'
        ? `${resolved.parser.metadata.baseUrl}/manga/${resolved.rawId.replace(/^(?:reimanga:)?(?:\/manga\/)?/, '').replace(/^\/+/, '')}`
        : `${resolved.parser.metadata.baseUrl}/${resolved.rawId.replace(/^\/+/, '')}`,
      coverUrl: initialCoverUrl || null,
      coverHeaders: resolved.parser.getImageHeaders ? resolved.parser.getImageHeaders() : undefined,
    };

    const detailed = await resolved.parser.getDetails(dummyManga);

    // Safeguard: Ensure coverUrl and title are preserved from initial values if detailed is missing them
    if (!detailed.coverUrl && initialCoverUrl) {
      detailed.coverUrl = initialCoverUrl;
    }
    if (!detailed.title && initialTitle) {
      detailed.title = initialTitle;
    }

    result = sourceMangaToAppManga(detailed);
  }

  if (result) {
    await CacheManager.set(cacheKey, result, 30 * 60 * 1000); // 30 min TTL
  }
  return result;
}

/**
 * Universal Manga Chapters Fetcher with CacheManager integration (30m TTL)
 */
export async function getUniversalMangaChapters(mangaId: string): Promise<Chapter[]> {
  const cacheKey = `ch_list_${mangaId}`;
  const cached = await CacheManager.get<Chapter[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  let result: Chapter[] = [];
  if (!isExternalSource(mangaId)) {
    const cleanId = mangaId.replace(/^mangadex:/, '');
    const { getMangaChapters } = await import('../api/mangadex');
    const res = await getMangaChapters(cleanId, 'en', 100, 0, 'desc');
    result = res.data || [];
  } else {
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
        : resolved.parser.metadata.id === 'reimanga'
        ? `${resolved.parser.metadata.baseUrl}/manga/${resolved.rawId.replace(/^(?:reimanga:)?(?:\/manga\/)?/, '').replace(/^\/+/, '')}`
        : `${resolved.parser.metadata.baseUrl}/${resolved.rawId.replace(/^\/+/, '')}`,
      coverUrl: null,
    };

    const sourceChapters = await resolved.parser.getChapters(dummyManga);
    result = sourceChapters.map((sc) => sourceChapterToAppChapter(sc));
  }

  if (result && result.length > 0) {
    await CacheManager.set(cacheKey, result, 30 * 60 * 1000); // 30 min TTL
  }
  return result;
}

/**
 * Universal Chapter Pages Fetcher with CacheManager integration (24h TTL)
 */
export async function getUniversalChapterPages(
  chapterId: string
): Promise<{ pages: string[]; headers?: Record<string, string>; mangaId?: string }> {
  const cacheKey = `ch_pages_${chapterId}`;
  const cached = await CacheManager.get<{ pages: string[]; headers?: Record<string, string>; mangaId?: string }>(
    cacheKey
  );
  if (cached && cached.pages && cached.pages.length > 0) {
    const hasRelative = cached.pages.some((p) => !p.startsWith('http') && !p.startsWith('data:'));
    if (hasRelative) {
      const resolved = SourceManager.resolveSource(chapterId);
      const base = resolved?.parser.metadata.baseUrl?.replace(/\/+$/, '') || 'https://philiascans.org';
      cached.pages = cached.pages.map((p) => {
        if (!p.startsWith('http') && !p.startsWith('data:')) {
          return `${base}/${p.replace(/^\/+/, '')}`;
        }
        return p;
      });
      await CacheManager.set(cacheKey, cached, 24 * 60 * 60 * 1000);
    }
    return cached;
  }

  let result: { pages: string[]; headers?: Record<string, string>; mangaId?: string };

  if (!isExternalSource(chapterId)) {
    const cleanId = chapterId.replace(/^mangadex:/, '');
    const { getChapterPages } = await import('../api/mangadex');
    const { useReaderStore } = await import('../store/readerStore');
    const isDataSaver = useReaderStore.getState().dataSaver;
    const res = await getChapterPages(cleanId, isDataSaver);
    result = { pages: res.pages };
  } else {
    const resolved = SourceManager.resolveSource(chapterId);
    if (!resolved) {
      throw new Error(`Unable to resolve chapter source for: ${chapterId}`);
    }

    let reconstructedUrl = resolved.rawId;
    const rawParts = resolved.rawId.split(':');
    const sourceId = resolved.parser.metadata.id;

    if (sourceId === 'projectsuki' && rawParts.length >= 2) {
      reconstructedUrl = `/read/${rawParts[0]}/${rawParts[1]}/1`;
    } else if (sourceId === 'mangaball' && rawParts.length >= 2) {
      reconstructedUrl = `/chapter-detail/${rawParts[1]}`;
    } else if (sourceId === 'atsumaru' && rawParts.length >= 2) {
      reconstructedUrl = `/read/${rawParts[0]}/${rawParts[1]}`;
    } else if (sourceId === 'mangago' && rawParts.length >= 2) {
      const slug = rawParts[0];
      if (rawParts.length >= 3) {
        // e.g. ["shutline", "uu", "br_chapter-449456"] or ["cherry_blossoms_after_winter", "nbt", "br_chapter-451165"]
        const sec = rawParts[1];
        let fol = rawParts[2];
        if (/^\d+$/.test(fol)) fol = `br_chapter-${fol}`;
        reconstructedUrl = `/read-manga/${slug}/${sec}/${fol}/pg-1/`;
      } else {
        let token = rawParts[1];
        if (/^\d+$/.test(token)) {
          token = `br_chapter-${token}`;
        }
        if (token.includes('/')) {
          reconstructedUrl = `/read-manga/${slug}/${token.replace(/^\/+/, '').replace(/\/$/, '')}/pg-1/`;
        } else {
          reconstructedUrl = `/read-manga/${slug}/uu/${token}/pg-1/`;
        }
      }
      reconstructedUrl = reconstructedUrl.replace(/\/pg-\d+\/pg-\d+\/?$/, '/pg-1/').replace(/\/?$/, '/');
    } else if (sourceId === 'weebcentral') {
      const cleanRaw = resolved.rawId.replace(/^weebcentral:/, '');
      const token = rawParts.length >= 2 ? rawParts[rawParts.length - 1] : cleanRaw;
      reconstructedUrl = token.startsWith('/') ? token : `/chapters/${token}`;
    } else if (sourceId === 'mangak') {
      const cleanRaw = resolved.rawId.replace(/^mangak:/, '');
      reconstructedUrl = cleanRaw.startsWith('/') ? cleanRaw : `/${cleanRaw}`;
    } else if (sourceId === 'onisaga') {
      const cleanRaw = resolved.rawId.replace(/^onisaga:/, '');
      if (rawParts.length >= 2) {
        reconstructedUrl = `/read/${rawParts[0]}/${rawParts[1]}`;
      } else {
        reconstructedUrl = cleanRaw.startsWith('/') ? cleanRaw : `/read/${cleanRaw.replace(/^read\//, '')}`;
      }
    } else if (sourceId === 'toonkotsu') {
      const cleanRaw = resolved.rawId.replace(/^toonkotsu:/, '');
      reconstructedUrl = cleanRaw.startsWith('/') ? cleanRaw : `/${cleanRaw}`;
    } else if (sourceId === 'reimanga') {
      if (rawParts.length >= 2) {
        const mangaSlug = rawParts[0].replace(/^(?:reimanga:)?(?:\/manga\/)?/, '').replace(/^\/+/, '');
        const chToken = rawParts[rawParts.length - 1];
        reconstructedUrl = `/manga/${mangaSlug}/${chToken}`;
      } else {
        const clean = resolved.rawId.replace(/^reimanga:/, '').replace(/^\/+/, '');
        reconstructedUrl = clean.startsWith('manga/') ? `/${clean}` : `/manga/${clean}`;
      }
    }

    const dummyChapter: SourceChapter = {
      id: chapterId,
      sourceId: resolved.parser.metadata.id,
      mangaId: rawParts.length >= 2 ? rawParts[0] : '',
      url: reconstructedUrl,
      name: '',
      number: 0,
    };

    const sourcePages = await resolved.parser.getPages(dummyChapter);
    const base = resolved.parser.metadata.baseUrl?.replace(/\/+$/, '') || '';
    const pages = sourcePages.map((p) => {
      let u = p.url;
      if (u && !u.startsWith('http') && !u.startsWith('data:') && base) {
        u = `${base}/${u.replace(/^\/+/, '')}`;
      }
      return u;
    });
    const headers = sourcePages[0]?.headers || (resolved.parser as any).getRequestHeaders?.();

    result = {
      pages,
      headers,
      mangaId: dummyChapter.mangaId || undefined,
    };
  }

  if (result && result.pages && result.pages.length > 0) {
    const isPlaceholderOnly = result.pages.every((p) => p.includes('placeholder') || p.includes('logo-new-g'));
    if (!isPlaceholderOnly) {
      await CacheManager.set(cacheKey, result, 24 * 60 * 60 * 1000); // 24 hours TTL
    }
  }

  return result;
}

/**
 * Resolves a human-friendly display name for a manga/chapter ID or URL
 * e.g. "asurascans:solo-leveling" -> "AsuraScans"
 * "mangadex:..." or UUID -> "MangaDex"
 */
export function getSourceDisplayName(idOrUrl?: string | null): string {
  if (!idOrUrl) return 'Manga';
  if (!isExternalSource(idOrUrl)) return 'MangaDex';

  const resolved = SourceManager.resolveSource(idOrUrl);
  if (resolved?.parser?.metadata?.name) {
    return resolved.parser.metadata.name;
  }

  const colonIdx = idOrUrl.indexOf(':');
  if (colonIdx > 0) {
    const prefix = idOrUrl.substring(0, colonIdx);
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }

  return 'External';
}

/**
 * Universal Similar / Recommended Manga Fetcher
 * Dispatches to MangaDex tag search or the corresponding Kotatsu extension catalog
 */
export async function getUniversalSimilarManga(
  mangaId: string,
  currentManga: Manga
): Promise<Manga[]> {
  const cacheKey = `similar_manga_${mangaId}`;
  const cached = await CacheManager.get<Manga[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  let results: Manga[] = [];

  if (!isExternalSource(mangaId)) {
    const cleanId = mangaId.replace(/^mangadex:/, '');
    const tagIds = (currentManga.attributes?.tags || [])
      .map((t) => t.id)
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id))
      .slice(0, 4);

    if (tagIds.length > 0) {
      try {
        const { searchManga } = await import('../api/mangadex');
        const searchRes = await searchManga(
          {
            includedTags: tagIds,
            sort: 'followedCount',
            order: 'desc',
          },
          12
        );
        results = (searchRes.data || []).filter((m) => m.id !== cleanId && m.id !== mangaId);
      } catch (e) {
        console.warn('MangaDex tag search for similar failed:', e);
      }
    }

    if (results.length === 0) {
      const { getPopularManga } = await import('../api/mangadex');
      const popular = await getPopularManga(12);
      results = (popular || []).filter((m) => m.id !== cleanId && m.id !== mangaId);
    }
  } else {
    const resolved = SourceManager.resolveSource(mangaId);
    if (resolved) {
      const parser = resolved.parser;
      const genreTags = (currentManga.attributes?.tags || [])
        .map((t) => t.attributes?.name?.en)
        .filter(Boolean) as string[];

      let sourceItems: SourceManga[] = [];

      // 1. Try querying extension with primary genre if available
      if (genreTags.length > 0) {
        try {
          const tagFiltered = await parser.getList({
            tags: [genreTags[0]],
            order: 'popular',
            page: 1,
          });
          sourceItems = (tagFiltered || []).filter(
            (item) => item.id !== mangaId && item.url !== resolved.rawId
          );
        } catch (e) {
          console.warn(`Tag search on extension ${parser.metadata.name} failed:`, e);
        }
      }

      // 2. Fallback to extension's popular / featured catalog
      if (!sourceItems || sourceItems.length === 0) {
        try {
          const popularItems = await parser.getList({
            order: 'popular',
            page: 1,
          });
          sourceItems = (popularItems || []).filter(
            (item) => item.id !== mangaId && item.url !== resolved.rawId
          );
        } catch (e) {
          console.warn(`Popular search on extension ${parser.metadata.name} failed:`, e);
        }
      }

      results = (sourceItems || []).slice(0, 9).map((sm) => sourceMangaToAppManga(sm));
    }
  }

  const finalResults = results.slice(0, 9);
  if (finalResults.length > 0) {
    await CacheManager.set(cacheKey, finalResults, 30 * 60 * 1000); // 30 min TTL
  }
  return finalResults;
}
