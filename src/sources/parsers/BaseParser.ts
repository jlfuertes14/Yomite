/**
 * Base Abstract Manga Parser
 * Ported from Kotatsu's AbstractMangaParser.kt & PagedMangaParser.kt
 */
import {
  MangaParser,
  MangaSourceMetadata,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
  SourceSortOption,
  SourceTag,
} from '../types';
import { sourceHttpClient, DEFAULT_USER_AGENT } from '../network/httpClient';
import { ParsedHtml } from '../network/htmlParser';

export abstract class BaseParser implements MangaParser {
  public abstract readonly metadata: MangaSourceMetadata;

  public abstract getList(filter: SourceFilter): Promise<SourceManga[]>;
  public abstract getDetails(manga: SourceManga): Promise<SourceManga>;
  public abstract getChapters(manga: SourceManga): Promise<SourceChapter[]>;
  public abstract getPages(chapter: SourceChapter): Promise<SourcePage[]>;

  /**
   * Default available sort options based on metadata.availableSortOrders
   */
  public getAvailableSorts(): SourceSortOption[] {
    const labelMap: Record<string, string> = {
      popular: 'Popular',
      latest: 'Latest',
      newest: 'Newest',
      rating: 'Top Rated',
      alphabetical: 'A-Z',
    };
    const sorts = this.metadata.availableSortOrders || ['popular', 'latest'];
    return sorts.map((id) => ({
      id,
      label: labelMap[id] || id.charAt(0).toUpperCase() + id.slice(1),
    }));
  }

  /**
   * Returns supported tags or genres for this source
   */
  public async getAvailableTags(): Promise<SourceTag[]> {
    return [];
  }

  /**
   * Default headers used when loading pages or images from this source
   */
  public getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: this.metadata.baseUrl,
    };
  }

  /**
   * Helper to resolve relative URLs into full URLs
   */
  protected toAbsoluteUrl(url: string, baseDomain = this.metadata.baseUrl): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    const cleanBase = baseDomain.replace(/\/+$/, '');
    const cleanPath = url.replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  /**
   * Helper to strip whitespace, newlines, and unicode spaces
   */
  protected cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\r\n|\n|\r|\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Helper to strip HTML tags, decode entities, and preserve paragraphs
   */
  protected stripHtml(html: string | null | undefined): string {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\r\n|\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extracts chapter number from strings like "Chapter 10.5 - Extra" -> 10.5
   * Safely handles undefined, null, numbers, or non-string inputs.
   */
  protected parseChapterNumber(name: any): number {
    if (name === null || name === undefined) return 0;
    if (typeof name === 'number') return isNaN(name) ? 0 : name;
    const str = String(name).trim();
    if (!str) return 0;

    const match = str.match(/(?:chapter|ch\.?|ep\.?|episode)\s*([\d.]+)/i);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) return num;
    }
    const standaloneMatch = str.match(/^([\d.]+)/);
    if (standaloneMatch && standaloneMatch[1]) {
      const num = parseFloat(standaloneMatch[1]);
      if (!isNaN(num)) return num;
    }
    const anyNumberMatch = str.match(/[\d.]+/);
    if (anyNumberMatch) {
      const num = parseFloat(anyNumberMatch[0]);
      if (!isNaN(num)) return num;
    }
    return 0;
  }

  /**
   * Scrapes HTML from a given URL using the source's headers.
   * Automatically normalizes relative paths or slugs into absolute URLs.
   */
  protected async fetchHtml(url: string): Promise<ParsedHtml> {
    const fullUrl = this.toAbsoluteUrl(url);
    return sourceHttpClient.fetchHtml(fullUrl, {
      referer: this.metadata.baseUrl,
      sourceId: this.metadata.name,
    });
  }

  /**
   * Helper to parse fuzzy dates e.g. "2 hours ago", "Yesterday", "Nov 12, 2024"
   */
  protected parseDate(dateStr: string): number | null {
    if (!dateStr) return null;
    const clean = dateStr.toLowerCase().trim();

    const now = Date.now();
    const second = 1000;
    const minute = 60 * second;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (clean.includes('just now') || clean.includes('a moment ago')) {
      return now;
    }

    const agoMatch = clean.match(/(\d+)\s*(sec|second|min|minute|hour|day|week|month|year)s?\s*ago/);
    if (agoMatch) {
      const amount = parseInt(agoMatch[1], 10);
      const unit = agoMatch[2];
      if (unit.startsWith('sec')) return now - amount * second;
      if (unit.startsWith('min')) return now - amount * minute;
      if (unit.startsWith('hour')) return now - amount * hour;
      if (unit.startsWith('day')) return now - amount * day;
      if (unit.startsWith('week')) return now - amount * 7 * day;
      if (unit.startsWith('month')) return now - amount * 30 * day;
      if (unit.startsWith('year')) return now - amount * 365 * day;
    }

    const timestamp = Date.parse(dateStr);
    return isNaN(timestamp) ? null : timestamp;
  }
}
