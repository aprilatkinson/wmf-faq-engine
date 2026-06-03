import type { FaqItem } from '../../../core/src/types/faq';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

/**
 * Fact Fidelity Evaluator
 * Scores 0-3 based on whether all claims in the answer are supported by PKO.
 * Pass threshold: 2 (or 3 for risky claims)
 *
 * Rubric:
 * 0: Answer contains unsupported claim or unsupported compatibility claim
 * 1: Answer has weakly supported claim or needs softening
 * 2: All claims match PKO; no unsupported compatibility claims
 * 3: All claims traceable to PKO; precise, unambiguous wording
 */

// Unsupported compatibility claims that must trigger fail if stated without PKO support
const UNSUPPORTED_COMPATIBILITY_PATTERNS = [
  /induction|induktion/i,
  /dishwasher|spülmaschinen/i,
  /oven|backofen/i,
  /max temp|maximum temperature|°c|°f/i,
  /scratch.?resist|scratch.?proof|kratzer|kratzerbeständig/i,
];

// Health/regulatory claims that require explicit support
const HEALTH_CLAIM_PATTERNS = [/pfas.?free|pfas\s*frei|pfoa.?free|pfoa\s*frei|ptfe.?free|ptfe\s*frei/i];

// Premium/professional claims requiring explicit URL support
const UNSUPPORTED_PREMIUM_CLAIMS = [/professional quality|gastronomy|gastronomie|professional.*use/i, /lifetime durability|lifetime.*lasting|lebenslang.*haltbar/i];

function extractCompatibilityClaimsFromAnswer(answer: string): string[] {
  const claims: string[] = [];
  for (const pattern of UNSUPPORTED_COMPATIBILITY_PATTERNS) {
    const match = answer.match(pattern);
    if (match) {
      claims.push(match[0].toLowerCase());
    }
  }
  for (const pattern of HEALTH_CLAIM_PATTERNS) {
    const match = answer.match(pattern);
    if (match) {
      claims.push(match[0].toLowerCase());
    }
  }
  for (const pattern of UNSUPPORTED_PREMIUM_CLAIMS) {
    const match = answer.match(pattern);
    if (match) {
      claims.push(match[0].toLowerCase());
    }
  }
  return claims;
}

function isClaimSupportedByPko(claim: string, pko: ProductKnowledgeObject, faq: FaqItem): boolean {
  const combined = [
    ...pko.features,
    ...pko.materials,
    ...pko.compatibility,
    ...pko.care_instructions,
    ...pko.benefits_explicit,
    ...(pko.fmo_mappings?.flatMap((m) => [m.feature, m.mechanism, m.outcome, m.use_case, m.buyer_relevance]) || []),
  ].join(' ').toLowerCase();

  const fmoElements = faq.fmo_coverage;

  if (/induction|induktion/.test(claim)) {
    return combined.includes('induction') || combined.includes('induktion');
  }
  if (/dishwasher|spülmaschinen/.test(claim)) {
    return combined.includes('dishwasher') || combined.includes('spülmaschinen');
  }
  if (/oven|backofen/.test(claim)) {
    return combined.includes('oven') || combined.includes('backofen') || combined.includes('oven-safe') || combined.includes('backofengeeignet');
  }
  if (/°c|°f|max temp|temperature/.test(claim)) {
    return /\d{2,3}\s?°/.test(combined);
  }
  if (/scratch/.test(claim)) {
    return combined.includes('scratch-resist');
  }
  if (/pfas|pfoa|ptfe/.test(claim)) {
    return combined.includes('pfas') || combined.includes('pfoa') || combined.includes('ptfe');
  }
  if (/professional|gastronomy|gastronomie/.test(claim)) {
    return combined.includes('professional') || combined.includes('gastronomy');
  }
  if (/lifetime|durability/.test(claim)) {
    return combined.includes('lifetime') || combined.includes('durability');
  }

  return true;
}

function evaluateFactFidelity(faq: FaqItem, pko: ProductKnowledgeObject): number {
  const answer = faq.answer || '';

  // Check for unsupported claims
  const foundClaims = extractCompatibilityClaimsFromAnswer(answer);
  const unsupportedClaims = foundClaims.filter((claim) => !isClaimSupportedByPko(claim, pko, faq));

  if (unsupportedClaims.length > 0) {
    return 0; // Unsupported claim = fail
  }

  // Check for weak support or vague wording
  if (answer.match(/appear|seem|might|could|perhaps|possibly|suggests/i)) {
    return 1; // Weak support
  }

  // Check if all fmo_coverage booleans match PKO evidence quality
  const fmoCount = Object.values(faq.fmo_coverage || {}).filter(Boolean).length;
  if (fmoCount >= 3) {
    return 3; // Strong traceability
  }
  if (fmoCount >= 1) {
    return 2; // Acceptable
  }

  // Default acceptable
  return 2;
}

export { evaluateFactFidelity };
