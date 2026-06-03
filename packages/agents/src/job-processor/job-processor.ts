import type { SourceLanguage } from '../../../core/src/constants/enums';
import type { FaqItem } from '../../../core/src/types/faq';
import type { IntakeRow } from '../../../core/src/types/intake';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';
import { mapPkoToFmoMappings } from '../benefit-mapper';
import { generateFaqItems } from '../faq-writer/faq-writer';
import { runRevisionLoop } from '../revision-loop';
import { localizeFaqItems } from '../localization';
import { exportJobWorkbook, type AccumulatedJobUrlRow, type JobWorkbook } from '../../../exporters/src';

export const JOB_STATUSES = [
  'Uploaded',
  'Validating',
  'Cost Estimated',
  'Queued',
  'Processing',
  'Completed',
  'Completed with Warnings',
  'Failed',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type RunMode = 'lean' | 'standard' | 'premium-p1';

export interface CostEstimate {
  run_mode: RunMode;
  url_count: number;
  base_tokens_per_url: number;
  selected_language_count: number;
  non_de_language_count: number;
  expected_failing_items: number;
  strategy_review_tokens: number;
  localization_tokens: number;
  rewrite_tokens: number;
  estimated_tokens: number;
  estimated_cost_eur: number;
  provider_cost_estimate: number;
  client_cost_estimate: number;
  margin_rate: number;
  cost_ceiling_eur: number;
  requires_confirmation: boolean;
}

export interface CostProfile {
  run_mode: RunMode;
  max_faq_count: number;
  selected_language_count: number;
  estimated_tokens: number;
  provider_cost_estimate: number;
  margin_rate: number;
  client_cost_estimate: number;
  batch_discount_available: boolean;
  prompt_cache_expected: boolean;
}

export interface QualitySummary {
  total_faq_items: number;
  approved_count: number;
  draft_count: number;
  needs_review_count: number;
  claim_risk_failure_count: number;
  high_severity_risk_count: number;
  average_fact_fidelity: number;
  average_fmo_benefit: number;
  average_ai_visibility: number;
  average_human_tone: number;
  should_pause: boolean;
}

export interface JobProcessorOptions {
  job_id: string;
  intake_rows: IntakeRow[];
  target_languages?: SourceLanguage[];
  run_mode?: RunMode;
  max_faq_count?: number;
  strategy_review_enabled?: boolean;
  cost_ceiling_eur?: number;
  cost_confirmed?: boolean;
  brand?: string;
  created_at?: string;
  continue_after_warning?: boolean;
  extractPko?: (intake: IntakeRow) => ProductKnowledgeObject;
}

export interface InternalSubBatchResult {
  sub_batch_id: string;
  index: number;
  row_count: number;
  rows: AccumulatedJobUrlRow[];
  quality_summary: QualitySummary;
  preview_export?: JobPreviewWorkbook;
}

export interface JobProcessorResult {
  job_id: string;
  status: JobStatus;
  statuses: JobStatus[];
  cost_estimate: CostEstimate;
  cost_profile: CostProfile;
  sub_batches: InternalSubBatchResult[];
  accumulated_rows: AccumulatedJobUrlRow[];
  preview_exports: JobPreviewWorkbook[];
  final_export?: JobWorkbook;
  warnings: string[];
}

export interface JobPreviewWorkbook extends JobWorkbook {
  projected_full_job_cost: number;
}

const SUB_BATCH_SIZE = 12;
const DEFAULT_COST_CEILING_EUR = 50;
const EUR_PER_1K_TOKENS = 0.01;
const MARGIN_RATE = 0.2;
const SUPPORTED_LANGUAGES: SourceLanguage[] = ['de', 'en', 'es', 'nl', 'fr'];
const LOCALIZATION_TOKENS_PER_URL_LANGUAGE = 1200;
const REWRITE_TOKENS_PER_EXPECTED_FAILURE = 2000;
const STRATEGY_REVIEW_TOKENS_PER_URL = 1000;

function assertValidStatus(status: JobStatus): JobStatus {
  if (!JOB_STATUSES.includes(status)) {
    throw new Error(`Invalid job status: ${status}`);
  }
  return status;
}

function tokensPerUrl(runMode: RunMode): number {
  if (runMode === 'premium-p1') return 10000;
  if (runMode === 'standard') return 6000;
  return 3000;
}

function runMode(options: Pick<JobProcessorOptions, 'run_mode'>): RunMode {
  return options.run_mode ?? 'standard';
}

function maxFaqCountForRun(options: Pick<JobProcessorOptions, 'run_mode' | 'max_faq_count'>): number {
  const mode = runMode(options);
  const requested = options.max_faq_count ?? (mode === 'premium-p1' ? 20 : 12);
  const ceiling = mode === 'premium-p1' ? 20 : 12;
  return Math.max(1, Math.min(ceiling, requested));
}

function normalizeTargetLanguages(targetLanguages: SourceLanguage[] | undefined, mode: RunMode): SourceLanguage[] {
  const requested = targetLanguages && targetLanguages.length > 0 ? targetLanguages : ['de'];
  const normalized = Array.from(new Set(['de', ...requested]));

  for (const language of normalized) {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new Error(`Unsupported target language: ${language}`);
    }
  }

  return normalized;
}

