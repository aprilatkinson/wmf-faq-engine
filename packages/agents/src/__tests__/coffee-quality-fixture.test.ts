import { describe, expect, it } from 'vitest';
import { createFaqPlan } from '../faq-strategy/faq-strategy';
import { generateFromPlan } from '../faq-writer/faq-writer';
import { evaluateClaimRisk } from '../evaluators/claim-risk';
import { faqItemSchema } from '../../../core/src/schemas/faq.schema';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

function createCoffeePkoFixture(): ProductKnowledgeObject {
  return {
    pko_id: 'pko-coffee-quality-fixture',
    source_url: '',
    product_name: 'Approved Fixture Fully Automatic Coffee Machine',
    category: 'Coffee',
    product_family: 'Fully Automatic Coffee Machines',
    source_language_detected: 'de',
    source_language_confidence: 1,
    features: [
      'Milk drinks with temperature expectation guidance',
      'Milk foam texture settings',
      'Cleaning program with automatic rinsing',
      'Descaling reminders',
      'Water quality and filter guidance',
      'Personalization and favorites',
      'App optionality without requiring app use',
      'Multiple user profiles',
      'Fresh grinding for coffee beans',
      'Cups, filters, and accessories for optimization',
    ],
    materials: [],
    compatibility: [],
    care_instructions: [
      'Use approved cleaning and automatic rinsing programs as fixture guidance.',
      'Descale when prompted and use water quality guidance to reduce limescale.',
    ],
    fmo_mappings: [
      {
        feature: 'Milk drinks and temperature expectations',
        mechanism: 'Milk is added to coffee and can make milk drinks feel cooler than black coffee.',
        outcome: 'Sets realistic expectations without stating exact degrees.',
        use_case: 'Cappuccino, latte macchiato, and flat white.',
        buyer_relevance: 'Reduces support questions about milk temperature.',
        source_confidence: 'high',
      },
      {
        feature: 'Milk foam texture settings',
        mechanism: 'Fixture knowledge explains texture as a configurable quality cue.',
        outcome: 'Helps buyers understand foam quality without overclaiming.',
        use_case: 'Milk-based drinks.',
        buyer_relevance: 'Supports drink-quality expectations.',
        source_confidence: 'high',
      },
      {
        feature: 'Cleaning and automatic rinsing',
        mechanism: 'Automatic rinsing supports regular maintenance.',
        outcome: 'Helps keep the milk and coffee system clean.',
        use_case: 'Daily machine care.',
        buyer_relevance: 'Reduces cleaning uncertainty.',
        source_confidence: 'high',
      },
      {
        feature: 'Descaling',
        mechanism: 'Descaling removes limescale buildup when prompted.',
        outcome: 'Supports consistent operation over time.',
        use_case: 'Periodic care.',
        buyer_relevance: 'Clarifies maintenance responsibility.',
        source_confidence: 'high',
      },
      {
        feature: 'Water quality',
        mechanism: 'Water quality and filter use influence limescale and taste expectations.',
        outcome: 'Helps buyers optimize coffee quality.',
        use_case: 'Setup and ongoing care.',
        buyer_relevance: 'Supports better daily results.',
        source_confidence: 'high',
      },
      {
        feature: 'Personalization and favorites',
        mechanism: 'Favorite settings help repeat preferred drinks.',
        outcome: 'Makes repeated drink preparation more convenient.',
        use_case: 'Daily household coffee routines.',
        buyer_relevance: 'Supports individual preferences.',
        source_confidence: 'high',
      },
      {
        feature: 'App optionality',
        mechanism: 'Fixture guidance positions the app as optional.',
        outcome: 'Buyers know the machine can be used without an app dependency.',
        use_case: 'Households that prefer direct machine controls.',
        buyer_relevance: 'Reduces app-dependency concerns.',
        source_confidence: 'high',
      },
      {
        feature: 'Multiple users',
        mechanism: 'User profiles help separate preferences.',
        outcome: 'Different household members can keep preferred settings distinct.',
        use_case: 'Shared kitchens.',
        buyer_relevance: 'Supports multi-user households.',
        source_confidence: 'high',
      },
      {
        feature: 'Coffee beans and fresh grinding',
        mechanism: 'Fresh grinding uses whole beans shortly before brewing.',
        outcome: 'Supports aroma and freshness expectations.',
        use_case: 'Everyday coffee preparation.',
        buyer_relevance: 'Helps buyers choose suitable beans.',
        source_confidence: 'high',
      },
      {
        feature: 'Cups, filters, and accessories',
        mechanism: 'Compatible accessories support setup and optimization.',
        outcome: 'Helps buyers improve everyday use without unsupported performance claims.',
        use_case: 'Care, serving, and optimization.',
        buyer_relevance: 'Supports accessory planning.',
        source_confidence: 'high',
      },
    ],
    benefits_explicit: [
      'Milk drinks can feel cooler than black coffee because milk changes the perceived drink temperature.',
      'Beverage temperature adjustment is a supported buyer question in this approved fixture.',
      'Cleaning and automatic rinsing reduce uncertainty about daily care.',
      'Descaling and water quality guidance support consistent operation.',
      'Favorites and multiple users support household personalization.',
      'Fresh grinding helps buyers understand beans and aroma expectations.',
      'Cups, filters, and accessories help optimize everyday use.',
    ],
    benefits_missing: [],
    warranty_service: [],
    use_cases: [
      'Milk drinks and temperature expectation support',
      'Cleaning, rinsing, and descaling support',
      'Water quality optimization',
      'Personalization for multiple users',
      'Coffee beans and fresh grinding',
      'Accessories and filters optimization',
    ],
    claims_flagged: [],
    page_weaknesses: [
      'Do not state exact milk temperature degrees.',
      'Do not claim repairability duration or warranty duration.',
      'Do not claim app or Wi-Fi functionality unless explicitly supported.',
      'Do not position as professional gastronomy equipment.',
      'Do not invent energy use or safety certification claims.',
    ],
    knowledgebase_chunks_used: ['approved-fixture:coffee-machine-quality-playbook'],
    pko_version: '1.0.0',
    created_at: new Date().toISOString(),
  };
}

