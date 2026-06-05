import type { FaqItem } from '../../../core/src/types/faq';
import type { IntakeRow } from '../../../core/src/types/intake';
import type { VariantGroupMetadata } from '../variant-grouping';

export interface VariantContext {
  size?: string;
  set_composition?: string;
  lid_included: boolean;
  accessory_included?: string;
  product_type?: string;
}

function normalizeText(value: string | undefined): string {
  return decodeURIComponent(value ?? '')
    .toLowerCase()
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/[-_+/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rowText(row: IntakeRow): string {
  return normalizeText(`${row.product_id ?? ''} ${row.url} ${row.category} ${row.product_family ?? ''}`);
}

function detectSize(text: string): string | undefined {
  const match = text.match(/\b(\d{1,3})\s?(cm|mm|l|liter)\b/);
  if (!match) return undefined;
  return `${match[1]} ${match[2] === 'liter' ? 'liter' : match[2]}`;
}

function detectSetComposition(text: string): string | undefined {
  const pieceMatch = text.match(/\b(\d+)\s?(piece|pc|pcs|teil|teilig|stück|stueck)\b/);
  if (pieceMatch) {
    return `${pieceMatch[1]}-piece`;
  }

  const sizeMatches = Array.from(text.matchAll(/\b\d{1,3}\s?(?:cm|mm|l|liter)\b/g)).map((match) => match[0].replace(/\s+/g, ' '));
  if (/(set|bundle|pfannen set|bratpfannen set)/.test(text) && sizeMatches.length > 1) {
    return `${sizeMatches.join(' + ')} set`;
  }

  return undefined;
}

function detectProductType(text: string): string | undefined {
  if (/crepe|crêpe/.test(text)) return 'crepe pan';
  if (/grill pan|grillpfanne/.test(text)) return 'grill pan';
  if (/wok/.test(text)) return 'wok';
  if (/servier|schmor/.test(text)) return 'serving/sauté pan';
  if (/frying pan|bratpfanne|stielpfanne|pfanne|pan\b/.test(text)) return 'frying pan';
  if (/topf|pot\b/.test(text)) return 'pot';
  return undefined;
}

function detectAccessory(text: string): string | undefined {
  if (/pfannenwender|wender|turner/.test(text)) return 'turner';
  if (/spatula/.test(text)) return 'spatula';
  if (/pfannenschutz|protective mat/.test(text)) return 'pan protector';
  if (/deckel|lid|glasdeckel/.test(text)) return 'lid';
  return undefined;
}

function variantPhrase(context: VariantContext): string | undefined {
  const parts: string[] = [];
  if (context.set_composition) parts.push(context.set_composition);
  if (context.size) parts.push(context.size);
  if (context.product_type) parts.push(context.product_type);
  if (context.lid_included) parts.push('with lid');
  if (context.accessory_included && context.accessory_included !== 'lid') parts.push(`with ${context.accessory_included}`);

  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function extractVariantContext(row: IntakeRow, group: VariantGroupMetadata): VariantContext {
  if (group.requires_unique_generation) {
    return { lid_included: false };
  }

  const text = rowText(row);
  return {
    size: detectSize(text),
    set_composition: detectSetComposition(text),
    lid_included: /mit glasdeckel|with lid|deckel|lid/.test(text),
    accessory_included: detectAccessory(text),
    product_type: detectProductType(text),
  };
}

export function adaptFaqForVariant(faq: FaqItem, row: IntakeRow, group: VariantGroupMetadata): FaqItem {
  if (group.requires_unique_generation) {
    return faq;
  }

  const context = extractVariantContext(row, group);
  const phrase = variantPhrase(context);
  if (!phrase) {
    return faq;
  }

  return {
    ...faq,
    question: `For the ${phrase}, ${faq.question.charAt(0).toLowerCase()}${faq.question.slice(1)}`,
    answer: `This ${phrase} variant uses the same supported product information. ${faq.answer}`,
  };
}

export function adaptFaqsForVariant(faqs: FaqItem[], row: IntakeRow, group: VariantGroupMetadata): FaqItem[] {
  return faqs.map((faq) => adaptFaqForVariant(faq, row, group));
}
