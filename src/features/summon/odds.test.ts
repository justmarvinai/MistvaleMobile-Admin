import { describe, expect, it } from 'vitest';
import { bandShares, expectedPulls, mercyBegins, rateAfter, ratesBalance } from './odds';

/**
 * The summon pool editor's arithmetic.
 *
 * Published odds are the one number a player is entitled to hold the game to, so every
 * figure this screen shows is pinned. The cases that matter are the ones where a plausible
 * implementation is quietly wrong: mercy that starts a pull early, an expected-pulls figure
 * that ignores mercy entirely, and a rarity nobody can ever reach.
 */

const MERCY = { after: 10, step: 0.05, maxBonus: 1 };

describe('rateAfter', () => {
  it('leaves the rate alone until the run is longer than `after`', () => {
    // Off by one here would advertise mercy a pull earlier than the server grants it.
    expect(rateAfter(0.1, MERCY, 0)).toBe(0.1);
    expect(rateAfter(0.1, MERCY, 10)).toBe(0.1);
    expect(rateAfter(0.1, MERCY, 11)).toBeCloseTo(0.15, 10);
  });

  it('accrues a step per pull and stops at the cap', () => {
    expect(rateAfter(0.1, { after: 0, step: 0.1, maxBonus: 0.2 }, 5)).toBeCloseTo(0.3, 10);
  });

  it('never exceeds certainty', () => {
    expect(rateAfter(0.5, { after: 0, step: 1, maxBonus: 1 }, 5)).toBe(1);
  });

  it('is the base rate when the pool grants no mercy at all', () => {
    expect(rateAfter(0.02, undefined, 900)).toBe(0.02);
  });
});

describe('expectedPulls', () => {
  it('is one over the rate when there is no mercy', () => {
    // The geometric mean, which is the one case with a closed form to check against.
    expect(expectedPulls(0.25, undefined)!).toBeCloseTo(4, 6);
    expect(expectedPulls(0.01, undefined)!).toBeCloseTo(100, 4);
  });

  it('is shorter with mercy than without it', () => {
    const without = expectedPulls(0.02, undefined)!;
    const with_ = expectedPulls(0.02, MERCY)!;
    expect(with_).toBeLessThan(without);
  });

  it('says nothing rather than a number for a rarity nobody can reach', () => {
    // A rarity at 0% with no mercy is exactly the content an operator opens this to find.
    expect(expectedPulls(0, undefined)).toBeNull();
  });

  it('reaches a rarity that only mercy can give', () => {
    // 0% base but mercy that climbs to certainty: unreachable by rate, certain by run.
    const pulls = expectedPulls(0, { after: 4, step: 0.5, maxBonus: 1 });
    expect(pulls).not.toBeNull();
    expect(pulls!).toBeGreaterThan(4);
  });
});

describe('mercyBegins', () => {
  it('names the first pull mercy touches, which is after + 2 and not after + 1', () => {
    // The obvious answer is wrong, and this project has made the mistake once already: the
    // server's counter is pulls *since* the rarity last landed, so going into pull n it
    // holds n - 1, and the bonus needs since - after > 0. With after = 10 a player is
    // still on the base rate at pull 11 and first sees mercy at pull 12.
    expect(mercyBegins(MERCY)).toBe(12);
    expect(rateAfter(0.1, MERCY, 10)).toBe(0.1);
  });

  it('says never for a rule that cannot move the rate', () => {
    // Authored with a zero step or a zero cap: present in the data, inert in the game.
    expect(mercyBegins({ after: 10, step: 0, maxBonus: 1 })).toBeNull();
    expect(mercyBegins({ after: 10, step: 0.1, maxBonus: 0 })).toBeNull();
    expect(mercyBegins(undefined)).toBeNull();
  });
});

describe('ratesBalance', () => {
  it('accepts a distribution and refuses one that is not', () => {
    expect(ratesBalance({ rare: 0.9, epic: 0.09, legendary: 0.01 })).toBe(true);
    expect(ratesBalance({ rare: 0.9, epic: 0.09 })).toBe(false);
  });

  it('tolerates the rounding a hand-typed table produces', () => {
    expect(ratesBalance({ rare: 0.333, epic: 0.333, legendary: 0.334 })).toBe(true);
  });
});

describe('bandShares', () => {
  it('turns weights into the share each champion actually gets', () => {
    expect(
      bandShares([
        { championKey: 'a', weight: 30 },
        { championKey: 'b', weight: 10 },
      ]),
    ).toEqual([
      { championKey: 'a', share: 0.75 },
      { championKey: 'b', share: 0.25 },
    ]);
  });

  it('reports zero rather than an even split for a band nobody can roll', () => {
    // All-zero weights make the band unrollable; an even split would describe a pool that
    // does not exist.
    expect(bandShares([{ championKey: 'a', weight: 0 }])).toEqual([{ championKey: 'a', share: 0 }]);
  });
});
