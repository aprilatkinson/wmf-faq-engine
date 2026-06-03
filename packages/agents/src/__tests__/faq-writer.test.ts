import { describe, expect, it } from 'vitest';
import { generateFaqItems } from '../faq-writer/faq-writer';
import { faqItemSchema } from '../../../core/src/schemas/faq.schema';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

describe('FAQ Writer scaffold', () => {
  it('generates 12 German master FAQ items from a complete PKO', () => {
    const pko: ProductKnowledgeObject = {
      pko_id: 'pko-devil-sample',
      source_url: 'https://www.wmf.com/de/de/devil-bratpfannen-set-3-teilig-20-cm-24-cm-28-cm-3201113818.html',
      product_name: 'Devil Frying Pan Set',
      category: 'Cookware',
      product_family: 'Devil',
      source_language_detected: 'de',
      source_language_confidence: 0.9,
      features: ['PTFE', 'Keramik', 'Soft-Touch', 'Cool+ Technologie', 'Gießrand', 'Handle type: fixed handle'],
      materials: ['Cromargan® Edelstahl rostfrei'],
      compatibility: ['Induktion, Gas'],
      care_instructions: ['Ja, aber Spülen per Hand empfohlen'],
      fmo_mappings: [
        {
          feature: 'PTFE',
          mechanism: 'Non-stick coating makes food release easier.',
          outcome: 'Reduces sticking and cleanup effort.',
          use_case: 'Frying and sautéing.',
          buyer_relevance: 'Supports simple maintenance.',
          source_confidence: 'high',
        },
      ],
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

    const faqs = generateFaqItems(pko);
    expect(faqs).toHaveLength(12);
    for (const faq of faqs) {
      expect(faq.language).toBe('de');
      expect(faq.is_master).toBe(true);
      expect(faq.status).toBe('draft');
      expect(faq.rewrite_count).toBe(0);
      expect(faq.evaluator_scores.localization).toBeNull();
      expect(faq.fmo_coverage).toEqual(
        expect.objectContaining({
          feature: expect.any(Boolean),
          mechanism: expect.any(Boolean),
          outcome: expect.any(Boolean),
          use_case: expect.any(Boolean),
          buyer_relevance: expect.any(Boolean),
        }),
      );
      expect(faq.schema_ready).toBe(true);
      expect(faq.source_evidence.length).toBeGreaterThan(0);
      expect(faq.answer).not.toMatch(/dishwasher-safe|scratch-proof|PFAS-free|PFOA-free|PTFE-free|professional quality|lifetime durability|Cool\+/i);
      // disallow internal architecture terms and data-layer words
      expect(faq.answer).not.toMatch(/architektur|feature flag|agent|backend|frontend|API|PKO|FMO|Mapping|EvidenceBundle|Rohdaten/i);
      // disallow unverified durability language
      expect(faq.answer).not.toMatch(/langlebig/i);
      expect(() => faqItemSchema.parse(faq)).not.toThrow();
    }

    // Ensure oven question does not claim suitability when PKO lacks explicit oven compatibility
    const ovenFaq = faqs.find((f) => /Backofen/i.test(f.question));
    expect(ovenFaq).toBeDefined();
    expect(ovenFaq!.answer).toMatch(/keine eindeutige Information|prüfen Sie die Herstellerangaben/i);

    // Create a PKO without handle features to test fallback wording
    const pkoNoHandle: ProductKnowledgeObject = { ...pko, pko_id: 'pko-no-handle', features: ['PTFE', 'Keramik'], product_name: 'Devil Frying Pan Single' };
    const faqsNoHandle = generateFaqItems(pkoNoHandle);
    const handleFaq = faqsNoHandle.find((f) => /Handhabung des Griffs|Griffoption/i.test(f.question) || /Handhabung des Griffs|Griff/i.test(f.question));
    expect(handleFaq).toBeDefined();
    // Fallback must not claim comfort or safety when not supported
    expect(handleFaq!.answer).not.toMatch(/sicher|komfortabel|komfortable/i);
    expect(handleFaq!.answer).toMatch(/keine eindeutige Angabe/i);

  });
});
