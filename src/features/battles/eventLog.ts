/**
 * Reading the engine's event log (ADMIN_SUITE_DESIGN §2.18).
 *
 * The log is the record of the fight rather than a description of it, so nothing here
 * interprets an event — it only groups and filters. Two operators looking at one battle
 * must see the same fight, and the only way to guarantee that is for the viewer to add
 * nothing.
 */

export interface LogEvent {
  type: string;
  [key: string]: unknown;
}

export interface Turn {
  /** The turn number the engine stamped, or 0 for anything before the first turn began. */
  turn: number;
  events: LogEvent[];
}

/** Anything the log can carry, narrowed to the shape this viewer reads. */
export function asEvents(raw: readonly unknown[]): LogEvent[] {
  return raw.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const type = (entry as { type?: unknown }).type;
    return typeof type === 'string' ? [{ ...(entry as object), type } as LogEvent] : [];
  });
}

/**
 * Splits the log into turns.
 *
 * On `turnStart`, which is the engine's own boundary — inferring one from anything else
 * would be the viewer deciding what a turn is, which is the engine's business. Events
 * before the first `turnStart` (the opening snapshot, the first wave) are kept in a turn
 * **0** rather than dropped: they are the setup, and "what did this fight start with" is
 * one of the two questions anybody opens this for.
 */
export function turnsOf(events: readonly LogEvent[]): Turn[] {
  const turns: Turn[] = [];
  let current: Turn = { turn: 0, events: [] };

  for (const event of events) {
    if (event.type === 'turnStart') {
      // The setup turn is only kept when something actually happened in it, so a log that
      // opens straight into a turn does not show an empty row above it.
      if (current.events.length > 0) turns.push(current);
      const turn = typeof event.turn === 'number' ? event.turn : turns.length + 1;
      current = { turn, events: [event] };
      continue;
    }
    current.events.push(event);
  }
  if (current.events.length > 0) turns.push(current);
  return turns;
}

/** Every unit the log mentions, so the filter can offer them. */
export function actorsOf(events: readonly LogEvent[]): string[] {
  const seen = new Set<string>();
  for (const event of events) {
    for (const key of ['unit', 'source', 'target'] as const) {
      const ref = event[key];
      if (typeof ref !== 'object' || ref === null) continue;
      const { side, slot } = ref as { side?: unknown; slot?: unknown };
      if (typeof side === 'string' && typeof slot === 'number') seen.add(`${side}:${slot}`);
    }
  }
  return [...seen].sort();
}

/** Every event type present, likewise. */
export function typesOf(events: readonly LogEvent[]): string[] {
  return [...new Set(events.map((event) => event.type))].sort();
}

/** Whether an event involves a unit, on any of the three refs an event can carry. */
export function mentions(event: LogEvent, actor: string): boolean {
  for (const key of ['unit', 'source', 'target'] as const) {
    const ref = event[key];
    if (typeof ref !== 'object' || ref === null) continue;
    const { side, slot } = ref as { side?: unknown; slot?: unknown };
    if (`${String(side)}:${String(slot)}` === actor) return true;
  }
  return false;
}

/**
 * Narrows a turn list, keeping a turn only when something in it survived the filter.
 *
 * Keeping empty turns would be honest and useless — an operator filtering to one champion
 * wants that champion's fight, not three hundred blank rows with theirs scattered in.
 */
export function filterTurns(
  turns: readonly Turn[],
  filter: { actor?: string; type?: string },
): Turn[] {
  if (!filter.actor && !filter.type) return [...turns];
  return turns
    .map((turn) => ({
      turn: turn.turn,
      events: turn.events.filter(
        (event) =>
          (!filter.type || event.type === filter.type) &&
          (!filter.actor || mentions(event, filter.actor)),
      ),
    }))
    .filter((turn) => turn.events.length > 0);
}
