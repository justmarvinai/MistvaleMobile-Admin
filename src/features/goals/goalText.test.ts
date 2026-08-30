import { describe, expect, it } from 'vitest';
import {
  GOAL_ACCUMULATION,
  chainProblems,
  goalSentence,
  hasPhrase,
  ladderProblems,
  rewardLines,
  scheduleSentence,
} from './goalText';
import { windowSentence } from './SchedulePage';

/**
 * The goal DSL, in words.
 *
 * The accumulation table is a *rule* rather than phrasing, mirrored from the server because
 * the Admin SPA does not depend on the game's packages. Stating it out loud is the guard: a
 * `count` goal written here as `highest` would print "Reach 7 battles won" over a quest that
 * counts, which is exactly the misreading the sentence exists to prevent.
 */
describe('GOAL_ACCUMULATION', () => {
  it('marks the eight threshold goals and nothing else', () => {
    const thresholds = Object.entries(GOAL_ACCUMULATION)
      .filter(([, kind]) => kind === 'highest')
      .map(([type]) => type)
      .sort();
    expect(thresholds).toEqual([
      'accountLevel',
      'arenaTier',
      'chapterStars',
      'deepRunDepth',
      'gearLevel',
      'spireHeight',
      'titanDamage',
      'trialsBeaten',
      'worldBossDamage',
    ]);
  });

  it('covers every goal type with a phrase', () => {
    for (const type of Object.keys(GOAL_ACCUMULATION)) {
      expect(hasPhrase(type), type).toBe(true);
    }
  });
});

describe('goalSentence', () => {
  it('counts a tally and reaches a threshold', () => {
    // The classic quest bug said out loud: "7 battles won" is seven reports of one, and
    // "Reach relic level 12" is a high-water mark that twelve +1 relics must not satisfy.
    expect(goalSentence({ type: 'battleWin', target: 7 })).toBe('7 battles won');
    expect(goalSentence({ type: 'gearLevel', target: 12 })).toBe('Reach relic level 12');
  });

  it('carries the filters that narrow it', () => {
    expect(
      goalSentence({ type: 'spireHeight', target: 10, filters: { dungeonKey: 'mistspire' } }),
    ).toBe('Reach Mistspire floor reached 10 (dungeon key: mistspire)');
  });

  it('ignores an empty filter map and empty values', () => {
    expect(goalSentence({ type: 'arenaWin', target: 3, filters: {} })).toBe('3 arena battles won');
    expect(goalSentence({ type: 'arenaWin', target: 3, filters: { mode: '' } })).toBe(
      '3 arena battles won',
    );
  });

  it('falls back to the goal’s own name rather than to silence', () => {
    expect(goalSentence({ type: 'warbandRaid', target: 2 })).toBe('2 warband raid');
  });
});

describe('rewardLines', () => {
  it('reads a reward map as a short list', () => {
    expect(rewardLines({ silver: 4000, sigil_faded: 1 })).toEqual([
      'Sigil faded × 1',
      'Silver × 4,000',
    ]);
  });

  it('drops zeroes and copes with nothing at all', () => {
    expect(rewardLines({ silver: 0, crystals: 5 })).toEqual(['Crystals × 5']);
    expect(rewardLines(undefined)).toEqual([]);
    expect(rewardLines({})).toEqual([]);
  });
});

describe('chainProblems', () => {
  const step = (number: number) => ({
    key: `m${number}`,
    step: number,
    name: `Mission ${number}`,
    arc: 1,
    arcName: 'Arc',
  });

  it('says nothing about a chain numbered 1…n', () => {
    expect(chainProblems([step(1), step(2), step(3)])).toEqual([]);
  });

  it('names a gap, because the Path is walked by step', () => {
    const problems = chainProblems([step(1), step(3)]);
    expect(problems[0]?.message).toBe('Step 2 is missing.');
  });

  it('names a duplicate, which is an ambiguity rather than a wall', () => {
    const problems = chainProblems([step(1), { ...step(2), key: 'a' }, { ...step(2), key: 'b' }]);
    expect(problems[0]?.message).toBe('2 missions share step 2.');
  });

  it('says nothing about an empty chain', () => {
    expect(chainProblems([])).toEqual([]);
  });
});

describe('scheduleSentence', () => {
  it('tells a recurring event from a one-off, which is the whole difference', () => {
    expect(scheduleSentence({ kind: 'weekly', startWeekday: 1, durationDays: 5 })).toBe(
      'Every Monday for 5 days, repeating.',
    );
    expect(
      scheduleSentence({
        kind: 'window',
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: '2026-09-08T00:00:00Z',
      }),
    ).toContain('Once, from 2026-09-01');
  });

  it('names a schedule that can never fire', () => {
    expect(scheduleSentence(undefined)).toContain('never runs');
    expect(scheduleSentence({ kind: 'window' })).toContain('never runs');
  });

  it('names a kind it does not know rather than printing nothing', () => {
    expect(scheduleSentence({ kind: 'lunar' })).toContain('lunar');
  });
});

describe('ladderProblems', () => {
  it('says nothing about a ladder that climbs and pays', () => {
    expect(
      ladderProblems([
        { points: 400, rewards: { silver: 20000 } },
        { points: 1000, rewards: { crystals: 30 } },
      ]),
    ).toEqual([]);
  });

  it('names a rung that does not climb', () => {
    const problems = ladderProblems([
      { points: 1000, rewards: { silver: 1 } },
      { points: 1000, rewards: { silver: 2 } },
    ]);
    expect(problems[0]?.message).toContain('not above');
  });

  it('names a rung that pays nothing', () => {
    const problems = ladderProblems([{ points: 100, rewards: {} }]);
    expect(problems[0]?.message).toContain('pays nothing');
  });
});

describe('windowSentence', () => {
  const now = new Date('2026-09-05T12:00:00Z');

  it('reads an empty bound as unbounded rather than as never', () => {
    // The trap: `startsAt: ''` means "from whenever it is switched on", and reading it
    // literally as a missing date makes a live post look broken.
    expect(windowSentence({}, now)).toContain('as long as it is switched on');
    expect(windowSentence({ startsAt: '', endsAt: '' }, now)).toContain('switched on');
  });

  it('says whether it is showing right now, which is what an operator is asking', () => {
    expect(
      windowSentence({ startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-10T00:00:00Z' }, now),
    ).toContain('Showing now');
    expect(windowSentence({ startsAt: '2026-09-20T00:00:00Z' }, now)).toContain('Not yet');
    expect(windowSentence({ endsAt: '2026-09-02T00:00:00Z' }, now)).toContain('Finished');
  });

  it('names a window that ends before it starts', () => {
    expect(
      windowSentence({ startsAt: '2026-09-10T00:00:00Z', endsAt: '2026-09-01T00:00:00Z' }, now),
    ).toContain('never show');
  });

  it('names a date the server could not read', () => {
    expect(windowSentence({ startsAt: 'next tuesday' }, now)).toContain('not a timestamp');
  });
});
