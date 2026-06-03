import { describe, expect, it } from 'vitest';
import { mapPkoToFmoMappings } from '../benefit-mapper';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

describe('Benefit Mapper', () => {
  it('maps Devil-style cookware PKO features into safe FMO mappings', () => {
    const pko: ProductKnowledgeObject = {
      pko_id: 'pko-devil-1',
      source_url: 'https://www.wmf.com/de/de/devil-bratpfannen-set-3-teilig-20-cm-24-cm-28-cm-3201113818.html',
      product_name: 'Devil Frying Pan Set',
      category: 'Cookware',
      product_family: 'Devil',
      source_language_detected: 'de',
      source_language_confidence: 0.85,
      features: ['PTFE', 'Keramik', 'Soft-Touch', 'Cool+ Technologie', 'Gießrand', 'Handle type: fixed handle'],
      materials: ['Cromargan® Edelstahl rostfrei'],
      compatibility: ['Induktion, Gas'],
      care_instructions: ['Ja, aber Spülen per Hand empfohlen'],
      fmo_mappings: [],
      benefits_explicit: [],
      benefits_missing: [],
      warranty_service: [],
      use_cases: [],
      claims_flagged: [],
      page_weaknesses: [],
      knowledgebase_chunks_used: [],
      pko_version: '1.0.0',
      created_at: new Date().toISOString(),
    };

    const mappings = mapPkoToFmoMappings(pko);

    expect(mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        feature: 'Cromargan® Edelstahl rostfrei',
        source_confidence: 'high',
      }),
      expect.objectContaining({
        feature: 'PTFE',
        source_confidence: 'high',
      }),
      expect.objectContaining({
        feature: 'Induktion, Gas',
        source_confidence: 'high',
      }),
      expect.objectContaining({
        feature: 'Ja, aber Spülen per Hand empfohlen',
        source_confidence: 'medium',
      }),
      expect.objectContaining({
        feature: 'Handle type: fixed handle',
        source_confidence: 'high',
      }),
    ]));
  });

  it('maps English cookware set PKO features and returns set-level buyer value', () => {
    const pko: ProductKnowledgeObject = {
      pko_id: 'pko-iconic-1',
      source_url: 'https://www.wmf.com/de/en/wmf-iconic-cookware-set-5-piece-3201114885.html',
      product_name: 'Iconic Cookware Set 5 Piece',
      category: 'Cookware',
      product_family: 'Iconic',
      source_language_detected: 'en',
      source_language_confidence: 0.85,
      features: ['PTFE', 'Ceramic', 'Pouring edge', 'Soft-touch handle', 'Cool+ Technology'],
      materials: ['Stainless steel'],
      compatibility: ['Induction, gas'],
      care_instructions: ['Yes, top rack only'],
      fmo_mappings: [],
      benefits_explicit: [],
      benefits_missing: [],
      warranty_service: [],
      use_cases: [],
      claims_flagged: [],
      page_weaknesses: [],
      knowledgebase_chunks_used: [],
      pko_version: '1.0.0',
      created_at: new Date().toISOString(),
    };

    const mappings = mapPkoToFmoMappings(pko);

    expect(mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        feature: 'Stainless steel',
        source_confidence: 'high',
      }),
      expect.objectContaining({
        feature: 'Induction, gas',
        source_confidence: 'high',
      }),
      expect.objectContaining({
        feature: 'Yes, top rack only',
        source_confidence: 'medium',
      }),
      expect.objectContaining({
        feature: 'Pouring edge',
        source_confidence: 'high',
      }),
      expect.objectContaining({
        feature: 'Iconic Cookware Set 5 Piece',
        source_confidence: 'medium',
      }),
    ]));
  });
});
