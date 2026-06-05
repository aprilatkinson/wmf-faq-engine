import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { faqItemSchema } from '../../../core/src/schemas/faq.schema';
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  createKnowledgeBaseRegistry,
  createKnowledgeIndex,
  evaluateClaimGuidance,
  getKnowledgebaseAvailability,
  ingestCategoryPlaybook,
  ingestClaimGuidance,
  ingestProductDocument,
  ingestReviewIntelligence,
} from '../knowledge-base';
import { runLocalPreview } from '../../../../apps/web/local-preview';

describe('Phase 10B knowledge base intake starter', () => {
  it('ingests product documents deterministically', () => {
    const record = ingestProductDocument({
      title: 'Cookware Care Guide',
      source_type: 'product-document',
      language: 'de',
      category: 'Cookware',
      content: 'Stainless steel cookware may show white spots from minerals.',
    });

    expect(record.source_type).toBe('product-document');
    expect(record.document_id).toContain('cookware-care-guide');
    expect(record.content).toContain('white spots');
  });

  it('ingests review intelligence deterministically', () => {
    const record = ingestReviewIntelligence({
      category: 'Cookware',
      issue: 'white spots after washing',
      frequency: 18,
      customer_wording: ['Why are there white spots?', 'Is this rust?'],
      recommended_faq_opportunity: 'Explain mineral spots and care.',
    });

    expect(record.source_type).toBe('review-intelligence');
    expect(record.frequency).toBe(18);
    expect(record.recommended_faq_opportunity).toContain('mineral spots');
  });

  it('ingests category playbooks deterministically', () => {
    const record = ingestCategoryPlaybook({
      category: 'Cookware',
      opportunities: ['induction suitability', 'dishwasher care'],
      care_guidance: ['Recommend hand washing even when dishwasher-suitable.'],
      comparison_guidance: ['Compare pot set vs frying pan jobs.'],
      upsell_guidance: ['Recommend non-stick pan for eggs.'],
    });

    expect(record.source_type).toBe('category-playbook');
    expect(record.opportunities).toContain('induction suitability');
    expect(record.upsell_guidance).toContain('Recommend non-stick pan for eggs.');
  });

  it('ingests claim guidance deterministically', () => {
    const record = ingestClaimGuidance({
      category: 'Cookware',
      approved_claims: ['induction-suitable'],
      review_required_claims: ['dishwasher-suitable in FR'],
      prohibited_claims: ['scratch-proof'],
    });

    expect(record.source_type).toBe('claim-guidance');
    expect(record.approved_claims).toContain('induction-suitable');
    expect(record.prohibited_claims).toContain('scratch-proof');
  });

  it('retrieves category knowledge, review insights, claim guidance, and summary', () => {
    const index = createKnowledgeIndex();
    index.addProductDocument({
      title: 'Cookware Care Guide',
      source_type: 'product-document',
      language: 'de',
      category: 'Cookware',
      content: 'Care content',
    });
    index.addReviewIntelligence({
      category: 'Cookware',
      issue: 'handle warmth',
      frequency: 12,
      customer_wording: ['Can handles become warm?'],
      recommended_faq_opportunity: 'Set handle warmth expectation.',
    });
    index.addCategoryPlaybook({
      category: 'Cookware',
      opportunities: ['handle warmth expectation'],
      care_guidance: ['Use normal cookware care.'],
      comparison_guidance: ['Compare by cooking job.'],
      upsell_guidance: ['Add a suitable pan for eggs.'],
    });
    index.addClaimGuidance({
      category: 'Cookware',
      approved_claims: ['induction-suitable'],
      review_required_claims: ['scratch-resistant'],
      prohibited_claims: ['scratch-proof'],
    });

    const knowledge = index.getKnowledgeForCategory('cookware');
    expect(knowledge.product_documents).toHaveLength(1);
    expect(knowledge.review_intelligence).toHaveLength(1);
    expect(knowledge.category_playbooks).toHaveLength(1);
    expect(knowledge.claim_guidance).toHaveLength(1);

    expect(index.getReviewInsights('Cookware')[0].issue).toBe('handle warmth');
    expect(index.getClaimGuidance('Cookware')[0].prohibited_claims).toContain('scratch-proof');

    const summary = index.getKnowledgeSummary('Cookware');
    expect(summary.product_document_count).toBe(1);
    expect(summary.opportunities).toContain('handle warmth expectation');
    expect(summary.approved_claims).toContain('induction-suitable');
  });

  it('does not modify schemas or rely on external dependencies', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const dependencyNames = Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    });

    expect(dependencyNames).not.toContain('openai');
    expect(dependencyNames).not.toContain('@openai/openai');
    expect(dependencyNames).not.toContain('qdrant');
  });
});

