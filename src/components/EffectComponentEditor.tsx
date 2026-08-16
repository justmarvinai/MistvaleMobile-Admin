import type { ReactNode } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import {
  EFFECT_COMPONENT_TYPES,
  EFFECT_CONDITION_TYPES,
  EFFECT_TARGETS,
  ELEMENTS,
  SCALING_STATS,
  type EffectComponent,
  type EffectComponentType,
  type EffectCondition,
  type EffectConditionType,
  type EffectTarget,
} from '@/api/types';
import {
  addComponent,
  changeComponentType,
  COMPONENT_LABELS,
  describeComponent,
  moveComponent,
  removeComponent,
  TARGET_LABELS,
  updateComponent,
  type ComposerIssue,
} from '@/features/skills/components';
import { humanizeKey } from '@/lib/format';

/**
 * The effect-component editor — the shared primitive behind the skills composer
 * (ADMIN_SUITE_DESIGN §2.3), and the same editor enemy kits will use.
 *
 * One card per component, rendering the fields of *its own* discriminated-union arm and
 * nothing else. Retyping a component keeps only what carries over, so the payload always
 * matches exactly one arm of the engine's contract.
 */
export function EffectComponentEditor({
  components,
  onChange,
  statusOptions,
  issues,
}: {
  components: EffectComponent[];
  onChange: (next: EffectComponent[]) => void;
  /** Real status keys from the server — never free text, since publish checks them. */
  statusOptions: { value: string; label: string }[];
  issues: ComposerIssue[];
}): ReactNode {
  const issuesFor = (index: number): ComposerIssue[] =>
    issues.filter((issue) => issue.index === index);

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <div>
          <Text size="sm" fw={500}>
            Effect components
          </Text>
          <Text size="xs" c="dimmed">
            Run in order, top to bottom. Up to eight.
          </Text>
        </div>
        <Group gap="sm">
          <Badge size="sm" variant="light" color={components.length === 0 ? 'red' : 'gray'}>
            {components.length}/8
          </Badge>
          <AddComponentMenu
            disabled={components.length >= 8}
            onAdd={(type) => onChange(addComponent(components, type))}
          />
        </Group>
      </Group>

      {components.length === 0 && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
          <Text size="sm">
            A skill with no components does nothing. Add at least one — most kits start with a
            Damage component.
          </Text>
        </Alert>
      )}

      {components.map((component, index) => (
        <ComponentCard
          key={index}
          component={component}
          index={index}
          total={components.length}
          statusOptions={statusOptions}
          issues={issuesFor(index)}
          onChange={(next) => onChange(updateComponent(components, index, next))}
          onRetype={(type) => onChange(changeComponentType(components, index, type))}
          onMove={(delta) => onChange(moveComponent(components, index, index + delta))}
          onRemove={() => onChange(removeComponent(components, index))}
        />
      ))}
    </Stack>
  );
}

