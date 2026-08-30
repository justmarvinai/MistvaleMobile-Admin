/**
 * The campaign as a grid (ADMIN_SUITE_DESIGN §2.6).
 *
 * The game repo's seed **generates** 252 campaign stages from twelve chapter plans, so an
 * editor whose job is creating rows would be the wrong tool: what an operator does here is
 * review and retune what the seed produced. Seven stage numbers by three difficulties is
 * the shape that question has — "is 4-6 Brutal out of line with 4-5" is one glance across
 * a row, where a flat list of 252 makes it a search.
 *
 * Everything here is pure and reads the ordinary content list, which already carries each
 * entity's whole body. A bespoke chapter endpoint would be a second answer to what a
 * chapter contains, and the first one is already right.
 */

/** The three difficulties, in the order the game unlocks them. */
export const DIFFICULTY_ORDER = ['normal', 'hard', 'brutal'] as const;
export type Difficulty = (typeof DIFFICULTY_ORDER)[number];

/** What the grid reads off a stage. Everything else about it belongs to its own editor. */
export interface StageRow {
  key: string;
  parentKey: string;
  number: number;
  difficulty: string;
  energyCost: number;
  waves: number;
  /** Enemy units across all waves — the crudest measure of how much stage this is. */
  units: number;
  /** Draft, live, or drafted-over-live, as the content browser reports it. */
  state: string;
}

/** One row of the content list: a key, the entity body, and its publish state. */
export interface ContentRow {
  key: string;
  data?: unknown;
  state: string;
}

/**
 * Reads a stage's coordinates off its **body** rather than off its key.
 *
 * The key happens to encode them today (`c04_s6_brutal`), and parsing it would work and be
 * wrong: the key is an identifier and `parentKey`, `number` and `difficulty` are fields.
 * A stage authored with any other key would silently vanish from the grid, which is the
 * kind of gap this view exists to reveal rather than create.
 */
export function stageRows(entries: readonly ContentRow[]): StageRow[] {
  return entries.flatMap((entry) => {
    const data = entry.data;
    if (typeof data !== 'object' || data === null) return [];
    const stage = data as {
      mode?: unknown;
      parentKey?: unknown;
      number?: unknown;
      difficulty?: unknown;
      energyCost?: unknown;
      waves?: unknown;
    };
    // Campaign only. The same `stage` type holds Depths floors, Spire floors, Trials and
    // the Titan, and none of them is laid out seven-by-three.
    if (stage.mode !== 'campaign') return [];
    if (typeof stage.parentKey !== 'string' || typeof stage.number !== 'number') return [];

    const waves = Array.isArray(stage.waves) ? stage.waves : [];
    return [
      {
        key: entry.key,
        state: entry.state,
        parentKey: stage.parentKey,
        number: stage.number,
        difficulty: typeof stage.difficulty === 'string' ? stage.difficulty : 'normal',
        energyCost: typeof stage.energyCost === 'number' ? stage.energyCost : 0,
        waves: waves.length,
        units: waves.reduce<number>(
          (total, wave) => total + (Array.isArray(wave) ? wave.length : 0),
          0,
        ),
      },
    ];
  });
}

/** The chapters that actually hold campaign stages, in chapter order. */
export function chaptersOf(rows: readonly StageRow[]): string[] {
  return [...new Set(rows.map((row) => row.parentKey))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

export interface GridCell {
  number: number;
  /** Null where a difficulty has no stage at that number. */
  byDifficulty: Record<string, StageRow | null>;
}

/**
 * One chapter as stage numbers by difficulty.
 *
 * A missing cell is kept as `null` rather than skipped: a chapter with six Brutal stages
 * and seven of everything else is a content fault, and a grid that quietly closed the gap
 * would hide the one thing this view exists to make obvious.
 */
export function gridFor(rows: readonly StageRow[], parentKey: string): GridCell[] {
  const mine = rows.filter((row) => row.parentKey === parentKey);
  const numbers = [...new Set(mine.map((row) => row.number))].sort((a, b) => a - b);
  return numbers.map((number) => ({
    number,
    byDifficulty: Object.fromEntries(
      DIFFICULTY_ORDER.map((difficulty) => [
        difficulty,
        mine.find((row) => row.number === number && row.difficulty === difficulty) ?? null,
      ]),
    ),
  }));
}

/** The cells a chapter is missing, named the way an operator would say them. */
export function gapsIn(grid: readonly GridCell[]): string[] {
  return grid.flatMap((cell) =>
    DIFFICULTY_ORDER.filter((difficulty) => cell.byDifficulty[difficulty] === null).map(
      (difficulty) => `${cell.number} ${difficulty}`,
    ),
  );
}
