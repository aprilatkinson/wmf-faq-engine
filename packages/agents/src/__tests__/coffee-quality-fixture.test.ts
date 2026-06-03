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
      'Display and interface guide preparation and cleaning',
      'Cleaning program with automatic rinsing',
      'Descaling reminders',
      'Water quality, water filter, and limescale guidance',
      'Personalization of coffee strength, aroma, milk amount, and temperature',
      'Favorites for saved coffee recipes',
      'App optionality without requiring app use',
      'Multiple user profiles',
      'Quiet grinding and reduced vibration for open kitchen noise expectations',
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
        feature: 'Display and guided interface',
        mechanism: 'The display guides coffee preparation and cleaning prompts.',
        outcome: 'Makes everyday operation easier to understand.',
        use_case: 'Daily home use and maintenance.',
        buyer_relevance: 'Reduces review anxiety about ease of use.',
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
        mechanism: 'Water quality and filter use influence limescale buildup and taste expectations.',
        outcome: 'Helps buyers optimize coffee quality.',
        use_case: 'Setup and ongoing care.',
        buyer_relevance: 'Supports better daily results.',
        source_confidence: 'high',
      },
      {
        feature: 'Personalization and favorites',
        mechanism: 'Coffee strength, aroma, milk amount, temperature, and favorite settings help repeat preferred drinks.',
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
        mechanism: 'User profiles and saved favorite drinks help separate preferences.',
        outcome: 'Different household members can keep preferred settings distinct.',
        use_case: 'Shared kitchens.',
        buyer_relevance: 'Supports multi-user households.',
        source_confidence: 'high',
      },
      {
        feature: 'Quiet grinding and reduced vibration',
        mechanism: 'Noise during grinding and brewing is an open-kitchen buying concern.',
        outcome: 'Helps buyers set realistic expectations about sound during use.',
        use_case: 'Open kitchens and shared living spaces.',
        buyer_relevance: 'Reduces review anxiety about machine noise.',
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
      'Display guidance supports coffee preparation and cleaning support questions.',
      'Coffee strength, aroma, milk amount, and temperature personalization are supported buyer questions in this approved fixture.',
      'Cleaning and automatic rinsing reduce uncertainty about daily care.',
      'Descaling, filtered water, water quality, and limescale guidance support consistent operation.',
      'Favorites and multiple users support household personalization.',
      'Quiet grinding and reduced vibration support open kitchen and noise expectation questions.',
      'Fresh grinding helps buyers understand beans and aroma expectations.',
      'Cups, filters, and accessories help optimize everyday use.',
    ],
    benefits_missing: [],
    warranty_service: [],
    use_cases: [
      'Everyday home use',
      'Milk drinks and temperature expectation support',
      'Display-guided preparation and cleaning',
      'Cleaning, rinsing, and descaling support',
      'Filtered water, water quality, and limescale optimization',
      'Personalization for multiple users',
      'Open kitchen noise expectation support',
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
        expect.stringMatching(/täglichen Gebrauch zu Hause/i),
        expect.stringMatching(/leicht zu bedienen/i),
        expect.stringMatching(/Display.*Kaffeezubereitung.*Reinigung/i),
        expect.stringMatching(/Kaffeestärke.*Aroma.*Milchmenge.*Temperatur/i),
        expect.stringMatching(/Lieblings-Kaffeerezepte speichern/i),
        expect.stringMatching(/mehrere Personen.*Lieblingsgetränke/i),
        expect.stringMatching(/App.*benutzen/i),
        expect.stringMatching(/laut.*Mahlen.*Brühen/i),
        expect.stringMatching(/offenen Küche.*zu laut/i),
        expect.stringMatching(/gefiltertes Wasser/i),
        expect.stringMatching(/Wasserqualität.*Geschmack.*Kalkbildung/i),
        expect.stringMatching(/Milchschaum.*kühler.*schwarzer Kaffee/i),
        expect.stringMatching(/Reinigung.*Spülen.*Entkalken/i),
        expect.stringMatching(/Kaffeebohnen.*frisches Mahlen/i),
        expect.stringMatching(/Zubehörteile.*Optimierung/i),
      ]),
    );
  });

  it('does not surface weak or disconnected coffee strategy questions', () => {
    const pko = createCoffeePkoFixture();
    const plan = createFaqPlan(pko, { targetFaqCount: 20 });
    const questions = plan.map((item) => item.question_draft).join('\n');

    expect(questions).not.toMatch(/professional gastronomy|professionelle gastronomie/i);
    expect(questions).not.toMatch(/beginner-friendly|anfängerfreundlich/i);
    expect(questions).not.toMatch(/coffee enthusiasts|kaffeeenthusiasten/i);
    expect(questions).not.toMatch(/why is quieter operation important|warum ist.*leiser betrieb.*wichtig/i);
    expect(questions).not.toMatch(/suitable for open kitchens|geeignet für offene küchen/i);
    expect(questions).not.toMatch(/does water quality influence coffee taste|beeinflusst wasserqualität den kaffeegeschmack/i);
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
