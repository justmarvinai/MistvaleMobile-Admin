import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { TutorialScriptPage } from './TutorialScriptPage';
import { renderWithProviders } from '@/test/render';

/**
 * The script page.
 *
 * The arithmetic is pinned without a DOM in `scriptModel.test.ts`; what is under test here
 * is the screen: that a script reads as a script, that a numbering problem is reported
 * before the publish gate rather than at it, and — the only thing this page can do that
 * the generic browser cannot — that a move writes exactly two entities.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const step = (key: string, number: number, over: Record<string, unknown> = {}) => ({
  key,
  state: 'live' as const,
  updatedAt: null,
  updatedBy: null,
  data: {
    step: number,
    title: `Step ${number}`,
    screen: 'haven',
    highlight: '',
    body: 'Words.',
    rewards: {},
    grantsBefore: {},
    grantsRelics: [],
    active: true,
    ...over,
  },
});

/** Answers the list read, and records every write the page sends. */
function stubFetch(items: ReturnType<typeof step>[]): { url: string; body: unknown }[] {
  const writes: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method !== 'GET') {
        writes.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
        return new Response(JSON.stringify({ ok: true, rev: 1, data: { key: 'x', saved: true } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ ok: true, rev: 1, data: { contentType: 'tutorialStep', items } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }),
  );
  return writes;
}

describe('the tutorial script page', () => {
  it('lays the script out in the order a player walks it', async () => {
    stubFetch([step('tut_c', 3), step('tut_a', 1), step('tut_b', 2)]);
    renderWithProviders(<TutorialScriptPage />);

    await screen.findByText('tut_a');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByText(/^tut_/).textContent)).toEqual([
      'tut_a',
      'tut_b',
      'tut_c',
    ]);
  });

  it('says what each step points at, and admits when it points at nothing', async () => {
    stubFetch([
      step('tut_beat', 1),
      step('tut_stage', 2, {
        screen: 'campaign',
        highlight: 'stage:c01_s1_normal',
        goal: { type: 'stageClear', target: 1, filters: {} },
        rewards: { silver: 4000, playerXp: 90 },
      }),
    ]);
    renderWithProviders(<TutorialScriptPage />);

    expect(await screen.findByText('stage:c01_s1_normal')).toBeInTheDocument();
    expect(screen.getByText('stageClear')).toBeInTheDocument();
    // A beat says so rather than leaving two cells blank.
    expect(screen.getByText(/nothing — a centred beat/)).toBeInTheDocument();
    expect(screen.getByText(/a press of Continue/)).toBeInTheDocument();
  });

  it('reports a gap before the publish gate does', async () => {
    stubFetch([step('tut_a', 1), step('tut_c', 3)]);
    renderWithProviders(<TutorialScriptPage />);

    expect(await screen.findByText(/Step 2 is missing/)).toBeInTheDocument();
  });

  it('reports a duplicate the same way', async () => {
    stubFetch([step('tut_a', 1), step('tut_b', 1)]);
    renderWithProviders(<TutorialScriptPage />);

    expect(await screen.findByText(/appears twice/)).toBeInTheDocument();
  });

  it('moves a step by swapping two numbers, and writes nothing else', async () => {
    const writes = stubFetch([step('tut_a', 1), step('tut_b', 2), step('tut_c', 3)]);
    renderWithProviders(<TutorialScriptPage />);

    await screen.findByText('tut_b');
    await userEvent.click(screen.getByLabelText('Move Step 2 earlier'));

    await waitFor(() => expect(writes).toHaveLength(2));
    // Exactly the two that swapped, each carrying the other's number — and the rest of
    // each entity's data intact, because a reorder must not quietly rewrite a step's words.
    expect(writes.map((write) => write.url.split('/').pop())).toEqual(['tut_b', 'tut_a']);
    expect((writes[0]?.body as { data: { step: number; title: string } }).data).toMatchObject({
      step: 1,
      title: 'Step 2',
    });
    expect((writes[1]?.body as { data: { step: number } }).data.step).toBe(2);
  });

  it('will not move the first step earlier or the last one later', async () => {
    stubFetch([step('tut_a', 1), step('tut_b', 2)]);
    renderWithProviders(<TutorialScriptPage />);

    await screen.findByText('tut_a');
    expect(screen.getByLabelText('Move Step 1 earlier')).toBeDisabled();
    expect(screen.getByLabelText('Move Step 2 later')).toBeDisabled();
  });

  it('says something useful when there is no script at all', async () => {
    stubFetch([]);
    renderWithProviders(<TutorialScriptPage />);

    expect(await screen.findByText(/No steps yet/)).toBeInTheDocument();
  });
});
