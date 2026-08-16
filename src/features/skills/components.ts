import type { EffectComponent, EffectComponentType, EffectTarget } from '@/api/types';

/**
 * Effect-component algebra for the skills composer.
 *
 * Pure functions, deliberately separated from the React tree: the composer's real
 * behaviour is "what does the component list become after this edit", and that is what
 * the tests pin. The engine reads `components` positionally and switches on `type`
 * (COMBAT_SYSTEM §11), so order and exact field sets both matter.
 */

/** Fields that survive a type change — they mean the same thing on every component. */
const SHARED_FIELDS = ['condition', 'chance'] as const;

/**
 * A valid starting component per type.
 *
 * Defaults mirror the server schema's own defaults, so a freshly added component is
 * publishable without further editing.
 */
export function defaultComponent(type: EffectComponentType): EffectComponent {
  switch (type) {
    case 'damage':
      return { type: 'damage', scale: 'atk', mult: 2, hits: 1 };
    case 'applyStatus':
      return { type: 'applyStatus', status: '', turns: 2, target: 'hitTargets' };
    case 'heal':
      return { type: 'heal', scale: 'maxHp', mult: 0.15, target: 'self' };
    case 'shield':
      return { type: 'shield', scale: 'maxHp', mult: 0.15, turns: 2, target: 'self' };
    case 'turnMeter':
      return { type: 'turnMeter', deltaPct: 30, target: 'hitTargets' };
    case 'cleanse':
      return { type: 'cleanse', count: 1, target: 'allAllies' };
    case 'dispel':
      return { type: 'dispel', count: 1, target: 'hitTargets' };
    case 'extraTurn':
      return { type: 'extraTurn' };
    case 'cooldown':
      return { type: 'cooldown', delta: -1, target: 'self' };
  }
}

export function addComponent(
  components: EffectComponent[],
  type: EffectComponentType,
): EffectComponent[] {
  return [...components, defaultComponent(type)];
}

export function removeComponent(components: EffectComponent[], index: number): EffectComponent[] {
  if (index < 0 || index >= components.length) return components;
  return components.filter((_, position) => position !== index);
}

/** Moves a component to a new position, clamping rather than throwing on a bad index. */
export function moveComponent(
  components: EffectComponent[],
  from: number,
  to: number,
): EffectComponent[] {
  if (from < 0 || from >= components.length) return components;
  if (to < 0 || to >= components.length || from === to) return components;

  const next = [...components];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return components;
  next.splice(to, 0, moved);
  return next;
}

export function updateComponent(
  components: EffectComponent[],
  index: number,
  next: EffectComponent,
): EffectComponent[] {
  if (index < 0 || index >= components.length) return components;
  return components.map((component, position) => (position === index ? next : component));
}

/**
 * Retypes a component in place.
 *
 * Keeps only the fields that mean the same thing on the new type — anything else would
 * be silently stripped by the server's schema and would then show up in the publish diff
 * as a phantom change.
 */
export function changeComponentType(
  components: EffectComponent[],
  index: number,
  type: EffectComponentType,
): EffectComponent[] {
  const current = components[index];
  if (current === undefined) return components;
  if (current.type === type) return components;

  const replacement = defaultComponent(type);
  const carried: Record<string, unknown> = {};
  for (const field of SHARED_FIELDS) {
    const value = Reflect.get(current, field);
    if (value !== undefined) carried[field] = value;
  }

  // `target` also survives wherever both types accept one — losing the operator's
  // targeting choice on a retype would be a needless step backwards.
  if (hasTarget(current) && hasTarget(replacement)) {
    carried.target = current.target;
  }

  return updateComponent(components, index, { ...replacement, ...carried } as EffectComponent);
}

function hasTarget(
  component: EffectComponent,
): component is EffectComponent & { target: EffectTarget } {
  return 'target' in component;
}

