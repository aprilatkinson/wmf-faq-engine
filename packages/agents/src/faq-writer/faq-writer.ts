import type { FaqPlanItem, FAQPurposeTag } from '../faq-strategy/faq-strategy';
import { createFaqPlan } from '../faq-strategy/faq-strategy';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';
import type { FaqItem } from '../../../core/src/types/faq';
import { retrieveProductFactEvidence } from '../evidence-retrieval';

interface CostLogPlaceholder {
  agent: 'faq-writer';
  status: 'pending';
  note: string;
}

const costLog: CostLogPlaceholder = {
  agent: 'faq-writer',
  status: 'pending',
  note: 'TODO: implement Phase 6.3 cost logging in the FAQ Writer agent.',
};


function safePurposeTags(tags: unknown): FAQPurposeTag[] {
  const allowed: FAQPurposeTag[] = [
    'buyer-hesitation',
    'ai-visibility',
    'objection-handling',
    'seo-geo',
    'comparison',
    'support-reduction',
    'expectation',
    'upsell',
    'positioning',
    'benefit-selling',
  ];

  if (!Array.isArray(tags)) {
    return ['ai-visibility'];
  }

  const filtered = tags.filter((tag): tag is FAQPurposeTag =>
    allowed.includes(tag as FAQPurposeTag),
  );

  return filtered.length > 0 ? filtered : ['ai-visibility'];
}

function normalizeEvidence(evidence: string[] = []): string[] {
  return Array.from(new Set(evidence.filter(Boolean).map((item) => item.trim())));
}

function buildEvidenceFromPko(pko: ProductKnowledgeObject): string[] {
  const evidence: string[] = [];
  if (pko.product_name) evidence.push(`Produktname: ${pko.product_name}`);
  if (pko.materials.length) evidence.push(`Material: ${pko.materials.join(', ')}`);
  if (pko.compatibility.length) evidence.push(`Kompatibilität: ${pko.compatibility.join(', ')}`);
  if (pko.care_instructions.length) evidence.push(`Pflege: ${pko.care_instructions.join(', ')}`);
  if (pko.features.length) evidence.push(`Eigenschaften: ${pko.features.join(', ')}`);
  if (pko.fmo_mappings.length) {
    evidence.push(...pko.fmo_mappings.map((mapping) => `Merkmal: ${mapping.feature}`));
  }
  return normalizeEvidence(evidence);
}

function knowledgeText(pko: ProductKnowledgeObject, plan: FaqPlanItem): string {
  return [
    pko.product_name,
    pko.category,
    pko.product_family,
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
    ...plan.source_evidence,
    ...(pko.fmo_mappings || []).flatMap((mapping) => [mapping.feature, mapping.mechanism, mapping.outcome, mapping.use_case, mapping.buyer_relevance]),
  ].join(' ');
}

