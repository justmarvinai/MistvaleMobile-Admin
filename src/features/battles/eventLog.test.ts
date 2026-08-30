import { describe, expect, it } from 'vitest';
import { actorsOf, asEvents, filterTurns, mentions, turnsOf, typesOf } from './eventLog';

/**
 * The battle inspector's log reading.
 *
 * All of it is pure, and it has to be: the viewer's whole contract is that it adds nothing
 * to the record. What is pinned here is the grouping and the filtering — the two places a
 * viewer could quietly change what an operator believes happened.
 */

const ALLY = { side: 'ally', slot: 0 };
const FOE = { side: 'enemy', slot: 1 };

const LOG = [
  { type: 'battleStart', allies: [], enemies: [] },
  { type: 'waveStart', enemies: [] },
  { type: 'turnStart', unit: ALLY, turn: 1 },
  { type: 'damage', source: ALLY, target: FOE, amount: 100 },
  { type: 'turnStart', unit: FOE, turn: 2 },
  { type: 'damage', source: FOE, target: ALLY, amount: 40 },
];

describe('asEvents', () => {
  it('keeps only what carries a type, so a pruned log does not crash the viewer', () => {
    expect(asEvents([{ type: 'damage' }, null, 7, { noType: true }])).toEqual([{ type: 'damage' }]);
  });
});

describe('turnsOf', () => {
  it('splits on the engine’s own turn boundary rather than inventing one', () => {
    const turns = turnsOf(asEvents(LOG));
    expect(turns.map((turn) => turn.turn)).toEqual([0, 1, 2]);
  });

  it('keeps the setup in a turn zero rather than dropping it', () => {
    // "What did this fight start with" is one of the two questions anybody opens this for.
    const turns = turnsOf(asEvents(LOG));
    expect(turns[0]?.events.map((event) => event.type)).toEqual(['battleStart', 'waveStart']);
  });

  it('shows no empty setup row when the log opens straight into a turn', () => {
    const turns = turnsOf(asEvents([{ type: 'turnStart', turn: 1 }]));
    expect(turns).toHaveLength(1);
    expect(turns[0]?.turn).toBe(1);
  });

  it('reads nothing out of an empty log rather than one empty turn', () => {
    expect(turnsOf([])).toEqual([]);
  });
});

describe('mentions', () => {
  it('matches a unit on any of the three refs an event can carry', () => {
    expect(mentions({ type: 'turnStart', unit: ALLY }, 'ally:0')).toBe(true);
    expect(mentions({ type: 'damage', source: ALLY, target: FOE }, 'enemy:1')).toBe(true);
    expect(mentions({ type: 'damage', source: ALLY, target: FOE }, 'ally:3')).toBe(false);
  });

  it('does not match an event with no refs at all', () => {
    expect(mentions({ type: 'battleEnd', outcome: 'victory' }, 'ally:0')).toBe(false);
  });
});

describe('filterTurns', () => {
  it('drops a turn nothing survived, rather than leaving it blank', () => {
    // An operator filtering to one champion wants that champion's fight, not three hundred
    // blank rows with theirs scattered in.
    const filtered = filterTurns(turnsOf(asEvents(LOG)), { type: 'damage' });
    expect(filtered.map((turn) => turn.turn)).toEqual([1, 2]);
    expect(filtered.every((turn) => turn.events.every((e) => e.type === 'damage'))).toBe(true);
  });

  it('combines a unit and a type rather than picking one', () => {
    const filtered = filterTurns(turnsOf(asEvents(LOG)), { actor: 'enemy:1', type: 'damage' });
    expect(filtered).toHaveLength(2);
  });

  it('hands the whole log back when nothing is filtered', () => {
    const turns = turnsOf(asEvents(LOG));
    expect(filterTurns(turns, {})).toEqual(turns);
  });
});

describe('the filter vocabularies', () => {
  it('offer every unit and every type the log mentions', () => {
    const events = asEvents(LOG);
    expect(actorsOf(events)).toEqual(['ally:0', 'enemy:1']);
    expect(typesOf(events)).toEqual(['battleStart', 'damage', 'turnStart', 'waveStart']);
  });
});