/**
 * Strips fields the server's schema does not accept for a component's type.
 *
 * The editor keeps values around while an operator flips between types; only this
 * function decides what is actually written, so a retype never leaves debris behind.
 */
export function serializeComponent(component: EffectComponent): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[component.type];
  const output: Record<string, unknown> = { type: component.type };

  for (const field of allowed) {
    const value = Reflect.get(component, field);
    if (value === undefined) continue;
    // An empty status key is a placeholder for "not chosen yet", not a value.
    if (field === 'status' && value === '') continue;
    output[field] = value;
  }
  return output;
}

export function serializeComponents(components: EffectComponent[]): Record<string, unknown>[] {
  return components.map(serializeComponent);
}

/** The exact field set the server accepts per component type (effects.ts). */
const ALLOWED_FIELDS: Record<EffectComponentType, readonly string[]> = {
  damage: ['scale', 'mult', 'hits', 'ignoreDefPct', 'element', 'condition', 'chance'],
  applyStatus: ['status', 'turns', 'target', 'condition', 'chance'],
  heal: ['scale', 'mult', 'target', 'condition', 'chance'],
  shield: ['scale', 'mult', 'turns', 'target', 'condition', 'chance'],
  turnMeter: ['deltaPct', 'target', 'condition', 'chance'],
  cleanse: ['count', 'target', 'condition', 'chance'],
  dispel: ['count', 'target', 'condition', 'chance'],
  extraTurn: ['condition', 'chance'],
  cooldown: ['delta', 'target', 'condition', 'chance'],
};

/** Human-readable labels for the composer's type picker and summaries. */
export const COMPONENT_LABELS: Record<EffectComponentType, string> = {
  damage: 'Damage',
  applyStatus: 'Apply status',
  heal: 'Heal',
  shield: 'Shield',
  turnMeter: 'Turn meter',
  cleanse: 'Cleanse',
  dispel: 'Dispel',
  extraTurn: 'Extra turn',
  cooldown: 'Cooldown',
};

export const TARGET_LABELS: Record<EffectTarget, string> = {
  hitTargets: 'Targets this skill hit',
  self: 'Self',
  allAllies: 'All allies',
  lowestHpAlly: 'Lowest-HP ally',
  randomAlly: 'Random ally',
  allEnemies: 'All enemies',
};

const SCALE_LABELS: Record<string, string> = {
  atk: 'ATK',
  def: 'DEF',
  maxHp: 'MAX HP',
  spd: 'SPD',
};

/** One line describing a component, for the collapsed card header. */
export function describeComponent(component: EffectComponent): string {
  const chance =
    component.chance !== undefined && component.chance < 1
      ? ` (${Math.round(component.chance * 100)}%)`
      : '';

  switch (component.type) {
    case 'damage': {
      const hits = component.hits > 1 ? `${component.hits} × ` : '';
      const pierce =
        component.ignoreDefPct !== undefined && component.ignoreDefPct > 0
          ? `, ignores ${Math.round(component.ignoreDefPct * 100)}% DEF`
          : '';
      return `${hits}${component.mult} × ${SCALE_LABELS[component.scale] ?? component.scale}${pierce}${chance}`;
    }
    case 'applyStatus':
      return `${component.status || '(no status)'} for ${component.turns} ${
        component.turns === 1 ? 'turn' : 'turns'
      } → ${TARGET_LABELS[component.target]}${chance}`;
    case 'heal':
      return `${component.mult} × ${SCALE_LABELS[component.scale] ?? component.scale} → ${TARGET_LABELS[component.target]}${chance}`;
    case 'shield':
      return `${component.mult} × ${SCALE_LABELS[component.scale] ?? component.scale} for ${component.turns} ${
        component.turns === 1 ? 'turn' : 'turns'
      } → ${TARGET_LABELS[component.target]}${chance}`;
    case 'turnMeter':
      return `${component.deltaPct > 0 ? '+' : ''}${component.deltaPct}% → ${TARGET_LABELS[component.target]}${chance}`;
    case 'cleanse':
      return `${component.count === 'all' ? 'all' : component.count} debuff${component.count === 1 ? '' : 's'} → ${TARGET_LABELS[component.target]}${chance}`;
    case 'dispel':
      return `${component.count === 'all' ? 'all' : component.count} buff${component.count === 1 ? '' : 's'} → ${TARGET_LABELS[component.target]}${chance}`;
    case 'extraTurn':
      return `Take another turn${chance}`;
    case 'cooldown':
      return `${component.delta > 0 ? '+' : ''}${component.delta} turn${Math.abs(component.delta) === 1 ? '' : 's'} → ${TARGET_LABELS[component.target]}${chance}`;
  }
}