function expectedFailingItems(urlCount: number, maxFaqCount: number, mode: RunMode): number {
  const expectedFailureRate = mode === 'lean' ? 0.03 : mode === 'standard' ? 0.05 : 0.08;
  return Math.ceil(urlCount * maxFaqCount * expectedFailureRate);
}

export function estimateJobCost(
  options: Pick<JobProcessorOptions, 'intake_rows' | 'target_languages' | 'run_mode' | 'max_faq_count' | 'strategy_review_enabled' | 'cost_ceiling_eur'>,
): CostEstimate {
  const mode = runMode(options);
  const url_count = options.intake_rows.length;
  const max_faq_count = maxFaqCountForRun(options);
  const base_tokens_per_url = tokensPerUrl(mode);
  const target_languages = normalizeTargetLanguages(options.target_languages, mode);
  const non_de_language_count = target_languages.filter((language) => language !== 'de').length;
  const localization_tokens = url_count * non_de_language_count * LOCALIZATION_TOKENS_PER_URL_LANGUAGE;
  const failing_items = expectedFailingItems(url_count, max_faq_count, mode);
  const rewrite_tokens = failing_items * REWRITE_TOKENS_PER_EXPECTED_FAILURE;
  const strategy_review_tokens = mode === 'premium-p1' && options.strategy_review_enabled ? url_count * STRATEGY_REVIEW_TOKENS_PER_URL : 0;
  const estimated_tokens = url_count * base_tokens_per_url + localization_tokens + rewrite_tokens + strategy_review_tokens;
  const cost_ceiling_eur = options.cost_ceiling_eur ?? DEFAULT_COST_CEILING_EUR;
  const provider_cost_estimate = Number(((estimated_tokens / 1000) * EUR_PER_1K_TOKENS).toFixed(4));
  const client_cost_estimate = Number((provider_cost_estimate * (1 + MARGIN_RATE)).toFixed(4));

  return {
    run_mode: mode,
    url_count,
    base_tokens_per_url,
    selected_language_count: target_languages.length,
    non_de_language_count,
    expected_failing_items: failing_items,
    strategy_review_tokens,
    localization_tokens,
    rewrite_tokens,
    estimated_tokens,
    estimated_cost_eur: provider_cost_estimate,
    provider_cost_estimate,
    client_cost_estimate,
    margin_rate: MARGIN_RATE,
    cost_ceiling_eur,
    requires_confirmation: client_cost_estimate > cost_ceiling_eur,
  };
}

