import { describe, expect, it } from 'vitest';
import { intakeRowSchema } from '../schemas/intake.schema';
import { pkoSchema } from '../schemas/pko.schema';
import { faqItemSchema } from '../schemas/faq.schema';

describe('Section 1 schema contracts', () => {
  it('accepts valid intake rows and rejects unknown fields', () => {
    const valid = {
      row_id: 'row-001',
      product_id: 'sku-123',
      url: 'https://example.com/product/1',
      page_type: 'PDP',
      category: 'Cookware',
      product_family: 'Coated Pans',
      variant_group_id: 'group-1',
      priority: 'P1',
      source_language: 'en',
    };

    expect(intakeRowSchema.parse(valid)).toEqual(valid);
    const unknownField = intakeRowSchema.safeParse({
      ...valid,
      extra_field: 'unexpected',
    });

    expect(unknownField.success).toBe(false);
    expect(unknownField.error?.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });

  it('validates intake enums and allows blank source_language', () => {
    const parsed = intakeRowSchema.parse({
      row_id: 'row-002',
      url: 'https://example.com/product/2',
      page_type: 'recipe',
      category: 'Accessories',
      priority: 'P3',
      source_language: '',
    });

    expect(parsed.source_language).toBeUndefined();
    expect(parsed.page_type).toBe('recipe');
    expect(parsed.priority).toBe('P3');
  });

  it('rejects missing required PKO fields and rejects unknown fields', () => {
    const missing = pkoSchema.safeParse({
      product_name: 'Example Product',
      category: 'Cookware',
      product_family: 'Coated Pans',
      source_language_detected: 'en',
      source_language_confidence: 0.95,
      pko_version: '1.0.0',
      created_at: '2026-06-02T12:00:00Z',
    });

    expect(missing.success).toBe(false);
    const unknownField = pkoSchema.safeParse({
      ...missing.success ? missing.data : {},
      pko_id: 'pko-1',
      source_url: 'https://example.com/product/3',
      product_name: 'Example Product',
      category: 'Cookware',
      product_family: 'Coated Pans',
      source_language_detected: 'en',
      source_language_confidence: 0.95,
      features: [],
      fmo_mappings: [],
      benefits_explicit: [],
      benefits_missing: [],
      materials: [],
      compatibility: [],
      care_instructions: [],
      warranty_service: [],
      use_cases: [],
      claims_flagged: [],
      page_weaknesses: [],
      knowledgebase_chunks_used: [],
      pko_version: '1.0.0',
      created_at: '2026-06-02T12:00:00Z',
      unexpected: true,
    });

    expect(unknownField.success).toBe(false);
    expect(unknownField.error?.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });

  it('accepts valid FAQ items and rejects unknown fields', () => {
    const faq = {
      faq_id: 'faq-1',
      pko_id: 'pko-1',
      question: 'What is this product?',
      answer: 'This product is designed to ...',
      language: 'en',
      is_master: true,
      purpose_tags: ['benefit-selling'],
      fmo_coverage: {
        feature: true,
        mechanism: true,
        outcome: false,
        use_case: false,
        buyer_relevance: true,
      },
      source_evidence: ['Explicit benefit in the PKO'],
      evaluator_scores: {
        fact_fidelity: 5,
        fmo_benefit: 4,
        ai_visibility: 3,
        human_tone: 4,
        localization: null,
      },
      claim_risk_pass: true,
      risk_flags: [],
      status: 'draft',
      rewrite_count: 0,
      schema_ready: false,
      version: '1.0.0',
      created_at: '2026-06-02T12:00:00Z',
    };

    expect(faqItemSchema.parse(faq)).toEqual(faq);
    const unknownField = faqItemSchema.safeParse({
      ...faq,
      extra_flag: 'nope',
    });

    expect(unknownField.success).toBe(false);
    expect(unknownField.error?.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });
});
