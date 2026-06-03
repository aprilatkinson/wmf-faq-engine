import type { FaqItem } from '../../../core/src/types/faq';

/**
 * FMO / Benefit Selling Evaluator
 * Scores 0-3 based on depth of FMO coverage in the answer.
 * Pass threshold: 2
 *
 * Rubric:
 * 0: Pure yes/no, no feature/mechanism/outcome. Zero decision value.
 * 1: States feature only, no mechanism or outcome.
 * 2: Feature + outcome at minimum. Reader understands what they gain.
 * 3: Feature + mechanism + outcome + (use_case OR buyer_relevance). Decision-supporting.
 */

function countFmoElements(faq: FaqItem): number {
  const coverage = faq.fmo_coverage || {};
  return Object.values(coverage).filter(Boolean).length;
}

function hasFeature(answer: string): boolean {
  // Check for common feature indicators in the answer
  return /has|have|includes|features|equipped|comes with|includes|contains/i.test(answer);
}

function hasMechanism(answer: string): boolean {
  // Mechanism: "how it works" keywords
  return /reduces|increases|improves|makes|helps|enables|allows|facilitates|prevents|protects|provides|supports|easier|simplifies/i.test(answer);
}

function hasOutcome(answer: string): boolean {
  // Outcome: buyer benefit keywords
  return /benefit|advantage|gain|easier|simpler|faster|better|improved|enhanced|reduced effort|cleanup|convenience/i.test(answer);
}

function hasUseCaseOrRelevance(faq: FaqItem): boolean {
  // Check fmo_coverage for use_case or buyer_relevance elements
  const coverage = faq.fmo_coverage || {};
  return Boolean(coverage.use_case || coverage.buyer_relevance);
}

export function evaluateFmoBenefit(faq: FaqItem): number {
  const answer = faq.answer || '';

  // Count FMO elements from coverage
  const elementCount = countFmoElements(faq);
  const coverage = faq.fmo_coverage || {};

  // If coverage indicates all elements are present, score 3
  if (elementCount >= 4) {
    return 3;
  }

  if (coverage.feature && coverage.outcome) {
    return 2;
  }

  if (coverage.feature && coverage.mechanism) {
    return 2;
  }

  if (coverage.feature) {
    return 1;
  }

  // Check answer text for FMO indicators
  const hasF = hasFeature(answer);
  const hasM = hasMechanism(answer);
  const hasO = hasOutcome(answer);

  // Score based on presence
  if (!hasF) {
    // Pure yes/no with no FMO elements
    return 0;
  }

  if (hasF && !hasM && !hasO) {
    // Feature only
    return 1;
  }

  if ((hasF && hasO) || (hasF && hasM)) {
    // Feature + outcome OR feature + mechanism
    return 2;
  }

  if (hasF && hasM && hasO) {
    // Feature + mechanism + outcome
    // Check if use_case or buyer_relevance is covered
    if (hasUseCaseOrRelevance(faq)) {
      return 3; // Full FMO depth
    }
    return 2; // FMO without use case context
  }

  return 1; // Conservative default
}
