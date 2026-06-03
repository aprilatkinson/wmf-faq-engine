import { PageType, Priority, SourceLanguage } from '../constants/enums';

/** Section 1.1 URL Intake Row (Input Spreadsheet) */
export interface IntakeRow {
  row_id: string;
  product_id?: string;
  url: string;
  page_type: PageType;
  category: string;
  product_family?: string;
  variant_group_id?: string;
  priority: Priority;
  source_language?: SourceLanguage;
}
