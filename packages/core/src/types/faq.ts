import { SourceLanguage, FAQPurposeTag, FAQStatus } from '../constants/enums';

export interface FmoCoverage {
  feature: boolean;
  mechanism: boolean;
  outcome: boolean;
  use_case: boolean;
  buyer_relevance: boolean;
}

export interface EvaluatorScores {
  fact_fidelity: number;
  fmo_benefit: number;
  ai_visibility: number;
  human_tone: number;
  localization: number | null;
}

export interface RiskFlag {
  flag_type: string;
  description: string;
  severity: string;
}

/** Section 1.3 FAQ Item Object */
export interface FaqItem {
  faq_id: string;
  pko_id: string;
  question: string;
  answer: string;
  language: SourceLanguage;
  is_master: boolean;
  purpose_tags: FAQPurposeTag[];
  fmo_coverage: FmoCoverage;
  source_evidence: string[];
  evaluator_scores: EvaluatorScores;
  claim_risk_pass: boolean;
  risk_flags: RiskFlag[];
  status: FAQStatus;
  rewrite_count: number;
  schema_ready: boolean;
  version: string;
  created_at: string;
}