function createCostProfile(options: JobProcessorOptions, costEstimate: CostEstimate): CostProfile {
  return {
    run_mode: costEstimate.run_mode,
    max_faq_count: maxFaqCountForRun(options),
    selected_language_count: costEstimate.selected_language_count,
    estimated_tokens: costEstimate.estimated_tokens,
    provider_cost_estimate: costEstimate.provider_cost_estimate,
    margin_rate: costEstimate.margin_rate,
    client_cost_estimate: costEstimate.client_cost_estimate,
    batch_discount_available: options.intake_rows.length > SUB_BATCH_SIZE,
    prompt_cache_expected: true,
  };
}

function createSubBatches(rows: IntakeRow[]): IntakeRow[][] {
  const batches: IntakeRow[][] = [];
  for (let i = 0; i < rows.length; i += SUB_BATCH_SIZE) {
    batches.push(rows.slice(i, i + SUB_BATCH_SIZE));
  }
  return batches;
}

function defaultExtractPko(intake: IntakeRow): ProductKnowledgeObject {
  return {
    pko_id: `pko-${intake.row_id}`,
    source_url: intake.url,
    product_name: intake.product_id ?? intake.product_family ?? intake.category,
    category: intake.category,
    product_family: intake.product_family ?? intake.category,
    source_language_detected: intake.source_language ?? 'de',
    source_language_confidence: 1,
    features: ['Induction suitability', 'Dishwasher-suitable care guidance', 'Core product feature'],
    fmo_mappings: [],
    benefits_explicit: ['Supported deterministic job-processor fixture benefit'],
    benefits_missing: [],
    materials: ['Cromargan stainless steel'],
    compatibility: ['Induction'],
    care_instructions: ['Dishwasher-suitable, hand washing recommended'],
    warranty_service: [],
    use_cases: ['Everyday product use'],
    claims_flagged: [],
    page_weaknesses: [],
    knowledgebase_chunks_used: ['job-processor-deterministic-fixture'],
    pko_version: '1.0.0',
    created_at: new Date().toISOString(),
  };
}

