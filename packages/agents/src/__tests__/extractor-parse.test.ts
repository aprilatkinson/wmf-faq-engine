import { describe, expect, it } from 'vitest';
import { createPartialPKO } from '../extractor/pko-extractor';
import type { IntakeRow } from '../../../core/src/types/intake';
import type { CrawledPageData } from '../extractor/url-crawler';

describe('Extractor technical field parsing', () => {
  it('parses materials, coatings, compatibility and care instructions from WMF-style text', () => {
    const intakeRow: IntakeRow = {
      row_id: 'row-parse-1',
      product_id: 'sku-parse-1',
      url: 'https://www.wmf.com/de/de/devil-example.html',
      page_type: 'PDP',
      category: 'Cookware',
      priority: 'P1',
    };

    const text = `
      Material: Edelstahl
      Innenbeschichtung: PTFE
      Außenbeschichtung: keramische Beschichtung
      Spülmaschinengeeignet: Ja
      Kochfeldart: Induktion, Gas
      Backofenkompatibilität: bis 180°C
      Gießrand: vorhanden
      Grifftyp: Soft-Touch
      Cool+ Technologie: integriert
      Diese Pfanne reduziert das Anhaften und macht die Reinigung einfacher.
    `;

    const pageData: CrawledPageData = {
      url: intakeRow.url,
      title: 'Beispiel Pfanne',
      metaDescription: 'Testprodukt',
      text,
      headings: ['Produktdetails', 'Eigenschaften'],
      listItems: ['Material: Edelstahl', 'Spülmaschinengeeignet: Ja'],
    };

    const pko = createPartialPKO(intakeRow, pageData);

    expect(pko.materials).toEqual(expect.arrayContaining(['Edelstahl']));
    expect(pko.features).toEqual(expect.arrayContaining(['PTFE', 'keramische Beschichtung', 'vorhanden', 'integriert']));
    expect(pko.compatibility).toEqual(expect.arrayContaining(['Induktion, Gas', 'bis 180°C']));
    expect(pko.care_instructions).not.toEqual(expect.arrayContaining(['Ja']));
    expect(pko.benefits_explicit).toEqual(expect.arrayContaining([expect.stringContaining('reduziert'), expect.stringContaining('Reinigung')]));
  });

  it('filters out obvious navigation and footer labels from features', () => {
    const intakeRow: IntakeRow = {
      row_id: 'row-parse-2',
      product_id: 'sku-parse-2',
      url: 'https://www.wmf.com/de/de/devil-example-2.html',
      page_type: 'PDP',
      category: 'Cookware',
      priority: 'P2',
    };

    const pageData: CrawledPageData = {
      url: intakeRow.url,
      title: 'Produktseite',
      metaDescription: '',
      text: 'Werden Sie Teil des Newsletters',
      headings: ['Home', 'Produkte', 'Kontakt'],
      listItems: ['Newsletter', 'Impressum', 'Cookie Einstellungen'],
    };

    const pko = createPartialPKO(intakeRow, pageData);

    // noisy strings should be filtered out
    expect(pko.features).toEqual([]);
    expect(pko.page_weaknesses).toEqual([]);
  });
});
