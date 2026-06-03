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
  const noisePatterns = [
    /home/i,
    /shop/i,
    /newsletter/i,
    /sign in/i,
    /my account/i,
    /imprint/i,
    /privacy/i,
    /terms/i,
    /kontakt/i,
    /contact/i,
    /follow us/i,
    /facebook/i,
    /instagram/i,
    /twitter/i,
    /legal/i,
    /cookie/i,
    /sitemap/i,
    /help/i,
    /faq/i,
    /produkte?/i,
    /produktdetails?/i,
    /eigenschaften?/i,
    /impressum/i,
    /cookie einstellungen/i,
  ];

  return Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((text) => !noisePatterns.some((rx) => rx.test(text))),
    ),
  );
}

function findLabelValuePairs(sourceLines: string[]): Record<string, string[]> {
  const pairs: Record<string, string[]> = {};
  const labelPatterns: Record<string, RegExp[]> = {
    material: [/^\s*Material[:\-\s]+(.+)/i, /\bMaterial\b[:\-\s]*([^;\n]+)/i],
    innenbeschichtung: [/^\s*Innenbeschichtung[:\-\s]+(.+)/i],
    aussenbeschichtung: [/^\s*Außenbeschichtung[:\-\s]+(.+)/i, /^\s*Auenbeschichtung[:\-\s]+(.+)/i],
    spuelmaschinen: [/Spülmaschinengeeignet[:\-\s]*([^;\n]+)/i, /Spülmaschinengeeignet\b/i],
    kochfeldart: [/Kochfeldart[:\-\s]*([^;\n]+)/i, /Kochfeldart\b/i],
    backofen: [/Backofenkompatibel[:\-\s]*([^;\n]+)/i, /Backofenkompatibel\b/i, /Backofenkompatibilität[:\-\s]*([^;\n]+)/i],
    giesrand: [/Gießrand[:\-\s]*([^;\n]+)/i, /Gießrand\b/i],
    grifftyp: [/Grifftyp[:\-\s]*([^;\n]+)/i, /Grifftyp\b/i],
    cool: [/Cool\+\s*Technologie[:\-\s]*([^;\n]+)/i, /Cool\+\b/i],
  };

  for (const line of sourceLines) {
    for (const [key, patterns] of Object.entries(labelPatterns)) {
      for (const p of patterns) {
        const m = p.exec(line);
        if (m) {
          const value = (m[1] ?? line).trim();
          pairs[key] = pairs[key] || [];
          pairs[key].push(value);
          break;
        }
      }
    }
  }

  return pairs;
}

