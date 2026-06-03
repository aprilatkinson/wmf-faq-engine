import type { ClaimFlagged } from '../../../core/src/types/pko';

/**
 * Section 3.6 WMF Claim Risk Vocabulary.
 * This module flags claims that must be treated as risky and surfaced in PKO.claims_flagged[].
 */

interface ClaimRiskRule {
  id: string;
  pattern: RegExp;
  riskType: string;
}

export const claimRiskRules: ClaimRiskRule[] = [
  { id: 'dishwasher-safe', pattern: /dishwasher-safe/i, riskType: 'dishwasher-safe' },
  { id: 'dishwasher-suitable', pattern: /dishwasher-suitable/i, riskType: 'dishwasher-suitable' },
  { id: 'scratch-proof', pattern: /scratch-proof/i, riskType: 'scratch-proof' },
  { id: 'scratch-resistant', pattern: /scratch-resistant/i, riskType: 'scratch-resistant' },
  { id: 'corrosion-resistant', pattern: /corrosion-resistant/i, riskType: 'corrosion-resistant' },
  { id: 'lifetime durability', pattern: /lifetime durability/i, riskType: 'lifetime durability' },
  { id: 'long-lasting', pattern: /long-lasting/i, riskType: 'long-lasting' },
  { id: 'durable construction', pattern: /durable construction/i, riskType: 'durable construction' },
  { id: 'professional quality', pattern: /professional quality/i, riskType: 'professional quality' },
  { id: 'gastronomy use', pattern: /gastronomy use/i, riskType: 'gastronomy use' },
  { id: 'repairable for 15 years', pattern: /repairable for 15 years/i, riskType: 'repairable for 15 years' },
  { id: 'supported by WMF service', pattern: /supported by WMF service for \[?\w+ years\]?/i, riskType: 'supported by WMF service' },
  { id: 'cromargan', pattern: /Cromargan\s*(?:Protect)?/i, riskType: 'Cromargan® / Cromargan Protect®' },
];

export function detectClaimRisk(text: string, source: string): ClaimFlagged[] {
  const claims = new Map<string, ClaimFlagged>();
  const normalized = text.replace(/\s+/g, ' ').trim();

  for (const rule of claimRiskRules) {
    const match = rule.pattern.exec(normalized);
    if (match) {
      const claimText = match[0];
      claims.set(`${rule.id}:${claimText}`, {
        claim_text: claimText,
        risk_type: rule.riskType,
        source,
      });
    }
  }

  return Array.from(claims.values());
}
