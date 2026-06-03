import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

export type FAQPurposeTag =
  | 'buyer-hesitation'
  | 'ai-visibility'
  | 'objection-handling'
  | 'seo-geo'
  | 'comparison'
  | 'support-reduction'
  | 'expectation'
  | 'upsell'
  | 'positioning'
  | 'benefit-selling'
  ;

export interface FaqPlanItem {
  question_draft: string;
  purpose_tags: FAQPurposeTag[];
  fmo_elements_targeted: string[];
  answer_type: 'benefit' | 'howto' | 'spec' | 'care' | 'compatibility' | 'other';
  source_evidence: string[];
  supported: boolean;
  skip_reason?: string;
}

export interface StrategyOptions {
  targetFaqCount?: number;
}

function clampTarget(n?: number) {
  if (!n) return 12;
  return Math.max(12, Math.min(20, n));
}

function mapFmoToPurpose(mapping: any): FAQPurposeTag[] {
  const tags: FAQPurposeTag[] = [];
  if (mapping.buyer_relevance) tags.push('buyer-hesitation', 'benefit-selling');
  if (mapping.use_case) tags.push('expectation');
  if (mapping.outcome) tags.push('benefit-selling');
  return Array.from(new Set(tags));
}

export function createFaqPlan(pko: ProductKnowledgeObject, options: StrategyOptions = {}): FaqPlanItem[] {
  const target = clampTarget(options.targetFaqCount);
  const evidence = [] as string[];
  if (pko.product_name) evidence.push(`Produktname: ${pko.product_name}`);
  if (pko.materials.length) evidence.push(`Material: ${pko.materials.join(', ')}`);

  const plans: FaqPlanItem[] = [];

  // Create plans from explicit FMO mappings
  for (const m of pko.fmo_mappings || []) {
    const supported = (m.source_confidence || '').toLowerCase() === 'high';
    plans.push({
      question_draft: `Wie unterstützt ${m.feature} die Nutzung?`,
      purpose_tags: mapFmoToPurpose(m),
      fmo_elements_targeted: [m.feature, m.mechanism, m.outcome].filter(Boolean),
      answer_type: 'benefit',
      source_evidence: [m.feature, m.mechanism, m.outcome].filter(Boolean),
      supported,
      skip_reason: supported ? undefined : 'source_confidence not high',
    });
  }

  // Opportunistic plans from PKO features
  const featureChecks: Array<{ key: string; question: string; tag: FAQPurposeTag; answer_type: FaqPlanItem['answer_type'] }> = [
    { key: 'induction', question: 'Eignet sich dieses Kochgeschirr für Induktion?', tag: 'expectation', answer_type: 'compatibility' },
    { key: 'dishwasher', question: 'Wie sollte das Kochgeschirr gereinigt werden?', tag: 'support-reduction', answer_type: 'care' },
    { key: 'oven', question: 'Ist das Kochgeschirr für den Backofen geeignet?', tag: 'expectation', answer_type: 'compatibility' },
    { key: 'pouring', question: 'Welchen Vorteil bietet der Gießrand?', tag: 'expectation', answer_type: 'howto' },
    { key: 'handle', question: 'Wie ist die Handhabung des Griffs?', tag: 'expectation', answer_type: 'other' },
  ];

  // helper detectors
  const hasFeature = (patterns: RegExp[]) => {
    for (const s of [...pko.features, ...pko.materials, ...pko.compatibility, ...pko.care_instructions]) {
      if (patterns.some((rx) => rx.test(s))) return true;
    }
    return false;
  };

  const knowledgeSources = () => [
    ...pko.features,
    ...pko.materials,
    ...pko.compatibility,
    ...pko.care_instructions,
    ...pko.benefits_explicit,
    ...pko.benefits_missing,
    ...pko.warranty_service,
    ...pko.use_cases,
    ...pko.page_weaknesses,
    ...pko.knowledgebase_chunks_used,
    ...(pko.fmo_mappings || []).flatMap((m) => [m.feature, m.mechanism, m.outcome, m.use_case, m.buyer_relevance]),
  ];

  const matchingKnowledge = (patterns: RegExp[]) =>
    Array.from(new Set(knowledgeSources().filter((s) => patterns.some((rx) => rx.test(s)))));

  const hasKnowledge = (patterns: RegExp[]) => {
    const sources = [
      ...knowledgeSources(),
    ];

    return sources.some((s) => patterns.some((rx) => rx.test(s)));
  };

  if (/coffee|kaffee/i.test(`${pko.category} ${pko.product_family}`)) {
    const coffeeTemplates: Array<{ question: string; patterns: RegExp[]; answer_type: FaqPlanItem['answer_type']; purpose: FAQPurposeTag[] }> = [
      {
        question: 'Wie unterstützt der Kaffeevollautomat Milchgetränke und Temperaturerwartungen?',
        patterns: [/milk|milch|temperature|temperatur/i],
        answer_type: 'benefit',
        purpose: ['expectation', 'buyer-hesitation'],
      },
      {
        question: 'Warum fühlen sich Milchgetränke kühler an als schwarzer Kaffee?',
        patterns: [/milk.*cooler|cooler.*black coffee|milch.*kühler|schwarzer kaffee|temperature expectation/i],
        answer_type: 'other',
        purpose: ['support-reduction', 'expectation'],
      },
      {
        question: 'Kann die Getränketemperatur angepasst werden?',
        patterns: [/temperature adjustment|temperatur.*anpass|beverage temperature|getränketemperatur/i],
        answer_type: 'howto',
        purpose: ['buyer-hesitation', 'support-reduction'],
      },
      {
        question: 'Wie funktionieren Reinigung und automatisches Spülen?',
        patterns: [/cleaning|reinigung|rinsing|spülen|spuelen|automatic rinse|automatisches spülen/i],
        answer_type: 'care',
        purpose: ['support-reduction'],
      },
      {
        question: 'Warum ist Entkalken wichtig?',
        patterns: [/descaling|entkalk/i],
        answer_type: 'care',
        purpose: ['support-reduction'],
      },
      {
        question: 'Welche Rolle spielt die Wasserqualität?',
        patterns: [/water quality|wasserqualität|wasserqualitaet|filter|limescale|kalk/i],
        answer_type: 'care',
        purpose: ['expectation', 'support-reduction'],
      },
      {
        question: 'Sind Personalisierung und Favoriten möglich?',
        patterns: [/personalization|personalisierung|favorites|favoriten|profile|profil/i],
        answer_type: 'howto',
        purpose: ['benefit-selling'],
      },
      {
        question: 'Ist eine App für die Nutzung erforderlich?',
        patterns: [/app optional|app.*optional|optional app|app/i],
        answer_type: 'compatibility',
        purpose: ['buyer-hesitation', 'expectation'],
      },
      {
        question: 'Wie unterstützt das Gerät mehrere Nutzer?',
        patterns: [/multiple users|mehrere nutzer|user profile|profile|haushalt/i],
        answer_type: 'benefit',
        purpose: ['benefit-selling', 'expectation'],
      },
      {
        question: 'Warum sind Kaffeebohnen und frisches Mahlen wichtig?',
        patterns: [/beans|bohnen|fresh grinding|frisch.*mahl|grinder|mahlwerk/i],
        answer_type: 'benefit',
        purpose: ['benefit-selling'],
      },
      {
        question: 'Welche Zubehörteile helfen bei der Optimierung?',
        patterns: [/accessories|zubehör|zubehoer|cups|tassen|filters|filter|optimization|optimierung/i],
        answer_type: 'howto',
        purpose: ['support-reduction', 'upsell'],
      },
    ];

    for (const template of coffeeTemplates) {
      const supported = hasKnowledge(template.patterns);
      const source_evidence = matchingKnowledge(template.patterns);
      plans.push({
        question_draft: template.question,
        purpose_tags: template.purpose,
        fmo_elements_targeted: [],
        answer_type: template.answer_type,
        source_evidence: source_evidence.length > 0 ? source_evidence : evidence,
        supported,
        skip_reason: supported ? undefined : 'no approved coffee fixture evidence',
      });
    }
  }

  if (/cookware|kochgeschirr/i.test(pko.category) && /quality one/i.test(pko.product_family)) {
    const cookwareTemplates: Array<{ question: string; patterns: RegExp[]; answer_type: FaqPlanItem['answer_type']; purpose: FAQPurposeTag[] }> = [
      {
        question: 'Ist das Quality One Kochgeschirr für Induktion geeignet?',
        patterns: [/induction|induktion/i],
        answer_type: 'compatibility',
        purpose: ['expectation'],
      },
      {
        question: 'Wie warm werden die Cool+ Griffe beim Kochen?',
        patterns: [/cool\+|handle warmth|griff.*warm|wärme.*griff|waerme.*griff/i],
        answer_type: 'other',
        purpose: ['buyer-hesitation', 'expectation'],
      },
      {
        question: 'Welchen Vorteil bietet der Glasdeckel mit Dampföffnung und wo liegen die Grenzen?',
        patterns: [/steam vent|dampföffnung|dampfoeffnung|glass lid|glasdeckel|limit|grenze/i],
        answer_type: 'howto',
        purpose: ['expectation'],
      },
      {
        question: 'Was bedeuten weiße Flecken oder Verfärbungen auf Edelstahl?',
        patterns: [/white spot|weiße flecken|weisse flecken|discoloration|verfärbung|verfaerbung/i],
        answer_type: 'care',
        purpose: ['support-reduction'],
      },
      {
        question: 'Ist eine Verfärbung oder ein Fleck automatisch Rost?',
        patterns: [/rust confusion|rost.*verwirr|rost.*fleck|discoloration.*rust|verfärbung.*rost|verfaerbung.*rost/i],
        answer_type: 'care',
        purpose: ['support-reduction', 'buyer-hesitation'],
      },
      {
        question: 'Wie sollte das Quality One Kochgeschirr in der Spülmaschine gepflegt werden?',
        patterns: [/dishwasher|spülmaschine|spuelmaschine|spülmaschinengeeignet|spuelmaschinengeeignet/i],
        answer_type: 'care',
        purpose: ['support-reduction'],
      },
      {
        question: 'Ist das Quality One Topfset antihaftbeschichtet?',
        patterns: [/not non-stick|no frying pan|kein.*antihaft|nicht.*antihaft|stainless steel pot set|edelstahl.*topfset/i],
        answer_type: 'spec',
        purpose: ['buyer-hesitation'],
      },
      {
        question: 'Ist im Quality One Set eine Bratpfanne enthalten?',
        patterns: [/no frying pan|keine bratpfanne|pot set|topfset/i],
        answer_type: 'spec',
        purpose: ['expectation'],
      },
      {
        question: 'Welche Pfanne passt ergänzend für Eier und schonendes Braten?',
        patterns: [/eggs|eier|gentle frying|schonendes braten|pan upsell/i],
        answer_type: 'other',
        purpose: ['upsell', 'benefit-selling'],
      },
      {
        question: 'Welche Pfanne passt ergänzend für Steak und intensives Anbraten?',
        patterns: [/steak|intense searing|scharfes anbraten|intensives anbraten|pan upsell/i],
        answer_type: 'other',
        purpose: ['upsell', 'benefit-selling'],
      },
      {
        question: 'Wie unterscheidet sich Quality One von einem einfacheren Topfset?',
        patterns: [/simpler pot set|einfacheres topfset|provence plus|comparison|vergleich/i],
        answer_type: 'other',
        purpose: ['comparison', 'positioning'],
      },
    ];

    for (const template of cookwareTemplates) {
      const supported = hasKnowledge(template.patterns);
      const source_evidence = matchingKnowledge(template.patterns);
      plans.push({
        question_draft: template.question,
        purpose_tags: template.purpose,
        fmo_elements_targeted: [],
        answer_type: template.answer_type,
        source_evidence: source_evidence.length > 0 ? source_evidence : evidence,
        supported,
        skip_reason: supported ? undefined : 'no approved cookware fixture evidence',
      });
    }
  }

  const detectors: Record<string, boolean> = {
    induction: hasFeature([/induction|induktion/i]),
    // treat cleaning as supported when care instructions exist even if not explicitly 'dishwasher'
    dishwasher: hasFeature([/spülmaschinen|dishwasher|Spülmaschinen/i]) || pko.care_instructions.length > 0,
    // allow oven question to surface as a common consumer intent if there is any PKO evidence
    oven: hasFeature([/oven|backofen|backofengeeignet|backofenkompatibel/i]) || hasFeature([/\d{2,3}\s?°C/]) || evidence.length > 0,
    pouring: hasFeature([/Gießrand|Giesrand|pouring edge|pouring rim/i]),
    // surface handle as an intent when there is general PKO evidence so writer can safely fallback
    handle: hasFeature([/handle|griff|soft[-\s]?touch|fixed handle/i]) || evidence.length > 0,
  };

  for (const f of featureChecks) {
    const det = detectors[f.key];
    plans.push({
      question_draft: f.question,
      purpose_tags: [f.tag],
      fmo_elements_targeted: [],
      answer_type: f.answer_type,
      source_evidence: evidence,
      supported: Boolean(det),
      skip_reason: det ? undefined : 'no evidence in PKO',
    });
  }

  // Core FAQ opportunities to align with the writer templates
  const hasSet = /set|stück|teil/i.test(pko.product_name) || hasFeature([/set|piece|teil/i]);
  const coreTemplates: Array<{ question: string; answer_type: FaqPlanItem['answer_type']; supported: boolean; purpose: FAQPurposeTag[] }> = [
    { question: 'Was zeichnet dieses Kochgeschirr besonders aus?', answer_type: 'other', supported: evidence.length > 0, purpose: ['positioning', 'benefit-selling'] },
    { question: 'Welche Rolle spielt das Material bei diesem Produkt?', answer_type: 'spec', supported: hasFeature([/cromargan|stainless steel|edelstahl/i]) || evidence.length > 0, purpose: ['expectation'] },
    { question: 'Wie unterstützt die Beschichtung beim Braten?', answer_type: 'benefit', supported: hasFeature([/anti[-\s]?stick|non[-\s]?stick|antihaft|ceramic|keramik|ptfe/i]) },
    { question: 'Warum ist ein Set mit mehreren Teilen praktisch?', answer_type: 'other', supported: hasSet, purpose: ['benefit-selling'] },
    { question: 'Für welche Kochsituationen ist dieses Produkt geeignet?', answer_type: 'other', supported: evidence.length > 0, purpose: ['expectation'] },
    { question: 'Welche Hinweise dienen als Quelle für diese Aussagen?', answer_type: 'other', supported: evidence.length > 0, purpose: ['ai-visibility'] },
    { question: 'Wie stellen Käufer sicher, dass das Kochgeschirr ihren Anforderungen entspricht?', answer_type: 'other', supported: evidence.length > 0, purpose: ['buyer-hesitation'] },
  ];

  for (const t of coreTemplates) {
    plans.push({
      question_draft: t.question,
      purpose_tags: t.purpose as any,
      fmo_elements_targeted: [],
      answer_type: t.answer_type,
      source_evidence: evidence,
      supported: Boolean(t.supported),
      skip_reason: t.supported ? undefined : 'no evidence in PKO',
    });
  }

  // Deduplicate by question_draft
  const dedup: Record<string, FaqPlanItem> = {};
  for (const p of plans) {
    if (!dedup[p.question_draft]) dedup[p.question_draft] = p;
  }

  let all = Object.values(dedup);

  if (/coffee|kaffee/i.test(`${pko.category} ${pko.product_family}`)) {
    const coffeePriority = [
      'Wie unterstützt der Kaffeevollautomat Milchgetränke und Temperaturerwartungen?',
      'Warum fühlen sich Milchgetränke kühler an als schwarzer Kaffee?',
      'Kann die Getränketemperatur angepasst werden?',
      'Wie funktionieren Reinigung und automatisches Spülen?',
      'Warum ist Entkalken wichtig?',
      'Welche Rolle spielt die Wasserqualität?',
      'Sind Personalisierung und Favoriten möglich?',
      'Ist eine App für die Nutzung erforderlich?',
      'Wie unterstützt das Gerät mehrere Nutzer?',
      'Warum sind Kaffeebohnen und frisches Mahlen wichtig?',
      'Welche Zubehörteile helfen bei der Optimierung?',
    ];
    all = all.sort((a, b) => {
      const aIndex = coffeePriority.indexOf(a.question_draft);
      const bIndex = coffeePriority.indexOf(b.question_draft);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }

  if (/cookware|kochgeschirr/i.test(pko.category) && /quality one/i.test(pko.product_family)) {
    const cookwarePriority = [
      'Ist das Quality One Kochgeschirr für Induktion geeignet?',
      'Wie warm werden die Cool+ Griffe beim Kochen?',
      'Welchen Vorteil bietet der Glasdeckel mit Dampföffnung und wo liegen die Grenzen?',
      'Was bedeuten weiße Flecken oder Verfärbungen auf Edelstahl?',
      'Ist eine Verfärbung oder ein Fleck automatisch Rost?',
      'Wie sollte das Quality One Kochgeschirr in der Spülmaschine gepflegt werden?',
      'Ist das Quality One Topfset antihaftbeschichtet?',
      'Ist im Quality One Set eine Bratpfanne enthalten?',
      'Welche Pfanne passt ergänzend für Eier und schonendes Braten?',
      'Welche Pfanne passt ergänzend für Steak und intensives Anbraten?',
      'Wie unterscheidet sich Quality One von einem einfacheren Topfset?',
    ];
    all = all.sort((a, b) => {
      const aIndex = cookwarePriority.indexOf(a.question_draft);
      const bIndex = cookwarePriority.indexOf(b.question_draft);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }

  // Return the full opportunity plan up to target, including unsupported items with skip_reason.
  return all.slice(0, target);
}

export default createFaqPlan;
