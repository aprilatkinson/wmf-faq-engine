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

  const all = Object.values(dedup);

  // Return the full opportunity plan up to target, including unsupported items with skip_reason.
  return all.slice(0, target);
}

export default createFaqPlan;
