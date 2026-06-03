import { z } from 'zod';
import { sourceLanguageValues, faqPurposeTagValues, faqStatusValues } from '../constants/enums';

export const fmoCoverageSchema = z.object({
  feature: z.boolean(),
  mechanism: z.boolean(),
  outcome: z.boolean(),
  use_case: z.boolean(),
  buyer_relevance: z.boolean(),
}).strict();

export const evaluatorScoresSchema = z.object({
  fact_fidelity: z.number().int(),
  fmo_benefit: z.number().int(),
  ai_visibility: z.number().int(),
  human_tone: z.number().int(),
  localization: z.number().int().nullable(),
}).strict();

export const riskFlagSchema = z.object({
  flag_type: z.string(),
  description: z.string(),
  severity: z.string(),
}).strict();

/** Section 1.3 FAQ Item Object */
export const faqItemSchema = z.object({
  faq_id: z.string(),
  pko_id: z.string(),
  question: z.string(),
  answer: z.string(),
  language: z.enum(sourceLanguageValues),
  is_master: z.boolean(),
  purpose_tags: z.array(z.enum(faqPurposeTagValues)).min(1),
  fmo_coverage: fmoCoverageSchema,
  source_evidence: z.array(z.string()).default([]),
  evaluator_scores: evaluatorScoresSchema,
  claim_risk_pass: z.boolean(),
  risk_flags: z.array(riskFlagSchema).default([]),
  status: z.enum(faqStatusValues),
  rewrite_count: z.number().int().min(0).max(2),
  schema_ready: z.boolean(),
  version: z.string(),
  created_at: z.string().datetime(),
}).strict();
