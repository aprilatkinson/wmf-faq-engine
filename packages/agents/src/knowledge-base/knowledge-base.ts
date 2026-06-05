export const KNOWLEDGE_DOCUMENT_TYPES = [
  'Product Fact Sheet',
  'Benefit Hierarchy',
  'Category Playbook',
  'Claim Rules',
  'Review Intelligence',
  'Brand Voice Guide',
  'Translation Glossary',
  'Approved FAQ Examples',
] as const;

export type KnowledgeDocumentType = (typeof KNOWLEDGE_DOCUMENT_TYPES)[number];
export type ClaimSensitivity = 'low' | 'medium' | 'high';

export interface KnowledgeBaseDocumentMetadata {
  brand: string;
  category: string;
  product_family: string;
  market: string;
  language: string;
  document_type: KnowledgeDocumentType;
  claim_sensitivity: ClaimSensitivity;
  approved_for_use: boolean;
  approved_at: string | null;
  version: string;
}

export interface KnowledgeBaseDocumentInput extends KnowledgeBaseDocumentMetadata {
  title: string;
  content: string;
}

export interface KnowledgeBaseDocumentRecord extends KnowledgeBaseDocumentInput {
  document_id: string;
  registered_at: string;
}

export interface KnowledgebaseAvailability {
  has_approved_knowledgebase: boolean;
  approved_documents: KnowledgeBaseDocumentRecord[];
  warning?: string;
}

export interface KnowledgeMatchInput {
  brand?: string;
  category: string;
  product_family: string;
  market?: string;
  language?: string;
}

export type ClaimGovernanceStatus = 'approved' | 'review-required' | 'blocked';

export interface ClaimGuidanceEvaluationOptions {
  market: string;
  language: string;
  hasEvidence?: boolean;
  hasApprovedSource?: boolean;
  hasPositioningEvidence?: boolean;
  claimRules: KnowledgeBaseDocumentRecord[];
}

