import type { FaqItem } from '../../../core/src/types/faq';
import type { ProductKnowledgeObject } from '../../../core/src/types/pko';
import { evaluateFactFidelity } from './fact-fidelity';
import { evaluateFmoBenefit } from './fmo-benefit';
import { evaluateAiVisibility } from './ai-visibility';
import { evaluateHumanTone } from './human-tone';
import { evaluateClaimRisk } from './claim-risk';

function toEvaluatorScore(score: number): number {
  return Math.max(0, Math.min(3, Math.round(score)));
}

export function evaluateFaqItem(faq: FaqItem, pko: ProductKnowledgeObject): FaqItem {
  // Run all 5 evaluators
  const fact_fidelity = toEvaluatorScore(evaluateFactFidelity(faq, pko));
  const fmo_benefit = toEvaluatorScore(evaluateFmoBenefit(faq));
  const ai_visibility = toEvaluatorScore(evaluateAiVisibility(faq));
  const human_tone = toEvaluatorScore(evaluateHumanTone(faq));

  // Run Claim Risk gate
  const claimRiskResult = evaluateClaimRisk(faq);

  // Map claim risk flags to risk_flags format
  const risk_flags = claimRiskResult.flags.map((flag) => ({
    flag_type: `claim-risk:${flag.term}`,
    description: `Risky wording detected: "${flag.term}". Review for WMF claim approval.`,
    severity: flag.severity,
  }));

  // Add fact-fidelity risk flags if score is 0
  if (fact_fidelity === 0) {
    risk_flags.push({
      flag_type: 'fact-fidelity:unsupported-claim',
      description: 'Answer contains unsupported claim or compatibility claim not in PKO.',
      severity: 'high',
    });
  }

  // Add FMO risk flags if score is 0 or 1
  if (fmo_benefit <= 1) {
    risk_flags.push({
      flag_type: 'fmo-benefit:weak-or-missing',
      description: fmo_benefit === 0 ? 'No FMO elements in answer (pure yes/no).' : 'Feature stated but no mechanism or outcome.',
      severity: fmo_benefit === 0 ? 'high' : 'medium',
    });
  }

  return {
    ...faq,
    evaluator_scores: {
      fact_fidelity,
      fmo_benefit,
      ai_visibility,
      human_tone,
      localization: faq.evaluator_scores?.localization ?? null,
    },
    claim_risk_pass: claimRiskResult.pass,
    risk_flags,
  };
}
