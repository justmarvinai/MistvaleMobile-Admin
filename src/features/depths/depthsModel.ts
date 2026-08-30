/**
 * The Depths, read as a keep rather than as a hundred and twenty separate stages
 * (ADMIN_SUITE_DESIGN §2.7).
 *
 * A dungeon's floors are ordinary `stage` entities carrying `parentKey` and `number`, which
 * is right — a floor is a fight and rides the same engine as every other — and it means the
 * generic browser shows a keep as a hundred rows in a list of four hundred, in key order,
 * with nothing to say which keep they belong to or how the descent scales. What an operator
 * retuning the Depths actually looks at is one keep's ladder: what level the enemies are at
 * each floor, what it costs, what falls out, and where the difficulty steps.
 *
 * Pure, because all of it is arithmetic on published content and none of it is a guess.
 */

export interface WaveUnitLike {
  enemyKey: string;
  level: number;
  stars?: number;
  slot: number;
}

export interface StageLike {
  key: string;
  mode?: string;
  parentKey?: string;
  number?: number;
  energyCost?: number;
  waves?: WaveUnitLike[][];
  starRules?: { maxTurns?: number; noDeaths?: boolean };
  unlock?: { playerLevel?: number };
  rewards?: {
    silverMin?: number;
    silverMax?: number;
    championXp?: number;
    drops?: { gearChance?: number; gearRankMin?: number; gearRankMax?: number; items?: unknown[] };
  };
}

export interface DungeonLike {
  key: string;
  name: string;
  kind: string;
  tagline?: string;
  floors: number;
  openDays?: number[];
  unlockLevel?: number;
  setKeys?: string[];
  itemKeys?: string[];
  bossEnemyKey?: string;
}

export interface Floor {
  number: number;
  key: string;
  /** The enemy levels across every wave — a band rather than a figure, since waves climb. */
  levelMin: number;
  levelMax: number;
  waves: number;
  enemies: number;
  energyCost: number;
  maxTurns: number | null;
  unlockLevel: number | null;
  gearChance: number | null;
  /** Which floor number this one steps up from, when the level band jumps. */
  stepFromPrevious: number;
}

/** Every published floor of one keep, in descent order. */
export function floorsOf(dungeon: DungeonLike, stages: readonly StageLike[]): Floor[] {
  const mine = stages
    .filter((stage) => stage.parentKey === dungeon.key)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  const out: Floor[] = [];
  for (const stage of mine) {
    const units = (stage.waves ?? []).flat();
    const levels = units.map((unit) => unit.level);
    const previous = out[out.length - 1];
    const levelMin = levels.length > 0 ? Math.min(...levels) : 0;
    const levelMax = levels.length > 0 ? Math.max(...levels) : 0;
    out.push({
      number: stage.number ?? out.length + 1,
      key: stage.key,
      levelMin,
      levelMax,
      waves: (stage.waves ?? []).length,
      enemies: units.length,
      energyCost: stage.energyCost ?? 0,
      maxTurns: stage.starRules?.maxTurns ?? null,
      unlockLevel: stage.unlock?.playerLevel ?? null,
      gearChance: stage.rewards?.drops?.gearChance ?? null,
      stepFromPrevious: previous ? levelMax - previous.levelMax : 0,
    });
  }
  return out;
}

export interface KeepProblem {
  /** The floor number the problem is about, or null when it is about the keep. */
  floor: number | null;
  message: string;
}

/**
 * What a keep gets wrong that publishes cleanly.
 *
 * Deliberately narrow: only faults that are certainly faults, stated as facts rather than
 * as balance opinions. A keep that is simply hard is not a problem, and a screen that cried
 * about every steep floor would be one nobody reads by the second week.
 */
export function keepProblems(dungeon: DungeonLike, floors: readonly Floor[]): KeepProblem[] {
  const out: KeepProblem[] = [];

  if (floors.length !== dungeon.floors) {
    out.push({
      floor: null,
      message: `The keep declares ${dungeon.floors} floors and ${floors.length} ${
        floors.length === 1 ? 'is' : 'are'
      } published. A player reaching the bottom of what exists would find nothing below it.`,
    });
  }

  const seen = new Set<number>();
  for (const floor of floors) {
    if (seen.has(floor.number)) {
      out.push({ floor: floor.number, message: `Two floors are numbered ${floor.number}.` });
    }
    seen.add(floor.number);
    if (floor.enemies === 0) {
      out.push({ floor: floor.number, message: 'No enemies — the floor would clear itself.' });
    }
    // A descent that gets *easier* is the one balance fault that is certainly a mistake
    // rather than a choice: the whole shape of a keep is that it goes down.
    if (floor.stepFromPrevious < 0) {
      out.push({
        floor: floor.number,
        message: `Enemies are ${-floor.stepFromPrevious} level${
          floor.stepFromPrevious === -1 ? '' : 's'
        } lower than the floor above.`,
      });
    }
  }

  // Numbering is what "floor N is open" is computed from, so a gap is a wall.
  for (let expected = 1; expected <= floors.length; expected += 1) {
    if (!seen.has(expected)) {
      out.push({ floor: expected, message: `Floor ${expected} is missing from the descent.` });
    }
  }

  return out;
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface OpenDay {
  /** 0 = Sunday, matching `dungeon.openDays`. */
  day: number;
  label: string;
  keys: string[];
}

/**
 * The rotation as a week.
 *
 * `openDays` is a list of numbers on each keep, so "which spring is open on Thursday" means
 * reading five entities and inverting five lists in your head. An empty list means *every*
 * day, which is the trap: read literally it looks like a keep that never opens.
 */
export function openWeek(dungeons: readonly DungeonLike[]): OpenDay[] {
  return WEEKDAYS.map((label, day) => ({
    day,
    label,
    keys: dungeons
      .filter((dungeon) => (dungeon.openDays ?? []).length === 0 || dungeon.openDays?.includes(day))
      .map((dungeon) => dungeon.key),
  }));
}

/** True where a keep is open every day — an empty `openDays`, not an unpublished one. */
export function opensDaily(dungeon: DungeonLike): boolean {
  return (dungeon.openDays ?? []).length === 0;
}
