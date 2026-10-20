/**
 * WebView Request Bridge
 * Allows React Native source parsers to execute authenticated same-origin
 * network requests inside an active WebView session that has already passed
 * Cloudflare Turnstile / anti-bot verification.
 * 
 * Once a user solves Cloudflare verification once in the app session,
 * all subsequent queries (search, genres, sorting, pagination, chapter lists)
 * are routed through this bridge, completely eliminating repeated verification prompts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

type BridgeRequest = {
  id: string;
  url: string;
  resolve: (data: any) => void;
  reject: (err: any) => void;
  timeout: NodeJS.Timeout;
};

const STORAGE_KEY_VERIFIED_DOMAINS = '@mangaapp_verified_domains_v1';

/**
 * Global in-memory image cache for Base64 data URIs resolved via the WebView bridge.
 * Shared across the entire app lifecycle (Manga cards, details title page, history, reader).
 */
export const imageBridgeCache = new Map<string, string>();

/**
 * Checks whether an image URL originates from a Cloudflare-protected source (e.g. MangaDot).
 */
export function isCloudflareProtectedUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('mangadot.net') ||
    lower.includes('/chapters/manga_') ||
    lower.includes('/media/manga_covers/') ||
    lower.includes('chapmanganato') ||
    lower.includes('manganato.gg') ||
    lower.includes('comix.to') ||
    lower.includes('onisaga.com') ||
    lower.includes('toonkotsu.com') ||
    lower.includes('mangak.io') ||
    lower.includes('weebcentral.com')
  );
}


