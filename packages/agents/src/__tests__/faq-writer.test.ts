import { describe, expect, it } from 'vitest';
import { generateFaqItems } from '../faq-writer/faq-writer';
import { faqItemSchema } from '../../../core/src/schemas/faq.schema';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

describe('FAQ Writer scaffold', () => {
  it('generates German master FAQ items up to the maximum from a complete PKO', () => {
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
    expect(faqs.length).toBeGreaterThan(0);
    expect(faqs.length).toBeLessThanOrEqual(12);
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
      expect(faq.answer).not.toMatch(/dishwasher-safe|scratch-proof|PFAS-free|PFOA-free|PTFE-free|professional quality|lifetime durability/i);
      // disallow internal architecture terms and data-layer words
      expect(faq.answer).not.toMatch(/architektur|feature flag|agent|backend|frontend|API|PKO|FMO|Mapping|EvidenceBundle|Rohdaten/i);
      // disallow unverified durability language
      expect(faq.answer).not.toMatch(/langlebig/i);
      expect(faq.answer).not.toMatch(/preview|deterministic|grouping logic|category playbook|product context|FAQ engine|URL does not provide|do not present|unless the product details confirm|the answer should|when supported|when visible|evidence is missing/i);
      expect(() => faqItemSchema.parse(faq)).not.toThrow();
    }

    const supportedHandleFaq = faqs.find((f) => /Griff|handle|Cool\+/i.test(f.question));
    expect(supportedHandleFaq).toBeDefined();
    expect(supportedHandleFaq!.answer).toMatch(/Cool\+/);
    expect(supportedHandleFaq!.answer).not.toMatch(/never hot|niemals heiß|nie heiß|wird nicht heiß/i);

    // Ensure oven question is skipped when PKO lacks explicit oven compatibility
    const ovenFaq = faqs.find((f) => /Backofen/i.test(f.question));
    expect(ovenFaq).toBeUndefined();

    // Create a PKO without handle features to test fallback wording
    const pkoNoHandle: ProductKnowledgeObject = { ...pko, pko_id: 'pko-no-handle', features: ['PTFE', 'Keramik'], product_name: 'Devil Frying Pan Single' };
    const faqsNoHandle = generateFaqItems(pkoNoHandle);
    const handleFaq = faqsNoHandle.find((f) => /Handhabung des Griffs|Griffoption/i.test(f.question) || /Handhabung des Griffs|Griff/i.test(f.question));
    expect(handleFaq).toBeUndefined();

  });
});
