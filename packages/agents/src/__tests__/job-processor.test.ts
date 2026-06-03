import { describe, expect, it } from 'vitest';
import type { IntakeRow } from '../../../core/src/types/intake';
import { JOB_STATUSES, processBatchJob } from '../job-processor';

function createIntakeRows(count: number): IntakeRow[] {
  return Array.from({ length: count }, (_, index) => ({
    row_id: `row-${index + 1}`,
    product_id: `product-${index + 1}`,
    url: `https://example.com/product-${index + 1}`,
    page_type: 'PDP',
    category: 'Cookware',
    product_family: 'Quality One',
    priority: index % 3 === 0 ? 'P1' : 'P2',
    source_language: 'de',
  }));
}

function processUrlCount(count: number) {
  return processBatchJob({
    job_id: `job-${count}`,
    intake_rows: createIntakeRows(count),
    target_languages: ['de'],
    run_mode: 'lean',
    created_at: '2026-06-03T00:00:00.000Z',
    brand: 'WMF',
  });
}

function languagesInResult(result: ReturnType<typeof processBatchJob>): string[] {
  return Array.from(new Set(result.accumulated_rows.flatMap((row) => row.faq_items.map((faq) => faq.language)))).sort();
}

describe('Phase 9 batch job processor starter', () => {
  it('processes a 1 URL job with one final workbook result', () => {
    const result = processUrlCount(1);

    expect(result.job_id).toBe('job-1');
    expect(result.accumulated_rows).toHaveLength(1);
    expect(result.sub_batches).toHaveLength(1);
    expect(result.final_export).toBeDefined();
    expect(result.final_export?.job_id).toBe('job-1');
    expect(result.final_export?.tabs).toHaveLength(10);
  });

  it('processes a 3 URL job with one final workbook result', () => {
    const result = processUrlCount(3);

    expect(result.accumulated_rows).toHaveLength(3);
    expect(result.sub_batches).toHaveLength(1);
    expect(result.final_export).toBeDefined();
    expect(result.final_export?.job_id).toBe('job-3');
    expect(result.final_export?.tabs.find((tab) => tab.name === 'Product Intake')?.rows).toHaveLength(3);
  });

  it('processes a 12 URL job with one sub-batch and one final workbook result', () => {
    const result = processUrlCount(12);

    expect(result.sub_batches).toHaveLength(1);
    expect(result.sub_batches[0].row_count).toBe(12);
    expect(result.accumulated_rows).toHaveLength(12);
    expect(result.final_export).toBeDefined();
    expect(result.final_export?.job_id).toBe('job-12');
  });

  it('processes a 300 URL job with 25 internal sub-batches and one final workbook result', () => {
    const result = processUrlCount(300);

    expect(result.sub_batches).toHaveLength(25);
    expect(result.sub_batches.every((subBatch) => subBatch.row_count === 12)).toBe(true);
    expect(result.accumulated_rows).toHaveLength(300);
    expect(result.final_export).toBeDefined();
    expect(result.final_export?.job_id).toBe('job-300');
    expect(result.final_export?.tabs.find((tab) => tab.name === 'Job Summary')?.rows[0][1]).toBe(300);
  });

  it('creates preview export data after the first completed sub-batch without creating final sub-batch jobs', () => {
    const result = processUrlCount(13);

    expect(result.sub_batches).toHaveLength(2);
    expect(result.preview_exports.length).toBeGreaterThanOrEqual(1);
    expect(result.sub_batches[0].preview_export).toBeDefined();
    expect(result.sub_batches[0].preview_export?.job_id).toBe('job-13');
    expect(result.sub_batches[0].preview_export?.filename).toContain('Job_job-13');
    expect(result.sub_batches[0].preview_export?.projected_full_job_cost).toBe(result.cost_profile.client_cost_estimate);
    expect(result.sub_batches[0].preview_export?.tabs.find((tab) => tab.name === 'Product Intake')?.rows).toHaveLength(12);
    expect(result.final_export?.tabs.find((tab) => tab.name === 'Product Intake')?.rows).toHaveLength(13);
  });

  it('blocks processing at cost estimate until confirmed when cost exceeds ceiling', () => {
    const blocked = processBatchJob({
      job_id: 'job-cost-blocked',
      intake_rows: createIntakeRows(300),
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      run_mode: 'premium-p1',
      cost_ceiling_eur: 50,
      cost_confirmed: false,
    });

    expect(blocked.status).toBe('Cost Estimated');
    expect(blocked.cost_estimate.requires_confirmation).toBe(true);
    expect(blocked.cost_estimate.provider_cost_estimate).toBeGreaterThan(0);
    expect(blocked.cost_estimate.client_cost_estimate).toBeCloseTo(blocked.cost_estimate.provider_cost_estimate * 1.2, 4);
    expect(blocked.cost_estimate.margin_rate).toBe(0.2);
    expect(blocked.sub_batches).toHaveLength(0);
    expect(blocked.final_export).toBeUndefined();

    const confirmed = processBatchJob({
      job_id: 'job-cost-confirmed',
      intake_rows: createIntakeRows(1),
      target_languages: ['de', 'en', 'nl'],
      run_mode: 'premium-p1',
      cost_ceiling_eur: 0.01,
      cost_confirmed: true,
      continue_after_warning: true,
    });

    expect(confirmed.cost_estimate.requires_confirmation).toBe(true);
    expect(confirmed.sub_batches).toHaveLength(1);
    expect(confirmed.final_export).toBeDefined();
  });

  it('lean mode DE-only is cheaper than standard 5-language mode', () => {
    const lean = processBatchJob({
      job_id: 'job-cost-lean',
      intake_rows: createIntakeRows(3),
      run_mode: 'lean',
      target_languages: ['de'],
    });
    const standardAllLanguages = processBatchJob({
      job_id: 'job-cost-standard-all',
      intake_rows: createIntakeRows(3),
      run_mode: 'standard',
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      continue_after_warning: true,
    });

    expect(lean.cost_profile.run_mode).toBe('lean');
    expect(lean.cost_profile.max_faq_count).toBe(12);
    expect(lean.cost_profile.client_cost_estimate).toBeLessThan(standardAllLanguages.cost_profile.client_cost_estimate);
  });

  it('standard DE+EN is cheaper than standard DE+EN+ES+NL+FR', () => {
    const standardTwoLanguages = processBatchJob({
      job_id: 'job-cost-standard-two',
      intake_rows: createIntakeRows(3),
      run_mode: 'standard',
      target_languages: ['de', 'en'],
      continue_after_warning: true,
    });
    const standardFiveLanguages = processBatchJob({
      job_id: 'job-cost-standard-five',
      intake_rows: createIntakeRows(3),
      run_mode: 'standard',
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      continue_after_warning: true,
    });

    expect(standardTwoLanguages.cost_profile.selected_language_count).toBe(2);
    expect(standardFiveLanguages.cost_profile.selected_language_count).toBe(5);
    expect(standardTwoLanguages.cost_profile.client_cost_estimate).toBeLessThan(standardFiveLanguages.cost_profile.client_cost_estimate);
  });

  it('premium-p1 estimates higher cost than standard for the same URL count', () => {
    const standard = processBatchJob({
      job_id: 'job-cost-standard',
      intake_rows: createIntakeRows(3),
      run_mode: 'standard',
      target_languages: ['de', 'en'],
      continue_after_warning: true,
    });
    const premium = processBatchJob({
      job_id: 'job-cost-premium',
      intake_rows: createIntakeRows(3),
      run_mode: 'premium-p1',
      target_languages: ['de', 'en'],
      continue_after_warning: true,
    });

    expect(premium.cost_profile.max_faq_count).toBe(20);
    expect(premium.cost_profile.client_cost_estimate).toBeGreaterThan(standard.cost_profile.client_cost_estimate);
  });

  it('strategy_review_enabled only affects premium-p1', () => {
    const leanWithoutReview = processBatchJob({
      job_id: 'job-review-lean-off',
      intake_rows: createIntakeRows(2),
      run_mode: 'lean',
      strategy_review_enabled: false,
    });
    const leanWithReview = processBatchJob({
      job_id: 'job-review-lean-on',
      intake_rows: createIntakeRows(2),
      run_mode: 'lean',
      strategy_review_enabled: true,
    });
    const standardWithoutReview = processBatchJob({
      job_id: 'job-review-standard-off',
      intake_rows: createIntakeRows(2),
      run_mode: 'standard',
      strategy_review_enabled: false,
    });
    const standardWithReview = processBatchJob({
      job_id: 'job-review-standard-on',
      intake_rows: createIntakeRows(2),
      run_mode: 'standard',
      strategy_review_enabled: true,
    });
    const premiumWithoutReview = processBatchJob({
      job_id: 'job-review-premium-off',
      intake_rows: createIntakeRows(2),
      run_mode: 'premium-p1',
      strategy_review_enabled: false,
    });
    const premiumWithReview = processBatchJob({
      job_id: 'job-review-premium-on',
      intake_rows: createIntakeRows(2),
      run_mode: 'premium-p1',
      strategy_review_enabled: true,
    });

    expect(leanWithReview.cost_profile.estimated_tokens).toBe(leanWithoutReview.cost_profile.estimated_tokens);
    expect(standardWithReview.cost_profile.estimated_tokens).toBe(standardWithoutReview.cost_profile.estimated_tokens);
    expect(premiumWithReview.cost_profile.estimated_tokens).toBeGreaterThan(premiumWithoutReview.cost_profile.estimated_tokens);
  });

  it("target_languages ['de'] produces DE-only rows", () => {
    const result = processBatchJob({
      job_id: 'job-lang-de',
      intake_rows: createIntakeRows(1),
      target_languages: ['de'],
      run_mode: 'lean',
    });

    expect(languagesInResult(result)).toEqual(['de']);
    expect(result.final_export?.tabs.find((tab) => tab.name === 'Generated FAQ — Working')?.rows.every((row) => row[2] === 'de')).toBe(true);
  });

  it("target_languages ['de','en'] produces DE and EN rows only", () => {
    const result = processBatchJob({
      job_id: 'job-lang-de-en',
      intake_rows: createIntakeRows(1),
      target_languages: ['de', 'en'],
      run_mode: 'standard',
      continue_after_warning: true,
    });

    expect(languagesInResult(result)).toEqual(['de', 'en']);
    expect(languagesInResult(result)).not.toContain('es');
    expect(languagesInResult(result)).not.toContain('nl');
    expect(languagesInResult(result)).not.toContain('fr');
  });

  it("target_languages ['de','en','es','nl','fr'] produces all selected language rows", () => {
    const result = processBatchJob({
      job_id: 'job-lang-all',
      intake_rows: createIntakeRows(1),
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      run_mode: 'standard',
      continue_after_warning: true,
    });

    expect(languagesInResult(result)).toEqual(['de', 'en', 'es', 'fr', 'nl']);
  });

  it('quality checkpoint can pause processing after the first sub-batch', () => {
    const result = processBatchJob({
      job_id: 'job-quality-pause',
      intake_rows: createIntakeRows(13),
      target_languages: ['de', 'en'],
      run_mode: 'standard',
    });

    expect(result.status).toBe('Completed with Warnings');
    expect(result.sub_batches).toHaveLength(1);
    expect(result.accumulated_rows).toHaveLength(12);
    expect(result.sub_batches[0].quality_summary.total_faq_items).toBeGreaterThan(0);
    expect(result.sub_batches[0].quality_summary.needs_review_count).toBeGreaterThan(0);
    expect(result.sub_batches[0].quality_summary.should_pause).toBe(true);
    expect(result.sub_batches[0].preview_export).toBeDefined();
    expect(result.final_export).toBeUndefined();
  });

  it('continue_after_warning allows processing to continue', () => {
    const result = processBatchJob({
      job_id: 'job-quality-continue',
      intake_rows: createIntakeRows(13),
      target_languages: ['de', 'en'],
      run_mode: 'standard',
      continue_after_warning: true,
    });

    expect(result.sub_batches).toHaveLength(2);
    expect(result.accumulated_rows).toHaveLength(13);
    expect(result.sub_batches[0].quality_summary.should_pause).toBe(true);
    expect(result.final_export).toBeDefined();
  });

  it('batch_discount_available is true for jobs with more than 12 URLs', () => {
    expect(processUrlCount(12).cost_profile.batch_discount_available).toBe(false);
    expect(processUrlCount(13).cost_profile.batch_discount_available).toBe(true);
  });

  it('prompt_cache_expected is true for stable future playbook and prompt prefixes', () => {
    expect(processUrlCount(1).cost_profile.prompt_cache_expected).toBe(true);
  });

  it('uses only Section 5.1 job status values', () => {
    const result = processUrlCount(3);
    const blocked = processBatchJob({
      job_id: 'job-status-cost',
      intake_rows: createIntakeRows(300),
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      run_mode: 'premium-p1',
      cost_ceiling_eur: 50,
    });

    for (const status of [...result.statuses, result.status, ...blocked.statuses, blocked.status]) {
      expect(JOB_STATUSES).toContain(status);
    }
  });
});
