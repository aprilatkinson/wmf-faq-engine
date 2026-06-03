import { describe, expect, it } from 'vitest';
import { createPartialPKO } from '../extractor/pko-extractor';
import type { IntakeRow } from '../../../core/src/types/intake';
import type { CrawledPageData } from '../extractor/url-crawler';

describe('Extractor sanitization step', () => {
  it('removes label-only and nav/footer noise from extracted arrays', () => {
    const intakeRow: IntakeRow = {
      row_id: 'row-sanitize-1',
      product_id: 'sku-sanitize-1',
      url: 'https://www.wmf.com/de/de/test-sanitize.html',
      page_type: 'PDP',
      category: 'Cookware',
      priority: 'P2',
    };

    const pageData: CrawledPageData = {
      url: intakeRow.url,
      title: 'Test product',
      metaDescription: '',
      text: 'Some text',
      headings: ['Startseite', '/de/de/breadcrumb', 'Produktdetails'],
      listItems: ['Material: Edelstahl', 'Spülmaschinengeeignet', 'Ja', 'Impressum', 'Soft-Touch', 'Maße', 'Paketmaße'],
      productDetails: [
        { label: 'Material', value: 'Cromargan® Edelstahl rostfrei' },
        { label: 'Kochfeldart', value: 'Induktion - Gas - Glaskeramik - Halogen' },
        { label: 'Spülmaschinengeeignet', value: 'Ja, aber Spülen per Hand empfohlen' },
      ],
    };

    const pko = createPartialPKO(intakeRow, pageData as unknown as any);

    // label-only and nav items removed, including common label-only strings
    expect(pko.features).not.toEqual(expect.arrayContaining(['Startseite', '/de/de/breadcrumb', 'Material', 'Spülmaschinengeeignet', 'Ja', 'Impressum', 'Maße', 'Paketmaße']));

    // product values preserved
    expect(pko.materials).toEqual(expect.arrayContaining(['Cromargan® Edelstahl rostfrei']));
    expect(pko.compatibility).toEqual(expect.arrayContaining(['Induktion - Gas - Glaskeramik - Halogen']));
    expect(pko.care_instructions).toEqual(expect.arrayContaining(['Ja, aber Spülen per Hand empfohlen']));
  });
});
