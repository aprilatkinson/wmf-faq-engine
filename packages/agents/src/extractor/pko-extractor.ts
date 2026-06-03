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
    /product advantages/i,
    /product name/i,
    /brand/i,
    /outside coating/i,
    /inside coating/i,
    /raw material/i,
    /dishwasher safe/i,
    /hobs compatibility/i,
    /heat source/i,
    /oven compatibility/i,
    /pouring edge/i,
    /lid\(s\) material/i,
    /handle type/i,
    /cool\+ technology/i,
    /dimensions \(w × h × l\)/i,
    /article weight/i,
    /package dimensions/i,
    /operating manual/i,
    /warranty declaration/i,
    /suitable alternatives/i,
    /ideal additions/i,
    /free shipping/i,
    /free returns/i,
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
    material: [/^\s*Material[:\-\s]+(.+)/i, /Raw Material[:\-\s]+(.+)/i, /^\s*Material\s*\|\s*Raw Material[:\-\s]*(.+)/i],
    innenbeschichtung: [/^\s*Innenbeschichtung[:\-\s]+(.+)/i, /Inside Coating\/finish[:\-\s]+(.+)/i],
    aussenbeschichtung: [/^\s*Außenbeschichtung[:\-\s]+(.+)/i, /Outside coating\/finish[:\-\s]+(.+)/i, /^\s*Auenbeschichtung[:\-\s]+(.+)/i],
    spuelmaschinen: [/Spülmaschinengeeignet[:\-\s]*([^;\n]+)/i, /Dishwasher Safe[:\-\s]*([^;\n]+)/i, /Dishwasher-safe[:\-\s]*([^;\n]+)/i, /Dishwasher safe[:\-\s]*([^;\n]+)/i, /Spülmaschinengeeignet\b/i, /Dishwasher Safe\b/i, /Dishwasher safe\b/i],
    kochfeldart: [/Kochfeldart[:\-\s]*([^;\n]+)/i, /Hobs compatibility[:\-\s]*([^;\n]+)/i, /Heat source[:\-\s]*([^;\n]+)/i, /Kochfeldart\b/i],
    backofen: [/Backofenkompatibel[:\-\s]*([^;\n]+)/i, /Backofenkompatibilität[:\-\s]*([^;\n]+)/i, /Oven compatibility[:\-\s]*([^;\n]+)/i, /Backofenkompatibel\b/i],
    giesrand: [/Gießrand[:\-\s]*([^;\n]+)/i, /Pouring edge[:\-\s]*([^;\n]+)/i, /Gießrand\b/i, /Pouring edge\b/i],
    grifftyp: [/Grifftyp[:\-\s]*([^;\n]+)/i, /Handle type[:\-\s]*([^;\n]+)/i, /Grifftyp\b/i],
    cool: [/Cool\+\s*Technologie[:\-\s]*([^;\n]+)/i, /Cool\+\s*Technology[:\-\s]*([^;\n]+)/i, /Cool\+\b/i],
    pouring_edge: [/Pouring edge[:\-\s]*([^;\n]+)/i, /Pouring edge\b/i],
    lid_material: [/Lid(?:s)? material[:\-\s]*([^;\n]+)/i, /Lid(?:s)? material\b/i],
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
  material: [/^\s*Material[:\-\s]+(.+)/i, /Raw Material[:\-\s]+(.+)/i, /^\s*Material\s*\|\s*Raw Material[:\-\s]*(.+)/i],
  innenbeschichtung: [/^\s*Innenbeschichtung[:\-\s]+(.+)/i, /Inside Coating\/finish[:\-\s]+(.+)/i],
  aussenbeschichtung: [/^\s*Außenbeschichtung[:\-\s]+(.+)/i, /Outside coating\/finish[:\-\s]+(.+)/i, /^\s*Auenbeschichtung[:\-\s]+(.+)/i],
  spuelmaschinen: [/Spülmaschinengeeignet[:\-\s]*([^;\n]+)/i, /Dishwasher Safe[:\-\s]*([^;\n]+)/i, /Dishwasher-safe[:\-\s]*([^;\n]+)/i, /Dishwasher safe[:\-\s]*([^;\n]+)/i, /Spülmaschinengeeignet\b/i, /Dishwasher Safe\b/i, /Dishwasher safe\b/i],
  kochfeldart: [/Kochfeldart[:\-\s]*([^;\n]+)/i, /Hobs compatibility[:\-\s]*([^;\n]+)/i, /Heat source[:\-\s]*([^;\n]+)/i, /Kochfeldart\b/i],
  backofen: [/Backofenkompatibel[:\-\s]*([^;\n]+)/i, /Backofenkompatibilität[:\-\s]*([^;\n]+)/i, /Oven compatibility[:\-\s]*([^;\n]+)/i, /Backofenkompatibel\b/i],
  giesrand: [/Gießrand[:\-\s]*([^;\n]+)/i, /Pouring edge[:\-\s]*([^;\n]+)/i, /Gießrand\b/i, /Pouring edge\b/i],
  grifftyp: [/Grifftyp[:\-\s]*([^;\n]+)/i, /Handle type[:\-\s]*([^;\n]+)/i, /Grifftyp\b/i],
  cool: [/Cool\+\s*Technologie[:\-\s]*([^;\n]+)/i, /Cool\+\s*Technology[:\-\s]*([^;\n]+)/i, /Cool\+\b/i],
  pouring_edge: [/Pouring edge[:\-\s]*([^;\n]+)/i, /Pouring edge\b/i],
  lid_material: [/Lid(?:s)? material[:\-\s]*([^;\n]+)/i, /Lid(?:s)? material\b/i],
};

