/**
 * generateQuestions.ts
 *
 * Generates ASVAB practice questions via the Anthropic API and appends them
 * to the appropriate JSON data file.
 *
 * Usage:
 *   npx tsx scripts/generateQuestions.ts <sectionId> [count]
 *
 * Examples:
 *   npx tsx scripts/generateQuestions.ts wk 50    # 50 Word Knowledge questions
 *   npx tsx scripts/generateQuestions.ts ar 30    # 30 Arithmetic Reasoning questions
 *   npx tsx scripts/generateQuestions.ts gs       # default 20 General Science questions
 *
 * Environment:
 *   Set ANTHROPIC_API_KEY in .env.local (or export it before running).
 *
 * Output:
 *   Appends validated, deduplicated questions to src/data/questions/{id}.json.
 *   Existing questions are never modified or removed.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import {
  AnyQuestionRawSchema,
  QuestionFileSchema,
  type AnyQuestionRaw,
  type AnyQuestion,
} from '../src/lib/schemas.ts';

// ── Bootstrap ──────────────────────────────────────────────────────────────

// Load .env.local from project root before anything else
loadDotenv({ path: path.join(process.cwd(), '.env.local') });

const PROJECT_ROOT = process.cwd();
const QUESTIONS_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'questions');

// ── Constants ──────────────────────────────────────────────────────────────

const MODEL = 'gemini-3-flash-preview';
const MAX_TOKENS = 8000;
/** Questions requested per API call. Smaller = more focused, more API calls. */
const BATCH_SIZE = 15;
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 3000;

const VALID_SECTION_IDS = ['GS', 'AR', 'WK', 'PC', 'MK', 'EI', 'AS', 'MC', 'AO'] as const;
type SectionId = (typeof VALID_SECTION_IDS)[number];

// ── Section metadata ───────────────────────────────────────────────────────

interface SectionConfig {
  name: string;
  questionType: 'mcq' | 'vocab' | 'passage';
  topics: string;
  styleGuide: string;
  difficultyGuide: string;
  exampleSchema: string;
}

