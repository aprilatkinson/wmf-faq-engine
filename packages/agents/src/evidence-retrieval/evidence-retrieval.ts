import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

export interface ProductFactEvidence {
  induction_suitable: boolean;
  transtherm_base: boolean;
  cromargan: boolean;
  cool_plus: boolean;
  glass_lid: boolean;
  steam_vent: boolean;
  set_pieces: string[];
  set_sizes: string[];
  non_stick: boolean;
  ceramic: boolean;
  stainless_steel: boolean;
  white_spot_care: boolean;
  mineral_deposits: boolean;
  eggs_gentle_frying: boolean;
  steak_searing: boolean;
  lid_included: boolean;
  accessories_included: string[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function factText(pko: ProductKnowledgeObject): string {
  return [
    pko.product_name,
    pko.category,
    pko.product_family,
    ...pko.features,
    ...pko.fmo_mappings.flatMap((mapping) => [mapping.feature, mapping.mechanism, mapping.outcome, mapping.use_case, mapping.buyer_relevance]),
    ...pko.benefits_explicit,
    ...pko.benefits_missing,
    ...pko.materials,
    ...pko.compatibility,
    ...pko.care_instructions,
    ...pko.warranty_service,
    ...pko.use_cases,
    ...pko.claims_flagged.map((claim) => `${claim.claim_text} ${claim.risk_type} ${claim.source}`),
    ...pko.page_weaknesses,
    ...pko.knowledgebase_chunks_used,
  ].join(' ');
}

function has(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function extractSizes(text: string): string[] {
  const sizes = new Set<string>();
  for (const match of text.matchAll(/\b(\d{1,3})\s?cm\b/g)) {
    sizes.add(`${match[1]} cm`);
  }
  return Array.from(sizes).sort((left, right) => Number(left.split(' ')[0]) - Number(right.split(' ')[0]));
}

function extractPieces(text: string): string[] {
  const pieces = new Set<string>();
  for (const match of text.matchAll(/\b(\d+)[\s-]?(?:piece|pc|pcs|teil|teilig|stück|stueck)\b/g)) {
    pieces.add(`${match[1]}-piece`);
  }
  return Array.from(pieces).sort();
}

function extractAccessories(text: string): string[] {
  const accessories = new Set<string>();
  if (has(text, [/pfannenwender|wender|turner/i])) accessories.add('turner');
  if (has(text, [/spatula/i])) accessories.add('spatula');
  if (has(text, [/pfannenschutz|pan protector|protective mat/i])) accessories.add('pan protector');
  if (has(text, [/deckel|lid|glasdeckel|glass lid/i])) accessories.add('lid');
  return Array.from(accessories).sort();
}

export function retrieveProductFactEvidence(pko: ProductKnowledgeObject): ProductFactEvidence {
  const text = normalize(factText(pko));
  const accessories = extractAccessories(text);
  const glass_lid = has(text, [/glass lid|glasdeckel/]);

  return {
    induction_suitable: has(text, [/induction|induktion/]),
    transtherm_base: has(text, [/transtherm/]),
    cromargan: has(text, [/cromargan/]),
    cool_plus: has(text, [/cool\+/]),
    glass_lid,
    steam_vent: has(text, [/steam vent|dampföffnung|dampfoeffnung|dampf/]),
    set_pieces: extractPieces(text),
    set_sizes: extractSizes(text),
    non_stick: has(text, [/non[-\s]?stick|antihaft|coated pan|beschichtet/]),
    ceramic: has(text, [/ceramic|keramik/]),
    stainless_steel: has(text, [/stainless steel|edelstahl|cromargan/]),
    white_spot_care: has(text, [/white spot|weiße flecken|weisse flecken|wasserfleck|discoloration|verfärbung|verfaerbung/]),
    mineral_deposits: has(text, [/mineral|minerals|kalk|wasser/]),
    eggs_gentle_frying: has(text, [/eggs|eier|gentle frying|schonendes braten/]),
    steak_searing: has(text, [/steak|searing|scharfes anbraten|intense searing|intensives anbraten|browning/]),
    lid_included: accessories.includes('lid') || glass_lid,
    accessories_included: accessories,
  };
}
