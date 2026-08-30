import { describe, expect, it } from 'vitest';
import {
  LONGEST_MONTH,
  SHORTEST_MONTH,
  pacing,
  passProblems,
  seasonSentence,
  type PassLike,
} from './passModel';

/**
 * A season's arithmetic, which is the whole reason this view exists.
 *
 * Its length is written nowhere: it falls out of the top tier divided by the daily ceiling,
 * two fields at opposite ends of a form. An operator who lowers the ceiling, widens the
 * spacing or adds five tiers has no way to see that the season now needs forty-one days of
 * a thirty-one-day month — which passes validation, looks reasonable in the editor, and is
 * a track nobody can finish.
 */

const season = (overrides: Partial<PassLike> = {}): PassLike => ({
  key: 'pass_test',
  name: 'A Season',
  schedule: { kind: 'monthly' },
  unlockCost: 900,
  dailyPointCap: 600,
  tiers: Array.from({ length: 30 }, (_, index) => ({
    points: 500 * (index + 1),
    free: { silver: 1000 },
    premium: { crystals: 10 },
  })),
  ...overrides,
});

describe('pacing', () => {
  it('reads the season’s length off the ladder and the ceiling', () => {
    const measured = pacing(season());
    expect(measured.total).toBe(15_000);
    expect(measured.daysAtCap).toBe(25);
    expect(measured.slackInShortestMonth).toBe(SHORTEST_MONTH - 25);
  });

  it('says there is no ceiling rather than saying zero days', () => {
    // Different facts. A view printing 0 for "no ceiling" tells an operator something
    // untrue about a season that can be finished in an afternoon.
    const measured = pacing(season({ dailyPointCap: 0 }));
    expect(measured.daysAtCap).toBeNull();
    expect(measured.slackInShortestMonth).toBeNull();
  });

  it('reads the *top* tier rather than the last one written', () => {
    // A ladder out of order is refused at publish, but the editor holds drafts — and a
    // length computed from `tiers.at(-1)` would read a mid-season figure as the total.
    const measured = pacing(
      season({
        tiers: [{ points: 500 }, { points: 9_000 }, { points: 1_000 }],
      }),
    );
    expect(measured.total).toBe(9_000);
  });
});

describe('passProblems', () => {
  const messages = (pass: PassLike) => passProblems(pass).map((problem) => problem.message);

  it('says nothing about the shipped shape', () => {
    expect(passProblems(season())).toEqual([]);
  });

  it('names a season nobody can finish in the shortest month', () => {
    // 15,000 at 400 a day is 38 days — inside a 31-day month it is impossible, and in
    // February it is not close. Publish cannot refuse this; nothing about it is malformed.
    const problems = passProblems(season({ dailyPointCap: 400 }));
    const named = problems.find((problem) => problem.message.includes('days at the ceiling'));
    expect(named?.level).toBe('error');
    expect(named?.message).toContain('38');
  });

  it('warns where it fits a long month but not a short one', () => {
    // 15,000 at 520 a day is 29 days: fine in March, impossible every February. The level
    // is the difference between "never" and "not always", and the two deserve different
    // words.
    const problems = passProblems(season({ dailyPointCap: 520 }));
    const named = problems.find((problem) => problem.message.includes('days at the ceiling'));
    expect(named?.level).toBe('warn');
    expect(29).toBeGreaterThan(SHORTEST_MONTH);
    expect(29).toBeLessThanOrEqual(LONGEST_MONTH);
  });

  it('names a season a long weekend finishes', () => {
    expect(messages(season({ dailyPointCap: 5_000 }))).toContain(
      'Four days at the ceiling finish the track — the ceiling is barely pacing it.',
    );
  });

  it('names a season with no ceiling at all', () => {
    expect(messages(season({ dailyPointCap: 0 })).join(' ')).toContain('no pace');
  });

  it('names a free column that is mostly empty, which publish allows', () => {
    const tiers = Array.from({ length: 30 }, (_, index) => ({
      points: 500 * (index + 1),
      free: index % 5 === 0 ? { silver: 1000 } : {},
      premium: { crystals: 10 },
    }));
    expect(messages(season({ tiers })).join(' ')).toContain('6 of 30 tiers');
  });

  it('names a free column that is empty everywhere, which publish refuses', () => {
    const tiers = Array.from({ length: 4 }, (_, index) => ({
      points: 500 * (index + 1),
      free: {},
      premium: { crystals: 10 },
    }));
    const problems = passProblems(season({ tiers }));
    expect(problems.some((problem) => problem.message.includes('behind a purchase'))).toBe(true);
    expect(problems.find((problem) => problem.message.includes('behind a purchase'))?.level).toBe(
      'error',
    );
  });

  it('names a price for a column with nothing in it', () => {
    const tiers = Array.from({ length: 4 }, (_, index) => ({
      points: 500 * (index + 1),
      free: { silver: 1000 },
      premium: {},
    }));
    expect(messages(season({ tiers })).join(' ')).toContain('charges crystals');
  });

  it('names a ladder that does not climb', () => {
    const problems = passProblems(
      season({
        tiers: [
          { points: 500, free: { silver: 1 } },
          { points: 500, free: { silver: 2 } },
        ],
      }),
    );
    expect(problems.some((problem) => problem.message.includes('does not climb'))).toBe(true);
  });

  it('names uneven rungs, which are not wrong and are worth saying', () => {
    const problems = passProblems(
      season({
        tiers: [
          { points: 500, free: { silver: 1 } },
          { points: 900, free: { silver: 2 } },
          { points: 1_800, free: { silver: 3 } },
        ],
        dailyPointCap: 100,
      }),
    );
    const named = problems.find((problem) => problem.message.includes('evenly spaced'));
    expect(named?.level).toBe('warn');
  });

  it('says the obvious thing about a season with no tiers rather than dividing by nothing', () => {
    expect(passProblems(season({ tiers: [] }))).toEqual([
      { level: 'error', message: 'The season has no tiers.' },
    ]);
  });
});

describe('seasonSentence', () => {
  it('reads each schedule kind as words', () => {
    expect(seasonSentence(season())).toContain('Every calendar month');
    expect(
      seasonSentence(season({ schedule: { kind: 'weekly', startWeekday: 1, durationDays: 5 } })),
    ).toBe('Every Monday for 5 days, repeating.');
    expect(
      seasonSentence(
        season({
          schedule: {
            kind: 'window',
            startsAt: '2026-09-01T00:00:00Z',
            endsAt: '2026-10-01T00:00:00Z',
          },
        }),
      ),
    ).toContain('Once, from 2026-09-01');
  });

  it('names a schedule that can never run', () => {
    expect(seasonSentence(season({ schedule: undefined }))).toContain('never runs');
    expect(seasonSentence(season({ schedule: { kind: 'window', startsAt: '' } }))).toContain(
      'never runs',
    );
    expect(
      seasonSentence(
        season({
          schedule: {
            kind: 'window',
            startsAt: '2026-10-01T00:00:00Z',
            endsAt: '2026-09-01T00:00:00Z',
          },
        }),
      ),
    ).toContain('ends before it starts');
  });

  it('names a kind it does not know rather than printing nothing', () => {
    expect(seasonSentence(season({ schedule: { kind: 'lunar' } }))).toContain('lunar');
  });
});
