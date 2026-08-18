import type { ContentEntry } from '@/api/types';

/**
 * The tutorial script, as the editor understands it.
 *
 * Pure: entries in, an ordered script and its problems out. Split from the page so the
 * two things worth being sure about — that the order shown is the order the game walks,
 * and that a reorder produces a numbering the server will accept — are testable without
 * a browser.
 */

export interface ScriptStep {
  key: string;
  state: ContentEntry['state'];
  step: number;
  title: string;
  screen: string;
  highlight: string;
  active: boolean;
  goal: { type: string; target: number } | null;
  /** How many things this step hands over, of any kind. */
  gives: number;
}

/** A problem publish validation would refuse, surfaced before an operator gets there. */
export interface ScriptProblem {
  severity: 'error' | 'warning';
  message: string;
}

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const count = (value: unknown): number =>
  value && typeof value === 'object' ? Object.keys(value).length : 0;

/** Reads the entries into steps, in the order the game walks them. */
export function readScript(entries: readonly ContentEntry[]): ScriptStep[] {
  return entries
    .map((entry) => {
      const data = entry.data;
      const goal = data.goal as { type?: unknown; target?: unknown } | undefined;
      return {
        key: entry.key,
        state: entry.state,
        step: num(data.step, 0),
        title: str(data.title) || entry.key,
        screen: str(data.screen),
        highlight: str(data.highlight),
        active: data.active !== false,
        goal: goal?.type ? { type: str(goal.type), target: num(goal.target, 1) } : null,
        gives:
          count(data.rewards) +
          count(data.grantsBefore) +
          (Array.isArray(data.grantsRelics) ? data.grantsRelics.length : 0),
      };
    })
    .sort((a, b) => a.step - b.step || a.key.localeCompare(b.key));
}

/**
 * What is wrong with the numbering, in the words publish will use.
 *
 * The same three rules `validate.ts` enforces server-side, checked here so an operator
 * finds out while they are editing rather than at the publish gate — and *only* here as a
 * courtesy: the server is still the thing that refuses.
 */
export function scriptProblems(steps: readonly ScriptStep[]): ScriptProblem[] {
  const problems: ScriptProblem[] = [];
  const seen = new Map<number, string[]>();
  for (const step of steps) seen.set(step.step, [...(seen.get(step.step) ?? []), step.key]);

  for (const [number, keys] of [...seen].sort((a, b) => a[0] - b[0])) {
    if (keys.length > 1) {
      problems.push({
        severity: 'error',
        message: `Step ${number} appears twice — ${keys.join(' and ')}. The script is walked by position, so one of them is unreachable.`,
      });
    }
  }

  for (let expected = 1; expected <= steps.length; expected += 1) {
    if (!seen.has(expected)) {
      problems.push({
        severity: 'error',
        message: `Step ${expected} is missing. A gap is a step nobody reaches, and everything after it shifts.`,
      });
    }
  }

  const inactive = steps.filter((step) => !step.active);
  if (inactive.length > 0) {
    problems.push({
      severity: 'warning',
      message: `${inactive.length} step${inactive.length === 1 ? ' is' : 's are'} deactivated and will be skipped entirely. A player's step count changes with them.`,
    });
  }

  return problems;
}

/**
 * The two writes a move needs.
 *
 * Reordering is a *swap* rather than a renumber of everything below: two entities change
 * instead of fifteen, which keeps the draft small and the publish diff readable. Returns
 * an empty list when the move would run off either end, so the caller does not have to
 * bounds-check before asking.
 */
export function moveStep(
  steps: readonly ScriptStep[],
  key: string,
  direction: -1 | 1,
): { key: string; step: number }[] {
  const index = steps.findIndex((step) => step.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= steps.length) return [];

  const moving = steps[index]!;
  const displaced = steps[target]!;
  return [
    { key: moving.key, step: displaced.step },
    { key: displaced.key, step: moving.step },
  ];
}
