import type { SourceLanguage } from '../../../core/src/constants/enums';
import type { RiskFlag } from '../../../core/src/types/faq';

export type MarketClaimStatus = 'approved' | 'review' | 'pending' | 'url-must-confirm';

interface ClaimRule {
  claim: string;
  pattern: RegExp;
  statusByLanguage: Record<SourceLanguage, MarketClaimStatus>;
}

const claimRules: ClaimRule[] = [
  {
    claim: 'dishwasher-suitable',
    pattern: /dishwasher-suitable|spülmaschinengeeignet|spuelmaschinengeeignet|lavavajillas|vaatwasser|lave-vaisselle/i,
    statusByLanguage: {
      de: 'approved',
      en: 'approved',
      es: 'review',
      nl: 'approved',
      fr: 'review',
    },
  },
  {
    claim: 'corrosion-resistant',
    pattern: /corrosion-resistant|korrosionsbeständig|corrosion|corrosión|corrosiebestendig/i,
    statusByLanguage: {
      de: 'pending',
      en: 'pending',
      es: 'pending',
      nl: 'pending',
      fr: 'pending',
    },
  },
  {
    claim: 'scratch-resistant',
    pattern: /scratch-resistant|kratzfest|scratch resistance|resistente a los arañazos|krasbestendig|résistant aux rayures/i,
    statusByLanguage: {
      de: 'url-must-confirm',
      en: 'url-must-confirm',
      es: 'url-must-confirm',
      nl: 'url-must-confirm',
      fr: 'url-must-confirm',
    },
  },
  {
    claim: '18/10 stainless steel',
    pattern: /18\/10 stainless steel|18\/10 edelstahl|acero inoxidable 18\/10|18\/10 roestvrij staal|acier inoxydable 18\/10/i,
    statusByLanguage: {
      de: 'approved',
      en: 'approved',
      es: 'review',
      nl: 'approved',
      fr: 'review',
    },
  },
];

function severityForStatus(status: MarketClaimStatus): 'high' | 'medium' {
  return status === 'pending' || status === 'url-must-confirm' ? 'high' : 'medium';
}

export function checkMarketClaimApproval(text: string, language: SourceLanguage): RiskFlag[] {
  const flags: RiskFlag[] = [];

  for (const rule of claimRules) {
    if (!rule.pattern.test(text)) {
      continue;
    }

    const status = rule.statusByLanguage[language];
    if (status === 'approved') {
      continue;
    }

    flags.push({
      flag_type: `market-claim:${rule.claim}`,
      description: `Claim "${rule.claim}" requires ${status} handling for ${language}.`,
      severity: severityForStatus(status),
    });
  }

  return flags;
}
