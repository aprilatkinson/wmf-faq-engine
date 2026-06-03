import type { FaqItem, RiskFlag } from '../../core/src/types/faq';
import type { IntakeRow } from '../../core/src/types/intake';

export type WorkbookCell = string | number | boolean | null;

export interface WorkbookTab {
  name: string;
  headers: string[];
  rows: WorkbookCell[][];
}

export interface JobCostLogRow {
  job_id: string;
  url: string;
  step: string;
  model: string;
  tokens: number;
  estimated_cost: number;
}

export interface AccumulatedJobUrlRow {
  job_id: string;
  intake: IntakeRow;
  faq_items: FaqItem[];
  warnings?: RiskFlag[];
}

export interface JobWorkbookInput {
  job_id: string;
  brand: string;
  rows: AccumulatedJobUrlRow[];
  mode?: string;
  created_at?: string;
  cost_log?: JobCostLogRow[];
}

export interface JobWorkbook {
  job_id: string;
  filename: string;
  tabs: WorkbookTab[];
  excelXml: string;
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

function purposeTags(faq: FaqItem): string {
  return faq.purpose_tags.join(', ');
}

function benefitAngle(faq: FaqItem): string {
  return Object.entries(faq.fmo_coverage)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
    .join(', ');
}

function allFaqRows(rows: AccumulatedJobUrlRow[]): Array<{ row: AccumulatedJobUrlRow; faq: FaqItem }> {
  return rows.flatMap((row) => row.faq_items.map((faq) => ({ row, faq })));
}

function riskFlagRows(rows: AccumulatedJobUrlRow[]): WorkbookCell[][] {
  const output: WorkbookCell[][] = [];

  for (const row of rows) {
    for (const warning of row.warnings ?? []) {
      output.push([row.intake.url, row.intake.product_id ?? '', warning.flag_type, warning.description, warning.severity, 'Review']);
    }

    for (const faq of row.faq_items) {
      for (const flag of faq.risk_flags) {
        output.push([row.intake.url, row.intake.product_id ?? '', flag.flag_type, flag.description, flag.severity, 'Review FAQ']);
      }
    }
  }

  return output;
}

function faqSchemaJson(faq: FaqItem): string {
  return compactJson({
    '@context': 'https://schema.org',
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  });
}

function buildTabs(input: JobWorkbookInput): WorkbookTab[] {
  const faqRows = allFaqRows(input.rows);
  const approvedFaqRows = faqRows.filter(({ faq }) => faq.status === 'approved');
  const reviewFaqRows = faqRows.filter(({ faq }) => faq.status === 'needs-review');
  const languages = uniqueValues(faqRows.map(({ faq }) => faq.language));
  const warningRows = riskFlagRows(input.rows);
  const failedUrlCount = input.rows.filter((row) => row.faq_items.length === 0).length;
  const completedUrlCount = input.rows.length - failedUrlCount;

  return [
    {
      name: 'Job Summary',
      headers: ['job_id', 'url_count', 'completed', 'warnings', 'failed', 'languages', 'date', 'mode'],
      rows: [[input.job_id, input.rows.length, completedUrlCount, warningRows.length, failedUrlCount, languages.join(', '), input.created_at ?? '', input.mode ?? '']],
    },
    {
      name: 'Product Intake',
      headers: ['row_id', 'product_id', 'url', 'page_type', 'category', 'product_family', 'variant_group_id', 'priority', 'source_language'],
      rows: input.rows.map(({ intake }) => [
        intake.row_id,
        intake.product_id ?? '',
        intake.url,
        intake.page_type,
        intake.category,
        intake.product_family ?? '',
        intake.variant_group_id ?? '',
        intake.priority,
        intake.source_language ?? '',
      ]),
    },
    {
      name: 'Generated FAQ — Working',
      headers: [
        'product_id',
        'url',
        'language',
        'faq_id',
        'question',
        'answer',
        'purpose',
        'benefit_angle',
        'fact_fidelity',
        'fmo_benefit',
        'ai_visibility',
        'human_tone',
        'localization',
        'claim_risk_pass',
        'status',
      ],
      rows: faqRows.map(({ row, faq }) => [
        row.intake.product_id ?? '',
        row.intake.url,
        faq.language,
        faq.faq_id,
        faq.question,
        faq.answer,
        purposeTags(faq),
        benefitAngle(faq),
        faq.evaluator_scores.fact_fidelity,
        faq.evaluator_scores.fmo_benefit,
        faq.evaluator_scores.ai_visibility,
        faq.evaluator_scores.human_tone,
        faq.evaluator_scores.localization,
        faq.claim_risk_pass,
        faq.status,
      ]),
    },
    {
      name: 'Client Review Needed',
      headers: ['product_id', 'url', 'language', 'question', 'answer', 'flag_description', 'severity', 'action_needed'],
      rows: reviewFaqRows.map(({ row, faq }) => [
        row.intake.product_id ?? '',
        row.intake.url,
        faq.language,
        faq.question,
        faq.answer,
        faq.risk_flags.map((flag) => flag.description).join(' | '),
        faq.risk_flags.map((flag) => flag.severity).join(' | '),
        'Review before publishing',
      ]),
    },
    {
      name: 'Approved FAQ',
      headers: ['product_id', 'url', 'language', 'question', 'answer'],
      rows: approvedFaqRows.map(({ row, faq }) => [row.intake.product_id ?? '', row.intake.url, faq.language, faq.question, faq.answer]),
    },
    {
      name: 'CMS Export',
      headers: ['page_url', 'locale', 'faq_question', 'faq_answer', 'sort_order', 'active'],
      rows: approvedFaqRows.map(({ row, faq }, index) => [row.intake.url, faq.language, faq.question, faq.answer, index + 1, true]),
    },
    {
      name: 'JSON-LD Schema',
      headers: ['page_url', 'locale', 'faq_schema_json'],
      rows: approvedFaqRows.map(({ row, faq }) => [row.intake.url, faq.language, faqSchemaJson(faq)]),
    },
    {
      name: 'Evaluation Results',
      headers: ['product_id', 'url', 'language', 'faq_id', 'fact_fidelity', 'fmo_benefit', 'ai_visibility', 'human_tone', 'localization', 'claim_risk_pass', 'rewrite_count'],
      rows: faqRows.map(({ row, faq }) => [
        row.intake.product_id ?? '',
        row.intake.url,
        faq.language,
        faq.faq_id,
        faq.evaluator_scores.fact_fidelity,
        faq.evaluator_scores.fmo_benefit,
        faq.evaluator_scores.ai_visibility,
        faq.evaluator_scores.human_tone,
        faq.evaluator_scores.localization,
        faq.claim_risk_pass,
        faq.rewrite_count,
      ]),
    },
    {
      name: 'Warnings & Risk Flags',
      headers: ['url', 'product_id', 'issue_type', 'description', 'severity', 'action_needed'],
      rows: warningRows,
    },
    {
      name: 'Cost Log',
      headers: ['job_id', 'url', 'step', 'model', 'tokens', 'estimated_cost'],
      rows: (input.cost_log ?? []).map((row) => [row.job_id, row.url, row.step, row.model, row.tokens, row.estimated_cost]),
    },
  ];
}

function escapeXml(value: WorkbookCell): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function worksheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
}

