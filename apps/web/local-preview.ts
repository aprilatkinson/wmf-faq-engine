import type { SourceLanguage } from '../../packages/core/src/constants/enums';
import type { IntakeRow } from '../../packages/core/src/types/intake';
import type { ProductKnowledgeObject } from '../../packages/core/src/types/pko';
import { estimateJobCost, processBatchJob, type RunMode } from '../../packages/agents/src/job-processor';
import {
  createKnowledgeBaseRegistry,
  evaluateClaimGuidance,
  getKnowledgebaseAvailability,
  type KnowledgeBaseDocumentRecord,
  type KnowledgeBaseRegistry,
} from '../../packages/agents/src/knowledge-base';

export interface LocalPreviewInput {
  urls: string[];
  target_languages?: SourceLanguage[];
  run_mode?: RunMode;
  max_faq_count?: number;
  cost_ceiling_eur?: number;
  cost_confirmed?: boolean;
  continue_after_warning?: boolean;
  knowledge_base?: KnowledgeBaseRegistry;
}

export interface LocalFaqPreviewRow {
  language: SourceLanguage;
  question: string;
  answer: string;
  status: string;
  purpose_tags: string[];
}

export interface LocalProductPreviewRow {
  url: string;
  product_id: string;
  status: string;
  selected_languages: SourceLanguage[];
  faq_count: number;
  faqs: LocalFaqPreviewRow[];
}

const supportedLanguages: SourceLanguage[] = ['de', 'en', 'es', 'nl', 'fr'];
const deterministicPreviewLanguages: SourceLanguage[] = ['en'];

type LocalUrlFacts = ReturnType<typeof inferUrlFacts>;

