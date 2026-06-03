import { z } from 'zod';
import { sourceLanguageValues, fmoSourceConfidenceValues } from '../constants/enums';

/** Section 1.2a FMO Mapping Object */
export const fmoMappingSchema = z.object({
  feature: z.string(),
  mechanism: z.string(),
  outcome: z.string(),
  use_case: z.string(),
  buyer_relevance: z.string(),
  source_confidence: z.enum(fmoSourceConfidenceValues),
}).strict();

export const claimFlaggedSchema = z.object({
  claim_text: z.string(),
  risk_type: z.string(),
  source: z.string(),
}).strict();

/** Section 1.2 Product Knowledge Object (PKO) */
export const pkoSchema = z.object({
  pko_id: z.string(),
  source_url: z.string().url(),
  product_name: z.string(),
  category: z.string(),
  product_family: z.string(),
  source_language_detected: z.enum(sourceLanguageValues),
  source_language_confidence: z.number().min(0).max(1),
  features: z.array(z.string()).default([]),
  fmo_mappings: z.array(fmoMappingSchema).default([]),
  benefits_explicit: z.array(z.string()).default([]),
  benefits_missing: z.array(z.string()).default([]),
  materials: z.array(z.string()).default([]),
  compatibility: z.array(z.string()).default([]),
  care_instructions: z.array(z.string()).default([]),
  warranty_service: z.array(z.string()).default([]),
  use_cases: z.array(z.string()).default([]),
  claims_flagged: z.array(claimFlaggedSchema).default([]),
  page_weaknesses: z.array(z.string()).default([]),
  knowledgebase_chunks_used: z.array(z.string()).default([]),
  pko_version: z.string(),
  created_at: z.string().datetime(),
}).strict();
