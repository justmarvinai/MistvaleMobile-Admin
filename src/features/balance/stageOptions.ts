import type { ContentEntry } from '@/api/types';

/**
 * The stage picker's options, and the order they read in.
 *
 * There are four hundred stages and an operator arrives at this screen with one of them in
 * mind, so the list has to be searchable by the name they would say out loud — "1-7",
 * "brutal", "Sunken Stair" — rather than only by the key the database stores.
 *
 * Pure, and tested, because it is the whole of the picker's behaviour: a component that
 * built these labels inline would be arithmetic over four hundred rows that nothing could
 * reach.
 */

export interface StageOption {
  value: string;
  label: string;
}

/**
 * A picker group, in Mantine's own shape.
 *
 * Grouped rather than flat because four hundred options in one roll is a scroll bar and
 * nothing else — and because the shape is not optional: Mantine 7's `Select` reads
 * `{ group, items }`, and a flat option carrying a `group` field is silently ignored
 * (the first cut did exactly that and the component threw on `items.map`).
 */
export interface StageGroup {
  group: string;
  items: StageOption[];
}

interface StageShape {
  mode?: unknown;
  parentKey?: unknown;
  number?: unknown;
  difficulty?: unknown;
}

/**
 * A stage entry, as an option.
 *
 * The label is the key *and* the human reading, because the two answer different questions:
 * an operator who came from the entity browser has a key in their hand, and one who came
 * from a bug report has "chapter 3, hard". Mantine searches the label, so putting both in it
 * is what makes either work.
 */
export function stageOptions(
  entries: readonly ContentEntry[],
  names: ReadonlyMap<string, Place>,
): StageGroup[] {
  const rows = entries
    .map((entry) => {
      const data = entry.data as StageShape;
      const parentKey = typeof data.parentKey === 'string' ? data.parentKey : '';
      const number = typeof data.number === 'number' ? data.number : 0;
      const difficulty = typeof data.difficulty === 'string' ? data.difficulty : 'normal';
      const mode = typeof data.mode === 'string' ? data.mode : 'campaign';
      // A draft can hold anything an operator typed, and the list arrives as `unknown`
      // data, so every field is read defensively: an option that throws is a picker that
      // will not open.
      const found = parentKey ? names.get(parentKey) : undefined;
      const place = found?.name ?? parentKey ?? mode;
      // "Veilwood Fringe 1-7" for a chapter, "Emberhold · 3" for a keep — the same reading
      // the server's own label gives, so the picker and the result agree.
      const where =
        number > 0
          ? found?.number != null
            ? `${place} ${found.number}-${number}`
            : `${place} · ${number}`
          : place;
      const said = difficulty === 'normal' ? where : `${where} · ${difficulty}`;
      return {
        value: entry.key,
        label: `${said} — ${entry.key}`,
        group: place,
        sort: `${difficulty}|${String(number).padStart(3, '0')}|${entry.key}`,
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.sort.localeCompare(b.sort));

  const groups: StageGroup[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    const bucket = last?.group === row.group ? last : { group: row.group, items: [] };
    if (bucket !== last) groups.push(bucket);
    bucket.items.push({ value: row.value, label: row.label });
  }
  return groups;
}

/** Every option across every group — for a count, and for the tests. */
export function flatten(groups: readonly StageGroup[]): StageOption[] {
  return groups.flatMap((entry) => entry.items);
}

/** A place a stage belongs to: what it is called, and the chapter number if it has one. */
export interface Place {
  name: string;
  /** Chapters are numbered and stages inside them are said as "1-7"; keeps are not. */
  number: number | null;
}

/**
 * Chapter and dungeon names by key, so a stage can be named the way a player says it.
 *
 * The chapter's own **number** is carried as well as its name, because "Veilwood Fringe
 * 1-7" is how the game, the results screen and the server's own label all say it — and a
 * picker that said "Veilwood Fringe · 7" would be the one place in the project that does
 * not.
 */
export function placeNames(
  chapters: readonly ContentEntry[],
  dungeons: readonly ContentEntry[],
): Map<string, Place> {
  const places = new Map<string, Place>();
  for (const [entries, numbered] of [
    [chapters, true],
    [dungeons, false],
  ] as const) {
    for (const entry of entries) {
      const data = entry.data as { name?: unknown; number?: unknown };
      const name = typeof data.name === 'string' && data.name.length > 0 ? data.name : entry.key;
      const number = numbered && typeof data.number === 'number' ? data.number : null;
      places.set(entry.key, { name, number });
    }
  }
  return places;
}
