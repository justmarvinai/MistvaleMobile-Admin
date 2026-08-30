import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SnapshotPanel } from './SnapshotPanel';
import { renderWithProviders } from '@/test/render';

/**
 * The export/import panel.
 *
 * The reading rules are pinned without a DOM in `readSnapshot.test.ts`. What is under test
 * here is the screen's own two jobs, and both are the kind that fail silently: a chosen
 * file has to *stage* rather than send — an import is a write, and one that happened at
 * the moment a file was picked would give an operator nothing to change their mind about —
 * and what is sent has to be only the types still ticked.
 */

const ENTITY = { key: 'testers', data: { key: 'testers', name: 'Testers' } };

/** Records every POST the panel sends, and answers with an import result. */
function stubFetch(): { url: string; body: unknown }[] {
  const posts: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') {
        posts.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
        return new Response(
          JSON.stringify({
            ok: true,
            rev: 1,
            data: {
              drafted: [{ type: 'faction', count: 1 }],
              total: 1,
              unknownTypes: [],
              unchanged: 0,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          rev: 1,
          data: { summary: { rev: 3, total: 1, types: [] }, files: [] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }),
  );
  return posts;
}

const jsonFile = (name: string, value: unknown): File =>
  new File([JSON.stringify(value)], name, { type: 'application/json' });

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function choose(files: File[]): Promise<void> {
  const input = screen.getByLabelText('Snapshot files');
  await userEvent.upload(input, files);
}

describe('SnapshotPanel', () => {
  it('stages a chosen file instead of importing it', async () => {
    const posts = stubFetch();
    renderWithProviders(<SnapshotPanel />);

    await choose([jsonFile('faction.json', [ENTITY])]);

    await waitFor(() => expect(screen.getByText('Factions')).toBeInTheDocument());
    // The whole reason the panel exists rather than a bare upload button: choosing a file
    // must not be the write.
    expect(posts).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Import as drafts/ })).toBeEnabled();
  });

  it('sends only the types still ticked', async () => {
    const posts = stubFetch();
    renderWithProviders(<SnapshotPanel />);

    await choose([
      jsonFile('faction.json', [ENTITY]),
      jsonFile('item.json', [{ key: 'brew', data: { key: 'brew' } }]),
    ]);
    await waitFor(() => expect(screen.getByText('Items')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('checkbox', { name: 'Items' }));
    await userEvent.click(screen.getByRole('button', { name: /Import as drafts/ }));

    await waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0]?.body as { files: { type: string }[]; only: string[] };
    expect(body.files.map((file) => file.type)).toEqual(['faction']);
    expect(body.only).toEqual(['faction']);
  });

  it('names a file it could not read, and still stages the ones it could', async () => {
    renderWithProviders(<SnapshotPanel />);

    await choose([jsonFile('faction.json', [ENTITY]), jsonFile('manifest.json', [ENTITY])]);

    await waitFor(() => expect(screen.getByText(/1 file skipped/)).toBeInTheDocument());
    expect(screen.getByText(/does not say which content type/)).toBeInTheDocument();
    expect(screen.getByText('Factions')).toBeInTheDocument();
  });

  it('reports what the import wrote and where to review it', async () => {
    renderWithProviders(<SnapshotPanel />);

    await choose([jsonFile('faction.json', [ENTITY])]);
    await waitFor(() => expect(screen.getByText('Factions')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Import as drafts/ }));

    await waitFor(() =>
      expect(
        screen.getByText(/1 draft written\. Review them under Pending changes/),
      ).toBeInTheDocument(),
    );
  });
});
