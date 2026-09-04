/**
 * MangaDex API & App Type Definitions
 */

// ─── MangaDex API Types ───────────────────────────────────────────

export interface MangaDexResponse<T> {
  result: 'ok' | 'error';
  response: string;
  data: T;
  limit?: number;
  offset?: number;
  total?: number;
}

export interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: Record<string, any>;
}

export interface MangaAttributes {
  title: Record<string, string>;
  altTitles: Record<string, string>[];
  description: Record<string, string>;
  isLocked: boolean;
  links: Record<string, string> | null;
  originalLanguage: string;
  lastVolume: string | null;
  lastChapter: string | null;
  publicationDemographic: 'shounen' | 'shoujo' | 'josei' | 'seinen' | null;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  year: number | null;
  contentRating: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
  tags: MangaTag[];
  state: string;
  createdAt: string;
  updatedAt: string;
  availableTranslatedLanguages: string[];
}

export interface MangaTag {
  id: string;
  type: 'tag';
  attributes: {
    name: Record<string, string>;
    group: string;
  };
}

export interface Manga {
  id: string;
  type: 'manga';
  attributes: MangaAttributes;
  relationships: MangaDexRelationship[];
}

export interface ChapterAttributes {
  volume: string | null;
  chapter: string | null;
  title: string | null;
  translatedLanguage: string;
  externalUrl: string | null;
  publishAt: string;
  readableAt: string;
  createdAt: string;
  updatedAt: string;
  pages: number;
}

export interface Chapter {
  id: string;
  type: 'chapter';
  attributes: ChapterAttributes;
  relationships: MangaDexRelationship[];
}

export interface ChapterPages {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

export interface CoverArtAttributes {
  fileName: string;
  description: string;
  volume: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

// ─── App Domain Types ─────────────────────────────────────────────

export type ReadingMode = 'webtoon' | 'ltr' | 'rtl' | 'single' | 'double';

export type ImageFit = 'width' | 'height' | 'original' | 'smart';

export type ReaderTheme = 'oled' | 'midnight' | 'dark' | 'sepia' | 'white';

export type LibraryCategory = 'reading' | 'plan_to_read' | 'completed' | 'favorites' | 'dropped';

export interface LibraryEntry {
  mangaId: string;
  title: string;
  coverUrl: string | null;
  category: LibraryCategory;
  lastReadChapterId: string | null;
  lastReadPage: number;
  totalChapters: number;
  unreadCount: number;
  addedAt: number; // timestamp
  updatedAt: number;
}

export interface HistoryEntry {
  mangaId: string;
  chapterId: string;
  title: string;
  chapterTitle: string;
  coverUrl: string | null;
  pageIndex: number;
  totalPages: number;
  timestamp: number;
}

export interface Extension {
  id: string;
  name: string;
  baseUrl: string;
  type: 'mangadex' | 'custom_json' | 'custom_url';
  enabled: boolean;
  icon?: string;
}

export interface CustomChapterManifest {
  title: string;
  chapters: {
    id: string;
    name: string;
    pages: string[];
  }[];
}

// ─── Search & Filter Types ────────────────────────────────────────

export interface SearchFilters {
  title?: string;
  includedTags?: string[];
  excludedTags?: string[];
  status?: ('ongoing' | 'completed' | 'hiatus' | 'cancelled')[];
  publicationDemographic?: ('shounen' | 'shoujo' | 'josei' | 'seinen')[];
  contentRating?: ('safe' | 'suggestive' | 'erotica' | 'pornographic')[];
  translatedLanguage?: string[];
  sort?: 'relevance' | 'latestUploadedChapter' | 'followedCount' | 'createdAt' | 'year' | 'rating' | 'title';
  order?: 'asc' | 'desc';
  orders?: Record<string, 'asc' | 'desc'>;
}
