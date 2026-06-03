export * from './extractor/url-crawler';
export * from './extractor/pko-extractor';
export * from './extractor/claim-risk';
export * from './benefit-mapper';

import type { IntakeRow } from '../../core/src/types/intake';
import type { ProductKnowledgeObject } from '../../core/src/types/pko';
import { crawlUrl } from './extractor/url-crawler';
import { createPartialPKO } from './extractor/pko-extractor';

/**
 * Section 2.3 URL Crawler & Extractor Agent.
 * Convenience helper to crawl one validated intake row URL and return a partial PKO.
 */
export async function extractPartialPKO(intakeRow: IntakeRow): Promise<ProductKnowledgeObject> {
	const pageData = await crawlUrl(intakeRow.url);
	return createPartialPKO(intakeRow, pageData);
}
