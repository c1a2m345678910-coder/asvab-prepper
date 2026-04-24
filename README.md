# ASVAB Prep

Adaptive ASVAB study app — master every section, ace the AFQT.

Built with Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, Zustand v5, and Zod.

## Features

- **Adaptive AFQT Diagnostic** — 30-question IRT-based test that projects your percentile score
- **Spaced Repetition (SM-2)** — wrong answers generate review cards; due cards surface daily
- **9 ASVAB Sections** — GS, AR, WK, PC, MK, EI, AS, MC, AO with section-specific question types
- **Offline PWA** — installable, cache-first shell, works without internet
- **Dark mode** — system, light, or dark; no flash of wrong theme
- **Onboarding** — study goal selection (AFQT only / Full ASVAB / Specific MOS)
- **Mistake-positive** — no lives or penalties; wrong answers add to SRS queue with explanation

## Setup

```bash
npm install
cp .env.local.example .env.local   # add your Google Gemini API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Generating Question Banks

The generation script calls the Google Gemini API to build question banks for each section.

**Prerequisites:** `GEMINI_API_KEY` set in `.env.local`.

```bash
# Generate 50 Word Knowledge questions
npm run generate -- wk 50

# Generate 30 Arithmetic Reasoning questions
npm run generate -- ar 30

# Generate 20 questions for every section (bash)
for section in gs ar wk pc mk ei as mc ao; do
  npm run generate -- $section 20
done
```

Section codes: `gs` `ar` `wk` `pc` `mk` `ei` `as` `mc` `ao`

Questions are appended to `src/data/questions/<section>.json`. Duplicates are skipped by SHA-256 hash of the question text.

## Importing Official Questions (CSV)

A CSV import stub is provided for future use with publicly released DoD practice questions:

```bash
npm run import-questions -- path/to/questions.csv
```

Update `COLUMN_MAP` in `scripts/importDodQuestions.ts` to match your CSV column names.

## Type-checking

```bash
npx tsc --noEmit
```

## Production Build

```bash
npm run build
npm run start
```

## Deploy to Vercel

1. Push to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Add environment variable: `GEMINI_API_KEY` (only needed for the generation script — not required for the deployed app at runtime)
4. Deploy

The app is a static-first PWA. No server-side secrets are needed at runtime.

## Project Structure

```
src/
├── app/
│   ├── (routes)/           # Route group — shared root layout, excluded from URLs
│   ├── diagnostic/         # 30-question adaptive AFQT diagnostic
│   ├── lesson/[sectionId]/ # Section practice + SRS review mode
│   ├── review/             # Cross-section SRS review queue
│   ├── settings/           # Theme, data export, reset
│   ├── icon.tsx            # PWA icon (512×512, navy/gold)
│   ├── apple-icon.tsx      # Apple touch icon (180×180)
│   ├── manifest.ts         # Web app manifest
│   └── layout.tsx          # Root layout with theme script + PwaSetup
├── components/
│   ├── ErrorBoundary.tsx   # React class error boundary
│   ├── OnboardingModal.tsx # First-visit study goal selection
│   ├── PwaSetup.tsx        # SW registration + dark mode sync
│   └── questions/          # QuestionRenderer + type-specific cards
├── data/questions/         # JSON question banks (one file per section)
├── lib/
│   ├── afqtProjection.ts   # IRT Rasch model + percentile projection
│   ├── diagnostic.ts       # Adaptive question selector (CAT staircase)
│   ├── questions.ts        # Question loader (JSON → typed)
│   ├── questionSelector.ts # Session + SRS review selection
│   ├── schemas.ts          # Zod validation schemas
│   ├── sections.ts         # Section metadata
│   └── srs.ts              # SM-2 spaced repetition algorithm
├── store/
│   ├── prefsStore.ts       # Theme + study goal preferences (persisted)
│   ├── progressStore.ts    # Attempts, mastery, SRS cards, XP (persisted)
│   └── sessionStore.ts     # Active lesson session (in-memory)
└── types/
    └── asvab.ts            # Core domain types
scripts/
├── generateQuestions.ts    # Google Gemini API question generator
└── importDodQuestions.ts   # CSV import stub
public/
└── sw.js                   # Service worker (cache-first shell)
```

## Question Schema

Each `src/data/questions/<section>.json` holds an array of questions:

```json
{
  "sectionId": "WK",
  "questions": [
    {
      "id": "WK-001",
      "type": "vocab",
      "sectionId": "WK",
      "difficulty": 3,
      "word": "ephemeral",
      "definition": "Lasting for a very short time",
      "options": ["Lasting for a very short time", "Extremely large", "Difficult to understand", "Happening by chance"],
      "correctIndex": 0,
      "explanation": "Ephemeral comes from Greek 'ephemeros' (lasting a day). Something ephemeral is fleeting or transitory."
    }
  ]
}
```

Difficulty is 1–5 (1 = easiest, 5 = hardest). Question types: `mcq`, `vocab`, `passage`, `diagram`.
