import { extractPartialPKO } from '../index';
import { pkoSchema } from '../../../core/src/schemas/pko.schema';
import type { IntakeRow } from '../../../core/src/types/intake';

const DEFAULT_URL = 'https://www.wmf.com/de/de/devil-bratpfannen-set-3-teilig-20-cm-24-cm-28-cm-3201113818.html';

async function run(): Promise<void> {
  const url = process.argv[2] ?? DEFAULT_URL;

  const intakeRow: IntakeRow = {
    row_id: 'manual-test-001',
    product_id: 'wmf-test-product',
    url,
    page_type: 'PDP',
    category: 'Cookware',
    product_family: 'Devil',
    priority: 'P1',
    source_language: 'de',
  };

  const pko = await extractPartialPKO(intakeRow);
  const validated = pkoSchema.parse(pko);

  console.log(JSON.stringify(validated, null, 2));
}

run().catch((error) => {
  console.error('Extractor failed:', error);
  process.exit(1);
});
