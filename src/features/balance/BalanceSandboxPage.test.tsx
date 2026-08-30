import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { SimulateResult } from '@/api/types';
import { BalanceSandboxPage } from './BalanceSandboxPage';
import { renderWithProviders } from '@/test/render';

/**
 * The balance sandbox.
 *
 * The simulation itself is the game repo's and is pinned twice over there: `packages/sim`
 * is pure, and the CI gates fight every stage in the game with it. What is under test here
 * is the *screen* — that the controls reach the endpoint with what the operator chose, that
 * a result is reported honestly including the awkward case where nothing was won, and that
 * the team behind a number is always shown beside it.
 *
 * The page links to the publish centre, which needs a router the shared render helper
 * deliberately does not provide. Mocked to a plain anchor: destinations are checked by the
 * router's own types rather than by this test.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const RESULT: SimulateResult = {
  stageKey: 'c01_s7_normal',
  stageLabel: 'Veilwood Fringe 1-7',
  source: 'live',
  tier: 'modest',
  team: [
    { championKey: 'anuria', name: 'Anuria', level: 50, rank: 5, ascension: 2 },
    { championKey: 'brannoc', name: 'Brannoc', level: 50, rank: 5, ascension: 2 },
  ],
  runs: 60,
  wins: 45,
  winRate: 0.75,
  averageTurns: 12.4,
  medianTurns: 12,
  starTurnLimit: 16,
  winsWithinStarLimit: 0.7,
  msPerRun: 0.05,
};

interface Sent {
  url: string;
  method: string;
  body: unknown;
}

/** Answers the three content lists, and records what Simulate sends. */
function stubFetch(result: SimulateResult = RESULT): Sent[] {
  const sent: Sent[] = [];
  const lists: Record<string, unknown> = {
    stages: {
      contentType: 'stage',
      items: [
        {
          key: 'c01_s7_normal',
          data: { mode: 'campaign', parentKey: 'chapter_01', number: 7 },
          state: 'live',
          updatedAt: null,
          updatedBy: null,
        },
      ],
    },
    chapters: {
      contentType: 'campaignChapter',
      items: [
        {
          key: 'chapter_01',
          data: { name: 'Veilwood Fringe' },
          state: 'live',
          updatedAt: null,
          updatedBy: null,
        },
      ],
    },
    dungeons: { contentType: 'dungeon', items: [] },
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? 'GET';
      sent.push({
        url: href,
        method,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      });

      const listed = Object.keys(lists).find((path) => href.endsWith(`/content/${path}`));
      const data = listed ? lists[listed] : { result, tiers: ['fresh', 'modest', 'built'] };

      return new Response(JSON.stringify({ ok: true, rev: 1, data }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return sent;
}

/**
 * Mantine's `Select` renders a visible combobox *and* a hidden native input, both carrying
 * the field's label — so `getByLabelText` finds two. The role is the unambiguous handle.
 */
const stagePicker = (): HTMLElement => screen.getByRole('textbox', { name: /^stage$/i });

async function pickTheStage(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await waitFor(() => expect(stagePicker()).toBeInTheDocument());
  await user.click(stagePicker());
  await user.click(await screen.findByRole('option', { name: /veilwood fringe/i }));
}

describe('the balance sandbox', () => {
  it('sends what the operator chose, and nothing they did not', async () => {
    const sent = stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<BalanceSandboxPage />);

    await pickTheStage(user);
    // Draft is the case the endpoint exists for: measure the edit, not what is published.
    await user.click(screen.getByRole('radio', { name: 'Draft' }));
    await user.click(screen.getByRole('radio', { name: 'Built' }));
    await user.click(screen.getByRole('button', { name: /simulate/i }));

    await waitFor(() => {
      const posted = sent.find((call) => call.method === 'POST');
      expect(posted?.url).toContain('/simulate/stage');
      expect(posted?.body).toEqual({
        stageKey: 'c01_s7_normal',
        tier: 'built',
        source: 'draft',
        runs: 60,
      });
    });
  });

  it('reports the run, and the team that produced it', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<BalanceSandboxPage />);

    await pickTheStage(user);
    await user.click(screen.getByRole('button', { name: /simulate/i }));

    expect(await screen.findByText(/won 45 of 60 — 75%/i)).toBeInTheDocument();
    expect(screen.getByText('12.4')).toBeInTheDocument();
    // The three-star limit and the share inside it — usually the figure being asked about.
    expect(screen.getByText(/three-star limit \(16 turns\)/i)).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();

    // A win rate without the team that produced it is a number nobody can act on.
    expect(screen.getByText(/the team that fought it/i)).toBeInTheDocument();
    // Asked for by key rather than by name: the cell holds "Anuria (anuria)", so a match on
    // the name alone finds the cell and the key span both.
    expect(screen.getByText('(anuria)')).toBeInTheDocument();
    expect(screen.getByText('(brannoc)')).toBeInTheDocument();
    expect(screen.getAllByText('★5')).toHaveLength(2);
  });

  it('says nothing was won rather than reporting an average of no numbers', async () => {
    // The awkward case, and the one a screen gets wrong by being reassuring: a stage nobody
    // cleared has no average turn count, and printing `0` would read as "instantly".
    stubFetch({
      ...RESULT,
      wins: 0,
      winRate: 0,
      averageTurns: null,
      medianTurns: null,
      winsWithinStarLimit: 0,
    });
    const user = userEvent.setup();
    renderWithProviders(<BalanceSandboxPage />);

    await pickTheStage(user);
    await user.click(screen.getByRole('button', { name: /simulate/i }));

    expect(await screen.findByText(/won 0 of 60 — 0%/i)).toBeInTheDocument();
    const rows = screen.getAllByText('—');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('will not simulate until a stage is chosen', async () => {
    stubFetch();
    renderWithProviders(<BalanceSandboxPage />);
    await waitFor(() => expect(stagePicker()).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /simulate/i })).toBeDisabled();
  });
});
