import type { SourceLanguage } from '../../../core/src/constants/enums';
import type { FaqItem } from '../../../core/src/types/faq';
import { faqItemSchema } from '../../../core/src/schemas/faq.schema';
import { checkMarketClaimApproval } from './claim-approval';

export const supportedLocalizationLanguages: SourceLanguage[] = ['de', 'en', 'es', 'nl', 'fr'];

const localizedPhrases: Record<Exclude<SourceLanguage, 'de'>, Record<string, string>> = {
  en: {
    'Ist das WMF Devil Pfannen-Set fuer Induktion geeignet?': 'Is the WMF Devil pan set suitable for induction?',
    'Ja. Das WMF Devil Pfannen-Set ist fuer Induktion geeignet und spuelmaschinengeeignet. Die Antihaftversiegelung reduziert Anhaften und erleichtert die Reinigung.':
      'Yes. The WMF Devil pan set is suitable for induction and dishwasher-suitable. The non-stick coating reduces sticking and makes cleaning easier.',
    'Ja. Das WMF Devil Pfannen-Set ist fuer Induktion geeignet. Die Antihaftversiegelung reduziert Anhaften und erleichtert die Reinigung.':
      'Yes. The WMF Devil pan set is suitable for induction. The non-stick coating reduces sticking and makes cleaning easier.',
  },
  es: {
    'Ist das WMF Devil Pfannen-Set fuer Induktion geeignet?': 'El set de sartenes WMF Devil es apto para induccion?',
    'Ja. Das WMF Devil Pfannen-Set ist fuer Induktion geeignet und spuelmaschinengeeignet. Die Antihaftversiegelung reduziert Anhaften und erleichtert die Reinigung.':
      'Si. El set de sartenes WMF Devil es apto para induccion. [claim review required: dishwasher-suitable] El recubrimiento antiadherente reduce que los alimentos se peguen y facilita la limpieza.',
    'Ja. Das WMF Devil Pfannen-Set ist fuer Induktion geeignet. Die Antihaftversiegelung reduziert Anhaften und erleichtert die Reinigung.':
      'Si. El set de sartenes WMF Devil es apto para induccion. El recubrimiento antiadherente reduce que los alimentos se peguen y facilita la limpieza.',
  },
  nl: {
    'Ist das WMF Devil Pfannen-Set fuer Induktion geeignet?': 'Is de WMF Devil pannenset geschikt voor inductie?',
    'Ja. Das WMF Devil Pfannen-Set ist fuer Induktion geeignet und spuelmaschinengeeignet. Die Antihaftversiegelung reduziert Anhaften und erleichtert die Reinigung.':
      'Ja. De WMF Devil pannenset is geschikt voor inductie en vaatwasser. De antiaanbaklaag vermindert aanhechten en maakt schoonmaken eenvoudiger.',
    'Ja. Das WMF Devil Pfannen-Set ist fuer Induktion geeignet. Die Antihaftversiegelung reduziert Anhaften und erleichtert die Reinigung.':
      'Ja. De WMF Devil pannenset is geschikt voor inductie. De antiaanbaklaag vermindert aanhechten en maakt schoonmaken eenvoudiger.',
  },
  fr: {
    'Ist das WMF Devil Pfannen-Set fuer Induktion geeignet?': 'Le set de poeles WMF Devil est-il adapte a induction ?',
    'Ja. Das WMF Devil Pfannen-Set ist fuer Induktion geeignet und spuelmaschinengeeignet. Die Antihaftversiegelung reduziert Anhaften und erleichtert die Reinigung.':
      'Oui. Le set de poeles WMF Devil est adapte a induction. [claim review required: dishwasher-suitable] Le revetement antiadhesif reduit l adhesion et facilite le nettoyage.',
    'Ja. Das WMF Devil Pfannen-Set ist fuer Induktion geeignet. Die Antihaftversiegelung reduziert Anhaften und erleichtert die Reinigung.':
      'Oui. Le set de poeles WMF Devil est adapte a induction. Le revetement antiadhesif reduit l adhesion et facilite le nettoyage.',
  },
};

function assertMasterFaq(faq: FaqItem): void {
  if (!faq.is_master) {
    throw new Error('Localization input must be a master FAQ item.');
  }
}

function translateText(text: string, targetLanguage: Exclude<SourceLanguage, 'de'>): { text: string; needsReview: boolean } {
  const translation = localizedPhrases[targetLanguage][text];
  if (translation) {
    return { text: translation, needsReview: false };
  }

  return {
    text: `[${targetLanguage} localization pending] ${text}`,
    needsReview: true,
  };
}

function withSchemaReady(faq: FaqItem): FaqItem {
  const candidate = { ...faq, schema_ready: true };
  return {
    ...candidate,
    schema_ready: faqItemSchema.safeParse(candidate).success,
  };
}

export function localizeFaqItem(masterFaq: FaqItem, targetLanguage: SourceLanguage): FaqItem {
  assertMasterFaq(masterFaq);

  if (!supportedLocalizationLanguages.includes(targetLanguage)) {
    throw new Error(`Unsupported target language: ${targetLanguage}`);
  }

  if (targetLanguage === masterFaq.language) {
    return masterFaq;
  }

  const translatedQuestion = translateText(masterFaq.question, targetLanguage);
  const translatedAnswer = translateText(masterFaq.answer, targetLanguage);
  const marketRiskFlags = checkMarketClaimApproval(`${masterFaq.question} ${masterFaq.answer} ${translatedQuestion.text} ${translatedAnswer.text}`, targetLanguage);
  const needsReview = translatedQuestion.needsReview || translatedAnswer.needsReview || marketRiskFlags.length > 0;

  return withSchemaReady({
    ...masterFaq,
    faq_id: `${masterFaq.faq_id}-${targetLanguage}`,
    question: translatedQuestion.text,
    answer: translatedAnswer.text,
    language: targetLanguage,
    is_master: false,
    evaluator_scores: {
      ...masterFaq.evaluator_scores,
      localization: translatedQuestion.needsReview || translatedAnswer.needsReview ? 1 : 2,
    },
    risk_flags: [...masterFaq.risk_flags, ...marketRiskFlags],
    status: needsReview ? 'needs-review' : 'draft',
    rewrite_count: 0,
    schema_ready: true,
    version: '1.0.0',
    created_at: new Date().toISOString(),
  });
}

export function localizeFaqItems(masterFaqs: FaqItem[], targetLanguages: SourceLanguage[]): FaqItem[] {
  return masterFaqs.flatMap((masterFaq) => targetLanguages.map((targetLanguage) => localizeFaqItem(masterFaq, targetLanguage)));
}
