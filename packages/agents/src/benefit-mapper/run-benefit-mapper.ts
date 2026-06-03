#!/usr/bin/env -S npx tsx
import { mapPkoToFmoMappings } from './benefit-mapper';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';

// Hardcoded sample PKO (Devil-style) copied for local inspection per rules
const samplePko: ProductKnowledgeObject = {
  pko_id: 'pko-devil-manual-1',
  source_url: 'https://www.wmf.com/de/de/devil-bratpfannen-set-3-teilig-20-cm-24-cm-28-cm-3201113818.html',
  product_name: 'Devil Frying Pan Set',
  category: 'Cookware',
  product_family: 'Devil',
  source_language_detected: 'de',
  source_language_confidence: 0.85,
  features: ['PTFE', 'Keramik', 'Soft-Touch', 'Cool+ Technologie', 'Gießrand', 'Handle type: fixed handle'],
  materials: ['Cromargan® Edelstahl rostfrei'],
  compatibility: ['Induktion, Gas'],
  care_instructions: ['Ja, aber Spülen per Hand empfohlen'],
  fmo_mappings: [],
  benefits_explicit: [],
  benefits_missing: [],
  warranty_service: [],
  use_cases: [],
  claims_flagged: [],
  page_weaknesses: [],
  knowledgebase_chunks_used: [],
  pko_version: '1.0.0',
  created_at: new Date().toISOString(),
};

function validateMapping(m: any): { ok: boolean; missing: string[] } {
  const required = ['feature', 'mechanism', 'outcome', 'use_case', 'buyer_relevance', 'source_confidence'];
  const missing: string[] = [];
  for (const k of required) {
    if (!(k in m)) missing.push(k);
    const val = m[k];
    if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) missing.push(k);
  }
  return { ok: missing.length === 0, missing: Array.from(new Set(missing)) };
}

async function run(): Promise<void> {
  const mappings = mapPkoToFmoMappings(samplePko);
  console.log('\n===== FMO MAPPINGS OUTPUT =====\n');
  console.log(JSON.stringify(mappings, null, 2));

  console.log('\n===== VALIDATION =====\n');
  let allOk = true;
  mappings.forEach((m, idx) => {
    const { ok, missing } = validateMapping(m);
    if (!ok) {
      allOk = false;
      console.error(`Mapping[${idx}] missing fields: ${missing.join(', ')}`);
    } else {
      console.log(`Mapping[${idx}] OK - feature: ${m.feature} (confidence: ${m.source_confidence})`);
    }
  });

  if (!allOk) {
    console.error('\nSome mappings failed validation.');
    process.exit(1);
  }

  console.log('\nAll mappings validated successfully.');
}

run().catch((err) => {
  console.error('Helper failed:', err);
  process.exit(1);
});
