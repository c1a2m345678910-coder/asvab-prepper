/**
 * /api/generate
 *
 * GET  — returns current question counts per section (reads JSON files).
 * POST — accepts a generation plan and streams progress as Server-Sent Events
 *        while running `npx tsx scripts/generateQuestions.ts` sequentially.
 *
 * This route is intentionally dev-only: it writes to the local filesystem and
 * spawns child processes, neither of which is appropriate in a production build.
 */

import { spawn } from 'child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const dynamic = 'force-dynamic';

const SECTIONS = ['WK', 'AR', 'PC', 'MK', 'GS', 'EI', 'AS', 'MC', 'AO', 'MED'] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function readCounts(): Record<string, number> {
  const dir = path.join(process.cwd(), 'src', 'data', 'questions');
  const counts: Record<string, number> = {};
  for (const id of SECTIONS) {
    try {
      const raw = fs.readFileSync(path.join(dir, `${id.toLowerCase()}.json`), 'utf-8');
      const data = JSON.parse(raw) as { questions?: unknown[] };
      counts[id] = data.questions?.length ?? 0;
    } catch {
      counts[id] = 0;
    }
  }
  return counts;
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  return Response.json({
    counts: readCounts(),
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
}

// ── POST (SSE stream) ──────────────────────────────────────────────────────

interface PlanItem {
  sectionId: string;
  count: number;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Question generation is not available in production.', {
      status: 403,
    });
  }

  const { plan } = (await request.json()) as { plan: PlanItem[] };

  const encoder = new TextEncoder();

  function sse(data: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const { sectionId, count } of plan) {
          controller.enqueue(sse({ type: 'start', sectionId, count }));

          await new Promise<void>((resolve) => {
            const child = spawn(
              'npx',
              ['tsx', 'scripts/generateQuestions.ts', sectionId, String(count)],
              {
                cwd: process.cwd(),
                // Inherit the full env so GEMINI_API_KEY is available
                env: { ...process.env },
                // shell required on Windows for npx to resolve
                shell: process.platform === 'win32',
              },
            );

            child.stdout.on('data', (chunk: Buffer) => {
              for (const line of chunk.toString().split('\n')) {
                const trimmed = line.trim();
                if (trimmed) {
                  controller.enqueue(sse({ type: 'log', sectionId, message: trimmed }));
                }
              }
            });

            // stderr contains dotenv debug noise — suppress it
            child.stderr.on('data', () => {});

            child.on('error', (err) => {
              controller.enqueue(
                sse({ type: 'log', sectionId, message: `Error: ${err.message}` }),
              );
              controller.enqueue(sse({ type: 'section_done', sectionId, success: false }));
              resolve();
            });

            child.on('close', (code) => {
              controller.enqueue(
                sse({ type: 'section_done', sectionId, success: code === 0 }),
              );
              resolve();
            });
          });
        }

        controller.enqueue(sse({ type: 'complete', counts: readCounts() }));
      } catch (err) {
        controller.enqueue(
          sse({
            type: 'error',
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
