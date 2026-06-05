import { describe, expect, it } from 'vitest';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';
import type { FaqPlanItem } from '../faq-strategy/faq-strategy';
import { createFaqPlan } from '../faq-strategy/faq-strategy';
import { generateFromPlan } from '../faq-writer/faq-writer';

function cookwareFixture(): ProductKnowledgeObject {
  return {
    pko_id: 'pko-feature-backed-quality',
    source_url: 'https://example.com/quality-one',
    product_name: 'WMF Quality One Topfset',
    category: 'Cookware',
    product_family: 'Quality One',
    source_language_detected: 'de',
    source_language_confidence: 1,
    features: [
      'Induction suitability for the pot set',
      'TransTherm® universal base for induction compatibility',
      'Cool+ handle technology for handle warmth expectations',
      'Steam vent glass lid helps reduce rattling and boiling over expectations',
      'No frying pan included expectation',
      'Pan upsell for eggs and gentle frying with a coated non-stick pan',
      'Pan upsell for steak and intense searing',
      'Quality One versus simpler pot set comparison guidance',
      'White spots and discoloration care guidance',
    ],
    fmo_mappings: [
      {
        feature: 'Induction suitability',
        mechanism: 'TransTherm® universal base supports induction use.',
        outcome: 'Buyers can use the pot set on induction hobs.',
        use_case: 'Induction cooking',
        buyer_relevance: 'Reduces compatibility uncertainty.',
        source_confidence: 'high',
      },
    ],
    benefits_explicit: [
      'Cool+ handle technology is approved for handle warmth expectation wording.',
      'Steam vent glass lid benefit and limit are supported.',
      'Pan upsell for eggs and gentle frying with a coated non-stick pan is supported.',
      'Pan upsell for steak and intense searing is supported.',
      'Quality One comparison with a simpler stainless-steel pot set is supported.',
    ],
    benefits_missing: [],
    materials: ['Cromargan® stainless steel'],
    compatibility: ['Induction suitability', 'TransTherm® universal base'],
    care_instructions: [
      'Dishwasher-suitable care with hand drying recommended',
      'White spots can be mineral deposits and should be cleaned with gentle stainless steel care',
    ],
    warranty_service: [],
    use_cases: ['Boiling, simmering, pasta, soups, sauces', 'Eggs and gentle frying pan add-on', 'Steak and intense searing pan add-on'],
    claims_flagged: [],
    page_weaknesses: ['No oven suitability evidence'],
    knowledgebase_chunks_used: ['approved cookware fixture'],
    pko_version: '1.0.0',
    created_at: '2026-06-04T00:00:00.000Z',
  };
}

function answerFor(questionPattern: RegExp, pko = cookwareFixture()): string {
  const plan = createFaqPlan(pko, { targetFaqCount: 20 });
  const faqs = generateFromPlan(plan, pko);
  const faq = faqs.find((item) => questionPattern.test(item.question));
  expect(faq, `Missing FAQ for ${questionPattern}`).toBeDefined();
  return faq!.answer;
}

