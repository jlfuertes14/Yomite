/**
 * React Native Safe HTML Parser & Query Engine
 * Replaces Cheerio with pure JavaScript node-html-parser to eliminate
 * Node standard library dependencies (node:stream) in Hermes / React Native.
 */
import { parse, HTMLElement, Node } from 'node-html-parser';

export class HtmlElementWrapper {
  public readonly raw: HTMLElement | null;

  constructor(element: HTMLElement | null | undefined) {
    this.raw = element || null;
  }

  public exists(): boolean {
    return this.raw !== null;
  }

  public find(selector: string): HtmlElementList {
    if (!this.raw) return new HtmlElementList([]);
    const nodes = this.raw.querySelectorAll(selector);
    return new HtmlElementList(nodes);
  }

  public first(): HtmlElementWrapper {
    return this;
  }

  public attr(attributeName: string): string | undefined {
    if (!this.raw) return undefined;
    const val = this.raw.getAttribute(attributeName);
    return val !== null && val !== undefined ? val : undefined;
  }

  public text(): string {
    if (!this.raw) return '';
    return this.raw.text || '';
  }

  public html(): string {
    if (!this.raw) return '';
    return this.raw.innerHTML || '';
  }

  public parent(): HtmlElementWrapper {
    return new HtmlElementWrapper((this.raw?.parentNode as HTMLElement) || null);
  }
}

export class HtmlElementList {
  private readonly items: HtmlElementWrapper[];

  constructor(elements: (HTMLElement | HtmlElementWrapper)[]) {
    this.items = elements.map((el) =>
      el instanceof HtmlElementWrapper ? el : new HtmlElementWrapper(el)
    );
  }

  public get length(): number {
    return this.items.length;
  }

  public first(): HtmlElementWrapper {
    return this.items.length > 0 ? this.items[0] : new HtmlElementWrapper(null);
  }

  public get(index: number): HtmlElementWrapper {
    return this.items[index] || new HtmlElementWrapper(null);
  }

  public each(callback: (index: number, element: HtmlElementWrapper) => void): this {
    this.items.forEach((item, index) => {
      callback(index, item);
    });
    return this;
  }

  public map<T>(callback: (index: number, element: HtmlElementWrapper) => T): T[] {
    return this.items.map((item, index) => callback(index, item));
  }

  public find(selector: string): HtmlElementList {
    const matched: HTMLElement[] = [];
    for (const item of this.items) {
      if (item.raw) {
        const sub = item.raw.querySelectorAll(selector);
        matched.push(...sub);
      }
    }
    return new HtmlElementList(matched);
  }

  public attr(attributeName: string): string | undefined {
    return this.first().attr(attributeName);
  }

  public text(): string {
    return this.items.map((it) => it.text()).join(' ').trim();
  }

  public toArray(): HtmlElementWrapper[] {
    return [...this.items];
  }
}

export interface HtmlQueryFunction {
  (selectorOrElement: string | HtmlElementWrapper | HTMLElement | null | undefined): HtmlElementList;
  root: HTMLElement;
}

export function loadHtml(html: string): HtmlQueryFunction {
  const root = parse(html, {
    lowerCaseTagName: false,
    comment: false,
    blockTextElements: {
      script: true,
      noscript: true,
      style: true,
      pre: true,
    },
  });

  const queryFn = ((
    selectorOrElement: string | HtmlElementWrapper | HTMLElement | null | undefined
  ): HtmlElementList => {
    if (!selectorOrElement) {
      return new HtmlElementList([]);
    }

    if (typeof selectorOrElement === 'string') {
      // Handle jQuery-style pseudo :contains('text')
      if (selectorOrElement.includes(':contains(')) {
        const match = selectorOrElement.match(/^(.*?):contains\(["']?(.*?)["']?\)(.*)$/);
        if (match) {
          const baseSelector = match[1] || '*';
          const targetText = match[2].toLowerCase();
          const baseItems = root.querySelectorAll(baseSelector);
          const filtered = baseItems.filter((el) =>
            (el.text || '').toLowerCase().includes(targetText)
          );
          return new HtmlElementList(filtered);
        }
      }

      const elements = root.querySelectorAll(selectorOrElement);
      return new HtmlElementList(elements);
    }

    if (selectorOrElement instanceof HtmlElementWrapper) {
      return new HtmlElementList(selectorOrElement.raw ? [selectorOrElement.raw] : []);
    }

    return new HtmlElementList([selectorOrElement as HTMLElement]);
  }) as HtmlQueryFunction;

  queryFn.root = root;
  return queryFn;
}

export type ParsedHtml = HtmlQueryFunction;
