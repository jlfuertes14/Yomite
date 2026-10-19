/**
 * Catalog Store — Lets the Discover search sheet open the source catalog
 * directly, without navigating to the Extensions tab.
 *
 * The Extensions screen (kept mounted via `lazy: false`) hosts the catalog as
 * a native dialog, so a request from the store makes it slide in on top of the
 * search results and slide away again to reveal them — no intermediate
 * Discover/Extensions renders.
 */
import { create } from 'zustand';

export interface CatalogOpenRequest {
  sourceId: string;
  name: string;
  domain?: string;
  query: string;
  requestId: string;
}

interface CatalogState {
  request: CatalogOpenRequest | null;
  /** True while the Extensions screen (the catalog's host) is mounted. */
  hostMounted: boolean;
  setHostMounted: (mounted: boolean) => void;
  openCatalog: (request: Omit<CatalogOpenRequest, 'requestId'>) => void;
  clearCatalog: () => void;
}

let requestCounter = 0;

export const useCatalogStore = create<CatalogState>((set) => ({
  request: null,
  hostMounted: false,
  setHostMounted: (mounted: boolean) => set({ hostMounted: mounted }),
  openCatalog: (request) =>
    set({ request: { ...request, requestId: `${Date.now()}-${++requestCounter}` } }),
  clearCatalog: () => set({ request: null }),
}));
