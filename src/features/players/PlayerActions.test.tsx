import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminPlayerDetail } from '@/api/types';
import { PlayerActions } from './PlayerActions';
import { renderWithProviders } from '@/test/render';

/**
 * The support desk's guard rails.
 *
 * These actions are the ones an operator cannot take back by clicking again — a reset
 * invalidates a password, a ban signs someone out — so what is pinned here is that none
 * of them fire on a single click, that the two irreversible ones demand the account name
 * typed out, and that a ban cannot be sent without a reason.
 *
 * The network is stubbed: what is under test is the screen's refusal to act, not the
 * server's (which `players.test.ts` in the game repo covers against a real database).
 */

const detail: AdminPlayerDetail = {
  account: {
    id: 'account-1',
    accountName: 'rattle_d',
    rank: 'player',
    status: 'active',
    banReason: null,
    forcePasswordChange: false,
    lastLoginAt: '2026-08-17T08:00:00.000Z',
    createdAt: '2026-01-02T08:00:00.000Z',
  },
  player: {
    id: 'player-1',
    profileName: 'Rattledagger',
    level: 34,
    xp: 1200,
    silver: 250_000,
    crystals: 400,
    valorMedals: 0,
    energy: 60,
    energyCap: 82,
    rosterCapacity: 60,
    isBot: false,
    createdAt: '2026-01-02T08:00:00.000Z',
  },
  holdings: { champions: 22, gear: 143, itemStacks: 9 },
  progress: { stagesCleared: 84, stars: 210, totalClears: 900, deepestFloors: {} },
  sessions: [
    {
      id: 'session-1',
      createdAt: '2026-08-17T07:00:00.000Z',
      lastSeenAt: '2026-08-17T08:00:00.000Z',
      expiresAt: '2026-09-16T07:00:00.000Z',
      ip: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
    },
  ],
  economy: [],
};

/** Captures what the screen would have sent, without sending it. */
function stubFetch() {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        rev: 1,
        data: { temporaryPassword: 'temp-password-xyz', sessionsRevoked: 1 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

describe('player actions', () => {
  it('will not reset a password on a single click', async () => {
    const calls = stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<PlayerActions detail={detail} />);

    await user.click(screen.getByRole('button', { name: /reset password/i }));

    // The dialog is open and nothing has been sent.
    expect(await screen.findByText(/will be signed out everywhere/i)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('unlocks the reset only once the account name is typed exactly', async () => {
    const calls = stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<PlayerActions detail={detail} />);

    await user.click(screen.getByRole('button', { name: /^reset password$/i }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: /reset password/i });
    expect(confirm).toBeDisabled();

    const input = within(dialog).getByRole('textbox');
    await user.type(input, 'rattle_');
    expect(confirm).toBeDisabled();

    await user.type(input, 'd');
    await waitFor(() => expect(confirm).toBeEnabled());

    await user.click(confirm);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toContain('/players/player-1/reset-password');
  });

  it('shows the temporary password once, and only after the reset', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<PlayerActions detail={detail} />);

    expect(screen.queryByText('temp-password-xyz')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^reset password$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'rattle_d');
    await user.click(within(dialog).getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('temp-password-xyz')).toBeInTheDocument();
    expect(screen.getByText(/read this out now/i)).toBeInTheDocument();
  });

  it('keeps the ban button shut until a reason is written', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<PlayerActions detail={detail} />);

    const ban = screen.getByRole('button', { name: /ban account/i });
    expect(ban).toBeDisabled();

    await user.type(screen.getByLabelText(/ban reason/i), 'selling accounts');
    await waitFor(() => expect(ban).toBeEnabled());
  });

  it('offers to lift a ban rather than to ban again', () => {
    stubFetch();
    renderWithProviders(
      <PlayerActions
        detail={{
          ...detail,
          account: { ...detail.account, status: 'banned', banReason: 'selling accounts' },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /lift the ban/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ban account/i })).not.toBeInTheDocument();
  });

  it('refuses a grant with no note and no amount', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<PlayerActions detail={detail} />);

    const grant = screen.getByRole('button', { name: /^grant$/i });
    expect(grant).toBeDisabled();

    // An amount alone is not enough — the audit trail wants a reason.
    await user.clear(screen.getByLabelText(/silver/i));
    await user.type(screen.getByLabelText(/silver/i), '5000');
    expect(grant).toBeDisabled();

    await user.type(screen.getByLabelText(/note/i), 'forge bug compensation');
    await waitFor(() => expect(grant).toBeEnabled());
  });

  it('sends only the amounts that were actually filled in', async () => {
    const calls = stubFetch();
    const user = userEvent.setup();
    renderWithProviders(<PlayerActions detail={detail} />);

    await user.clear(screen.getByLabelText(/silver/i));
    await user.type(screen.getByLabelText(/silver/i), '5000');
    await user.type(screen.getByLabelText(/note/i), 'forge bug compensation');
    await user.click(screen.getByRole('button', { name: /^grant$/i }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body).toEqual({ silver: 5000, note: 'forge bug compensation' });
  });

  it('cannot sign out an account that is not signed in anywhere', () => {
    stubFetch();
    renderWithProviders(<PlayerActions detail={{ ...detail, sessions: [] }} />);
    expect(screen.getByRole('button', { name: /sign out everywhere/i })).toBeDisabled();
  });
});
