import { describe, expect, it } from 'vitest';
import { estimateLocalPreview, runLocalPreview } from './local-preview';
import browserPreview from './local-preview-browser.js';

describe('Phase 10A local web preview adapter', () => {
  const forbiddenPreviewCopy = /deterministic|preview|product context|category playbook|grouping logic|FAQ engine|local product|FAQ question|the answer should|when supported|when visible|preview checks|URL does not provide|do not present|unless the product details confirm|evidence is missing/i;
  const stainlessFryPanUrl = 'https://www.wmf.com/de/en/profi-fry-pan-28-cm';

  it('estimates cost through the deterministic job processor', () => {
    const estimate = estimateLocalPreview({
      urls: ['https://example.com/a', 'https://example.com/b'],
      target_languages: ['de', 'en'],
      run_mode: 'standard',
      cost_ceiling_eur: 50,
    });

    expect(estimate.url_count).toBe(2);
    expect(estimate.selected_language_count).toBe(2);
    expect(estimate.provider_cost_estimate).toBeGreaterThan(0);
  });

  it('runs a deterministic local preview and exposes workbook tab counts', () => {
    const result = runLocalPreview({
      urls: ['https://example.com/a'],
      target_languages: ['de'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(result.modeLabel).toBe('Local deterministic preview');
    expect(result.urlsProcessed).toBe(1);
    expect(result.internalSubBatches).toBe(1);
    expect(result.preview_rows).toHaveLength(1);
    expect(result.workbookTabs).toHaveLength(10);
    expect(result.workbookTabs.some((tab) => tab.name === 'Job Summary')).toBe(true);
  });

  it('exposes one FAQ preview item for a single URL', () => {
    const result = runLocalPreview({
      urls: ['https://example.com/a'],
      target_languages: ['de'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(result.preview_rows).toHaveLength(1);
    expect(result.preview_rows[0].url).toBe('https://example.com/a');
    expect(result.preview_rows[0].product_id).toBe('local-product-1');
    expect(result.preview_rows[0].faq_count).toBe(result.preview_rows[0].faqs.length);
  });

  it('node preview rows use pipeline FAQ items instead of placeholder text', () => {
    const result = runLocalPreview({
      urls: ['https://example.com/wmf-cookware-pan'],
      target_languages: ['de'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const visibleFaqText = result.preview_rows.flatMap((row) => row.faqs).map((faq) => `${faq.question} ${faq.answer}`).join(' ');

    expect(visibleFaqText).not.toMatch(/FAQ question|Deterministic local preview answer|local product/i);
    expect(result.preview_rows[0].faqs.every((faq) => faq.language === 'en')).toBe(true);
  });

  it('exposes three FAQ preview items for three URLs', () => {
    const result = runLocalPreview({
      urls: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'],
      target_languages: ['de'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(result.preview_rows).toHaveLength(3);
    expect(result.preview_rows.map((row) => row.product_id)).toEqual(['local-product-1', 'local-product-2', 'local-product-3']);
  });

  it('browser carousel helper clamps previous and next movement', () => {
    expect(browserPreview.carouselIndex(0, 3, 'previous')).toBe(0);
    expect(browserPreview.carouselIndex(0, 3, 'next')).toBe(1);
    expect(browserPreview.carouselIndex(2, 3, 'next')).toBe(2);
    expect(browserPreview.carouselIndex(1, 3, 'previous')).toBe(0);
    expect(browserPreview.carouselIndex(0, 0, 'next')).toBe(0);
  });

  it('cost-blocked result has zero preview rows', () => {
    const result = runLocalPreview({
      urls: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'],
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      run_mode: 'premium-p1',
      cost_ceiling_eur: 0.01,
      cost_confirmed: false,
    });

    expect(result.jobStatus).toBe('Cost Estimated');
    expect(result.preview_rows).toHaveLength(0);
  });

  it('visible preview labels avoid internal terms', () => {
    const visibleText = browserPreview.visiblePreviewLabels().join(' ');

    expect(visibleText).not.toMatch(/PKO|FMO|RAG|EvidenceBundle|OPA/i);
    expect(visibleText).toContain('FAQ Preview');
    expect(visibleText).toContain('product_id');
  });

  it('browser preview rows use URL-aware cookware FAQ themes instead of generic placeholders', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://example.com/de/de/devil-bratpfannen-set-3-teilig-20-cm-24-cm-28-cm-antihaft'],
      target_languages: ['de'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const questions = result.preview_rows[0].faqs.map((faq: any) => faq.question).join(' ');
    const visibleFaqText = result.preview_rows.flatMap((row: any) => row.faqs).map((faq: any) => `${faq.question} ${faq.answer}`).join(' ');

    expect(visibleFaqText).not.toMatch(forbiddenPreviewCopy);
    expect(questions).toMatch(/Pfannenset|Größen/i);
    expect(visibleFaqText).toMatch(/20 cm/);
    expect(visibleFaqText).toMatch(/24 cm/);
    expect(visibleFaqText).toMatch(/28 cm/);
  });

  it('browser FAQ preview copy is customer-facing and feature-backed when URL evidence exists', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://example.com/de/de/profi-stielpfanne-28-cm-antihaft-induktion'],
      target_languages: ['de'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const faqText = result.preview_rows.flatMap((row: any) => row.faqs).map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');

    expect(faqText).not.toMatch(forbiddenPreviewCopy);
    expect(faqText).toMatch(/Induktion|Antihaft|Edelstahl/i);
  });

  it('English WMF locale URL produces English preview rows when no target language is supplied', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(result.selectedLanguages).toEqual(['en']);
    expect(result.preview_rows[0].selected_languages).toEqual(['en']);
    expect(result.preview_rows[0].faqs.every((faq: any) => faq.language === 'en')).toBe(true);
  });

  it('node preview defaults /de/en/ source URLs to EN-only visible rows when target languages are unset', () => {
    const result = runLocalPreview({
      urls: [stainlessFryPanUrl],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(result.selectedLanguages).toEqual(['en']);
    expect(result.preview_rows[0].selected_languages).toEqual(['en']);
    expect(result.preview_rows[0].faqs.every((faq) => faq.language === 'en')).toBe(true);
  });

  it('selecting DE produces German browser FAQ copy instead of German-labeled English', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['de'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    const text = result.preview_rows[0].faqs.map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');

    expect(result.selectedLanguages).toEqual(['de']);
    expect(result.preview_rows[0].faqs.every((faq: any) => faq.language === 'de')).toBe(true);
    expect(text).toMatch(/Pfanne|Edelstahl|Speisen|Kochen/i);
    expect(text).not.toMatch(/Why does food stick|stainless-steel pan|right pan size/i);
  });

  it('selecting DE + EN produces deterministic localized browser rows for both languages', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['de', 'en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const faqs = result.preview_rows.flatMap((row: any) => row.faqs);
    const deText = faqs.filter((faq: any) => faq.language === 'de').map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');
    const enText = faqs.filter((faq: any) => faq.language === 'en').map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');

    expect(result.selectedLanguages).toEqual(['de', 'en']);
    expect(faqs.length).toBeGreaterThan(0);
    expect(deText).toMatch(/Pfanne|Edelstahl|Speisen/i);
    expect(enText).toMatch(/stainless-steel pan|food stick|right pan size/i);
  });

  it('selecting all five languages produces localized browser rows where canned templates exist', () => {
    const result = runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const browserResult = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(result.selectedLanguages).toEqual(['en']);
    expect(result.preview_rows[0].selected_languages).toEqual(['en']);
    expect(result.preview_rows[0].faqs.every((faq) => faq.language === 'en')).toBe(true);
    expect(result.warnings).toContain('Selected languages skipped because deterministic localization is not implemented: de, es, nl, fr');
    expect(browserResult.selectedLanguages).toEqual(['de', 'en', 'es', 'nl', 'fr']);
    expect(new Set(browserResult.preview_rows[0].faqs.map((faq: any) => faq.language))).toEqual(new Set(['de', 'en', 'es', 'nl', 'fr']));
    expect(browserResult.visiblePreviewText?.(browserResult) ?? browserPreview.visiblePreviewText(browserResult)).not.toMatch(/Some FAQ templates were skipped/i);
  });

  it('claim guidance suppresses language-specific dishwasher rows for ES and FR', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm-dishwasher'],
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const dishwasherRows = result.preview_rows[0].faqs.filter((faq: any) => /dishwasher|Spülmaschine|vaatwasser|lavavajillas|lave-vaisselle/i.test(`${faq.question} ${faq.answer}`));

    expect(dishwasherRows.map((faq: any) => faq.language).sort()).toEqual(['de', 'en', 'nl']);
    expect(result.preview_rows[0].faq_count).toBe(result.preview_rows[0].faqs.length);
  });

  it('FAQ count equals actual generated preview rows and schema fields are unchanged', () => {
    const result = runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['de', 'en', 'es', 'nl', 'fr'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(result.preview_rows[0].faq_count).toBe(result.preview_rows[0].faqs.length);
    expect(Object.keys(result.raw.accumulated_rows[0].faq_items[0]).sort()).toEqual([
      'answer',
      'claim_risk_pass',
      'created_at',
      'evaluator_scores',
      'faq_id',
      'fmo_coverage',
      'is_master',
      'language',
      'pko_id',
      'purpose_tags',
      'question',
      'rewrite_count',
      'risk_flags',
      'schema_ready',
      'source_evidence',
      'status',
      'version',
    ].sort());
  });

  it('single fry-pan URL does not show pan-set or lid questions without URL evidence', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm-antihaft'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const questions = result.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n');
    const text = result.preview_rows[0].faqs.map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');

    expect(questions).not.toMatch(/What is included in this pan set/i);
    expect(questions).not.toMatch(/lid/i);
    expect(questions).not.toMatch(/induction/i);
    expect(text).not.toMatch(/Cool\+|TransTherm®|glass lid|URL does not provide|do not present/i);
  });

  it('single 28 cm stainless-steel fry-pan URL has useful natural customer questions', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const questions = result.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n');
    const text = result.preview_rows[0].faqs.map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');

    expect(questions).toMatch(/right pan size/i);
    expect(questions).toMatch(/steak and high-heat/i);
    expect(questions).toMatch(/food stick in a stainless-steel pan/i);
    expect(questions).toMatch(/clean and care for this stainless-steel pan/i);
    expect(questions).toMatch(/water spots or rainbow marks/i);
    expect(text).toMatch(/proteins|vegetables|sautéing|browning|searing/i);
    expect(text).toMatch(/2–3 people|2-3 people/i);
    expect(text).toMatch(/preheat|heat control|oil|fat|release/i);
    expect(questions).not.toMatch(/^What size is this pan\?$/im);
    expect(text).not.toMatch(forbiddenPreviewCopy);
  });

  it('single stainless-steel fry-pan preview has no duplicate water-spot or cleaning answers', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const questions = result.preview_rows[0].faqs.map((faq: any) => faq.question);
    const careQuestions = questions.filter((question: string) => /clean|care|water spots|rainbow marks/i.test(question));

    expect(careQuestions).toEqual([
      'How should I clean and care for this stainless-steel pan?',
      'Why do water spots or rainbow marks appear on stainless steel?',
    ]);
  });

  it('non-stick guidance is secondary in stainless-steel sticking answer', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const faq = result.preview_rows[0].faqs.find((item: any) => item.question === 'Why does food stick in a stainless-steel pan?');

    expect(faq).toBeDefined();
    expect(faq.answer).toMatch(/preheat|heat/i);
    expect(faq.answer.indexOf('Preheat')).toBeLessThan(faq.answer.indexOf('non-stick'));
  });

  it('pan-set URL includes set contents and exact sizes from the slug', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/devil-pan-set-3-piece-20-cm-24-cm-28-cm-non-stick'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const text = result.preview_rows[0].faqs.map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');

    expect(text).toMatch(/What sizes are included in this pan set/i);
    expect(text).toMatch(/20 cm/);
    expect(text).toMatch(/24 cm/);
    expect(text).toMatch(/28 cm/);
  });

  it('dishwasher and care question phrasing is natural', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const questions = result.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n');

    expect(questions).toMatch(/How should I clean and care for this stainless-steel pan|Why do water spots or rainbow marks appear on stainless steel/i);
    expect(questions).not.toMatch(/How should I clean the cookware if it is dishwasher-suitable/i);
  });

  it('generalizes stainless-steel sticking logic beyond Profi', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const text = result.preview_rows[0].faqs.map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');

    expect(text).toMatch(/Why does food stick in a stainless-steel pan/i);
    expect(text).toMatch(/Preheat|oil|fat|release/i);
  });

  it('activates different cookware opportunities by product type and coating', () => {
    const nonStick = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/devil-fry-pan-24-cm-non-stick'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const ceramic = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/durado-fry-pan-24-cm-ceramic'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const wok = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/devil-wok-28-cm'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const grill = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/durado-grill-pan-28-cm'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const crepe = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/creperie-crepe-pan-28-cm'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(nonStick.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n')).toMatch(/non-stick frying pan best/i);
    expect(ceramic.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n')).toMatch(/ceramic frying pan best/i);
    expect(wok.preview_rows[0].faqs.map((faq: any) => faq.answer).join('\n')).toMatch(/stir-frying|tossing|high-sided/i);
    expect(grill.preview_rows[0].faqs.map((faq: any) => faq.answer).join('\n')).toMatch(/grill-style marks|indoor grilling|searing/i);
    expect(crepe.preview_rows[0].faqs.map((faq: any) => faq.answer).join('\n')).toMatch(/thin batter|low rim/i);
  });

  it('gates dishwasher, induction, and oven FAQs by URL evidence', () => {
    const plain = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const supported = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm-induction-dishwasher-oven-safe'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const plainQuestions = plain.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n');
    const supportedQuestions = supported.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n');

    expect(plainQuestions).not.toMatch(/induction hob|dishwasher|oven/i);
    expect(supportedQuestions).toMatch(/induction hob/i);
    expect(supportedQuestions).toMatch(/dishwasher/i);
    expect(supportedQuestions).toMatch(/oven/i);
  });

  it('max=12 returns 12 FAQs when 12 eligible candidates exist', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm-induction-dishwasher-oven-safe'],
      target_languages: ['en'],
      run_mode: 'lean',
      max_faq_count: 12,
      cost_ceiling_eur: 50,
    });

    expect(result.preview_rows[0].faqs).toHaveLength(12);
    expect(result.preview_rows[0].faq_count).toBe(12);
    expect(result.generatedFaqItems).toBe(12);
  });

  it('max=7 returns 7 after collecting and ranking more eligible candidates', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm-induction-dishwasher-oven-safe'],
      target_languages: ['en'],
      run_mode: 'lean',
      max_faq_count: 7,
      cost_ceiling_eur: 50,
    });

    expect(result.preview_rows[0].faqs).toHaveLength(7);
    expect(result.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n')).toMatch(/induction hob/i);
  });

  it('Profi 28 cm with induction evidence includes induction FAQ', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm-induction'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const questions = result.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n');

    expect(questions).toMatch(/Will this pan work on an induction hob/i);
  });

  it('missing induction evidence skips induction FAQ and records diagnostic', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const questions = result.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n');
    const diagnostic = result.candidateDiagnostics.find((item: any) => item.candidate_id === 'induction_compatibility');

    expect(questions).not.toMatch(/induction hob/i);
    expect(diagnostic).toEqual(expect.objectContaining({
      candidate_id: 'induction_compatibility',
      skip_reason: 'missing_evidence',
      missing_evidence_type: 'induction',
    }));
  });

  it('missing oven evidence skips oven FAQ and records diagnostic', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm-induction'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const questions = result.preview_rows[0].faqs.map((faq: any) => faq.question).join('\n');
    const diagnostic = result.candidateDiagnostics.find((item: any) => item.candidate_id === 'oven_compatibility');

    expect(questions).not.toMatch(/go in the oven/i);
    expect(diagnostic).toEqual(expect.objectContaining({
      candidate_id: 'oven_compatibility',
      skip_reason: 'missing_evidence',
      missing_evidence_type: 'oven',
    }));
  });

  it('pan set includes size, cooking-job, compatibility, storage, and versatility opportunities', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/devil-pan-set-3-piece-20-cm-24-cm-28-cm-non-stick-induction'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const text = result.preview_rows[0].faqs.map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');

    expect(text).toMatch(/20 cm/);
    expect(text).toMatch(/24 cm/);
    expect(text).toMatch(/28 cm/);
    expect(text).toMatch(/Which pan size should I use/i);
    expect(text).toMatch(/induction hob/i);
    expect(text).toMatch(/storage and versatility/i);
  });

  it('visible preview text does not include the empty message when preview rows exist', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(browserPreview.visiblePreviewText(result)).not.toContain('No FAQ preview is available yet');
  });

  it('does not expose cost-confirmation state when confirmation is not required', () => {
    const result = browserPreview.runLocalPreview({
      urls: [stainlessFryPanUrl],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(result.jobStatus).not.toBe('Cost Estimated');
    expect(result.confirmationRequired).toBe(false);
    expect(result.preview_rows[0].faqs.length).toBeGreaterThan(0);
  });

  it('URL changes produce different browser FAQ questions', () => {
    const fryPan = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm-antihaft'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const panSet = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/devil-pan-set-3-piece-20-cm-24-cm-28-cm-non-stick'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });

    expect(fryPan.preview_rows[0].faqs.map((faq: any) => faq.question)).not.toEqual(panSet.preview_rows[0].faqs.map((faq: any) => faq.question));
  });

  it('does not show unsupported feature claims in browser preview answers', () => {
    const result = browserPreview.runLocalPreview({
      urls: ['https://www.wmf.com/de/en/devil-fry-pan-28-cm'],
      target_languages: ['en'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
    });
    const text = result.preview_rows[0].faqs.map((faq: any) => `${faq.question} ${faq.answer}`).join('\n');

    expect(text).not.toMatch(/Cool\+|Cromargan®|TransTherm®|glass lid/i);
    expect(text).not.toMatch(/the answer should/i);
  });

  it('keeps browser estimate output consistent with the deterministic adapter', () => {
    const input = {
      urls: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'],
      target_languages: ['de', 'en', 'es', 'nl', 'fr'] as const,
      run_mode: 'standard' as const,
      cost_ceiling_eur: 50,
    };

    const nodeEstimate = estimateLocalPreview(input);
    const browserEstimate = browserPreview.estimateLocalPreview(input);

    expect(browserEstimate.url_count).toBe(nodeEstimate.url_count);
    expect(browserEstimate.selected_language_count).toBe(nodeEstimate.selected_language_count);
    expect(browserEstimate.run_mode).toBe(nodeEstimate.run_mode);
    expect(browserEstimate.provider_cost_estimate).toBe(nodeEstimate.provider_cost_estimate);
    expect(browserEstimate.client_cost_estimate).toBe(nodeEstimate.client_cost_estimate);
    expect(browserEstimate.requires_confirmation).toBe(nodeEstimate.requires_confirmation);
  });

  it('keeps browser run output consistent with deterministic status and workbook availability', () => {
    const input = {
      urls: ['https://example.com/a'],
      target_languages: ['de', 'en'] as const,
      run_mode: 'standard' as const,
      cost_ceiling_eur: 50,
    };

    const nodeResult = runLocalPreview(input);
    const browserResult = browserPreview.runLocalPreview(input);

    expect(browserResult.urlsProcessed).toBe(nodeResult.urlsProcessed);
    expect(browserResult.selectedLanguages).toEqual(['de', 'en']);
    expect(browserResult.jobStatus).toBe(nodeResult.jobStatus);
    expect(browserResult.previewWorkbookAvailable).toBe(nodeResult.previewWorkbookAvailable);
    expect(browserResult.finalWorkbookAvailable).toBe(nodeResult.finalWorkbookAvailable);
    expect(browserResult.preview_rows).toHaveLength(nodeResult.preview_rows.length);
    expect(browserResult.workbookTabs).toHaveLength(nodeResult.workbookTabs.length);
    expect(browserResult.excelXml).toContain('<Workbook');
  });
});
