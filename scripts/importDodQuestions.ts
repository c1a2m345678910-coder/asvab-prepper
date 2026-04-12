/**
 * importDodQuestions.ts
 *
 * Imports public-domain DoD / official ASVAB practice questions from a CSV
 * file, validates them against the Question schema, and appends them to the
 * appropriate section JSON files.
 *
 * Usage:
 *   npx tsx scripts/importDodQuestions.ts [path/to/questions.csv]
 *
 * CSV format expected (adjust COLUMN_MAP below to match your actual CSV):
 *
 *   section,difficulty,type,question_or_word,option_a,option_b,option_c,option_d,
 *   correct_letter,explanation,passage,definition
 *
 * Column notes:
 *   section       — two-letter ASVAB section code (GS, AR, WK, PC, MK, EI, AS, MC, AO)
 *   difficulty    — integer 1–5
 *   type          — mcq | vocab | passage | diagram
 *   question_or_word — question stem (for mcq/passage/diagram) OR target word (for vocab)
 *   option_a–d    — four answer choices
 *   correct_letter — A, B, C, or D
 *   explanation   — explanation text
 *   passage       — reading passage (PC only; empty for other types)
 *   definition    — correct definition (WK only; must equal the correct option)
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import * as crypto from 'node:crypto';
import { config as loadDotenv } from 'dotenv';
import {
  AnyQuestionSchema,
  QuestionFileSchema,
  type AnyQuestion,
} from '../src/lib/schemas.ts';

// ── Bootstrap ──────────────────────────────────────────────────────────────

loadDotenv({ path: path.join(process.cwd(), '.env.local') });

const PROJECT_ROOT = process.cwd();
const QUESTIONS_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'questions');

// TODO: Set this to your CSV file path, or pass it as a CLI argument.
const DEFAULT_CSV_PATH = path.join(PROJECT_ROOT, 'TODO_path_to_dod_questions.csv');

const VALID_SECTION_IDS = new Set(['GS', 'AR', 'WK', 'PC', 'MK', 'EI', 'AS', 'MC', 'AO']);

// ── Column mapping ─────────────────────────────────────────────────────────
// Adjust these names to match your actual CSV header row.

const COLUMN_MAP = {
  section:        'section',         // TODO: update to match CSV column name
  difficulty:     'difficulty',      // TODO: update to match CSV column name
  type:           'type',            // TODO: update to match CSV column name
  questionOrWord: 'question_or_word',// TODO: update to match CSV column name
  optionA:        'option_a',        // TODO: update to match CSV column name
  optionB:        'option_b',        // TODO: update to match CSV column name
  optionC:        'option_c',        // TODO: update to match CSV column name
  optionD:        'option_d',        // TODO: update to match CSV column name
  correctLetter:  'correct_letter',  // TODO: update to match CSV column name — A/B/C/D
  explanation:    'explanation',     // TODO: update to match CSV column name
  passage:        'passage',         // TODO: update to match CSV column name (PC only)
  definition:     'definition',      // TODO: update to match CSV column name (WK only)
} as const;

// ── CSV parsing ────────────────────────────────────────────────────────────

/**
 * Parse a single CSV line into an array of field values.
 * Handles double-quoted fields with embedded commas and escaped quotes ("").
 * Does NOT handle multi-line quoted fields (newlines inside quotes).
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        // Escaped double-quote inside a quoted field
        current += '"';
        i++; // skip the second quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Read the entire CSV file into an array of row objects keyed by header name. */
async function readCSV(filePath: string): Promise<Array<Record<string, string>>> {
  const fileStream = fs.createReadStream(filePath, 'utf-8');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers: string[] = [];
  const rows: Array<Record<string, string>> = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = parseCSVLine(line).map((h) => h.toLowerCase().trim());
      continue;
    }
    if (!line.trim()) continue; // skip blank lines

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

// ── Row → Question mapping ─────────────────────────────────────────────────

const LETTER_TO_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

/**
 * Convert a CSV row to a raw question object.
 *
 * TODO: Adjust the field mappings below to match the actual CSV structure
 * once the DoD CSV file is available. The current mappings assume the
 * column names defined in COLUMN_MAP above.
 */
function rowToQuestion(row: Record<string, string>, rowNum: number): Record<string, unknown> {
  const section = row[COLUMN_MAP.section]?.toUpperCase().trim();
  const typeRaw = row[COLUMN_MAP.type]?.toLowerCase().trim();
  const correctLetter = row[COLUMN_MAP.correctLetter]?.toUpperCase().trim();
  const correctIndex = LETTER_TO_INDEX[correctLetter] ?? -1;
  const difficultyRaw = parseInt(row[COLUMN_MAP.difficulty] ?? '', 10);

  const options = [
    row[COLUMN_MAP.optionA] ?? '',
    row[COLUMN_MAP.optionB] ?? '',
    row[COLUMN_MAP.optionC] ?? '',
    row[COLUMN_MAP.optionD] ?? '',
  ];

  const base = {
    // id will be assigned programmatically after validation
    sectionId: section,
    difficulty: difficultyRaw,
    options,
    correctIndex,
    explanation: row[COLUMN_MAP.explanation] ?? '',
  };

  // TODO: Extend the type-specific fields below once the CSV structure is known.
  switch (typeRaw) {
    case 'vocab':
      return {
        ...base,
        type: 'vocab',
        word: row[COLUMN_MAP.questionOrWord] ?? '',
        definition: row[COLUMN_MAP.definition] ?? options[correctIndex] ?? '',
      };

    case 'passage':
      return {
        ...base,
        type: 'passage',
        passage: row[COLUMN_MAP.passage] ?? '',
        question: row[COLUMN_MAP.questionOrWord] ?? '',
      };

    case 'diagram':
      return {
        ...base,
        type: 'diagram',
        // TODO: Determine how diagramUrl maps from the CSV (a filename, URL, or asset ID?).
        diagramUrl: row['diagram_url'] ?? '/diagrams/placeholder.png',
        altText: row['alt_text'] ?? 'Diagram',
        question: row[COLUMN_MAP.questionOrWord] ?? '',
      };

    case 'mcq':
    default:
      return {
        ...base,
        type: 'mcq',
        question: row[COLUMN_MAP.questionOrWord] ?? '',
      };
  }
}

