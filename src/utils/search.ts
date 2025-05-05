// File: src/utils/search.ts
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

export async function webSearch(query: string): Promise<{ title: string, url: string, snippet: string }[]> {
  const encoded = encodeURIComponent(query);
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`);
  const html = await res.text();

  const dom = new JSDOM(html);
  const document = dom.window.document;
  const results: { title: string, url: string, snippet: string }[] = [];

  document.querySelectorAll('.result__body').forEach(result => {
    const anchor = result.querySelector('a.result__a') as HTMLAnchorElement;
    const snippet = result.querySelector('.result__snippet')?.textContent || '';
    if (anchor) {
      results.push({
        title: anchor.textContent || '',
        url: anchor.href,
        snippet: snippet.trim(),
      });
    }
  });

  return results.slice(0, 5);
}

