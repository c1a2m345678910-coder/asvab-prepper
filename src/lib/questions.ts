import type { Question } from '@/types/asvab';
import gsData from '@/data/questions/gs.json';
import arData from '@/data/questions/ar.json';
import wkData from '@/data/questions/wk.json';
import pcData from '@/data/questions/pc.json';
import mkData from '@/data/questions/mk.json';
import eiData from '@/data/questions/ei.json';
import asData from '@/data/questions/as.json';
import mcData from '@/data/questions/mc.json';
import aoData from '@/data/questions/ao.json';
import medData from '@/data/questions/med.json';

// TypeScript infers the JSON `questions` field as `never[]` while the arrays
// are empty. The cast is safe and will widen automatically as questions are added.
const QUESTIONS_BY_SECTION: Record<string, Question[]> = {
  GS: gsData.questions as unknown as Question[],
  AR: arData.questions as unknown as Question[],
  WK: wkData.questions as unknown as Question[],
  PC: pcData.questions as unknown as Question[],
  MK: mkData.questions as unknown as Question[],
  EI: eiData.questions as unknown as Question[],
  AS: asData.questions as unknown as Question[],
  MC: mcData.questions as unknown as Question[],
  AO: aoData.questions as unknown as Question[],
  MED: medData.questions as unknown as Question[],
};

/** Return all questions for a given section. Returns [] for unknown sectionIds. */
export function getQuestionsForSection(sectionId: string): Question[] {
  return QUESTIONS_BY_SECTION[sectionId] ?? [];
}

/**
 * Shuffle a copy of the array using Fisher-Yates and return it.
 * The original array is not mutated.
 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
