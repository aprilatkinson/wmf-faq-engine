import { describe, expect, it } from 'vitest';
import type { FaqItem } from '../../../core/src/types/faq';
import type { IntakeRow } from '../../../core/src/types/intake';
import { buildJobWorkbookTabs, exportJobWorkbook, type AccumulatedJobUrlRow } from '../excel-exporter';

function createFaq(index: number, overrides: Partial<FaqItem> = {}): FaqItem {
  return {
    faq_id: `faq-${index}`,
    pko_id: `pko-${index}`,
    question: `Question ${index}?`,
    answer: `Answer ${index}.`,
    language: 'de',
    is_master: true,
    purpose_tags: ['expectation'],
    fmo_coverage: { feature: true, mechanism: true, outcome: true, use_case: false, buyer_relevance: false },
    source_evidence: [`Evidence ${index}`],
    evaluator_scores: { fact_fidelity: 2, fmo_benefit: 2, ai_visibility: 2, human_tone: 2, localization: null },
    claim_risk_pass: true,
    risk_flags: [],
    status: 'approved',
    rewrite_count: 0,
    schema_ready: true,
    version: '1.0.0',
    created_at: '2026-06-03T00:00:00.000Z',
    ...overrides,
  };
}

function createIntake(index: number): IntakeRow {
  return {
    row_id: `row-${index}`,
    product_id: `product-${index}`,
    url: `https://example.com/product-${index}`,
    page_type: 'PDP',
    category: 'Cookware',
    product_family: 'Devil',
    priority: 'P1',
    source_language: 'de',
  };
}

function createRows(job_id: string, urlCount: number): AccumulatedJobUrlRow[] {
  return Array.from({ length: urlCount }, (_, index) => ({
    job_id,
    intake: createIntake(index + 1),
    faq_items: [createFaq(index + 1)],
  }));
}

function exportForUrlCount(urlCount: number) {
  return exportJobWorkbook({
    job_id: 'job-phase-8',
    brand: 'WMF',
    created_at: '2026-06-03T00:00:00.000Z',
    mode: 'URL-Only',
    rows: createRows('job-phase-8', urlCount),
  });
}

describe('Phase 8 Excel exporter starter', () => {
  it('exports one workbook for a 1 URL job', () => {
    const workbook = exportForUrlCount(1);

    expect(workbook.job_id).toBe('job-phase-8');
    expect(workbook.filename).toBe('FAQ_Output_WMF_2026-06_Job_job-phase-8.xlsx');
    expect(workbook.tabs).toHaveLength(10);
    expect(workbook.tabs.find((tab) => tab.name === 'Product Intake')?.rows).toHaveLength(1);
    expect(workbook.excelXml).toContain('<Workbook');
  });

  it('exports one workbook for a 3 URL job', () => {
    const workbook = exportForUrlCount(3);

    expect(workbook.tabs).toHaveLength(10);
    expect(workbook.tabs.find((tab) => tab.name === 'Job Summary')?.rows[0][1]).toBe(3);
    expect(workbook.tabs.find((tab) => tab.name === 'Generated FAQ — Working')?.rows).toHaveLength(3);
  });

  it('exports one workbook for a 300 URL job', () => {
    const workbook = exportForUrlCount(300);

    expect(workbook.tabs).toHaveLength(10);
    expect(workbook.tabs.find((tab) => tab.name === 'Job Summary')?.rows[0][1]).toBe(300);
    expect(workbook.tabs.find((tab) => tab.name === 'Product Intake')?.rows).toHaveLength(300);
    expect(workbook.tabs.find((tab) => tab.name === 'Generated FAQ — Working')?.rows).toHaveLength(300);
  });

  it('uses one accumulated tab model instead of creating sub-batch workbooks', () => {
    const rows = [...createRows('job-phase-8', 12), ...createRows('job-phase-8', 12), ...createRows('job-phase-8', 1)];
    const workbook = exportJobWorkbook({
      job_id: 'job-phase-8',
      brand: 'WMF',
      created_at: '2026-06-03T00:00:00.000Z',
      rows,
    });

    expect(workbook.tabs.find((tab) => tab.name === 'Product Intake')?.rows).toHaveLength(25);
    expect(workbook.filename).toContain('Job_job-phase-8');
  });

  it('rejects accumulated rows from more than one job_id', () => {
    expect(() =>
      buildJobWorkbookTabs({
        job_id: 'job-phase-8',
        brand: 'WMF',
        rows: [...createRows('job-phase-8', 1), ...createRows('other-job', 1)],
      }),
    ).toThrow(/job_id/);
  });

  it('uses the exact Section 5.3 tab names', () => {
    const workbook = exportForUrlCount(1);

    expect(workbook.tabs.map((tab) => tab.name)).toEqual([
      'Job Summary',
      'Product Intake',
      'Generated FAQ — Working',
      'Client Review Needed',
      'Approved FAQ',
      'CMS Export',
      'JSON-LD Schema',
      'Evaluation Results',
      'Warnings & Risk Flags',
      'Cost Log',
    ]);
  });

  it('keeps client-facing tabs clean', () => {
    const workbook = exportForUrlCount(1);
    const reviewTab = workbook.tabs.find((tab) => tab.name === 'Client Review Needed');
    const approvedTab = workbook.tabs.find((tab) => tab.name === 'Approved FAQ');
    const cmsTab = workbook.tabs.find((tab) => tab.name === 'CMS Export');

    expect(reviewTab?.headers).toEqual(['product_id', 'url', 'language', 'question', 'answer', 'flag_description', 'severity', 'action_needed']);
    expect(approvedTab?.headers).toEqual(['product_id', 'url', 'language', 'question', 'answer']);
    expect(cmsTab?.headers).toEqual(['page_url', 'locale', 'faq_question', 'faq_answer', 'sort_order', 'active']);

    for (const tab of [reviewTab, approvedTab, cmsTab]) {
      expect(tab?.headers).not.toContain('faq_id');
      expect(tab?.headers).not.toContain('fact_fidelity');
      expect(tab?.headers).not.toContain('fmo_benefit');
      expect(tab?.headers).not.toContain('ai_visibility');
      expect(tab?.headers).not.toContain('human_tone');
      expect(tab?.headers).not.toContain('localization');
      expect(tab?.headers).not.toContain('claim_risk_pass');
      expect(tab?.headers).not.toContain('rewrite_count');
      expect(tab?.headers).not.toContain('estimated_cost');
      expect(tab?.headers).not.toContain('agent_notes');
    }
  });
});