const SECTION_CONFIGS: Record<SectionId, SectionConfig> = {
  GS: {
    name: 'General Science',
    questionType: 'mcq',
    topics: `
- Biology: cell structure and function, genetics/heredity, ecosystems, human body systems
  (circulatory, respiratory, digestive, nervous, immune), photosynthesis, evolution
- Chemistry: elements, compounds, mixtures, chemical reactions, acids/bases, periodic table,
  states of matter, atomic structure
- Earth science: rock cycle, weather and climate, atmosphere layers, plate tectonics, water cycle
- Physics: Newton's laws, energy (kinetic/potential/thermal), waves, electricity, magnetism,
  simple machines, light and optics`.trim(),
    styleGuide: `
- Each question tests one specific concept.
- Distractors must be plausible but clearly wrong upon reflection.
- Avoid questions about lab safety, equipment, or procedures.
- Use correct scientific terminology (metric units, IUPAC names).
- Questions may include brief data (a number, formula, or unit) in the stem.`.trim(),
    difficultyGuide: `
1 — Basic definitions and facts (e.g., "What gas do plants absorb during photosynthesis?")
2 — Slightly less common facts or simple application
3 — Requires understanding a concept, not just recalling a fact
4 — Application to a novel scenario; some multi-step reasoning
5 — Less-common science facts or complex cause-effect reasoning`.trim(),
    exampleSchema: `{"type":"mcq","sectionId":"GS","difficulty":2,"question":"Which organelle is responsible for producing ATP through cellular respiration?","options":["Nucleus","Ribosome","Mitochondrion","Golgi apparatus"],"correctIndex":2,"explanation":"The mitochondrion is called the 'powerhouse of the cell' because it converts glucose and oxygen into ATP through cellular respiration. The nucleus stores DNA, ribosomes make proteins, and the Golgi apparatus packages and ships proteins."}`,
  },

  AR: {
    name: 'Arithmetic Reasoning',
    questionType: 'mcq',
    topics: `
- Whole number operations (multi-step)
- Fractions, decimals, percentages (including percent increase/decrease)
- Ratios and proportions
- Rates: speed/distance/time, work rates, unit conversions
- Basic geometry: area, perimeter, volume of common shapes
- Simple interest and basic financial math
- Reading and interpreting tables or short data descriptions`.trim(),
    styleGuide: `
- Write WORD PROBLEMS set in realistic contexts: military logistics, everyday tasks,
  construction, cooking, travel, finances.
- Every problem must have exactly one defensible correct numerical answer.
- Explanation must show the full arithmetic step-by-step (no skipped steps).
- Answer choices for the same question must differ significantly to avoid guessing by elimination.
- Do NOT include problems about gambling, weapons, or violence.
- Include units in answer choices (e.g., "24 miles" not "24").`.trim(),
    difficultyGuide: `
1 — Single-step arithmetic with whole numbers
2 — Two-step problem or simple fraction/decimal work
3 — Multi-step problem with percentages, ratios, or rates
4 — Requires setting up an equation or working with mixed units
5 — Multi-step problem combining several concepts; may require back-solving`.trim(),
    exampleSchema: `{"type":"mcq","sectionId":"AR","difficulty":3,"question":"A supply truck travels 240 miles on 12 gallons of fuel. At this rate, how many gallons are needed to travel 400 miles?","options":["16 gallons","18 gallons","20 gallons","24 gallons"],"correctIndex":2,"explanation":"Step 1 — Find miles per gallon: 240 ÷ 12 = 20 mpg.\\nStep 2 — Find gallons for 400 miles: 400 ÷ 20 = 20 gallons."}`,
  },

  WK: {
    name: 'Word Knowledge',
    questionType: 'vocab',
    topics: `
Target vocabulary drawn from published ASVAB word lists:
- Tier 1 (difficulty 1–2): vivid, agile, hostile, benign, conceal, tedious, persist, vague
- Tier 2 (difficulty 3): audacious, benevolent, candid, diligent, fervent, indolent, lament,
  meticulous, obstinate, prudent, resolute, skeptical, steadfast, tenacious, verbose
- Tier 3 (difficulty 4): acrimonious, altruistic, ambivalent, assiduous, circumspect,
  conspicuous, dissemble, ephemeral, equivocal, facetious, ignoble, loquacious, magnanimous,
  obsequious, perspicacious, pugnacious, recalcitrant, truculent, vociferous
- Tier 4 (difficulty 5): acerbic, alacrity, ameliorate, anathema, apocryphal, capricious,
  decorous, diffident, dilettante, elucidate, enervate, garrulous, hapless, inimical,
  obstreperous, pellucid, querulous, sanguinary, venerate, vituperate`.trim(),
    styleGuide: `
- Present the word in ALL CAPS (e.g., "CIRCUMSPECT most nearly means:").
- The "definition" field and options[correctIndex] must contain the SAME text.
- Three distractors must be plausible look-alike or sound-alike meanings — NOT random words.
  Good distractors exploit common prefix/suffix confusions or related-but-wrong concepts.
- Some questions may use the sentence-context format:
  "The recruiter spoke in a CIRCUMSPECT manner, choosing each word carefully."
  "In this sentence, CIRCUMSPECT most nearly means:"
- Do NOT use the same word twice across a batch.`.trim(),
    difficultyGuide: `
1 — Common everyday words (happy, large, quick, angry, calm)
2 — Familiar academic words (analyze, vivid, hostile, persist, subtle)
3 — Above-average vocabulary (tenacious, prudent, diligent, meticulous, fervent)
4 — Advanced vocabulary (magnanimous, circumspect, perspicacious, loquacious)
5 — Rare or highly formal vocabulary (garrulous, obstreperous, sanguinary, truculent)`.trim(),
    exampleSchema: `{"type":"vocab","sectionId":"WK","difficulty":4,"word":"MAGNANIMOUS","definition":"generously forgiving or showing noble generosity","options":["extremely angry and vengeful","generously forgiving or showing noble generosity","stubbornly refusing to change","excessively talkative and loud"],"correctIndex":1,"explanation":"MAGNANIMOUS comes from Latin 'magnus' (great) + 'animus' (spirit). It describes someone who is noble-minded and forgiving, especially toward rivals. A magnanimous leader pardons a defeated enemy rather than punishing them. Contrast with 'vindictive' (vengeful) or 'obstinate' (stubborn)."}`,
  },

  PC: {
    name: 'Paragraph Comprehension',
    questionType: 'passage',
    topics: `
Passages should cover informational, neutral topics only:
- Science and nature (biology, geology, astronomy, environment)
- History (U.S., military history, world history — no controversial politics)
- Geography and culture
- Technology and engineering concepts
- Health and medicine (general)
- Economics and civics (neutral, factual)`.trim(),
    styleGuide: `
- Passage length: 80–200 words. Write at 9th–12th grade reading level.
- ONE passage per question. The passage and question are tightly paired.
- Question types (vary across the batch):
    1. Main idea: "What is the main idea of this passage?"
    2. Detail recall: "According to the passage, ..."
    3. Inference: "Based on the passage, it can be inferred that ..."
    4. Vocabulary in context: "As used in the passage, '...' most nearly means ..."
    5. Author's purpose: "The author's primary purpose in this passage is to ..."
- Avoid passages that require outside knowledge to answer the question.
- All four answer choices must be plausibly derived from the passage text.
- Difficulty reflects both passage complexity AND question inference depth.`.trim(),
    difficultyGuide: `
1 — Short, simple passage; detail-recall question with explicit answer in text
2 — Simple passage; main-idea or easy inference question
3 — Moderate passage; inference or vocabulary-in-context question
4 — Denser passage with complex sentence structure; deeper inference required
5 — Abstract or technical passage; nuanced author-purpose or inference question`.trim(),
    exampleSchema: `{"type":"passage","sectionId":"PC","difficulty":3,"passage":"The human body contains approximately 37 trillion cells, yet all of them originate from a single fertilized egg. Through a process called differentiation, cells acquire specialized functions—muscle cells contract, neurons transmit signals, and red blood cells transport oxygen. Despite having identical DNA, cells express different genes depending on chemical signals from neighboring cells and the environment, allowing a single genome to produce hundreds of distinct cell types.","question":"According to the passage, what determines which genes a cell expresses?","options":["The age of the organism","Chemical signals from neighboring cells and the environment","Random mutations in the DNA","The cell's physical location in the body"],"correctIndex":1,"explanation":"The passage states directly that 'cells express different genes depending on chemical signals from neighboring cells and the environment.' While physical location plays an indirect role, the passage specifically cites chemical signals as the determining factor."}`,
  },

  MK: {
    name: 'Math Knowledge',
    questionType: 'mcq',
    topics: `
- Number theory: factors, multiples, prime numbers, GCD, LCM
- Fractions, decimals, percentages, and their conversions
- Exponents and roots (including negative and fractional exponents)
- Algebraic expressions: simplifying, factoring, expanding
- Equations and inequalities (linear, systems of 2 equations, basic quadratic)
- Polynomials: operations, factoring (difference of squares, trinomials)
- Geometry: angles, triangles (including Pythagorean theorem), quadrilaterals, circles
  (area, circumference, arc length, sectors), coordinate geometry
- Properties: commutative, associative, distributive laws
- Sequences and patterns`.trim(),
    styleGuide: `
- Questions test mathematical KNOWLEDGE and SKILL, not word-problem reasoning (that's AR).
- Use proper mathematical notation in plain text: x^2, sqrt(x), |x|, x/y.
- Explanation must show complete algebraic work step-by-step.
- All four answer choices must be numerically distinct and plausible.
  Include common wrong answers (sign errors, forgetting to simplify, etc.).
- Geometry questions may include a brief description of the figure.`.trim(),
    difficultyGuide: `
1 — Basic arithmetic operations, simple fractions, area of a rectangle
2 — Evaluating simple expressions, solving one-step equations, basic exponents
3 — Factoring quadratics, solving systems, Pythagorean theorem, circle geometry
4 — Working with complex fractions, quadratic formula, coordinate geometry
5 — Combining multiple concepts; less-common identities or theorems`.trim(),
    exampleSchema: `{"type":"mcq","sectionId":"MK","difficulty":3,"question":"Factor completely: x² - 5x - 14","options":["(x - 7)(x + 2)","(x + 7)(x - 2)","(x - 14)(x + 1)","(x - 7)(x - 2)"],"correctIndex":0,"explanation":"We need two numbers that multiply to -14 and add to -5.\\nTest: (-7) × (+2) = -14 ✓ and (-7) + (+2) = -5 ✓.\\nSo x² - 5x - 14 = (x - 7)(x + 2).\\nVerify: (x-7)(x+2) = x² + 2x - 7x - 14 = x² - 5x - 14 ✓"}`,
  },

  EI: {
    name: 'Electronics Information',
    questionType: 'mcq',
    topics: `
- Fundamentals: voltage, current, resistance, power; Ohm's Law (V=IR)
- Series and parallel circuits: total resistance, voltage drops, current flow
- Electronic components: resistors, capacitors, inductors, diodes, transistors
- Semiconductors: P-type, N-type, PN junctions, basic transistor operation
- Magnetism and electromagnetism: magnetic fields, solenoids, transformers
- Measurements: multimeter use, reading schematics, oscilloscope basics
- Safety: grounding, overcurrent protection, fuses vs. circuit breakers
- AC vs. DC current: frequency, RMS voltage, phase
- Basic digital electronics: binary, logic gates (AND, OR, NOT, NAND)`.trim(),
    styleGuide: `
- Use real component values to make calculations concrete (e.g., "A 12 Ω resistor…").
- Avoid questions requiring oscilloscope readings without a diagram.
- Schematic-symbol questions should describe the symbol in words.
- Calculation explanations must show the formula used, substitution, and result.`.trim(),
    difficultyGuide: `
1 — Definitions (what is voltage? what does a diode do?)
2 — Applying Ohm's Law directly; single-step calculation
3 — Series or parallel circuit analysis; multi-step calculation
4 — Combining Ohm's Law with power equations; AC concepts
5 — Multi-component circuit analysis; semiconductor physics`.trim(),
    exampleSchema: `{"type":"mcq","sectionId":"EI","difficulty":2,"question":"A circuit has a 9-volt battery and a single 3-ohm resistor. What is the current flowing through the circuit?","options":["0.33 amperes","3 amperes","27 amperes","12 amperes"],"correctIndex":1,"explanation":"Using Ohm's Law: I = V / R = 9 V / 3 Ω = 3 amperes. Remember: V = IR, so I = V/R."}`,
  },

  AS: {
    name: 'Auto & Shop Information',
    questionType: 'mcq',
    topics: `
Automotive:
- Engine: four-stroke cycle (intake, compression, power, exhaust), ignition system,
  fuel system, cooling system, lubrication system, exhaust/emissions
- Drivetrain: transmission (manual/automatic), differential, driveshaft, axles
- Electrical: battery, alternator, starter motor, wiring
- Brakes: disc vs. drum brakes, ABS, hydraulic principles
- Steering and suspension: ball joints, struts, shock absorbers, tie rods
- Tires and wheels: reading tire codes, balancing, alignment

Shop tools and practices:
- Hand tools: wrench types (open-end, box, socket, torque), screwdrivers,
  pliers, hammers, measuring tools (calipers, micrometers)
- Power tools: drill press, band saw, grinder, air compressor
- Fasteners: bolt grades, thread pitch, screw types
- Measuring: reading a ruler to 1/32", using a micrometer
- Safety: PPE, material handling, hazardous materials`.trim(),
    styleGuide: `
- Use correct trade terminology throughout.
- Avoid brand-specific questions.
- Questions may ask about purpose, identification, or troubleshooting.
- Troubleshooting questions must have a single most-likely cause.`.trim(),
    difficultyGuide: `
1 — Basic tool identification or common car part names
2 — Function of a specific engine component or shop tool
3 — Troubleshooting a symptom; understanding a system interaction
4 — Detailed mechanical knowledge; less-common components
5 — Multi-system interaction; trade-level technical knowledge`.trim(),
    exampleSchema: `{"type":"mcq","sectionId":"AS","difficulty":2,"question":"What is the primary purpose of a vehicle's alternator?","options":["To start the engine when the ignition key is turned","To recharge the battery and power electrical systems while the engine runs","To regulate fuel pressure in the fuel injection system","To cool the engine by circulating coolant"],"correctIndex":1,"explanation":"The alternator is a generator driven by the engine's serpentine belt. It converts mechanical energy into AC electricity, which is then rectified to DC to recharge the battery and power all electrical components while the engine is running. The starter motor handles engine cranking; the fuel pump handles fuel pressure; the water pump handles coolant circulation."}`,
  },

  MC: {
    name: 'Mechanical Comprehension',
    questionType: 'mcq',
    topics: `
- Simple machines: levers (classes 1/2/3), pulleys, wheels and axles, inclined planes,
  screws, wedges — mechanical advantage calculations
- Gears: gear ratios, direction of rotation, speed vs. torque trade-off
- Springs: Hooke's Law (F = kx), spring compression/extension
- Hydraulics and pneumatics: Pascal's principle, pressure = F/A
- Structural forces: tension, compression, shear, torsion; load distribution
- Motion and Newton's laws: inertia, F=ma, action/reaction in mechanical systems
- Fluid dynamics (basic): buoyancy, flow rate, Bernoulli's principle (conceptual)
- Thermodynamics (basic): heat transfer methods, expansion`.trim(),
    styleGuide: `
- Describe any apparatus in the question stem — these are text-only MCQ questions.
- Calculate mechanical advantage, force, or distance as needed.
- Explanation must identify the principle and show the calculation.
- Avoid questions that would require a diagram to be answerable.`.trim(),
    difficultyGuide: `
1 — Basic definition of a simple machine or force concept
2 — Identifying which class of lever or applying a basic formula
3 — Mechanical advantage calculation with a simple machine
4 — Multi-machine system or combined principle application
5 — Complex mechanical system analysis or less-common principle`.trim(),
    exampleSchema: `{"type":"mcq","sectionId":"MC","difficulty":3,"question":"A first-class lever has its fulcrum 2 feet from the load and 6 feet from the effort force. If the load weighs 120 pounds, how much effort force is required to lift it?","options":["20 pounds","40 pounds","60 pounds","360 pounds"],"correctIndex":1,"explanation":"Mechanical Advantage (MA) = effort arm / load arm = 6 ft / 2 ft = 3.\\nEffort = Load / MA = 120 lb / 3 = 40 pounds.\\nA longer effort arm gives greater mechanical advantage, meaning less force is needed."}`,
  },

  AO: {
    name: 'Assembling Objects',
    questionType: 'mcq', // AO ideally uses diagrams; text-only questions are limited
    topics: `
NOTE: Assembling Objects questions genuinely require visual diagrams (spatial reasoning
about how 2D shapes fit together). Text-only questions can approximate this by describing
spatial relationships verbally, but they cannot fully replicate the ASVAB AO format.

For text-based AO questions, test:
- Identifying which described shape fits into a described space
- Determining how many pieces of a described shape fill a described container
- Spatial relationships: rotation, reflection, translation of simple shapes
- Identifying the cross-section of a described 3D shape`.trim(),
    styleGuide: `
- Describe shapes precisely using geometric terms (equilateral triangle, rectangle with
  dimensions 3×5, right angle, etc.).
- Make the spatial reasoning clear and unambiguous from the text alone.
- Acknowledge in explanations that on the real ASVAB, diagrams are provided.`.trim(),
    difficultyGuide: `
1 — Very simple spatial relationship with 2 pieces
2 — 3-piece assembly with clear description
3 — Rotation or reflection of a shape
4 — Multi-step spatial reasoning
5 — Complex 3D visualization from description`.trim(),
    exampleSchema: `{"type":"mcq","sectionId":"AO","difficulty":2,"question":"A right triangle has legs of 3 inches and 4 inches. Two identical copies of this triangle are placed together along their longest sides (hypotenuses). What shape is formed?","options":["A square","A rectangle","A larger right triangle","A parallelogram"],"correctIndex":1,"explanation":"The hypotenuse of a 3-4-5 right triangle has length 5 inches. When two identical right triangles are joined along their hypotenuses with one flipped, the result is a rectangle with dimensions 3×4 inches (the two legs become the sides). Note: on the actual ASVAB, this question would include a diagram."}`,
  },
};

