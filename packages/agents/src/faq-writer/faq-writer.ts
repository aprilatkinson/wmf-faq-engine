import type { FaqPlanItem } from '../faq-strategy/faq-strategy';
import { createFaqPlan } from '../faq-strategy/faq-strategy';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';
import type { FaqItem } from '../../../core/src/types/faq';

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

    let answer = '';
    const elems = (p.fmo_elements_targeted || []).join(', ');
    switch (p.answer_type) {
      case 'benefit':
        if (/ptfe|non[-\s]?stick|antihaft|ceramic|keramik|ptfe/i.test(elems)) {
          answer = 'Die Beschichtung reduziert das Festkleben von Speisen und erleichtert die Reinigung.';
        } else if (elems) {
          answer = `Die verfügbaren Produktdaten beschreiben Eigenschaften wie: ${elems}.`;
        } else {
          answer = 'Die verfügbaren Produktdaten unterstützen diese Eigenschaft.';
        }
        break;
      case 'compatibility': {
        const positiveOvenPatterns = [/oven[-\s]?compatible|oven compatible|oven safe|backofengeeignet|backofen[-\s]?kompatibel|backofenkompatibel[:\s]*ja/i];
        const tempPattern = /(?:max(?:imal)?|bis|≤|<=|max\.)?\s*\d{2,3}\s?°?C/i;
        const checkList = [...pko.compatibility, ...pko.care_instructions];
        let ovenPos = false;
        for (const it of checkList) {
          if (!it) continue;
          if (positiveOvenPatterns.some((rx) => rx.test(it))) ovenPos = true;
          if (tempPattern.test(it)) ovenPos = true;
        }

        if (ovenPos && /backofen|oven/i.test(p.question_draft)) {
          answer = 'Dieses Kochgeschirr ist für den Einsatz im Backofen geeignet.';
        } else if (/induction|induktion/i.test(elems) || /Induktion/i.test(p.question_draft)) {
          answer = 'Dieses Kochgeschirr eignet sich für Induktionsherde.';
        } else if (/backofen/i.test(p.question_draft)) {
          answer = 'Die Produktdaten geben hierzu keine eindeutige Information; prüfen Sie die Herstellerangaben für den Backofeneinsatz.';
        } else {
          answer = 'Die aktuellen Produktdaten nennen hierzu keine eindeutige Angabe.';
        }
        break;
      }
      case 'care':
        if (/spülmaschinen|dishwasher|Spülmaschinen/i.test(elems) || p.source_evidence.join(' ').match(/spülmaschinen|dishwasher/i)) {
          answer = 'Es ist als spülmaschinengeeignet, Handwäsche empfohlen beschrieben.';
        } else {
          answer = 'Die Reinigung sollte gemäß den Pflegehinweisen des Herstellers erfolgen, um die Oberfläche zu schonen.';
        }
        break;
      case 'howto':
        answer = (p.source_evidence || []).length
          ? `Die Produktinformationen nennen: ${(p.source_evidence || []).join('; ')}.`
          : 'Die aktuellen Produktdaten nennen hierzu keine eindeutige Angabe.';
        break;
      default:
        answer = (p.source_evidence && p.source_evidence.length) ? p.source_evidence.join('; ') : 'Die aktuellen Produktdaten nennen hierzu keine eindeutige Angabe.';
        if (/Handhabung|Griff/i.test(p.question_draft)) {
          const hasHandleEvidence = (p.source_evidence || []).some((s) => /griff|handle|soft[-\s]?touch|fixed handle/i.test(s));
          if (!hasHandleEvidence) {
            answer = 'Die aktuellen Produktdaten nennen dazu keine eindeutige Angabe.';
          }
        }
    }

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
