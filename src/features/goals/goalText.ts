import { humanizeKey } from '@/lib/format';

/**
 * Goals and rewards, in words (ADMIN_SUITE_DESIGN §2.10).
 *
 * Every claimable thing in Mistvale — a daily quest, a step of the Path, an event's point
 * rules, a tutorial step — is built on the same goal DSL, and in a JSON form every one of
 * them reads `{"type":"spireHeight","target":10,"filters":{"dungeonKey":"mistspire"}}`. The
 * operator is thinking "reach floor 10 of the Mistspire".
 *
 * The one thing here that is a *rule* rather than phrasing is **accumulation**, and it is
 * the classic quest bug: a `count` goal sums what happened ("win 7 battles" is seven
 * reports of one), while a `highest` goal keeps a high-water mark ("reach +12 on a relic"
 * is satisfied by the best relic so far, and must not be satisfied by twelve relics at +1).
 * Getting it wrong ships a quest that either cannot be finished or finishes itself, so the
 * sentence says which kind it is — *Reach* against *Do* — rather than leaving an operator
 * to remember. The table mirrors the server's `GOAL_ACCUMULATION`; a test states it out
 * loud, because the Admin SPA does not depend on the game's packages.
 */

export type Accumulation = 'count' | 'highest';

export const GOAL_ACCUMULATION: Readonly<Record<string, Accumulation>> = {
  battleWin: 'count',
  stageClear: 'count',
  bossKill: 'count',
  useEnergy: 'count',
  summon: 'count',
  gearUpgrade: 'count',
  gearReforge: 'count',
  gearEquip: 'count',
  gearLevel: 'highest',
  championLevelUp: 'count',
  championRankUp: 'count',
  championAscend: 'count',
  championAwaken: 'count',
  masteryLearn: 'count',
  shopPurchase: 'count',
  arenaBattle: 'count',
  arenaWin: 'count',
  arenaTier: 'highest',
  chapterStars: 'highest',
  dungeonClear: 'count',
  accountLevel: 'highest',
  questClaim: 'count',
  claimAllDailies: 'count',
  championObtained: 'count',
  titanRun: 'count',
  expeditionClaim: 'count',
  trialsBeaten: 'highest',
  worldBossStrike: 'count',
  worldBossDamage: 'highest',
  deepRunFinished: 'count',
  deepRunDepth: 'highest',
  spireFloor: 'count',
  spireHeight: 'highest',
  titanDamage: 'highest',
};

/** What each goal type is, as the noun or verb phrase it belongs in. */
const GOAL_PHRASE: Readonly<Record<string, string>> = {
  battleWin: 'battles won',
  stageClear: 'stages cleared',
  bossKill: 'bosses felled',
  useEnergy: 'energy spent',
  summon: 'champions summoned',
  gearUpgrade: 'relic upgrades attempted',
  gearReforge: 'substats rerolled',
  gearEquip: 'relics equipped',
  gearLevel: 'relic level',
  championLevelUp: 'champion levels gained',
  championRankUp: 'rank-ups',
  championAscend: 'ascensions',
  championAwaken: 'awakenings',
  masteryLearn: 'masteries learned',
  shopPurchase: 'purchases',
  arenaBattle: 'arena battles fought',
  arenaWin: 'arena battles won',
  arenaTier: 'arena rung',
  chapterStars: 'stars in a chapter',
  dungeonClear: 'dungeon floors cleared',
  accountLevel: 'account level',
  questClaim: 'quests claimed',
  claimAllDailies: 'full days of dailies claimed',
  championObtained: 'champions obtained',
  titanRun: 'Titan runs',
  expeditionClaim: 'expeditions collected',
  trialsBeaten: 'trials beaten',
  worldBossStrike: 'world-boss strikes',
  worldBossDamage: 'damage to the world boss',
  deepRunFinished: 'Deep Runs finished',
  deepRunDepth: 'Deep Run depth',
  spireFloor: 'Mistspire floors cleared',
  spireHeight: 'Mistspire floor reached',
  titanDamage: 'damage to a Titan',
};

export interface GoalLike {
  type: string;
  target: number;
  filters?: Record<string, unknown>;
}

/** True where this goal type has a written phrase rather than the generic fallback. */
export function hasPhrase(type: string): boolean {
  return type in GOAL_PHRASE;
}

/** The filters, as the clause that narrows the sentence. */
function filterClause(filters: Record<string, unknown> | undefined): string {
  const entries = Object.entries(filters ?? {}).filter(
    ([, value]) => value !== '' && value != null,
  );
  if (entries.length === 0) return '';
  return ` (${entries.map(([field, value]) => `${humanizeKey(field).toLowerCase()}: ${String(value)}`).join(', ')})`;
}

/**
 * One goal as a sentence.
 *
 * `Reach` for a threshold and `Do` for a tally, because that difference is the whole of the
 * accumulation rule and it is invisible in the entity.
 */