function inferLanguage(intakeRow: IntakeRow, sourceUrl: string): { language: SourceLanguage; confidence: number } {
  const known = ['de', 'en', 'es', 'nl', 'fr'];
  let pathLanguage: SourceLanguage | undefined;

  try {
    const url = new URL(sourceUrl);
    const segments = url.pathname.split('/').filter(Boolean) as string[];
    const segment1 = segments[1] ?? '';
    const segment0 = segments[0] ?? '';

    if (segment1 && known.includes(segment1.toLowerCase())) {
      pathLanguage = segment1.toLowerCase() as SourceLanguage;
    } else if (segment0 && known.includes(segment0.toLowerCase())) {
      pathLanguage = segment0.toLowerCase() as SourceLanguage;
    }
  } catch {
    // fall back to heuristic below
  }

  if (intakeRow.source_language) {
    if (pathLanguage && pathLanguage !== intakeRow.source_language.toLowerCase()) {
      return { language: pathLanguage, confidence: 0.85 };
    }
    return { language: intakeRow.source_language, confidence: 0.95 };
  }

  if (pathLanguage) {
    return { language: pathLanguage, confidence: 0.85 };
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
  const coatingFeatures = normalizeTextItems([...(pairs.innenbeschichtung || []), ...(pairs.aussenbeschichtung || []), ...(pairs.giesrand || []), ...(pairs.grifftyp || []), ...(pairs.cool || []), ...(pairs.pouring_edge || []), ...(pairs.lid_material || [])]);
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
    'Product advantages', 'Product Name', 'Brand', 'Outside coating/finish', 'Oven compatibility', 'Inside Coating/finish',
    'Material | Raw Material', 'Dishwasher Safe', 'Hobs compatibility | Heat source', 'Pouring edge', 'Lid(s) material',
    'Handle type', 'Cool+ Technology', 'Dimensions (W × H × L)', 'Article Weight', 'Package Dimensions (W × H × D)',
    'Operating Manual', 'Warranty Declaration', 'SUITABLE ALTERNATIVES', 'IDEAL ADDITIONS',
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
      if (!keepSingleBooleanAsValue && (lower === 'ja' || lower === 'nein' || lower === 'yes' || lower === 'no')) return false;

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
