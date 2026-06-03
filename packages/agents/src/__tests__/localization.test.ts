import { describe, expect, it } from 'vitest';
import { faqItemSchema } from '../../../core/src/schemas/faq.schema';
import type { FaqItem } from '../../../core/src/types/faq';
import { localizeFaqItem, localizeFaqItems } from '../localization';

describe('Localization Phase 7 starter', () => {
  function createMasterFaq(overrides: Partial<FaqItem> = {}): FaqItem {
    return {
      faq_id: 'faq-devil-001',
      pko_id: 'pko-devil-sample',
      question: 'Ist das WMF Devil Pfannen-Set fuer Induktion geeignet?',
      answer:
        'Ja. Das WMF Devil Pfannen-Set ist fuer Induktion geeignet und spuelmaschinengeeignet. Die Antihaftversiegelung reduziert Anhaften und erleichtert die Reinigung.',
      language: 'de',
      is_master: true,
      purpose_tags: ['expectation', 'benefit-selling'],
      fmo_coverage: { feature: true, mechanism: true, outcome: true, use_case: false, buyer_relevance: false },
      source_evidence: ['Induktion', 'Spuelmaschinengeeignet', 'Antihaftversiegelung'],
      evaluator_scores: { fact_fidelity: 2, fmo_benefit: 2, ai_visibility: 2, human_tone: 2, localization: null },
      claim_risk_pass: true,
      risk_flags: [],
      status: 'approved',
      rewrite_count: 1,
      schema_ready: true,
      version: '1.0.0',
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  it('reuses the DE master directly when target language matches the master language', () => {
    const master = createMasterFaq();
    const result = localizeFaqItem(master, 'de');

    expect(result).toBe(master);
    expect(result.is_master).toBe(true);
    expect(result.language).toBe('de');
  });

  it('creates EN, ES, NL, and FR localized FAQ items', () => {
    const [en, es, nl, fr] = localizeFaqItems([createMasterFaq()], ['en', 'es', 'nl', 'fr']);

    expect(en.language).toBe('en');
    expect(es.language).toBe('es');
    expect(nl.language).toBe('nl');
    expect(fr.language).toBe('fr');
    expect(en.faq_id).toContain('en');
    expect(es.faq_id).toContain('es');
    expect(nl.faq_id).toContain('nl');
    expect(fr.faq_id).toContain('fr');
  });

  it('marks translated items as non-master', () => {
    const localized = localizeFaqItems([createMasterFaq()], ['en', 'es', 'nl', 'fr']);

    for (const item of localized) {
      expect(item.is_master).toBe(false);
    }
  });

  it('preserves purpose_tags, source_evidence, and fmo_coverage', () => {
    const master = createMasterFaq();
    const localized = localizeFaqItem(master, 'en');

    expect(localized.purpose_tags).toEqual(master.purpose_tags);
    expect(localized.source_evidence).toEqual(master.source_evidence);
    expect(localized.fmo_coverage).toEqual(master.fmo_coverage);
  });

  it('adds risk flags and needs-review status for review-market claims', () => {
    const spanish = localizeFaqItem(createMasterFaq(), 'es');
    const french = localizeFaqItem(createMasterFaq(), 'fr');

    expect(spanish.status).toBe('needs-review');
    expect(french.status).toBe('needs-review');
    expect(spanish.risk_flags.some((flag) => flag.flag_type === 'market-claim:dishwasher-suitable')).toBe(true);
    expect(french.risk_flags.some((flag) => flag.flag_type === 'market-claim:dishwasher-suitable')).toBe(true);
  });

  it('does not present ES or FR dishwasher review claims as clean approved customer copy', () => {
    const spanish = localizeFaqItem(createMasterFaq(), 'es');
    const french = localizeFaqItem(createMasterFaq(), 'fr');

    expect(spanish.answer).not.toMatch(/lavavajillas/i);
    expect(french.answer).not.toMatch(/lave-vaisselle/i);
    expect(spanish.answer).toContain('[claim review required: dishwasher-suitable]');
    expect(french.answer).toContain('[claim review required: dishwasher-suitable]');
    expect(spanish.status).toBe('needs-review');
    expect(french.status).toBe('needs-review');
  });

  it('keeps dishwasher-suitable wording for approved EN and NL markets', () => {
    const english = localizeFaqItem(createMasterFaq(), 'en');
    const dutch = localizeFaqItem(createMasterFaq(), 'nl');

    expect(english.answer).toMatch(/dishwasher-suitable/i);
    expect(dutch.answer).toMatch(/vaatwasser/i);
    expect(english.status).toBe('draft');
    expect(dutch.status).toBe('draft');
  });

  it('does not change claim_risk_pass from false to true', () => {
    const master = createMasterFaq({
      claim_risk_pass: false,
      risk_flags: [{ flag_type: 'claim-risk:PFAS-free', description: 'Risky wording detected.', severity: 'high' }],
    });
    const localized = localizeFaqItem(master, 'en');

    expect(localized.claim_risk_pass).toBe(false);
    expect(localized.risk_flags.some((flag) => flag.flag_type === 'claim-risk:PFAS-free')).toBe(true);
  });

  it('produces FAQ Item Objects that pass faqItemSchema', () => {
    const outputs = localizeFaqItems([createMasterFaq()], ['de', 'en', 'es', 'nl', 'fr']);

    for (const output of outputs) {
      expect(faqItemSchema.safeParse(output).success).toBe(true);
      expect(output.status).not.toBe('cms-ready');
      expect(output.status).not.toBe('exported');
    }
  });
});
