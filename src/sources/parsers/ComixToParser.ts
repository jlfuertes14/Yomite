/**
 * Comix.to Parser
 *
 * Scrapes manga catalog, details, chapters, and reader pages from comix.to.
 * Supports SSR initial-data extraction and full Cloudflare Turnstile challenge detection.
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
import { DEFAULT_USER_AGENT } from '../network/httpClient';
import { CloudFlareError, CloudFlareStatus } from '../network/cloudflare';

export class ComixToParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'comix-to',
      name: 'Comix',
      domain: 'comix.to',
      baseUrl: 'https://comix.to',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=comix.to&sz=64',
      description: 'Massive library of manga, manhwa, and comics from Comix.to.',
      availableSortOrders: ['popular', 'latest', 'alphabetical', 'rating', 'newest'],
      enabled: true,
      ...metadata,
    };
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

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'action', label: 'Action', group: 'Genre' },
      { id: 'adult', label: 'Adult', group: 'Genre' },
      { id: 'adventure', label: 'Adventure', group: 'Genre' },
      { id: 'boys-love', label: 'Boys Love', group: 'Genre' },
      { id: 'comedy', label: 'Comedy', group: 'Genre' },
      { id: 'crime', label: 'Crime', group: 'Genre' },
      { id: 'drama', label: 'Drama', group: 'Genre' },
      { id: 'ecchi', label: 'Ecchi', group: 'Genre' },
      { id: 'fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'girls-love', label: 'Girls Love', group: 'Genre' },
      { id: 'harem', label: 'Harem', group: 'Genre' },
      { id: 'historical', label: 'Historical', group: 'Genre' },
      { id: 'horror', label: 'Horror', group: 'Genre' },
      { id: 'isekai', label: 'Isekai', group: 'Genre' },
      { id: 'magical-girls', label: 'Magical Girls', group: 'Genre' },
      { id: 'mature', label: 'Mature', group: 'Genre' },
      { id: 'mecha', label: 'Mecha', group: 'Genre' },
      { id: 'medical', label: 'Medical', group: 'Genre' },
      { id: 'mystery', label: 'Mystery', group: 'Genre' },
      { id: 'philosophical', label: 'Philosophical', group: 'Genre' },
      { id: 'psychological', label: 'Psychological', group: 'Genre' },
      { id: 'romance', label: 'Romance', group: 'Genre' },
      { id: 'sci-fi', label: 'Sci-Fi', group: 'Genre' },
      { id: 'slice-of-life', label: 'Slice of Life', group: 'Genre' },
      { id: 'smut', label: 'Smut', group: 'Genre' },
      { id: 'sports', label: 'Sports', group: 'Genre' },
      { id: 'superhero', label: 'Superhero', group: 'Genre' },
      { id: 'thriller', label: 'Thriller', group: 'Genre' },
      { id: 'tragedy', label: 'Tragedy', group: 'Genre' },
      { id: 'wuxia', label: 'Wuxia', group: 'Genre' },
    ];
  }

  private parseInitialData(rawHtml: string): any {
    const startTag = 'id="initial-data">';
    const idx = rawHtml.indexOf(startTag);
    if (idx === -1) return null;
    const end = rawHtml.indexOf('</script>', idx);
    if (end === -1) return null;
    try {
      return JSON.parse(rawHtml.slice(idx + startTag.length, end));
    } catch {
      return null;
    }
  }

  private parseRelativeTime(formatted?: string): number {
    if (!formatted) return 0;
    const match = formatted.match(/^(\d+)\s*(s|sec|m|min|h|hr|d|day|w|wk|week|mo|month|mos|y|yr|year)s?\s*ago$/i);
    if (!match) return 0;
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const now = Date.now();
    let ms = 0;
    if (unit === 's' || unit === 'sec') ms = amount * 1000;
    else if (unit === 'm' || unit === 'min') ms = amount * 60 * 1000;
    else if (unit === 'h' || unit === 'hr') ms = amount * 60 * 60 * 1000;
    else if (unit === 'd' || unit === 'day') ms = amount * 24 * 60 * 60 * 1000;
    else if (unit === 'w' || unit === 'wk' || unit === 'week') ms = amount * 7 * 24 * 60 * 60 * 1000;
    else if (unit === 'mo' || unit === 'month' || unit === 'mos') ms = amount * 30 * 24 * 60 * 60 * 1000;
    else if (unit === 'y' || unit === 'yr' || unit === 'year') ms = amount * 365 * 24 * 60 * 60 * 1000;
    return now - ms;
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = Math.max(1, filter.page || 1);
    const selectedTags = filter.tags || filter.includedTags;
    const hasQuery = !!(filter.query && filter.query.trim().length > 0);
    const hasTags = !!(selectedTags && selectedTags.length > 0);

    const url = `${this.metadata.baseUrl}/`;
    const $ = await this.fetchHtml(url);

    interface InternalComixItem extends SourceManga {
      followsTotal?: number;
      updatedAt?: number;
      createdAt?: number;
      type?: string;
    }

    const allItems: InternalComixItem[] = [];
    const seen = new Set<string>();

    // 1. Try DOM extraction
    $('a[href*="/title/"]').each((_, el) => {
      const href = el.attr('href') || '';
      if (!href || href.includes('-chapter-') || href.includes('/chapter/')) return;
      const slugMatch = href.match(/\/title\/([a-z0-9]+-[^/?#]+)/i);
      if (!slugMatch) return;
      const slug = slugMatch[1];
      if (seen.has(slug)) return;
      seen.add(slug);

      const title = this.cleanText(
        el.find('h3, h4, .title, .mpage__title, span').first().text() ||
        el.attr('title') ||
        el.find('img').first().attr('alt') ||
        this.titleFromSlug(slug)
      );

      if (!title || /chapter/i.test(title)) return;

      const img = el.find('img').first();
      const coverUrl = img.attr('src') || img.attr('data-src') || null;

      allItems.push({
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        url: `${this.metadata.baseUrl}/title/${slug}`,
        publicUrl: `${this.metadata.baseUrl}/title/${slug}`,
        title,
        coverUrl: coverUrl ? this.toAbsoluteUrl(coverUrl) : null,
      });
    });

    // 2. Try JSON initial-data extraction (both arrays and .items maps, only ["manga" queries)
    const rawHtml = $.root?.innerHTML || '';
    const initialData = this.parseInitialData(rawHtml);
    if (initialData?.queries) {
      for (const [key, val] of Object.entries(initialData.queries)) {
        if (!key.startsWith('["manga"')) continue;
        const list = Array.isArray(val) ? val : ((val as any)?.items && Array.isArray((val as any).items) ? (val as any).items : []);
        for (const item of list as any[]) {
          if (item && item.title && (item.url || item.hid)) {
            const itemUrl = item.url || `/title/${item.hid}`;
            const slug = itemUrl.replace(/^\/title\//, '').replace(/^\/+/, '');
            if (seen.has(slug)) continue;
            seen.add(slug);

            const altTitlesArr = Array.isArray(item.altTitles)
              ? item.altTitles.map((t: any) => String(t).trim()).filter(Boolean)
              : undefined;
            const upAt = this.parseRelativeTime(item.chapterUpdatedAtFormatted || item.updatedAtFormatted);
            const crAt = this.parseRelativeTime(item.createdAtFormatted);

            allItems.push({
              id: `${this.metadata.id}:${slug}`,
              sourceId: this.metadata.id,
              url: `${this.metadata.baseUrl}/title/${slug}`,
              publicUrl: `${this.metadata.baseUrl}/title/${slug}`,
              title: this.cleanText(item.title),
              coverUrl: item.poster?.large || item.poster?.medium || null,
              rating: item.ratedAvg ? Number(item.ratedAvg.toFixed(1)) : undefined,
              description: item.synopsis ? this.cleanText(item.synopsis) : undefined,
              state: item.status === 'releasing' ? 'ongoing' : item.status === 'finished' ? 'completed' : undefined,
              altTitles: altTitlesArr,
              followsTotal: item.followsTotal || 0,
              updatedAt: upAt,
              createdAt: crAt,
              type: item.type || '',
            });
          }
        }
      }
    }

    // 3. Filter by search query
    let filtered = allItems;
    if (hasQuery) {
      const q = filter.query!.trim().toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.description && m.description.toLowerCase().includes(q)) ||
          (m.altTitles && m.altTitles.some((at) => at.toLowerCase().includes(q)))
      );
    }

    // 4. Filter by genre / tags
    if (hasTags) {
      const GENRE_KEYWORDS: Record<string, RegExp> = {
        action: /action|sword|fight|battle|level|hunter|dungeon|warrior|combat|magic|assassin|blade/i,
        adult: /adult|mature|\b18\+\b|smut|ecchi|erotic|\bsex\b|\br-18\b/i,
        adventure: /adventure|journey|explore|quest|world|travel|expedition/i,
        'boys-love': /boys love|\bbl\b|yaoi|shounen ai/i,
        comedy: /comedy|funny|humor|hilarious|gag|parody/i,
        crime: /crime|mafia|gangster|yakuza|police|detective/i,
        drama: /drama|tragedy|emotional|betray|conflict/i,
        ecchi: /ecchi|fanservice|erotic|\blewd\b/i,
        fantasy: /fantasy|magic|demon|dragon|monster|reincarnat|isekai|emperor|prince|witch|wizard/i,
        'girls-love': /girls love|\bgl\b|yuri|shoujo ai/i,
        harem: /harem|multiple wives|concubines?/i,
        historical: /historical|dynasty|empire|kingdom|ancient|palace/i,
        horror: /horror|ghost|zombie|gore|monster|dead|haunt|scary/i,
        isekai: /isekai|transmigrat|reincarnat|another world|otherworld/i,
        'magical-girls': /magical girls?|mahou shoujo/i,
        mature: /mature|adult|seinen|smut|\b18\+\b/i,
        mecha: /mecha|robots?|piloting|androids?|cyborgs?/i,
        medical: /medical|doctor|hospital|surgeon|heal|physician/i,
        mystery: /mystery|detective|crime|secret|investigat|murder/i,
        philosophical: /philosophical|morality|deep/i,
        psychological: /psychological|mind|sanity|insane|manipulat|mental/i,
        romance: /romance|love|marriage|prince|emperor|duke|duchess|contract marriage|beloved|fianc/i,
        'sci-fi': /sci-fi|cyber|space|robot|tech|alien|future|futuristic|system/i,
        'slice-of-life': /slice of life|daily|peaceful|relax|food|cooking|life/i,
        smut: /smut|erotic|mature/i,
        sports: /sports|soccer|football|basketball|baseball|running|athlete/i,
        superhero: /superhero|hero|villain|powers|superpower/i,
        thriller: /thriller|suspense|chase|danger/i,
        tragedy: /tragedy|tragic|death|mourn/i,
        wuxia: /wuxia|xianxia|martial|murim|cultivat|sect|dao/i,
      };

      const rawTag = selectedTags![0].toLowerCase().trim();
      const tagObj = (await this.getAvailableTags()).find(
        (t) => t.id === rawTag || t.label.toLowerCase() === rawTag
      );
      const tagSlug = tagObj ? tagObj.id : rawTag.replace(/\s+/g, '-');
      const tagRegex = GENRE_KEYWORDS[tagSlug] || new RegExp(tagSlug.replace(/-/g, ' '), 'i');

      const genreMatched = filtered.filter((m) => {
        const combined = `${m.title} ${m.description || ''} ${m.altTitles?.join(' ') || ''} ${m.tags?.join(' ') || ''} ${m.type || ''}`;
        return tagRegex.test(combined);
      });

      filtered = genreMatched;
    }

    // 5. Apply sorting query
    if (filter.order === 'alphabetical') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (filter.order === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (filter.order === 'latest') {
      filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else if (filter.order === 'newest') {
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else {
      // 'popular' or default
      filtered.sort((a, b) => (b.followsTotal || 0) - (a.followsTotal || 0) || (b.rating || 0) - (a.rating || 0));
    }

    // 6. Pagination (24 items per page)
    const pageSize = 24;
    const start = (page - 1) * pageSize;
    const pageSlice = filtered.slice(start, start + pageSize);

    // 7. Only throw CloudFlareError if the page is an actual Cloudflare Challenge page
    if (pageSlice.length === 0 && allItems.length === 0) {
      const lower = rawHtml.toLowerCase();
      const isTrueChallenge =
        lower.includes('just a moment...') ||
        lower.includes('cf-turnstile') ||
        lower.includes('challenge-error-title') ||
        lower.includes('checking your browser before accessing');

      if (isTrueChallenge) {
        throw new CloudFlareError(
          `[${this.metadata.name}] Cloudflare verification required for comix.to.`,
          this.metadata.id,
          url,
          this.metadata.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
    }

    return pageSlice;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const url = this.toTitleUrl(manga.url);
    const $ = await this.fetchHtml(url);

    let title = this.cleanText(
      $('h1.mpage__title, .mpage__title, h1').first().text() ||
      manga.title
    );

    let cover =
      $('img.mpage__poster, .mpage__poster img').first().attr('src') ||
      $('img.mpage__poster, .mpage__poster img').first().attr('data-src') ||
      manga.coverUrl;

    let description = this.cleanText(
      $('.mpage__desc, .mpage__synopsis, [class*="desc"]').first().text()
    );

    const tags: string[] = [];
    $('a[href*="/genre/"], a[href*="/tag/"], .badge, .genre').each((_, el) => {
      const tagText = this.cleanText(el.text());
      if (tagText && !tags.includes(tagText)) tags.push(tagText);
    });

    let rating = manga.rating;
    let state = manga.state;

    // Enhance from initial-data if present
    const rawHtml = $.root?.innerHTML || '';
    const initialData = this.parseInitialData(rawHtml);
    if (initialData?.queries) {
      for (const [key, val] of Object.entries(initialData.queries)) {
        if (key.includes('detail') && val && (val as any).title) {
          const detail = val as any;
          if (detail.title) title = this.cleanText(detail.title);
          if (detail.synopsis) description = this.cleanText(detail.synopsis);
          if (detail.poster?.large || detail.poster?.medium) {
            cover = detail.poster.large || detail.poster.medium;
          }
          if (typeof detail.ratedAvg === 'number') {
            rating = Number(detail.ratedAvg.toFixed(1));
          }
          if (detail.status === 'releasing') state = 'ongoing';
          else if (detail.status === 'finished') state = 'completed';

          if (Array.isArray(detail.genres)) {
            for (const g of detail.genres) {
              const name = typeof g === 'string' ? g : g?.name || g?.label || g?.slug;
              if (name && !tags.includes(name)) tags.push(name);
            }
          }
          break;
        }
      }
    }

    const chapters = this.parseChapterLinks($, manga.id, url);

    // If detail page is completely empty and true Turnstile challenge is active
    const lower = rawHtml.toLowerCase();
    if (!description && !cover && (lower.includes('just a moment...') || lower.includes('cf-turnstile'))) {
      throw new CloudFlareError(
        `[${this.metadata.name}] Cloudflare verification required for comix.to.`,
        this.metadata.id,
        url,
        this.metadata.domain,
        CloudFlareStatus.CAPTCHA_CHALLENGE
      );
    }

    return {
      ...manga,
      title,
      url,
      publicUrl: url,
      coverUrl: cover ? this.toAbsoluteUrl(cover) : manga.coverUrl,
      description: description || manga.description,
      chaptersCount: chapters.length || manga.chaptersCount,
      rating: rating ?? manga.rating,
      state: state ?? manga.state,
      tags: tags.length ? tags : manga.tags,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const url = this.toTitleUrl(manga.url);
    const $ = await this.fetchHtml(url);
    let chapters = this.parseChapterLinks($, manga.id, url);

    const rawHtml = $.root?.innerHTML || '';
    const initialData = this.parseInitialData(rawHtml);
    let detail: any = null;
    if (initialData?.queries) {
      for (const [k, v] of Object.entries(initialData.queries)) {
        if (k.includes('detail') && v) {
          detail = v;
          break;
        }
      }
    }

    // If chapters were not in static HTML, synthesize from initialData URLs
    if (chapters.length === 0 && detail) {
      const comicSlug = manga.url.replace(/^.*\/title\//, '').replace(/^\/+/, '').split('/')[0];
      const seenUrls = new Set<string>();

      // Latest Chapter
      if (detail.latestChapterUrl) {
        const latestMatch = detail.latestChapterUrl.match(/\/title\/([^/]+)\/([^/?#]+)/i);
        const chSlug = latestMatch?.[2] || '';
        const num = detail.latestChapter || this.parseChapterNumber(chSlug) || 1;
        const absUrl = this.toAbsoluteUrl(detail.latestChapterUrl, this.metadata.baseUrl);
        seenUrls.add(absUrl);
        chapters.push({
          id: `${this.metadata.id}:${comicSlug}:${chSlug}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          url: absUrl,
          name: `Chapter ${num}`,
          number: num,
          scanlator: 'Comix',
        });
      }

      // First Chapter
      if (detail.firstChapterUrl) {
        const absUrl = this.toAbsoluteUrl(detail.firstChapterUrl, this.metadata.baseUrl);
        if (!seenUrls.has(absUrl)) {
          seenUrls.add(absUrl);
          const firstMatch = detail.firstChapterUrl.match(/\/title\/([^/]+)\/([^/?#]+)/i);
          const chSlug = firstMatch?.[2] || '';
          const num = this.parseChapterNumber(chSlug) || 1;
          chapters.push({
            id: `${this.metadata.id}:${comicSlug}:${chSlug}`,
            sourceId: this.metadata.id,
            mangaId: manga.id,
            url: absUrl,
            name: `Chapter ${num}`,
            number: num,
            scanlator: 'Comix',
          });
        }
      }

      // Sort chapters descending
      chapters.sort((a, b) => b.number - a.number);
    }

    if (chapters.length === 0) {
      const lower = rawHtml.toLowerCase();
      if (
        lower.includes('just a moment...') ||
        lower.includes('cf-turnstile') ||
        lower.includes('challenge-error-title')
      ) {
        throw new CloudFlareError(
          `[${this.metadata.name}] Cloudflare verification required for comix.to.`,
          this.metadata.id,
          url,
          this.metadata.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
    }

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const raw = chapter.url || chapter.id.replace(/^[^:]+:/, '');
    const url = this.toChapterUrl(raw);
    const $ = await this.fetchHtml(url);
    const pages: SourcePage[] = [];
    const seen = new Set<string>();

    $('img.rpage__img, .rpage-item img, .rpage__main img, #viewer img, .reader img').each((index, el) => {
      const src =
        el.attr('data-src') ||
        el.attr('data-lazy-src') ||
        el.attr('src') ||
        '';
      if (src && !src.includes('data:image') && !/logo|avatar|icon|banner|placeholder/i.test(src)) {
        const absUrl = this.toAbsoluteUrl(src);
        if (!seen.has(absUrl)) {
          seen.add(absUrl);
          pages.push({
            index: pages.length,
            url: absUrl,
            headers: this.getRequestHeaders(),
          });
        }
      }
    });

    // Check embedded JSON or script if no images found directly
    if (!pages.length) {
      const html = $.root?.innerHTML || '';
      const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:webp|jpg|jpeg|png)(?:\?[^\s"'<>]*)?/gi;
      let idx = 0;
      for (const match of html.matchAll(imgRegex)) {
        const u = match[0];
        if (/\/chapters?\/|\/pages?\/|\/upload\//i.test(u) && !seen.has(u)) {
          seen.add(u);
          pages.push({
            index: idx++,
            url: u,
            headers: this.getRequestHeaders(),
          });
        }
      }

      if (
        pages.length === 0 &&
        (html.includes('challenge-platform') ||
          html.includes('challenges.cloudflare.com') ||
          html.includes('__cf$cv$params'))
      ) {
        throw new CloudFlareError(
          `[${this.metadata.name}] Cloudflare verification required for comix.to.`,
          this.metadata.id,
          url,
          this.metadata.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
    }

    return pages;
  }

  private parseChapterLinks($: any, mangaId: string, baseUrl: string): SourceChapter[] {
    const chapters: SourceChapter[] = [];
    const seen = new Set<string>();

    $('a.mchap-row__primary, a[href*="/title/"][href*="-chapter-"]').each((_, el) => {
      const href = el.attr('href') || '';
      if (!href) return;
      const url = this.toAbsoluteUrl(href, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);

      const titleMatch = url.match(/\/title\/([^/]+)\/([^/?#]+)/i);
      const comicSlug = titleMatch?.[1] || '';
      const chapterSlug = titleMatch?.[2] || '';

      const number = this.parseChapterNumber(el.text()) || this.parseChapterNumber(chapterSlug);
      const name = this.cleanText(el.text()) || `Chapter ${number}`;

      const groupName = this.cleanText(el.parent().find('a.mchap-row__group, .group').first().text()) || 'Comix';

      chapters.push({
        id: `${this.metadata.id}:${comicSlug}:${chapterSlug}`,
        sourceId: this.metadata.id,
        mangaId,
        url,
        name,
        number,
        scanlator: groupName,
      });
    });

    return chapters;
  }

  private toTitleUrl(slugOrUrl: string): string {
    if (/^https?:\/\//i.test(slugOrUrl)) return slugOrUrl;
    const clean = slugOrUrl.replace(/^[^:]+:/, '').replace(/^\/+/, '');
    if (clean.startsWith('title/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/title/${clean}`;
  }

  private toChapterUrl(rawIdOrUrl: string): string {
    if (/^https?:\/\//i.test(rawIdOrUrl)) return rawIdOrUrl;
    const parts = rawIdOrUrl.split(':');
    if (parts.length >= 3) {
      const comicSlug = parts[parts.length - 2];
      const chSlug = parts[parts.length - 1];
      return `${this.metadata.baseUrl}/title/${comicSlug}/${chSlug}`;
    }
    const clean = rawIdOrUrl.replace(/^\/+/, '');
    if (clean.startsWith('title/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/title/${clean}`;
  }

  private titleFromSlug(slug: string): string {
    const withoutId = slug.replace(/^[a-z0-9]+-/i, '');
    return withoutId
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