class WebViewBridgeService {
  private verifiedDomains: Set<string> = new Set();
  private pendingRequests: Map<string, BridgeRequest> = new Map();
  private activeSender: ((script: string) => void) | null = null;
  private globalSender: ((script: string) => void) | null = null;
  private domainSenders: Map<string, (script: string) => void> = new Map();
  private cfSolvedListeners: Set<(domain: string) => void> = new Set();
  private inFlightImages: Map<string, Promise<string>> = new Map();
  private imageQueue: Array<() => void> = [];
  private activeImageCount = 0;
  private readonly MAX_CONCURRENT_IMAGES = 4;
  private initialized = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_VERIFIED_DOMAINS);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          for (const d of parsed) {
            this.verifiedDomains.add(this.normalizeDomain(d));
          }
        }
      }
    } catch {
      // Fallback to in-memory set
    } finally {
      this.initialized = true;
    }
  }

  private async persist(): Promise<void> {
    try {
      const list = Array.from(this.verifiedDomains);
      await AsyncStorage.setItem(STORAGE_KEY_VERIFIED_DOMAINS, JSON.stringify(list));
    } catch {
      // Ignore persistence failure
    }
  }

  public normalizeDomain(domainOrUrl: string): string {
    let clean = (domainOrUrl || '').toLowerCase().trim();
    clean = clean.replace(/^https?:\/\//, '');
    clean = clean.replace(/\/.*$/, '');
    clean = clean.replace(/:\d+$/, '');
    clean = clean.replace(/^www\./, '');
    return clean;
  }

  public isDomainVerified(domainOrUrl: string): boolean {
    const domain = this.normalizeDomain(domainOrUrl);
    return this.verifiedDomains.has(domain);
  }

  public setDomainVerified(domainOrUrl: string, verified = true): void {
    const domain = this.normalizeDomain(domainOrUrl);
    if (!domain) return;
    if (verified) {
      this.verifiedDomains.add(domain);
    } else {
      this.verifiedDomains.delete(domain);
    }
    this.persist().catch(() => {});
  }

  public getVerifiedDomains(): string[] {
    return Array.from(this.verifiedDomains);
  }

  public clearVerifiedDomains(): void {
    this.verifiedDomains.clear();
    this.persist().catch(() => {});
  }

  /**
   * Registers a persistent global background WebView sender (e.g. from app/_layout.tsx).
   * Used as the default fallback for all screens (MangaCard, Details, History).
   */
  public registerGlobalSender(sender: (script: string) => void): void {
    this.globalSender = sender;
  }

  /**
   * Registers a screen-specific active sender (e.g. active Reader or visible Cloudflare modal).
   */
  public registerSender(sender: (script: string) => void): void {
    this.activeSender = sender;
  }

  /**
   * Unregisters the screen-specific active sender, cleanly restoring the global sender.
   */
  public unregisterSender(): void {
    this.activeSender = null;
  }

  public hasSender(): boolean {
    return this.activeSender !== null || this.globalSender !== null;
  }

  public hasSenderForUrl(url: string): boolean {
    const domain = this.normalizeDomain(url);
    return this.domainSenders.has(domain) || this.hasSender();
  }

  public registerDomainSender(domainOrUrl: string, sender: (script: string) => void): void {
    const domain = this.normalizeDomain(domainOrUrl);
    if (!domain) return;
    this.domainSenders.set(domain, sender);
  }

  public unregisterDomainSender(domainOrUrl: string): void {
    this.domainSenders.delete(this.normalizeDomain(domainOrUrl));
  }

  private get sender(): ((script: string) => void) | null {
    return this.activeSender || this.globalSender;
  }

  private senderForUrl(url: string): ((script: string) => void) | null {
    return this.domainSenders.get(this.normalizeDomain(url)) || this.sender;
  }

  /**
   * Waits up to timeoutMs for either an active or global sender to be registered.
   */
  public waitForSender(timeoutMs = 5000): Promise<boolean> {
    if (this.hasSender()) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (this.hasSender()) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - start >= timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * Registers a listener triggered whenever a Cloudflare challenge is solved.
   */
  public onCloudflareSolved(listener: (domain: string) => void): () => void {
    this.cfSolvedListeners.add(listener);
    return () => {
      this.cfSolvedListeners.delete(listener);
    };
  }

  public notifyCloudflareSolved(domain: string): void {
    this.setDomainVerified(domain, true);
    for (const listener of this.cfSolvedListeners) {
      try {
        listener(domain);
      } catch {}
    }
  }

  /**
   * Dispatches a same-origin fetch inside the active WebView session.
   * Native browser cookies (including HttpOnly cf_clearance) are automatically attached.
   */
  public async fetchJson<T = any>(url: string, timeoutMs = 15000): Promise<T> {
    if (!this.hasSenderForUrl(url)) {
      const ready = await this.waitForSender(4000);
      if (!ready) {
        throw new Error('WebView bridge is not currently mounted or connected.');
      }
    }

    const currentSender = this.senderForUrl(url);
    if (!currentSender) {
      throw new Error('WebView bridge is not currently mounted or connected.');
    }

    const id = `bridge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`WebView bridge request timed out after ${timeoutMs}ms for ${url}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { id, url, resolve, reject, timeout });

      const script = `
        (function() {
          try {
            fetch(${JSON.stringify(url)}, {
              headers: {
                'Accept': 'application/json, text/plain, */*'
              },
              credentials: 'include'
            })
            .then(function(res) {
              if (!res.ok) {
                return res.text().then(function(t) {
                  throw new Error('HTTP ' + res.status + ': ' + (t.slice(0, 100) || res.statusText));
                });
              }
              return res.json();
            })
            .then(function(json) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BRIDGE_RESPONSE',
                id: ${JSON.stringify(id)},
                success: true,
                data: json
              }));
            })
            .catch(function(err) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BRIDGE_RESPONSE',
                id: ${JSON.stringify(id)},
                success: false,
                error: err.message
              }));
            });
          } catch (e) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'BRIDGE_RESPONSE',
              id: ${JSON.stringify(id)},
              success: false,
              error: e.message
            }));
          }
        })();
        true;
      `;

      currentSender(script);
    });
  }

  /**
   * Dispatches a text/html fetch inside the active WebView session.
   */
  public async fetchText(url: string, timeoutMs = 15000): Promise<string> {
    if (!this.hasSenderForUrl(url)) {
      const ready = await this.waitForSender(4000);
      if (!ready) {
        throw new Error('WebView bridge is not currently mounted or connected.');
      }
    }

    const currentSender = this.senderForUrl(url);
    if (!currentSender) {
      throw new Error('WebView bridge is not currently mounted or connected.');
    }

    const id = `bridge_txt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`WebView bridge request timed out after ${timeoutMs}ms for ${url}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { id, url, resolve, reject, timeout });

      const script = `
        (function() {
          try {
            fetch(${JSON.stringify(url)}, {
              headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              },
              credentials: 'include'
            })
            .then(function(res) {
              if (!res.ok) {
                return res.text().then(function(t) {
                  throw new Error('HTTP ' + res.status + ': ' + (t.slice(0, 100) || res.statusText));
                });
              }
              return res.text();
            })
            .then(function(html) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BRIDGE_RESPONSE',
                id: ${JSON.stringify(id)},
                success: true,
                data: html
              }));
            })
            .catch(function(err) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BRIDGE_RESPONSE',
                id: ${JSON.stringify(id)},
                success: false,
                error: err.message
              }));
            });
          } catch (e) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'BRIDGE_RESPONSE',
              id: ${JSON.stringify(id)},
              success: false,
              error: e.message
            }));
          }
        })();
        true;
      `;

      currentSender(script);
    });
  }

  /**
   * Fetches an image inside the active WebView session and returns a base64 data URL.
   * Manages deduplication and limits concurrent requests to prevent UI/network saturation.
   */
  public async fetchImageBase64(rawUrl: string, timeoutMs = 25000): Promise<string> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('Invalid image URL provided to fetchImageBase64');
    }

    let url = rawUrl.trim();
    if (url.startsWith('//')) {
      url = `https:${url}`;
    } else if (url.startsWith('/')) {
      url = `https://mangadot.net${url}`;
    }

    // 1. Check in-memory cache
    const cached = imageBridgeCache.get(url);
    if (cached) {
      return cached;
    }

    // 2. Check in-flight requests (deduplication)
    const inFlight = this.inFlightImages.get(url);
    if (inFlight) {
      return inFlight;
    }

    // 3. Queue request through concurrency throttler
    const promise = new Promise<string>((resolve, reject) => {
      const execute = async () => {
        try {
          const result = await this.executeFetchImageBase64(url, timeoutMs);
          imageBridgeCache.set(url, result);
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeImageCount = Math.max(0, this.activeImageCount - 1);
          this.inFlightImages.delete(url);
          this.processImageQueue();
        }
      };

      if (this.activeImageCount < this.MAX_CONCURRENT_IMAGES) {
        this.activeImageCount++;
        execute();
      } else {
        this.imageQueue.push(execute);
      }
    });

    this.inFlightImages.set(url, promise);
    return promise;
  }

  private processImageQueue(): void {
    while (this.imageQueue.length > 0 && this.activeImageCount < this.MAX_CONCURRENT_IMAGES) {
      const next = this.imageQueue.shift();
      if (next) {
        this.activeImageCount++;
        next();
      }
    }
  }

  private async executeFetchImageBase64(url: string, timeoutMs: number): Promise<string> {
    if (!this.hasSenderForUrl(url)) {
      const ready = await this.waitForSender(5000);
      if (!ready) {
        throw new Error('WebView bridge is not currently mounted or connected.');
      }
    }

    const currentSender = this.senderForUrl(url);
    if (!currentSender) {
      throw new Error('WebView bridge is not currently mounted or connected.');
    }

    const id = `bridge_img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`WebView bridge image request timed out after ${timeoutMs}ms for ${url}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { id, url, resolve, reject, timeout });

      const script = `
        (function() {
          try {
            fetch(${JSON.stringify(url)}, {
              credentials: 'include'
            })
            .then(function(res) {
              if (!res.ok) {
                throw new Error('HTTP ' + res.status + ': ' + res.statusText);
              }
              return res.blob();
            })
            .then(function(blob) {
              var reader = new FileReader();
              reader.onloadend = function() {
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'BRIDGE_RESPONSE',
                  id: ${JSON.stringify(id)},
                  success: true,
                  data: reader.result
                }));
              };
              reader.onerror = function() {
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'BRIDGE_RESPONSE',
                  id: ${JSON.stringify(id)},
                  success: false,
                  error: 'FileReader failed to convert image blob to data URL'
                }));
              };
              reader.readAsDataURL(blob);
            })
            .catch(function(err) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BRIDGE_RESPONSE',
                id: ${JSON.stringify(id)},
                success: false,
                error: err.message
              }));
            });
          } catch (e) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'BRIDGE_RESPONSE',
              id: ${JSON.stringify(id)},
              success: false,
              error: e.message
            }));
          }
        })();
        true;
      `;

      currentSender(script);
    });
  }

  /**
   * Processes incoming messages from the WebView to check if they belong to a bridge request.
   * Returns true if the message was handled by the bridge.
   */
  public handleMessage(message: any): boolean {
    if (message?.type === 'BRIDGE_RESPONSE' && typeof message?.id === 'string') {
      const req = this.pendingRequests.get(message.id);
      if (req) {
        clearTimeout(req.timeout);
        this.pendingRequests.delete(message.id);
        if (message.success) {
          req.resolve(message.data);
        } else {
          req.reject(new Error(message.error || 'WebView bridge request failed.'));
        }
        return true;
      }
    }
    return false;
  }
}

export const webViewBridge = new WebViewBridgeService();
