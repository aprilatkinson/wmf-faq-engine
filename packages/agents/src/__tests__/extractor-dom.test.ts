import { describe, expect, it } from 'vitest';
import { createPartialPKO } from '../extractor/pko-extractor';
import type { IntakeRow } from '../../../core/src/types/intake';
import type { CrawledPageData } from '../extractor/url-crawler';

describe('Extractor DOM product-detail mapping', () => {
  it('maps DOM productDetails label/value pairs into PKO technical fields', () => {
    const intakeRow: IntakeRow = {
      row_id: 'row-dom-1',
      product_id: 'sku-dom-1',
      url: 'https://www.wmf.com/de/de/devil-dom-example.html',
      page_type: 'PDP',
      category: 'Cookware',
      priority: 'P1',
    };

    const pageData: CrawledPageData = {
      url: intakeRow.url,
      title: 'WMF Devil Pfanne',
      metaDescription: 'Test DOM product details',
      text: 'Some full page text for claim-risk scanning only.',
      headings: ['Produktdetails'],
      listItems: [],
      productDetails: [
        { label: 'Material', value: 'Cromargan® Edelstahl' },
        { label: 'Innenbeschichtung', value: 'PTFE' },
        { label: 'Außenbeschichtung', value: 'Keramik' },
        { label: 'Spülmaschinengeeignet', value: 'Ja' },
        { label: 'Kochfeldart', value: 'Induktion, Gas' },
        { label: 'Backofenkompatibilität', value: 'bis 180°C' },
        { label: 'Gießrand', value: 'vorhanden' },
        { label: 'Grifftyp', value: 'Soft-Touch' },
        { label: 'Cool+ Technologie', value: 'integriert' },
      ],
    };

    const pko = createPartialPKO(intakeRow, pageData as unknown as any);

    expect(pko.materials).toEqual(expect.arrayContaining(['Cromargan® Edelstahl']));
    expect(pko.features).toEqual(expect.arrayContaining(['PTFE', 'Keramik', 'integriert', 'vorhanden']));
    expect(pko.compatibility).toEqual(expect.arrayContaining(['Induktion, Gas', 'bis 180°C']));
    // standalone boolean values like 'Ja' should be filtered out
    expect(pko.care_instructions).not.toEqual(expect.arrayContaining(['Ja']));

    // ensure labels themselves are not placed as raw features
    expect(pko.features).not.toEqual(expect.arrayContaining(['Material', 'Kochfeldart', 'Spülmaschinengeeignet']));
  });
});
