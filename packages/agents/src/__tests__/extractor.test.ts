import { describe, expect, it } from 'vitest';
import { createPartialPKO } from '../extractor/pko-extractor';
import { detectClaimRisk } from '../extractor/claim-risk';
import type { IntakeRow } from '../../../core/src/types/intake';
import type { CrawledPageData } from '../extractor/url-crawler';

describe('URL extractor scaffold', () => {
  it('flags WMF claim-risk vocabulary in page text', () => {
    const text = 'This cookware is dishwasher-safe and corrosion-resistant for a durable construction.';
    const claims = detectClaimRisk(text, 'https://example.com/test');

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claim_text: 'dishwasher-safe', risk_type: 'dishwasher-safe' }),
        expect.objectContaining({ claim_text: 'corrosion-resistant', risk_type: 'corrosion-resistant' }),
      ]),
    );
  });

  it('creates a valid partial PKO with empty arrays when page fields are absent', () => {
    const intakeRow: IntakeRow = {
      row_id: 'row-123',
      product_id: 'sku-abc',
      url: 'https://example.com/brand/product',
      page_type: 'PDP',
      category: 'Cookware',
      product_family: 'Coated Pans',
      priority: 'P1',
    };

    const pageData: CrawledPageData = {
      url: intakeRow.url,
      title: 'Test Product',
      metaDescription: 'A sample product page',
      text: 'Test product page content.',
      headings: [],
      listItems: [],
    };

    const pko = createPartialPKO(intakeRow, pageData);

    expect(pko.source_url).toBe(intakeRow.url);
    expect(pko.product_name).toBe('Test Product');
    expect(pko.category).toBe('Cookware');
    expect(pko.product_family).toBe('Coated Pans');
    expect(pko.features).toEqual([]);
    expect(pko.fmo_mappings).toEqual([]);
    expect(pko.claims_flagged).toEqual([]);
    expect(pko.page_weaknesses).toEqual([]);
    expect(pko.knowledgebase_chunks_used).toEqual([]);
    expect(pko.pko_version).toBe('1.0.0');
    expect(typeof pko.created_at).toBe('string');
  });
});
