import { describe, expect, it } from 'vitest';
import { runRevisionLoop } from '../revision-loop';
import type { FaqItem } from '../../../core/src/types/faq';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

describe('Revision Loop Phase 6 starter', () => {
  const pko: ProductKnowledgeObject = {
    pko_id: 'pko-devil-sample',
    source_url: 'https://www.wmf.com/de/de/devil-bratpfannen-set-3-teilig-20-cm-24-cm-28-cm-3201113818.html',
    product_name: 'Devil Frying Pan Set',
    category: 'Cookware',
    product_family: 'Devil',
    source_language_detected: 'de',
    source_language_confidence: 0.9,
    features: ['Non-stick coating', 'Cromargan stainless steel', 'TransTherm base', 'Ergonomic handles'],
    materials: ['Cromargan stainless steel'],
    compatibility: ['Induction', 'Gas', 'Glass ceramic', 'Halogen'],
    care_instructions: ['Dishwasher-suitable', 'Hand washing recommended'],
    fmo_mappings: [
      {
        feature: 'Non-stick coating',
        mechanism: 'Reduces food sticking',
        outcome: 'Easier cleanup',
        use_case: 'Everyday cooking',
        buyer_relevance: 'Convenient cooking',
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

  function createFaq(overrides: Partial<FaqItem> = {}): FaqItem {
    return {
      faq_id: 'faq-001',
      pko_id: pko.pko_id,
      question: 'Is this pan suitable for induction?',
      answer:
        'Yes. The Devil Frying Pan Set is suitable for induction, gas, glass ceramic, and halogen cooktops. The non-stick coating reduces food sticking and makes cleanup easier for everyday cooking.',
      language: 'de',
      is_master: true,
      purpose_tags: ['expectation', 'benefit-selling'],
      fmo_coverage: { feature: true, mechanism: true, outcome: true, use_case: true, buyer_relevance: false },
      source_evidence: ['Induction', 'TransTherm base', 'Non-stick coating'],
      evaluator_scores: { fact_fidelity: 0, fmo_benefit: 0, ai_visibility: 0, human_tone: 0, localization: null },
      claim_risk_pass: true,
      risk_flags: [],
      status: 'draft',
      rewrite_count: 0,
      schema_ready: true,
      version: '1.0.0',
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function createFailingNonClaimFaq(rewrite_count: number): FaqItem {
    return createFaq({
      answer: 'Yes.',
      fmo_coverage: { feature: false, mechanism: false, outcome: false, use_case: false, buyer_relevance: false },
      rewrite_count,
    });
  }

  it('approves a passing FAQ', () => {
    const result = runRevisionLoop(createFaq(), pko);

    expect(result.status).toBe('approved');
    expect(result.rewrite_count).toBe(0);
    expect(result.claim_risk_pass).toBe(true);
    expect(result.evaluator_scores.fact_fidelity).toBeGreaterThanOrEqual(2);
    expect(result.evaluator_scores.fmo_benefit).toBeGreaterThanOrEqual(2);
    expect(result.evaluator_scores.ai_visibility).toBeGreaterThanOrEqual(2);
    expect(result.evaluator_scores.human_tone).toBeGreaterThanOrEqual(2);
  });

  it('sends claim-risk failure to needs-review immediately without incrementing rewrite_count', () => {
    const result = runRevisionLoop(
      createFaq({
        answer: 'Yes, this pan is dishwasher-safe and easy to maintain.',
        rewrite_count: 0,
      }),
      pko,
    );

    expect(result.status).toBe('needs-review');
    expect(result.rewrite_count).toBe(0);
    expect(result.claim_risk_pass).toBe(false);
  });

  it('keeps a failing non-claim FAQ as draft and increments rewrite_count from 0 to 1', () => {
    const result = runRevisionLoop(createFailingNonClaimFaq(0), pko);

    expect(result.status).toBe('draft');
    expect(result.rewrite_count).toBe(1);
    expect(result.claim_risk_pass).toBe(true);
  });

  it('keeps a failing non-claim FAQ as draft and increments rewrite_count from 1 to 2', () => {
    const result = runRevisionLoop(createFailingNonClaimFaq(1), pko);

    expect(result.status).toBe('draft');
    expect(result.rewrite_count).toBe(2);
    expect(result.claim_risk_pass).toBe(true);
  });

  it('sends a failing non-claim FAQ with rewrite_count 2 to needs-review', () => {
    const result = runRevisionLoop(createFailingNonClaimFaq(2), pko);

    expect(result.status).toBe('needs-review');
    expect(result.rewrite_count).toBe(2);
    expect(result.claim_risk_pass).toBe(true);
  });

  it('never sets Phase 6 revision results to cms-ready or exported', () => {
    const results = [
      runRevisionLoop(createFaq(), pko),
      runRevisionLoop(createFaq({ answer: 'This coating is PFAS-free.' }), pko),
      runRevisionLoop(createFailingNonClaimFaq(0), pko),
      runRevisionLoop(createFailingNonClaimFaq(2), pko),
    ];

    for (const result of results) {
      expect(result.status).not.toBe('cms-ready');
      expect(result.status).not.toBe('exported');
    }
  });
});
