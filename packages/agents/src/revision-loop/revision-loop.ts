import type { FaqItem } from '../../../core/src/types/faq';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';
import { evaluateFaqItem } from '../evaluators';

const PASSING_THRESHOLD = 2;
const MAX_REWRITE_COUNT = 2;

function passesEvaluatorThresholds(faq: FaqItem): boolean {
  const { evaluator_scores } = faq;

  return (
    evaluator_scores.fact_fidelity >= PASSING_THRESHOLD &&
    evaluator_scores.fmo_benefit >= PASSING_THRESHOLD &&
    evaluator_scores.ai_visibility >= PASSING_THRESHOLD &&
    evaluator_scores.human_tone >= PASSING_THRESHOLD
  );
}

export function runRevisionLoop(faq: FaqItem, pko: ProductKnowledgeObject): FaqItem {
  const evaluatedFaq = evaluateFaqItem(faq, pko);

  if (!evaluatedFaq.claim_risk_pass) {
    return {
      ...evaluatedFaq,
      status: 'needs-review',
      rewrite_count: faq.rewrite_count,
    };
  }

  if (passesEvaluatorThresholds(evaluatedFaq)) {
    return {
      ...evaluatedFaq,
      status: 'approved',
      rewrite_count: faq.rewrite_count,
    };
  }

  if (faq.rewrite_count < MAX_REWRITE_COUNT) {
    // TODO: Generate revised FAQ copy in Phase 6 follow-up once the rewrite agent exists.
    return {
      ...evaluatedFaq,
      status: 'draft',
      rewrite_count: faq.rewrite_count + 1,
    };
  }

  return {
    ...evaluatedFaq,
    status: 'needs-review',
    rewrite_count: faq.rewrite_count,
  };
}

export function runRevisionLoopForFaqs(faqs: FaqItem[], pko: ProductKnowledgeObject): FaqItem[] {
  return faqs.map((faq) => runRevisionLoop(faq, pko));
}
