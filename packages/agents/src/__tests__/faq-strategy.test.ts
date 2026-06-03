import { describe, expect, it } from 'vitest';
import createFaqPlan from '../faq-strategy/faq-strategy';
import { generateFromPlan } from '../faq-writer/faq-writer';
import { faqItemSchema } from '../../../core/src/schemas/faq.schema';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

describe('FAQ Strategy and Writer integration', () => {
  it('respects targetFaqCount 20 and returns up to 20 FAQ items when enough supported opportunities exist', () => {
    const manyMappings = Array.from({ length: 25 }).map((_, i) => ({
      feature: `feature-${i}`,
      mechanism: `mechanism-${i}`,
      outcome: `outcome-${i}`,
      use_case: `use-case-${i}`,
      buyer_relevance: `relevance-${i}`,
      source_confidence: 'high',
    }));

    const pko: ProductKnowledgeObject = {
      pko_id: 'pko-many',
      source_url: '',
      product_name: 'Many Features',
      category: 'Test',
      product_family: 'Test',
      source_language_detected: 'de',
      source_language_confidence: 1,
      features: manyMappings.map((m) => m.feature),
      materials: [],
      compatibility: [],
      care_instructions: [],
      fmo_mappings: manyMappings as any,
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

    const plan = createFaqPlan(pko, { targetFaqCount: 20 });
    expect(plan.length).toBeLessThanOrEqual(20);

    const faqs = generateFromPlan(plan as any, pko);
    expect(faqs.length).toBeLessThanOrEqual(20);
    for (const f of faqs) {
      expect(() => faqItemSchema.parse(f)).not.toThrow();
    }
  });

  it('skips unsupported opportunities and does not pad with invented FAQs', () => {
    const mappings = [
      { feature: 'a', mechanism: 'm', outcome: 'o', use_case: 'u', buyer_relevance: 'b', source_confidence: 'low' },
      { feature: 'b', mechanism: 'm2', outcome: 'o2', use_case: 'u2', buyer_relevance: 'b2', source_confidence: 'high' },
    ];

    const pko: ProductKnowledgeObject = {
      pko_id: 'pko-skip',
      source_url: '',
      product_name: '',
      category: 'Test',
      product_family: 'Test',
      source_language_detected: 'de',
      source_language_confidence: 1,
      features: [],
      materials: [],
      compatibility: [],
      care_instructions: [],
      fmo_mappings: mappings as any,
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

    const plan = createFaqPlan(pko, { targetFaqCount: 12 });
    // only one mapping had high confidence -> only one supported plan expected
    const supported = plan.filter((p) => p.supported);
    expect(supported.length).toBe(1);

    const faqs = generateFromPlan(plan as any, pko);
    expect(faqs.length).toBe(supported.length);
  });
});