// ── Prompt builder ─────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an expert ASVAB test-prep content writer with deep knowledge of the official ASVAB exam format, difficulty levels, and content guidelines published by the Department of Defense.

ABSOLUTE RULES — violating any of these will cause the output to be discarded:
1. Output ONLY a valid JSON array. No markdown fences, no prose, no commentary before or after.
2. Every question must have exactly 4 answer choices in the "options" array.
3. "difficulty" must be an integer 1, 2, 3, 4, or 5.
4. "correctIndex" must be 0, 1, 2, or 3. Triple-check all arithmetic and facts before setting this.
5. Vary "correctIndex" across questions — do not cluster correct answers at index 0 or 1.
6. "explanation" must be genuinely educational (minimum 40 words), not a restatement of the answer.
7. NEVER include trivia questions, pop culture references, brand names, political content,
   gambling, or questions about weapons, violence, or drugs.
8. All arithmetic in AR/MK explanations MUST be shown step-by-step with no skipped work.
9. Difficulty distribution: generate roughly equal numbers at each difficulty level (1–5).
10. Do NOT repeat question stems, words (for WK), or passages (for PC) within a batch.`;
}

function buildUserPrompt(
  config: SectionConfig,
  sectionId: string,
  batchSize: number,
  existingTexts: Set<string>,
): string {
  const avoidList =
    existingTexts.size > 0 && existingTexts.size <= 30
      ? `\nALREADY USED (do NOT generate these):\n${[...existingTexts]
          .slice(0, 30)
          .map((t) => `  - "${t}"`)
          .join('\n')}`
      : existingTexts.size > 0
      ? `\nNote: ${existingTexts.size} questions already exist — generate completely new ones.`
      : '';

  return `Generate exactly ${batchSize} ${config.name} (${sectionId}) questions.

