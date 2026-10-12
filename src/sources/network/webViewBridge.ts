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

class WebViewBridgeService {
  private verifiedDomains: Set<string> = new Set();
  private pendingRequests: Map<string, BridgeRequest> = new Map();
  private sendScriptToWebView: ((script: string) => void) | null = null;
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

  public registerSender(sender: (script: string) => void): void {
    this.sendScriptToWebView = sender;
  }

  public unregisterSender(): void {
    this.sendScriptToWebView = null;
  }

  public hasSender(): boolean {
    return this.sendScriptToWebView !== null;
  }

  /**
   * Dispatches a same-origin fetch inside the active WebView session.
   * Native browser cookies (including HttpOnly cf_clearance) are automatically attached.
   */
  public async fetchJson<T = any>(url: string, timeoutMs = 15000): Promise<T> {
    if (!this.sendScriptToWebView) {
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

      this.sendScriptToWebView(script);
    });
  }

  /**
   * Dispatches a text/html fetch inside the active WebView session.
   */
  public async fetchText(url: string, timeoutMs = 15000): Promise<string> {
    if (!this.sendScriptToWebView) {
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
            .then(function(text) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BRIDGE_RESPONSE',
                id: ${JSON.stringify(id)},
                success: true,
                data: text
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

      this.sendScriptToWebView(script);
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