describe('Phase 10C.1 knowledge base metadata and approval workflow', () => {
  const approvedCookwareDoc = {
    title: 'Cookware Stainless Steel Playbook',
    content: 'Approved category guidance for stainless-steel cookware.',
    brand: 'WMF',
    category: 'Cookware',
    product_family: 'profi',
    market: 'DE',
    language: 'en',
    document_type: 'Category Playbook' as const,
    claim_sensitivity: 'medium' as const,
    approved_for_use: true,
    approved_at: '2026-06-05T00:00:00.000Z',
    version: '1.0.0',
  };

  it('supports the Section 4.1 document type values', () => {
    expect(KNOWLEDGE_DOCUMENT_TYPES).toEqual([
      'Product Fact Sheet',
      'Benefit Hierarchy',
      'Category Playbook',
      'Claim Rules',
      'Review Intelligence',
      'Brand Voice Guide',
      'Translation Glossary',
      'Approved FAQ Examples',
    ]);
  });

  it('discovers approved KB docs with required metadata', () => {
    const registry = createKnowledgeBaseRegistry();
    const record = registry.registerDocument(approvedCookwareDoc);

    const approved = registry.findApprovedDocuments({
      brand: 'WMF',
      category: 'Cookware',
      product_family: 'Profi',
      market: 'DE',
      language: 'en',
    });

    expect(record.document_id).toContain('cookware-stainless-steel-playbook');
    expect(approved).toHaveLength(1);
    expect(approved[0]).toEqual(expect.objectContaining({
      brand: 'WMF',
      category: 'Cookware',
      product_family: 'profi',
      market: 'DE',
      language: 'en',
      document_type: 'Category Playbook',
      claim_sensitivity: 'medium',
      approved_for_use: true,
      approved_at: '2026-06-05T00:00:00.000Z',
      version: '1.0.0',
    }));
  });

  it('ignores unapproved KB docs for use', () => {
    const registry = createKnowledgeBaseRegistry();
    registry.registerDocument({
      ...approvedCookwareDoc,
      approved_for_use: false,
      approved_at: null,
    });

    expect(registry.listDocuments()).toHaveLength(1);
    expect(registry.findApprovedDocuments({
      brand: 'WMF',
      category: 'Cookware',
      product_family: 'profi',
    })).toHaveLength(0);
  });

  it('ignores wrong category or product_family docs', () => {
    const registry = createKnowledgeBaseRegistry();
    registry.registerDocument(approvedCookwareDoc);
    registry.registerDocument({
      ...approvedCookwareDoc,
      title: 'Coffee Playbook',
      category: 'Coffee',
      product_family: 'Fully Automatic Coffee Machines',
    });

    expect(registry.findApprovedDocuments({
      brand: 'WMF',
      category: 'Cookware',
      product_family: 'Devil',
    })).toHaveLength(0);
    expect(registry.findApprovedDocuments({
      brand: 'WMF',
      category: 'Coffee',
      product_family: 'Fully Automatic Coffee Machines',
    })).toHaveLength(1);
  });

  it('reports missing KB without blocking local preview', () => {
    const registry = createKnowledgeBaseRegistry();
    const availability = getKnowledgebaseAvailability(registry, {
      brand: 'WMF',
      category: 'Cookware',
      product_family: 'profi',
      language: 'en',
    });
    const preview = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registry,
    });

    expect(availability.has_approved_knowledgebase).toBe(false);
    expect(availability.warning).toBe('No approved knowledgebase found for Cookware > profi');
    expect(preview.preview_rows).toHaveLength(1);
    expect(preview.warnings).toContain('No approved knowledgebase found for Cookware > profi');
  });

  it('does not add FAQ fields when KB availability is checked', () => {
    const registry = createKnowledgeBaseRegistry();
    registry.registerDocument(approvedCookwareDoc);

    const preview = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registry,
    });
    const faq = preview.raw.accumulated_rows[0].faq_items[0];

    expect(() => faqItemSchema.parse(faq)).not.toThrow();
    expect(Object.keys(faq).sort()).toEqual([
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

  it('does not override URL or PKO facts with approved KB facts in Phase 10C.1', () => {
    const registry = createKnowledgeBaseRegistry();
    registry.registerDocument({
      ...approvedCookwareDoc,
      content: 'Incorrect override attempt: 32 cm, Made in Germany, oven-safe.',
    });

    const withKb = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registry,
    });
    const withoutKb = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/profi-fry-pan-28-cm'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: createKnowledgeBaseRegistry(),
    });
    const withKbText = withKb.preview_rows.flatMap((row) => row.faqs).map((faq) => `${faq.question} ${faq.answer}`).join('\n');

    expect(withKb.preview_rows[0].faqs).toEqual(withoutKb.preview_rows[0].faqs);
    expect(withKbText).not.toMatch(/32 cm|Made in Germany|oven-safe/i);
    expect(withKb.warnings).not.toContain('No approved knowledgebase found for Cookware > profi');
  });
});