describe('Coffee-machine quality fixture readiness', () => {
  it('surfaces supported coffee-machine minimum quality FAQ opportunities', () => {
    const pko = createCoffeePkoFixture();
    const plan = createFaqPlan(pko, { targetFaqCount: 20 });
    const supportedQuestions = plan.filter((item) => item.supported).map((item) => item.question_draft);

    expect(supportedQuestions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Milchgetränke.*Temperaturerwartungen/i),
        expect.stringMatching(/Milchgetränke kühler.*schwarzer Kaffee/i),
        expect.stringMatching(/Getränketemperatur angepasst/i),
        expect.stringMatching(/Reinigung.*automatisches Spülen/i),
        expect.stringMatching(/Entkalken/i),
        expect.stringMatching(/Wasserqualität/i),
        expect.stringMatching(/Personalisierung.*Favoriten/i),
        expect.stringMatching(/App.*erforderlich/i),
        expect.stringMatching(/mehrere Nutzer/i),
        expect.stringMatching(/Kaffeebohnen.*frisches Mahlen/i),
        expect.stringMatching(/Zubehörteile.*Optimierung/i),
      ]),
    );
  });

  it('generates schema-valid coffee fixture FAQs without unsafe coffee or electronics claims', () => {
    const pko = createCoffeePkoFixture();
    const plan = createFaqPlan(pko, { targetFaqCount: 20 });
    const faqs = generateFromPlan(plan, pko);

    expect(faqs.length).toBeGreaterThanOrEqual(10);

    for (const faq of faqs) {
      expect(() => faqItemSchema.parse(faq)).not.toThrow();
      expect(faq.source_evidence.length).toBeGreaterThan(0);
      expect(evaluateClaimRisk(faq).pass).toBe(true);
      expect(faq.answer).not.toMatch(/\b\d{2,3}\s?(?:°|grad|degrees?|celsius)\b/i);
      expect(faq.answer).not.toMatch(/repairable|reparierbar|15\s?year|15\s?jahre|warranty|garantie/i);
      expect(faq.answer).not.toMatch(/wi[-\s]?fi|wlan/i);
      expect(faq.answer).not.toMatch(/professional|professionell|gastronomy|gastronomie/i);
      expect(faq.answer).not.toMatch(/energy use|energieverbrauch|energy efficiency|energieeffizienz/i);
      expect(faq.answer).not.toMatch(/safety certification|sicherheitszertifizierung|certified safe|zertifiziert sicher/i);
    }
  });
});