function processIntakeRow(intake: IntakeRow, options: JobProcessorOptions, targetLanguages: SourceLanguage[]): AccumulatedJobUrlRow {
  const extractPko = options.extractPko ?? defaultExtractPko;
  const extractedPko = extractPko(intake);
  const fmo_mappings = extractedPko.fmo_mappings.length > 0 ? extractedPko.fmo_mappings : mapPkoToFmoMappings(extractedPko);
  const pko = { ...extractedPko, fmo_mappings };
  const masterFaqs = generateFaqItems(pko).map((faq) => runRevisionLoop(faq, pko));
  const nonDeLanguages = targetLanguages.filter((language) => language !== 'de');
  const localizedFaqs = nonDeLanguages.length > 0 ? localizeFaqItems(masterFaqs, nonDeLanguages) : [];
  const selectedLanguages = new Set(targetLanguages);
  const faq_items: FaqItem[] = [...masterFaqs, ...localizedFaqs].filter((faq) => selectedLanguages.has(faq.language));

  return {
    job_id: options.job_id,
    intake,
    faq_items,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function summarizeQuality(rows: AccumulatedJobUrlRow[]): QualitySummary {
  const faqItems = rows.flatMap((row) => row.faq_items);
  const average_fact_fidelity = average(faqItems.map((faq) => faq.evaluator_scores.fact_fidelity));
  const average_fmo_benefit = average(faqItems.map((faq) => faq.evaluator_scores.fmo_benefit));
  const average_ai_visibility = average(faqItems.map((faq) => faq.evaluator_scores.ai_visibility));
  const average_human_tone = average(faqItems.map((faq) => faq.evaluator_scores.human_tone));
  const needs_review_count = faqItems.filter((faq) => faq.status === 'needs-review').length;
  const claim_risk_failure_count = faqItems.filter((faq) => !faq.claim_risk_pass).length;
  const high_severity_risk_count = faqItems.reduce((count, faq) => count + faq.risk_flags.filter((flag) => flag.severity === 'high').length, 0);
  const should_pause = needs_review_count > 0 || claim_risk_failure_count > 0 || high_severity_risk_count > 0;

  return {
    total_faq_items: faqItems.length,
    approved_count: faqItems.filter((faq) => faq.status === 'approved').length,
    draft_count: faqItems.filter((faq) => faq.status === 'draft').length,
    needs_review_count,
    claim_risk_failure_count,
    high_severity_risk_count,
    average_fact_fidelity,
    average_fmo_benefit,
    average_ai_visibility,
    average_human_tone,
    should_pause,
  };
}

function exportRows(options: JobProcessorOptions, rows: AccumulatedJobUrlRow[]): JobWorkbook {
  return exportJobWorkbook({
    job_id: options.job_id,
    brand: options.brand ?? 'WMF',
    created_at: options.created_at,
    mode: options.run_mode ?? 'standard',
    rows,
  });
}

function previewRows(options: JobProcessorOptions, rows: AccumulatedJobUrlRow[], costProfile: CostProfile): JobPreviewWorkbook {
  return {
    ...exportRows(options, rows),
    projected_full_job_cost: costProfile.client_cost_estimate,
  };
}

export function processBatchJob(options: JobProcessorOptions): JobProcessorResult {
  const statuses: JobStatus[] = [assertValidStatus('Uploaded'), assertValidStatus('Validating')];
  const targetLanguages = normalizeTargetLanguages(options.target_languages, runMode(options));
  const cost_estimate = estimateJobCost(options);
  const cost_profile = createCostProfile(options, cost_estimate);

  if (cost_estimate.requires_confirmation && !options.cost_confirmed) {
    statuses.push(assertValidStatus('Cost Estimated'));
    return {
      job_id: options.job_id,
      status: 'Cost Estimated',
      statuses,
      cost_estimate,
      cost_profile,
      sub_batches: [],
      accumulated_rows: [],
      preview_exports: [],
      warnings: [],
    };
  }

  statuses.push(assertValidStatus('Queued'), assertValidStatus('Processing'));

  const accumulated_rows: AccumulatedJobUrlRow[] = [];
  const preview_exports: JobPreviewWorkbook[] = [];
  const sub_batches: InternalSubBatchResult[] = [];
  for (const [index, batch] of createSubBatches(options.intake_rows).entries()) {
    const rows = batch.map((intake) => processIntakeRow(intake, options, targetLanguages));
    accumulated_rows.push(...rows);

    const quality_summary = summarizeQuality(rows);
    const preview_export = previewRows(options, accumulated_rows, cost_profile);
    preview_exports.push(preview_export);

    sub_batches.push({
      sub_batch_id: `${options.job_id}-sub-${index + 1}`,
      index: index + 1,
      row_count: rows.length,
      rows,
      quality_summary,
      preview_export,
    });

    if (quality_summary.should_pause && !options.continue_after_warning) {
      break;
    }
  }

  const paused = sub_batches.some((subBatch) => subBatch.quality_summary.should_pause) && !options.continue_after_warning;
  const final_export = paused ? undefined : exportRows(options, accumulated_rows);
  const hasWarnings = accumulated_rows.some((row) => row.warnings?.length || row.faq_items.some((faq) => faq.risk_flags.length > 0 || faq.status === 'needs-review'));
  const finalStatus = assertValidStatus(hasWarnings || paused ? 'Completed with Warnings' : 'Completed');
  statuses.push(finalStatus);

  return {
    job_id: options.job_id,
    status: finalStatus,
    statuses,
    cost_estimate,
    cost_profile,
    sub_batches,
    accumulated_rows,
    preview_exports,
    final_export,
    warnings: hasWarnings ? ['Some FAQ rows require review.'] : [],
  };
}
