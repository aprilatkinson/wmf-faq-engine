import { z } from 'zod';
import { pageTypeValues, priorityValues, sourceLanguageValues } from '../constants/enums';

/** Section 1.1 URL Intake Row (Input Spreadsheet) */
export const intakeRowSchema = z.object({
  row_id: z.string(),
  product_id: z.string().optional(),
  url: z.string().url(),
  page_type: z.enum(pageTypeValues),
  category: z.string(),
  product_family: z.string().optional(),
  variant_group_id: z.string().optional(),
  priority: z.enum(priorityValues),
  source_language: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(sourceLanguageValues).optional(),
  ),
}).strict();
