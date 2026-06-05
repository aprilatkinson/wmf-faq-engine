export interface CategoryPlaybookInput {
  category: string;
  opportunities: string[];
  care_guidance: string[];
  comparison_guidance: string[];
  upsell_guidance: string[];
}

export interface CategoryPlaybookRecord extends CategoryPlaybookInput {
  playbook_id: string;
  source_type: 'category-playbook';
  ingested_at: string;
}

function stableId(category: string): string {
  return `playbook-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export function ingestCategoryPlaybook(input: CategoryPlaybookInput): CategoryPlaybookRecord {
  return {
    ...input,
    playbook_id: stableId(input.category),
    source_type: 'category-playbook',
    ingested_at: '2026-06-04T00:00:00.000Z',
  };
}