/**
 * Fills `{dmg}`, `{chance}` and `{turns}` from the components
 * (ADMIN_SUITE_DESIGN §2.3: "text never lies about numbers").
 *
 * A placeholder with nothing to fill it is left as-is rather than blanked, so the
 * operator can see which one has no source.
 */
export function resolveDescription(template: string, components: EffectComponent[]): string {
  const damage = components.find((component) => component.type === 'damage');
  const withChance = components.find((component) => component.chance !== undefined);
  const withTurns = components.find(
    (component) => 'turns' in component && typeof component.turns === 'number',
  );

  return template
    .replace(/\{dmg\}/g, () => {
      if (!damage || damage.type !== 'damage') return '{dmg}';
      const hits = damage.hits > 1 ? `${damage.hits} × ` : '';
      return `${hits}${damage.mult} × ${SCALE_LABELS[damage.scale] ?? damage.scale}`;
    })
    .replace(/\{chance\}/g, () => {
      if (!withChance || withChance.chance === undefined) return '{chance}';
      return `${Math.round(withChance.chance * 100)}%`;
    })
    .replace(/\{turns\}/g, () => {
      if (!withTurns || !('turns' in withTurns)) return '{turns}';
      return String(withTurns.turns);
    });
}

/**
 * Problems the server would reject or warn about, surfaced while typing.
 *
 * Mirrors `apps/server/src/content/validate.ts` — an unknown status key and an A1 with a
 * cooldown are publish-blocking errors there, so they are errors here too.
 */
export interface ComposerIssue {
  severity: 'error' | 'warning';
  /** Index of the offending component, or undefined for skill-level problems. */
  index?: number;
  message: string;
}

export function inspectSkill(input: {
  slot: string;
  cooldown: number;
  components: EffectComponent[];
  knownStatusKeys: ReadonlySet<string>;
}): ComposerIssue[] {
  const issues: ComposerIssue[] = [];

  if (input.components.length === 0) {
    issues.push({ severity: 'error', message: 'A skill needs at least one effect component.' });
  }
  if (input.components.length > 8) {
    issues.push({ severity: 'error', message: 'At most eight effect components.' });
  }

  input.components.forEach((component, index) => {
    if (component.type !== 'applyStatus') return;
    if (!component.status) {
      issues.push({ severity: 'error', index, message: 'Pick a status effect to apply.' });
      return;
    }
    if (!input.knownStatusKeys.has(component.status)) {
      issues.push({
        severity: 'error',
        index,
        message: `No status effect named “${component.status}” exists. Publish would reject this skill.`,
      });
    }
  });

  // A1s are what Provoke and counterattacks fall back to; a cooldown there can leave a
  // unit with no legal action.
  if (input.slot === 'a1' && input.cooldown > 0) {
    issues.push({ severity: 'error', message: 'A1 skills must have no cooldown.' });
  }
  if (input.slot !== 'a1' && input.slot !== 'passive' && input.cooldown === 0) {
    issues.push({
      severity: 'warning',
      message: 'An active skill with no cooldown can be used every turn.',
    });
  }

  return issues;
}
