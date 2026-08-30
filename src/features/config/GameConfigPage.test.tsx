import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameConfigPage } from './GameConfigPage';
import { renderWithProviders } from '@/test/render';

/**
 * The config editor's control choice.
 *
 * The arithmetic behind a curve is pinned without a DOM in `lib/curve.test.ts`. What is
 * worth asserting here is the one decision this screen makes: which control a value gets.
 * A numeric list is a **shape**, and the reason A3 asked for these tables to be "surfaced"
 * is that sixteen numbers in a JSON textarea hide a mistyped one — so a curve has to be
 * what an operator lands on, not something behind a toggle they have to find.
 */

const entry = (key: string, value: unknown, label: string) => ({
  key,
  state: 'live' as const,
  updatedAt: null,
  updatedBy: null,
  data: { key, label, help: '', group: 'economy', value },
});

function stubFetch(items: ReturnType<typeof entry>[]): { url: string; body: unknown }[] {
  const writes: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? 'GET') !== 'GET') {
        writes.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
        return new Response(JSON.stringify({ ok: true, rev: 1, data: { key: 'x', saved: true } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ ok: true, rev: 1, data: { contentType: 'gameConfig', items } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }),
  );
  return writes;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GameConfigPage', () => {
  it('gives a numeric list a curve rather than a JSON blob', async () => {
    stubFetch([
      entry('economy.gearUpgradeSuccess', { '1': 1, '2': 0.85, '3': 0.71 }, 'Upgrade success'),
    ]);
    renderWithProviders(<GameConfigPage />);

    // One box per point, labelled by its own key — which is also what makes a mistyped
    // number findable.
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Upgrade success 1' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('textbox', { name: 'Upgrade success 3' })).toHaveValue('0.71');
    expect(screen.queryByDisplayValue(/"1": 1/)).not.toBeInTheDocument();
  });

  it('writes one point back without disturbing the others', async () => {
    const writes = stubFetch([entry('economy.gearUpgradeCost', [3000, 6000, 12000], 'Cost')]);
    renderWithProviders(<GameConfigPage />);

    const box = await screen.findByRole('textbox', { name: 'Cost 1' });
    await userEvent.clear(box);
    await userEvent.type(box, '7000');
    await userEvent.click(screen.getByRole('button', { name: /^Save /i }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = writes[0]?.body as { data: { value: number[] } };
    expect(body.data.value).toEqual([3000, 7000, 12000]);
  });

  it('still offers raw JSON, for the edits a curve cannot express', async () => {
    stubFetch([entry('economy.gearUpgradeCost', [3000, 6000], 'Cost')]);
    renderWithProviders(<GameConfigPage />);

    await userEvent.click(await screen.findByText('Edit as JSON'));
    expect(screen.getByDisplayValue(/\[\s*3000,\s*6000\s*\]/)).toBeInTheDocument();
  });

  it('leaves a list that is not numbers as JSON', async () => {
    // `arena.botGivenNames` is a list of words. Drawing it as a line would be a picture of
    // nothing, and the editor could not write a name back through a number box.
    stubFetch([entry('arena.botGivenNames', ['Marek', 'Corvin'], 'Bot names')]);
    renderWithProviders(<GameConfigPage />);

    await waitFor(() => expect(screen.getByDisplayValue(/"Marek"/)).toBeInTheDocument());
    expect(screen.queryByText('Edit as JSON')).not.toBeInTheDocument();
  });
});
