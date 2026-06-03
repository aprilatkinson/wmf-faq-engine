import type { FaqItem } from '../../../core/src/types/faq';

/**
 * Human Tone Evaluator
 * Scores 0-3 by penalizing robotic, bloated, corporate, vague, or unreadable answers.
 * Pass threshold: 2
 *
 * Rubric:
 * 0: Robotic, bloated, corporate jargon, or completely unreadable.
 * 1: Corporate tone, excessive length, or poor readability.
 * 2: Natural language, conversational, minimal corporate tone.
 * 3: Engaging, natural, human voice. Easy to read and understand.
 */

function countSentences(answer: string): number {
  return (answer.match(/[.!?]/g) || []).length;
}

function hasRoboticPatterns(answer: string): boolean {
  const roboticPhrases = [
    'the aforementioned',
    'hereby',
    'pursuant to',
    'with respect to',
    'in accordance with',
    'as per',
    'to wit',
    'by virtue of',
    'furthermore',
    'moreover',
    'notwithstanding',
    'by and large',
    'to be sure',
    'verily',
    'it is to be noted',
    'shall',
    'must be noted',
  ];
  const lower = answer.toLowerCase();
  return roboticPhrases.some((phrase) => lower.includes(phrase));
}

function isBloated(answer: string): boolean {
  // Check for excessive filler words or unnecessary repetition
  const fillerWords = ['very', 'quite', 'rather', 'really', 'surely', 'certainly', 'actually'];
  const fillerCount = fillerWords.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(answer)).length;

  // Check for excessive length (>200 words is bloated for FAQ answer)
  const wordCount = answer.split(/\s+/).length;
  const hasExcessiveLength = wordCount > 200;

  return fillerCount >= 3 || hasExcessiveLength;
}

function hasVagueLanguage(answer: string): boolean {
  const vaguePatterns = [/really /, /very /, /quite /, /sort of /, /kind of /, /like /, /maybe /, /perhaps /, /somehow /, /somehow /, /things?/, /stuff/i];
  const matches = vaguePatterns.filter((p) => p.test(answer));
  return matches.length >= 2;
}

function isPoorlyReadable(answer: string): boolean {
  // Check for readability issues
  const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  // Check for very long sentences (>30 words)
  const avgSentenceLength = answer.split(/\s+/).length / sentences.length;
  const hasLongSentences = avgSentenceLength > 25;

  // Check for lack of structure (few paragraph breaks)
  const hasStructure = /\n/.test(answer) && sentences.length >= 3;

  // Poor readability: long average sentence AND no structure
  return hasLongSentences && !hasStructure;
}

function isNatural(answer: string): boolean {
  // Check for natural conversational markers
  const naturalMarkers = [/you/, /your/, /we/, /our/, /let/, /here/, /this/, /that/, /these/, /those/i];
  const markerCount = naturalMarkers.filter((m) => m.test(answer)).length;
  return markerCount >= 2;
}

export function evaluateHumanTone(faq: FaqItem): number {
  const answer = faq.answer || '';

  // Check for robotic patterns first (fail)
  if (hasRoboticPatterns(answer)) {
    return 0;
  }

  // Check for bloated content
  if (isBloated(answer)) {
    return 1;
  }

  // Check for vague language
  if (hasVagueLanguage(answer)) {
    return 1;
  }

  // Check for poor readability
  if (isPoorlyReadable(answer)) {
    return 1;
  }

  // Check if answer is natural and conversational
  if (isNatural(answer)) {
    return 3; // Natural voice
  }

  // Default acceptable (corporate but readable)
  return 2;
}
