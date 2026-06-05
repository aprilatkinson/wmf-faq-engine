import { describe, expect, it } from 'vitest';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';
import type { FaqPlanItem } from '../faq-strategy/faq-strategy';
import { retrieveProductFactEvidence } from '../evidence-retrieval';
import { generateFromPlan } from '../faq-writer/faq-writer';

function basePko(overrides: Partial<ProductKnowledgeObject> = {}): ProductKnowledgeObject {
  return {
    pko_id: 'pko-devil-3-piece',
    source_url: 'https://example.com/not-used-for-copy-20-cm-24-cm-28-cm',
    product_name: 'WMF Devil 3-piece pan set 20 cm 24 cm 28 cm',
    category: 'Cookware',
    product_family: 'Devil',
    source_language_detected: 'de',
    source_language_confidence: 1,
    features: [
      '3-piece pan set with 20 cm, 24 cm, 28 cm',
      'PTFE non-stick coating for eggs and gentle frying',
      'Turner included',
    ],
    fmo_mappings: [],
    benefits_explicit: ['Set contents are 20 cm, 24 cm, 28 cm'],
    benefits_missing: [],
    materials: [],
    compatibility: [],
    care_instructions: [],
    warranty_service: [],
    use_cases: ['Eggs and gentle frying'],
    claims_flagged: [],
    page_weaknesses: [],
    knowledgebase_chunks_used: [],
    pko_version: '1.0.0',
    created_at: '2026-06-04T00:00:00.000Z',
    ...overrides,
  };
}

function faqAnswer(question: string, pko: ProductKnowledgeObject): string {
  const plan: FaqPlanItem[] = [
    {
      question_draft: question,
      purpose_tags: ['expectation'],
      fmo_elements_targeted: [],
      answer_type: 'other',
      source_evidence: ['approved fixture fact'],
      supported: true,
    },
  ];
  return generateFromPlan(plan, pko)[0].answer;
}

describe('Phase 10B evidence retrieval and grounding', () => {
  it('retrieves product fact evidence without using raw URL text', () => {
    const evidence = retrieveProductFactEvidence(basePko());

    expect(evidence.set_pieces).toEqual(['3-piece']);
    expect(evidence.set_sizes).toEqual(['20 cm', '24 cm', '28 cm']);
    expect(evidence.non_stick).toBe(true);
    expect(evidence.accessories_included).toContain('turner');
  });

  it('Devil 3-piece pan set answer names 20 cm, 24 cm, and 28 cm', () => {
    const answer = faqAnswer('What is included in this pan set?', basePko());

    expect(answer).toMatch(/20 cm/);
    expect(answer).toMatch(/24 cm/);
    expect(answer).toMatch(/28 cm/);
    expect(answer).toMatch(/3-piece/);
    expect(answer).not.toMatch(/check listed contents/i);
  });

  it('induction answer says yes only when induction evidence exists', () => {
    const supported = faqAnswer('Is this cookware suitable for induction hobs?', basePko({ compatibility: ['Induction suitability'] }));
    const unsupported = faqAnswer('Is this cookware suitable for induction hobs?', basePko({ compatibility: [], features: [] }));

    expect(supported).toMatch(/^Ja,/);
    expect(unsupported).not.toMatch(/^Ja,/);
    expect(unsupported).toMatch(/keine eindeutige Angabe|Herstellerangaben/i);
  });

  it('TransTherm, Cool+, and Cromargan appear only when supported', () => {
    const withAll = basePko({
      features: ['Cool+ handle technology', '3-piece pan set with 20 cm, 24 cm, 28 cm'],
      compatibility: ['Induction suitability', 'TransTherm® universal base'],
      materials: ['Cromargan® stainless steel'],
      care_instructions: ['White spots can be mineral deposits'],
    });
    const withoutAll = basePko({ features: [], compatibility: [], materials: [], care_instructions: [] });

    expect(faqAnswer('Is this cookware suitable for induction hobs?', withAll)).toMatch(/TransTherm®/);
    expect(faqAnswer('Is this cookware suitable for induction hobs?', withoutAll)).not.toMatch(/TransTherm®/);

    expect(faqAnswer('Can the Cool+ handles still become warm during cooking?', withAll)).toMatch(/Cool\+/);
    expect(faqAnswer('Can the Cool+ handles still become warm during cooking?', withoutAll)).not.toMatch(/Cool\+/);

    expect(faqAnswer('Why do white spots or rainbow discoloration appear on stainless steel?', withAll)).toMatch(/Cromargan®/);
    expect(faqAnswer('Why do white spots or rainbow discoloration appear on stainless steel?', withoutAll)).not.toMatch(/Cromargan®/);
  });

  it('answers do not contain internal writer wording', () => {
    const answer = faqAnswer('What is included in this pan set?', basePko());

    expect(answer).not.toMatch(/preview|deterministic|product context|category playbook|the answer should|when supported|when visible/i);
  });
});
