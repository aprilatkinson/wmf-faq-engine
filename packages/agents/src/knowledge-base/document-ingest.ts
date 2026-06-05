export type KnowledgeSourceType = 'product-document' | 'review-intelligence' | 'category-playbook' | 'claim-guidance';

export interface ProductDocumentInput {
  title: string;
  source_type: 'product-document';
  language: string;
  content: string;
  category?: string;
}

export interface ProductDocumentRecord extends ProductDocumentInput {
  document_id: string;
  ingested_at: string;
}

function stableId(prefix: string, values: string[]): string {
  return `${prefix}-${values.join('|').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}`;
}

export function ingestProductDocument(input: ProductDocumentInput): ProductDocumentRecord {
  return {
    ...input,
    document_id: stableId('doc', [input.category ?? 'uncategorized', input.language, input.title]),
    ingested_at: '2026-06-04T00:00:00.000Z',
  };
}
