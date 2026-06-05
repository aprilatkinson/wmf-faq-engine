(function attachLocalPreview(root) {
  // TODO Phase 11/12: this browser adapter currently mirrors deterministic job processor logic for a static local demo.
  // TODO Phase 11/12: expose a shared API endpoint or shared build artifact so this adapter does not duplicate processor behavior.
  // TODO: keep packages/agents/src/job-processor as the source of truth; this file must not become the source of truth.
  const languageLabels = {
    de: 'German DE',
    en: 'English EN',
    es: 'Spanish ES',
    nl: 'Dutch NL',
    fr: 'French FR',
  };

  const tabNames = [
    'Job Summary',
    'Product Intake',
    'Generated FAQ — Working',
    'Client Review Needed',
    'Approved FAQ',
    'CMS Export',
    'JSON-LD Schema',
    'Evaluation Results',
    'Warnings & Risk Flags',
    'Cost Log',
  ];

  function normalizeUrls(urls) {
    return Array.from(new Set((urls || []).map((url) => String(url).trim()).filter(Boolean)));
  }

  function slugForUrl(url) {
    try {
      return decodeURIComponent(new URL(url).pathname).toLowerCase();
    } catch {
      return String(url || '').toLowerCase();
    }
  }

  function inferSourceLanguage(url) {
    const match = slugForUrl(url).match(/\/de\/(de|en|fr|es|nl)(?:\/|$)/);
    return match ? match[1] : 'de';
  }

  function normalizeLanguages(targetLanguages, urls) {
    const requested = targetLanguages && targetLanguages.length ? targetLanguages : [inferSourceLanguage((urls || [])[0])];
    return Array.from(new Set(requested));
  }

  function visiblePreviewLanguages(languages) {
    const supported = ['de', 'en', 'es', 'nl', 'fr'];
    const requested = languages && languages.length ? languages : ['en'];
    return supported.filter((language) => requested.includes(language));
  }

  function skippedLocalizationWarnings(selectedLanguages, generatedLanguages) {
    const skipped = selectedLanguages.filter((language) => !generatedLanguages.includes(language));
    return skipped.length ? [`Selected languages skipped because deterministic localization is not implemented: ${skipped.join(', ')}`] : [];
  }

  function maxFaqCount(runMode, requested) {
    const cap = runMode === 'premium-p1' ? 20 : 12;
    return Math.max(1, Math.min(cap, Number(requested || 12)));
  }

  function estimateLocalPreview(input) {
    const urls = normalizeUrls(input.urls);
    const runMode = input.run_mode || 'lean';
    const languages = normalizeLanguages(input.target_languages, urls);
    const maxFaq = maxFaqCount(runMode, input.max_faq_count);
    const baseTokens = runMode === 'premium-p1' ? 10000 : runMode === 'standard' ? 6000 : 3000;
    const nonDeLanguages = languages.filter((language) => language !== 'de').length;
    const expectedFailureRate = runMode === 'premium-p1' ? 0.08 : runMode === 'standard' ? 0.05 : 0.03;
    const expectedFailingItems = Math.ceil(urls.length * maxFaq * expectedFailureRate);
    const localizationTokens = urls.length * nonDeLanguages * 1200;
    const rewriteTokens = expectedFailingItems * 2000;
    const estimatedTokens = urls.length * baseTokens + localizationTokens + rewriteTokens;
    const providerCost = Number(((estimatedTokens / 1000) * 0.01).toFixed(4));
    const marginRate = 0.2;
    const clientCost = Number((providerCost * (1 + marginRate)).toFixed(4));
    const costCeiling = Number(input.cost_ceiling_eur ?? 50);

    return {
      run_mode: runMode,
      url_count: urls.length,
      selected_language_count: languages.length,
      estimated_tokens: estimatedTokens,
      provider_cost_estimate: providerCost,
      margin_rate: marginRate,
      client_cost_estimate: clientCost,
      cost_ceiling_eur: costCeiling,
      requires_confirmation: clientCost > costCeiling,
      languages,
      max_faq_count: maxFaq,
    };
  }

  function workbookXml(tabs) {
    const worksheets = tabs
      .map((tab) => `<Worksheet ss:Name="${tab.name}"><Table><Row><Cell><Data ss:Type="String">Rows</Data></Cell><Cell><Data ss:Type="String">${tab.rowCount}</Data></Cell></Row></Table></Worksheet>`)
      .join('');
    return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheets}</Workbook>`;
  }

  function carouselIndex(currentIndex, itemCount, direction) {
    if (!itemCount) return 0;
    const nextIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;
    return Math.max(0, Math.min(itemCount - 1, nextIndex));
  }

  function familyForSlug(slug) {
    const spaced = slug.replace(/[-_/]+/g, ' ');
    const families = [
      'ultimate profi resist',
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
      'gourmet plus',
      'click serve',
      'compact cuisine',
      'profi',
      'devil',
      'durado',
      'ultimate',
    ];
    return families.find((family) => spaced.includes(family)) || 'WMF cookware';
  }

  function productTypeForSlug(slug) {
    if (/glasdeckel|glass[-_]?lid|[-_/]lid|deckel/.test(slug)) return 'accessory';
    if (/wok/.test(slug)) return 'wok';
    if (/grillpfanne|grill[-_]?pan/.test(slug)) return 'grill pan';
    if (/creperie|crepe/.test(slug)) return 'crepe pan';
    if (/bratpfannen[-_]?set|pan[-_]?set|pfannen[-_]?set/.test(slug)) return 'pan set';
    if (/stielpfanne|fry[-_]?pan|frying[-_]?pan|bratpfanne/.test(slug)) return 'fry pan';
    return 'cookware';
  }

  function factsForUrl(url) {
    const slug = slugForUrl(url);
    const sizes = Array.from(new Set(Array.from(slug.matchAll(/(?:^|[-_/])(\d{2})(?:[-_]?cm|[-_/])/g)).map((match) => `${match[1]} cm`)))
      .filter((size) => ['20 cm', '24 cm', '28 cm', '32 cm'].includes(size))
      .sort((left, right) => Number(left.split(' ')[0]) - Number(right.split(' ')[0]));
    const pieces = slug.match(/(?:^|[-_/])([23])[-_]?(?:teilig|teil|piece|pieces)(?:[-_/]|$)/)?.[1];
    const family = familyForSlug(slug);
    const productType = productTypeForSlug(slug);

    return {
      slug,
      family,
      productType,
      sizes,
      pieces: pieces ? `${pieces}-piece` : '',
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

  function productName(facts) {
    const size = facts.sizes.length === 1 ? `${facts.sizes[0]} ` : '';
    const pieces = facts.pieces ? `${facts.pieces} ` : '';
    return `WMF ${facts.family} ${pieces}${size}${facts.productType}`.replace(/\s+/g, ' ').trim();
  }

  function sizeUseAnswer(facts) {
    if (!facts.sizes.length) return `${productName(facts)} is best judged by its product type and listed diameter. Choose the size that fits your portions and hob zone.`;
    if (facts.productType === 'pan set') {
      return `The set includes ${facts.sizes.join(', ')}. Smaller pans suit compact portions, while larger pans give more space for family portions or foods that need room in the pan.`;
    }
    return `A ${facts.sizes[0]} frying pan is well suited to proteins, vegetables, sautéing, browning, and searing. For many everyday meals, it gives enough surface for 2–3 people while still fitting comfortably on a typical hob zone.`;
  }

  function sizeQuestion(facts) {
    if (facts.productType === 'pan set') return 'Which pan size should I use for which cooking job?';
    return facts.sizes[0] ? `Is ${facts.sizes[0]} the right pan size for my cooking?` : 'Which pan size should I choose?';
  }

  function stainlessCareAnswer(facts) {
    if (facts.hasCromargan) {
      return 'Clean the pan with warm water, mild detergent, and a soft sponge, then dry it thoroughly. Cromargan® stainless steel benefits from careful drying because minerals in water can leave visible marks.';
    }
    return 'Clean the pan with warm water, mild detergent, and a soft sponge, then dry it thoroughly before storing.';
  }

  function waterMarksAnswer() {
    return 'Water spots are usually mineral deposits left behind as water dries. Rainbow marks can appear after heat exposure. They can often be reduced with gentle stainless-steel care and thorough drying after washing.';
  }

  function steakOrEggAnswer(facts) {
    if (facts.hasCoating) {
      const coating = facts.hasCeramic ? 'ceramic-coated' : 'non-stick';
      return `This ${coating} pan is the more natural fit for eggs, pancakes, and gentle frying because delicate foods can release more easily. For steak or intense browning, choose a pan intended for higher-heat searing.`;
    }
    if (facts.hasCromargan) {
      return 'This stainless-steel pan is better for browning and searing steak, vegetables, and proteins. Eggs are possible, but they need more temperature control and enough fat. For low-fat delicate cooking, non-stick is easier.';
    }
    return 'Use this pan according to its listed surface. Eggs are usually easier in a coated pan, while steak benefits from cookware designed for stronger browning.';
  }

  function stickingAnswer() {
    return 'Food often sticks when the pan is not preheated enough, the heat is too high or too low, or the food is moved before it releases. Preheat the pan, add oil or fat after heating as appropriate, and let proteins form a crust before turning. For eggs, fish, or pancakes with little fat, non-stick can be easier.';
  }

  function inductionAnswer(facts) {
    if (facts.hasTransTherm) return `Yes. ${productName(facts)} is suitable for induction. The TransTherm® base is the supporting feature, and the pan size should still match the cooking zone.`;
    if (facts.hasInduction) return `Yes. ${productName(facts)} is listed for induction. Match the pan size to the cooking zone for best everyday use.`;
    return '';
  }

  function dishwasherAnswer(facts) {
    if (!facts.hasDishwasher) return '';
    if (facts.hasCoating) {
      const coating = facts.hasCeramic ? 'ceramic coating' : 'non-stick coating';
      return `Yes, this pan is listed with dishwasher evidence. For the ${coating}, gentle hand washing is still the better everyday care choice because it helps protect release performance and the surface over time.`;
    }
    return 'Yes, this pan is listed with dishwasher evidence. Hand washing and careful drying are still useful for stainless steel because they help reduce water spots and keep the surface looking cleaner.';
  }

  function ovenAnswer(facts) {
    if (!facts.hasOven) return '';
    return `Yes, this pan has oven-use evidence. Check the stated temperature limit before use, because oven suitability can depend on the handle, coating, and lid or accessory parts.`;
  }

  function accessoryAnswer(facts) {
    const included = [
      facts.hasLid ? 'glass lid' : '',
      ...facts.accessories,
    ].filter(Boolean);
    return included.length
      ? `${productName(facts)} includes ${included.join(', ')}. Treat extra lids, turners, spatulas, or protectors as separate unless they are listed.`
      : '';
  }

  function cleaningAnswer(facts) {
    if (facts.hasCoating) {
      const coating = facts.hasCeramic ? 'ceramic coating' : 'non-stick coating';
      return `Clean the pan gently after use and avoid metal utensils on the ${coating}. Moderate heat and soft cleaning tools help protect the surface during everyday frying.`;
    }
    return stainlessCareAnswer(facts);
  }

  function familyComparisonAnswer(facts) {
    if (!facts.family || facts.family === 'WMF cookware') return '';
    const material = facts.hasCromargan ? 'stainless-steel construction' : facts.hasCeramic ? 'ceramic coating' : facts.hasCoating ? 'non-stick coating' : facts.productType;
    return `${productName(facts)} should be compared by product type, surface, size, and compatible hob or oven evidence. Here, the clearest differentiators are ${material}${facts.sizes.length ? ` and ${facts.sizes.join(', ')}` : ''}.`;
  }

  function addCompatibilityTemplates(templates, facts, productLabel) {
    if (facts.hasInduction || facts.hasTransTherm) {
      templates.push({
        question: `Will this ${productLabel} work on an induction hob?`,
        answer: inductionAnswer(facts),
        purpose_tags: ['expectation'],
      });
    }
    if (facts.hasDishwasher) {
      templates.push({
        question: `Can I put this ${productLabel} in the dishwasher?`,
        answer: dishwasherAnswer(facts),
        purpose_tags: ['support-reduction'],
      });
    }
    if (facts.hasOven) {
      templates.push({
        question: `Can this ${productLabel} go in the oven?`,
        answer: ovenAnswer(facts),
        purpose_tags: ['expectation'],
      });
    }
  }

  function addFamilyComparisonTemplate(templates, facts) {
    const answer = familyComparisonAnswer(facts);
    if (!answer) return;
    templates.push({
      question: 'How is this pan different from other WMF frying pans?',
      answer,
      purpose_tags: ['comparison'],
    });
  }

  function nonStickAnswer(facts) {
    const coating = facts.hasCeramic ? 'ceramic coating' : 'non-stick coating';
    return `This ${coating} is a good fit for eggs, fish, pancakes, and delicate foods because easier release matters more than hard searing. Use moderate heat and avoid overheating so the coating keeps its release performance longer.`;
  }

  function nonStickCareAnswer(facts) {
    const coating = facts.hasCeramic ? 'ceramic coating' : 'non-stick coating';
    return `Use moderate heat, soft cleaning tools, and non-metal utensils on the ${coating}. That protects the cooking surface and helps delicate foods release more reliably over time.`;
  }

  function wokAnswer() {
    return 'A wok is best for stir-frying, tossing vegetables or noodles, and high-sided cooking where food needs room to move. The sloped shape helps you keep ingredients moving quickly over heat.';
  }

  function grillPanAnswer() {
    return 'A grill pan is designed for searing and indoor grilling. Raised ribs can create grill-style marks and let some juices sit below the food, but it still needs preheating and enough contact for browning.';
  }

  function crepePanAnswer() {
    return 'A crepe pan is best for thin batter, pancakes, and foods that benefit from a low rim. The shallow shape makes spreading batter and sliding a turner under the edge easier.';
  }

  function makeCandidate(candidate) {
    return {
      priority: 50,
      required_product_types: [],
      required_evidence: [],
      claim_types: [],
      ...candidate,
    };
  }

  function buildAllCandidates(facts) {
    const productLabel = facts.productType === 'pan set' ? 'pan set' : facts.productType === 'wok' ? 'wok' : facts.productType === 'grill pan' ? 'grill pan' : facts.productType === 'crepe pan' ? 'crepe pan' : facts.productType === 'fry pan' ? 'pan' : 'product';
    return [
      makeCandidate({
        candidate_id: 'induction_compatibility',
        question: `Will this ${productLabel} work on an induction hob?`,
        answer: inductionAnswer(facts),
        purpose_tags: ['expectation'],
        required_evidence: ['induction'],
        claim_types: ['compatibility'],
        priority: 96,
      }),
      makeCandidate({
        candidate_id: 'dishwasher_care',
        question: `Can I put this ${productLabel} in the dishwasher?`,
        answer: dishwasherAnswer(facts),
        purpose_tags: ['support-reduction'],
        required_evidence: ['dishwasher'],
        claim_types: ['care', 'compatibility'],
        priority: 90,
      }),
      makeCandidate({
        candidate_id: 'oven_compatibility',
        question: `Can this ${productLabel} go in the oven?`,
        answer: ovenAnswer(facts),
        purpose_tags: ['expectation'],
        required_evidence: ['oven'],
        claim_types: ['compatibility'],
        priority: 88,
      }),
      makeCandidate({
        candidate_id: 'pan_set_contents',
        question: 'What sizes are included in this pan set?',
        answer: `${productName(facts)} includes ${facts.sizes.join(', ')}.`,
        purpose_tags: ['buyer-hesitation'],
        required_product_types: ['pan set'],
        required_evidence: ['sizes'],
        priority: 98,
      }),
      makeCandidate({
        candidate_id: 'size_guidance',
        question: sizeQuestion(facts),
        answer: sizeUseAnswer(facts),
        purpose_tags: ['benefit-selling'],
        required_evidence: ['sizes'],
        priority: 86,
      }),
      makeCandidate({
        candidate_id: 'pan_set_storage',
        question: 'How does a pan set help with storage and versatility?',
        answer: 'A pan set gives you multiple sizes for different portions without buying each pan separately. Use the smaller sizes for compact portions and the larger sizes when food needs more surface area for browning or sautéing.',
        purpose_tags: ['benefit-selling'],
        required_product_types: ['pan set'],
        required_evidence: ['sizes'],
        priority: 72,
      }),
      makeCandidate({
        candidate_id: 'nonstick_best_use',
        question: facts.hasCeramic ? 'What is a ceramic frying pan best for?' : 'What is a non-stick frying pan best for?',
        answer: nonStickAnswer(facts),
        purpose_tags: ['buyer-hesitation'],
        required_product_types: ['fry pan'],
        required_evidence: ['coating'],
        priority: 84,
      }),
      makeCandidate({
        candidate_id: 'nonstick_care',
        question: facts.hasCeramic ? 'How should I care for a ceramic frying pan?' : 'How should I care for a non-stick frying pan?',
        answer: nonStickCareAnswer(facts),
        purpose_tags: ['support-reduction'],
        required_product_types: ['fry pan'],
        required_evidence: ['coating'],
        priority: 68,
      }),
      makeCandidate({
        candidate_id: 'stainless_searing',
        question: 'Is this pan a good choice for steak and high-heat cooking?',
        answer: 'Yes. A stainless-steel frying pan is suitable for browning and searing because it supports strong contact between food and the pan surface. Preheat carefully and use enough oil or fat for reliable release.',
        purpose_tags: ['buyer-hesitation'],
        required_product_types: ['fry pan'],
        required_evidence: ['stainless_steel'],
        priority: 82,
      }),
      makeCandidate({
        candidate_id: 'stainless_heat_control',
        question: 'How do I control heat in a stainless-steel pan?',
        answer: 'Start by preheating the pan, then adjust the heat before adding food. Stainless steel rewards steady heat control: too little heat can prevent browning, while too much heat can make food stick or scorch.',
        purpose_tags: ['support-reduction'],
        required_product_types: ['fry pan'],
        required_evidence: ['stainless_steel'],
        priority: 80,
      }),
      makeCandidate({
        candidate_id: 'stainless_food_sticking',
        question: 'Why does food stick in a stainless-steel pan?',
        answer: stickingAnswer(),
        purpose_tags: ['buyer-hesitation'],
        required_product_types: ['fry pan'],
        required_evidence: ['stainless_steel'],
        priority: 78,
      }),
      makeCandidate({
        candidate_id: 'stainless_care',
        question: 'How should I clean and care for this stainless-steel pan?',
        answer: stainlessCareAnswer(facts),
        purpose_tags: ['support-reduction'],
        required_product_types: ['fry pan'],
        required_evidence: ['stainless_steel'],
        priority: 76,
      }),
      makeCandidate({
        candidate_id: 'stainless_water_marks',
        question: 'Why do water spots or rainbow marks appear on stainless steel?',
        answer: waterMarksAnswer(),
        purpose_tags: ['support-reduction'],
        required_product_types: ['fry pan'],
        required_evidence: ['stainless_steel'],
        priority: 74,
      }),
      makeCandidate({
        candidate_id: 'steak_or_eggs',
        question: 'Is this pan better for steak or eggs?',
        answer: steakOrEggAnswer(facts),
        purpose_tags: ['buyer-hesitation'],
        required_product_types: ['fry pan'],
        required_evidence: ['fry_pan'],
        priority: 70,
      }),
      makeCandidate({
        candidate_id: 'family_comparison',
        question: 'How is this pan different from other WMF frying pans?',
        answer: familyComparisonAnswer(facts),
        purpose_tags: ['comparison'],
        required_product_types: ['fry pan'],
        required_evidence: ['family'],
        priority: 66,
      }),
      makeCandidate({
        candidate_id: 'wok_best_use',
        question: 'What is a wok best used for?',
        answer: wokAnswer(),
        purpose_tags: ['benefit-selling'],
        required_product_types: ['wok'],
        required_evidence: ['product_type'],
        priority: 92,
      }),
      makeCandidate({
        candidate_id: 'grill_pan_best_use',
        question: 'What is a grill pan best used for?',
        answer: grillPanAnswer(),
        purpose_tags: ['benefit-selling'],
        required_product_types: ['grill pan'],
        required_evidence: ['product_type'],
        priority: 92,
      }),
      makeCandidate({
        candidate_id: 'crepe_pan_best_use',
        question: 'What is a crepe pan best used for?',
        answer: crepePanAnswer(),
        purpose_tags: ['benefit-selling'],
        required_product_types: ['crepe pan'],
        required_evidence: ['product_type'],
        priority: 92,
      }),
      makeCandidate({
        candidate_id: 'product_type_clarity',
        question: `What type of product is this ${facts.productType}?`,
        answer: `${productName(facts)} is identified as ${facts.productType}. Use that product type to judge whether it fits the cooking job you have in mind.`,
        purpose_tags: ['expectation'],
        required_evidence: ['product_type'],
        priority: 40,
      }),
      makeCandidate({
        candidate_id: 'generic_cleaning',
        question: facts.productType === 'fry pan' ? 'How should I clean this pan?' : 'How should I clean this product?',
        answer: cleaningAnswer(facts),
        purpose_tags: ['support-reduction'],
        required_evidence: ['generic_cleaning'],
        priority: 38,
      }),
      makeCandidate({
        candidate_id: 'glass_lid_included',
        question: 'Does this product include a glass lid?',
        answer: accessoryAnswer(facts),
        purpose_tags: ['buyer-hesitation'],
        required_evidence: ['lid'],
        priority: 64,
      }),
      makeCandidate({
        candidate_id: 'accessory_included',
        question: 'Which accessory is included?',
        answer: accessoryAnswer(facts),
        purpose_tags: ['buyer-hesitation'],
        required_evidence: ['accessory'],
        priority: 62,
      }),
      makeCandidate({
        candidate_id: 'coolplus_handle_warmth',
        question: 'Can the Cool+ handles still become warm during cooking?',
        answer: 'Cool+ handle technology can reduce heat transfer at the handles during normal stovetop cooking. Handles can still become warm depending on heat level, cooking time, and flame position, so use pot holders when needed.',
        purpose_tags: ['expectation'],
        required_evidence: ['coolplus'],
        priority: 60,
      }),
    ];
  }

  function hasEvidence(facts, evidenceType) {
    const checks = {
      induction: facts.hasInduction || facts.hasTransTherm,
      dishwasher: facts.hasDishwasher,
      oven: facts.hasOven,
      sizes: facts.sizes.length > 0,
      coating: facts.hasCoating,
      stainless_steel: facts.hasCromargan && !facts.hasCoating,
      fry_pan: facts.productType === 'fry pan',
      family: Boolean(facts.family && facts.family !== 'WMF cookware'),
      product_type: Boolean(facts.productType),
      generic_cleaning: Boolean(facts.productType) && !facts.hasCromargan && !facts.hasCoating,
      lid: facts.hasLid,
      accessory: facts.accessories.length > 0,
      coolplus: facts.hasCoolPlus,
    };
    return Boolean(checks[evidenceType]);
  }

  function skippedDiagnostic(candidate, skipReason, detailKey, detailValue) {
    return {
      candidate_id: candidate.candidate_id,
      question_draft: candidate.question,
      skip_reason: skipReason,
      [detailKey]: detailValue,
    };
  }

  function applyEvidenceGate(candidates, facts, diagnostics) {
    return candidates.filter((candidate) => {
      const wrongType = candidate.required_product_types.length > 0 && !candidate.required_product_types.includes(facts.productType);
      if (wrongType) {
        diagnostics.push(skippedDiagnostic(candidate, 'missing_evidence', 'missing_evidence_type', 'product_type'));
        return false;
      }
      const missingEvidence = candidate.required_evidence.find((evidenceType) => !hasEvidence(facts, evidenceType));
      if (missingEvidence) {
        diagnostics.push(skippedDiagnostic(candidate, 'missing_evidence', 'missing_evidence_type', missingEvidence));
        return false;
      }
      if (!candidate.answer || !candidate.answer.trim()) {
        diagnostics.push(skippedDiagnostic(candidate, 'missing_evidence', 'missing_evidence_type', 'answerable_fact'));
        return false;
      }
      return true;
    });
  }

  function applyClaimGuidance(candidates, diagnostics) {
    return candidates.filter((candidate) => {
      const text = `${candidate.question} ${candidate.answer}`;
      if (/scratch-proof|pfas|pfoa|ptfe-free|professional quality|oven-safe to \d/i.test(text)) {
        diagnostics.push(skippedDiagnostic(candidate, 'blocked_claim', 'blocked_claim_type', 'restricted_claim'));
        return false;
      }
      return true;
    });
  }

  function dedupeCandidates(candidates, diagnostics) {
    const seen = new Set();
    return candidates.filter((candidate) => {
      const key = candidate.question.toLowerCase().replace(/\d+ cm/g, '{size}');
      if (seen.has(key)) {
        diagnostics.push(skippedDiagnostic(candidate, 'duplicate_candidate', 'missing_evidence_type', 'duplicate_question'));
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function rankCandidates(candidates) {
    return [...candidates].sort((left, right) => right.priority - left.priority || left.candidate_id.localeCompare(right.candidate_id));
  }

  function buildCandidatePipeline(facts) {
    const skipped = [];
    const allCandidates = buildAllCandidates(facts);
    const evidencePassed = applyEvidenceGate(allCandidates, facts, skipped);
    const claimPassed = applyClaimGuidance(evidencePassed, skipped);
    const deduped = dedupeCandidates(claimPassed, skipped);
    const ranked = rankCandidates(deduped);
    return { candidates: ranked, skipped };
  }

  function questionTemplatesForFacts(facts) {
    return buildCandidatePipeline(facts).candidates.map(({ candidate_id, question, answer, purpose_tags, priority }) => ({
      candidate_id,
      question,
      answer,
      purpose_tags,
      priority,
    }));
  }

  function languageStatus(language) {
    return language === 'de' || language === 'en' ? 'draft' : 'needs-review';
  }

  function localizedSizeList(facts) {
    return facts.sizes.join(', ');
  }

  function localizedProductName(facts, language) {
    if (language === 'de') return productName(facts).replace('fry pan', 'Bratpfanne').replace('pan set', 'Pfannenset');
    if (language === 'es') return productName(facts).replace('fry pan', 'sartén').replace('pan set', 'set de sartenes');
    if (language === 'nl') return productName(facts).replace('fry pan', 'koekenpan').replace('pan set', 'pannenset');
    if (language === 'fr') return productName(facts).replace('fry pan', 'poêle').replace('pan set', 'set de poêles');
    return productName(facts);
  }

  function localizedTemplate(template, language, facts) {
    if (language === 'en') return template;
    const q = template.question;
    const name = localizedProductName(facts, language);
    const sizes = localizedSizeList(facts);

    const copy = {
      de: {
        sizePan: [`Ist ${facts.sizes[0]} die richtige Pfannengröße für mein Kochen?`, `Eine ${facts.sizes[0]} Bratpfanne eignet sich gut für Proteine, Gemüse, Sautieren, Bräunen und scharfes Anbraten. Für viele Alltagsgerichte bietet sie genug Fläche für 2-3 Personen und passt trotzdem gut auf eine typische Kochzone.`],
        setSizes: ['Welche Größen sind in diesem Pfannenset enthalten?', `${name} enthält ${sizes}.`],
        setJobs: ['Welche Pfannengröße sollte ich für welchen Kochjob verwenden?', `Das Set enthält ${sizes}. Kleinere Pfannen passen zu kompakten Portionen, größere Pfannen bieten mehr Fläche, wenn Lebensmittel Platz zum Bräunen oder Sautieren brauchen.`],
        storage: ['Wie hilft ein Pfannenset bei Aufbewahrung und Vielseitigkeit?', 'Ein Pfannenset bietet mehrere Größen für unterschiedliche Portionen, ohne jede Pfanne einzeln zu kaufen. Kleinere Größen passen zu kompakten Portionen, größere Größen zu Gerichten mit mehr Bratfläche.'],
        induction: [`Funktioniert diese ${facts.productType === 'pan set' ? 'Pfannenset' : 'Pfanne'} auf einem Induktionskochfeld?`, `Ja. ${name} ist für Induktion angegeben. Die Pfannengröße sollte trotzdem zur Kochzone passen.`],
        dishwasher: [`Kann ich diese ${facts.productType === 'pan set' ? 'Pfannenset' : 'Pfanne'} in die Spülmaschine geben?`, 'Ja, dafür gibt es Spülmaschinen-Eignung. Schonendes Spülen von Hand und sorgfältiges Abtrocknen bleiben im Alltag sinnvoll, damit die Oberfläche gepflegt aussieht.'],
        oven: [`Kann diese ${facts.productType === 'pan set' ? 'Pfannenset' : 'Pfanne'} in den Backofen?`, 'Ja, dafür gibt es Backofen-Eignung. Prüfen Sie vor der Nutzung die angegebene Temperaturgrenze, weil Griffe, Beschichtung, Deckel oder Zubehörteile relevant sein können.'],
        nonstickBest: ['Wofür ist eine Antihaftpfanne am besten geeignet?', 'Diese Antihaftbeschichtung passt gut zu Eiern, Fisch, Pfannkuchen und empfindlichen Lebensmitteln, bei denen leichtes Lösen wichtiger ist als starkes Anbraten. Nutzen Sie moderate Hitze und vermeiden Sie Überhitzen.'],
        nonstickCare: ['Wie pflege ich eine Antihaftpfanne?', 'Nutzen Sie moderate Hitze, weiche Reinigungshelfer und kein Metallbesteck auf der Beschichtung. So bleibt die Oberfläche länger gepflegt und empfindliche Speisen lösen sich leichter.'],
        ceramicBest: ['Wofür ist eine Keramikpfanne am besten geeignet?', 'Diese Keramikbeschichtung passt gut zu sanftem Braten, Eiern, Fisch und empfindlichen Lebensmitteln. Moderate Hitze unterstützt die Löseeigenschaften und schützt die Oberfläche.'],
        ceramicCare: ['Wie pflege ich eine Keramikpfanne?', 'Nutzen Sie moderate Hitze, weiche Reinigungshelfer und kein Metallbesteck auf der Keramikbeschichtung. Das schützt die Oberfläche und unterstützt die Löseeigenschaften.'],
        steak: ['Ist diese Pfanne gut für Steak und hohe Hitze?', 'Ja. Eine Edelstahlpfanne eignet sich zum Bräunen und scharfen Anbraten, weil sie starken Kontakt zwischen Lebensmittel und Pfannenfläche unterstützt. Heizen Sie sorgfältig vor und nutzen Sie genug Öl oder Fett.'],
        stainlessCare: ['Wie reinige und pflege ich diese Edelstahlpfanne?', 'Reinigen Sie die Pfanne mit warmem Wasser, mildem Spülmittel und einem weichen Schwamm und trocknen Sie sie gründlich ab. Cromargan® Edelstahl profitiert vom Abtrocknen, weil Mineralien im Wasser sichtbare Spuren hinterlassen können.'],
        marks: ['Warum entstehen Wasserflecken oder Regenbogenverfärbungen auf Edelstahl?', 'Wasserflecken sind meist Mineralrückstände, die beim Trocknen von Wasser zurückbleiben. Regenbogenverfärbungen können durch Hitze entstehen und lassen sich oft mit sanfter Edelstahlpflege und gründlichem Abtrocknen reduzieren.'],
        sticking: ['Warum haften Speisen in einer Edelstahlpfanne an?', 'Speisen haften oft, wenn die Pfanne nicht ausreichend vorgeheizt ist, die Hitze nicht passt oder das Gargut zu früh bewegt wird. Heizen Sie vor, geben Sie Öl oder Fett passend nach dem Erhitzen hinzu und lassen Sie Proteine erst eine Kruste bilden.'],
        heatControl: ['Wie kontrolliere ich die Hitze in einer Edelstahlpfanne?', 'Heizen Sie die Pfanne zuerst vor und passen Sie die Hitze dann an, bevor Sie Lebensmittel hineingeben. Edelstahl belohnt gleichmäßige Temperaturkontrolle: zu wenig Hitze verhindert Bräunen, zu viel Hitze kann Anhaften oder Anbrennen fördern.'],
        steakEggs: ['Ist diese Pfanne besser für Steak oder Eier?', 'Diese Edelstahlpfanne passt besser zum Bräunen und Anbraten von Steak, Gemüse und Proteinen. Eier sind möglich, brauchen aber mehr Temperaturkontrolle und genug Fett. Für fettarmes empfindliches Braten ist Antihaft einfacher.'],
        comparison: ['Wie unterscheidet sich diese Pfanne von anderen WMF Bratpfannen?', `${name} sollte nach Produkttyp, Oberfläche, Größe und belegter Kompatibilität verglichen werden. Die klarsten Unterschiede sind ${facts.hasCromargan ? 'Edelstahlkonstruktion' : facts.hasCeramic ? 'Keramikbeschichtung' : facts.hasCoating ? 'Antihaftbeschichtung' : facts.productType}${facts.sizes.length ? ` und ${sizes}` : ''}.`],
        wok: ['Wofür ist ein Wok am besten geeignet?', 'Ein Wok eignet sich zum Pfannenrühren, Schwenken von Gemüse oder Nudeln und Kochen mit hohem Rand. Die Form hilft, Zutaten schnell in Bewegung zu halten.'],
        grill: ['Wofür ist eine Grillpfanne am besten geeignet?', 'Eine Grillpfanne ist für scharfes Anbraten und Indoor-Grillen gedacht. Die Rippen können grillähnliche Streifen erzeugen, brauchen aber Vorheizen und guten Kontakt zum Bräunen.'],
        crepe: ['Wofür ist eine Crêpe-Pfanne am besten geeignet?', 'Eine Crêpe-Pfanne eignet sich für dünnen Teig, Pfannkuchen und Speisen, die von einem niedrigen Rand profitieren. Die flache Form erleichtert Verteilen und Wenden.'],
        productType: [`Was für ein Produkt ist diese ${facts.productType}?`, `${name} ist als ${facts.productType} erkennbar. Nutzen Sie den Produkttyp, um zu prüfen, ob er zu Ihrem Kochjob passt.`],
        cleanProduct: ['Wie reinige ich dieses Produkt?', cleaningAnswer(facts).replace('Clean the pan', 'Reinigen Sie die Pfanne').replace('Clean the product', 'Reinigen Sie das Produkt')],
        lid: ['Ist ein Glasdeckel enthalten?', accessoryAnswer(facts).replace('includes', 'enthält')],
        accessory: ['Welches Zubehör ist enthalten?', accessoryAnswer(facts).replace('includes', 'enthält')],
        coolplus: ['Können die Cool+ Griffe beim Kochen warm werden?', 'Cool+ Grifftechnologie kann die Wärmeübertragung an den Griffen beim normalen Kochen auf dem Herd reduzieren. Die Griffe können je nach Hitze, Kochdauer und Position trotzdem warm werden.'],
      },
      es: {
        sizePan: [`¿Una sartén de ${facts.sizes[0]} es el tamaño adecuado para cocinar?`, `Una sartén de ${facts.sizes[0]} va bien para proteínas, verduras, saltear, dorar y sellar. Para muchas comidas diarias ofrece superficie suficiente para 2-3 personas y encaja bien en una zona de cocción habitual.`],
        setSizes: ['¿Qué tamaños incluye este set de sartenes?', `${name} incluye ${sizes}.`],
        setJobs: ['¿Qué tamaño de sartén debo usar para cada preparación?', `El set incluye ${sizes}. Las sartenes pequeñas sirven para porciones compactas y las grandes dan más superficie para dorar o saltear.`],
        storage: ['¿Cómo ayuda un set de sartenes con versatilidad y almacenamiento?', 'Un set de sartenes ofrece varios tamaños para distintas porciones sin comprar cada pieza por separado.'],
        induction: [`¿Funciona esta ${facts.productType === 'pan set' ? 'set de sartenes' : 'sartén'} en una placa de inducción?`, `Sí. ${name} está indicada para inducción. Aun así, el tamaño debe coincidir con la zona de cocción.`],
        dishwasher: null,
        oven: [`¿Puede ir esta ${facts.productType === 'pan set' ? 'set de sartenes' : 'sartén'} al horno?`, 'Sí, hay evidencia de uso en horno. Comprueba el límite de temperatura indicado porque el mango, el recubrimiento, la tapa o los accesorios pueden influir.'],
        nonstickBest: ['¿Para qué alimentos va mejor una sartén antiadherente?', 'El recubrimiento antiadherente va bien para huevos, pescado, tortitas y alimentos delicados, donde soltar fácilmente importa más que un sellado intenso. Usa calor moderado y evita sobrecalentar.'],
        nonstickCare: ['¿Cómo debo cuidar una sartén antiadherente?', 'Usa calor moderado, utensilios no metálicos y limpieza suave sobre el recubrimiento. Así la superficie conserva mejor su rendimiento.'],
        ceramicBest: ['¿Para qué va mejor una sartén cerámica?', 'El recubrimiento cerámico va bien para cocción suave, huevos, pescado y alimentos delicados. El calor moderado ayuda al desmolde y cuida la superficie.'],
        ceramicCare: ['¿Cómo debo cuidar una sartén cerámica?', 'Usa calor moderado, utensilios no metálicos y limpieza suave sobre el recubrimiento cerámico.'],
        steak: ['¿Esta sartén es adecuada para bistec y calor alto?', 'Sí. Una sartén de acero inoxidable es adecuada para dorar y sellar porque favorece un contacto fuerte entre el alimento y la superficie. Precalienta con cuidado y usa suficiente aceite o grasa.'],
        stainlessCare: ['¿Cómo limpio y cuido esta sartén de acero inoxidable?', 'Límpiala con agua tibia, detergente suave y una esponja blanda, y sécala bien. El acero inoxidable Cromargan® se beneficia del secado porque los minerales del agua pueden dejar marcas visibles.'],
        marks: ['¿Por qué aparecen manchas de agua o marcas arcoíris en el acero inoxidable?', 'Las manchas de agua suelen ser minerales que quedan al secarse el agua. Las marcas arcoíris pueden aparecer por calor y suelen reducirse con cuidado suave para acero inoxidable y buen secado.'],
        sticking: ['¿Por qué se pega la comida en una sartén de acero inoxidable?', 'La comida suele pegarse si la sartén no está bien precalentada, si el calor no es adecuado o si se mueve antes de que se suelte. Precalienta, añade aceite o grasa cuando corresponda y deja que las proteínas formen costra antes de girarlas.'],
        heatControl: ['¿Cómo controlo el calor en una sartén de acero inoxidable?', 'Primero precalienta la sartén y ajusta el calor antes de añadir los alimentos. El acero inoxidable funciona mejor con control de temperatura estable: poco calor dificulta el dorado y demasiado calor puede hacer que la comida se pegue o se queme.'],
        steakEggs: ['¿Esta sartén es mejor para bistec o para huevos?', 'Esta sartén de acero inoxidable es mejor para dorar y sellar bistec, verduras y proteínas. Los huevos son posibles, pero requieren más control de temperatura y suficiente grasa. Para cocción delicada con poca grasa, una antiadherente es más fácil.'],
        comparison: ['¿En qué se diferencia esta sartén de otras sartenes WMF?', `${name} debe compararse por tipo de producto, superficie, tamaño y compatibilidad respaldada. Sus diferencias más claras son ${facts.hasCromargan ? 'construcción de acero inoxidable' : facts.hasCeramic ? 'recubrimiento cerámico' : facts.hasCoating ? 'recubrimiento antiadherente' : facts.productType}${facts.sizes.length ? ` y ${sizes}` : ''}.`],
        wok: ['¿Para qué se usa mejor un wok?', 'Un wok va bien para saltear, mover verduras o fideos y cocinar con paredes altas. Su forma ayuda a mantener los ingredientes en movimiento.'],
        grill: ['¿Para qué se usa mejor una sartén grill?', 'Una sartén grill sirve para sellar y cocinar a la parrilla en interior. Las estrías pueden crear marcas tipo parrilla, pero necesita precalentamiento y buen contacto.'],
        crepe: ['¿Para qué se usa mejor una sartén para crepes?', 'Una sartén para crepes va bien para masas finas, tortitas y alimentos que se benefician de un borde bajo.'],
        productType: [`¿Qué tipo de producto es esta ${facts.productType}?`, `${name} se identifica como ${facts.productType}. Usa el tipo de producto para decidir si encaja con la preparación que tienes en mente.`],
        cleanProduct: ['¿Cómo debo limpiar este producto?', cleaningAnswer(facts).replace('Clean the pan', 'Limpia la sartén').replace('Clean the product', 'Limpia el producto')],
        lid: ['¿Incluye una tapa de cristal?', accessoryAnswer(facts).replace('includes', 'incluye')],
        accessory: ['¿Qué accesorio está incluido?', accessoryAnswer(facts).replace('includes', 'incluye')],
        coolplus: ['¿Los mangos Cool+ pueden calentarse durante la cocción?', 'La tecnología Cool+ puede reducir la transferencia de calor a los mangos durante la cocción normal en la placa. Los mangos aún pueden calentarse según el nivel de calor, el tiempo y la posición.'],
      },
      nl: {
        sizePan: [`Is ${facts.sizes[0]} de juiste panmaat voor mijn koken?`, `Een koekenpan van ${facts.sizes[0]} is geschikt voor eiwitten, groenten, sauteren, bruinen en dichtschroeien. Voor veel dagelijkse maaltijden biedt hij genoeg oppervlak voor 2-3 personen en past hij goed op een normale kookzone.`],
        setSizes: ['Welke maten zitten in deze pannenset?', `${name} bevat ${sizes}.`],
        setJobs: ['Welke panmaat gebruik ik voor welke kooktaak?', `De set bevat ${sizes}. Kleinere pannen passen bij compacte porties, grotere pannen geven meer oppervlak voor bruinen of sauteren.`],
        storage: ['Hoe helpt een pannenset bij opbergen en veelzijdigheid?', 'Een pannenset geeft meerdere maten voor verschillende porties zonder elke pan apart te kopen.'],
        induction: [`Werkt deze ${facts.productType === 'pan set' ? 'pannenset' : 'pan'} op inductie?`, `Ja. ${name} is geschikt voor inductie. De panmaat moet nog steeds bij de kookzone passen.`],
        dishwasher: [`Kan deze ${facts.productType === 'pan set' ? 'pannenset' : 'pan'} in de vaatwasser?`, 'Ja, er is vaatwasserbewijs. Met de hand wassen en goed afdrogen blijft verstandig om de oppervlakte netjes te houden.'],
        oven: [`Kan deze ${facts.productType === 'pan set' ? 'pannenset' : 'pan'} in de oven?`, 'Ja, er is bewijs voor ovengebruik. Controleer de temperatuurgrens, omdat handgreep, coating, deksel of accessoires kunnen meespelen.'],
        nonstickBest: ['Waarvoor is een pan met antiaanbaklaag het beste?', 'Een antiaanbaklaag is geschikt voor eieren, vis, pannenkoeken en delicate gerechten waarbij makkelijk lossen belangrijker is dan hard schroeien. Gebruik matige hitte en vermijd oververhitting.'],
        nonstickCare: ['Hoe onderhoud ik een pan met antiaanbaklaag?', 'Gebruik matige hitte, zachte reiniging en geen metalen keukengerei op de coating. Zo blijft het oppervlak beter beschermd.'],
        ceramicBest: ['Waarvoor is een keramische pan het beste?', 'Een keramische coating is geschikt voor zacht bakken, eieren, vis en delicate gerechten. Matige hitte ondersteunt het loslaten en beschermt de oppervlakte.'],
        ceramicCare: ['Hoe onderhoud ik een keramische pan?', 'Gebruik matige hitte, zachte reiniging en geen metalen keukengerei op de keramische coating.'],
        steak: ['Is deze pan geschikt voor steak en hoge hitte?', 'Ja. Een roestvrijstalen pan is geschikt voor bruinen en schroeien omdat hij sterk contact tussen voedsel en panoppervlak ondersteunt. Verwarm zorgvuldig voor en gebruik genoeg olie of vet.'],
        stainlessCare: ['Hoe reinig en onderhoud ik deze roestvrijstalen pan?', 'Reinig de pan met warm water, mild afwasmiddel en een zachte spons, en droog hem goed af. Cromargan® roestvrij staal profiteert van afdrogen omdat mineralen in water zichtbare plekken kunnen achterlaten.'],
        marks: ['Waarom ontstaan watervlekken of regenboogvlekken op roestvrij staal?', 'Watervlekken zijn meestal mineralen die achterblijven wanneer water opdroogt. Regenboogvlekken kunnen door hitte ontstaan en zijn vaak te verminderen met milde roestvrijstaalverzorging en goed afdrogen.'],
        sticking: ['Waarom blijft eten plakken in een roestvrijstalen pan?', 'Eten blijft vaak plakken als de pan niet goed is voorverwarmd, de hitte niet klopt of het eten te vroeg wordt bewogen. Verwarm voor, voeg olie of vet passend toe en laat eiwitten eerst een korst vormen.'],
        heatControl: ['Hoe regel ik de hitte in een roestvrijstalen pan?', 'Verwarm de pan eerst voor en pas daarna de hitte aan voordat je eten toevoegt. Roestvrij staal werkt het best met stabiele temperatuurcontrole: te weinig hitte belemmert bruinen, te veel hitte kan plakken of aanbranden veroorzaken.'],
        steakEggs: ['Is deze pan beter voor steak of eieren?', 'Deze roestvrijstalen pan is beter voor bruinen en schroeien van steak, groenten en eiwitten. Eieren kunnen, maar vragen meer temperatuurcontrole en genoeg vet. Voor vetarm delicaat koken is antiaanbak makkelijker.'],
        comparison: ['Waarin verschilt deze pan van andere WMF koekenpannen?', `${name} vergelijk je op producttype, oppervlak, maat en ondersteunde compatibiliteit. De duidelijkste verschillen zijn ${facts.hasCromargan ? 'roestvrijstalen constructie' : facts.hasCeramic ? 'keramische coating' : facts.hasCoating ? 'antiaanbaklaag' : facts.productType}${facts.sizes.length ? ` en ${sizes}` : ''}.`],
        wok: ['Waarvoor gebruik je een wok het best?', 'Een wok is geschikt voor roerbakken, het omscheppen van groenten of noedels en koken met hoge randen. De vorm helpt ingrediënten snel in beweging te houden.'],
        grill: ['Waarvoor gebruik je een grillpan het best?', 'Een grillpan is bedoeld voor schroeien en binnen grillen. De ribbels kunnen grillstrepen maken, maar de pan moet goed worden voorverwarmd.'],
        crepe: ['Waarvoor gebruik je een crêpepan het best?', 'Een crêpepan is geschikt voor dun beslag, pannenkoeken en gerechten die voordeel hebben van een lage rand.'],
        productType: [`Wat voor product is deze ${facts.productType}?`, `${name} is herkenbaar als ${facts.productType}. Gebruik het producttype om te beoordelen of het past bij je kooktaak.`],
        cleanProduct: ['Hoe reinig ik dit product?', cleaningAnswer(facts).replace('Clean the pan', 'Reinig de pan').replace('Clean the product', 'Reinig het product')],
        lid: ['Zit er een glazen deksel bij?', accessoryAnswer(facts).replace('includes', 'bevat')],
        accessory: ['Welk accessoire is inbegrepen?', accessoryAnswer(facts).replace('includes', 'bevat')],
        coolplus: ['Kunnen de Cool+ grepen warm worden tijdens het koken?', 'Cool+ greeptechnologie kan de warmteoverdracht naar de grepen bij normaal koken op de kookplaat verminderen. De grepen kunnen nog steeds warm worden afhankelijk van hitte, kooktijd en positie.'],
      },
      fr: {
        sizePan: [`Une poêle de ${facts.sizes[0]} convient-elle à ma façon de cuisiner ?`, `Une poêle de ${facts.sizes[0]} convient aux protéines, légumes, sautés, brunissage et saisie. Pour beaucoup de repas quotidiens, elle offre assez de surface pour 2-3 personnes tout en restant adaptée à une zone de cuisson courante.`],
        setSizes: ['Quelles tailles sont incluses dans ce set de poêles ?', `${name} comprend ${sizes}.`],
        setJobs: ['Quelle taille de poêle utiliser pour chaque cuisson ?', `Le set comprend ${sizes}. Les petites poêles conviennent aux portions compactes, les grandes offrent plus de surface pour brunir ou sauter.`],
        storage: ['Comment un set de poêles aide-t-il pour la polyvalence et le rangement ?', 'Un set de poêles offre plusieurs tailles pour différentes portions sans acheter chaque poêle séparément.'],
        induction: [`Cette ${facts.productType === 'pan set' ? 'set de poêles' : 'poêle'} fonctionne-t-elle sur induction ?`, `Oui. ${name} est indiquée pour l’induction. La taille doit tout de même correspondre à la zone de cuisson.`],
        dishwasher: null,
        oven: [`Cette ${facts.productType === 'pan set' ? 'set de poêles' : 'poêle'} peut-elle aller au four ?`, 'Oui, il existe une indication d’usage au four. Vérifiez la limite de température, car la poignée, le revêtement, le couvercle ou les accessoires peuvent compter.'],
        nonstickBest: ['Pour quels aliments une poêle antiadhésive est-elle la plus adaptée ?', 'Le revêtement antiadhésif convient aux œufs, au poisson, aux crêpes et aux aliments délicats, où le démoulage facile compte plus qu’une saisie forte. Utilisez une chaleur modérée et évitez la surchauffe.'],
        nonstickCare: ['Comment entretenir une poêle antiadhésive ?', 'Utilisez une chaleur modérée, un nettoyage doux et pas d’ustensiles métalliques sur le revêtement. Cela aide à préserver la surface.'],
        ceramicBest: ['Pour quoi une poêle céramique est-elle la plus adaptée ?', 'Le revêtement céramique convient à la cuisson douce, aux œufs, au poisson et aux aliments délicats. Une chaleur modérée aide au décollage et protège la surface.'],
        ceramicCare: ['Comment entretenir une poêle céramique ?', 'Utilisez une chaleur modérée, un nettoyage doux et pas d’ustensiles métalliques sur le revêtement céramique.'],
        steak: ['Cette poêle convient-elle au steak et aux fortes températures ?', 'Oui. Une poêle en acier inoxydable convient au brunissage et à la saisie car elle favorise un contact fort entre l’aliment et la surface. Préchauffez soigneusement et utilisez assez d’huile ou de matière grasse.'],
        stainlessCare: ['Comment nettoyer et entretenir cette poêle en acier inoxydable ?', 'Nettoyez la poêle avec de l’eau tiède, un détergent doux et une éponge souple, puis séchez-la soigneusement. L’acier inoxydable Cromargan® bénéficie du séchage, car les minéraux de l’eau peuvent laisser des traces visibles.'],
        marks: ['Pourquoi des traces d’eau ou des marques arc-en-ciel apparaissent-elles sur l’acier inoxydable ?', 'Les traces d’eau sont souvent des minéraux laissés quand l’eau sèche. Les marques arc-en-ciel peuvent venir de la chaleur et se réduisent souvent avec un entretien doux de l’inox et un bon séchage.'],
        sticking: ['Pourquoi les aliments attachent-ils dans une poêle en acier inoxydable ?', 'Les aliments attachent souvent si la poêle n’est pas assez préchauffée, si la chaleur n’est pas adaptée ou si l’aliment est déplacé trop tôt. Préchauffez, ajoutez l’huile ou la matière grasse au bon moment et laissez les protéines former une croûte.'],
        heatControl: ['Comment contrôler la chaleur dans une poêle en acier inoxydable ?', 'Préchauffez d’abord la poêle, puis ajustez la chaleur avant d’ajouter les aliments. L’acier inoxydable donne de meilleurs résultats avec une température régulière : trop peu de chaleur limite le brunissage, trop de chaleur peut faire attacher ou brûler.'],
        steakEggs: ['Cette poêle est-elle meilleure pour le steak ou pour les œufs ?', 'Cette poêle en acier inoxydable est mieux adaptée au brunissage et à la saisie du steak, des légumes et des protéines. Les œufs sont possibles, mais demandent plus de contrôle de température et assez de matière grasse. Pour une cuisson délicate avec peu de gras, l’antiadhésif est plus facile.'],
        comparison: ['En quoi cette poêle diffère-t-elle des autres poêles WMF ?', `${name} se compare par type de produit, surface, taille et compatibilité étayée. Les différences les plus claires sont ${facts.hasCromargan ? 'la construction en acier inoxydable' : facts.hasCeramic ? 'le revêtement céramique' : facts.hasCoating ? 'le revêtement antiadhésif' : facts.productType}${facts.sizes.length ? ` et ${sizes}` : ''}.`],
        wok: ['À quoi sert le mieux un wok ?', 'Un wok convient aux sautés, au mélange de légumes ou de nouilles et à la cuisson avec bords hauts. Sa forme aide à garder les ingrédients en mouvement.'],
        grill: ['À quoi sert le mieux une poêle grill ?', 'Une poêle grill sert à saisir et griller à l’intérieur. Les nervures peuvent créer des marques de grill, mais il faut préchauffer et assurer un bon contact.'],
        crepe: ['À quoi sert le mieux une poêle à crêpes ?', 'Une poêle à crêpes convient aux pâtes fines, crêpes et aliments qui profitent d’un bord bas.'],
        productType: [`Quel type de produit est cette ${facts.productType} ?`, `${name} est identifié comme ${facts.productType}. Utilisez ce type de produit pour vérifier s’il correspond à la cuisson prévue.`],
        cleanProduct: ['Comment nettoyer ce produit ?', cleaningAnswer(facts).replace('Clean the pan', 'Nettoyez la poêle').replace('Clean the product', 'Nettoyez le produit')],
        lid: ['Un couvercle en verre est-il inclus ?', accessoryAnswer(facts).replace('includes', 'comprend')],
        accessory: ['Quel accessoire est inclus ?', accessoryAnswer(facts).replace('includes', 'comprend')],
        coolplus: ['Les poignées Cool+ peuvent-elles devenir chaudes pendant la cuisson ?', 'La technologie Cool+ peut réduire le transfert de chaleur aux poignées pendant une cuisson normale sur plaque. Les poignées peuvent tout de même devenir chaudes selon la chaleur, la durée et la position.'],
      },
    }[language];

    if (!copy) return null;
    let pair = null;
    if (/right pan size/.test(q)) pair = copy.sizePan;
    else if (/What sizes are included/.test(q)) pair = copy.setSizes;
    else if (/Which pan size/.test(q)) pair = copy.setJobs;
    else if (/storage and versatility/.test(q)) pair = copy.storage;
    else if (/induction hob/.test(q)) pair = copy.induction;
    else if (/dishwasher/.test(q)) pair = copy.dishwasher;
    else if (/go in the oven/.test(q)) pair = copy.oven;
    else if (/non-stick frying pan best/.test(q)) pair = copy.nonstickBest;
    else if (/care for a non-stick/.test(q)) pair = copy.nonstickCare;
    else if (/ceramic frying pan best/.test(q)) pair = copy.ceramicBest;
    else if (/care for a ceramic/.test(q)) pair = copy.ceramicCare;
    else if (/steak and high-heat/.test(q)) pair = copy.steak;
    else if (/clean and care/.test(q)) pair = copy.stainlessCare;
    else if (/water spots or rainbow/.test(q)) pair = copy.marks;
    else if (/food stick/.test(q)) pair = copy.sticking;
    else if (/control heat/.test(q)) pair = copy.heatControl;
    else if (/better for steak or eggs/.test(q)) pair = copy.steakEggs;
    else if (/different from other WMF/.test(q)) pair = copy.comparison;
    else if (/wok best/.test(q)) pair = copy.wok;
    else if (/grill pan best/.test(q)) pair = copy.grill;
    else if (/crepe pan best/.test(q)) pair = copy.crepe;
    else if (/What type of product/.test(q)) pair = copy.productType;
    else if (/How should I clean this product|How should I clean this pan/.test(q)) pair = copy.cleanProduct;
    else if (/glass lid/.test(q)) pair = copy.lid;
    else if (/Which accessory/.test(q)) pair = copy.accessory;
    else if (/Cool\+ handles/.test(q)) pair = copy.coolplus;

    if (!pair) return null;
    return { ...template, question: pair[0], answer: pair[1] };
  }

  function isClaimSuppressedForLanguage(template, language) {
    const text = `${template.question} ${template.answer}`;
    return /dishwasher/i.test(text) && (language === 'es' || language === 'fr');
  }

  function previewRows(urls, languages, maxFaq, processedUrlCount, skippedTemplateLanguages) {
    const visibleLanguages = visiblePreviewLanguages(languages);
    return urls.slice(0, processedUrlCount).map((url, index) => {
      const facts = factsForUrl(url);
      const pipeline = buildCandidatePipeline(facts);
      const templates = pipeline.candidates.slice(0, maxFaq);
      const faqs = visibleLanguages.flatMap((language) =>
        templates.flatMap((template) => {
          if (isClaimSuppressedForLanguage(template, language)) return [];
          const localized = localizedTemplate(template, language, facts);
          if (!localized) {
            if (skippedTemplateLanguages) skippedTemplateLanguages.add(language);
            return [];
          }
          return [{
            language,
            question: localized.question,
            answer: localized.answer,
            status: languageStatus(language),
            purpose_tags: localized.purpose_tags,
          }];
        }),
      );
      const generatedLanguages = Array.from(new Set(faqs.map((faq) => faq.language)));

      return {
        url,
        product_id: `local-product-${index + 1}`,
        status: faqs.some((faq) => faq.status === 'needs-review') ? 'needs-review' : 'draft',
        selected_languages: generatedLanguages,
        faq_count: faqs.length,
        faqs,
        skipped_candidates: pipeline.skipped,
      };
    });
  }

  function visiblePreviewLabels() {
    return [
      'FAQ Preview',
      'Product position',
      'URL',
      'product_id',
      'Status',
      'Selected languages',
      'FAQ count',
      'Language',
      'Question',
      'Answer',
      'Purpose',
      'Previous',
      'Next',
    ];
  }

  function visiblePreviewText(result) {
    const rows = result.preview_rows || [];
    if (!rows.length) return 'No FAQ preview is available yet.';
    return rows
      .flatMap((row) => [
        row.url,
        row.product_id,
        row.status,
        ...row.faqs.flatMap((faq) => [faq.language, faq.status, faq.question, faq.answer]),
      ])
      .join('\n');
  }

  function runLocalPreview(input) {
    const urls = normalizeUrls(input.urls);
    const estimate = estimateLocalPreview(input);
    const visibleLanguages = visiblePreviewLanguages(estimate.languages);
    const localizationWarnings = skippedLocalizationWarnings(estimate.languages, visibleLanguages);

    if (estimate.requires_confirmation && !input.cost_confirmed) {
      return {
        modeLabel: 'Local deterministic preview',
        jobStatus: 'Cost Estimated',
        urlsProcessed: 0,
        internalSubBatches: 0,
        generatedFaqItems: 0,
        selectedLanguages: visibleLanguages,
        confirmationRequired: estimate.requires_confirmation,
        quality: { approved: 0, draft: 0, needsReview: 0, claimRiskFailures: 0, highSeverityRisks: 0, shouldPause: false },
        previewWorkbookAvailable: false,
        finalWorkbookAvailable: false,
        preview_rows: [],
        workbookTabs: [],
        filename: undefined,
        excelXml: undefined,
        warnings: localizationWarnings,
        candidateDiagnostics: [],
      };
    }

    const shouldPause = estimate.languages.some((language) => language !== 'de');
    const processedUrlCount = shouldPause && !input.continue_after_warning ? Math.min(urls.length, 12) : urls.length;
    const internalSubBatches = processedUrlCount === 0 ? 0 : Math.ceil(processedUrlCount / 12);
    const skippedTemplateLanguages = new Set();
    const rows = previewRows(urls, estimate.languages, estimate.max_faq_count, processedUrlCount, skippedTemplateLanguages);
    const generatedLanguages = Array.from(new Set(rows.flatMap((row) => row.faqs.map((faq) => faq.language))));
    const candidateDiagnostics = rows.flatMap((row) => row.skipped_candidates || []);
    const templateWarnings = skippedTemplateLanguages.size
      ? [`Some FAQ templates were skipped because deterministic localization is not available for: ${Array.from(skippedTemplateLanguages).sort().join(', ')}`]
      : [];
    const generatedFaqItems = rows.reduce((count, row) => count + row.faqs.length, 0);
    const needsReview = rows.reduce((count, row) => count + row.faqs.filter((faq) => faq.status === 'needs-review').length, 0);
    const draft = generatedFaqItems - needsReview;
    const tabs = tabNames.map((name) => ({
      name,
      rowCount:
        name === 'Job Summary'
          ? 1
          : name === 'Product Intake'
            ? processedUrlCount
            : name === 'Client Review Needed'
              ? needsReview
              : name === 'Approved FAQ'
                ? 0
                : name === 'Cost Log'
                  ? 0
                  : generatedFaqItems,
    }));
    const finalWorkbookAvailable = !(shouldPause && !input.continue_after_warning);

    return {
      modeLabel: 'Local deterministic preview',
      jobStatus: shouldPause ? 'Completed with Warnings' : 'Completed',
      urlsProcessed: processedUrlCount,
      internalSubBatches,
      generatedFaqItems,
      selectedLanguages: generatedLanguages,
      confirmationRequired: estimate.requires_confirmation,
      quality: {
        approved: 0,
        draft,
        needsReview,
        claimRiskFailures: 0,
        highSeverityRisks: 0,
        shouldPause,
      },
      previewWorkbookAvailable: true,
      finalWorkbookAvailable,
      preview_rows: rows,
      workbookTabs: tabs,
      filename: `FAQ_Output_WMF_Local_Demo_${new Date().toISOString().slice(0, 10)}.xlsx`,
      excelXml: workbookXml(tabs),
      warnings: [...localizationWarnings, ...templateWarnings],
      candidateDiagnostics,
    };
  }

  const api = { estimateLocalPreview, runLocalPreview, languageLabels, carouselIndex, visiblePreviewLabels, visiblePreviewText };
  root.LocalPreview = api;
  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
