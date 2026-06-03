import type { FmoMapping, ProductKnowledgeObject } from '../../../core/src/types/pko';
import type { FmoSourceConfidence } from '../../../core/src/constants/enums';

const HIGH: FmoSourceConfidence = 'high';
const MEDIUM: FmoSourceConfidence = 'medium';
const LOW: FmoSourceConfidence = 'low';

interface BenefitRule {
  patterns: RegExp[];
  sourceFields: Array<keyof ProductKnowledgeObject>;
  createMapping: (text: string, pko: ProductKnowledgeObject) => Omit<FmoMapping, 'feature'>;
}

const benefitRules: BenefitRule[] = [
  {
    patterns: [/cromargan|stainless steel|edelstahl/i],
    sourceFields: ['materials'],
    createMapping: (text) => ({
      mechanism: 'Stainless steel construction provides a smooth, hygienic surface for cookware.',
      outcome: 'Helps maintain a clean cooking surface and reliable heat response.',
      use_case: 'Everyday frying and general cookware use.',
      buyer_relevance: 'Offers a durable, low-maintenance surface buyers trust for daily cooking.',
      source_confidence: HIGH,
    }),
  },
  {
    patterns: [/anti[-\s]?stick|non[-\s]?stick|antihaft|ceramic|keramik|ptfe/i],
    sourceFields: ['features', 'materials'],
    createMapping: (text) => ({
      mechanism: 'Non-stick coating makes food release easier from the cooking surface.',
      outcome: 'Reduces sticking and simplifies cleanup after cooking.',
      use_case: 'Frying, sautéing and preparing sticky foods with less residue.',
      buyer_relevance: 'Makes cooking and cleanup quicker for everyday meal preparation.',
      source_confidence: HIGH,
    }),
  },
  {
    patterns: [/induction|induktion|hobs compatibility|heat source/i],
    sourceFields: ['compatibility'],
    createMapping: (text) => ({
      mechanism: 'Cookware is designed to work with common cooktops, including induction and gas.',
      outcome: 'Allows the pan to be used across more kitchen ranges without compatibility issues.',
      use_case: 'Cooking on induction, gas or electric stoves.',
      buyer_relevance: 'Helps shoppers choose cookware that fits their existing stove.',
      source_confidence: HIGH,
    }),
  },
  {
    patterns: [/dishwasher safe|dishwasher[-\s]?suitable|top rack|Spülmaschinengeeignet|Spuelmaschinengeeignet|Spülen per Hand|hand wash/i],
    sourceFields: ['care_instructions', 'features'],
    createMapping: (text) => ({
      mechanism: 'Dishwasher-suitable care guidance supports easier cleaning, while handwashing can help preserve the cookware finish.',
      outcome: 'Supports convenient cleanup while protecting the cookware finish.',
      use_case: 'Cleaning cookware after food preparation.',
      buyer_relevance: 'Appeals to buyers who want easy maintenance without compromising product care.',
      source_confidence: MEDIUM,
    }),
  },
  {
    patterns: [/pouring edge|pouring rim|Gießrand|Giesrand/i],
    sourceFields: ['features'],
    createMapping: (text) => ({
      mechanism: 'A pouring edge controls liquid flow when transferring sauces or oils.',
      outcome: 'Reduces drips and spills during pouring.',
      use_case: 'Pouring liquids from the pan to bowls or plates.',
      buyer_relevance: 'Helps keep the kitchen cleaner and reduces waste when serving.',
      source_confidence: HIGH,
    }),
  },
  {
    patterns: [/handle type[:\s\-]*fixed handle/i, /\bfixed handle\b/i],
    sourceFields: ['features'],
    createMapping: (text) => ({
      mechanism: 'Fixed handle is permanently attached to the cookware.',
      outcome: 'Supports stable handling during normal stovetop use.',
      use_case: 'Handling the cookware during cooking and serving.',
      buyer_relevance: 'Helps buyers expect predictable handling while cooking.',
      source_confidence: LOW,
    }),
  },
  {
    patterns: [/soft[-\s]?touch|bakelite/i],
    sourceFields: ['features'],
    createMapping: (text) => ({
      mechanism: 'A soft-touch handle improves grip comfort during cooking.',
      outcome: 'Makes it easier to hold and move cookware without slipping.',
      use_case: 'Lifting and handling hot cookware on the stove.',
      buyer_relevance: 'Offers a more comfortable experience for frequent cooking.',
      source_confidence: HIGH,
    }),
  },
  {
    patterns: [/set|piece|teil/i],
    sourceFields: ['product_name', 'features'],
    createMapping: (text) => ({
      mechanism: 'A multi-piece cookware set covers a variety of cooking tasks in one purchase.',
      outcome: 'Gives buyers more flexibility with coordinated cookware options.',
      use_case: 'Preparing multiple dishes using matched pans and pots.',
      buyer_relevance: 'Saves buyers from buying individual pieces separately.',
      source_confidence: MEDIUM,
    }),
  },
];

function textArrayForField(pko: ProductKnowledgeObject, field: keyof ProductKnowledgeObject): string[] {
  const value = pko[field];
  if (Array.isArray(value)) {
    return value.filter(Boolean) as string[];
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

export function mapPkoToFmoMappings(pko: ProductKnowledgeObject): FmoMapping[] {
  const mappings: FmoMapping[] = [];
  const seen = new Set<string>();

  for (const rule of benefitRules) {
    for (const field of rule.sourceFields) {
      for (const text of textArrayForField(pko, field)) {
        for (const pattern of rule.patterns) {
          if (!pattern.test(text)) {
            continue;
          }

          const mapping = { feature: text, ...rule.createMapping(text, pko) };
          const key = `${mapping.feature}::${mapping.outcome}`;
          if (!seen.has(key)) {
            seen.add(key);
            mappings.push(mapping);
          }
          break;
        }
      }
    }
  }

  return mappings;
}
