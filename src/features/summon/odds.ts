/**
 * What a summon pool actually does (ADMIN_SUITE_DESIGN §2.8).
 *
 * Published gacha odds are the one number in the game a player is entitled to hold us to,
 * so the editor's job is not to make rates easy to change — the generic browser already
 * does that — but to make what they *mean* impossible to misread. Three things an operator
 * cannot see in a form of raw numbers: whether the rates sum to one, what mercy turns a
 * rate into after a dry run, and how many pulls a rarity actually costs.
 *
 * All of it is arithmetic over the **published** content and none of it is a game outcome:
 * the server rolls, and this only describes what the server will do. The mercy curve is
 * the game's own rule read off the same two fields the odds panel shows a player.
 */

/** Mercy, as content states it: nothing for `after` pulls, then `step` each, capped. */
export interface PityRule {
  after: number;
  step: number;
  maxBonus: number;
}

/**
 * The rate for a rarity after `since` pulls without it.
 *
 * The game's rule, in one line: mercy accrues only once a run is *longer* than `after`,
 * adds `step` per further pull, and stops at `maxBonus`. `since` is the server's own
 * counter — pulls since that rarity last landed — so it is one less than the pull number.
 *
 * Clamped to 1 here where the server instead takes the bonus back out of the commonest
 * rarities (`drainFromCommonest`). That difference cannot change what this screen says: a
 * rate over certainty is not a rate, and an operator needs to see the ceiling rather than
 * the arithmetic that keeps the table a distribution.
 */
export function rateAfter(base: number, rule: PityRule | undefined, since: number): number {
  if (!rule) return base;
  const over = since - rule.after;
  if (over <= 0) return base;
  return Math.min(1, base + Math.min(over * rule.step, rule.maxBonus));
}

/**
 * How many pulls a rarity takes, on average.
 *
 * Walked rather than solved, because mercy makes the closed form a piecewise mess and the
 * walk is exact: at each pull the rate is known, so the probability of first success at
 * pull *n* is the product of the misses before it times the rate at *n*.
 *
 * `cap` is a safety rather than an approximation. With mercy the walk terminates quickly;
 * **without** it a base rate of zero never terminates at all, and a pool authored with a
 * rarity at 0% and no mercy is exactly the content an operator opens this screen to find.
 */
export function expectedPulls(
  base: number,
  rule: PityRule | undefined,
  cap = 5_000,
): number | null {
  if (base <= 0 && !rule) return null;
  let survive = 1;
  let expected = 0;
  for (let pull = 1; pull <= cap; pull += 1) {
    const rate = rateAfter(base, rule, pull - 1);
    expected += pull * survive * rate;
    survive *= 1 - rate;
    if (survive <= 1e-12) return expected;
  }
  // Still standing after the cap: the rarity is effectively unreachable, and saying so is
  // more use than a number with a quiet asterisk on it.
  return null;
}

/**
 * The pull at which mercy first moves the rate, or null when it never does.
 *
 * `after + 2`, and the off-by-one is worth spelling out because `after + 1` is the obvious
 * answer and it is wrong. The server's counter is *pulls since the rarity last landed*, so
 * going into pull **n** it holds `n - 1`; the bonus needs `since - after > 0`, which first
 * happens at `n = after + 2`. Advertising `after + 1` would promise an operator mercy a
 * pull earlier than the game grants it.
 */
export function mercyBegins(rule: PityRule | undefined): number | null {
  if (!rule || rule.step <= 0 || rule.maxBonus <= 0) return null;
  return rule.after + 2;
}

/**
 * Whether the rates are a distribution.
 *
 * Publish already refuses a pool that does not sum to one; this is what tells an operator
 * *before* they get there, while the number they mistyped is still on the screen.
 */
export function ratesSum(rates: Record<string, number>): number {
  return Object.values(rates).reduce((total, value) => total + (value || 0), 0);
}

/** Within a tenth of a percent, which is the tolerance publish itself allows. */
export function ratesBalance(rates: Record<string, number>): boolean {
  return Math.abs(ratesSum(rates) - 1) < 0.001;
}

/** Champion weights inside one rarity, as the share each actually gets. */
export function bandShares(
  entries: readonly { championKey: string; weight: number }[],
): { championKey: string; share: number }[] {
  const total = entries.reduce((sum, entry) => sum + (entry.weight || 0), 0);
  // A band whose weights are all zero cannot be rolled from; reporting an even split would
  // be describing a pool that does not exist.
  if (total <= 0) return entries.map((entry) => ({ championKey: entry.championKey, share: 0 }));
  return entries.map((entry) => ({
    championKey: entry.championKey,
    share: (entry.weight || 0) / total,
  }));
}
