'use client';

import { useState } from 'react';
import { useProgressStore } from '@/store/progressStore';

// ── Section metadata ────────────────────────────────────────────────────────

const AFQT_SET = new Set(['WK', 'AR', 'PC', 'MK']);

/** Baseline question targets per section. */
const TARGETS: Record<string, number> = {
  WK: 20, AR: 20, PC: 20, MK: 20,
  GS: 10, EI: 10, AS: 10, MC: 10, AO: 10,
  MED: 35,
};

const SECTION_LABELS: Record<string, string> = {
  WK: 'Word Knowledge',
  AR: 'Arithmetic Reasoning',
  PC: 'Paragraph Comp.',
  MK: 'Math Knowledge',
  GS: 'General Science',
  EI: 'Electronics Info',
  AS: 'Auto & Shop',
  MC: 'Mechanical Comp.',
  AO: 'Assembling Objects',
  MED: 'Medical Sciences',
};

// ── Types ───────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'no_key' | 'error' | 'picking' | 'generating' | 'done';

interface SectionRow {
  id: string;
  current: number;
  target: number;
  neededByPlan: number;
  selected: boolean;
  runState: 'pending' | 'running' | 'done' | 'error';
  addedCount: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildRows(
  counts: Record<string, number>,
  mastery: Record<string, number>,
): SectionRow[] {
  return Object.keys(TARGETS).map((id) => {
    const current = counts[id] ?? 0;
    const base = TARGETS[id];
    const m = mastery[id] ?? 0;
    const struggling = m > 0 && m < 0.6;
    const target = base + (struggling ? 5 : 0);
    const needed = Math.max(0, target - current);
    return {
      id,
      current,
      target,
      neededByPlan: needed,
      selected: needed > 0, // pre-select only sections that need more
      runState: 'pending',
      addedCount: 0,
    };
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function QuestionBankManager() {
  const masteryBySection = useProgressStore((s) => s.masteryBySection);

  const [status, setStatus] = useState<Status>('idle');
  const [sectionRows, setSectionRows] = useState<SectionRow[]>([]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function loadAndPick() {
    setStatus('loading');
    try {
      const res = await fetch('/api/generate');
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        counts: Record<string, number>;
        hasApiKey: boolean;
      };
      if (!data.hasApiKey) {
        setStatus('no_key');
        return;
      }
      setSectionRows(buildRows(data.counts, masteryBySection));
      setStatus('picking');
    } catch {
      setStatus('error');
    }
  }

  function toggleSection(id: string) {
    setSectionRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)),
    );
  }

  function selectAll() {
    setSectionRows((prev) => prev.map((r) => ({ ...r, selected: true })));
  }

  function selectAfqt() {
    setSectionRows((prev) =>
      prev.map((r) => ({ ...r, selected: AFQT_SET.has(r.id) })),
    );
  }

  function selectBelowTarget() {
    setSectionRows((prev) =>
      prev.map((r) => ({ ...r, selected: r.neededByPlan > 0 })),
    );
  }

  async function generate() {
    const selectedRows = sectionRows.filter((r) => r.selected && r.neededByPlan > 0);
    if (!selectedRows.length) return;

    setSectionRows((prev) =>
      prev.map((r) =>
        r.selected && r.neededByPlan > 0
          ? { ...r, runState: 'pending', addedCount: 0 }
          : r,
      ),
    );
    setStatus('generating');

    const plan = selectedRows.map((r) => ({ sectionId: r.id, count: r.neededByPlan }));

    let res: Response;
    try {
      res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
    } catch {
      setStatus('done');
      return;
    }

    if (!res.body) {
      setStatus('done');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const frames = buf.split('\n\n');
      buf = frames.pop() ?? '';

      for (const frame of frames) {
        if (!frame.startsWith('data: ')) continue;
        try {
          processEvent(JSON.parse(frame.slice(6)));
        } catch {
          // malformed frame — skip
        }
      }
    }

    setStatus('done');
  }

  function processEvent(e: {
    type: string;
    sectionId?: string;
    message?: string;
    success?: boolean;
    counts?: Record<string, number>;
  }) {
    switch (e.type) {
      case 'start':
        if (e.sectionId) {
          setSectionRows((prev) =>
            prev.map((r) => (r.id === e.sectionId ? { ...r, runState: 'running' } : r)),
          );
        }
        break;

      case 'log': {
        if (!e.sectionId || !e.message) break;
        const match = e.message.match(/✓ Added (\d+) questions/);
        if (match) {
          const n = parseInt(match[1], 10);
          setSectionRows((prev) =>
            prev.map((r) =>
              r.id === e.sectionId ? { ...r, addedCount: r.addedCount + n } : r,
            ),
          );
        }
        break;
      }

      case 'section_done':
        if (e.sectionId) {
          setSectionRows((prev) =>
            prev.map((r) =>
              r.id === e.sectionId
                ? { ...r, runState: e.success ? 'done' : 'error' }
                : r,
            ),
          );
        }
        break;

      case 'complete':
        if (e.counts) {
          setSectionRows((prev) =>
            prev.map((r) => ({
              ...r,
              current: e.counts![r.id] ?? r.current,
            })),
          );
        }
        break;
    }
  }

  function restart() {
    setSectionRows([]);
    setStatus('idle');
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeSectionRows = sectionRows.filter((r) => r.selected && r.neededByPlan > 0);
  const totalSections = activeSectionRows.length;
  const doneSections = activeSectionRows.filter(
    (r) => r.runState === 'done' || r.runState === 'error',
  ).length;
  const pct = totalSections > 0 ? (doneSections / totalSections) * 100 : 0;
  const totalAdded = sectionRows.reduce((s, r) => s + r.addedCount, 0);
  const selectedNeeded = sectionRows
    .filter((r) => r.selected && r.neededByPlan > 0)
    .reduce((s, r) => s + r.neededByPlan, 0);

  // ── Render: idle ───────────────────────────────────────────────────────────

  if (status === 'idle') {
    return (
      <button
        onClick={loadAndPick}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-3 text-sm">
          <span>✨</span>
          <span className="text-slate-700 dark:text-slate-200">Generate Questions</span>
        </span>
        <span className="text-slate-400 text-sm">→</span>
      </button>
    );
  }

  // ── Render: loading ────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="px-4 py-3.5 flex items-center gap-2 text-sm text-slate-400">
        <span className="inline-block animate-spin">↻</span>
        Checking question bank…
      </div>
    );
  }

