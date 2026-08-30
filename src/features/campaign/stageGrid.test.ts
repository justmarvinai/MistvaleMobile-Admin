import { describe, expect, it } from 'vitest';
import { chaptersOf, gapsIn, gridFor, stageRows, type ContentRow } from './stageGrid';

/**
 * The campaign grid's arithmetic.
 *
 * All of it, because the grid is nothing but arithmetic over the content list — and the
 * one thing it must never do is make a chapter look complete when it is not.
 */

const stage = (over: Record<string, unknown> = {}): ContentRow => ({
  key: String(over.key ?? 'c01_s1_normal'),
  state: 'live',
  data: {
    mode: 'campaign',
    parentKey: 'c01',
    number: 1,
    difficulty: 'normal',
    energyCost: 6,
    waves: [[{}, {}], [{}]],
    ...over,
  },
});

describe('stageRows', () => {
  it('reads a stage from its body rather than from its key', () => {
    // The key encodes the same three facts today, and parsing it would work and be wrong:
    // a stage authored with any other key would silently vanish from the grid.
    const [row] = stageRows([stage({ key: 'anything_at_all', parentKey: 'c04', number: 6 })]);
    expect(row).toMatchObject({ key: 'anything_at_all', parentKey: 'c04', number: 6 });
  });

  it('counts waves and the units in them', () => {
    expect(stageRows([stage()])[0]).toMatchObject({ waves: 2, units: 3 });
  });

  it('leaves out everything that is not campaign', () => {
    // The same content type holds Depths floors, Spire floors, Trials and the Titan, and
    // none of them is laid out seven by three.
    const rows = stageRows([
      stage({ mode: 'dungeon' }),
      stage({ mode: 'spire' }),
      stage({ mode: 'campaign' }),
    ]);
    expect(rows).toHaveLength(1);
  });

  it('skips a row with no body rather than throwing', () => {
    expect(stageRows([{ key: 'broken', state: 'live' }])).toEqual([]);
    expect(stageRows([{ key: 'broken', state: 'live', data: 'not an object' }])).toEqual([]);
  });
});

describe('gridFor', () => {
  it('lays a chapter out as numbers by difficulty', () => {
    const rows = stageRows([
      stage({ key: 'a', number: 1, difficulty: 'normal' }),
      stage({ key: 'b', number: 1, difficulty: 'hard' }),
      stage({ key: 'c', number: 2, difficulty: 'normal' }),
    ]);
    const grid = gridFor(rows, 'c01');
    expect(grid.map((cell) => cell.number)).toEqual([1, 2]);
    expect(grid[0]?.byDifficulty.hard?.key).toBe('b');
  });

  it('keeps a missing cell as a hole rather than closing it up', () => {
    // A chapter with six Brutal stages and seven of everything else is a content fault,
    // and a grid that quietly closed the gap would hide the thing it exists to show.
    const grid = gridFor(stageRows([stage({ number: 1, difficulty: 'normal' })]), 'c01');
    expect(grid[0]?.byDifficulty.brutal).toBeNull();
    expect(gapsIn(grid)).toEqual(['1 hard', '1 brutal']);
  });

  it('says nothing is missing from a complete row', () => {
    const rows = stageRows([
      stage({ key: 'a', difficulty: 'normal' }),
      stage({ key: 'b', difficulty: 'hard' }),
      stage({ key: 'c', difficulty: 'brutal' }),
    ]);
    expect(gapsIn(gridFor(rows, 'c01'))).toEqual([]);
  });

  it('gives back nothing for a chapter with no stages', () => {
    expect(gridFor(stageRows([stage()]), 'c99')).toEqual([]);
  });
});

describe('chaptersOf', () => {
  it('orders chapters numerically rather than as strings', () => {
    // c10 sorts before c2 alphabetically, which would put chapter ten second.
    const rows = stageRows([
      stage({ key: 'a', parentKey: 'c10' }),
      stage({ key: 'b', parentKey: 'c2' }),
      stage({ key: 'c', parentKey: 'c1' }),
    ]);
    expect(chaptersOf(rows)).toEqual(['c1', 'c2', 'c10']);
  });
});
