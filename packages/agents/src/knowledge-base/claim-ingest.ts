export interface ClaimGuidanceInput {
  category: string;
  approved_claims: string[];
  review_required_claims: string[];
  prohibited_claims: string[];
}

export interface ClaimGuidanceRecord extends ClaimGuidanceInput {
  claim_guidance_id: string;
  source_type: 'claim-guidance';
  ingested_at: string;
}

function stableId(category: string): string {
  return `claims-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export function ingestClaimGuidance(input: ClaimGuidanceInput): ClaimGuidanceRecord {
  return {
    ...input,
    claim_guidance_id: stableId(input.category),
    source_type: 'claim-guidance',
    ingested_at: '2026-06-04T00:00:00.000Z',
  };
}
