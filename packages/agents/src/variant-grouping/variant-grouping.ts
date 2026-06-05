import type { IntakeRow } from '../../../core/src/types/intake';

export interface VariantGroupMetadata {
  variant_group_key: string;
  canonical_url: string;
  variant_urls: string[];
  variant_dimensions: string[];
  grouping_reason: string;
  requires_unique_generation: boolean;
}

export interface VariantGroupingResult {
  groups: VariantGroupMetadata[];
  row_to_group: Record<string, VariantGroupMetadata>;
}

const KNOWN_FAMILIES = [
  'ultimate profi resist',
  'silit silargan professional',
  'fusiontec mineral pro',
  'fusiontec mineral',
  'permadur excellent',
  'permadur advance',
  'permadur premium',
  'permadur inspire',
  'ceradur profi',
  'profi resist',
  'silit calabria',
  'silit belluna',
  'silit messino',
  'silit merida',
  'silit montano',
  'silit talis',
  'silit domus',
  'compact cuisine',
  'gourmet plus',
  'click serve',
  'nordic profi',
  'steak profi',
  'quality one',
  'provence plus',
  'ultimate',
  'devil',
  'durado',
  'profi',
] as const;

const COLOR_TERMS = [
  'anthrazit',
  'black',
  'blau',
  'blue',
  'gelb',
  'green',
  'gruen',
  'grün',
  'platinum',
  'red',
  'rose quartz',
  'rose',
  'rot',
  'schwarz',
  'yellow',
] as const;

