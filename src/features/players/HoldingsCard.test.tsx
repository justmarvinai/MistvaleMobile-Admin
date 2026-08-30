import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HoldingsCard } from './HoldingsCard';
import { renderWithProviders } from '@/test/render';

/**
 * The holdings drill-ins.
 *
 * Two rules are worth pinning and neither is visible in the markup. The tabs must fetch
 * **lazily** — a page opened to answer "is this account banned" should not pull a thousand
 * relics on the way — and the card must offer **nothing to press that changes anything**,
 * because every change to what an account holds already exists as a grant that lands in
 * `economy_log`, and a control here would be the one mutation in the suite with no ledger.
 */

function stubFetch(): { url: string; method: string }[] {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, method: init?.method ?? 'GET' });
      const body = href.includes('/champions')
        ? {
            total: 1,
            champions: [
              {
                id: 'c1',
                championKey: 'aureleth',
                level: 60,
                rank: 6,
                ascension: 6,
                awakening: 2,
                xp: 0,
                locked: true,
                favourite: false,
                relicsWorn: 6,
                masteries: 15,
                createdAt: '2026-08-01T00:00:00.000Z',
              },
            ],
          }
        : href.includes('/gear')
          ? {
              total: 1,
              relics: [
                {
                  id: 'g1',
                  setKey: 'hawkeye',
                  slot: 'weapon',
                  rank: 6,
                  rarity: 'legendary',
                  level: 16,
                  mainStat: 'atk 200',
                  substats: ['critRate% 12'],
                  equippedChampionId: null,
                  locked: false,
                  createdAt: '2026-08-01T00:00:00.000Z',
                },
              ],
            }
          : {
              total: 1,
              pulls: [
                {
                  id: 's1',
                  poolKey: 'radiant',
                  championKey: 'aureleth',
                  rarity: 'legendary',
                  fromMercy: true,
                  contentRev: 30,
                  createdAt: '2026-08-20T00:00:00.000Z',
                },
              ],
            };
      return new Response(JSON.stringify({ ok: true, rev: 1, data: body }), {
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

describe('HoldingsCard', () => {
  it('fetches only the tab that is open', async () => {
    // Two mechanisms hold this and either alone is sufficient — `keepMounted={false}` never
    // mounts a closed panel, and `enabled` refuses the query if one is mounted anyway — so
    // this fails only when *both* go. That is the honest thing to guard: the behaviour
    // rather than one of the two ways it is achieved.
    const calls = stubFetch();
    renderWithProviders(<HoldingsCard playerId="p1" />);

    await waitFor(() => expect(screen.getByText('aureleth')).toBeInTheDocument());
    expect(calls.filter((call) => call.url.includes('/gear'))).toHaveLength(0);
    expect(calls.filter((call) => call.url.includes('/summons'))).toHaveLength(0);

    await userEvent.click(screen.getByRole('tab', { name: 'Relics' }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('/gear'))).toBe(true));
    expect(calls.filter((call) => call.url.includes('/summons'))).toHaveLength(0);
  });

  it('narrows the vault to loose or worn through the query rather than in the browser', async () => {
    const calls = stubFetch();
    renderWithProviders(<HoldingsCard playerId="p1" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Relics' }));
    await waitFor(() => expect(screen.getByText('hawkeye')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('radio', { name: 'Loose' }));
    await waitFor(() =>
      expect(calls.some((call) => call.url.includes('equipped=false'))).toBe(true),
    );
  });

  it('says a pull came from mercy, which is what the support question turns on', async () => {
    stubFetch();
    renderWithProviders(<HoldingsCard playerId="p1" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Pulls' }));

    expect(await screen.findByText('mercy')).toBeInTheDocument();
  });

  it('offers nothing that writes', async () => {
    // Deliberately structural: the rule is that this card has no mutation at all, so the
    // guard is that there is no button on it beyond the tabs and the segmented filter.
    const calls = stubFetch();
    renderWithProviders(<HoldingsCard playerId="p1" />);
    await waitFor(() => expect(screen.getByText('aureleth')).toBeInTheDocument());

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
  });
});