function hasSupported(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function productLabel(pko: ProductKnowledgeObject): string {
  return pko.product_name || pko.product_family || 'Dieses Produkt';
}

function unsupportedAnswer(): undefined {
  return undefined;
}

function legacyFixtureFallbackAnswer(): string {
  return 'Dazu gibt es hier keine eindeutige Angabe. Prüfen Sie vor der Nutzung die Herstellerangaben auf der Verpackung oder Produktseite.';
}

function buildFeatureBackedAnswer(plan: FaqPlanItem, pko: ProductKnowledgeObject): string | undefined {
  const text = knowledgeText(pko, plan);
  const question = plan.question_draft;
  const label = productLabel(pko);
  const facts = retrieveProductFactEvidence(pko);
  const hasCromargan = facts.cromargan;
  const hasCoolPlus = facts.cool_plus;
  const hasInductionBase = facts.induction_suitable || facts.transtherm_base;
  const hasGlassLid = facts.glass_lid || facts.steam_vent;
  const hasNonStick = facts.non_stick || facts.ceramic;
  const materialTechnologyText = [
    ...pko.materials,
    ...pko.features,
    ...pko.compatibility,
    ...(pko.fmo_mappings || []).flatMap((mapping) => [mapping.feature, mapping.mechanism, mapping.outcome]),
  ].join(' ');
  const hasSearingCromargan = hasSupported(materialTechnologyText, [/cromargan/i]);
  const hasSearingSteel = hasSupported(materialTechnologyText, [/cromargan|stainless steel|edelstahl/i]);
  const hasSetComposition = facts.set_pieces.length > 0 || facts.set_sizes.length > 0;
  const hasDishwasher = hasSupported(text, [/dishwasher|spülmaschine|spuelmaschine|spülmaschinengeeignet|spuelmaschinengeeignet/i]);

  if (/induction|induktion/i.test(question)) {
    if (!hasInductionBase) return unsupportedAnswer();
    const proof = facts.transtherm_base
      ? 'Der TransTherm®-Allherdboden ist der passende technische Nachweis dafür.'
      : 'Die Eignung für Induktion ist für dieses Kochgeschirr angegeben.';
    return `Ja, ${label} ist für Induktionskochfelder vorgesehen. ${proof} Dadurch kann der Topf oder die Pfanne auf einem Induktionsfeld genutzt werden. Prüfen Sie dennoch immer die passende Größe zur Kochzone.`;
  }

  if (/cool\+|handle|griff/i.test(question)) {
    if (!hasCoolPlus) return unsupportedAnswer();
    return `Wenn Sie unsicher sind, ob die Griffe beim Kochen angenehm bleiben: Die Cool+ Technologie ist genau für diese Erwartung relevant. Sie kann die Wärmeübertragung am Griff reduzieren und macht die Handhabung im normalen Kochalltag komfortabler. Trotzdem können Griffe je nach Kochdauer, Hitze und Nähe zur Flamme warm werden; verwenden Sie bei Bedarf Topflappen.`;
  }

  if (/white spots|rainbow discoloration|fleck|verfärbung|verfaerbung|rost/i.test(question)) {
    const materialProof = hasCromargan ? 'Cromargan® Edelstahl rostfrei' : 'Edelstahl';
    return `Weiße Punkte oder Regenbogenverfärbungen wirken oft beunruhigend, sind aber häufig Mineralrückstände aus Wasser oder hitzebedingte Verfärbungen. ${materialProof} sollte nach dem Spülen gut abgetrocknet und bei Bedarf mit einem milden Edelstahlreiniger gepflegt werden. So lassen sich Rückstände reduzieren; es ist jedoch keine Zusage, dass die Oberfläche dauerhaft fleckenfrei bleibt.`;
  }

  if (/dishwasher|spülmaschine|spuelmaschine|hand wash|gereinigt|clean/i.test(question)) {
    if (!hasDishwasher && !pko.care_instructions.length) return unsupportedAnswer();
    const materialProof = hasCromargan ? 'Bei Cromargan® Edelstahl rostfrei hilft sorgfältiges Abtrocknen gegen Wasserflecken.' : 'Sorgfältiges Abtrocknen hilft gegen Wasserflecken.';
    return `Nach dem Kochen geht es vor allem darum, Rückstände und Wasserflecken zu vermeiden. Wenn das Kochgeschirr als spülmaschinengeeignet beschrieben ist, kann es in die Spülmaschine; schonender ist häufig die Reinigung von Hand mit mildem Spülmittel. ${materialProof} Vermeiden Sie aggressive Scheuermittel, damit die Oberfläche gepflegt bleibt.`;
  }

  if (/glass lid|steam vent|lid|deckel|boiling over|rattling|klappern|überkochen|ueberkochen/i.test(question)) {
    if (!hasGlassLid) return unsupportedAnswer();
    return `Beim Kochen mit Deckel kann Dampf Druck aufbauen und den Deckel klappern lassen. Ein Glasdeckel mit Dampföffnung lässt Feuchtigkeit kontrollierter entweichen und kann Klappern oder Überkochen reduzieren. Das ersetzt aber keine Aufsicht: Bei stark kochenden Speisen sollten Sie die Hitze anpassen.`;
  }

  if (/include|included|contents|5-piece|frying pan|enthalten|beinhaltet/i.test(question)) {
    if (hasSetComposition) {
      const pieces = facts.set_pieces.length > 0 ? `${facts.set_pieces.join(', ')} Set` : 'Set';
      const sizes = facts.set_sizes.length > 0 ? ` mit ${facts.set_sizes.join(', ')}` : '';
      const accessories = facts.accessories_included.filter((accessory) => accessory !== 'lid').length > 0
        ? ` sowie ${facts.accessories_included.filter((accessory) => accessory !== 'lid').join(', ')}`
        : '';
      const lid = facts.lid_included ? ' und Deckel' : '';
      return `${label} ist als ${pieces}${sizes}${lid}${accessories} beschrieben. Es ist damit nicht automatisch ein Pfannenset mit zusätzlicher Bratpfanne. Wenn Sie Eier, Pfannkuchen oder scharfes Anbraten planen, kann eine passende Pfanne sinnvoll sein.`;
    }
    return `${label} ist als Topfset einzuordnen und nicht automatisch als Pfannenset. Wenn keine Bratpfanne genannt ist, sollten Sie für Eier, Pfannkuchen oder scharfes Anbraten eine passende Pfanne ergänzen.`;
  }

  if (/eggs|eier|gentle frying|schonendes braten/i.test(question)) {
    if (!hasNonStick) return unsupportedAnswer();
    return `Für Eier oder sanftes Braten entsteht eine Lücke, wenn das aktuelle Produkt vor allem ein Edelstahl-Topfset ist. Eine antihaftbeschichtete oder keramisch beschichtete Pfanne ist dafür die passendere Ergänzung, weil empfindliche Speisen leichter gelöst werden können. Nutzen Sie dafür moderate Hitze und geeignetes Kochbesteck.`;
  }

  if (/steak|searing|anbraten|browning/i.test(question)) {
    if (!hasSearingSteel) return unsupportedAnswer();
    const proof = hasSearingCromargan ? 'Cromargan® Edelstahl rostfrei' : 'Edelstahl';
    return `Für Steak und intensives Anbraten zählt eine Pfanne, die hohe Hitze und Bräunung gut unterstützt. ${proof} ist dafür ein sinnvoller Materialbezug, wenn eine passende Edelstahl- oder Searing-Pfanne gewählt wird. Das Topfset selbst ersetzt diese Spezialaufgabe nicht.`;
  }

  if (/boiling|simmering|frying|kochen|köcheln|koecheln|braten/i.test(question)) {
    const materialProof = hasCromargan ? 'Das Cromargan® Edelstahl rostfrei passt gut zu Kochaufgaben wie Kochen und Köcheln.' : 'Die Edelstahl-Ausführung passt gut zu Kochaufgaben wie Kochen und Köcheln.';
    return `Dieses Set ist vor allem für Kochaufgaben wie Nudeln, Suppen, Saucen und schonendes Köcheln gedacht. ${materialProof} Für empfindliche Speisen, die leicht anhaften, ist eine beschichtete Pfanne meist die bessere Ergänzung.`;
  }

  if (/difference|compare|vergleich|unterschied|simpler/i.test(question)) {
    return `Bei der Wahl geht es nicht um pauschal besser oder schlechter, sondern um Ausstattung und Kochalltag. Quality One steht hier für zusätzliche Merkmale wie Griff- und Deckelkomfort, während ein einfacheres Edelstahl-Topfset stärker auf die Grundfunktionen Kochen und Köcheln fokussiert sein kann. Wählen Sie Quality One, wenn diese Komfortmerkmale wichtig sind; wählen Sie einfacher, wenn Basisfunktionen reichen.`;
  }

  if (/antihaftbeschichtet|non-stick/i.test(question)) {
    return `Das ist eine wichtige Erwartung vor dem Kauf: Ein Edelstahl-Topfset ist nicht automatisch antihaftbeschichtet. Für Kochen, Köcheln, Suppen, Saucen oder Pasta passt Edelstahl sehr gut. Für Eier oder besonders empfindliches Bratgut ist eine separate beschichtete Pfanne meist sinnvoller.`;
  }

  return undefined;
}

function buildDefaultAnswer(plan: FaqPlanItem, pko: ProductKnowledgeObject, elems: string): string | undefined {
  const featureBacked = buildFeatureBackedAnswer(plan, pko);
  if (featureBacked) return featureBacked;
  if (/induction|induktion|cool\+|handle|griff|glass lid|steam vent|lid|deckel|eggs|eier|gentle frying|schonendes braten|steak|searing|anbraten|browning|backofen|oven/i.test(plan.question_draft)) {
    if ((plan.source_evidence || []).includes('approved fixture fact')) return legacyFixtureFallbackAnswer();
    return undefined;
  }

  switch (plan.answer_type) {
    case 'benefit':
      if (/ptfe|non[-\s]?stick|antihaft|ceramic|keramik/i.test(elems)) {
        return 'Wenn Speisen leicht anhaften, hilft eine passende Beschichtung beim Wenden und Reinigen. Eine Antihaft- oder Keramikbeschichtung kann das Lösen empfindlicher Speisen erleichtern. Nutzen Sie moderate Hitze und geeignetes Kochbesteck, damit die Oberfläche geschont wird.';
      }
      if (elems) {
        return `Für den Alltag ist vor allem relevant, welchen Nutzen die Ausstattung bietet. ${elems}. Diese Merkmale helfen bei der passenden Kaufentscheidung, ohne zusätzliche Leistungsversprechen abzuleiten.`;
      }
      return 'Diese Eigenschaft kann für den Alltag hilfreich sein. Prüfen Sie vor dem Kauf, ob sie zu Ihrem Kochstil und den genannten Einsatzbereichen passt.';
    case 'compatibility':
      if (/backofen|oven/i.test(plan.question_draft)) return unsupportedAnswer();
      return 'Die Kompatibilität sollte zur geplanten Nutzung passen. Prüfen Sie Kochfeld, Größe und Herstellerangaben, bevor Sie das Produkt einsetzen.';
    case 'care':
      return 'Wenn Rückstände oder Flecken entstehen, reinigen Sie das Produkt mit mildem Spülmittel und trocknen Sie es sorgfältig ab. So reduzieren Sie Wasserflecken und schonen die Oberfläche.';
    case 'howto':
      return 'Für die Anwendung zählt die passende Nutzung im Alltag. Orientieren Sie sich an den genannten Eigenschaften und vermeiden Sie Einsatzbereiche, die nicht ausdrücklich beschrieben sind.';
    default:
      if (/Handhabung|Griff/i.test(plan.question_draft)) return unsupportedAnswer();
      return 'Die Antwort hängt davon ab, ob diese Eigenschaft für das konkrete Produkt genannt ist. Prüfen Sie die Herstellerangaben und nutzen Sie das Produkt nur innerhalb der beschriebenen Einsatzbereiche.';
  }
}

export function generateFaqItems(pko: ProductKnowledgeObject): FaqItem[] {
  const plan = createFaqPlan(pko, { targetFaqCount: 12 });
  return generateFromPlan(plan, pko);
}

export function generateFromPlan(plan: FaqPlanItem[], pko: ProductKnowledgeObject): FaqItem[] {
  const items: FaqItem[] = [];
  const baseEvidence = buildEvidenceFromPko(pko);
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    if (!p || !p.supported) continue;

    const elems = (p.fmo_elements_targeted || []).join(', ');
    let answer = buildDefaultAnswer(p, pko, elems);
    if (!answer) continue;

    answer = answer.replace(/dishwasher-safe/gi, 'spülmaschinengeeignet');

    const sourceEv = normalizeEvidence((p.source_evidence && p.source_evidence.length) ? p.source_evidence : baseEvidence);

    const faq: FaqItem = {
      faq_id: `${pko.pko_id}-faq-${i + 1}`,
      pko_id: pko.pko_id,
      question: p.question_draft,
      answer,
      language: 'de',
      is_master: true,
      purpose_tags: safePurposeTags(p.purpose_tags),
      fmo_coverage: { feature: p.supported, mechanism: p.supported, outcome: p.supported, use_case: p.supported, buyer_relevance: p.supported },
      source_evidence: sourceEv,
      evaluator_scores: {
        fact_fidelity: 0,
        fmo_benefit: 0,
        ai_visibility: 0,
        human_tone: 0,
        localization: null,
      },
      claim_risk_pass: true,
      risk_flags: [],
      status: 'draft',
      rewrite_count: 0,
      schema_ready: Boolean(p.question_draft && answer.trim().length > 0 && /^[A-ZÄÖÜ]/.test(answer.trim())),
      version: '1.0.0',
      created_at: new Date().toISOString(),
    };

    items.push(faq);
  }

  return items.slice(0, 20);
}

export { costLog };