function normalizeSlug(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function inferSourceLanguage(url: string): SourceLanguage {
  const path = normalizeSlug(url);
  const match = path.match(/\/de\/(de|en|fr|es|nl)(?:\/|$)/);
  return supportedLanguages.includes(match?.[1] as SourceLanguage) ? (match?.[1] as SourceLanguage) : 'de';
}

function inferFamily(slug: string): string {
  const families = [
    'profi resist',
    'fusiontec mineral pro',
    'fusiontec mineral',
    'permadur premium',
    'permadur excellent',
    'permadur advance',
    'permadur inspire',
    'ceradur profi',
    'silit silargan professional',
    'silit calabria',
    'silit belluna',
    'silit messino',
    'silit merida',
    'silit montano',
    'silit talis',
    'ultimate profi resist',
    'gourmet plus',
    'click serve',
    'compact cuisine',
    'profi',
    'devil',
    'durado',
    'ultimate',
  ];
  const spaced = slug.replace(/[-_/]+/g, ' ');
  return families.find((family) => spaced.includes(family)) ?? 'WMF Cookware';
}

function inferProductType(slug: string): string {
  if (/glasdeckel|\/lid|[-_]lid|deckel/.test(slug)) return 'accessory';
  if (/wok/.test(slug)) return 'wok';
  if (/grillpfanne|grill[-_]?pan/.test(slug)) return 'grill pan';
  if (/creperie|crepe/.test(slug)) return 'crepe pan';
  if (/bratpfannen[-_]?set|pan[-_]?set|pfannen[-_]?set/.test(slug)) return 'pan set';
  if (/stielpfanne|fry[-_]?pan|frying[-_]?pan|bratpfanne/.test(slug)) return 'frying pan';
  return 'cookware';
}

function inferUrlFacts(url: string) {
  const slug = normalizeSlug(url);
  const sizes = Array.from(new Set(Array.from(slug.matchAll(/(?:^|[-_/])(\d{2})(?:[-_]?cm|[-_/])/g)).map((match) => `${match[1]} cm`)))
    .filter((size) => ['20 cm', '24 cm', '28 cm', '32 cm'].includes(size))
    .sort((left, right) => Number(left.split(' ')[0]) - Number(right.split(' ')[0]));
  const pieceMatch = slug.match(/(?:^|[-_/])([23])[-_]?(?:teilig|teil|piece|pieces)(?:[-_/]|$)/);
  const productType = inferProductType(slug);
  const family = inferFamily(slug);
  return {
    slug,
    sourceLanguage: inferSourceLanguage(url),
    family,
    productType,
    sizes,
    pieces: pieceMatch ? `${pieceMatch[1]}-piece` : undefined,
    hasLid: /glasdeckel|glass[-_]?lid|[-_/]lid|deckel/.test(slug),
    accessories: [
      /wender|turner/.test(slug) ? 'turner' : '',
      /spatula/.test(slug) ? 'spatula' : '',
      /pfannenschutz|protector/.test(slug) ? 'pan protector' : '',
    ].filter(Boolean),
    hasCoating: /antihaft|non[-_]?stick|ceramic|keramik/.test(slug),
    hasCeramic: /ceramic|keramik/.test(slug),
    hasInduction: /induction|induktion|allherd/.test(slug),
    hasTransTherm: /transtherm/.test(slug),
    hasCoolPlus: /cool[-_+]?\+|coolplus/.test(slug),
    hasDishwasher: /dishwasher|spuelmaschinengeeignet|spülmaschinengeeignet|spuelmaschine|spülmaschine/.test(slug),
    hasOven: /oven[-_]?safe|ovenproof|backofen|ofenfest|oven/.test(slug),
    hasCromargan: /cromargan|profi|gourmet[-_]?plus|compact[-_]?cuisine/.test(slug),
  };
}

function selectedLanguagesForInput(input: LocalPreviewInput): SourceLanguage[] {
  if (input.target_languages && input.target_languages.length > 0) {
    return input.target_languages;
  }
  const firstSourceLanguage = input.urls[0] ? inferSourceLanguage(input.urls[0]) : 'de';
  return [firstSourceLanguage];
}

function generatedLanguagesForPreview(selectedLanguages: SourceLanguage[]): SourceLanguage[] {
  return deterministicPreviewLanguages.filter((language) => selectedLanguages.includes(language) || selectedLanguages.length > 0);
}

function skippedLocalizationWarnings(selectedLanguages: SourceLanguage[], generatedLanguages: SourceLanguage[]): string[] {
  const skipped = selectedLanguages.filter((language) => !generatedLanguages.includes(language));
  if (skipped.length === 0) return [];
  return [`Selected languages skipped because deterministic localization is not implemented: ${skipped.join(', ')}`];
}

export function createLocalIntakeRows(urls: string[]): IntakeRow[] {
  return urls.map((url, index) => {
    const facts = inferUrlFacts(url);
    return {
      row_id: `local-row-${index + 1}`,
      product_id: `local-product-${index + 1}`,
      url,
      page_type: 'PDP',
      category: 'Cookware',
      product_family: facts.family,
      priority: 'P2',
      source_language: facts.sourceLanguage,
    };
  });
}

function createLocalPkoFromIntake(intake: IntakeRow): ProductKnowledgeObject {
  const facts = inferUrlFacts(intake.url);
  const typeLabel = facts.productType === 'pan set' ? 'pan set' : facts.productType;
  const sizeText = facts.sizes.length > 0 ? `${facts.sizes.join(', ')} ` : '';
  const pieceText = facts.pieces ? `${facts.pieces} ` : '';
  const features = [
    `${pieceText}${sizeText}${typeLabel}`.trim(),
    facts.hasCoating ? `${facts.hasCeramic ? 'ceramic' : 'non-stick'} coating for eggs and gentle frying` : '',
    facts.hasLid ? 'glass lid included' : '',
    facts.accessories.length > 0 ? `${facts.accessories.join(', ')} included` : '',
    facts.hasInduction ? 'Induction suitability' : '',
    facts.hasTransTherm ? 'TransTherm® base' : '',
    facts.hasCoolPlus ? 'Cool+ handle technology' : '',
    facts.hasDishwasher ? 'Dishwasher-suitable care evidence' : '',
    facts.hasOven ? 'Oven-use evidence' : '',
  ].filter(Boolean);
  const materials = [
    facts.hasCromargan ? 'Cromargan® stainless steel' : '',
  ].filter(Boolean);
  const compatibility = [
    facts.hasInduction ? 'Induction' : '',
    facts.hasOven ? 'Oven-safe evidence' : '',
  ].filter(Boolean);

  return {
    pko_id: `pko-${intake.row_id}`,
    source_url: intake.url,
    product_name: `WMF ${facts.family} ${pieceText}${sizeText}${typeLabel}`.replace(/\s+/g, ' ').trim(),
    category: intake.category,
    product_family: facts.family,
    source_language_detected: facts.sourceLanguage,
    source_language_confidence: 1,
    features,
    fmo_mappings: [
      {
        feature: facts.sizes.length > 0 ? `${facts.sizes.join(', ')} size evidence` : `${typeLabel} product type`,
        mechanism: facts.productType === 'pan set' ? 'different pan sizes support different cooking portions' : 'product type guides the best cooking job',
        outcome: facts.hasCoating ? 'supports eggs and gentle frying' : 'supports everyday cookware selection',
        use_case: facts.productType === 'pan set' ? 'choosing the right pan size' : 'choosing cookware for the planned cooking task',
        buyer_relevance: 'helps customers understand fit before buying',
        source_confidence: 'high',
      },
    ],
    benefits_explicit: ['Product type, size, coating, and included-item details support customer buying decisions.'],
    benefits_missing: [],
    materials,
    compatibility,
    care_instructions: facts.hasCoating
      ? ['Use moderate heat and suitable utensils for coated pans.']
      : facts.hasDishwasher
        ? ['Dishwasher-suitable care with hand drying recommended.']
        : ['Clean gently and dry after washing.'],
    warranty_service: [],
    use_cases: facts.hasCoating
      ? ['Eggs and gentle frying']
      : facts.hasCromargan
        ? ['Steak and searing when using a suitable frying pan']
        : ['Everyday cookware use'],
    claims_flagged: [],
    page_weaknesses: [],
    knowledgebase_chunks_used: ['structured local product facts'],
    pko_version: '1.0.0',
    created_at: new Date().toISOString(),
  };
}

function productName(facts: LocalUrlFacts): string {
  const size = facts.sizes.length === 1 ? `${facts.sizes[0]} ` : '';
  const pieces = facts.pieces ? `${facts.pieces} ` : '';
  return `WMF ${facts.family} ${pieces}${size}${facts.productType}`.replace(/\s+/g, ' ').trim();
}

function sizeQuestion(facts: LocalUrlFacts): string {
  if (facts.productType === 'pan set') return 'Which pan size should I use for which cooking job?';
  return facts.sizes[0] ? `Is ${facts.sizes[0]} the right pan size for my cooking?` : 'Which pan size should I choose?';
}

function sizeAnswer(facts: LocalUrlFacts): string {
  if (facts.productType === 'pan set') {
    return `The set includes ${facts.sizes.join(', ')}. Smaller pans suit compact portions, while larger pans give more space for food that needs room to brown or saute.`;
  }
  return `A ${facts.sizes[0]} frying pan is well suited to proteins, vegetables, sauteing, browning, and searing. For many everyday meals, it gives enough surface for 2-3 people while still fitting comfortably on a typical hob zone.`;
}

function inductionAnswer(facts: LocalUrlFacts): string {
  if (facts.hasTransTherm) return `Yes. ${productName(facts)} is suitable for induction. The TransTherm® base is the supporting feature, and the pan size should still match the cooking zone.`;
  if (facts.hasInduction) return `Yes. ${productName(facts)} is listed for induction. Match the pan size to the cooking zone for best everyday use.`;
  return '';
}

function dishwasherAnswer(facts: LocalUrlFacts): string {
  if (!facts.hasDishwasher) return '';
  if (facts.hasCoating) {
    const coating = facts.hasCeramic ? 'ceramic coating' : 'non-stick coating';
    return `Yes, this pan is listed with dishwasher evidence. For the ${coating}, gentle hand washing is still the better everyday care choice because it helps protect release performance and the surface over time.`;
  }
  return 'Yes, this pan is listed with dishwasher evidence. Hand washing and careful drying are still useful for stainless steel because they help reduce water spots and keep the surface looking cleaner.';
}

function ovenAnswer(facts: LocalUrlFacts): string {
  if (!facts.hasOven) return '';
  return 'Yes, this pan has oven-use evidence. Check the stated temperature limit before use, because oven suitability can depend on the handle, coating, and lid or accessory parts.';
}

function playbookSignals(content: string): Record<string, boolean> {
  const text = content.toLowerCase();
  return {
    stainless_sticking: /sticking|preheat|heat control|food release|stainless/.test(text),
    stainless_care: /water spot|rainbow|mineral|stainless.*care|care/.test(text),
    nonstick_delicate: /non-stick|delicate|eggs|fish|coating/.test(text),
    ceramic_care: /ceramic|gentle cooking|temperature|release/.test(text),
    pan_set_sizes: /pan set|size selection|included sizes|versatility|storage/.test(text),
    comparison: /comparison|different from|buyer anxiety|expectation/.test(text),
  };
}

function reviewSignals(content: string): Record<string, boolean> {
  const text = content.toLowerCase();
  return {
    food_sticking: /food[_\s-]?sticking|sticking|preheat|heat[_\s-]?control/.test(text),
    water_spots: /water[_\s-]?spots|rainbow|mineral|marks/.test(text),
    dishwasher_confusion: /dishwasher[_\s-]?confusion|dishwasher|cleaning/.test(text),
    induction_confusion: /induction[_\s-]?confusion|induction|hob/.test(text),
    size_selection: /size[_\s-]?selection|which size|household|portion/.test(text),
    coating_care: /coating[_\s-]?care|metal utensils|utensil|overheating|coating/.test(text),
    stainless_steel_learning: /stainless[_\s-]?steel[_\s-]?learning|stainless steel|material learning/.test(text),
    family_comparison: /family[_\s-]?comparison|comparison[_\s-]?confusion|other wmf/.test(text),
    expectation_gap: /expectation[_\s-]?gap|buyer[_\s-]?anxiety|support[_\s-]?issue/.test(text),
  };
}

function approvedPlaybookContent(knowledgeBase: KnowledgeBaseRegistry, row: IntakeRow): string {
  return knowledgeBase.findApprovedCategoryPlaybooks({
    brand: 'WMF',
    category: row.category,
    product_family: row.product_family ?? row.category,
    language: row.source_language,
  }).map((doc) => doc.content).join('\n');
}

function approvedReviewIntelligenceContent(knowledgeBase: KnowledgeBaseRegistry, row: IntakeRow): string {
  return knowledgeBase.findApprovedReviewIntelligence({
    brand: 'WMF',
    category: row.category,
    product_family: row.product_family ?? row.category,
    language: row.source_language,
  }).map((doc) => doc.content).join('\n');
}

function approvedClaimRules(knowledgeBase: KnowledgeBaseRegistry, row: IntakeRow): KnowledgeBaseDocumentRecord[] {
  return knowledgeBase.findApprovedClaimRules({
    brand: 'WMF',
    category: row.category,
    product_family: row.product_family ?? row.category,
    market: 'DE',
    language: row.source_language,
  });
}

function faq(language: SourceLanguage, question: string, answer: string, purpose_tags: string[]): LocalFaqPreviewRow {
  return {
    language,
    question,
    answer,
    status: language === 'de' ? 'draft' : 'needs-review',
    purpose_tags,
  };
}

function playbookPreviewFaqs(facts: LocalUrlFacts, language: SourceLanguage, playbookContent: string): LocalFaqPreviewRow[] {
  const signals = playbookSignals(playbookContent);
  const faqs: LocalFaqPreviewRow[] = [];

  if ((facts.hasInduction || facts.hasTransTherm) && /induction|compatibility|hob/i.test(playbookContent)) {
    faqs.push(faq(language, facts.productType === 'pan set' ? 'Will this pan set work on an induction hob?' : 'Will this pan work on an induction hob?', inductionAnswer(facts), ['expectation']));
  }

  if (facts.hasDishwasher && /dishwasher|care/i.test(playbookContent)) {
    faqs.push(faq(language, facts.productType === 'pan set' ? 'Can I put this pan set in the dishwasher?' : 'Can I put this pan in the dishwasher?', dishwasherAnswer(facts), ['support-reduction']));
  }

  if (facts.hasOven && /oven/i.test(playbookContent)) {
    faqs.push(faq(language, facts.productType === 'pan set' ? 'Can this pan set go in the oven?' : 'Can this pan go in the oven?', ovenAnswer(facts), ['expectation']));
  }

  if (facts.productType === 'pan set' && facts.sizes.length > 0 && signals.pan_set_sizes) {
    faqs.push(faq(language, 'What sizes are included in this pan set?', `${productName(facts)} includes ${facts.sizes.join(', ')}.`, ['buyer-hesitation']));
    faqs.push(faq(language, sizeQuestion(facts), sizeAnswer(facts), ['benefit-selling']));
  }

  if (facts.productType === 'frying pan' && facts.sizes.length > 0 && /size selection|portion|cooking job/i.test(playbookContent)) {
    faqs.push(faq(language, sizeQuestion(facts), sizeAnswer(facts), ['benefit-selling']));
  }

  if (facts.productType === 'frying pan' && facts.hasCromargan && signals.stainless_sticking) {
    faqs.push(faq(language, 'Why does food stick in a stainless-steel pan?', 'Food often sticks when the pan is not preheated enough, the heat is too high or too low, or the food is moved before it releases. Preheat the pan, add oil or fat after heating as appropriate, and let proteins form a crust before turning. For eggs, fish, or pancakes with little fat, non-stick can be easier.', ['buyer-hesitation']));
    faqs.push(faq(language, 'Is this pan a good choice for steak and high-heat cooking?', 'Yes. A stainless-steel frying pan is suitable for browning and searing because it supports strong contact between food and the pan surface. Preheat carefully and use enough oil or fat for reliable release.', ['buyer-hesitation']));
  }

  if (facts.productType === 'frying pan' && facts.hasCromargan && signals.stainless_care) {
    faqs.push(faq(language, 'Why do water spots or rainbow marks appear on stainless steel?', 'Water spots are usually mineral deposits left behind as water dries. Rainbow marks can appear after heat exposure. They can often be reduced with gentle stainless-steel care and thorough drying after washing.', ['support-reduction']));
  }

  if (facts.productType === 'frying pan' && facts.hasCoating && signals.nonstick_delicate) {
    const coating = facts.hasCeramic ? 'ceramic coating' : 'non-stick coating';
    faqs.push(faq(language, facts.hasCeramic ? 'What is a ceramic frying pan best for?' : 'What is a non-stick frying pan best for?', `This ${coating} is a good fit for eggs, fish, pancakes, and delicate foods because easier release matters more than hard searing. Use moderate heat and avoid overheating so the coating keeps its release performance longer.`, ['buyer-hesitation']));
    faqs.push(faq(language, facts.hasCeramic ? 'How should I care for a ceramic frying pan?' : 'How should I care for a non-stick frying pan?', `Use moderate heat, soft cleaning tools, and non-metal utensils on the ${coating}. That protects the cooking surface and helps delicate foods release more reliably over time.`, ['support-reduction']));
  }

  if (facts.productType === 'frying pan' && signals.comparison) {
    faqs.push(faq(language, 'How is this pan different from other WMF frying pans?', `${productName(facts)} should be compared by product type, surface, size, and supported compatibility evidence. Here, the clearest differentiators are ${facts.hasCromargan ? 'stainless-steel construction' : facts.hasCeramic ? 'ceramic coating' : facts.hasCoating ? 'non-stick coating' : facts.productType}${facts.sizes.length ? ` and ${facts.sizes.join(', ')}` : ''}.`, ['comparison']));
  }

  return faqs.filter((item) => item.answer.trim().length > 0);
}

function rankFaqsByReviewSignals(faqs: LocalFaqPreviewRow[], reviewContent: string): LocalFaqPreviewRow[] {
  if (!reviewContent.trim()) return faqs;
  const signals = reviewSignals(reviewContent);
  return faqs
    .map((item, index) => {
      const text = `${item.question} ${item.answer}`.toLowerCase();
      let score = 0;
      if (signals.food_sticking && /stick|preheat|heat|release/.test(text)) score += 50;
      if (signals.water_spots && /water spot|rainbow|mineral|marks/.test(text)) score += 45;
      if (signals.size_selection && /size|20 cm|24 cm|28 cm|32 cm|portion|household/.test(text)) score += 40;
      if (signals.coating_care && /coating|non-stick|ceramic|utensil|overheating|delicate/.test(text)) score += 35;
      if (signals.dishwasher_confusion && /dishwasher/.test(text)) score += 30;
      if (signals.induction_confusion && /induction|hob/.test(text)) score += 30;
      if (signals.family_comparison && /different from|compare|comparison|other wmf/.test(text)) score += 25;
      if (signals.stainless_steel_learning && /stainless|cromargan|searing|browning/.test(text)) score += 20;
      if (signals.expectation_gap && /better for|best for|can i|will this|why/.test(text)) score += 10;
      return { item, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}

function passesClaimGuidance(faq: LocalFaqPreviewRow, facts: LocalUrlFacts, claimRules: KnowledgeBaseDocumentRecord[]): boolean {
  if (claimRules.length === 0) return true;
  const text = `${faq.question} ${faq.answer}`;
  const hasCompatibilityEvidence =
    (/induction/i.test(text) && (facts.hasInduction || facts.hasTransTherm)) ||
    (/dishwasher/i.test(text) && facts.hasDishwasher) ||
    (/oven|°c/i.test(text) && facts.hasOven);
  const hasEvidence = hasCompatibilityEvidence || facts.hasCromargan || facts.hasCoating || facts.sizes.length > 0;
  const evaluation = evaluateClaimGuidance(text, {
    market: 'DE',
    language: faq.language,
    hasEvidence,
    hasApprovedSource: false,
    hasPositioningEvidence: false,
    claimRules,
  });

  return evaluation.status === 'approved';
}

export function estimateLocalPreview(input: LocalPreviewInput) {
  return estimateJobCost({
    intake_rows: createLocalIntakeRows(input.urls),
    target_languages: selectedLanguagesForInput(input),
    run_mode: input.run_mode ?? 'lean',
    max_faq_count: input.max_faq_count,
    cost_ceiling_eur: input.cost_ceiling_eur,
  });
}

export function runLocalPreview(input: LocalPreviewInput) {
  const intakeRows = createLocalIntakeRows(input.urls);
  const knowledgeBase = input.knowledge_base ?? createKnowledgeBaseRegistry();
  const knowledgeWarnings = Array.from(new Set(intakeRows
    .map((row) => getKnowledgebaseAvailability(knowledgeBase, {
      brand: 'WMF',
      category: row.category,
      product_family: row.product_family ?? row.category,
      language: row.source_language,
    }).warning)
    .filter((warning): warning is string => Boolean(warning))));
  const result = processBatchJob({
    job_id: `local-${Date.now()}`,
    intake_rows: intakeRows,
    target_languages: selectedLanguagesForInput(input),
    run_mode: input.run_mode ?? 'lean',
    max_faq_count: input.max_faq_count,
    cost_ceiling_eur: input.cost_ceiling_eur,
    cost_confirmed: input.cost_confirmed,
    continue_after_warning: input.continue_after_warning,
    brand: 'WMF',
    created_at: new Date().toISOString(),
    extractPko: createLocalPkoFromIntake,
  });

  const quality = result.sub_batches.reduce(
    (summary, subBatch) => {
      summary.approved += subBatch.quality_summary.approved_count;
      summary.draft += subBatch.quality_summary.draft_count;
      summary.needsReview += subBatch.quality_summary.needs_review_count;
      summary.claimRiskFailures += subBatch.quality_summary.claim_risk_failure_count;
      summary.highSeverityRisks += subBatch.quality_summary.high_severity_risk_count;
      summary.shouldPause = summary.shouldPause || subBatch.quality_summary.should_pause;
      return summary;
    },
    { approved: 0, draft: 0, needsReview: 0, claimRiskFailures: 0, highSeverityRisks: 0, shouldPause: false },
  );

  const visibleLanguages = selectedLanguagesForInput(input);
  const generatedLanguages = generatedLanguagesForPreview(visibleLanguages);
  const localizationWarnings = skippedLocalizationWarnings(visibleLanguages, generatedLanguages);
  const selectedLanguages = result.accumulated_rows.length > 0
    ? generatedLanguages
    : generatedLanguages;
  const preview_rows: LocalProductPreviewRow[] = result.accumulated_rows.map((row) => {
    const facts = inferUrlFacts(row.intake.url);
    const matchingPlaybookContent = approvedPlaybookContent(knowledgeBase, row.intake);
    const matchingReviewContent = approvedReviewIntelligenceContent(knowledgeBase, row.intake);
    const matchingClaimRules = approvedClaimRules(knowledgeBase, row.intake);
    const playbookFaqs = matchingPlaybookContent
      ? generatedLanguages.flatMap((language) => rankFaqsByReviewSignals(
        playbookPreviewFaqs(facts, language, matchingPlaybookContent),
        matchingReviewContent,
      )).filter((item) => passesClaimGuidance(item, facts, matchingClaimRules))
      : [];
    const pipelineFaqs = row.faq_items.filter((faq) => generatedLanguages.includes(faq.language)).map((faq) => ({
      language: faq.language,
      question: faq.question,
      answer: faq.answer,
      status: faq.status,
      purpose_tags: faq.purpose_tags,
    }));
    const faqs = playbookFaqs.length > 0 ? playbookFaqs : pipelineFaqs;

    return {
      url: row.intake.url,
      product_id: row.intake.product_id ?? '',
      status: faqs.some((faq) => faq.status === 'needs-review')
        ? 'needs-review'
        : row.faq_items.some((faq) => faq.status === 'draft')
          ? 'draft'
          : 'approved',
      selected_languages: Array.from(new Set(faqs.map((faq) => faq.language))).sort(),
      faq_count: faqs.length,
      faqs,
    };
  });

  return {
    modeLabel: 'Local deterministic preview',
    jobStatus: result.status,
    urlsProcessed: result.accumulated_rows.length,
    internalSubBatches: result.sub_batches.length,
    generatedFaqItems: result.accumulated_rows.reduce((count, row) => count + row.faq_items.length, 0),
    selectedLanguages,
    quality,
    previewWorkbookAvailable: result.preview_exports.length > 0,
    finalWorkbookAvailable: Boolean(result.final_export),
    preview_rows,
    workbookTabs: (result.final_export ?? result.preview_exports.at(-1))?.tabs.map((tab) => ({ name: tab.name, rowCount: tab.rows.length })) ?? [],
    filename: result.final_export?.filename ?? result.preview_exports.at(-1)?.filename,
    excelXml: result.final_export?.excelXml ?? result.preview_exports.at(-1)?.excelXml,
    warnings: [...result.warnings, ...knowledgeWarnings, ...localizationWarnings],
    raw: result,
  };
}
