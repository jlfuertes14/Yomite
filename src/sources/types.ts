/**
 * Manga Source & Extension Type Definitions
 * Inspired by Kotatsu (https://github.com/KotatsuApp/kotatsu-parsers)
 */

export type SourceLocale =
  | 'all'
  | 'en'
  | 'es'
  | 'fr'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'id'
  | 'pt'
  | 'ru'
  | 'it'
  | 'de'
  | 'ar';

export type SourceSortOrder =
  | 'popular'
  | 'latest'
  | 'newest'
  | 'alphabetical'
  | 'rating';

export type MangaState =
  | 'ongoing'
  | 'completed'
  | 'hiatus'
  | 'cancelled'
  | 'abandoned'
  | 'paused'
  | 'unknown';

export type ContentRating = 'safe' | 'suggestive' | 'adult';

export interface SourceManga {
  id: string; // Global or source-scoped ID, e.g. "manganato:manga-bn978870"
  sourceId: string; // The parser id (e.g. "mangadex", "manganato", "asurascans")
  url: string; // Relative or full path on site
  publicUrl: string; // Direct browser URL
  title: string;
  altTitles?: string[];
  coverUrl: string | null;
  coverHeaders?: Record<string, string>;
  authors?: string[];
  artists?: string[];
  description?: string;
  tags?: string[];
  state?: MangaState;
  rating?: number; // Normalized 0..5 or 0..10
  contentRating?: ContentRating;
  chaptersCount?: number;
  lastUpdated?: number; // Unix timestamp ms
  locale?: string; // Language / locale code, e.g. "ja", "zh", "en"
}

export interface SourceChapter {
  id: string; // e.g. "manganato:manga-bn978870/chapter-1"
  sourceId: string;
  mangaId: string;
  url: string; // Relative or full URL for chapter reader
  name: string; // e.g. "Chapter 1: The Beginning"
  number: number; // e.g. 1.0 or 1.5
  dateUpload?: number | null; // Timestamp ms
  scanlator?: string | null;
  locale?: string; // Language / locale code, e.g. "ja", "zh", "en"
}

export interface SourcePage {
  index: number;
  url: string;
  headers?: Record<string, string>; // Essential for Hotlink protection (Referer, User-Agent)
}

export interface SourceTag {
  id: string; // Query ID, slug, or search syntax
  label: string; // Clean display label
  group?: string; // e.g. "Genre", "Category", "Tag", "Format"
}

export interface SourceSortOption {
  id: SourceSortOrder | string;
  label: string;
}

export interface SourceFilter {
  query?: string;
  page?: number;
  order?: SourceSortOrder | string;
  tags?: string[];
  tagsExclude?: string[];
  state?: MangaState;
  author?: string;
}

export interface MangaSourceMetadata {
  id: string;
  name: string;
  domain: string;
  baseUrl: string;
  locale: SourceLocale;
  isNsfw: boolean;
  version: string;
  icon?: string;
  description: string;
  availableSortOrders: SourceSortOrder[];
  enabled: boolean;
}

export interface MangaParser {
  readonly metadata: MangaSourceMetadata;

  /**
   * Returns supported tags/genres for catalog browsing
   */
  getAvailableTags?(): Promise<SourceTag[]> | SourceTag[];

  /**
   * Returns supported sort options for catalog browsing
   */
  getAvailableSorts?(): Promise<SourceSortOption[]> | SourceSortOption[];

  /**
   * Search or browse the catalog with pagination
   */
  getList(filter: SourceFilter): Promise<SourceManga[]>;

  /**
   * Fetch full metadata, synopsis, and tags
   */
  getDetails(manga: SourceManga): Promise<SourceManga>;

  /**
   * Fetch chapter list for specified manga
   */
  getChapters(manga: SourceManga): Promise<SourceChapter[]>;

  /**
   * Fetch pages for specified chapter
   */
  getPages(chapter: SourceChapter): Promise<SourcePage[]>;

  /**
   * Resolves a web URL to this parser if supported
   */
  resolveUrl?(url: string): { type: 'manga' | 'chapter'; id: string } | null;
}

export interface CatalogSourceItem {
  id: string;
  name: string;
  title: string;
  domain: string;
  baseUrl: string;
  locale: string;
  contentType: 'manga' | 'comic' | 'hentai';
  engine: string;
  isBroken: boolean;
  brokenReason?: string;
  icon?: string;
}
