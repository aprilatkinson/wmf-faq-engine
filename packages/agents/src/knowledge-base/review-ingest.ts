export interface ReviewIntelligenceInput {
  category: string;
  issue: string;
  frequency: number;
  customer_wording: string[];
  recommended_faq_opportunity: string;
}

export interface ReviewIntelligenceRecord extends ReviewIntelligenceInput {
  review_insight_id: string;
  source_type: 'review-intelligence';
  ingested_at: string;
}

function stableId(values: string[]): string {
  return `review-${values.join('|').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}`;
}

export function ingestReviewIntelligence(input: ReviewIntelligenceInput): ReviewIntelligenceRecord {
  return {
    ...input,
    review_insight_id: stableId([input.category, input.issue]),
    source_type: 'review-intelligence',
    ingested_at: '2026-06-04T00:00:00.000Z',
  };
}
