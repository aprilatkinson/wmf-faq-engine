import type { FaqItem } from '../../../core/src/types/faq';

/**
 * Claim Risk Gate
 * Binary gate (pass/fail) checking for risky WMF vocabulary.
 * Returns false if any risky term is detected.
 * Pass threshold: must pass (true)
 *
 * Risky terms from Section 3.6:
 * - dishwasher-safe (use: dishwasher-suitable)
 * - scratch-proof (use: scratch-resistant with URL support)
 * - corrosion-resistant (pending approval)
 * - lifetime durability (use: long-lasting, durable construction)
 * - professional quality / gastronomy (only if positioned)
 * - repairable for 15 years (only for confirmed products)
 * - PFAS-free, PFOA-free, PTFE-free (health claims)
 * - toxin-free, chemical-free
 * - Cool+ (technology-specific, not approved for general use)
 *
 * TODO: Cromargan Protect® confusion needs PKO-aware validation. Ordinary
 * Cromargan / Cromargan® / Cromargan Edelstahl rostfrei wording is allowed.
 */

interface RiskMatch {
  term: string;
  severity: 'high' | 'medium' | 'low';
  replacement?: string;
}

const RISKY_TERMS: Array<{ pattern: RegExp; severity: 'high' | 'medium' | 'low'; term: string; replacement?: string }> = [
  // High severity: absolute blocks
  { pattern: /dishwasher.?safe|dishwasher-safe/i, severity: 'high', term: 'dishwasher-safe', replacement: 'dishwasher-suitable' },
  { pattern: /pfas.?free|pfas\s*frei/i, severity: 'high', term: 'PFAS-free' },
  { pattern: /pfoa.?free|pfoa\s*frei/i, severity: 'high', term: 'PFOA-free' },
  { pattern: /ptfe.?free|ptfe\s*frei/i, severity: 'high', term: 'PTFE-free' },
  { pattern: /toxin.?free|toxin\s*frei/i, severity: 'high', term: 'toxin-free' },
  { pattern: /chemical.?free|chemical\s*frei/i, severity: 'high', term: 'chemical-free' },
  { pattern: /cool\+|cool plus/i, severity: 'high', term: 'Cool+' },

  // Medium severity: requires context/justification
  { pattern: /scratch.?proof|kratzerfe?st/i, severity: 'medium', term: 'scratch-proof', replacement: 'scratch-resistant (if URL supports)' },
  { pattern: /corrosion.?resistant|korrosionsbeständig/i, severity: 'medium', term: 'corrosion-resistant' },
  { pattern: /lifetime.{0,20}durability|lifetime.{0,20}lasting/i, severity: 'medium', term: 'lifetime durability', replacement: 'long-lasting, durable construction' },
  { pattern: /professional.{0,10}quality/i, severity: 'medium', term: 'professional quality' },
  { pattern: /gastronomy|gastronomie/i, severity: 'medium', term: 'gastronomy use' },

  // Low severity: needs approval
  { pattern: /repairable.*15\s?year|repairability.*15/i, severity: 'low', term: 'repairable for 15 years' },
];

export function evaluateClaimRisk(faq: FaqItem): { pass: boolean; flags: Array<{ term: string; severity: 'high' | 'medium' | 'low' }> } {
  const answer = faq.answer || '';
  const foundRisks: Array<{ term: string; severity: 'high' | 'medium' | 'low' }> = [];

  for (const riskRule of RISKY_TERMS) {
    if (riskRule.pattern.test(answer)) {
      foundRisks.push({
        term: riskRule.term,
        severity: riskRule.severity,
      });
    }
  }

  return {
    pass: foundRisks.length === 0,
    flags: foundRisks,
  };
}
