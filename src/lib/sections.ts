import type { Section } from '@/types/asvab';

/**
 * Canonical ordered list of all nine ASVAB sections.
 *
 * AFQT sections (counted toward the Armed Forces Qualifying Test score):
 *   Arithmetic Reasoning (AR), Word Knowledge (WK),
 *   Paragraph Comprehension (PC), Math Knowledge (MK).
 */
export const SECTIONS: Section[] = [
  {
    id: 'GS',
    name: 'General Science',
    abbrev: 'GS',
    isAFQT: false,
    description: 'Tests knowledge of life science, earth science, and physical science concepts.',
    iconEmoji: '🔬',
  },
  {
    id: 'AR',
    name: 'Arithmetic Reasoning',
    abbrev: 'AR',
    isAFQT: true,
    description: 'Tests ability to solve basic arithmetic word problems.',
    iconEmoji: '🧮',
  },
  {
    id: 'WK',
    name: 'Word Knowledge',
    abbrev: 'WK',
    isAFQT: true,
    description: 'Tests ability to understand the meaning of words through synonyms and context.',
    iconEmoji: '📖',
  },
  {
    id: 'PC',
    name: 'Paragraph Comprehension',
    abbrev: 'PC',
    isAFQT: true,
    description: 'Tests ability to obtain information from written passages.',
    iconEmoji: '📝',
  },
  {
    id: 'MK',
    name: 'Math Knowledge',
    abbrev: 'MK',
    isAFQT: true,
    description: 'Tests knowledge of mathematical concepts and applications.',
    iconEmoji: '📐',
  },
  {
    id: 'EI',
    name: 'Electronics Information',
    abbrev: 'EI',
    isAFQT: false,
    description: 'Tests knowledge of electrical current, circuits, devices, and systems.',
    iconEmoji: '⚡',
  },
  {
    id: 'AS',
    name: 'Auto & Shop Information',
    abbrev: 'AS',
    isAFQT: false,
    description: 'Tests knowledge of automobile technology and shop terminology and practices.',
    iconEmoji: '🔧',
  },
  {
    id: 'MC',
    name: 'Mechanical Comprehension',
    abbrev: 'MC',
    isAFQT: false,
    description: 'Tests knowledge of mechanical and physical principles and ability to visualize how they work.',
    iconEmoji: '⚙️',
  },
  {
    id: 'AO',
    name: 'Assembling Objects',
    abbrev: 'AO',
    isAFQT: false,
    description: 'Tests ability to determine how an object will look when its parts are put together.',
    iconEmoji: '🧩',
  },
  {
    id: 'MED',
    name: 'Medical Sciences',
    abbrev: 'MED',
    isAFQT: false,
    description: 'Anatomy, physiology, biology, and medical terminology targeting the Skilled Technical (ST) score required for Combat Medic (68W) and medical MOS qualification.',
    iconEmoji: '🩺',
  },
];

/** O(1) lookup map by section id (e.g. SECTION_MAP['GS']) */
export const SECTION_MAP: Readonly<Record<string, Section>> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s])
);

/** The four AFQT sections in standard order: AR, WK, PC, MK */
export const AFQT_SECTIONS: Section[] = SECTIONS.filter((s) => s.isAFQT);
