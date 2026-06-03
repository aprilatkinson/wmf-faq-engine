import type { FaqItem } from '../../../core/src/types/faq';

/**
 * AI Visibility Evaluator
 * Scores 0-3 based on whether the answer is retrievable by an AI system.
 * Pass threshold: 2
 *
 * Rubric:
 * 0: So vague it applies to any product. No product/category name.
 * 1: Some specificity but missing product/category name or key decision attributes.
 * 2: Contains product/category name + at least one explicit decision attribute.
 * 3: Self-contained: product/category name, explicit compatibility/use case, specific enough for AI retrieval.
 */

function hasProductOrCategoryName(answer: string): boolean {
  // Check for common product/category names
  return /pan|skillet|cookware|frying pan|pot|set|kochgeschirr|pfanne|kochtopf|besteck|cutlery|coffee|knife|knives|messer|besteckset/i.test(
    answer,
  );
}

function hasDecisionAttribute(answer: string): boolean {
  // Check for explicit decision-making attributes
  return /induction|dishwasher|oven|material|stainless|ceramic|coating|non-stick|compatibility|temperature|size|weight|use|suitable|for|compatible|best|when|material|feature|benefit/i.test(
    answer,
  );
}

function isVague(answer: string): boolean {
  // Check if answer is too generic
  const answerLower = answer.toLowerCase();
  const vaguePhrases = [
    'high quality',
    'good quality',
    'nice',
    'great',
    'excellent',
    'product',
    'it has',
    'you can',
    'depends',
    'might',
    'could',
  ];
  const vagueCount = vaguePhrases.filter((phrase) => answerLower.includes(phrase)).length;
  return vagueCount >= 3 && !hasDecisionAttribute(answer);
}

export function evaluateAiVisibility(faq: FaqItem): number {
  const answer = faq.answer || '';

  if (isVague(answer)) {
    return 0; // Too vague for retrieval
  }

  const hasProduct = hasProductOrCategoryName(answer);
  const hasAttribute = hasDecisionAttribute(answer);

  if (!hasProduct) {
    return 1; // Missing product/category identifier
  }

  if (hasProduct && !hasAttribute) {
    return 1; // Has product name but no decision attribute
  }

  if (hasProduct && hasAttribute) {
    // Check if answer is specific enough for AI retrieval
    // Score higher if answer is longer and contains more specific info
    const isSpecific = answer.length > 60 && /specific|particular|these|this|for|when|use|suitable|compatible/i.test(answer);

    if (isSpecific) {
      return 3; // Self-contained and retrievable
    }
    return 2; // Basic retrievability
  }

  return 1; // Default weak
}