SECTION TOPICS:
${config.topics}

STYLE REQUIREMENTS:
${config.styleGuide}

DIFFICULTY GUIDE:
${config.difficultyGuide}
${avoidList}

REQUIRED JSON SCHEMA for each question (omit the "id" field — it will be assigned automatically):
${config.exampleSchema}

Return a JSON array of exactly ${batchSize} objects matching the schema above, with sectionId="${sectionId}".
Aim for approximately ${Math.ceil(batchSize / 5)} questions at each difficulty level (1–5).
Output ONLY the JSON array — no other text.`;
}

// ── ID assignment ──────────────────────────────────────────────────────────

function assignIds(
  questions: AnyQuestionRaw[],
  sectionId: string,
  existingQuestions: AnyQuestion[],
): AnyQuestion[] {
  const pattern = new RegExp(`^${sectionId}-(\\d+)$`);
  let maxNum = 0;
  for (const q of existingQuestions) {
    if (q.id) {
      const m = q.id.match(pattern);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
  }

  return questions.map((q, i) => ({
    ...q,
    id: `${sectionId}-${String(maxNum + i + 1).padStart(3, '0')}`,
  })) as AnyQuestion[];
}

// ── Deduplication ──────────────────────────────────────────────────────────

function questionKey(q: AnyQuestionRaw | AnyQuestion): string {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  switch (q.type) {
    case 'vocab':
      return normalize(q.word);
    case 'passage':
      // Hash both passage and question together to allow the same passage with
      // a different question
      return normalize(`${q.passage}\u0000${q.question}`);
    case 'mcq':
    case 'diagram':
      return normalize(q.question);
  }
}

function questionHash(q: AnyQuestionRaw | AnyQuestion): string {
  return crypto.createHash('sha256').update(questionKey(q)).digest('hex');
}

function buildHashSet(questions: AnyQuestion[]): Set<string> {
  return new Set(questions.map(questionHash));
}

// ── File I/O ───────────────────────────────────────────────────────────────

function readQuestionFile(sectionId: string): AnyQuestion[] {
  const filePath = path.join(QUESTIONS_DIR, `${sectionId.toLowerCase()}.json`);
  if (!fs.existsSync(filePath)) return [];

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const result = QuestionFileSchema.safeParse(raw);
  if (!result.success) {
    console.warn(`  Warning: existing ${sectionId} file has validation issues — starting fresh.`);
    console.warn(result.error.issues.slice(0, 3).map((e) => `    ${e.path.join('.')}: ${e.message}`).join('\n'));
    return [];
  }
  return result.data.questions;
}

function writeQuestionFile(sectionId: string, questions: AnyQuestion[]): void {
  const filePath = path.join(QUESTIONS_DIR, `${sectionId.toLowerCase()}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  const updated = { ...existing, questions };
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
}