export function serializeWorkbookTabsToExcelXml(tabs: WorkbookTab[]): string {
  const worksheets = tabs
    .map((tab) => {
      const rows = [tab.headers, ...tab.rows]
        .map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`)
        .join('');

      return `<Worksheet ss:Name="${escapeXml(worksheetName(tab.name))}"><Table>${rows}</Table></Worksheet>`;
    })
    .join('');

  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheets}</Workbook>`;
}

export function buildJobWorkbookTabs(input: JobWorkbookInput): WorkbookTab[] {
  const jobIds = uniqueValues(input.rows.map((row) => row.job_id));
  if (jobIds.length > 1 || (jobIds[0] && jobIds[0] !== input.job_id)) {
    throw new Error('All accumulated export rows must belong to the requested job_id.');
  }

  return buildTabs(input);
}

export function exportJobWorkbook(input: JobWorkbookInput): JobWorkbook {
  const tabs = buildJobWorkbookTabs(input);
  const date = input.created_at ? input.created_at.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const safeBrand = input.brand.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Brand';

  return {
    job_id: input.job_id,
    filename: `FAQ_Output_${safeBrand}_${date}_Job_${input.job_id}.xlsx`,
    tabs,
    excelXml: serializeWorkbookTabsToExcelXml(tabs),
  };
}
