import { SourceLanguage, FmoSourceConfidence } from '../constants/enums';

export interface FmoMapping {
  feature: string;
  mechanism: string;
  outcome: string;
  use_case: string;
  buyer_relevance: string;
  source_confidence: FmoSourceConfidence;
}

export interface ClaimFlagged {
  claim_text: string;
  risk_type: string;
  source: string;
}

/** Section 1.2 Product Knowledge Object (PKO) */
export interface ProductKnowledgeObject {
  pko_id: string;
  source_url: string;
  product_name: string;
  category: string;
  product_family: string;
  source_language_detected: SourceLanguage;
  source_language_confidence: number;
  features: string[];
  fmo_mappings: FmoMapping[];
  benefits_explicit: string[];
  benefits_missing: string[];
  materials: string[];
  compatibility: string[];
  care_instructions: string[];
  warranty_service: string[];
  use_cases: string[];
  claims_flagged: ClaimFlagged[];
  page_weaknesses: string[];
  knowledgebase_chunks_used: string[];
  pko_version: string;
  created_at: string;
}