function normalizeText(value: string | undefined): string {
  return decodeURIComponent(value ?? '')
    .toLowerCase()
    .replace(/[-_+/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rowText(row: IntakeRow): string {
  return normalizeText(`${row.product_id ?? ''} ${row.url} ${row.category} ${row.product_family ?? ''} ${row.variant_group_id ?? ''}`);
}

function stableGroupingText(row: IntakeRow): string {
  const urlWithoutQuery = row.url.split(/[?#]/)[0];
  return normalizeText(`${urlWithoutQuery} ${row.category} ${row.product_family ?? ''}`);
}

function detectCoating(text: string): string {
  if (/fusiontec mineral pro/.test(text)) return 'fusiontec-mineral-pro';
  if (/fusiontec mineral/.test(text)) return 'fusiontec-mineral';
  if (/ultimate profi resist|profi resist|resist/.test(text)) return 'resist';
  if (/ceradur|ceramic|keramik/.test(text)) return 'ceramic';
  if (/permadur|non stick|nonstick|antihaft|belluna|messino|merida|calabria|talis|montano|domus|durado|click serve/.test(text)) {
    return 'non-stick';
  }
  if (/silit silargan professional|silargan/.test(text)) return 'silargan';
  if (/\bceramic\b|keramik/.test(text)) return 'ceramic';
  if (/\bptfe\b/.test(text)) return 'ptfe';
  if (/stainless steel|edelstahl|cromargan|profi|gourmet plus|quality one|provence plus|compact cuisine|nordic profi|steak profi|ultimate/.test(text)) {
    return 'stainless-steel';
  }
  return 'unknown-coating';
}

function detectRole(text: string): string {
  const hasPanOrPot = /bratpfanne|stielpfanne|servierpfanne|schmorpfanne|grillpfanne|crepes? pfanne|pfanne\b|pan\b|wok|topf|pot\b|set|bundle/.test(text);
  if (/accessor|zubehör|zubehoer|lid|deckel|spare|ersatz|filter|pfannenwender|wender|spatula|turner|pfannenschutz/.test(text) && !hasPanOrPot) {
    return 'accessory';
  }
  if (/wok/.test(text)) return 'wok';
  if (/grill pan|grillpfanne/.test(text)) return 'grill-pan';
  if (/crepe|crêpe|pfannkuchen/.test(text)) return 'crepe-pan';
  if (/stielpfanne hoch|pfanne hoch|hoch \d{1,3}|high rim|high-rim|deep frying pan/.test(text)) return 'high-rim-pan';
  if (/servier|schmor|sautier|sauté|saute/.test(text)) return 'serving-pan';
  if (/pot set|topfset|saucepan|casserole|stockpot|kochtopf|pot\b|topf\b/.test(text)) return 'pot';
  if (/set|bundle|pfannen set|bratpfannen set|pfannenset/.test(text)) return 'frying-pan-set';
  if (/frying pan|bratpfanne|stielpfanne|pfanne\b|pan\b/.test(text)) return 'frying-pan';
  return 'unknown-role';
}

function detectFamily(row: IntakeRow, text: string): string {
  const explicit = normalizeText(row.product_family);
  if (explicit) return explicit;

  return KNOWN_FAMILIES.find((family) => text.includes(family)) ?? 'unknown-family';
}

function detectVariantDimensions(text: string): string[] {
  const dimensions = new Set<string>();
  for (const match of text.matchAll(/\b\d{1,3}\s?(?:cm|mm|l|liter)\b/g)) {
    dimensions.add(match[0].replace(/\s+/g, ''));
  }
  for (const match of text.matchAll(/\b\d+\s?(?:piece|pc|pcs|teil|teilig|stück|stueck)\b/g)) {
    dimensions.add(match[0].replace(/\s+/g, ''));
  }
  for (const color of COLOR_TERMS) {
    if (text.includes(color)) dimensions.add(color.replace(/\s+/g, '-'));
  }
  if (/mit glasdeckel|with lid|deckel|lid/.test(text)) dimensions.add('with-lid');
  if (/pfannenwender|wender|spatula|turner/.test(text)) dimensions.add('with-turner');
  if (/pfannenschutz|protective mat|protector/.test(text)) dimensions.add('with-protector');
  return Array.from(dimensions).sort();
}

function stripVariantDimensions(text: string): string {
  let stripped = text;
  for (const color of COLOR_TERMS) {
    stripped = stripped.replace(new RegExp(`\\b${color.replace(/\s+/g, '\\s+')}\\b`, 'g'), '');
  }

  return stripped
    .replace(/\b\d{1,3}\s?(?:cm|mm|l|liter)\b/g, '')
    .replace(/\b\d+\s?(?:piece|pc|pcs|teil|teilig|stück|stueck)\b/g, '')
    .replace(/\b(?:mit|with)?\s?(?:glasdeckel|deckel|lid)\b/g, '')
    .replace(/\b(?:mit|with)?\s?(?:pfannenwender|wender|spatula|turner|pfannenschutzmatten|pfannenschutz|protective mat|protector)\b/g, '')
    .replace(/\b(?:sku|variant|variante|size|groesse|grösse|diameter|durchmesser)\b/g, '')
    .replace(/\b\d{6,}\b/g, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupingKey(row: IntakeRow): string {
  if (row.variant_group_id) {
    return `explicit:${normalizeText(row.variant_group_id)}`;
  }

  const text = rowText(row);
  const family = detectFamily(row, text);
  const role = detectRole(text);
  const coating = detectCoating(text);
  const stableName = stripVariantDimensions(stableGroupingText(row))
    .replace(/\bhttps?:?\b|\bwww\b|\bcom\b|\bde\b|\bproduct\b|\bhtml\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  return [family, role, coating, stableName].join('|');
}

function requiresUniqueGeneration(groupRows: IntakeRow[]): boolean {
  if (groupRows.length <= 1) return true;

  const roles = new Set<string>();
  const coatings = new Set<string>();
  for (const row of groupRows) {
    const text = rowText(row);
    roles.add(detectRole(text));
    coatings.add(detectCoating(text));
  }

  if (roles.size > 1 || coatings.size > 1) return true;
  if (roles.has('accessory')) return true;
  if (roles.has('unknown-role') || coatings.has('unknown-coating')) return true;

  return false;
}

function groupingReason(groupRows: IntakeRow[], dimensions: string[], unique: boolean): string {
  if (unique) return 'unique product role/coating/material or insufficient safe variant evidence';
  if (dimensions.length > 0) return 'same family, product type, and coating with size or set-composition variants';
  return 'same family, product type, and coating near-duplicate URLs';
}

export function groupIntakeRows(rows: IntakeRow[]): VariantGroupingResult {
  const byKey = new Map<string, IntakeRow[]>();
  for (const row of rows) {
    const key = groupingKey(row);
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }

  const groups: VariantGroupMetadata[] = [];
  const row_to_group: Record<string, VariantGroupMetadata> = {};

  for (const [baseKey, groupRows] of byKey.entries()) {
    const unique = requiresUniqueGeneration(groupRows);
    const variant_dimensions = Array.from(new Set(groupRows.flatMap((row) => detectVariantDimensions(rowText(row))))).sort();
    const variant_urls = groupRows.map((row) => row.url);
    const group: VariantGroupMetadata = {
      variant_group_key: unique ? `${baseKey}|unique:${groupRows[0]?.row_id ?? 'unknown'}` : baseKey,
      canonical_url: groupRows[0]?.url ?? '',
      variant_urls,
      variant_dimensions,
      grouping_reason: groupingReason(groupRows, variant_dimensions, unique),
      requires_unique_generation: unique,
    };
    groups.push(group);

    for (const row of groupRows) {
      row_to_group[row.row_id] = group;
    }
  }

  return { groups, row_to_group };
}
