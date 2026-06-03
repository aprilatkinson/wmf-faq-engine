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
      'Steam vent glass lid helps reduce rattling and boiling over expectations',
      'Pot set expectation: no frying pan included',
      'Cooking job guidance for boiling, simmering, pasta, soups, and sauces',
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
        mechanism: 'The vent helps release steam and can reduce rattling and boiling over expectations.',
        outcome: 'Buyers understand the lid benefit without treating it as a guarantee.',
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
        mechanism: 'The fixture distinguishes stainless steel pots for boiling, simmering, pasta, soups, and sauces from coated frying pans.',
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
      'Steam vent rattling and boiling over expectation guidance is approved fixture knowledge.',
      'White spots and discoloration care are approved fixture knowledge.',
      'Rust confusion support is approved fixture knowledge.',
      'Dishwasher care guidance is approved fixture knowledge.',
      'Boiling, simmering, pasta, soups, and sauces are approved cooking-job guidance.',
      'Pan upsell for eggs and gentle frying is approved fixture knowledge.',
      'Pan upsell for steak and intense searing is approved fixture knowledge.',
    ],
    benefits_missing: [],
    warranty_service: [],
    use_cases: [
      'Induction cooking',
      'Dishwasher care',
      'Boiling, simmering, pasta, soups, and sauces',
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
        'Ist das WMF Quality One Topfset für Induktionsherde geeignet?',
        'Können die Cool+ Griffe beim Kochen trotzdem warm werden?',
        'Hilft der Glasdeckel mit Dampföffnung gegen Klappern und Überkochen?',
        'Warum entstehen weiße Flecken oder Regenbogen-Verfärbungen auf Edelstahl?',
        expect.stringMatching(/Fleck.*Rost|Rost/i),
        'Sollte ich die Töpfe von Hand spülen, obwohl sie spülmaschinengeeignet sind?',
        expect.stringMatching(/antihaftbeschichtet/i),
        'Ist dieses Topfset zum Kochen und Köcheln gedacht oder zum Braten?',
        expect.stringMatching(/Bratpfanne enthalten/i),
        'Welche WMF Pfanne sollte ich für Eier oder schonendes Braten ergänzen?',
        'Welche WMF Pfanne sollte ich für Steak oder intensives Anbraten ergänzen?',
        'Was ist der Unterschied zwischen Quality One und einem einfacheren Edelstahl-Topfset?',
      ]),
    );
  });

  it('does not surface weak or unsupported cookware question phrasing', () => {
    const pko = createQualityOneCookwareFixture();
    const plan = createFaqPlan(pko, { targetFaqCount: 20 });
    const questions = plan.map((item) => item.question_draft).join('\n');

    expect(questions).not.toMatch(/premium cookware|premium-kochgeschirr/i);
    expect(questions).not.toMatch(/good cookware|gutes kochgeschirr/i);
    expect(questions).not.toMatch(/suitable for everyone|für alle geeignet|fuer alle geeignet/i);
    expect(questions).not.toMatch(/professional cookware|professionelles kochgeschirr/i);
    expect(questions).not.toMatch(/never get hot|never hot|nie heiß|niemals heiß/i);
    expect(questions).not.toMatch(/rust-proof|rostsicher/i);
    expect(questions).not.toMatch(/scratch-proof|kratzfest/i);
    expect(questions).not.toMatch(/stain-proof|fleckensicher/i);
    expect(questions).not.toMatch(/made in germany|hergestellt in deutschland/i);
    expect(questions).not.toMatch(/oven-safe|backofengeeignet|backofenkompatibel/i);
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

  it('keeps pot-set questions grounded in cooking jobs and next-best-product logic', () => {
    const pko = createQualityOneCookwareFixture();
    const plan = createFaqPlan(pko, { targetFaqCount: 20 });
    const faqs = generateFromPlan(plan, pko);
    const combinedQuestionsAndEvidence = faqs.map((faq) => `${faq.question} ${faq.source_evidence.join(' ')}`).join('\n');

    expect(combinedQuestionsAndEvidence).toMatch(/Kochen|Köcheln|boiling|simmering|pasta|soups|sauces/i);
    expect(combinedQuestionsAndEvidence).toMatch(/nicht.*antihaft|not non-stick|coated frying pans/i);
    expect(combinedQuestionsAndEvidence).toMatch(/Eier|gentle frying|schonendes Braten/i);
    expect(combinedQuestionsAndEvidence).toMatch(/Steak|intense searing|intensives Anbraten|browning/i);
  });
});
