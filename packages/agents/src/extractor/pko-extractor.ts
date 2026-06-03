import type { IntakeRow } from '../../../core/src/types/intake';
import type { ClaimFlagged, FmoMapping, ProductKnowledgeObject } from '../../../core/src/types/pko';
import type { SourceLanguage } from '../../../core/src/constants/enums';
import type { CrawledPageData } from './url-crawler';
import { detectClaimRisk } from './claim-risk';

/**
 * Section 2.3 URL Crawler & Extractor Agent.
 * Build a valid partial PKO from validated intake and observable page text.
 */

function normalizeTextItems(items: string[] = []): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function inferLanguage(intakeRow: IntakeRow, sourceUrl: string): { language: SourceLanguage; confidence: number } {
  if (intakeRow.source_language) {
    return { language: intakeRow.source_language, confidence: 0.95 };
  }

  const localeMatch = sourceUrl.match(/\/(de|en|es|nl|fr)(?:\/|$)/i);
  if (localeMatch?.[1]) {
    return { language: localeMatch[1].toLowerCase() as SourceLanguage, confidence: 0.85 };
  }

  return { language: 'en', confidence: 0.0 };
}

export function createPartialPKO(intakeRow: IntakeRow, pageData: CrawledPageData): ProductKnowledgeObject {
  const languageInfo = inferLanguage(intakeRow, pageData.url);
  const features = normalizeTextItems([...pageData.headings, ...pageData.listItems]);
  const claims_flagged = detectClaimRisk(pageData.text, pageData.url);
  const page_weaknesses = features.length > 0 ? features : [];

  return {
    pko_id: `pko-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    source_url: intakeRow.url,
    product_name: pageData.title || intakeRow.product_id || intakeRow.url,
    category: intakeRow.category,
    product_family: intakeRow.product_family ?? '',
    source_language_detected: languageInfo.language,
    source_language_confidence: languageInfo.confidence,
    features,
    fmo_mappings: [] as FmoMapping[],
    benefits_explicit: [],
    benefits_missing: [],
    materials: [],
    compatibility: [],
    care_instructions: [],
    warranty_service: [],
    use_cases: [],
    claims_flagged,
    page_weaknesses,
    knowledgebase_chunks_used: [],
    pko_version: '1.0.0',
    created_at: new Date().toISOString(),
  };
}