describe('Phase 10C.2 approved category playbook consumption', () => {
  function registerPlaybook(
    registry = createKnowledgeBaseRegistry(),
    product_family = 'gourmet plus',
    content = [
      'stainless sticking preheat heat control food release',
      'water spots rainbow mineral stainless care',
      'size selection portion cooking job',
      'comparison different from buyer anxiety expectation',
      'induction compatibility hob dishwasher care oven',
    ].join('\n'),
    approved_for_use = true,
  ) {
    registry.registerDocument({
      title: `${product_family} Category Playbook`,
      content,
      brand: 'WMF',
      category: 'Cookware',
      product_family,
      market: 'DE',
      language: 'en',
      document_type: 'Category Playbook',
      claim_sensitivity: 'medium',
      approved_for_use,
      approved_at: approved_for_use ? '2026-06-05T00:00:00.000Z' : null,
      version: '1.0.0',
    });
    return registry;
  }

  function previewQuestions(url: string, registry = createKnowledgeBaseRegistry()): string {
    const preview = runLocalPreview({
      urls: [url],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registry,
    });
    return preview.preview_rows.flatMap((row) => row.faqs).map((faq) => `${faq.question} ${faq.answer}`).join('\n');
  }

  it('approved Category Playbook improves opportunity selection', () => {
    const url = 'https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm';
    const withoutPlaybook = previewQuestions(url);
    const withPlaybook = previewQuestions(url, registerPlaybook());

    expect(withoutPlaybook).not.toMatch(/Why does food stick in a stainless-steel pan/i);
    expect(withPlaybook).toMatch(/Why does food stick in a stainless-steel pan/i);
    expect(withPlaybook).toMatch(/How is this pan different from other WMF frying pans/i);
  });

  it('unapproved Category Playbook is ignored', () => {
    const text = previewQuestions(
      'https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm',
      registerPlaybook(createKnowledgeBaseRegistry(), 'gourmet plus', 'stainless sticking preheat heat control food release', false),
    );

    expect(text).not.toMatch(/Why does food stick in a stainless-steel pan/i);
  });

  it('wrong category or product_family playbook is ignored', () => {
    const registry = createKnowledgeBaseRegistry();
    registerPlaybook(registry, 'devil', 'stainless sticking preheat heat control food release', true);
    registry.registerDocument({
      title: 'Coffee Playbook',
      content: 'stainless sticking preheat heat control food release',
      brand: 'WMF',
      category: 'Coffee',
      product_family: 'gourmet plus',
      market: 'DE',
      language: 'en',
      document_type: 'Category Playbook',
      claim_sensitivity: 'medium',
      approved_for_use: true,
      approved_at: '2026-06-05T00:00:00.000Z',
      version: '1.0.0',
    });

    const text = previewQuestions('https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm', registry);

    expect(text).not.toMatch(/Why does food stick in a stainless-steel pan/i);
  });

  it('stainless-steel pan gets sticking and heat-control opportunities when material evidence exists', () => {
    const text = previewQuestions(
      'https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm',
      registerPlaybook(),
    );

    expect(text).toMatch(/Why does food stick in a stainless-steel pan/i);
    expect(text).toMatch(/preheated|heat|oil|fat|release/i);
  });

  it('non-stick and ceramic pans get delicate-food and coating-care opportunities when coating evidence exists', () => {
    const nonStick = previewQuestions(
      'https://www.wmf.com/de/en/devil-fry-pan-24-cm-non-stick',
      registerPlaybook(createKnowledgeBaseRegistry(), 'devil', 'non-stick delicate eggs fish coating care'),
    );
    const ceramic = previewQuestions(
      'https://www.wmf.com/de/en/durado-fry-pan-24-cm-ceramic',
      registerPlaybook(createKnowledgeBaseRegistry(), 'durado', 'ceramic gentle cooking temperature release coating care delicate eggs fish'),
    );

    expect(nonStick).toMatch(/What is a non-stick frying pan best for/i);
    expect(nonStick).toMatch(/eggs|fish|delicate foods/i);
    expect(nonStick).toMatch(/How should I care for a non-stick frying pan/i);
    expect(ceramic).toMatch(/What is a ceramic frying pan best for/i);
    expect(ceramic).toMatch(/How should I care for a ceramic frying pan/i);
  });

  it('pan set gets size-selection opportunity when sizes exist', () => {
    const text = previewQuestions(
      'https://www.wmf.com/de/en/devil-pan-set-3-piece-20-cm-24-cm-28-cm-non-stick',
      registerPlaybook(createKnowledgeBaseRegistry(), 'devil', 'pan set size selection included sizes versatility storage cooking job'),
    );

    expect(text).toMatch(/What sizes are included in this pan set/i);
    expect(text).toMatch(/20 cm/);
    expect(text).toMatch(/24 cm/);
    expect(text).toMatch(/28 cm/);
    expect(text).toMatch(/Which pan size should I use for which cooking job/i);
  });

  it('induction, dishwasher, and oven opportunities are skipped when PKO evidence is missing', () => {
    const missing = previewQuestions(
      'https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm',
      registerPlaybook(),
    );
    const supported = previewQuestions(
      'https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm-induction-dishwasher-oven-safe',
      registerPlaybook(),
    );

    expect(missing).not.toMatch(/induction hob|dishwasher|oven/i);
    expect(supported).toMatch(/induction hob/i);
    expect(supported).toMatch(/dishwasher/i);
    expect(supported).toMatch(/oven/i);
  });

  it('does not show missing-evidence disclaimers and keeps FAQ Item schema unchanged', () => {
    const preview = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registerPlaybook(),
    });
    const text = preview.preview_rows.flatMap((row) => row.faqs).map((faq) => `${faq.question} ${faq.answer}`).join('\n');

    expect(text).not.toMatch(/URL does not provide|do not present|the answer should|when supported|product context|evidence is missing/i);
    expect(() => faqItemSchema.parse(preview.raw.accumulated_rows[0].faq_items[0])).not.toThrow();
  });
});