  // ── Render: no API key ─────────────────────────────────────────────────────

  if (status === 'no_key') {
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-3">
          <span className="text-lg leading-none mt-0.5 shrink-0">🔑</span>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Gemini API key not set
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
              Add{' '}
              <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded">
                GEMINI_API_KEY=…
              </code>{' '}
              to{' '}
              <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded">
                .env.local
              </code>{' '}
              in the project root, then restart the dev server.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">
              Get a free key at{' '}
              <span className="font-mono">aistudio.google.com/app/apikey</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setStatus('idle')}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── Render: fetch error ────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3">
          <span className="text-lg leading-none mt-0.5 shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              Could not reach the generate API
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-relaxed">
              Make sure the dev server is running and try again.
            </p>
          </div>
        </div>
        <button
          onClick={() => setStatus('idle')}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          ← Try again
        </button>
      </div>
    );
  }

  // ── Render: section picker ─────────────────────────────────────────────────

  if (status === 'picking') {
    return (
      <div className="py-2">
        {/* Quick preset buttons */}
        <div className="flex gap-2 px-4 mb-1">
          <button
            onClick={selectBelowTarget}
            className="flex-1 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition-colors active:bg-indigo-100"
          >
            Needs more
          </button>
          <button
            onClick={selectAfqt}
            className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors active:bg-slate-200 dark:active:bg-slate-700"
          >
            AFQT only
          </button>
          <button
            onClick={selectAll}
            className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors active:bg-slate-200 dark:active:bg-slate-700"
          >
            All
          </button>
        </div>

        {/* Section rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {sectionRows.map((row) => {
            const barPct = Math.min(100, (row.current / row.target) * 100);
            const full = row.current >= row.target;
            return (
              <label
                key={row.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors select-none"
              >
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() => toggleSection(row.id)}
                  className="w-4 h-4 rounded accent-indigo-600 shrink-0 cursor-pointer"
                />
                <span
                  className={[
                    'w-8 text-xs font-bold shrink-0',
                    AFQT_SET.has(row.id)
                      ? 'text-indigo-500 dark:text-indigo-400'
                      : 'text-slate-500 dark:text-slate-400',
                  ].join(' ')}
                >
                  {row.id}
                </span>
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={[
                      'h-full rounded-full transition-all duration-500',
                      full ? 'bg-green-500' : 'bg-indigo-500',
                    ].join(' ')}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums w-12 text-right shrink-0">
                  {row.current}/{row.target}
                </span>
                <span className="w-8 text-right shrink-0">
                  {row.neededByPlan > 0 && row.selected ? (
                    <span className="text-xs text-amber-500 font-semibold">
                      +{row.neededByPlan}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

        {/* CTA */}
        <div className="px-4 pt-3 pb-1 space-y-2">
          {selectedNeeded > 0 ? (
            <button
              onClick={generate}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-[0.98] transition-transform"
            >
              Generate {selectedNeeded} questions →
            </button>
          ) : (
            <p className="text-xs text-green-500 text-center py-2 font-semibold">
              ✓ Selected sections are fully stocked
            </p>
          )}
          <button
            onClick={() => setStatus('idle')}
            className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-1"
          >
            ← Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Render: generating ─────────────────────────────────────────────────────

  if (status === 'generating') {
    return (
      <div className="py-2">
        {/* Overall progress bar */}
        <div className="px-4 pt-2 pb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Generating…</span>
            <span>{doneSections}/{totalSections} sections</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Per-section status rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {activeSectionRows.map((row) => (
            <div key={row.id} className="flex items-center gap-2.5 px-4 py-2.5">
              <span
                className={[
                  'w-8 text-xs font-bold shrink-0',
                  AFQT_SET.has(row.id)
                    ? 'text-indigo-500 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
              >
                {row.id}
              </span>
              <span className="flex-1 text-xs text-slate-400 dark:text-slate-500 truncate">
                {row.runState === 'done'
                  ? row.addedCount > 0
                    ? `+${row.addedCount} added`
                    : 'already full'
                  : row.runState === 'error'
                  ? 'error'
                  : row.runState === 'running'
                  ? SECTION_LABELS[row.id]
                  : '—'}
              </span>
              <span className="w-5 text-right shrink-0">
                {row.runState === 'running' && (
                  <span className="inline-block animate-spin text-indigo-400 text-sm">↻</span>
                )}
                {row.runState === 'done' && (
                  <span className="text-green-500 text-sm">✓</span>
                )}
                {row.runState === 'error' && (
                  <span className="text-red-400 text-sm">✗</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render: done ───────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-4 space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2.5 pb-1">
        <span className="text-green-500 text-base">✓</span>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {totalAdded > 0 ? `Added ${totalAdded} questions` : 'Generation complete'}
        </p>
      </div>

      {/* Per-section breakdown */}
      <div className="space-y-1.5">
        {activeSectionRows.map((row) => (
          <div key={row.id} className="flex items-center gap-2 text-xs">
            <span
              className={[
                'w-8 font-bold shrink-0',
                AFQT_SET.has(row.id)
                  ? 'text-indigo-500 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400',
              ].join(' ')}
            >
              {row.id}
            </span>
            <span
              className={
                row.runState === 'error'
                  ? 'text-red-400'
                  : row.addedCount > 0
                  ? 'text-green-500 font-semibold'
                  : 'text-slate-400 dark:text-slate-500'
              }
            >
              {row.runState === 'error'
                ? 'error'
                : row.addedCount > 0
                ? `+${row.addedCount}`
                : 'no changes'}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <button
        onClick={() => window.location.reload()}
        className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-[0.98] transition-transform"
      >
        Reload to study new questions →
      </button>
      <button
        onClick={restart}
        className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-1"
      >
        Generate more
      </button>
    </div>
  );
}
