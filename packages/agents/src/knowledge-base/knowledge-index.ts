import type { ProductDocumentInput, ProductDocumentRecord } from './document-ingest';
import { ingestProductDocument } from './document-ingest';
import type { ReviewIntelligenceInput, ReviewIntelligenceRecord } from './review-ingest';
import { ingestReviewIntelligence } from './review-ingest';
import type { CategoryPlaybookInput, CategoryPlaybookRecord } from './playbook-ingest';
import { ingestCategoryPlaybook } from './playbook-ingest';
import type { ClaimGuidanceInput, ClaimGuidanceRecord } from './claim-ingest';
import { ingestClaimGuidance } from './claim-ingest';

export interface KnowledgeForCategory {
  product_documents: ProductDocumentRecord[];
  review_intelligence: ReviewIntelligenceRecord[];
  category_playbooks: CategoryPlaybookRecord[];
  claim_guidance: ClaimGuidanceRecord[];
}

export interface KnowledgeSummary {
  category: string;
  product_document_count: number;
  review_insight_count: number;
  playbook_count: number;
  claim_guidance_count: number;
  opportunities: string[];
  approved_claims: string[];
  review_required_claims: string[];
  prohibited_claims: string[];
}

function normalizeCategory(category: string | undefined): string {
  return (category ?? 'uncategorized').trim().toLowerCase();
}

export class KnowledgeIndex {
  private productDocuments: ProductDocumentRecord[] = [];
  private reviewInsights: ReviewIntelligenceRecord[] = [];
  private playbooks: CategoryPlaybookRecord[] = [];
  private claimGuidance: ClaimGuidanceRecord[] = [];

  addProductDocument(input: ProductDocumentInput): ProductDocumentRecord {
    const record = ingestProductDocument(input);
    this.productDocuments.push(record);
    return record;
  }

  addReviewIntelligence(input: ReviewIntelligenceInput): ReviewIntelligenceRecord {
    const record = ingestReviewIntelligence(input);
    this.reviewInsights.push(record);
    return record;
  }

  addCategoryPlaybook(input: CategoryPlaybookInput): CategoryPlaybookRecord {
    const record = ingestCategoryPlaybook(input);
    this.playbooks.push(record);
    return record;
  }

  addClaimGuidance(input: ClaimGuidanceInput): ClaimGuidanceRecord {
    const record = ingestClaimGuidance(input);
    this.claimGuidance.push(record);
    return record;
  }

  getKnowledgeForCategory(category: string): KnowledgeForCategory {
    const normalized = normalizeCategory(category);
    return {
      product_documents: this.productDocuments.filter((record) => normalizeCategory(record.category) === normalized),
      review_intelligence: this.getReviewInsights(category),
      category_playbooks: this.playbooks.filter((record) => normalizeCategory(record.category) === normalized),
      claim_guidance: this.getClaimGuidance(category),
    };
  }

  getReviewInsights(category: string): ReviewIntelligenceRecord[] {
    const normalized = normalizeCategory(category);
    return this.reviewInsights.filter((record) => normalizeCategory(record.category) === normalized);
  }

  getClaimGuidance(category: string): ClaimGuidanceRecord[] {
    const normalized = normalizeCategory(category);
    return this.claimGuidance.filter((record) => normalizeCategory(record.category) === normalized);
  }

  getKnowledgeSummary(category: string): KnowledgeSummary {
    const knowledge = this.getKnowledgeForCategory(category);
    return {
      category,
      product_document_count: knowledge.product_documents.length,
      review_insight_count: knowledge.review_intelligence.length,
      playbook_count: knowledge.category_playbooks.length,
      claim_guidance_count: knowledge.claim_guidance.length,
      opportunities: Array.from(new Set(knowledge.category_playbooks.flatMap((record) => record.opportunities))),
      approved_claims: Array.from(new Set(knowledge.claim_guidance.flatMap((record) => record.approved_claims))),
      review_required_claims: Array.from(new Set(knowledge.claim_guidance.flatMap((record) => record.review_required_claims))),
      prohibited_claims: Array.from(new Set(knowledge.claim_guidance.flatMap((record) => record.prohibited_claims))),
    };
  }
}

export function createKnowledgeIndex(): KnowledgeIndex {
  return new KnowledgeIndex();
}
