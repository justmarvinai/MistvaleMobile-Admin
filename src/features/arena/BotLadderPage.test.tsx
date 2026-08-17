import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { ArenaBotCensus } from '@/api/types';
import { BotLadderPage } from './BotLadderPage';
import { renderWithProviders } from '@/test/render';

/**
 * The bot ladder page.
 *
 * The ladder's own behaviour — how bands are filled, what a refresh rebuilds, who gets
 * shed when a band is thinned — is pinned against a real database in the game repo's
 * `bots.test.ts` (26 cases). What is under test here is the screen: that it reports the
 * ladder honestly, that a short band is visibly short, and that the two buttons hit the
 * two endpoints and nothing else.
 *
 * The page links to Players and to the game-config editor, which needs a router that the
 * shared render helper deliberately does not provide. Mocked to a plain anchor: the
 * destinations are checked by the router's own types, not by this test.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const census: ArenaBotCensus = {
  total: 57,
  refreshedAt: '2026-08-17T04:00:00.000Z',
  bands: [
    { band: 'bronze', wanted: 24, present: 21, ratingMin: 400, ratingMax: 1150 },
    { band: 'silver', wanted: 20, present: 20, ratingMin: 1200, ratingMax: 1950 },
    { band: 'gold', wanted: 12, present: 12, ratingMin: 2000, ratingMax: 2950 },
    { band: 'platinum', wanted: 4, present: 4, ratingMin: 3000, ratingMax: 3400 },
  ],
};

/** Answers the census read, and records what the buttons send. */
function stubFetch(): { url: string; method: string }[] {
  const calls: { url: string; method: string }[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url: String(url), method });

    const data =
      method === 'GET'
        ? census
        : {
            census,
            report: { created: 3, refreshed: 0, removed: 0, byBand: { bronze: 24 } },
          };

    return new Response(JSON.stringify({ ok: true, rev: 1, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

describe('the bot ladder page', () => {
  it('reports the ladder band by band', async () => {
    stubFetch();
    renderWithProviders(<BotLadderPage />);

    expect(await screen.findByText('57 bots standing')).toBeInTheDocument();
    expect(screen.getByText('Bronze')).toBeInTheDocument();
    expect(screen.getByText('Platinum')).toBeInTheDocument();

    // A short band reads as short rather than as a number the operator has to compare.
    expect(screen.getByText('21 / 24')).toBeInTheDocument();
    expect(screen.getByText('20 / 20')).toBeInTheDocument();
    expect(screen.getByText('400–1150')).toBeInTheDocument();
  });

  it('says so when the ladder has never been built', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            rev: 1,
            data: { ...census, total: 0, refreshedAt: null },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<BotLadderPage />);

    expect(await screen.findByText('0 bots standing')).toBeInTheDocument();
    expect(screen.getByText(/never been built/i)).toBeInTheDocument();
  });

  it('fills the ladder through the seed endpoint and reports what it did', async () => {
    const calls = stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<BotLadderPage />);

    await user.click(await screen.findByRole('button', { name: /fill to strength/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.endsWith('/arena/bots/seed'))).toBe(true);
    });
    expect(calls.find((call) => call.url.endsWith('/arena/bots/seed'))?.method).toBe('POST');
    expect(await screen.findByText(/3 created/)).toBeInTheDocument();
  });

  it('rebuilds through the refresh endpoint, not the seed one', async () => {
    const calls = stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<BotLadderPage />);

    await user.click(await screen.findByRole('button', { name: /rebuild now/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.endsWith('/arena/bots/refresh'))).toBe(true);
    });
    expect(calls.some((call) => call.url.endsWith('/arena/bots/seed'))).toBe(false);
  });

  it('surfaces a failed run rather than swallowing it', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify({ ok: true, rev: 1, data: census }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          ok: false,
          rev: 1,
          error: { code: 'CONTENT_STALE', message: 'No champions are published.' },
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<BotLadderPage />);

    await user.click(await screen.findByRole('button', { name: /fill to strength/i }));

    expect(await screen.findByText(/no champions are published/i)).toBeInTheDocument();
  });

  it('points at the config editor rather than duplicating the band settings', async () => {
    stubFetch();
    renderWithProviders(<BotLadderPage />);

    // Content is data: a second place to change a band's size is a second place for it
    // to be wrong.
    expect(await screen.findByText('arena.botBands')).toBeInTheDocument();
    expect(screen.getByText('game config')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
