import { chromium } from 'playwright';

/**
 * Section 2.3 URL Crawler & Extractor Agent.
 * Crawl one validated intake row URL and return observable page text for PKO extraction.
 */
export interface CrawledPageData {
  url: string;
  title: string;
  metaDescription?: string;
  text: string;
  headings: string[];
  listItems: string[];
}

export async function crawlUrl(url: string): Promise<CrawledPageData> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const pageData = await page.evaluate(() => {
      const title = document.title || '';
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? undefined;
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((element) => element.textContent?.trim() ?? '').filter(Boolean);
      const listItems = Array.from(document.querySelectorAll('li')).map((element) => element.textContent?.trim() ?? '').filter(Boolean);
      const text = document.body?.innerText ?? '';
      return { title, metaDescription, headings, listItems, text };
    });

    return {
      url,
      title: pageData.title,
      metaDescription: pageData.metaDescription,
      text: pageData.text,
      headings: pageData.headings,
      listItems: pageData.listItems,
    };
  } finally {
    await page.close();
    await browser.close();
  }
}
