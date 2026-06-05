import { describe, expect, it } from 'vitest';
import { faqItemSchema } from '../../../core/src/schemas/faq.schema';
import type { FaqItem } from '../../../core/src/types/faq';
import type { IntakeRow } from '../../../core/src/types/intake';
import type { VariantGroupMetadata } from '../variant-grouping';
import { adaptFaqForVariant, adaptFaqsForVariant, extractVariantContext } from '../variant-adapter';
import { processBatchJob } from '../job-processor';

const reusableGroup: VariantGroupMetadata = {
  variant_group_key: 'devil|frying-pan|non-stick|fixture',
  canonical_url: 'https://example.com/devil-non-stick-frying-pan-24-cm.html',
  variant_urls: [
    'https://example.com/devil-non-stick-frying-pan-24-cm.html',
    'https://example.com/devil-non-stick-frying-pan-28-cm.html',
  ],
  variant_dimensions: ['24cm', '28cm'],
  grouping_reason: 'same family, product type, and coating with size or set-composition variants',
  requires_unique_generation: false,
};

const uniqueGroup: VariantGroupMetadata = {
  ...reusableGroup,
  variant_group_key: 'devil|unique',
  requires_unique_generation: true,
};

function row(id: string, url: string, productId = id): IntakeRow {
  return {
    row_id: id,
    product_id: productId,
    url,
    page_type: 'PDP',
    category: 'Cookware',
    product_family: 'Devil',
    priority: 'P2',
    source_language: 'de',
  };
}

function faq(): FaqItem {
  return {
    faq_id: 'faq-1',
    pko_id: 'pko-1',
    question: 'Is this pan suitable for everyday frying?',
    answer: 'The supported product information describes everyday frying use.',
    language: 'de',
    is_master: true,
    purpose_tags: ['ai-visibility'],
    fmo_coverage: {
      feature: true,
      mechanism: true,
      outcome: true,
      use_case: true,
      buyer_relevance: true,
    },
    source_evidence: ['URL fixture: Devil non-stick frying pan variants'],
    evaluator_scores: {
      fact_fidelity: 2,
      fmo_benefit: 2,
      ai_visibility: 2,
      human_tone: 2,
      localization: null,
    },
    claim_risk_pass: true,
    risk_flags: [],
    status: 'approved',
    rewrite_count: 0,
    schema_ready: true,
    version: '1.0.0',
    created_at: '2026-06-04T00:00:00.000Z',
  };
}

describe('Variant FAQ adapter scaffold', () => {
  it('adds size-specific question wording for 24 cm and 28 cm variants', () => {
    const base = faq();
    const adapted24 = adaptFaqForVariant(base, row('row-24', 'https://example.com/devil-non-stick-frying-pan-24-cm.html'), reusableGroup);
    const adapted28 = adaptFaqForVariant(base, row('row-28', 'https://example.com/devil-non-stick-frying-pan-28-cm.html'), reusableGroup);

    expect(adapted24.question).toContain('24 cm');
    expect(adapted28.question).toContain('28 cm');
    expect(adapted24.question).not.toBe(adapted28.question);
  });

  it('adds set-composition wording for 2-piece and 3-piece variants', () => {
    const adapted2 = adaptFaqForVariant(
      faq(),
      row('row-set-2', 'https://example.com/devil-bratpfannen-set-2-teilig-24-cm-28-cm.html'),
      reusableGroup,
    );
    const adapted3 = adaptFaqForVariant(
      faq(),
      row('row-set-3', 'https://example.com/devil-bratpfannen-set-3-teilig-20-cm-24-cm-28-cm.html'),
      reusableGroup,
    );

    expect(extractVariantContext(row('row-set-2', 'https://example.com/devil-bratpfannen-set-2-teilig-24-cm-28-cm.html'), reusableGroup).set_composition).toBe('2-piece');
    expect(adapted2.question).toContain('2-piece');
    expect(adapted3.question).toContain('3-piece');
    expect(adapted2.question).not.toBe(adapted3.question);
  });

  it('adds included accessory wording for set variants', () => {
    const setRow = row('row-set-turner', 'https://example.com/durado-bratpfannen-set-2-teilig-24-cm-28-cm-mit-pfannenwender.html');
    const context = extractVariantContext(setRow, reusableGroup);
    const adapted = adaptFaqForVariant(faq(), setRow, reusableGroup);

    expect(context.accessory_included).toBe('turner');
    expect(adapted.question).toContain('with turner');
    expect(adapted.answer).toContain('with turner');
  });

  it('preserves source evidence and does not add unsafe claims', () => {
    const base = faq();
    const adapted = adaptFaqForVariant(base, row('row-24', 'https://example.com/devil-non-stick-frying-pan-24-cm.html'), reusableGroup);
    const text = `${adapted.question} ${adapted.answer}`;

    expect(adapted.source_evidence).toEqual(base.source_evidence);
    expect(text).not.toMatch(/scratch-proof|rust-proof|made in germany|oven-safe|lifetime|pfas-free|pfoa-free|ptfe-free/i);
  });

  it('returns unchanged FAQ when the group requires unique generation', () => {
    const base = faq();
    const adapted = adaptFaqForVariant(base, row('row-24', 'https://example.com/devil-non-stick-frying-pan-24-cm.html'), uniqueGroup);

    expect(adapted).toBe(base);
  });

  it('returns unchanged FAQ when no safe variant detail exists', () => {
    const base = faq();
    const adapted = adaptFaqForVariant(base, row('row-plain', 'https://example.com/devil.html', 'devil'), reusableGroup);

    expect(adapted).toBe(base);
  });

  it('keeps adapted FAQ items schema-valid', () => {
    const [adapted] = adaptFaqsForVariant([faq()], row('row-28', 'https://example.com/devil-non-stick-frying-pan-28-cm.html'), reusableGroup);

    expect(faqItemSchema.safeParse(adapted).success).toBe(true);
  });

  it('job processor emits one row per URL and distinct size-specific questions for grouped variants', () => {
    const result = processBatchJob({
      job_id: 'job-variant-adapter',
      intake_rows: [
        row('job-row-24', 'https://example.com/wmf-devil-non-stick-frying-pan-24-cm.html', 'devil-pan-24'),
        row('job-row-28', 'https://example.com/wmf-devil-non-stick-frying-pan-28-cm.html', 'devil-pan-28'),
      ],
      target_languages: ['de'],
      run_mode: 'lean',
      continue_after_warning: true,
      created_at: '2026-06-04T00:00:00.000Z',
    });

    expect(result.accumulated_rows).toHaveLength(2);
    const firstQuestions = result.accumulated_rows.map((outputRow) => outputRow.faq_items[0]?.question);
    expect(firstQuestions[0]).toContain('24 cm');
    expect(firstQuestions[1]).toContain('28 cm');
    expect(firstQuestions[0]).not.toBe(firstQuestions[1]);
  });
});
