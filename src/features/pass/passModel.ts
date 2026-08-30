import { rewardLines, type RewardsLike } from '../goals/goalText';

/**
 * The Vale Pass, as an operator needs to see it.
 *
 * A season is **one entity holding a thirty-tier, two-column ladder** — the login track's
 * situation exactly, and the reason A4 built a calendar view for that one: the generic
 * browser shows it as a JSON blob three screens tall, and "what does tier 21 pay on the
 * free column" becomes counting array elements.
 *
 * But the reason this view earns its place is arithmetic rather than layout. **A season's
 * length is not written anywhere.** It falls out of the top tier's threshold divided by the
 * daily ceiling, and those are two fields at opposite ends of a form. An operator who
 * lowers the ceiling, or widens the spacing, or adds five tiers has no way to see that the
 * season now needs forty-one days of a thirty-one-day month — which does not fail
 * validation, looks entirely reasonable in the editor, and is a track nobody can finish.
 *
 * Everything here is pure so it can be tested without a browser, and it deliberately
 * computes only what is exact: how many days at the ceiling the track takes, and which
 * months that fits in. It does **not** estimate how much favour a player earns in an
 * evening — that depends on the point rules against how somebody plays, and a plausible
 * figure there would be a number the game disagrees with.
 */

export interface PassTierLike {
  points?: number;
  free?: RewardsLike;
  premium?: RewardsLike;
}

export interface PassLike {
  key: string;
  name: string;
  description?: string;
  active?: boolean;
  unlockLevel?: number;
  unlockCost?: number;
  dailyPointCap?: number;
  schedule?: {
    kind?: string;
    startsAt?: string;
    endsAt?: string;
    startWeekday?: number;
    durationDays?: number;
  };
  pointRules?: { type?: string; points?: number; label?: string }[];
  tiers?: PassTierLike[];
}

/** The shortest and longest months there are, which is what a monthly season must fit in. */
export const SHORTEST_MONTH = 28;
export const LONGEST_MONTH = 31;

export interface PassPacing {
  /** Favour the whole track wants — the top tier's threshold. */
  total: number;
  /** The ceiling on one game-day, or 0 for none. */
  dailyCap: number;
  /**
   * Days at the ceiling to finish, or null when there is no ceiling.
   *
   * Null rather than zero: "no ceiling" and "finishes in no days" are different facts, and
   * a view that prints 0 for the first one is telling an operator something untrue.
   */
  daysAtCap: number | null;
  /** Days off a player could take in the shortest month and still finish. Null with no cap. */
  slackInShortestMonth: number | null;
}

export function pacing(pass: PassLike): PassPacing {
  const tiers = pass.tiers ?? [];
  const total = tiers.reduce((top, tier) => Math.max(top, tier.points ?? 0), 0);
  const dailyCap = pass.dailyPointCap ?? 0;
  if (dailyCap <= 0) {
    return { total, dailyCap: 0, daysAtCap: null, slackInShortestMonth: null };
  }
  const daysAtCap = Math.ceil(total / dailyCap);
  return {
    total,
    dailyCap,
    daysAtCap,
    slackInShortestMonth: SHORTEST_MONTH - daysAtCap,
  };
}

export interface PassProblem {
  /** `error` is a season that is wrong; `warn` is one worth a second look. */
  level: 'error' | 'warn';
  message: string;
}

/**
 * What is wrong with a season, or worth a second look.
 *
 * Deliberately **wider than publish validation**, and that division is the point. Publish
 * refuses what is broken — a ladder that does not climb, a tier paying nothing at all, a
 * free column that is empty everywhere, a price for an empty column. This adds the faults
 * that are *judgement* rather than breakage, which an editor cannot refuse and an operator
 * cannot see: a season nobody can finish, one finishable in a weekend, a free column that
 * is mostly empty, and rungs at uneven distances.
 */
