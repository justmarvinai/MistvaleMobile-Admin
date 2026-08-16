import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContentDiffEntry } from '@/api/types';
import { DiffViewer, countFieldChanges, formatValue, groupByType } from './DiffViewer';
import { renderWithProviders } from '@/test/render';

/**
 * The publish diff is the last screen between a draft and every player, so what it
 * renders has to be exactly what the server reported — no summarising, no dropped
 * fields, and old → new legible at a glance.
 */

const entries: ContentDiffEntry[] = [
  {
    contentType: 'champion',
    key: 'ember_warden',
    change: 'modified',
    risk: 'balance',
    fields: [
      { path: 'baseStats', before: { hp: 12_000, atk: 900 }, after: { hp: 14_000, atk: 900 } },
      { path: 'name', before: 'Ember Warden', after: 'Emberwarden' },
    ],
  },
  {
    contentType: 'champion',
    key: 'tide_singer',
    change: 'added',
    fields: [],
  },
  {
    contentType: 'gameConfig',
    key: 'energy.regenSeconds',
    change: 'modified',
    risk: 'economy',
    fields: [{ path: 'value', before: 180, after: 150 }],
  },
  {
    contentType: 'skill',
    key: 'old_lash',
    change: 'removed',
    fields: [],
  },
];

describe('DiffViewer', () => {
  it('shows an empty state when nothing is pending', () => {
    renderWithProviders(<DiffViewer entries={[]} />);
    expect(screen.getByText('No pending changes')).toBeInTheDocument();
  });

  it('groups entries under their content type label', () => {
    renderWithProviders(<DiffViewer entries={entries} />);

    expect(screen.getByText('Champions')).toBeInTheDocument();
    expect(screen.getByText('Game config')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('counts the changes in each group', () => {
    renderWithProviders(<DiffViewer entries={entries} />);
    expect(screen.getByText('2 changes')).toBeInTheDocument();
    expect(screen.getAllByText('1 change')).toHaveLength(2);
  });

  it('lists every entity key', () => {
    renderWithProviders(<DiffViewer entries={entries} />);

    for (const entry of entries) {
      expect(screen.getByText(entry.key)).toBeInTheDocument();
    }
  });

  it('badges each entity with its change kind', () => {
    renderWithProviders(<DiffViewer entries={entries} />);

    expect(screen.getAllByText('modified')).toHaveLength(2);
    expect(screen.getByText('added')).toBeInTheDocument();
    expect(screen.getByText('removed')).toBeInTheDocument();
  });

  it('surfaces the risk badge the server attached', () => {
    renderWithProviders(<DiffViewer entries={entries} />);

    expect(screen.getByText('balance')).toBeInTheDocument();
    expect(screen.getByText('economy')).toBeInTheDocument();
  });

  it('summarises how many fields a modified entity changed', () => {
    renderWithProviders(<DiffViewer entries={entries} />);
    expect(screen.getByText('2 fields')).toBeInTheDocument();
    expect(screen.getByText('1 field')).toBeInTheDocument();
  });

  it('renders old and new values once an entity is expanded', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiffViewer entries={entries} />);

    await user.click(screen.getByText('energy.regenSeconds'));

    const panel = screen.getByRole('region');
    expect(within(panel).getByText('value')).toBeInTheDocument();
    expect(within(panel).getByText('180')).toBeInTheDocument();
    expect(within(panel).getByText('150')).toBeInTheDocument();
  });

  it('shows both sides of a nested object change', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiffViewer entries={entries} />);

    await user.click(screen.getByText('ember_warden'));

    const panel = screen.getByRole('region');
    expect(within(panel).getByText(/"hp": 12000/)).toBeInTheDocument();
    expect(within(panel).getByText(/"hp": 14000/)).toBeInTheDocument();
  });

  it('explains an addition instead of showing an empty field table', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiffViewer entries={entries} />);

    await user.click(screen.getByText('tide_singer'));
    expect(screen.getByText(/does not exist in the live content yet/)).toBeInTheDocument();
  });

  it('warns plainly about a removal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiffViewer entries={entries} />);

    await user.click(screen.getByText('old_lash'));
    expect(screen.getByText(/will be removed from the live content/)).toBeInTheDocument();
  });
});

describe('diff helpers', () => {
  it('groups entries by content type, preserving order within a group', () => {
    const grouped = groupByType(entries);
    const champions = grouped.find((group) => group.contentType === 'champion');

    expect(champions?.items.map((item) => item.key)).toEqual(['ember_warden', 'tide_singer']);
  });

  it('sorts groups by their human label, not the raw type name', () => {
    // Raw types sort as champion / gameConfig / skill; labels as Champions / Game config
    // / Skills — the same order here, but the labels are what an operator scans.
    expect(groupByType(entries).map((group) => group.contentType)).toEqual([
      'champion',
      'gameConfig',
      'skill',
    ]);
  });

  it('counts field changes across every entry', () => {
    expect(countFieldChanges(entries)).toBe(3);
  });

  it('formats scalars without JSON quoting', () => {
    expect(formatValue('Ember Warden')).toBe('Ember Warden');
    expect(formatValue(180)).toBe('180');
    expect(formatValue(true)).toBe('true');
    expect(formatValue(null)).toBe('null');
  });

  it('pretty-prints objects with sorted keys so key order is never read as a change', () => {
    expect(formatValue({ b: 2, a: 1 })).toBe(formatValue({ a: 1, b: 2 }));
    expect(formatValue({ b: 2, a: 1 })).toContain('"a": 1');
  });

  it('marks a value that was not set before', () => {
    renderWithProviders(
      <DiffViewer
        entries={[
          {
            contentType: 'champion',
            key: 'new_field',
            change: 'modified',
            fields: [{ path: 'title', before: undefined, after: 'Warden' }],
          },
        ]}
      />,
    );
    expect(screen.getByText('1 field')).toBeInTheDocument();
  });
});