export interface ClaimGuidanceEvaluation {
  status: ClaimGovernanceStatus;
  category: 'compatibility' | 'durability' | 'health' | 'safety' | 'performance' | 'material' | 'repairability' | 'comparison';
  reason: string;
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function stableId(input: KnowledgeBaseDocumentInput): string {
  return [
    'kb',
    input.brand,
    input.category,
    input.product_family,
    input.market,
    input.language,
    input.document_type,
    input.version,
    input.title,
  ]
    .join('|')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function assertSupportedDocumentType(documentType: KnowledgeDocumentType): void {
  if (!KNOWLEDGE_DOCUMENT_TYPES.includes(documentType)) {
    throw new Error(`Unsupported knowledge document type: ${documentType}`);
  }
}

function matchesDocument(record: KnowledgeBaseDocumentRecord, input: KnowledgeMatchInput): boolean {
  const brandMatches = !input.brand || normalize(record.brand) === normalize(input.brand);
  const marketMatches = !input.market || normalize(record.market) === normalize(input.market);
  const languageMatches = !input.language || normalize(record.language) === normalize(input.language);

  return (
    brandMatches &&
    marketMatches &&
    languageMatches &&
    normalize(record.category) === normalize(input.category) &&
    normalize(record.product_family) === normalize(input.product_family)
  );
}

function matchesClaimRulesDocument(record: KnowledgeBaseDocumentRecord, input: KnowledgeMatchInput): boolean {
  const brandMatches = !input.brand || normalize(record.brand) === normalize(input.brand);
  const marketMatches = !input.market || normalize(record.market) === normalize(input.market);
  const languageMatches = !input.language || normalize(record.language) === normalize(input.language);
  const productFamily = normalize(record.product_family);
  const productFamilyMatches = productFamily === '' || productFamily === 'all' || productFamily === 'global' || normalize(record.product_family) === normalize(input.product_family);

  return (
    brandMatches &&
    marketMatches &&
    languageMatches &&
    productFamilyMatches &&
    normalize(record.category) === normalize(input.category)
  );
}

export class KnowledgeBaseRegistry {
  private documents: KnowledgeBaseDocumentRecord[] = [];

  registerDocument(input: KnowledgeBaseDocumentInput): KnowledgeBaseDocumentRecord {
    assertSupportedDocumentType(input.document_type);
    const record: KnowledgeBaseDocumentRecord = {
      ...input,
      document_id: stableId(input),
      registered_at: '2026-06-05T00:00:00.000Z',
    };
    this.documents.push(record);
    return record;
  }

  listDocuments(): KnowledgeBaseDocumentRecord[] {
    return [...this.documents];
  }

  findApprovedDocuments(input: KnowledgeMatchInput): KnowledgeBaseDocumentRecord[] {
    return this.documents.filter((record) => record.approved_for_use === true && matchesDocument(record, input));
  }

  findApprovedCategoryPlaybooks(input: KnowledgeMatchInput): KnowledgeBaseDocumentRecord[] {
    return this.findApprovedDocuments(input).filter((record) => record.document_type === 'Category Playbook');
  }

  findApprovedReviewIntelligence(input: KnowledgeMatchInput): KnowledgeBaseDocumentRecord[] {
    return this.findApprovedDocuments(input).filter((record) => record.document_type === 'Review Intelligence');
  }

  findApprovedClaimRules(input: KnowledgeMatchInput): KnowledgeBaseDocumentRecord[] {
    return this.documents.filter((record) => record.approved_for_use === true && record.document_type === 'Claim Rules' && matchesClaimRulesDocument(record, input));
  }

  hasApprovedKnowledge(input: KnowledgeMatchInput): boolean {
    return this.findApprovedDocuments(input).length > 0;
  }

  getAvailability(input: KnowledgeMatchInput): KnowledgebaseAvailability {
    const approved_documents = this.findApprovedDocuments(input);
    if (approved_documents.length > 0) {
      return {
        has_approved_knowledgebase: true,
        approved_documents,
      };
    }

    return {
      has_approved_knowledgebase: false,
      approved_documents,
      warning: `No approved knowledgebase found for ${input.category} > ${input.product_family}`,
    };
  }
}

function matrixStatus(claimText: string, marketOrLanguage: string): ClaimGovernanceStatus | undefined {
  const market = normalize(marketOrLanguage);
  if (/dishwasher-suitable|dishwasher suitable|spülmaschinengeeignet|spuelmaschinengeeignet/i.test(claimText)) {
    return ['de', 'en', 'nl'].includes(market) ? 'approved' : ['es', 'fr'].includes(market) ? 'review-required' : undefined;
  }
  if (/18\/10 stainless steel|18\/10 edelstahl/i.test(claimText)) {
    return ['de', 'en', 'nl'].includes(market) ? 'approved' : ['es', 'fr'].includes(market) ? 'review-required' : undefined;
  }
  if (/corrosion-resistant|corrosion resistant|korrosionsbeständig|korrosionsbestaendig/i.test(claimText)) {
    return 'review-required';
  }
  return undefined;
}

function hasRuleIntent(content: string, pattern: RegExp): boolean {
  return pattern.test(content.toLowerCase());
}

export function evaluateClaimGuidance(claimText: string, options: ClaimGuidanceEvaluationOptions): ClaimGuidanceEvaluation {
  const claim = claimText.toLowerCase();
  const rules = options.claimRules.map((rule) => rule.content).join('\n').toLowerCase();
  const matrix = matrixStatus(claimText, options.language) ?? matrixStatus(claimText, options.market);

  if (/scratch-proof|scratch proof|kratzfest|kratzerfrei/.test(claim)) {
    return { status: 'blocked', category: 'durability', reason: 'scratch-proof is blocked by claim rules' };
  }
  if (/induction/.test(claim) && hasRuleIntent(rules, /block induction|induction blocked|induction restricted/)) {
    return { status: 'blocked', category: 'compatibility', reason: 'induction claim is blocked by approved claim rules' };
  }
  if (/dishwasher/.test(claim) && hasRuleIntent(rules, /block dishwasher|dishwasher blocked|dishwasher restricted/)) {
    return { status: 'blocked', category: 'compatibility', reason: 'dishwasher claim is blocked by approved claim rules' };
  }
  if (/oven/.test(claim) && hasRuleIntent(rules, /block oven|oven blocked|oven restricted/)) {
    return { status: 'blocked', category: 'compatibility', reason: 'oven claim is blocked by approved claim rules' };
  }
  if (/pfas-free|pfoa-free|ptfe-free|pfas free|pfoa free|ptfe free/.test(claim)) {
    return options.hasApprovedSource && hasRuleIntent(rules, /pfas|pfoa|ptfe/)
      ? { status: 'approved', category: 'health', reason: 'PFAS/PTFE/PFOA claim has approved claim guidance' }
      : { status: 'blocked', category: 'health', reason: 'PFAS/PTFE/PFOA claims require approved source guidance' };
  }
  if (/dishwasher-safe|dishwasher safe/.test(claim)) {
    return { status: 'review-required', category: 'compatibility', reason: 'replace dishwasher-safe with dishwasher-suitable unless explicitly approved' };
  }
  if (/scratch-resistant|scratch resistant|kratzbeständig|kratzbestaendig/.test(claim)) {
    return options.hasEvidence
      ? { status: 'approved', category: 'durability', reason: 'scratch-resistant has evidence' }
      : { status: 'blocked', category: 'durability', reason: 'scratch-resistant requires URL/PKO evidence' };
  }
  if (/oven-safe to \d+|oven safe to \d+|backofen.*\d+|oven-temperature|max oven temperature|\d+\s?°c/.test(claim)) {
    return options.hasEvidence
      ? { status: 'approved', category: 'compatibility', reason: 'oven temperature has explicit PKO evidence' }
      : { status: 'blocked', category: 'compatibility', reason: 'oven-temperature claims require explicit PKO evidence' };
  }
  if (/professional quality|professional-grade|professional grade|gastronomy|gastronomie/.test(claim)) {
    return options.hasPositioningEvidence
      ? { status: 'approved', category: 'comparison', reason: 'professional positioning has approved evidence' }
      : { status: 'blocked', category: 'comparison', reason: 'professional positioning requires approved positioning evidence' };
  }
  if (matrix) {
    return { status: matrix, category: 'compatibility', reason: `market/language matrix status: ${matrix}` };
  }
  if (/induction|dishwasher|oven|compatibility/.test(claim) && !options.hasEvidence) {
    return { status: 'blocked', category: 'compatibility', reason: 'compatibility claims require PKO evidence' };
  }

  return { status: 'approved', category: 'performance', reason: 'no blocking claim rule matched' };
}

export function createKnowledgeBaseRegistry(): KnowledgeBaseRegistry {
  return new KnowledgeBaseRegistry();
}

export function registerKnowledgeDocument(
  registry: KnowledgeBaseRegistry,
  input: KnowledgeBaseDocumentInput,
): KnowledgeBaseDocumentRecord {
  return registry.registerDocument(input);
}

export function getKnowledgebaseAvailability(
  registry: KnowledgeBaseRegistry,
  input: KnowledgeMatchInput,
): KnowledgebaseAvailability {
  return registry.getAvailability(input);
}
