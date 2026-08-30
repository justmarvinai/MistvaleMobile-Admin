import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobsPage } from './JobsPage';
import { renderWithProviders } from '@/test/render';

/**
 * Jobs and health.
 *
 * One rule is worth pinning and it is the whole reason the screen is not two bare buttons:
 * a run works across the entire database, so it goes through the typed confirmation — and
 * the phrase is the job's own **name**, not a generic word, so an operator confirming the
 * nightly pass cannot be confirming the weekly one.
 */

const JOBS = [
  { name: 'daily', label: 'Nightly pass', description: 'Prunes old rows.' },
  { name: 'weekly', label: 'Weekly close', description: 'Closes the arena week.' },
];

function stubFetch(): { url: string; method: string }[] {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const href = String(url);
      calls.push({ url: href, method });
      if (method === 'POST') {
        return new Response(
          JSON.stringify({
            ok: true,
            rev: 1,
            data: { job: 'daily', durationMs: 42, result: { pruned: 7 } },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (href.includes('/health')) {
        return new Response(
          JSON.stringify({
            ok: true,
            rev: 1,
            data: {
              status: 'healthy',
              uptimeSeconds: 7200,
              startedAt: '2026-08-30T00:00:00.000Z',
              contentRevision: 30,
              nodeVersion: 'v22.0.0',
              memory: { rssMb: 210, heapUsedMb: 90, heapTotalMb: 140 },
              eventLoop: { meanMs: 1.2, p99Ms: 4.5, maxMs: 9 },
              database: { ok: true, latencyMs: 2, pool: {} },
              activeBattles: 3,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ ok: true, rev: 1, data: { jobs: JOBS } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('JobsPage', () => {
  it('will not run a job until its own name is typed', async () => {
    const calls = stubFetch();
    renderWithProviders(<JobsPage />);

    const rows = await screen.findAllByRole('button', { name: 'Run now' });
    await userEvent.click(rows[0]!);

    const confirm = await screen.findByRole('button', { name: 'Run it' });
    expect(confirm).toBeDisabled();

    // The phrase is the job's *name*, so confirming the nightly pass cannot be confirming
    // the weekly one.
    await userEvent.type(screen.getByRole('textbox'), 'weekly');
    expect(confirm).toBeDisabled();

    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'daily');
    expect(confirm).toBeEnabled();

    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
    await userEvent.click(confirm);

    await waitFor(() =>
      expect(
        calls.some((call) => call.method === 'POST' && call.url.endsWith('/jobs/run/daily')),
      ).toBe(true),
    );
    expect(await screen.findByText(/Took 42 ms/)).toBeInTheDocument();
  });

  it('reads the health numbers rather than an empty card', async () => {
    stubFetch();
    renderWithProviders(<JobsPage />);

    expect(await screen.findByText('2h 0m')).toBeInTheDocument();
    expect(screen.getByText('210 MB')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });
});