function AddComponentMenu({
  onAdd,
  disabled,
}: {
  onAdd: (type: EffectComponentType) => void;
  disabled: boolean;
}): ReactNode {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          size="compact-sm"
          variant="light"
          color="mist"
          leftSection={<IconPlus size={14} />}
          disabled={disabled}
        >
          Add component
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Effects the engine implements</Menu.Label>
        {EFFECT_COMPONENT_TYPES.map((type) => (
          <Menu.Item key={type} onClick={() => onAdd(type)}>
            {COMPONENT_LABELS[type]}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

function ComponentCard({
  component,
  index,
  total,
  statusOptions,
  issues,
  onChange,
  onRetype,
  onMove,
  onRemove,
}: {
  component: EffectComponent;
  index: number;
  total: number;
  statusOptions: { value: string; label: string }[];
  issues: ComposerIssue[];
  onChange: (next: EffectComponent) => void;
  onRetype: (type: EffectComponentType) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}): ReactNode {
  const hasError = issues.some((issue) => issue.severity === 'error');

  return (
    <Card
      p="sm"
      bg="dark.8"
      style={hasError ? { borderColor: 'var(--mantine-color-red-8)' } : undefined}
      data-testid={`component-${index}`}
    >
      <Group justify="space-between" wrap="nowrap" mb="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Badge size="sm" variant="filled" color="gray" circle>
            {index + 1}
          </Badge>
          <Select
            data={EFFECT_COMPONENT_TYPES.map((type) => ({
              value: type,
              label: COMPONENT_LABELS[type],
            }))}
            value={component.type}
            onChange={(next) => next && onRetype(asComponentType(next, component.type))}
            allowDeselect={false}
            size="xs"
            w={150}
            aria-label={`Component ${index + 1} type`}
          />
          <Text size="xs" c="dimmed" truncate>
            {describeComponent(component)}
          </Text>
        </Group>

        <Group gap={2} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move component ${index + 1} up`}
          >
            <IconArrowUp size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Move component ${index + 1} down`}
          >
            <IconArrowDown size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={onRemove}
            aria-label={`Remove component ${index + 1}`}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Stack gap="sm">
        <ComponentFields component={component} statusOptions={statusOptions} onChange={onChange} />

        <SharedFields component={component} statusOptions={statusOptions} onChange={onChange} />

        {issues.map((issue) => (
          <Text key={issue.message} size="xs" c={issue.severity === 'error' ? 'red' : 'yellow'}>
            {issue.message}
          </Text>
        ))}
      </Stack>
    </Card>
  );
}

/** The fields belonging to one arm of the union. */
function ComponentFields({
  component,
  statusOptions,
  onChange,
}: {
  component: EffectComponent;
  statusOptions: { value: string; label: string }[];
  onChange: (next: EffectComponent) => void;
}): ReactNode {
  switch (component.type) {
    case 'damage':
      return (
        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
          <ScaleSelect
            value={component.scale}
            onChange={(scale) => onChange({ ...component, scale })}
          />
          <NumberInput
            label="Multiplier"
            description="× the scaling stat"
            value={component.mult}
            onChange={(next) => onChange({ ...component, mult: toNumber(next, component.mult) })}
            min={0}
            max={20}
            step={0.1}
            decimalScale={2}
            clampBehavior="strict"
          />
          <NumberInput
            label="Hits"
            description="Each rolls crit separately"
            value={component.hits}
            onChange={(next) => onChange({ ...component, hits: toInt(next, component.hits) })}
            min={1}
            max={6}
            clampBehavior="strict"
          />
          <NumberInput
            label="Ignore DEF %"
            description="0–100"
            value={
              component.ignoreDefPct === undefined ? '' : Math.round(component.ignoreDefPct * 100)
            }
            onChange={(next) => {
              const parsed = typeof next === 'number' ? next : Number.parseFloat(next);
              onChange({
                ...component,
                ignoreDefPct: Number.isFinite(parsed) ? clamp(parsed, 0, 100) / 100 : undefined,
              });
            }}
            min={0}
            max={100}
            clampBehavior="strict"
          />
          <Select
            label="Element"
            description="Overrides the caster's"
            data={ELEMENTS.map((element) => ({ value: element, label: humanizeKey(element) }))}
            value={component.element ?? null}
            onChange={(next) =>
              onChange({ ...component, element: next ? asElement(next) : undefined })
            }
            clearable
            placeholder="caster's"
          />
        </SimpleGrid>
      );

    case 'applyStatus':
      return (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Select
            label="Status"
            description="From the status catalog"
            data={statusOptions}
            value={component.status || null}
            onChange={(next) => onChange({ ...component, status: next ?? '' })}
            searchable
            nothingFoundMessage="No such status — create it in Status effects."
            error={component.status === '' ? 'Required' : undefined}
          />
          <NumberInput
            label="Turns"
            value={component.turns}
            onChange={(next) => onChange({ ...component, turns: toInt(next, component.turns) })}
            min={1}
            max={10}
            clampBehavior="strict"
          />
          <TargetSelect
            value={component.target}
            onChange={(target) => onChange({ ...component, target })}
          />
        </SimpleGrid>
      );

    case 'heal':
      return (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <ScaleSelect
            value={component.scale}
            onChange={(scale) => onChange({ ...component, scale })}
          />
          <NumberInput
            label="Multiplier"
            description="× the scaling stat"
            value={component.mult}
            onChange={(next) => onChange({ ...component, mult: toNumber(next, component.mult) })}
            min={0}
            max={5}
            step={0.05}
            decimalScale={2}
            clampBehavior="strict"
          />
          <TargetSelect
            value={component.target}
            onChange={(target) => onChange({ ...component, target })}
          />
        </SimpleGrid>
      );

    case 'shield':
      return (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <ScaleSelect
            value={component.scale}
            onChange={(scale) => onChange({ ...component, scale })}
          />
          <NumberInput
            label="Multiplier"
            value={component.mult}
            onChange={(next) => onChange({ ...component, mult: toNumber(next, component.mult) })}
            min={0}
            max={5}
            step={0.05}
            decimalScale={2}
            clampBehavior="strict"
          />
          <NumberInput
            label="Turns"
            value={component.turns}
            onChange={(next) => onChange({ ...component, turns: toInt(next, component.turns) })}
            min={1}
            max={10}
            clampBehavior="strict"
          />
          <TargetSelect
            value={component.target}
            onChange={(target) => onChange({ ...component, target })}
          />
        </SimpleGrid>
      );

    case 'turnMeter':
      return (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            label="Turn meter change %"
            description="Positive fills, negative depletes"
            value={component.deltaPct}
            onChange={(next) =>
              onChange({ ...component, deltaPct: toInt(next, component.deltaPct) })
            }
            min={-100}
            max={100}
            clampBehavior="strict"
            allowNegative
          />
          <TargetSelect
            value={component.target}
            onChange={(target) => onChange({ ...component, target })}
          />
        </SimpleGrid>
      );

    case 'cleanse':
    case 'dispel': {
      const noun = component.type === 'cleanse' ? 'debuffs' : 'buffs';
      const all = component.count === 'all';
      return (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Switch
            label={`Remove all ${noun}`}
            checked={all}
            onChange={(event) =>
              onChange({ ...component, count: event.currentTarget.checked ? 'all' : 1 })
            }
            mt="lg"
          />
          <NumberInput
            label={`How many ${noun}`}
            value={all ? '' : component.count}
            onChange={(next) => onChange({ ...component, count: toInt(next, 1) })}
            min={1}
            max={10}
            clampBehavior="strict"
            disabled={all}
          />
          <TargetSelect
            value={component.target}
            onChange={(target) => onChange({ ...component, target })}
          />
        </SimpleGrid>
      );
    }

    case 'extraTurn':
      return (
        <Text size="xs" c="dimmed">
          The caster acts again immediately. Pair it with a chance below to make it a proc rather
          than a guarantee.
        </Text>
      );

    case 'cooldown':
      return (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            label="Cooldown change"
            description="Negative reduces the caster's own; positive extends the target's"
            value={component.delta}
            onChange={(next) => onChange({ ...component, delta: toInt(next, component.delta) })}
            min={-3}
            max={3}
            clampBehavior="strict"
            allowNegative
          />
          <TargetSelect
            value={component.target}
            onChange={(target) => onChange({ ...component, target })}
          />
        </SimpleGrid>
      );
  }
}

/** Chance and condition, which every component type accepts. */
function SharedFields({
  component,
  statusOptions,
  onChange,
}: {
  component: EffectComponent;
  statusOptions: { value: string; label: string }[];
  onChange: (next: EffectComponent) => void;
}): ReactNode {
  const condition = component.condition;

  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
      <NumberInput
        label="Chance %"
        description="Blank means always. Debuffs still roll ACC vs RES."
        value={component.chance === undefined ? '' : Math.round(component.chance * 100)}
        onChange={(next) => {
          const parsed = typeof next === 'number' ? next : Number.parseFloat(next);
          onChange({
            ...component,
            chance: Number.isFinite(parsed) ? clamp(parsed, 0, 100) / 100 : undefined,
          } as EffectComponent);
        }}
        min={0}
        max={100}
        clampBehavior="strict"
        placeholder="always"
      />

      <Select
        label="Only if…"
        description="Gates this component"
        data={EFFECT_CONDITION_TYPES.map((type) => ({
          value: type,
          label: CONDITION_LABELS[type],
        }))}
        value={condition?.type ?? null}
        onChange={(next) =>
          onChange({
            ...component,
            condition: next ? defaultCondition(asConditionType(next)) : undefined,
          } as EffectComponent)
        }
        clearable
        placeholder="no condition"
      />

      {condition && (
        <ConditionValue
          condition={condition}
          statusOptions={statusOptions}
          onChange={(next) => onChange({ ...component, condition: next } as EffectComponent)}
        />
      )}
    </SimpleGrid>
  );
}

function ConditionValue({
  condition,
  statusOptions,
  onChange,
}: {
  condition: EffectCondition;
  statusOptions: { value: string; label: string }[];
  onChange: (next: EffectCondition) => void;
}): ReactNode {
  if (condition.type === 'targetHasStatus' || condition.type === 'targetMissingStatus') {
    return (
      <Select
        label="Status"
        data={statusOptions}
        value={condition.status || null}
        onChange={(next) => onChange({ ...condition, status: next ?? '' })}
        searchable
        error={condition.status === '' ? 'Required' : undefined}
      />
    );
  }
  if (condition.type === 'alliesDead') {
    return (
      <NumberInput
        label="Allies dead, at least"
        value={condition.atLeast}
        onChange={(next) => onChange({ ...condition, atLeast: toInt(next, condition.atLeast) })}
        min={1}
        max={3}
        clampBehavior="strict"
      />
    );
  }
  return (
    <NumberInput
      label="HP below %"
      value={condition.pct}
      onChange={(next) => onChange({ ...condition, pct: toNumber(next, condition.pct) })}
      min={0}
      max={100}
      clampBehavior="strict"
    />
  );
}

const CONDITION_LABELS: Record<EffectConditionType, string> = {
  targetHasStatus: 'Target has status',
  targetMissingStatus: 'Target lacks status',
  selfHpBelow: 'Own HP below',
  targetHpBelow: 'Target HP below',
  alliesDead: 'Allies dead',
};

function defaultCondition(type: EffectConditionType): EffectCondition {
  switch (type) {
    case 'targetHasStatus':
      return { type, status: '' };
    case 'targetMissingStatus':
      return { type, status: '' };
    case 'selfHpBelow':
      return { type, pct: 50 };
    case 'targetHpBelow':
      return { type, pct: 50 };
    case 'alliesDead':
      return { type, atLeast: 1 };
  }
}

function ScaleSelect({
  value,
  onChange,
}: {
  value: (typeof SCALING_STATS)[number];
  onChange: (next: (typeof SCALING_STATS)[number]) => void;
}): ReactNode {
  return (
    <Select
      label="Scales from"
      data={SCALING_STATS.map((stat) => ({ value: stat, label: humanizeKey(stat).toUpperCase() }))}
      value={value}
      onChange={(next) => next && onChange(asScale(next, value))}
      allowDeselect={false}
    />
  );
}

function TargetSelect({
  value,
  onChange,
}: {
  value: EffectTarget;
  onChange: (next: EffectTarget) => void;
}): ReactNode {
  return (
    <Tooltip
      label="“Targets this skill hit” follows the skill's own targeting; the rest address the caster's side directly."
      withArrow
      multiline
      w={280}
    >
      <Select
        label="Applies to"
        data={EFFECT_TARGETS.map((target) => ({ value: target, label: TARGET_LABELS[target] }))}
        value={value}
        onChange={(next) => next && onChange(asTarget(next, value))}
        allowDeselect={false}
      />
    </Tooltip>
  );
}

function toInt(next: string | number, fallback: number): number {
  const parsed = typeof next === 'number' ? next : Number.parseInt(next, 10);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toNumber(next: string | number, fallback: number): number {
  const parsed = typeof next === 'number' ? next : Number.parseFloat(next);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asComponentType(value: string, fallback: EffectComponentType): EffectComponentType {
  return EFFECT_COMPONENT_TYPES.find((type) => type === value) ?? fallback;
}

function asConditionType(value: string): EffectConditionType {
  return EFFECT_CONDITION_TYPES.find((type) => type === value) ?? 'selfHpBelow';
}

function asTarget(value: string, fallback: EffectTarget): EffectTarget {
  return EFFECT_TARGETS.find((target) => target === value) ?? fallback;
}

function asScale(
  value: string,
  fallback: (typeof SCALING_STATS)[number],
): (typeof SCALING_STATS)[number] {
  return SCALING_STATS.find((stat) => stat === value) ?? fallback;
}

function asElement(value: string): (typeof ELEMENTS)[number] {
  return ELEMENTS.find((element) => element === value) ?? 'mist';
}
