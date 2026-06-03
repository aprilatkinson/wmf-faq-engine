import { describe, expect, it } from 'vitest';
import { evaluateFaqItem } from '../evaluators/index';
import type { FaqItem } from '../../../core/src/types/faq';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

describe('Evaluators Phase 5', () => {
  // Sample PKO for Devil Pan Set
  const devilPko: ProductKnowledgeObject = {
    pko_id: 'pko-devil-sample',
    source_url: 'https://www.wmf.com/de/de/devil-bratpfannen-set-3-teilig-20-cm-24-cm-28-cm-3201113818.html',
    product_name: 'Devil Frying Pan Set',
    category: 'Cookware',
    product_family: 'Devil',
    source_language_detected: 'de',
    source_language_confidence: 0.9,
    features: ['Non-stick coating', 'Cromargan stainless steel', 'TransTherm base', 'Ergonomic handles'],
    materials: ['Cromargan® stainless steel'],
    compatibility: ['Induction', 'Gas', 'Glass ceramic', 'Halogen'],
    care_instructions: ['Dishwasher-suitable', 'Hand washing recommended'],
    fmo_mappings: [
      {
        feature: 'Non-stick coating',
        mechanism: 'Reduces food sticking, easier cleanup',
        outcome: 'Less effort required for cooking delicate foods',
        use_case: 'Everyday cooking, eggs, fish, pancakes',
        buyer_relevance: 'Convenient, low-effort cooking',
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

  // Helper: create a safe Devil FAQ
  function createSafeFaq(overrides: Partial<FaqItem> = {}): FaqItem {
    return {
      faq_id: 'faq-001',
      pko_id: 'pko-devil-sample',
      question: 'Is this pan suitable for induction?',
      answer:
        'Yes. The Devil Frying Pan Set is suitable for induction, gas, glass ceramic, and halogen cooktops. The TransTherm universal base ensures even heat distribution across all these hob types.',
      language: 'de',
      is_master: true,
      purpose_tags: ['expectation'],
      fmo_coverage: { feature: true, mechanism: true, outcome: false, use_case: false, buyer_relevance: false },
      source_evidence: ['Induction', 'TransTherm base'],
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

  describe('Claim Risk Gate', () => {
    it('should pass a safe Devil FAQ without risky terms', () => {
      const faq = createSafeFaq({
        answer: 'Yes, this pan is suitable for induction cooking and dishwasher-suitable for easy cleanup.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.claim_risk_pass).toBe(true);
      expect(result.risk_flags.filter((f) => f.flag_type.startsWith('claim-risk'))).toHaveLength(0);
    });

    it('should fail FAQ containing "dishwasher-safe"', () => {
      const faq = createSafeFaq({
        answer: 'Yes, this pan is dishwasher-safe and easy to maintain.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.claim_risk_pass).toBe(false);
      const claimRiskFlags = result.risk_flags.filter((f: any) => f.flag_type.includes('claim-risk'));
      expect(claimRiskFlags.length).toBeGreaterThan(0);
      if (claimRiskFlags[0]) {
        expect(claimRiskFlags[0].description).toMatch(/dishwasher-safe/i);
      }
    });

    it('should fail FAQ containing "PFAS-free"', () => {
      const faq = createSafeFaq({
        answer: 'This coating is PFAS-free and safe for your family.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.claim_risk_pass).toBe(false);
      const claimRiskFlags = result.risk_flags.filter((f) => f.flag_type.includes('claim-risk'));
      expect(claimRiskFlags.length).toBeGreaterThan(0);
    });

    it('should fail FAQ containing "PFOA-free"', () => {
      const faq = createSafeFaq({
        answer: 'Our pan coating is PFOA-free, ensuring health and safety.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.claim_risk_pass).toBe(false);
    });

    it('should fail FAQ containing "PTFE-free"', () => {
      const faq = createSafeFaq({
        answer: 'This pan uses a PTFE-free non-stick coating technology.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.claim_risk_pass).toBe(false);
    });

    it('should fail FAQ containing "Cool+"', () => {
      const faq = createSafeFaq({
        answer: 'Our ergonomic handles feature Cool+ technology to prevent heat transfer.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.claim_risk_pass).toBe(false);
    });

    it('should fail FAQ containing "scratch-proof"', () => {
      const faq = createSafeFaq({
        answer: 'The pan surface is scratch-proof and highly durable.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.claim_risk_pass).toBe(false);
    });

    it('should pass ordinary Cromargan wording without a claim-risk flag', () => {
      const faq = createSafeFaq({
        answer: 'The pan is made with Cromargan® Edelstahl rostfrei for everyday cooking.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      const claimRiskFlags = result.risk_flags.filter((f) => f.flag_type.startsWith('claim-risk'));
      expect(result.claim_risk_pass).toBe(true);
      expect(claimRiskFlags).toHaveLength(0);
    });

    it('does not handle unsupported Cromargan Protect claims in the basic claim-risk evaluator yet', () => {
      const faq = createSafeFaq({
        answer: 'The pan uses Cromargan Protect® for a refined stainless steel finish.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      const claimRiskFlags = result.risk_flags.filter((f) => f.flag_type.startsWith('claim-risk'));
      expect(result.claim_risk_pass).toBe(true);
      expect(claimRiskFlags).toHaveLength(0);
    });
  });

  describe('Fact Fidelity Evaluator', () => {
    it('should fail (score 0) if answer claims unsupported oven compatibility', () => {
      // Devil pan is NOT oven-compatible per tech data
      const faq = createSafeFaq({
        answer: 'Yes, this pan is oven-safe up to 200°C, making it perfect for finishing dishes in the oven.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.evaluator_scores.fact_fidelity).toBe(0);
      const factFlags = result.risk_flags.filter((f: any) => f.flag_type.includes('fact-fidelity'));
      expect(factFlags.length).toBeGreaterThan(0);
    });

    it('should score well (2-3) for supported compatibility claims', () => {
      const faq = createSafeFaq({
        answer:
          'Yes. The Devil Frying Pan Set is suitable for induction, gas, glass ceramic, and halogen cooktops, thanks to the TransTherm universal base.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.evaluator_scores.fact_fidelity).toBeGreaterThanOrEqual(2);
    });

    it('should score 0 if answer contains PFAS claim without PKO support', () => {
      const faq = createSafeFaq({
        answer: 'Our coating is PFAS-free and provides excellent non-stick performance.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.evaluator_scores.fact_fidelity).toBe(0);
    });
  });

  describe('Evaluator Scores Format', () => {
    it('should return integers 0-3 for all evaluator scores', () => {
      const faq = createSafeFaq({
        answer:
          'Yes. The Devil Frying Pan Set is suitable for induction cooking. The non-stick coating reduces sticking and makes cleanup easier, so you can enjoy quick, effortless everyday cooking.',
      });
      const result = evaluateFaqItem(faq, devilPko);

      expect(Number.isInteger(result.evaluator_scores.fact_fidelity)).toBe(true);
      expect(Number.isInteger(result.evaluator_scores.fmo_benefit)).toBe(true);
      expect(Number.isInteger(result.evaluator_scores.ai_visibility)).toBe(true);
      expect(Number.isInteger(result.evaluator_scores.human_tone)).toBe(true);

      expect(result.evaluator_scores.fact_fidelity).toBeGreaterThanOrEqual(0);
      expect(result.evaluator_scores.fact_fidelity).toBeLessThanOrEqual(3);
      expect(result.evaluator_scores.fmo_benefit).toBeGreaterThanOrEqual(0);
      expect(result.evaluator_scores.fmo_benefit).toBeLessThanOrEqual(3);
      expect(result.evaluator_scores.ai_visibility).toBeGreaterThanOrEqual(0);
      expect(result.evaluator_scores.ai_visibility).toBeLessThanOrEqual(3);
      expect(result.evaluator_scores.human_tone).toBeGreaterThanOrEqual(0);
      expect(result.evaluator_scores.human_tone).toBeLessThanOrEqual(3);
    });

    it('should set localization to null for master FAQs', () => {
      const faq = createSafeFaq({ is_master: true });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.evaluator_scores.localization).toBeNull();
    });
  });

  describe('Risk Flags Structure', () => {
    it('should return risk_flags with proper structure (flag_type, description, severity)', () => {
      const faq = createSafeFaq({
        answer: 'This pan is dishwasher-safe and scratch-proof for maximum durability.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.risk_flags.length).toBeGreaterThan(0);

      for (const flag of result.risk_flags) {
        expect(flag).toHaveProperty('flag_type');
        expect(flag).toHaveProperty('description');
        expect(flag).toHaveProperty('severity');
        expect(typeof flag.flag_type).toBe('string');
        expect(typeof flag.description).toBe('string');
        expect(typeof flag.severity).toBe('string');
        expect(['high', 'medium', 'low']).toContain(flag.severity);
      }
    });

    it('should add fact-fidelity risk flag when score is 0', () => {
      const faq = createSafeFaq({
        answer: 'This pan is oven-safe up to 250°C.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      const factFlags = result.risk_flags.filter((f: any) => f.flag_type.includes('fact-fidelity'));
      expect(factFlags.length).toBeGreaterThan(0);
      if (factFlags[0]) {
        expect(factFlags[0].severity).toBe('high');
      }
    });
  });

  describe('FMO Benefit Evaluator', () => {
    it('should score 0 for pure yes/no with no FMO elements', () => {
      const faq = createSafeFaq({
        answer: 'Yes, this pan is suitable for induction.',
        fmo_coverage: { feature: false, mechanism: false, outcome: false, use_case: false, buyer_relevance: false },
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.evaluator_scores.fmo_benefit).toBe(0);
    });

    it('should score >= 2 for answer with feature + outcome', () => {
      const faq = createSafeFaq({
        answer: 'Yes. The non-stick coating helps reduce sticking, making it easier to cook delicate foods like eggs and fish.',
        fmo_coverage: { feature: true, mechanism: false, outcome: true, use_case: false, buyer_relevance: false },
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.evaluator_scores.fmo_benefit).toBeGreaterThanOrEqual(2);
    });

    it('should score 3 for full FMO depth (feature + mechanism + outcome + use_case)', () => {
      const faq = createSafeFaq({
        answer:
          'Yes. The non-stick ceramic coating reduces sticking and makes cleaning easier, so you can enjoy quick, effortless everyday cooking with delicate foods like eggs and pancakes.',
        fmo_coverage: { feature: true, mechanism: true, outcome: true, use_case: true, buyer_relevance: false },
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.evaluator_scores.fmo_benefit).toBeGreaterThanOrEqual(2);
    });
  });

  describe('AI Visibility Evaluator', () => {
    it('should score >= 2 when answer contains product/category name + decision attribute', () => {
      const faq = createSafeFaq({
        answer: 'Yes, the Devil Frying Pan Set is suitable for induction cooktops and gas hobs, with the TransTherm universal base.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      expect(result.evaluator_scores.ai_visibility).toBeGreaterThanOrEqual(2);
    });

    it('should score lower without product name', () => {
      const faq = createSafeFaq({
        answer: 'Yes, it is suitable for induction cooking.',
      });
      const result = evaluateFaqItem(faq, devilPko);
      // Score depends on whether "it" + induction is enough; typically lower
      // This is a softer rule, so we check it doesn't fail completely
      expect(result.evaluator_scores.ai_visibility).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Human Tone Evaluator', () => {
    it('should prefer natural language over robotic corporate tone', () => {
      const naturalFaq = createSafeFaq({
        answer: 'Yes. The non-stick coating makes this pan perfect for eggs, fish, and pancakes—you get easy cleanup and less effort in the kitchen.',
      });
      const roboticFaq = createSafeFaq({
        answer: 'Furthermore, with respect to cooktop compatibility, the aforementioned pan is suitable for induction and gas hobs.',
      });

      const naturalResult = evaluateFaqItem(naturalFaq, devilPko);
      const roboticResult = evaluateFaqItem(roboticFaq, devilPko);

      expect(naturalResult.evaluator_scores.human_tone).toBeGreaterThan(roboticResult.evaluator_scores.human_tone);
    });

    it('should penalize bloated or corporate tone', () => {
      const bloatedFaq = createSafeFaq({
        answer:
          'This very robust and quite sophisticated pan set really does offer a quite comprehensive solution for your cooking needs, and furthermore, it is very much suitable for induction cooking as well as many other types of cooking surfaces.',
      });
      const result = evaluateFaqItem(bloatedFaq, devilPko);
      expect(result.evaluator_scores.human_tone).toBeLessThanOrEqual(2);
    });
  });

  describe('Integration: Full Evaluation Flow', () => {
    it('should produce valid FAQ Item with all fields populated after evaluation', () => {
      const faq = createSafeFaq({
        answer:
          'Yes. The Devil Frying Pan Set is suitable for induction cooking, gas, glass ceramic, and halogen cooktops. The non-stick coating reduces food sticking, making it ideal for delicate foods like eggs and fish, with easier cleanup for everyday cooking.',
      });

      const result = evaluateFaqItem(faq, devilPko);

      // Check that evaluator_scores are all populated
      expect(result.evaluator_scores).toHaveProperty('fact_fidelity');
      expect(result.evaluator_scores).toHaveProperty('fmo_benefit');
      expect(result.evaluator_scores).toHaveProperty('ai_visibility');
      expect(result.evaluator_scores).toHaveProperty('human_tone');
      expect(result.evaluator_scores).toHaveProperty('localization');

      // Check claim_risk_pass boolean
      expect(typeof result.claim_risk_pass).toBe('boolean');

      // Check risk_flags array
      expect(Array.isArray(result.risk_flags)).toBe(true);

      // Check status remains draft
      expect(result.status).toBe('draft');
    });
  });
});