export function passProblems(pass: PassLike): PassProblem[] {
  const problems: PassProblem[] = [];
  const tiers = pass.tiers ?? [];
  if (tiers.length === 0) return [{ level: 'error', message: 'The season has no tiers.' }];

  const measured = pacing(pass);

  for (let index = 1; index < tiers.length; index += 1) {
    if ((tiers[index]?.points ?? 0) > (tiers[index - 1]?.points ?? 0)) continue;
    problems.push({
      level: 'error',
      message: `Tier ${index + 1} does not climb — it needs more favour than tier ${index}.`,
    });
  }

  tiers.forEach((tier, index) => {
    const free = Object.keys(tier.free ?? {}).length;
    const premium = Object.keys(tier.premium ?? {}).length;
    if (free === 0 && premium === 0) {
      problems.push({ level: 'error', message: `Tier ${index + 1} pays nothing on either track.` });
    }
  });

  const paysFree = tiers.filter((tier) => Object.keys(tier.free ?? {}).length > 0).length;
  if (paysFree === 0) {
    problems.push({
      level: 'error',
      message: 'No tier pays anything on the free track, so the whole season is behind a purchase.',
    });
  } else if (paysFree < tiers.length / 2) {
    // Judgement rather than breakage: publish allows it, and a track that pays on a
    // quarter of its rungs is one most players stop looking at.
    problems.push({
      level: 'warn',
      message: `Only ${paysFree} of ${tiers.length} tiers pay anything on the free track.`,
    });
  }

  const paysPremium = tiers.filter((tier) => Object.keys(tier.premium ?? {}).length > 0).length;
  if ((pass.unlockCost ?? 0) > 0 && paysPremium === 0) {
    problems.push({
      level: 'error',
      message: 'The season charges crystals for a track that pays nothing.',
    });
  }

  // The one only a view can see. Both directions matter and they are different mistakes: a
  // season nobody can finish quietly stops being played, and one finishable in a weekend
  // stops being a season at all.
  if (measured.daysAtCap === null) {
    problems.push({
      level: 'warn',
      message:
        'No daily ceiling, so a single heavy day can finish the whole track — the season has no pace.',
    });
  } else {
    if (measured.daysAtCap > SHORTEST_MONTH) {
      problems.push({
        level: measured.daysAtCap > LONGEST_MONTH ? 'error' : 'warn',
        message: `${measured.daysAtCap} days at the ceiling to finish, which does not fit a ${SHORTEST_MONTH}-day month.`,
      });
    }
    if (measured.dailyCap * 4 >= measured.total) {
      problems.push({
        level: 'warn',
        message: 'Four days at the ceiling finish the track — the ceiling is barely pacing it.',
      });
    }
  }

  const steps = tiers.map((tier, index) =>
    index === 0 ? (tier.points ?? 0) : (tier.points ?? 0) - (tiers[index - 1]?.points ?? 0),
  );
  if (new Set(steps).size > 1) {
    // Not wrong, and worth saying: a player reads a pass as "how many more tiers", which
    // uneven rungs turn into arithmetic.
    problems.push({
      level: 'warn',
      message: 'Tiers are not evenly spaced, so "how many more" is no longer a countable thought.',
    });
  }

  return problems;
}

/** A season's schedule as a sentence. Its own function so the view never prints a key. */
export function seasonSentence(pass: PassLike): string {
  const schedule = pass.schedule;
  if (!schedule?.kind) return 'No schedule, so the season never runs.';
  if (schedule.kind === 'monthly') return 'Every calendar month, first to last.';
  if (schedule.kind === 'weekly') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const start = days[schedule.startWeekday ?? 0] ?? 'an unknown day';
    return `Every ${start} for ${schedule.durationDays ?? 0} days, repeating.`;
  }
  if (schedule.kind === 'window') {
    const from = schedule.startsAt ?? '';
    const to = schedule.endsAt ?? '';
    if (!from || !to) return 'A one-off with a missing bound, so it never runs.';
    if (Date.parse(to) <= Date.parse(from)) return 'A one-off that ends before it starts.';
    return `Once, from ${from.slice(0, 10)} to ${to.slice(0, 10)}.`;
  }
  return `An unknown schedule kind: ${schedule.kind}.`;
}

/** One tier's payout on one column, as a short list. Empty means the column is empty. */
export function tierLines(rewards: RewardsLike | undefined): string[] {
  return rewardLines(rewards);
}
