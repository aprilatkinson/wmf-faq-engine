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
  // productDetails: extracted label/value pairs from product detail sections (per Section 2.3)
  productDetails: Array<{ label: string; value: string }>;
}

export async function crawlUrl(url: string): Promise<CrawledPageData> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const pageData = await page.evaluate(() => {
      const title = document.title || '';
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? undefined;

      // Prefer content inside <main> where available to avoid nav/footer noise (Section 2.3 requirement)
      const main = document.querySelector('main') ?? document.body;

      const headings = Array.from((main as Element).querySelectorAll('h1, h2, h3')).map((el) => el.textContent?.trim() ?? '').filter(Boolean);
      const listItems = Array.from((main as Element).querySelectorAll('li')).map((el) => el.textContent?.trim() ?? '').filter(Boolean);

      // Full page body text preserved for claim-risk scanning only (Section 3.6)
      const text = document.body?.innerText ?? '';

      // Extract product-detail label/value pairs from common patterns: tables, dl, and label:value list items
      const productDetails: Array<{ label: string; value: string }> = [];

      // Tables: tr with two cells (label/value)
      const tables = Array.from((main as Element).querySelectorAll('table'));
      for (const table of tables) {
        for (const tr of Array.from(table.querySelectorAll('tr'))) {
          const cells = Array.from(tr.querySelectorAll('th, td')) as HTMLElement[];
          if (cells.length >= 2) {
            const label = (cells[0].textContent || '').trim();
            const value = (cells[1].textContent || '').trim();
            if (label && value) productDetails.push({ label, value });
          }
        }
      }

      // Definition lists: dt / dd
      for (const dl of Array.from((main as Element).querySelectorAll('dl'))) {
        const dts = Array.from(dl.querySelectorAll('dt'));
        for (const dt of dts) {
          const dd = dt.nextElementSibling as HTMLElement | null;
          if (dd && dd.tagName.toLowerCase() === 'dd') {
            const label = (dt.textContent || '').trim();
            const value = (dd.textContent || '').trim();
            if (label && value) productDetails.push({ label, value });
          }
        }
      }

      // Fallback: li items that look like "Label: Value"
      for (const li of Array.from((main as Element).querySelectorAll('li'))) {
        const text = (li.textContent || '').trim();
        const m = text.match(/^\s*([^:]+)[:\-]\s*(.+)$/);
        if (m) {
          const label = m[1].trim();
          const value = m[2].trim();
          if (label && value) productDetails.push({ label, value });
        }
      }

      return { title, metaDescription, headings, listItems, text, productDetails };
    });

    return {
      url,
      title: pageData.title,
      metaDescription: pageData.metaDescription,
      text: pageData.text,
      headings: pageData.headings,
      listItems: pageData.listItems,
      productDetails: pageData.productDetails ?? [],
    };
  } finally {
    await page.close();
    await browser.close();
  }
}
