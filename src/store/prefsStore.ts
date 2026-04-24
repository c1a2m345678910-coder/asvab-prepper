'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
export type StudyGoal = 'afqt' | 'full' | 'mos';
export type SessionLength = 5 | 10 | 20;

// ── MOS data ───────────────────────────────────────────────────────────────

export interface MosOption {
  id: string;
  name: string;
  /** ASVAB section IDs most relevant to this MOS / line score. */
  sections: string[];
}

export const MOS_LIST: MosOption[] = [
  { id: '11B', name: 'Infantry',                  sections: ['WK', 'AR', 'PC', 'MK'] },
  { id: '12B', name: 'Combat Engineer',            sections: ['AR', 'MK', 'GS', 'MC'] },
  { id: '15T', name: 'UH-60 Helicopter Repairer',  sections: ['AR', 'MK', 'EI', 'AS', 'MC'] },
  { id: '25B', name: 'IT Specialist',              sections: ['AR', 'MK', 'EI', 'GS'] },
  { id: '25U', name: 'Signal Support Specialist',  sections: ['AR', 'MK', 'EI', 'GS'] },
  { id: '35F', name: 'Intelligence Analyst',       sections: ['WK', 'AR', 'PC', 'MK', 'GS'] },
  { id: '68W', name: 'Combat Medic (68W)',          sections: ['GS', 'MK', 'EI', 'AS', 'MED'] },
  { id: '91B', name: 'Wheeled Vehicle Mechanic',   sections: ['AR', 'AS', 'MC', 'MK'] },
];

// ── State & Actions ────────────────────────────────────────────────────────

interface PrefsState {
  theme: Theme;
  studyGoal: StudyGoal | null;
  hasSeenOnboarding: boolean;
  /** Questions per practice session. Default 5 for micro-study. */
  sessionLength: SessionLength;
  /** Selected MOS id (e.g. '68W') when studyGoal === 'mos'. Null otherwise. */
  selectedMos: string | null;
}

interface PrefsActions {
  setTheme: (theme: Theme) => void;
  setStudyGoal: (goal: StudyGoal) => void;
  setSelectedMos: (mosId: string | null) => void;
  completeOnboarding: (goal: StudyGoal, mosId?: string) => void;
  resetOnboarding: () => void;
  setSessionLength: (n: SessionLength) => void;
}

export type PrefsStore = PrefsState & PrefsActions;

const initialState: PrefsState = {
  theme: 'system',
  studyGoal: null,
  hasSeenOnboarding: false,
  sessionLength: 5,
  selectedMos: null,
};

export const usePrefsStore = create<PrefsStore>()(
  persist(
    (set) => ({
      ...initialState,

      setTheme: (theme) => set({ theme }),
      setStudyGoal: (goal) => set({ studyGoal: goal }),
      setSelectedMos: (mosId) => set({ selectedMos: mosId }),
      completeOnboarding: (goal, mosId) =>
        set({ studyGoal: goal, hasSeenOnboarding: true, selectedMos: mosId ?? null }),
      resetOnboarding: () =>
        set({ hasSeenOnboarding: false, studyGoal: null, selectedMos: null }),
      setSessionLength: (sessionLength) => set({ sessionLength }),
    }),
    {
      name: 'asvab-prefs',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = persistedState as Record<string, unknown>;
        if (fromVersion < 2) {
          s.selectedMos = null;
        }
        return s;
      },
    },
  ),
);
