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

  it('detects English source language for /de/en/ URLs and maps English WMF labels', () => {
    const intakeRow: IntakeRow = {
      row_id: 'row-en-1',
      product_id: 'sku-en-1',
      url: 'https://www.wmf.com/de/en/wmf-iconic-cookware-set-5-piece-3201114885.html',
      page_type: 'PDP',
      category: 'Cookware',
      priority: 'P1',
    };

    const pageData: CrawledPageData = {
      url: intakeRow.url,
      title: 'Iconic Cookware Set',
      metaDescription: 'English WMF product details',
      text: 'This set is perfect for everyday cooking and has Dishwasher Safe container parts.',
      headings: ['Product advantages', 'Product Name', 'Brand'],
      listItems: ['Material | Raw Material', 'Oven compatibility', 'Free shipping from €49'],
      productDetails: [
        { label: 'Material | Raw Material', value: 'Stainless steel' },
        { label: 'Hobs compatibility | Heat source', value: 'Induction, gas' },
        { label: 'Dishwasher Safe', value: 'Yes, top rack only' },
        { label: 'Oven compatibility', value: 'up to 200°C' },
        { label: 'Inside Coating/finish', value: 'PTFE' },
        { label: 'Outside coating/finish', value: 'Ceramic' },
        { label: 'Pouring edge', value: 'Yes' },
        { label: 'Handle type', value: 'Soft-touch' },
        { label: 'Cool+ Technology', value: 'Integrated' },
      ],
    };

    const pko = createPartialPKO(intakeRow, pageData as unknown as any);

    expect(pko.source_language_detected).toBe('en');
    expect(pko.materials).toEqual(expect.arrayContaining(['Stainless steel']));
    expect(pko.compatibility).toEqual(expect.arrayContaining(['Induction, gas', 'up to 200°C']));
    expect(pko.care_instructions).toEqual(expect.arrayContaining(['Yes, top rack only']));
    expect(pko.features).toEqual(expect.arrayContaining(['PTFE', 'Ceramic', 'Integrated']));
    expect(pko.features).not.toEqual(expect.arrayContaining(['Product advantages', 'Product Name', 'Brand', 'Material | Raw Material']));
  });

  it('detects /de/en/ as English and /de/de/ as German based on the WMF locale path', () => {
    const englishRow: IntakeRow = {
      row_id: 'row-lang-en',
      product_id: 'sku-lang-en',
      url: 'https://www.wmf.com/de/en/sample-product.html',
      page_type: 'PDP',
      category: 'Cookware',
      priority: 'P1',
    };

    const germanRow: IntakeRow = {
      row_id: 'row-lang-de',
      product_id: 'sku-lang-de',
      url: 'https://www.wmf.com/de/de/sample-product.html',
      page_type: 'PDP',
      category: 'Cookware',
      priority: 'P1',
    };

    const englishPko = createPartialPKO(englishRow, {
      url: englishRow.url,
      title: 'English product',
      metaDescription: '',
      text: 'This is the English version.',
      headings: [],
      listItems: [],
      productDetails: [],
    });

    const germanPko = createPartialPKO(germanRow, {
      url: germanRow.url,
      title: 'German product',
      metaDescription: '',
      text: 'Dies ist die deutsche Version.',
      headings: [],
      listItems: [],
      productDetails: [],
    });

    expect(englishPko.source_language_detected).toBe('en');
    expect(germanPko.source_language_detected).toBe('de');
  });
});
