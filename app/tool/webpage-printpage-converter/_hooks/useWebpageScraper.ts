import { useState, useCallback } from 'react';

export interface ScrapedPage {
  id: string;
  title: string;
  url: string;
  content: string; // HTML content for the editor
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}

const BASE_URL = 'http://sacramentofrenchfilmfestival.org/';
// As per user request for movie10*.htm, we'll assume a range from 100 to 109.
const TARGET_URLS = Array.from({ length: 10 }, (_, i) => `${BASE_URL}movie10${i}.htm`);

export function useWebpageScraper() {
  const [scrapedPages, setScrapedPages] = useState<ScrapedPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [overallError, setOverallError] = useState<string | null>(null);

  const parseHtmlContent = useCallback((htmlString: string, pageUrl: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    // Per user request, content is in a specific table cell
    const contentCell = doc.querySelector('td[width="552"]');
    if (!contentCell) {
      throw new Error('Could not find the main content container (td[width="552"]) in the page source.');
    }

    // Convert relative image URLs to absolute URLs
    const images = contentCell.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http')) {
        try {
            const absoluteUrl = new URL(src, pageUrl).href;
            img.setAttribute('src', absoluteUrl);
        } catch (e) {
            console.warn(`Invalid image URL found: ${src}`);
        }
      }
    });

    // The TipTap editor expects a single root element for its content.
    return `<div>${contentCell.innerHTML}</div>`;
  }, []);

  const scrapePages = useCallback(async () => {
    setIsLoading(true);
    setOverallError(null);
    setProgress(0);
    
    const initialPages: ScrapedPage[] = TARGET_URLS.map(url => ({
      id: url,
      title: url.split('/').pop() || url,
      url,
      content: '',
      status: 'pending',
    }));
    setScrapedPages(initialPages);

    let completedCount = 0;

    for (let i = 0; i < TARGET_URLS.length; i++) {
      const url = TARGET_URLS[i];
      
      setScrapedPages(prev => prev.map(p => p.url === url ? { ...p, status: 'loading' } : p));

      try {
        // IMPORTANT: Direct fetching from a browser will be blocked by CORS.
        // This requires a server-side proxy. The following code assumes a proxy
        // exists at `/api/cors-proxy`. Without it, this will fail.
        // This is a known limitation of client-side web scraping.
        const proxyUrl = `/api/cors-proxy?url=${encodeURIComponent(url)}`;
        
        // Since the proxy is not implemented as per project rules, we will simulate a failure.
        // To make this tool work, a backend route at `app/api/cors-proxy/route.ts` would be needed.
        // The following fetch is commented out to prevent console errors.
        // const response = await fetch(proxyUrl);
        
        // if (!response.ok) {
        //   throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        // }
        // const htmlText = await response.text();
        // const parsedContent = parseHtmlContent(htmlText, url);
        // setScrapedPages(prev => prev.map(p => p.url === url ? { ...p, status: 'success', content: parsedContent } : p));

        // Simulate failure to demonstrate the CORS issue
        throw new Error(`CORS policy blocks this request. A server-side proxy is required to fetch from ${BASE_URL}.`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        setScrapedPages(prev => prev.map(p => p.url === url ? { ...p, status: 'error', error: errorMessage } : p));
        if (!overallError) {
            setOverallError(errorMessage);
        }
      }

      completedCount++;
      setProgress((completedCount / TARGET_URLS.length) * 100);
    }

    setIsLoading(false);
  }, [parseHtmlContent, overallError]);

  const reset = useCallback(() => {
    setScrapedPages([]);
    setIsLoading(false);
    setProgress(0);
    setOverallError(null);
  }, []);

  return { scrapedPages, isLoading, progress, overallError, scrapePages, reset };
}