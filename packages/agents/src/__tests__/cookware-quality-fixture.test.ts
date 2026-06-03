import { describe, expect, it } from 'vitest';
import { createFaqPlan } from '../faq-strategy/faq-strategy';
import { generateFromPlan } from '../faq-writer/faq-writer';
import { faqItemSchema } from '../../../core/src/schemas/faq.schema';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

function createQualityOneCookwareFixture(): ProductKnowledgeObject {
  return {
    pko_id: 'pko-quality-one-fixture',
    source_url: '',
    product_name: 'WMF Quality One Topfset',
    category: 'Cookware',
    product_family: 'Quality One',
    source_language_detected: 'de',
    source_language_confidence: 1,
    features: [
      'Induction suitability for the pot set',
      'Cool+ handle technology for handle warmth expectations',
      'Steam vent glass lid with moisture release limits',
      'Pot set expectation: no frying pan included',
      'Stainless steel discoloration and white spot care guidance',
      'Rust confusion support: spots and discoloration need care review',
      'Pan upsell for eggs and gentle frying',
      'Pan upsell for steak and intense searing',
      'Quality One versus simpler pot set comparison guidance',
    ],
    materials: ['Cromargan® stainless steel'],
    compatibility: ['Induction suitability'],
    care_instructions: [
      'Dishwasher-suitable care with hand drying recommended',
      'White spots can be treated with gentle stainless steel care guidance',
      'Discoloration can occur from minerals or heat and should be cleaned according to fixture care guidance',
    ],
    fmo_mappings: [
      {
        feature: 'Induction suitability',
        mechanism: 'The approved fixture positions the pot set for induction cooktops.',
        outcome: 'Buyers can match the set to their hob.',
        use_case: 'Everyday cooking on induction.',
        buyer_relevance: 'Reduces compatibility uncertainty.',
        source_confidence: 'high',
      },
      {
        feature: 'Cool+ handle technology',
        mechanism: 'The fixture frames handle warmth as an expectation-management topic.',
        outcome: 'Buyers understand handle comfort claims need careful wording.',
        use_case: 'Stovetop cooking.',
        buyer_relevance: 'Reduces support questions about handles.',
        source_confidence: 'high',
      },
      {
        feature: 'Steam vent glass lid',
        mechanism: 'The vent helps release steam while the lid remains a practical cooking aid.',
        outcome: 'Buyers understand both the benefit and the limit.',
        use_case: 'Simmering and covered cooking.',
        buyer_relevance: 'Sets realistic lid expectations.',
        source_confidence: 'high',
      },
      {
        feature: 'Dishwasher-suitable care',
        mechanism: 'The fixture allows dishwasher suitability with care guidance.',
        outcome: 'Buyers know how to clean the set without overclaiming.',
        use_case: 'Routine cleanup.',
        buyer_relevance: 'Reduces care uncertainty.',
        source_confidence: 'high',
      },
      {
        feature: 'Not non-stick pot set',
        mechanism: 'The fixture distinguishes stainless steel pots from coated frying pans.',
        outcome: 'Buyers understand eggs and delicate frying may need an added pan.',
        use_case: 'Expectation setting before purchase.',
        buyer_relevance: 'Avoids mismatch with frying-pan needs.',
        source_confidence: 'high',
      },
      {
        feature: 'No frying pan included',
        mechanism: 'The fixture describes this as a pot set rather than a pan set.',
        outcome: 'Buyers know what is included.',
        use_case: 'Set comparison.',
        buyer_relevance: 'Reduces product-scope confusion.',
        source_confidence: 'high',
      },
      {
        feature: 'Pan upsell for eggs',
        mechanism: 'A coated pan can support eggs and gentle frying.',
        outcome: 'Buyers can complete the cookware setup.',
        use_case: 'Eggs and delicate foods.',
        buyer_relevance: 'Supports relevant accessory choice.',
        source_confidence: 'high',
      },
      {
        feature: 'Pan upsell for steak',
        mechanism: 'A searing-oriented pan can support steak and intense searing.',
        outcome: 'Buyers can choose a better match for high-heat frying tasks.',
        use_case: 'Steak and browning.',
        buyer_relevance: 'Supports relevant accessory choice.',
        source_confidence: 'high',
      },
      {
        feature: 'Quality One comparison',
        mechanism: 'The fixture compares Quality One with a simpler pot set style such as Provence Plus.',
        outcome: 'Buyers can evaluate feature differences.',
        use_case: 'Assortment comparison.',
        buyer_relevance: 'Supports decision-making.',
        source_confidence: 'high',
      },
    ],
    benefits_explicit: [
      'Handle warmth expectation guidance is approved fixture knowledge.',
      'Steam vent benefit and limit are approved fixture knowledge.',
      'White spots and discoloration care are approved fixture knowledge.',
      'Rust confusion support is approved fixture knowledge.',
      'Dishwasher care guidance is approved fixture knowledge.',
      'Pan upsell for eggs and gentle frying is approved fixture knowledge.',
      'Pan upsell for steak and intense searing is approved fixture knowledge.',
    ],
    benefits_missing: [],
    warranty_service: [],
    use_cases: [
      'Induction cooking',
      'Dishwasher care',
      'White spot and discoloration care',
      'Rust confusion support',
      'No frying pan included expectation',
      'Eggs and gentle frying pan add-on',
      'Steak and intense searing pan add-on',
      'Quality One versus simpler pot set comparison',
    ],
    claims_flagged: [],
    page_weaknesses: [
      'Oven suitability is not part of this approved fixture.',
      'Frying pan inclusion must not be implied for this pot set.',
      'Professional kitchen positioning is not part of this approved fixture.',
    ],
    knowledgebase_chunks_used: ['approved-fixture:cookware-quality-one-playbook'],
    pko_version: '1.0.0',
    created_at: new Date().toISOString(),
  };
}

