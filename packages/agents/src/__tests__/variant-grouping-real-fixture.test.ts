import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { IntakeRow } from '../../../core/src/types/intake';
import { groupIntakeRows } from '../variant-grouping';

const PDF_FIXTURE_PATH = '/Users/april/Documents/New Note.pdf';

function normalizePdfText(text: string): string {
  return text
    .replace(/\u00ad/g, '-')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n');
}

function repairWrappedUrls(text: string): string {
  return normalizePdfText(text)
    .replace(/-\s*\n\s*/g, '-')
    .replace(/(https?:\/\/[^\s<>)]+)\s*\n\s*([a-z0-9][a-z0-9._~:/?#[\]@!$&'()*+,;=%-]*)/gi, '$1$2');
}

function extractWmfUrlsFromPdf(path: string): string[] {
  const text = repairWrappedUrls(readFileSync(path).toString('latin1'));
  const urls = [...text.matchAll(/https?:\/\/[^\s<>)]+/g)]
    .map((match) => match[0].replace(/[.,;:]+$/g, ''))
    .filter((url) => url.includes('wmf.com/de/de/'));

  return urls;
}

function productIdFromUrl(url: string): string {
  return url
    .split(/[?#]/)[0]
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.replace(/\.html$/i, '') ?? 'wmf-url';
}

function intakeRowsFromUrls(urls: string[]): IntakeRow[] {
  return urls.map((url, index) => ({
    row_id: `wmf-fixture-${index + 1}`,
    product_id: productIdFromUrl(url),
    url,
    page_type: 'PDP',
    category: 'Cookware',
    priority: 'P2',
    source_language: 'de',
  }));
}

describe('Temporary WMF URL fixture variant grouping report', () => {
  it('reports grouping stats for the uploaded WMF URL fixture', () => {
    const extractedUrls = extractWmfUrlsFromPdf(PDF_FIXTURE_PATH);
    const uniqueUrls = Array.from(new Set(extractedUrls));
    const result = groupIntakeRows(intakeRowsFromUrls(uniqueUrls));
    const reusableGroups = result.groups.filter((group) => !group.requires_unique_generation);
    const uniqueGenerationGroups = result.groups.filter((group) => group.requires_unique_generation);
    const duplicateOrVariantUrls = uniqueUrls.length - result.groups.length;
    const estimatedSavingsPercent = Number(((duplicateOrVariantUrls / uniqueUrls.length) * 100).toFixed(2));
    const topGroups = [...result.groups]
      .sort((left, right) => right.variant_urls.length - left.variant_urls.length)
      .slice(0, 30)
      .map((group) => ({
        count: group.variant_urls.length,
        requires_unique_generation: group.requires_unique_generation,
        reason: group.grouping_reason,
        dimensions: group.variant_dimensions,
        canonical_url: group.canonical_url,
      }));

    console.info(
      JSON.stringify(
        {
          total_extracted_urls: extractedUrls.length,
          unique_urls: uniqueUrls.length,
          variant_group_count: result.groups.length,
          groups_requiring_unique_generation: uniqueGenerationGroups.length,
          groups_reusable_across_variants: reusableGroups.length,
          estimated_duplicate_variant_urls: duplicateOrVariantUrls,
          estimated_savings_percent: estimatedSavingsPercent,
          top_30_groups_by_variant_urls_length: topGroups,
        },
        null,
        2,
      ),
    );

    expect(extractedUrls.length).toBeGreaterThan(200);
    expect(result.groups.length).toBeLessThan(uniqueUrls.length);
    expect(result.groups.some((group) => group.variant_urls.length > 1)).toBe(true);
  });
});
