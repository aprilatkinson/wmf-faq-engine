/**
 * Section 1.1, 1.2a, and 1.3 enums for FAQ Engine data contracts.
 */

export const pageTypeValues = ['PDP', 'PLP', 'article', 'recipe'] as const;
export type PageType = (typeof pageTypeValues)[number];

export const priorityValues = ['P1', 'P2', 'P3'] as const;
export type Priority = (typeof priorityValues)[number];

export const sourceLanguageValues = ['de', 'en', 'es', 'nl', 'fr'] as const;
export type SourceLanguage = (typeof sourceLanguageValues)[number];

export const fmoSourceConfidenceValues = ['high', 'medium', 'low'] as const;
export type FmoSourceConfidence = (typeof fmoSourceConfidenceValues)[number];

export const faqStatusValues = ['draft', 'needs-review', 'approved', 'rejected', 'cms-ready', 'exported'] as const;
export type FAQStatus = (typeof faqStatusValues)[number];

export const faqPurposeTagValues = [
  'buyer-hesitation',
  'ai-visibility',
  'objection-handling',
  'seo-geo',
  'comparison',
  'support-reduction',
  'expectation',
  'upsell',
  'positioning',
  'benefit-selling',
] as const;
export type FAQPurposeTag = (typeof faqPurposeTagValues)[number];