describe('Cookware quality fixture readiness', () => {
  it('surfaces supported Quality One cookware FAQ opportunities', () => {
    const pko = createQualityOneCookwareFixture();
    const plan = createFaqPlan(pko, { targetFaqCount: 20 });
    const supportedQuestions = plan.filter((item) => item.supported).map((item) => item.question_draft);

    expect(supportedQuestions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Induktion/i),
        expect.stringMatching(/Cool\+ Griffe|warm.*Griffe/i),
        expect.stringMatching(/Glasdeckel.*Dampföffnung.*Grenzen/i),
        expect.stringMatching(/weiße Flecken|Verfärbungen/i),
        expect.stringMatching(/Fleck.*Rost|Rost/i),
        expect.stringMatching(/Spülmaschine/i),
        expect.stringMatching(/antihaftbeschichtet/i),
        expect.stringMatching(/Bratpfanne enthalten/i),
        expect.stringMatching(/Eier.*schonendes Braten/i),
        expect.stringMatching(/Steak.*intensives Anbraten/i),
        expect.stringMatching(/Quality One.*einfacheren Topfset/i),
      ]),
    );
  });

  it('generates schema-valid cookware fixture FAQs without unsafe cookware claims', () => {
    const pko = createQualityOneCookwareFixture();
    const plan = createFaqPlan(pko, { targetFaqCount: 20 });
    const faqs = generateFromPlan(plan, pko);

    expect(faqs.length).toBeGreaterThanOrEqual(11);

    for (const faq of faqs) {
      expect(() => faqItemSchema.parse(faq)).not.toThrow();
      expect(faq.source_evidence.length).toBeGreaterThan(0);
      expect(faq.answer).not.toMatch(/made in germany|hergestellt in deutschland/i);
      expect(faq.answer).not.toMatch(/never hot|niemals heiß|nie heiß|wird nicht heiß/i);
      expect(faq.answer).not.toMatch(/rust-proof|rostfrei im sinne von rost-proof|rostsicher/i);
      expect(faq.answer).not.toMatch(/scratch-proof|kratzfest/i);
      expect(faq.answer).not.toMatch(/stain-proof|fleckensicher/i);
      expect(faq.answer).not.toMatch(/lifetime durability|lebenslange haltbarkeit/i);
      expect(faq.answer).not.toMatch(/PFAS-free|PFOA-free|PTFE-free|pfas\s*frei|pfoa\s*frei|ptfe\s*frei/i);
      expect(faq.answer).not.toMatch(/oven-safe|backofengeeignet|backofenkompatibel/i);
    }
  });
});