describe('Phase 10C.3 review intelligence prioritization', () => {
  function registryWithPlaybook(product_family = 'gourmet plus') {
    const registry = createKnowledgeBaseRegistry();
    registry.registerDocument({
      title: `${product_family} Category Playbook`,
      content: [
        'stainless sticking preheat heat control food release',
        'water spots rainbow mineral stainless care',
        'size selection portion cooking job',
        'comparison different from buyer anxiety expectation',
        'non-stick delicate eggs fish coating care',
        'induction compatibility hob dishwasher care oven',
      ].join('\n'),
      brand: 'WMF',
      category: 'Cookware',
      product_family,
      market: 'DE',
      language: 'en',
      document_type: 'Category Playbook',
      claim_sensitivity: 'medium',
      approved_for_use: true,
      approved_at: '2026-06-05T00:00:00.000Z',
      version: '1.0.0',
    });
    return registry;
  }

  function addReview(
    registry = registryWithPlaybook(),
    product_family = 'gourmet plus',
    content = 'support_issue food_sticking heat_control buyer_anxiety',
    approved_for_use = true,
    category = 'Cookware',
  ) {
    registry.registerDocument({
      title: `${product_family} Review Intelligence`,
      content,
      brand: 'WMF',
      category,
      product_family,
      market: 'DE',
      language: 'en',
      document_type: 'Review Intelligence',
      claim_sensitivity: 'medium',
      approved_for_use,
      approved_at: approved_for_use ? '2026-06-05T00:00:00.000Z' : null,
      version: '1.0.0',
    });
    return registry;
  }

  function previewFaqs(url: string, registry = registryWithPlaybook()) {
    return runLocalPreview({
      urls: [url],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registry,
    }).preview_rows[0].faqs;
  }

  it('retrieves approved Review Intelligence and ignores unapproved docs', () => {
    const registry = registryWithPlaybook();
    addReview(registry, 'gourmet plus', 'food_sticking', true);
    addReview(registry, 'gourmet plus', 'water_spots', false);

    expect(registry.findApprovedReviewIntelligence({
      brand: 'WMF',
      category: 'Cookware',
      product_family: 'gourmet plus',
      language: 'en',
    }).map((doc) => doc.content)).toEqual(['food_sticking']);
  });

  it('approved review intelligence influences ranking only', () => {
    const url = 'https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm';
    const baseline = previewFaqs(url, registryWithPlaybook()).map((faq) => faq.question);
    const ranked = previewFaqs(url, addReview()).map((faq) => faq.question);

    expect(baseline[0]).not.toBe('Why does food stick in a stainless-steel pan?');
    expect(ranked[0]).toBe('Why does food stick in a stainless-steel pan?');
    expect(new Set(ranked)).toEqual(new Set(baseline));
  });

  it('unapproved, wrong category, and wrong product_family review intelligence are ignored', () => {
    const url = 'https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm';
    const baseline = previewFaqs(url, registryWithPlaybook()).map((faq) => faq.question);
    const unapproved = previewFaqs(url, addReview(registryWithPlaybook(), 'gourmet plus', 'food_sticking', false)).map((faq) => faq.question);
    const wrongCategory = previewFaqs(url, addReview(registryWithPlaybook(), 'gourmet plus', 'food_sticking', true, 'Coffee')).map((faq) => faq.question);
    const wrongFamilyRegistry = registryWithPlaybook();
    addReview(wrongFamilyRegistry, 'devil', 'food_sticking', true);
    const wrongFamily = previewFaqs(url, wrongFamilyRegistry).map((faq) => faq.question);

    expect(unapproved).toEqual(baseline);
    expect(wrongCategory).toEqual(baseline);
    expect(wrongFamily).toEqual(baseline);
  });

  it('food sticking, water spot, and size selection signals elevate matching opportunities', () => {
    const panUrl = 'https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm';
    const setUrl = 'https://www.wmf.com/de/en/devil-pan-set-3-piece-20-cm-24-cm-28-cm-non-stick';

    expect(previewFaqs(panUrl, addReview(registryWithPlaybook(), 'gourmet plus', 'food_sticking heat_control'))[0].question)
      .toBe('Why does food stick in a stainless-steel pan?');
    expect(previewFaqs(panUrl, addReview(registryWithPlaybook(), 'gourmet plus', 'water_spots rainbow marks'))[0].question)
      .toBe('Why do water spots or rainbow marks appear on stainless steel?');
    expect(previewFaqs(setUrl, addReview(registryWithPlaybook('devil'), 'devil', 'size_selection size selection problem household'))[0].question)
      .toMatch(/sizes|pan size/i);
  });

  it('review intelligence cannot create unsupported compatibility, health, durability, or material claims', () => {
    const text = previewFaqs(
      'https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm',
      addReview(registryWithPlaybook(), 'gourmet plus', [
        'induction_confusion dishwasher_confusion oven',
        'health safety non-toxic lifetime durability scratch-proof',
      ].join('\n')),
    ).map((faq) => `${faq.question} ${faq.answer}`).join('\n');

    expect(text).not.toMatch(/induction hob|dishwasher|oven/i);
    expect(text).not.toMatch(/health|safety|non-toxic|lifetime|scratch-proof/i);
  });

  it('missing PKO evidence still skips FAQ generation without disclaimers', () => {
    const text = previewFaqs(
      'https://www.wmf.com/de/en/devil-fry-pan-28-cm',
      addReview(registryWithPlaybook('devil'), 'devil', 'food_sticking water_spots induction_confusion dishwasher_confusion oven'),
    ).map((faq) => `${faq.question} ${faq.answer}`).join('\n');

    expect(text).not.toMatch(/Why does food stick in a stainless-steel pan|water spots|induction hob|dishwasher|oven/i);
    expect(text).not.toMatch(/URL does not provide|do not present|the answer should|when supported|product context|evidence is missing/i);
  });

  it('keeps FAQ schema unchanged while review intelligence ranks opportunities', () => {
    const preview = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: addReview(),
    });

    expect(preview.preview_rows[0].faqs[0].question).toBe('Why does food stick in a stainless-steel pan?');
    expect(() => faqItemSchema.parse(preview.raw.accumulated_rows[0].faq_items[0])).not.toThrow();
  });
});