export function goalSentence(goal: GoalLike): string {
  const phrase = GOAL_PHRASE[goal.type] ?? spaced(goal.type);
  const verb = GOAL_ACCUMULATION[goal.type] === 'highest' ? 'Reach' : '';
  const body = verb ? `Reach ${phrase} ${goal.target}` : `${goal.target} ${phrase}`;
  return `${body}${filterClause(goal.filters)}`;
}

/** `spireHeight` -> `spire height`. */
function spaced(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

export interface RewardsLike {
  [key: string]: number | undefined;
}

/**
 * A reward map, as a short list of "thing × n".
 *
 * The keys are currencies, reward scalars and item keys all in one map, which is what makes
 * paying anything a content edit — and what makes a raw map unreadable at a glance.
 */
export function rewardLines(rewards: RewardsLike | undefined): string[] {
  return Object.entries(rewards ?? {})
    .filter(([, amount]) => typeof amount === 'number' && amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => `${humanizeKey(key)} × ${Number(amount).toLocaleString()}`);
}

export interface ChainStep {
  key: string;
  step: number;
  name: string;
  arc: number;
  arcName: string;
}

export interface ChainProblem {
  step: number;
  message: string;
}

/**
 * Gaps and duplicates in a numbered chain.
 *
 * The Path is walked by `step` exactly as the tutorial script is, so a gap is a wall and a
 * duplicate is an ambiguity — both publish cleanly and both are invisible in a list sorted
 * by key. Reported here while an operator is still editing; the server is still the thing
 * that refuses.
 */
export function chainProblems(steps: readonly ChainStep[]): ChainProblem[] {
  if (steps.length === 0) return [];
  const out: ChainProblem[] = [];
  const counts = new Map<number, number>();
  for (const step of steps) counts.set(step.step, (counts.get(step.step) ?? 0) + 1);

  for (const [step, count] of [...counts.entries()].sort(([a], [b]) => a - b)) {
    if (count > 1) out.push({ step, message: `${count} missions share step ${step}.` });
  }

  const highest = Math.max(...steps.map((step) => step.step));
  for (let expected = 1; expected <= highest; expected += 1) {
    if (!counts.has(expected))
      out.push({ step: expected, message: `Step ${expected} is missing.` });
  }
  return out;
}

export type EventScheduleLike =
  | { kind: 'window'; startsAt?: string; endsAt?: string }
  | { kind: 'weekly'; startWeekday?: number; durationDays?: number }
  | { kind?: string; [field: string]: unknown };

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * An event's schedule as a sentence.
 *
 * Two kinds and they answer different questions: a `window` runs once between two instants,
 * a `weekly` recurs forever from a weekday. Printing them the same way — or printing the
 * raw object — is how an operator ends up thinking a recurring event is a one-off, which is
 * the difference between "this ends on Sunday" and "this comes back every Monday".
 */
export function scheduleSentence(schedule: EventScheduleLike | undefined): string {
  if (!schedule || typeof schedule !== 'object') return 'No schedule — it never runs.';
  if (schedule.kind === 'weekly') {
    const start = typeof schedule.startWeekday === 'number' ? schedule.startWeekday : 0;
    const days = typeof schedule.durationDays === 'number' ? schedule.durationDays : 1;
    return `Every ${WEEKDAYS[start] ?? 'week'} for ${days} day${days === 1 ? '' : 's'}, repeating.`;
  }
  if (schedule.kind === 'window') {
    const from = typeof schedule.startsAt === 'string' ? schedule.startsAt : '';
    const to = typeof schedule.endsAt === 'string' ? schedule.endsAt : '';
    if (!from && !to) return 'A window with no dates on it — it never runs.';
    return `Once, from ${from || 'unset'} to ${to || 'unset'}.`;
  }
  return `Unknown schedule kind "${String(schedule.kind ?? '')}".`;
}

export interface MilestoneLike {
  points: number;
  rewards?: RewardsLike;
}

export interface LadderProblem {
  index: number;
  message: string;
}

/**
 * What a milestone ladder gets wrong.
 *
 * A ladder is claimed by *reaching* a score, so a rung that is not above the one before it
 * is either unreachable or claimed at the same moment as its neighbour — and both look
 * perfectly ordinary in a list of numbers.
 */
export function ladderProblems(milestones: readonly MilestoneLike[]): LadderProblem[] {
  const out: LadderProblem[] = [];
  milestones.forEach((rung, index) => {
    const previous = milestones[index - 1];
    if (previous && rung.points <= previous.points) {
      out.push({
        index,
        message: `Rung ${index + 1} asks for ${rung.points.toLocaleString()} points, which is not above rung ${index}'s ${previous.points.toLocaleString()}.`,
      });
    }
    if (rewardLines(rung.rewards).length === 0) {
      out.push({ index, message: `Rung ${index + 1} pays nothing.` });
    }
  });
  return out;
}