// ── API call ───────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(
  genAI: GoogleGenerativeAI,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  if (!text || !text.trim()) throw new Error('Empty response from Gemini');
  return text;
}

// ── JSON extraction and validation ─────────────────────────────────────────

function extractJsonArray(raw: string): unknown[] {
  // Primary: the string should already be a JSON array (via prefill).
  // Fallback: extract from a markdown code fence if the model wrapped it anyway.
  let text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  if (!text.startsWith('[')) {
    const arrayStart = text.indexOf('[');
    if (arrayStart !== -1) text = text.slice(arrayStart);
  }

  return JSON.parse(text) as unknown[];
}

function validateBatch(
  rawItems: unknown[],
  sectionId: string,
): { valid: AnyQuestionRaw[]; errors: number } {
  const valid: AnyQuestionRaw[] = [];
  let errors = 0;

  for (let i = 0; i < rawItems.length; i++) {
    const result = AnyQuestionRawSchema.safeParse(rawItems[i]);
    if (!result.success) {
      errors++;
      const issues = result.error.issues
        .slice(0, 3)
        .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
        .join('; ');
      console.warn(`  [!] Item ${i + 1} invalid: ${issues}`);
      continue;
    }
    // Enforce sectionId matches (model occasionally outputs wrong section)
    if (result.data.sectionId !== sectionId) {
      console.warn(`  [!] Item ${i + 1} has wrong sectionId "${result.data.sectionId}" — fixed.`);
      // Coerce rather than discard
      (result.data as Record<string, unknown>).sectionId = sectionId;
    }
    valid.push(result.data);
  }

  return { valid, errors };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Parse arguments ──────────────────────────────────────────────────────
  const rawSection = process.argv[2];
  const rawCount = process.argv[3] ?? '20';

  if (!rawSection) {
    console.error('Usage: npx tsx scripts/generateQuestions.ts <sectionId> [count]');
    console.error(`Valid sections: ${VALID_SECTION_IDS.join(', ')}`);
    process.exit(1);
  }

  const sectionId = rawSection.toUpperCase() as SectionId;
  if (!VALID_SECTION_IDS.includes(sectionId)) {
    console.error(`Unknown section "${sectionId}". Valid: ${VALID_SECTION_IDS.join(', ')}`);
    process.exit(1);
  }

  const targetCount = parseInt(rawCount, 10);
  if (isNaN(targetCount) || targetCount < 1 || targetCount > 500) {
    console.error(`Count must be an integer between 1 and 500. Got: "${rawCount}"`);
    process.exit(1);
  }

  // ── Validate API key ─────────────────────────────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set.');
    console.error('Add it to .env.local (in the project root) or export it in your shell.');
    process.exit(1);
  }

  const config = SECTION_CONFIGS[sectionId];
  console.log(`\n🎯 Generating ${targetCount} ${config.name} (${sectionId}) questions`);
  console.log(`   Model: ${MODEL} (Gemini) | Batch size: ${BATCH_SIZE}`);

  // ── Load existing questions ───────────────────────────────────────────────
  const existing = readQuestionFile(sectionId);
  console.log(`   Existing questions: ${existing.length}`);

  const hashes = buildHashSet(existing);

  // Build short-text set for inclusion in the prompt (avoidList)
  const existingTexts = new Set(existing.map(questionKey));

  // ── Generate in batches ───────────────────────────────────────────────────
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const system = buildSystemPrompt();

  let allNew: AnyQuestion[] = [...existing]; // running total for ID assignment
  let totalAdded = 0;
  let totalDupes = 0;
  let totalErrors = 0;

  const batches = Math.ceil(targetCount / BATCH_SIZE);

  for (let batch = 1; batch <= batches; batch++) {
    const remaining = targetCount - totalAdded;
    if (remaining <= 0) break;
    const batchSize = Math.min(BATCH_SIZE, remaining);

    console.log(`\n── Batch ${batch}/${batches} (requesting ${batchSize} questions) ──`);

    const userPrompt = buildUserPrompt(config, sectionId, batchSize, existingTexts);

    let rawText = '';
    let attempt = 0;

    while (attempt < RETRY_ATTEMPTS) {
      attempt++;
      try {
        rawText = await callGemini(genAI, system, userPrompt);
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  API error (attempt ${attempt}/${RETRY_ATTEMPTS}): ${msg}`);
        if (attempt < RETRY_ATTEMPTS) {
          console.warn(`  Retrying in ${RETRY_DELAY_MS / 1000}s…`);
          await sleep(RETRY_DELAY_MS * attempt);
        } else {
          console.error(`  Skipping batch ${batch} after ${RETRY_ATTEMPTS} failed attempts.`);
          continue;
        }
      }
    }

    if (!rawText) continue;

    // Parse JSON
    let rawItems: unknown[];
    try {
      rawItems = extractJsonArray(rawText);
    } catch (parseErr) {
      console.error(`  JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      console.error(`  Raw response (first 400 chars):\n  ${rawText.slice(0, 400)}`);
      continue;
    }

    console.log(`  Parsed ${rawItems.length} items`);

    // Validate
    const { valid, errors } = validateBatch(rawItems, sectionId);
    totalErrors += errors;
    console.log(`  Valid: ${valid.length} | Rejected (schema): ${errors}`);

    // Deduplicate
    const newUnique: AnyQuestionRaw[] = [];
    for (const q of valid) {
      const h = questionHash(q);
      if (hashes.has(h)) {
        totalDupes++;
        continue;
      }
      hashes.add(h);
      existingTexts.add(questionKey(q));
      newUnique.push(q);
    }

    if (newUnique.length < valid.length) {
      console.log(`  Duplicates skipped: ${valid.length - newUnique.length}`);
    }

    // Assign IDs and append
    if (newUnique.length > 0) {
      const withIds = assignIds(newUnique, sectionId, allNew);
      allNew = [...allNew, ...withIds];
      writeQuestionFile(sectionId, allNew);
      totalAdded += withIds.length;
      console.log(`  ✓ Added ${withIds.length} questions (IDs ${withIds[0].id} – ${withIds[withIds.length - 1].id})`);
    }

    // Brief pause between batches to respect rate limits
    if (batch < batches && totalAdded < targetCount) {
      await sleep(1000);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════╗
  ${sectionId} generation complete
  Added:      ${totalAdded} new questions
  Duplicates: ${totalDupes} skipped
  Errors:     ${totalErrors} invalid (schema failures)
  Total in file: ${allNew.length} questions
╚══════════════════════════════════════════════╝
`);
}

main().catch((err) => {
  console.error('\nFatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
