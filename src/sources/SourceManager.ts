/**
 * Manga Sources & Extensions Manager
 * Inspired by Kotatsu's MangaSourcesRepository.kt
 * Manages installed extensions, full 1,200+ Kotatsu catalog,
 * source enable/disable states, cross-source search, and unified URL resolution.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MangaParser,
  MangaSourceMetadata,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
  CatalogSourceItem,
} from './types';
import { MangaDexParser } from './parsers/MangaDexParser';
import { MangaBoxParser } from './parsers/MangaBoxParser';
import { ManganatoParser } from './parsers/ManganatoParser';
import { MangaDotParser } from './parsers/MangaDotParser';
import { MadaraParser } from './parsers/MadaraParser';
import { NHentaiParser } from './parsers/NHentaiParser';
import { GalleryAdultsParser } from './parsers/GalleryAdultsParser';
import { MangaReaderParser } from './parsers/MangaReaderParser';
import { HeanCmsParser } from './parsers/HeanCmsParser';
import { IkenParser } from './parsers/IkenParser';
import { HitomiLaParser } from './parsers/HitomiLaParser';
import { MangaPillParser } from './parsers/MangaPillParser';
import { ComickParser } from './parsers/ComickParser';
import { AsuraScansParser } from './parsers/AsuraScansParser';
import { ComixToParser } from './parsers/ComixToParser';
import { ReiMangaParser } from './parsers/ReiMangaParser';
import { FlameComicsParser } from './parsers/FlameComicsParser';
import { PhiliaScansParser } from './parsers/PhiliaScansParser';
import { HiveToonParser } from './parsers/HiveToonParser';
import { ToonzParser } from './parsers/ToonzParser';
import { KaganeParser } from './parsers/KaganeParser';
import { MangaFireParser } from './parsers/MangaFireParser';
import { ProjectSukiParser } from './parsers/ProjectSukiParser';
import { MangaBallParser } from './parsers/MangaBallParser';
import { AtsumaruParser } from './parsers/AtsumaruParser';
import { MangaGoParser } from './parsers/MangaGoParser';
import { WeebCentralParser } from './parsers/WeebCentralParser';
import { MangaKParser } from './parsers/MangaKParser';
import { OniSagaParser } from './parsers/OniSagaParser';
import { ToonkotsuParser } from './parsers/ToonkotsuParser';
import rawCatalog from './catalog/sourcesCatalog.json';

const STORAGE_KEY_ENABLED_SOURCES = '@mangaapp_enabled_sources_v2';
const STORAGE_KEY_DEFAULT_SOURCE = '@mangaapp_default_discover_source_v1';

export interface CatalogFilterOptions {
  query?: string;
  locale?: string;
  engine?: string;
  status?: 'all' | 'working' | 'broken';
  limit?: number;
  offset?: number;
}

export interface CatalogStats {
  total: number;
  working: number;
  broken: number;
  locales: { locale: string; count: number }[];
  engines: { engine: string; count: number }[];
}

class SourceManagerService {
  private parsers: Map<string, MangaParser> = new Map();
  private enabledSourceIds: Set<string> = new Set();
  private defaultDiscoverSourceId: string = 'mangadex';
  private catalog: CatalogSourceItem[] = (rawCatalog as CatalogSourceItem[]) || [];
  private catalogById: Map<string, CatalogSourceItem> = new Map();
  private initialized = false;

  constructor() {
    // Index catalog by ID for O(1) lookups
    for (const item of this.catalog) {
      this.catalogById.set(item.id, item);
      this.catalogById.set(item.name.toLowerCase(), item);
    }
    this.registerDefaultSources();
  }

  /**
   * Registers default Kotatsu-derived source parsers
   */
  private registerDefaultSources() {
    // 1. MangaDex
    const mangadex = new MangaDexParser();
    this.parsers.set(mangadex.metadata.id, mangadex);

    // 2. Manganato (Dedicated Parser for manganato.gg)
    const manganato = new ManganatoParser({
      id: 'manganato',
      name: 'Manganato',
      domain: 'manganato.gg',
      baseUrl: 'https://www.manganato.gg',
      locale: 'en',
      isNsfw: false,
      version: '2.0.0',
      icon: 'library-outline',
      description:
        'Massive manga catalog with fast page loads and extensive ongoing series.',
      availableSortOrders: ['latest', 'popular', 'newest'],
      enabled: true,
    });
    this.parsers.set(manganato.metadata.id, manganato);

    // 3. Mangakakalot (MangaBox Engine)
    const mangakakalot = new MangaBoxParser({
      id: 'mangakakalot',
      name: 'Mangakakalot',
      domain: 'mangakakalot.com',
      baseUrl: 'https://mangakakalot.com',
      locale: 'en',
      isNsfw: false,
      version: '1.2.0',
      icon: 'book-outline',
      description:
        'One of the oldest and largest manga repositories with thousands of completed series.',
      availableSortOrders: ['popular', 'latest', 'newest'],
      enabled: true,
    });
    this.parsers.set(mangakakalot.metadata.id, mangakakalot);

    // 4. ManhuaFast (Madara WordPress Engine)
    const manhuafast = new MadaraParser({
      id: 'manhuafast',
      name: 'ManhuaFast',
      domain: 'manhuafast.com',
      baseUrl: 'https://manhuafast.com',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'flash-outline',
      description:
        'Specializes in fast daily releases of action, cultivation, and fantasy manhua.',
      availableSortOrders: ['popular', 'latest', 'newest', 'alphabetical', 'rating'],
      enabled: true,
    });
    this.parsers.set(manhuafast.metadata.id, manhuafast);

    // 5. TopManhua (Madara WordPress Engine)
    const topmanhua = new MadaraParser({
      id: 'topmanhua',
      name: 'TopManhua',
      domain: 'topmanhua.com',
      baseUrl: 'https://topmanhua.com',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'ribbon-outline',
      description:
        'Popular manhwa and webtoon reader featuring high definition colored releases.',
      availableSortOrders: ['popular', 'latest', 'newest', 'alphabetical', 'rating'],
      enabled: true,
    });
    this.parsers.set(topmanhua.metadata.id, topmanhua);

    // 6. MangaTx (Madara WordPress Engine)
    const mangatx = new MadaraParser({
      id: 'mangatx',
      name: 'MangaTx',
      domain: 'mangatx.to',
      baseUrl: 'https://mangatx.to',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'bookmark-outline',
      description:
        'Curated collection of fantasy, romance, and leveling action series.',
      availableSortOrders: ['popular', 'latest', 'newest', 'alphabetical', 'rating'],
      enabled: true,
    });
    this.parsers.set(mangatx.metadata.id, mangatx);

    // 7. NHentai (Official v2 JSON API)
    const nhentai = new NHentaiParser({
      id: 'nhentai',
      name: 'NHentai.net',
      domain: 'nhentai.net',
      baseUrl: 'https://nhentai.net',
      locale: 'en',
      isNsfw: true,
      version: '2.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=nhentai.net&sz=64',
      description:
        'Massive adult doujinshi & manga archive with official high-res API.',
      availableSortOrders: ['popular', 'latest', 'newest'],
      enabled: true,
    });
    this.parsers.set(nhentai.metadata.id, nhentai);

    // 8. OmegaScans (HeanCMS API)
    const omegascans = new HeanCmsParser({
      id: 'omegascans',
      name: 'OmegaScans',
      domain: 'omegascans.org',
      baseUrl: 'https://omegascans.org',
      locale: 'en',
      isNsfw: true,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=omegascans.org&sz=64',
      description: 'High quality scans powered by official HeanCMS API.',
      availableSortOrders: ['popular', 'latest', 'newest', 'alphabetical'],
      enabled: true,
    });
    this.parsers.set(omegascans.metadata.id, omegascans);

    // 9. VortexScans (Iken Engine API)
    const vortexscans = new IkenParser({
      id: 'vortexscans',
      name: 'VortexScans',
      domain: 'vortexscans.org',
      baseUrl: 'https://vortexscans.org',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=vortexscans.org&sz=64',
      description: 'Action, leveling, and fantasy manhwa powered by Iken API.',
      availableSortOrders: ['popular', 'latest', 'alphabetical'],
      enabled: true,
    });
    this.parsers.set(vortexscans.metadata.id, vortexscans);

    // 10. Hitomi.La (Nozomi Index Client)
    const hitomila = new HitomiLaParser({
      id: 'hitomila',
      name: 'Hitomi.La',
      domain: 'hitomi.la',
      baseUrl: 'https://hitomi.la',
      locale: 'all',
      isNsfw: true,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=hitomi.la&sz=64',
      description: 'Massive doujinshi and manga archive using Nozomi binary index.',
      availableSortOrders: ['popular', 'latest'],
      enabled: true,
    });
    this.parsers.set(hitomila.metadata.id, hitomila);

    // 11. MangaPill (Fast Go/HTML platform)
    const mangapill = new MangaPillParser({
      id: 'mangapill',
      name: 'MangaPill',
      domain: 'mangapill.com',
      baseUrl: 'https://mangapill.com',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=mangapill.com&sz=64',
      description: 'Massive fast-loading manga library with clean chapter scans.',
      availableSortOrders: ['popular', 'latest'],
      enabled: true,
    });
    this.parsers.set(mangapill.metadata.id, mangapill);

    // 12. ComicK (Official API client)
    const comick = new ComickParser({
      id: 'comick-fun',
      name: 'ComicK',
      domain: 'comick.dev',
      baseUrl: 'https://comick.dev',
      locale: 'all',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=comick.dev&sz=64',
      description: 'Multi-lingual scanlation aggregator with official metadata.',
      availableSortOrders: ['popular', 'latest'],
      enabled: true,
    });
    this.parsers.set(comick.metadata.id, comick);

    const asura = new AsuraScansParser();
    this.parsers.set(asura.metadata.id, asura);

    const comixto = new ComixToParser();
    this.parsers.set(comixto.metadata.id, comixto);

    const reimanga = new ReiMangaParser();
    this.parsers.set(reimanga.metadata.id, reimanga);
    this.parsers.set('reimanga.net', reimanga);

    const flamecomics = new FlameComicsParser();
    this.parsers.set(flamecomics.metadata.id, flamecomics);
    this.parsers.set('flamecomics.xyz', flamecomics);

    const philiascans = new PhiliaScansParser();
    this.parsers.set(philiascans.metadata.id, philiascans);
    this.parsers.set('philiascans.org', philiascans);

    const hivetoon = new HiveToonParser();
    this.parsers.set(hivetoon.metadata.id, hivetoon);
    this.parsers.set('hivetoons.org', hivetoon);
    this.parsers.set('hivecomic', hivetoon);
    this.parsers.set('hivetoon.com', hivetoon);

    const ravenscans = new MangaReaderParser({
      id: 'ravenscans',
      name: 'RavenScans',
      domain: 'ravenscans.org',
      baseUrl: 'https://ravenscans.org',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=ravenscans.org&sz=64',
      description: 'Action, martial arts, and cultivation manhwa scanlations.',
      availableSortOrders: ['popular', 'latest', 'alphabetical', 'rating', 'newest'],
      enabled: true,
    });
    this.parsers.set(ravenscans.metadata.id, ravenscans);
    this.parsers.set('ravenscans.org', ravenscans);

    // MangaDot (Fast REST JSON API)
    const mangadot = new MangaDotParser();
    this.parsers.set(mangadot.metadata.id, mangadot);
    this.parsers.set('mangadot.net', mangadot);

    // Toonily (Madara WordPress Engine)
    const toonily = new MadaraParser({
      id: 'toonily',
      name: 'Toonily',
      domain: 'toonily.com',
      baseUrl: 'https://toonily.com',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=toonily.com&sz=64',
      description: 'Popular Korean webtoons, manhwa, and comics with fast updates.',
      availableSortOrders: ['popular', 'latest', 'newest', 'alphabetical', 'rating'],
      enabled: true,
    });
    this.parsers.set(toonily.metadata.id, toonily);
    this.parsers.set('toonily.com', toonily);

    // Toonz (toonz.to)
    const toonz = new ToonzParser();
    this.parsers.set(toonz.metadata.id, toonz);
    this.parsers.set('toonz.to', toonz);

    // Kagane (kagane.moe)
    const kagane = new KaganeParser();
    this.parsers.set(kagane.metadata.id, kagane);
    this.parsers.set('kagane.moe', kagane);

    // MangaFire (mangafire.to)
    const mangafire = new MangaFireParser();
    this.parsers.set(mangafire.metadata.id, mangafire);
    this.parsers.set('mangafire.to', mangafire);
    this.parsers.set('mangafire-en', mangafire);

    // Project Suki (projectsuki.com)
    const projectsuki = new ProjectSukiParser();
    this.parsers.set(projectsuki.metadata.id, projectsuki);
    this.parsers.set('projectsuki.com', projectsuki);

    // MangaBall (mangaball.com)
    const mangaball = new MangaBallParser();
    this.parsers.set(mangaball.metadata.id, mangaball);
    this.parsers.set('mangaball.com', mangaball);

    // Atsumaru (atsu.moe)
    const atsumaru = new AtsumaruParser();
    this.parsers.set(atsumaru.metadata.id, atsumaru);
    this.parsers.set('atsu.moe', atsumaru);

    // MangaGo (mangago.me)
    const mangago = new MangaGoParser();
    this.parsers.set(mangago.metadata.id, mangago);
    this.parsers.set('mangago.me', mangago);

    // WeebCentral (weebcentral.com)
    const weebcentral = new WeebCentralParser();
    this.parsers.set(weebcentral.metadata.id, weebcentral);
    this.parsers.set('weebcentral.com', weebcentral);

    // MangaK (mangak.io)
    const mangak = new MangaKParser();
    this.parsers.set(mangak.metadata.id, mangak);
    this.parsers.set('mangak.io', mangak);

    // OniSaga (onisaga.com)
    const onisaga = new OniSagaParser();
    this.parsers.set(onisaga.metadata.id, onisaga);
    this.parsers.set('onisaga.com', onisaga);

    // Toonkotsu (toonkotsu.com)
    const toonkotsu = new ToonkotsuParser();
    this.parsers.set(toonkotsu.metadata.id, toonkotsu);
    this.parsers.set('toonkotsu.com', toonkotsu);

    // Default enabled: Curated sources including toonz, kagane, mangafire, and newly added sources
    this.enabledSourceIds = new Set([
      'comick-fun',
      'mangadex',
      'asurascans',
      'vortexscans',
      'hitomila',
      'toonily',
      'comix-to',
      'manganato',
      'reimanga',
      'flamecomics',
      'philiascans',
      'ravenscans',
      'mangadot',
      'mangapill',
      'manhuafast',
      'nhentai',
      'omegascans',
      'hivetoon',
      'toonz',
      'kagane',
      'mangafire',
      'projectsuki',
      'mangaball',
      'atsumaru',
      'mangago',
      'weebcentral',
      'mangak',
      'onisaga',
      'toonkotsu',
    ]);
  }

  /**
   * Initializes persistent preferences and restores enabled catalog sources
   */
  public async init(): Promise<void> {
    if (this.initialized) return;
    try {
      // Restore default discover source preference
      const storedDefault = await AsyncStorage.getItem(STORAGE_KEY_DEFAULT_SOURCE);
      if (storedDefault) {
        this.defaultDiscoverSourceId = storedDefault;
      }

      const stored = await AsyncStorage.getItem(STORAGE_KEY_ENABLED_SOURCES);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        const ENABLED_MIGRATION_KEY = '@mangaapp_enabled_v5_migrated';
        const migrated = await AsyncStorage.getItem(ENABLED_MIGRATION_KEY);
        if (!migrated) {
          const newDefaults = [
            'toonz',
            'kagane',
            'mangafire',
            'projectsuki',
            'mangaball',
            'atsumaru',
            'mangago',
            'weebcentral',
            'mangak',
            'onisaga',
            'toonkotsu',
          ];
          let added = false;
          for (const nid of newDefaults) {
            if (!ids.includes(nid)) {
              ids.push(nid);
              added = true;
            }
          }
          await AsyncStorage.setItem(ENABLED_MIGRATION_KEY, 'true');
          if (added) {
            await AsyncStorage.setItem(STORAGE_KEY_ENABLED_SOURCES, JSON.stringify(ids));
          }
        }
        this.enabledSourceIds = new Set(ids);

        // Ensure default discover source is included if non-mangadex
        if (this.defaultDiscoverSourceId !== 'mangadex') {
          this.enabledSourceIds.add(this.defaultDiscoverSourceId);
        }

        // Dynamically instantiate any enabled sources from the catalog
        for (const id of Array.from(this.enabledSourceIds)) {
          if (!this.parsers.has(id)) {
            const catalogItem = this.catalogById.get(id);
            if (catalogItem) {
              const parser = this.createParserForCatalogSource(catalogItem);
              if (parser) {
                this.parsers.set(parser.metadata.id, parser);
              }
            }
          }
        }
      }
    } catch {
      // Fallback to defaults
    } finally {
      this.initialized = true;
    }
  }

  /**
   * Returns the currently configured default primary source ID for Discover page
   */
  public getDefaultDiscoverSourceId(): string {
    return this.defaultDiscoverSourceId || 'mangadex';
  }

  /**
   * Sets the default primary source for the Discover page
   */
  public async setDefaultDiscoverSourceId(sourceId: string): Promise<void> {
    const targetId = (sourceId || 'mangadex').toLowerCase();
    this.defaultDiscoverSourceId = targetId;
    await AsyncStorage.setItem(STORAGE_KEY_DEFAULT_SOURCE, targetId);

    // If external source, ensure enabled and instantiated
    if (targetId !== 'mangadex') {
      this.enabledSourceIds.add(targetId);
      if (!this.parsers.has(targetId)) {
        const catalogItem = this.catalogById.get(targetId);
        if (catalogItem) {
          const parser = this.createParserForCatalogSource(catalogItem);
          if (parser) {
            this.parsers.set(parser.metadata.id, parser);
          }
        }
      }
    }
  }

  /**
   * Returns metadata for the default discover source
   */
  public getDefaultDiscoverSource(): MangaSourceMetadata {
    const currentId = this.getDefaultDiscoverSourceId();
    if (currentId === 'mangadex') {
      return {
        id: 'mangadex',
        name: 'MangaDex',
        domain: 'mangadex.org',
        baseUrl: 'https://mangadex.org',
        locale: 'en',
        isNsfw: false,
        version: '5.0.0',
        icon: 'https://mangadex.org/favicon.ico',
        description: 'Official MangaDex API',
        availableSortOrders: ['popular', 'latest', 'rating', 'newest'],
        enabled: true,
      };
    }
    const parser = this.getParser(currentId);
    if (parser) {
      return parser.metadata;
    }
    const catalogItem = this.catalogById.get(currentId);
    if (catalogItem) {
      return {
        id: catalogItem.id,
        name: catalogItem.title,
        domain: catalogItem.domain,
        baseUrl: catalogItem.baseUrl || `https://${catalogItem.domain}`,
        locale: (catalogItem.locale as any) || 'en',
        isNsfw: catalogItem.contentType === 'hentai',
        version: '1.0.0',
        icon: catalogItem.icon,
        description: `${catalogItem.title} (${catalogItem.domain})`,
        availableSortOrders: ['popular', 'latest', 'newest'],
        enabled: true,
      };
    }
    return {
      id: 'mangadex',
      name: 'MangaDex',
      domain: 'mangadex.org',
      baseUrl: 'https://mangadex.org',
      locale: 'en',
      isNsfw: false,
      version: '5.0.0',
      description: 'Fallback MangaDex API',
      availableSortOrders: ['popular', 'latest'],
      enabled: true,
    };
  }

  /**
   * Dynamically constructs a working parser from catalog metadata
   */
  public createParserForCatalogSource(item: CatalogSourceItem): MangaParser | null {
    if (!item.domain) return null;

    const baseMetadata: MangaSourceMetadata = {
      id: item.id,
      name: item.title,
      domain: item.domain,
      baseUrl: item.baseUrl || `https://${item.domain}`,
      locale: (item.locale as any) || 'en',
      isNsfw: item.contentType === 'hentai',
      version: '1.0.0',
      icon: item.icon,
      description: `${item.title} (${item.domain}) · ${item.locale.toUpperCase()} · ${item.engine.toUpperCase()}`,
      availableSortOrders: ['popular', 'latest', 'newest', 'alphabetical', 'rating'],
      enabled: true,
    };

    // 1. NHentai Official v2 JSON API
    if (
      item.id === 'nhentai' ||
      item.domain === 'nhentai.net' ||
      item.title.toLowerCase() === 'nhentai.net'
    ) {
      return new NHentaiParser(baseMetadata);
    }

    // 2. Hitomi.La (Nozomi binary index)
    if (item.id === 'hitomila' || item.domain === 'hitomi.la') {
      return new HitomiLaParser(baseMetadata);
    }

    // 3. HeanCMS Engine (OmegaScans, ReaperScans, TempleScan, etc.)
    if (
      item.engine === 'heancms' ||
      item.domain === 'omegascans.org' ||
      item.id === 'omegascans'
    ) {
      return new HeanCmsParser(baseMetadata);
    }

    // 4. Iken Engine (VortexScans, MangaGalaxy, etc.)
    if (
      item.engine === 'iken' ||
      item.domain === 'vortexscans.org' ||
      item.id === 'vortexscans' ||
      item.id === 'mangagalaxy'
    ) {
      return new IkenParser(baseMetadata);
    }

    // 5. MangaPill (Go/HTML platform)
    if (item.id === 'mangapill' || item.domain === 'mangapill.com') {
      return new MangaPillParser(baseMetadata);
    }

    // 6. ComicK (Multi-lingual aggregator API)
    if (
      item.id === 'comick-fun' ||
      item.id === 'comick' ||
      item.domain === 'comick.dev' ||
      item.domain === 'comick.io' ||
      item.domain === 'comick.fun'
    ) {
      return new ComickParser(baseMetadata);
    }

    if (
      item.id === 'asurascans' ||
      item.domain === 'asuracomic.net' ||
      item.domain === 'asurascans.com'
    ) {
      return new AsuraScansParser(baseMetadata);
    }

    if (
      item.id === 'comix-to' ||
      item.id === 'comixto' ||
      item.domain === 'comix.to'
    ) {
      return new ComixToParser(baseMetadata);
    }

    if (
      item.id === 'reimanga' ||
      item.domain === 'reimanga.net' ||
      item.title?.toLowerCase() === 'reimanga'
    ) {
      return new ReiMangaParser(baseMetadata);
    }

    if (
      item.id === 'philiascans' ||
      item.domain === 'philiascans.org' ||
      item.title?.toLowerCase().includes('philia')
    ) {
      return new PhiliaScansParser(baseMetadata);
    }

    if (
      item.id === 'hivetoon' ||
      item.id === 'hivecomic' ||
      item.domain === 'hivetoons.org' ||
      item.domain === 'hivetoon.com' ||
      item.title?.toLowerCase().includes('hivetoon')
    ) {
      return new HiveToonParser(baseMetadata);
    }

    if (
      item.id === 'ravenscans' ||
      item.domain === 'ravenscans.org' ||
      item.domain === 'ravenscans.com' ||
      item.title?.toLowerCase().includes('ravenscans')
    ) {
      return new MangaReaderParser({
        ...baseMetadata,
        domain: 'ravenscans.org',
        baseUrl: 'https://ravenscans.org',
      });
    }

    // 5. Adult Gallery sites (Kotatsu GalleryAdults engine)
    const isGalleryDomain = [
      'nhentai',
      'hentaifox',
      'asmhentai',
      '3hentai',
      'hentaiera',
      'doujindesu',
      'hentai3',
      'hentaienvy',
      'hentairox',
      'hentaiforce',
    ].some((k) => item.id.includes(k) || item.domain.includes(k));

    if (item.engine === 'galleryadults' || isGalleryDomain) {
      return new GalleryAdultsParser(baseMetadata);
    }

    // 5b. Manganato dedicated parser
    if (item.id === 'manganato' || item.domain?.includes('manganato')) {
      return new ManganatoParser(baseMetadata);
    }

    // 5c. MangaDot dedicated parser
    if (item.id === 'mangadot' || item.domain?.includes('mangadot')) {
      return new MangaDotParser(baseMetadata);
    }

    // 5d. Toonz dedicated parser
    if (item.id === 'toonz' || item.domain?.includes('toonz.to')) {
      return new ToonzParser(baseMetadata);
    }

    // 5e. Kagane dedicated parser
    if (item.id === 'kagane' || item.domain?.includes('kagane.moe')) {
      return new KaganeParser(baseMetadata);
    }

    // 5f. MangaFire dedicated parser
    if (item.id === 'mangafire' || item.domain?.includes('mangafire.to')) {
      return new MangaFireParser(baseMetadata);
    }

    // 5g. WeebCentral dedicated parser
    if (item.id === 'weebcentral' || item.domain?.includes('weebcentral.com')) {
      return new WeebCentralParser(baseMetadata);
    }

    // 5h. MangaK dedicated parser
    if (item.id === 'mangak' || item.domain?.includes('mangak.io')) {
      return new MangaKParser(baseMetadata);
    }

    // 5i. OniSaga dedicated parser
    if (item.id === 'onisaga' || item.domain?.includes('onisaga.com')) {
      return new OniSagaParser(baseMetadata);
    }

    // 5j. Toonkotsu dedicated parser
    if (item.id === 'toonkotsu' || item.domain?.includes('toonkotsu.com')) {
      return new ToonkotsuParser(baseMetadata);
    }

    // 6. MangaBox engine (Manganato, Mangakakalot, etc.)
    if (item.engine === 'mangabox') {
      return new MangaBoxParser(baseMetadata);
    }

    // 7. MangaReader engine (260+ scanlation & reader sites)
    if (item.engine === 'mangareader') {
      return new MangaReaderParser(baseMetadata);
    }

    // 8. Madara engine (500+ WordPress sites)
    if (item.engine === 'madara') {
      return new MadaraParser(baseMetadata);
    }

    // 9. Generic heuristics for 'custom' or other engines
    if (item.contentType === 'hentai') {
      return new GalleryAdultsParser(baseMetadata);
    }

    // Default to MadaraParser with resilient URL fallback
    return new MadaraParser(baseMetadata);
  }

  /**
   * Returns list of all installed / active sources
   */
  public getSources(): MangaSourceMetadata[] {
    return Array.from(this.parsers.values()).map((p) => ({
      ...p.metadata,
      enabled: this.enabledSourceIds.has(p.metadata.id),
    }));
  }

  /**
   * Returns metadata for enabled sources
   */
  public getEnabledSources(): MangaSourceMetadata[] {
    return this.getSources().filter((s) => s.enabled);
  }

  /**
   * Retrieves parser instance by source ID (with on-demand catalog instantiation)
   */
  public getParser(sourceId: string): MangaParser | undefined {
    let parser = this.parsers.get(sourceId);
    if (!parser) {
      const catalogItem =
        this.catalogById.get(sourceId) ||
        this.catalog.find((c) => c.id === sourceId || c.domain === sourceId);
      if (catalogItem) {
        const created = this.createParserForCatalogSource(catalogItem);
        if (created) {
          this.parsers.set(created.metadata.id, created);
          return created;
        }
      }
    }
    return parser;
  }

  /**
   * Checks whether a source ID is enabled
   */
  public isSourceEnabled(sourceId: string): boolean {
    return this.enabledSourceIds.has(sourceId);
  }

  /**
   * Toggles whether an extension source is enabled
   */
  public async setSourceEnabled(sourceId: string, enabled: boolean): Promise<void> {
    if (enabled) {
      this.enabledSourceIds.add(sourceId);
      // Ensure parser is instantiated if it was from catalog
      if (!this.parsers.has(sourceId)) {
        const item = this.catalogById.get(sourceId);
        if (item) {
          const parser = this.createParserForCatalogSource(item);
          if (parser) {
            this.parsers.set(parser.metadata.id, parser);
          }
        }
      }
    } else {
      this.enabledSourceIds.delete(sourceId);
    }

    try {
      await AsyncStorage.setItem(
        STORAGE_KEY_ENABLED_SOURCES,
        JSON.stringify(Array.from(this.enabledSourceIds))
      );
    } catch {
      // Silent error on persistence
    }
  }

  /**
   * Returns the complete 1,223+ source catalog
   */
  public getCatalog(): CatalogSourceItem[] {
    return this.catalog;
  }

  /**
   * Searches and filters the 1,223+ source catalog
   */
  public searchCatalog(options: CatalogFilterOptions = {}): {
    items: CatalogSourceItem[];
    total: number;
  } {
    const { query, locale, engine, status = 'all', limit = 50, offset = 0 } = options;
    const cleanQuery = query ? query.toLowerCase().trim() : '';

    const filtered = this.catalog.filter((item) => {
      // Status filter
      if (status === 'working' && item.isBroken) return false;
      if (status === 'broken' && !item.isBroken) return false;

      // Locale filter
      if (locale && locale !== 'all') {
        if (item.locale !== locale && item.locale !== 'all') {
          return false;
        }
      }

      // Engine filter
      if (engine && engine !== 'all') {
        if (item.engine !== engine) {
          return false;
        }
      }

      // Query filter
      if (cleanQuery) {
        const matchesTitle = item.title.toLowerCase().includes(cleanQuery);
        const matchesDomain = item.domain.toLowerCase().includes(cleanQuery);
        const matchesName = item.name.toLowerCase().includes(cleanQuery);
        const matchesEngine = item.engine.toLowerCase().includes(cleanQuery);
        if (!matchesTitle && !matchesDomain && !matchesName && !matchesEngine) {
          return false;
        }
      }

      return true;
    });

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    return { items, total };
  }

  /**
   * Returns aggregated statistics about the Kotatsu catalog
   */
  public getCatalogStats(): CatalogStats {
    let working = 0;
    let broken = 0;
    const localeMap = new Map<string, number>();
    const engineMap = new Map<string, number>();

    for (const item of this.catalog) {
      if (item.isBroken) {
        broken++;
      } else {
        working++;
      }

      localeMap.set(item.locale, (localeMap.get(item.locale) || 0) + 1);
      engineMap.set(item.engine, (engineMap.get(item.engine) || 0) + 1);
    }

    const locales = Array.from(localeMap.entries())
      .map(([locale, count]) => ({ locale, count }))
      .sort((a, b) => b.count - a.count);

    const engines = Array.from(engineMap.entries())
      .map(([engine, count]) => ({ engine, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total: this.catalog.length,
      working,
      broken,
      locales,
      engines,
    };
  }

  /**
   * Search across all enabled sources concurrently
   */
  public async searchAll(
    query: string,
    filter: Omit<SourceFilter, 'query'> = {}
  ): Promise<{ source: MangaSourceMetadata; results: SourceManga[] }[]> {
    await this.init();
    const enabledParsers = Array.from(this.parsers.values()).filter((p) =>
      this.enabledSourceIds.has(p.metadata.id)
    );

    const promises = enabledParsers.map(async (parser) => {
      try {
        const results = await parser.getList({
          ...filter,
          query,
        });
        return {
          source: { ...parser.metadata, enabled: true },
          results,
        };
      } catch (err) {
        return {
          source: { ...parser.metadata, enabled: true },
          results: [],
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Ping/health test a source to verify reachability and latency
   */
  public async pingSource(
    sourceId: string
  ): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    let parser = this.parsers.get(sourceId);

    // If not in parsers, try creating it from catalog
    if (!parser) {
      const catalogItem = this.catalogById.get(sourceId);
      if (catalogItem) {
        const created = this.createParserForCatalogSource(catalogItem);
        if (created) {
          parser = created;
          this.parsers.set(parser.metadata.id, parser);
        }
      }
    }

    if (!parser) {
      return { success: false, latencyMs: 0, error: 'Source not found' };
    }

    const start = Date.now();
    try {
      const items = await parser.getList({ page: 1, order: 'popular' });
      const latencyMs = Date.now() - start;
      return {
        success: items.length > 0,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err.message || 'Timeout / Network Error',
      };
    }
  }

  /**
   * Resolves a composite ID or URL to a parser and local identifier.
   * Checks registered parsers first, then searches the entire 1,223 catalog by domain.
   */
  public resolveSource(idOrUrl: string): { parser: MangaParser; rawId: string } | null {
    if (!idOrUrl) return null;

    // Format 1: Prefix format "sourceId:..."
    const colonIndex = idOrUrl.indexOf(':');
    if (colonIndex > 0) {
      const potentialSourceId = idOrUrl.substring(0, colonIndex);
      const parser = this.parsers.get(potentialSourceId);
      if (parser) {
        let rawId = idOrUrl.substring(colonIndex + 1);
        while (rawId.startsWith(`${potentialSourceId}:`)) {
          rawId = rawId.substring(potentialSourceId.length + 1);
        }
        return {
          parser,
          rawId,
        };
      }

      // Check if potentialSourceId is in the 1,223 catalog
      const catalogItem = this.catalogById.get(potentialSourceId);
      if (catalogItem) {
        const created = this.createParserForCatalogSource(catalogItem);
        if (created) {
          this.parsers.set(created.metadata.id, created);
          let rawId = idOrUrl.substring(colonIndex + 1);
          while (rawId.startsWith(`${potentialSourceId}:`)) {
            rawId = rawId.substring(potentialSourceId.length + 1);
          }
          return {
            parser: created,
            rawId,
          };
        }
      }
    }

    // Format 2: Domain matching against registered parsers
    for (const parser of this.parsers.values()) {
      if (idOrUrl.includes(parser.metadata.domain)) {
        return {
          parser,
          rawId: idOrUrl,
        };
      }
    }

    // Format 3: Domain matching against all 1,223 catalog sources!
    for (const item of this.catalog) {
      if (item.domain && idOrUrl.includes(item.domain)) {
        const created = this.createParserForCatalogSource(item);
        if (created) {
          this.parsers.set(created.metadata.id, created);
          return {
            parser: created,
            rawId: idOrUrl,
          };
        }
      }
    }

    // Default fallback: MangaDex
    const mangadex = this.parsers.get('mangadex');
    if (mangadex) {
      return {
        parser: mangadex,
        rawId: idOrUrl,
      };
    }

    return null;
  }
}

export const SourceManager = new SourceManagerService();