// ── Deduplication ──────────────────────────────────────────────────────────

function questionKey(q: AnyQuestion): string {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  switch (q.type) {
    case 'vocab':    return normalize(q.word);
    case 'passage':  return normalize(`${q.passage}\u0000${q.question}`);
    case 'mcq':
    case 'diagram':  return normalize(q.question);
  }
}

function questionHash(q: AnyQuestion): string {
  return crypto.createHash('sha256').update(questionKey(q)).digest('hex');
}

// ── File I/O ───────────────────────────────────────────────────────────────

function readQuestionFile(sectionId: string): AnyQuestion[] {
  const filePath = path.join(QUESTIONS_DIR, `${sectionId.toLowerCase()}.json`);
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const result = QuestionFileSchema.safeParse(raw);
  return result.success ? result.data.questions : [];
}

function writeQuestionFile(sectionId: string, questions: AnyQuestion[]): void {
  const filePath = path.join(QUESTIONS_DIR, `${sectionId.toLowerCase()}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  fs.writeFileSync(filePath, JSON.stringify({ ...existing, questions }, null, 2) + '\n', 'utf-8');
}

function nextId(sectionId: string, existing: AnyQuestion[], offset: number): string {
  const pattern = new RegExp(`^${sectionId}-(\\d+)$`);
  let maxNum = 0;
  for (const q of existing) {
    if (q.id) {
      const m = q.id.match(pattern);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
  }
  return `${sectionId}-${String(maxNum + offset + 1).padStart(3, '0')}`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const csvPath = process.argv[2] ?? DEFAULT_CSV_PATH;

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    console.error('Usage: npx tsx scripts/importDodQuestions.ts [path/to/questions.csv]');
    console.error('TODO: Update DEFAULT_CSV_PATH in this file or pass the path as an argument.');
    process.exit(1);
  }

  console.log(`\n📥 Importing DoD questions from: ${csvPath}`);

  const rows = await readCSV(csvPath);
  console.log(`   Parsed ${rows.length} CSV rows`);

  // Group rows by section for efficient file I/O
  const bySection = new Map<string, Array<Record<string, string>>>();
  for (const row of rows) {
    const section = row[COLUMN_MAP.section]?.toUpperCase().trim();
    if (!section || !VALID_SECTION_IDS.has(section)) continue;
    if (!bySection.has(section)) bySection.set(section, []);
    bySection.get(section)!.push(row);
  }

  let totalAdded = 0;
  let totalDupes = 0;
  let totalErrors = 0;

  for (const [sectionId, sectionRows] of bySection) {
    console.log(`\n── ${sectionId} (${sectionRows.length} rows) ──`);

    const existing = readQuestionFile(sectionId);
    const hashes = new Set(existing.map(questionHash));
    const allQuestions = [...existing];
    let sectionAdded = 0;

    for (let i = 0; i < sectionRows.length; i++) {
      const raw = rowToQuestion(sectionRows[i], i + 2); // +2 for 1-based + header

      const result = AnyQuestionSchema.safeParse({ ...raw, id: 'TEMP' });
      if (!result.success) {
        totalErrors++;
        const issues = result.error.issues
          .slice(0, 2)
          .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
          .join('; ');
        console.warn(`  [!] Row ${i + 2} invalid: ${issues}`);
        continue;
      }

      const q = result.data;
      const h = questionHash(q);
      if (hashes.has(h)) {
        totalDupes++;
        continue;
      }

      // Assign real ID. Cast through unknown: spreading a discriminated union
      // type is not supported by tsc, but is safe here since we are only
      // adding a new `id` field to an already-validated question object.
      const withId = Object.assign(
        {} as AnyQuestion,
        q,
        { id: nextId(sectionId, allQuestions, sectionAdded) },
      ) as AnyQuestion;

      hashes.add(h);
      allQuestions.push(withId);
      sectionAdded++;
    }

    if (sectionAdded > 0) {
      writeQuestionFile(sectionId, allQuestions);
      console.log(`  ✓ Added ${sectionAdded} questions`);
    } else {
      console.log(`  No new questions to add.`);
    }

    totalAdded += sectionAdded;
  }

  console.log(`
╔══════════════════════════════════════════════╗
  Import complete
  Added:      ${totalAdded} questions
  Duplicates: ${totalDupes} skipped
  Errors:     ${totalErrors} invalid rows
╚══════════════════════════════════════════════╝
`);
}

main().catch((err) => {
  console.error('\nFatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