// Reusable labelPatterns for mapping DOM productDetails into the same keys
const labelPatterns: Record<string, RegExp[]> = {
  material: [/^\s*Material[:\-\s]+(.+)/i, /\bMaterial\b[:\-\s]*([^;\n]+)/i],
  innenbeschichtung: [/^\s*Innenbeschichtung[:\-\s]+(.+)/i],
  aussenbeschichtung: [/^\s*Außenbeschichtung[:\-\s]+(.+)/i, /^\s*Auenbeschichtung[:\-\s]+(.+)/i],
  spuelmaschinen: [/Spülmaschinengeeignet[:\-\s]*([^;\n]+)/i, /Spülmaschinengeeignet\b/i],
  kochfeldart: [/Kochfeldart[:\-\s]*([^;\n]+)/i, /Kochfeldart\b/i],
  backofen: [/Backofenkompatibel[:\-\s]*([^;\n]+)/i, /Backofenkompatibel\b/i, /Backofenkompatibilität[:\-\s]*([^;\n]+)/i],
  giesrand: [/Gießrand[:\-\s]*([^;\n]+)/i, /Gießrand\b/i],
  grifftyp: [/Grifftyp[:\-\s]*([^;\n]+)/i, /Grifftyp\b/i],
  cool: [/Cool\+\s*Technologie[:\-\s]*([^;\n]+)/i, /Cool\+\b/i],
};

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
  // Filter noisy navigation/footer items from headings and list items.
  const cleanedHeadings = normalizeTextItems(pageData.headings || []);
  const cleanedListItems = normalizeTextItems(pageData.listItems || []);

  // Collect candidate feature texts from headings and list items (filtered).
  let features = [...cleanedHeadings, ...cleanedListItems];

  // Parse label:value pairs from page text and list items to populate technical fields.
  const sourceLines = (pageData.text || '').split(/\r?\n|\.|;|\|/).map((l: string) => l.trim()).filter(Boolean);

  // Start with pairs discovered from free text
  const pairs = findLabelValuePairs([...sourceLines, ...features]);

  // Prefer DOM-derived product details when available (label/value pairs extracted in url-crawler)
  if (Array.isArray((pageData as any).productDetails) && (pageData as any).productDetails.length > 0) {
    const pd: Array<{ label: string; value: string }> = (pageData as any).productDetails;
    for (const { label, value } of pd) {
      for (const [key, patterns] of Object.entries(labelPatterns)) {
        for (const p of patterns) {
          if (p.test(label) || p.test(`${label}: ${value}`) || p.test(`${label} ${value}`)) {
            pairs[key] = pairs[key] || [];
            // prefer the explicit DOM value
            pairs[key].push(value.trim());
            break;
          }
        }
      }
    }
  }

  // Materials
  const materials = normalizeTextItems(pairs.material || []);

  // Coatings and feature-like attributes go to features
  const coatingFeatures = normalizeTextItems([...(pairs.innenbeschichtung || []), ...(pairs.aussenbeschichtung || []), ...(pairs.giesrand || []), ...(pairs.grifftyp || []), ...(pairs.cool || [])]);
  features = normalizeTextItems([...features, ...coatingFeatures]);

  // Remove any residual label:value lines from features (e.g. "Material: Edelstahl").
  const labelLineRx = /^\s*[^:\-]+[:\-]\s*/;
  features = features.filter((f) => !labelLineRx.test(f));

  // Compatibility and care instructions
  const compatibility = normalizeTextItems([...(pairs.kochfeldart || []), ...(pairs.backofen || [])]);
  const care_instructions = normalizeTextItems([...(pairs.spuelmaschinen || [])]);

  // Benefits: sentences containing benefit-like keywords (observable text only)
  const benefitKeywords = /\b(reduc(?:es|ing)?|reduziert|reduzieren|easier|helps|help(s)?|makes|macht|allows|erleichtert|improv(e|es)|better|easy to|simplif|Reinigung|reinigen|leicht|einfach(er| zu))\b/i;
  const benefits_explicit = normalizeTextItems(sourceLines.filter((s: string) => benefitKeywords.test(s)));

  const claims_flagged = detectClaimRisk(pageData.text, pageData.url);
  const page_weaknesses = features.length > 0 ? features : [];

  // FINAL SANITIZATION: remove label-only, nav/footer, breadcrumb, and standalone boolean noise
  const labelOnly = [
    'CMMF', 'EAN', 'Marke', 'Material', 'Innenbeschichtung', 'Außenbeschichtung', 'Spülmaschinengeeignet',
    'Kochfeldart', 'Backofenkompatibilität', 'Gießrand', 'Grifftyp', 'Cool+ Technologie', 'Maße', 'Artikelgewicht', 'Paketmaße',
  ];

  const navPhrases = [
    'Startseite', 'PASSENDE ALTERNATIVEN', 'IDEAL ERGÄNZT', 'Versandkostenfrei', 'Kostenfreie Rücksendungen',
    '30 Tage Rückgaberecht', 'Zahlungsmethoden', 'Versand und Lieferung', 'Widerrufsbelehrung', 'Retourenportal',
    'Datenschutz', 'AGB', 'Impressum', 'youtube', 'instagram', 'facebook', 'pinterest', 'whatsapp'
  ];

  const isBreadcrumb = (s: string) => s.trim().startsWith('/');

  function sanitizeList(input: string[] = [], keepSingleBooleanAsValue = false): string[] {
    return normalizeTextItems(input).filter((item) => {
      if (!item) return false;
      const trimmed = item.trim();
      if (/^(Paket)?Maße\s*\(B\s*×\s*H\s*×\s*[LT]\)$/i.test(trimmed)) {
        return false;
      }
      if (isBreadcrumb(trimmed)) return false;
      const lower = trimmed.toLowerCase();

      // exact label-only matches (case-insensitive) or label with colon
      for (const lab of labelOnly) {
        const labLower = lab.toLowerCase();
        if (lower === labLower) return false;
        if (lower === `${labLower}:`) return false;
        if (lower.startsWith(`${labLower}:`)) return false;
      }

      // nav/footer phrases anywhere in the string
      for (const nav of navPhrases) {
        if (lower.includes(nav.toLowerCase())) return false;
      }

      // standalone boolean values should be removed unless the caller explicitly keeps them
      if (!keepSingleBooleanAsValue && (lower === 'ja' || lower === 'nein')) return false;

      return true;
    });
  }

  // apply sanitization to arrays before returning
  const sanitizedFeatures = sanitizeList(features);
  const sanitizedCompatibility = sanitizeList(compatibility, false);
  const sanitizedCare = sanitizeList(care_instructions, false);
  const sanitizedPageWeaknesses = sanitizeList(page_weaknesses);

  return {
    pko_id: `pko-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    source_url: intakeRow.url,
    product_name: pageData.title || intakeRow.product_id || intakeRow.url,
    category: intakeRow.category,
    product_family: intakeRow.product_family ?? '',
    source_language_detected: languageInfo.language,
    source_language_confidence: languageInfo.confidence,
    features: sanitizedFeatures,
    fmo_mappings: [] as FmoMapping[],
    benefits_explicit,
    benefits_missing: [],
    materials: sanitizeList(materials),
    compatibility: sanitizedCompatibility,
    care_instructions: sanitizedCare,
    warranty_service: [],
    use_cases: [],
    claims_flagged,
    page_weaknesses: sanitizedPageWeaknesses,
    knowledgebase_chunks_used: [],
    pko_version: '1.0.0',
    created_at: new Date().toISOString(),
  };
}