describe('Phase 10C.4 claim guidance intake', () => {
  function registryWithPlaybook(product_family = 'gourmet plus') {
    const registry = createKnowledgeBaseRegistry();
    registry.registerDocument({
      title: `${product_family} Category Playbook`,
      content: 'induction compatibility hob dishwasher care oven size selection portion cooking job',
      brand: 'WMF',
      category: 'Cookware',
      product_family,
      market: 'DE',
      language: 'en',
      document_type: 'Category Playbook',
      claim_sensitivity: 'medium',
      approved_for_use: true,
      approved_at: '2026-06-05T00:00:00.000Z',
      version: '1.0.0',
    });
    return registry;
  }

  function addClaimRules(
    registry = createKnowledgeBaseRegistry(),
    content = 'dishwasher-safe replace with dishwasher-suitable; scratch-proof blocked; scratch-resistant requires evidence; PFAS-free requires approved source; oven-safe to 260°C requires explicit PKO evidence',
    approved_for_use = true,
    product_family = 'all',
    market = 'DE',
    language = 'en',
    category = 'Cookware',
  ) {
    registry.registerDocument({
      title: 'Cookware Claim Rules',
      content,
      brand: 'WMF',
      category,
      product_family,
      market,
      language,
      document_type: 'Claim Rules',
      claim_sensitivity: 'high',
      approved_for_use,
      approved_at: approved_for_use ? '2026-06-05T00:00:00.000Z' : null,
      version: '1.0.0',
    });
    return registry;
  }

  it('retrieves approved Claim Rules and ignores unapproved, wrong market, wrong language, and wrong category docs', () => {
    const registry = createKnowledgeBaseRegistry();
    addClaimRules(registry);
    addClaimRules(registry, 'scratch-proof blocked', false);
    addClaimRules(registry, 'wrong market', true, 'all', 'FR');
    addClaimRules(registry, 'wrong language', true, 'all', 'DE', 'fr');
    addClaimRules(registry, 'wrong category', true, 'all', 'DE', 'en', 'Coffee');

    const docs = registry.findApprovedClaimRules({
      brand: 'WMF',
      category: 'Cookware',
      product_family: 'gourmet plus',
      market: 'DE',
      language: 'en',
    });

    expect(docs).toHaveLength(1);
    expect(docs[0].document_type).toBe('Claim Rules');
  });

  it('evaluates dishwasher-safe, dishwasher-suitable, scratch, PFAS, oven-temperature, and positioning examples', () => {
    const claimRules = addClaimRules().findApprovedClaimRules({
      brand: 'WMF',
      category: 'Cookware',
      product_family: 'gourmet plus',
      market: 'DE',
      language: 'en',
    });

    expect(evaluateClaimGuidance('dishwasher-safe', { market: 'DE', language: 'en', claimRules }).status).toBe('review-required');
    expect(evaluateClaimGuidance('dishwasher-suitable', { market: 'DE', language: 'en', claimRules, hasEvidence: true }).status).toBe('approved');
    expect(evaluateClaimGuidance('dishwasher-suitable', { market: 'DE', language: 'fr', claimRules, hasEvidence: true }).status).toBe('review-required');
    expect(evaluateClaimGuidance('scratch-proof', { market: 'DE', language: 'en', claimRules }).status).toBe('blocked');
    expect(evaluateClaimGuidance('scratch-resistant', { market: 'DE', language: 'en', claimRules }).status).toBe('blocked');
    expect(evaluateClaimGuidance('scratch-resistant', { market: 'DE', language: 'en', claimRules, hasEvidence: true }).status).toBe('approved');
    expect(evaluateClaimGuidance('PFAS-free coating', { market: 'DE', language: 'en', claimRules }).status).toBe('blocked');
    expect(evaluateClaimGuidance('oven-safe to 260°C', { market: 'DE', language: 'en', claimRules }).status).toBe('blocked');
    expect(evaluateClaimGuidance('oven-safe to 260°C', { market: 'DE', language: 'en', claimRules, hasEvidence: true }).status).toBe('approved');
    expect(evaluateClaimGuidance('professional quality', { market: 'DE', language: 'en', claimRules }).status).toBe('blocked');
  });

  it('claim guidance suppresses restricted opportunities before preview output', () => {
    const registry = registryWithPlaybook();
    addClaimRules(registry, 'block induction');

    const preview = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm-induction'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registry,
    });
    const text = preview.preview_rows.flatMap((row) => row.faqs).map((faq) => `${faq.question} ${faq.answer}`).join('\n');

    expect(text).not.toMatch(/induction hob/i);
    expect(text).not.toMatch(/URL does not provide|do not present|the answer should|when supported|product context|evidence is missing/i);
  });

  it('claim guidance does not create opportunities or product facts', () => {
    const registry = addClaimRules(createKnowledgeBaseRegistry(), 'PFAS-free requires approved source; induction compatibility approved');
    const preview = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registry,
    });
    const text = preview.preview_rows.flatMap((row) => row.faqs).map((faq) => `${faq.question} ${faq.answer}`).join('\n');

    expect(text).not.toMatch(/PFAS|induction hob|dishwasher|oven/i);
    expect(preview.raw.accumulated_rows[0].faq_items.map((faq) => faq.question).join('\n')).not.toMatch(/PFAS/i);
  });

  it('claim guidance does not alter PKO facts or FAQ schema', () => {
    const registry = registryWithPlaybook();
    addClaimRules(registry);
    const withRules = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm-induction'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registry,
    });
    const withoutRules = runLocalPreview({
      urls: ['https://www.wmf.com/de/en/gourmet-plus-fry-pan-28-cm-induction'],
      run_mode: 'lean',
      cost_ceiling_eur: 50,
      knowledge_base: registryWithPlaybook(),
    });

    expect(withRules.raw.accumulated_rows[0].faq_items.map((faq) => [faq.question, faq.answer])).toEqual(
      withoutRules.raw.accumulated_rows[0].faq_items.map((faq) => [faq.question, faq.answer]),
    );
    expect(() => faqItemSchema.parse(withRules.raw.accumulated_rows[0].faq_items[0])).not.toThrow();
  });
});
