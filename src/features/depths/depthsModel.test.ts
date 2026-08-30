import { describe, expect, it } from 'vitest';
import {
  floorsOf,
  keepProblems,
  opensDaily,
  openWeek,
  type DungeonLike,
  type StageLike,
} from './depthsModel';

const keep = (over: Partial<DungeonLike> = {}): DungeonLike => ({
  key: 'cinderspire',
  name: 'Cinderspire',
  kind: 'gear',
  floors: 2,
  ...over,
});

const floor = (number: number, levels: number[], over: Partial<StageLike> = {}): StageLike => ({
  key: `cinderspire_f${String(number).padStart(2, '0')}`,
  mode: 'dungeon',
  parentKey: 'cinderspire',
  number,
  energyCost: 6,
  waves: [levels.map((level, slot) => ({ enemyKey: 'e', level, slot }))],
  starRules: { maxTurns: 20 },
  unlock: { playerLevel: 12 },
  rewards: { drops: { gearChance: 1 } },
  ...over,
});

describe('floorsOf', () => {
  it('takes only this keep’s floors, in descent order', () => {
    const stages = [
      floor(2, [20]),
      floor(1, [19]),
      { ...floor(1, [50]), key: 'other_f01', parentKey: 'sunkenstair' },
    ];
    const floors = floorsOf(keep(), stages);
    expect(floors.map((entry) => entry.number)).toEqual([1, 2]);
    expect(floors.map((entry) => entry.key)).toEqual(['cinderspire_f01', 'cinderspire_f02']);
  });

  it('reads the enemy level as a band, since waves climb inside one floor', () => {
    const stages = [
      {
        ...floor(1, []),
        waves: [[{ enemyKey: 'e', level: 19, slot: 0 }], [{ enemyKey: 'e', level: 21, slot: 0 }]],
      },
    ];
    const [entry] = floorsOf(keep({ floors: 1 }), stages);
    expect(entry).toMatchObject({ levelMin: 19, levelMax: 21, waves: 2, enemies: 2 });
  });

  it('measures each floor’s step against the one above it', () => {
    const floors = floorsOf(keep({ floors: 3 }), [floor(1, [10]), floor(2, [14]), floor(3, [15])]);
    expect(floors.map((entry) => entry.stepFromPrevious)).toEqual([0, 4, 1]);
  });

  it('is empty for a keep with nothing published under it', () => {
    expect(floorsOf(keep(), [])).toEqual([]);
  });
});

describe('keepProblems', () => {
  it('says nothing about a keep that is merely hard', () => {
    const floors = floorsOf(keep(), [floor(1, [10]), floor(2, [40])]);
    expect(keepProblems(keep(), floors)).toEqual([]);
  });

  it('names a keep with fewer floors published than it declares', () => {
    const floors = floorsOf(keep({ floors: 15 }), [floor(1, [10])]);
    const problems = keepProblems(keep({ floors: 15 }), floors);
    expect(problems[0]?.message).toContain('declares 15 floors and 1');
  });

  it('names a gap in the numbering, which is what "floor N is open" reads', () => {
    const dungeon = keep({ floors: 3 });
    const floors = floorsOf(dungeon, [floor(1, [10]), floor(2, [12]), floor(4, [14])]);
    const problems = keepProblems(dungeon, floors);
    expect(problems.some((entry) => entry.message.includes('Floor 3 is missing'))).toBe(true);
  });

  it('names a descent that gets easier', () => {
    const dungeon = keep({ floors: 2 });
    const floors = floorsOf(dungeon, [floor(1, [20]), floor(2, [17])]);
    const problems = keepProblems(dungeon, floors);
    expect(problems[0]?.message).toContain('3 levels lower');
  });

  it('names a floor with nothing on it', () => {
    const dungeon = keep({ floors: 1 });
    const floors = floorsOf(dungeon, [{ ...floor(1, []), waves: [] }]);
    expect(keepProblems(dungeon, floors)[0]?.message).toContain('clear itself');
  });

  it('names two floors sharing a number', () => {
    const dungeon = keep({ floors: 2 });
    const floors = floorsOf(dungeon, [floor(1, [10]), { ...floor(1, [12]), key: 'dup' }]);
    expect(
      keepProblems(dungeon, floors).some((entry) => entry.message.includes('numbered 1')),
    ).toBe(true);
  });
});

describe('openWeek', () => {
  it('inverts the per-keep lists into a week', () => {
    const week = openWeek([
      keep({ key: 'ember_spring', openDays: [1, 4] }),
      keep({ key: 'tide_spring', openDays: [2, 5] }),
    ]);
    expect(week[1]?.keys).toEqual(['ember_spring']);
    expect(week[2]?.keys).toEqual(['tide_spring']);
    expect(week[0]?.keys).toEqual([]);
    expect(week.map((day) => day.label)[0]).toBe('Sunday');
  });

  it('reads an empty list as every day rather than as never', () => {
    // The trap: an unset rotation looks like a keep that never opens, and the four gear
    // dungeons are all authored that way.
    const week = openWeek([keep({ key: 'cinderspire', openDays: [] })]);
    expect(week.every((day) => day.keys.includes('cinderspire'))).toBe(true);
    expect(opensDaily(keep({ openDays: [] }))).toBe(true);
    expect(opensDaily(keep({ openDays: [3] }))).toBe(false);
  });
});