describe('Feature-backed FAQ answer quality', () => {
  it('does not expose internal or system wording', () => {
    const plan = createFaqPlan(cookwareFixture(), { targetFaqCount: 20 });
    const faqs = generateFromPlan(plan, cookwareFixture());
    const answers = faqs.map((faq) => faq.answer).join('\n');

    expect(answers).not.toMatch(/preview|deterministic|generator|grouping logic|category playbook|product context|FAQ engine|the answer should|when supported|when visible|URL does not provide|do not present|unless the product details confirm|evidence is missing/i);
  });

  it('writes customer-facing cookware answers', () => {
    const answer = answerFor(/boiling and simmering|frying/i);

    expect(answer).toMatch(/Nudeln|Suppen|Saucen|Köcheln|Kochen/i);
    expect(answer).toMatch(/Für empfindliche Speisen|beschichtete Pfanne/i);
    expect(answer).not.toMatch(/Datenmodell|Mapping|backend|fixture/i);
  });

  it('includes direct induction answer and feature proof when supported', () => {
    const answer = answerFor(/induction/i);

    expect(answer).toMatch(/^Ja,/);
    expect(answer).toMatch(/TransTherm®|Induktion/i);
    expect(answer).toMatch(/Kochzone|Induktionskochfelder/i);
  });

  it('uses Cool+ for supported handle warmth answers without absolute heat claims', () => {
    const answer = answerFor(/Cool\+|handles/i);

    expect(answer).toMatch(/Cool\+/);
    expect(answer).toMatch(/warm werden|Topflappen|Hitze/i);
    expect(answer).not.toMatch(/never hot|niemals heiß|nie heiß|wird nicht heiß/i);
  });

  it('explains white spots as mineral deposits and gives care guidance', () => {
    const answer = answerFor(/white spots|discoloration/i);

    expect(answer).toMatch(/Mineral|Wasser|Rückstände/i);
    expect(answer).toMatch(/abtrocknen|Edelstahlreiniger|pfleg/i);
    expect(answer).toMatch(/Cromargan®|Edelstahl/i);
  });

  it('recommends non-stick for eggs only when supported', () => {
    const supportedAnswer = answerFor(/eggs|gentle frying/i);
    expect(supportedAnswer).toMatch(/antihaftbeschichtete|keramisch beschichtete|beschichtete Pfanne/i);

    const pkoWithoutNonStick = {
      ...cookwareFixture(),
      features: ['Pan upsell for eggs and gentle frying'],
      benefits_explicit: [],
      materials: ['Cromargan® stainless steel'],
    };
    const plan: FaqPlanItem[] = [
      {
        question_draft: 'Which WMF pan should I add for eggs or gentle frying?',
        purpose_tags: ['upsell'],
        fmo_elements_targeted: [],
        answer_type: 'other',
        source_evidence: ['Eggs and gentle frying question'],
        supported: true,
      },
    ];
    const faqs = generateFromPlan(plan, pkoWithoutNonStick);

    expect(faqs).toHaveLength(0);
  });

  it('links steak and searing answers to stainless steel or Cromargan only when supported', () => {
    const supportedAnswer = answerFor(/steak|searing/i);
    expect(supportedAnswer).toMatch(/Cromargan®|Edelstahl/i);

    const pkoWithoutSteel = { ...cookwareFixture(), materials: [], features: ['Pan upsell for steak and intense searing'], benefits_explicit: [] };
    const plan: FaqPlanItem[] = [
      {
        question_draft: 'Which WMF pan should I add for steak or intense searing?',
        purpose_tags: ['upsell'],
        fmo_elements_targeted: [],
        answer_type: 'other',
        source_evidence: ['Steak and intense searing question'],
        supported: true,
      },
    ];
    const faqs = generateFromPlan(plan, pkoWithoutSteel);

    expect(faqs).toHaveLength(0);
  });

  it('skips missing induction evidence instead of writing a disclaimer', () => {
    const pkoWithoutInduction = { ...cookwareFixture(), features: ['White spots and discoloration care guidance'], compatibility: [], fmo_mappings: [] };
    const plan: FaqPlanItem[] = [
      {
        question_draft: 'Is this pan suitable for induction?',
        purpose_tags: ['expectation'],
        fmo_elements_targeted: [],
        answer_type: 'compatibility',
        source_evidence: ['Induction question'],
        supported: true,
      },
    ];
    const faqs = generateFromPlan(plan, pkoWithoutInduction);

    expect(faqs).toHaveLength(0);
  });

  it('writes comparison answers with differences and best-fit logic', () => {
    const answer = answerFor(/difference|simpler stainless-steel pot set/i);

    expect(answer).toMatch(/Ausstattung|Grundfunktionen|Komfortmerkmale/i);
    expect(answer).toMatch(/Wählen Sie/i);
    expect(answer).not.toMatch(/premium|professionell|Marketing/i);
  });
});
