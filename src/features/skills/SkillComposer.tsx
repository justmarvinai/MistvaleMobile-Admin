import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useSaveContent } from '@/api/hooks';
import {
  AI_PREFER_OPTIONS,
  SKILL_SLOTS,
  SKILL_UPGRADE_EFFECTS,
  type SkillSlot,
  type SkillUpgrade,
  type Targeting,
} from '@/api/types';
import { EditorShell } from '@/features/content/EditorShell';
import type { EntityEditorProps } from '@/features/content/ContentItemPage';
import { useContentOptions } from '@/features/content/useContentOptions';
import { EffectComponentEditor } from '@/components/EffectComponentEditor';
import { deepEqual, humanizeKey } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';
import { inspectSkill, resolveDescription, serializeComponents } from './components';
import {
  SLOT_LABELS,
  UPGRADE_LABELS,
  toSkillForm,
  toSkillPayload,
  validateSkillForm,
  type SkillFormValues,
} from './schema';

/**
 * Skills library & composer (ADMIN_SUITE_DESIGN §2.3) — the flagship editor.
 *
 * A skill is not code: it is an ordered list of typed effect components the engine
 * interprets. This screen is the authoring surface for that DSL, and it validates
 * against the same rules the server enforces at publish, so an operator finds out about
 * an unknown status key or an A1 with a cooldown while typing rather than at publish.
 */
export function SkillComposer({
  typePath,
  entityKey,
  initialData,
  isCreate,
  keyConflict,
  hasDraft,
  pendingDelete,
}: EntityEditorProps): ReactNode {
  const save = useSaveContent(typePath);
  const navigate = useNavigate();
  const statuses = useContentOptions('statuses');

  const defaults = useMemo(() => toSkillForm(initialData, entityKey), [initialData, entityKey]);
  const [form, setForm] = useState<SkillFormValues>(defaults);

  const patch = (next: Partial<SkillFormValues>): void =>
    setForm((current) => ({ ...current, ...next }));

  const serialized = useMemo(() => serializeComponents(form.components), [form.components]);
  const payload = useMemo(() => toSkillPayload(form, serialized), [form, serialized]);
  const dirty =
    isCreate ||
    !deepEqual(payload, toSkillPayload(defaults, serializeComponents(defaults.components)));

  const knownStatusKeys = useMemo(
    () => new Set(statuses.options.map((option) => option.value)),
    [statuses.options],
  );

  const componentIssues = useMemo(
    () =>
      inspectSkill({
        slot: form.slot,
        cooldown: form.cooldown,
        components: form.components,
        // While the status list is loading every key would look unknown; suppress the
        // check until it arrives rather than flashing false errors.
        knownStatusKeys: statuses.isPending ? new Set(allStatusKeys(form)) : knownStatusKeys,
      }),
    [form, knownStatusKeys, statuses.isPending],
  );

  const formErrors = validateSkillForm(form);
  const blockingIssues = componentIssues.filter((issue) => issue.severity === 'error');
  const warnings = componentIssues.filter((issue) => issue.severity === 'warning');
  const canSave = formErrors.length === 0 && blockingIssues.length === 0;

  const submit = (): void => {
    if (!canSave) {
      notifyError(
        'Fix the problems first',
        new Error([...formErrors, ...blockingIssues.map((issue) => issue.message)].join(' ')),
      );
      return;
    }
    save.mutate(
      { key: entityKey, data: payload },
      {
        onSuccess: () => {
          notifySuccess('Draft saved', `${form.name} will go live at the next publish.`);
          if (isCreate) {
            void navigate({
              to: '/content/$typePath/$key',
              params: { typePath, key: entityKey },
              search: {},
              replace: true,
            });
          }
        },
        onError: (error) => notifyError('Could not save', error),
      },
    );
  };

  return (
    <EditorShell
      typePath={typePath}
      entityKey={entityKey}
      title={form.name || entityKey}
      description={`${SLOT_LABELS[form.slot]} · ${form.components.length} ${form.components.length === 1 ? 'component' : 'components'}`}
      dirty={dirty}
      saving={save.isPending}
      saveError={save.error}
      onSave={submit}
      onReset={() => setForm(defaults)}
      isCreate={isCreate}
      keyConflict={keyConflict}
      hasDraft={hasDraft}
      pendingDelete={pendingDelete}
    >
      {formErrors.length > 0 && (
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertTriangle size={16} />}
          title="Not valid yet"
        >
          <Stack gap={2}>
            {formErrors.map((error) => (
              <Text key={error} size="sm">
                {error}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      {blockingIssues
        .filter((issue) => issue.index === undefined)
        .map((issue) => (
          <Alert
            key={issue.message}
            color="red"
            variant="light"
            icon={<IconAlertTriangle size={16} />}
          >
            <Text size="sm">{issue.message}</Text>
          </Alert>
        ))}

      {warnings.map((issue) => (
        <Alert
          key={issue.message}
          color="yellow"
          variant="light"
          icon={<IconAlertTriangle size={16} />}
        >
          <Text size="sm">{issue.message}</Text>
        </Alert>
      ))}

      <Tabs defaultValue="effects" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="effects">Effects</Tabs.Tab>
          <Tabs.Tab value="identity">Identity &amp; text</Tabs.Tab>
          <Tabs.Tab
            value="upgrades"
            rightSection={
              <Badge size="xs" variant="light" color="gray">
                {form.upgrades.length}
              </Badge>
            }
          >
            Tome ladder
          </Tabs.Tab>
          <Tabs.Tab value="ai">AI &amp; animation</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="effects">
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
              <Select
                label="Slot"
                description="Position in the champion's kit"
                data={SKILL_SLOTS.map((slot) => ({ value: slot, label: SLOT_LABELS[slot] }))}
                value={form.slot}
                onChange={(next) => next && patch({ slot: asSlot(next, form.slot) })}
                allowDeselect={false}
              />
              <NumberInput
                label="Cooldown"
                description={form.slot === 'a1' ? 'A1s must be 0' : 'Turns, 0–9'}
                value={form.cooldown}
                onChange={(next) => patch({ cooldown: toInt(next, form.cooldown) })}
                min={0}
                max={9}
                clampBehavior="strict"
                error={
                  form.slot === 'a1' && form.cooldown > 0
                    ? 'A1 skills must have no cooldown.'
                    : undefined
                }
              />
              <TargetingFields
                targeting={form.targeting}
                onChange={(targeting) => patch({ targeting })}
              />
            </SimpleGrid>

            <EffectComponentEditor
              components={form.components}
              onChange={(components) => patch({ components })}
              statusOptions={statuses.options.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              issues={componentIssues}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="identity">
          <Stack gap="md">
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Key"
                  description="Permanent — champions reference it."
                  value={entityKey}
                  readOnly
                  disabled
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Name"
                  placeholder="Ember Lash"
                  value={form.name}
                  onChange={(event) => patch({ name: event.currentTarget.value })}
                  error={form.name.trim().length === 0 ? 'Required' : undefined}
                />
              </Grid.Col>
            </Grid>

            <Textarea
              label="Description"
              description={
                <Text size="xs" c="dimmed">
                  Use <Code>{'{dmg}'}</Code>, <Code>{'{chance}'}</Code> and <Code>{'{turns}'}</Code>{' '}
                  — they are filled from the components, so the text can never disagree with the
                  numbers.
                </Text>
              }
              autosize
              minRows={3}
              maxRows={8}
              value={form.description}
              onChange={(event) => patch({ description: event.currentTarget.value })}
              error={form.description.length > 600 ? 'At most 600 characters.' : undefined}
            />

            <Paper p="sm" bg="dark.8">
              <Text size="xs" c="dimmed" mb={4}>
                Preview, as players will read it
              </Text>
              <Text size="sm">
                {form.description
                  ? resolveDescription(form.description, form.components)
                  : 'No description yet.'}
              </Text>
            </Paper>

            <NumberInput
              label="Sort order"
              description="Ordering hint for the skills library."
              value={form.sortOrder}
              onChange={(next) => patch({ sortOrder: toInt(next, form.sortOrder) })}
              min={0}
              max={9999}
              maw={200}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="upgrades">
          <UpgradeLadder upgrades={form.upgrades} onChange={(upgrades) => patch({ upgrades })} />
        </Tabs.Panel>

        <Tabs.Panel value="ai">
          <Stack gap="lg">
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                AI hints
              </Text>
              <Text size="xs" c="dimmed">
                Shape how the AI uses this skill without any per-champion code.
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Select
                  label="Prefer target"
                  description="When the skill leaves a choice"
                  data={AI_PREFER_OPTIONS.map((option) => ({
                    value: option,
                    label: humanizeKey(option),
                  }))}
                  value={form.aiHints.prefer ?? null}
                  onChange={(next) =>
                    patch({
                      aiHints: {
                        ...form.aiHints,
                        prefer: next ? asPrefer(next) : undefined,
                      },
                    })
                  }
                  clearable
                  placeholder="engine default"
                />
                <Select
                  label="Skip while this status is up"
                  description="Stops the AI re-applying a live debuff"
                  data={statuses.options}
                  value={form.aiHints.dontRepeatWhileActive ?? null}
                  onChange={(next) =>
                    patch({
                      aiHints: {
                        ...form.aiHints,
                        dontRepeatWhileActive: next ?? undefined,
                      },
                    })
                  }
                  clearable
                  searchable
                  placeholder="never skip"
                />
                <NumberInput
                  label="Only below own HP %"
                  description="Blank means no restriction"
                  value={form.aiHints.onlyBelowHpPct ?? ''}
                  onChange={(next) => {
                    const parsed = typeof next === 'number' ? next : Number.parseFloat(next);
                    patch({
                      aiHints: {
                        ...form.aiHints,
                        onlyBelowHpPct: Number.isFinite(parsed) ? parsed : undefined,
                      },
                    });
                  }}
                  min={0}
                  max={100}
                  clampBehavior="strict"
                  placeholder="always"
                />
                <Switch
                  label="Open with this skill"
                  description="Use on the first turn of a wave when available"
                  checked={form.aiHints.openWith ?? false}
                  onChange={(event) =>
                    patch({
                      aiHints: {
                        ...form.aiHints,
                        openWith: event.currentTarget.checked ? true : undefined,
                      },
                    })
                  }
                  mt="lg"
                />
              </SimpleGrid>
            </Stack>

            <Stack gap="sm">
              <Text size="sm" fw={500}>
                Animation
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
                <Select
                  label="Track"
                  data={['attack', 'cast', 'idle'].map((track) => ({
                    value: track,
                    label: humanizeKey(track),
                  }))}
                  value={form.animation.track}
                  onChange={(next) =>
                    next && patch({ animation: { ...form.animation, track: asTrack(next) } })
                  }
                  allowDeselect={false}
                />
                <TextInput
                  label="VFX key"
                  placeholder="ember_burst"
                  value={form.animation.vfx ?? ''}
                  onChange={(event) =>
                    patch({
                      animation: {
                        ...form.animation,
                        vfx: event.currentTarget.value || undefined,
                      },
                    })
                  }
                />
                <TextInput
                  label="Projectile"
                  description="Ranged skills fire instead of stepping in"
                  placeholder="arrow"
                  value={form.animation.projectile ?? ''}
                  onChange={(event) =>
                    patch({
                      animation: {
                        ...form.animation,
                        projectile: event.currentTarget.value || undefined,
                      },
                    })
                  }
                />
                <Switch
                  label="Screen shake"
                  checked={form.animation.shake ?? false}
                  onChange={(event) =>
                    patch({
                      animation: {
                        ...form.animation,
                        shake: event.currentTarget.checked ? true : undefined,
                      },
                    })
                  }
                  mt="lg"
                />
              </SimpleGrid>
            </Stack>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </EditorShell>
  );
}

function TargetingFields({
  targeting,
  onChange,
}: {
  targeting: Targeting;
  onChange: (next: Targeting) => void;
}): ReactNode {
  return (
    <>
      <Select
        label="Targets"
        description="Which side"
        data={[
          { value: 'enemy', label: 'Enemies' },
          { value: 'ally', label: 'Allies' },
          { value: 'self', label: 'Self only' },
        ]}
        value={targeting.side}
        onChange={(next) => next && onChange({ ...targeting, side: asSide(next, targeting.side) })}
        allowDeselect={false}
      />
      <Select
        label="Selection"
        description="How many, and which"
        data={[
          { value: 'single', label: 'One target' },
          { value: 'all', label: 'All of that side' },
          { value: 'random', label: 'Random targets' },
          { value: 'lowestHp', label: 'Lowest HP' },
          { value: 'self', label: 'The caster' },
        ]}
        value={targeting.mode}
        onChange={(next) => {
          if (!next) return;
          const mode = asMode(next, targeting.mode);
          // `count` only applies to random targeting; dropping it elsewhere keeps the
          // payload identical to what the server's schema would store.
          onChange(
            mode === 'random'
              ? { ...targeting, mode, count: targeting.count ?? 2 }
              : { side: targeting.side, mode },
          );
        }}
        allowDeselect={false}
      />
      {targeting.mode === 'random' && (
        <NumberInput
          label="How many targets"
          value={targeting.count ?? 2}
          onChange={(next) => onChange({ ...targeting, count: toInt(next, targeting.count ?? 2) })}
          min={1}
          max={4}
          clampBehavior="strict"
        />
      )}
    </>
  );
}

function UpgradeLadder({
  upgrades,
  onChange,
}: {
  upgrades: SkillUpgrade[];
  onChange: (next: SkillUpgrade[]) => void;
}): ReactNode {
  return (
    <Stack gap="sm">
      <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
        <Text size="xs">
          Each rung is one tome level. Players apply them in order, so rung 1 is the first upgrade
          and the last rung is the fully-booked skill. At most six.
        </Text>
      </Alert>

      {upgrades.length === 0 ? (
        <Paper p="md" bg="dark.8">
          <Text size="sm" c="dimmed">
            No upgrade ladder. The skill cannot be improved with tomes.
          </Text>
        </Paper>
      ) : (
        <Stack gap={6}>
          {upgrades.map((upgrade, index) => (
            <Paper key={index} p="xs" bg="dark.8">
              <Group gap="sm" wrap="nowrap">
                <Badge size="sm" variant="filled" color="mist" w={72}>
                  Rung {index + 1}
                </Badge>
                <Select
                  data={SKILL_UPGRADE_EFFECTS.map((effect) => ({
                    value: effect,
                    label: UPGRADE_LABELS[effect],
                  }))}
                  value={upgrade.effect}
                  onChange={(next) => {
                    if (!next) return;
                    const effect = asUpgradeEffect(next, upgrade.effect);
                    onChange(
                      upgrades.map((current, position) =>
                        position === index
                          ? effect === 'cooldown'
                            ? { effect: 'cooldown', turns: 1 }
                            : { effect, pct: 'pct' in current ? current.pct : 5 }
                          : current,
                      ),
                    );
                  }}
                  allowDeselect={false}
                  size="xs"
                  w={200}
                  aria-label={`Rung ${index + 1} effect`}
                />
                {upgrade.effect === 'cooldown' ? (
                  <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                    Reduces the cooldown by one turn.
                  </Text>
                ) : (
                  <NumberInput
                    value={upgrade.pct}
                    onChange={(next) =>
                      onChange(
                        upgrades.map((current, position) =>
                          position === index && current.effect !== 'cooldown'
                            ? { ...current, pct: toInt(next, current.pct) }
                            : current,
                        ),
                      )
                    }
                    min={1}
                    max={25}
                    clampBehavior="strict"
                    size="xs"
                    w={110}
                    suffix="%"
                    aria-label={`Rung ${index + 1} percentage`}
                  />
                )}
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  ml="auto"
                  onClick={() => onChange(upgrades.filter((_, position) => position !== index))}
                  aria-label={`Remove rung ${index + 1}`}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Button
        variant="light"
        color="mist"
        size="compact-sm"
        leftSection={<IconPlus size={14} />}
        onClick={() => onChange([...upgrades, { effect: 'damage', pct: 5 }])}
        disabled={upgrades.length >= 6}
        w="fit-content"
      >
        {upgrades.length >= 6 ? 'Ladder is full' : 'Add rung'}
      </Button>
    </Stack>
  );
}

/** Status keys already referenced by the skill, used while the catalog is still loading. */
function allStatusKeys(form: SkillFormValues): string[] {
  return form.components.flatMap((component) =>
    component.type === 'applyStatus' && component.status ? [component.status] : [],
  );
}

function toInt(next: string | number, fallback: number): number {
  const parsed = typeof next === 'number' ? next : Number.parseInt(next, 10);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function asSlot(value: string, fallback: SkillSlot): SkillSlot {
  return SKILL_SLOTS.find((slot) => slot === value) ?? fallback;
}

function asSide(value: string, fallback: Targeting['side']): Targeting['side'] {
  return value === 'enemy' || value === 'ally' || value === 'self' ? value : fallback;
}

function asMode(value: string, fallback: Targeting['mode']): Targeting['mode'] {
  return value === 'single' ||
    value === 'all' ||
    value === 'random' ||
    value === 'lowestHp' ||
    value === 'self'
    ? value
    : fallback;
}

function asPrefer(value: string): NonNullable<SkillFormValues['aiHints']['prefer']> {
  return AI_PREFER_OPTIONS.find((option) => option === value) ?? 'lowestHp';
}

function asTrack(value: string): SkillFormValues['animation']['track'] {
  return value === 'attack' || value === 'cast' || value === 'idle' ? value : 'attack';
}

function asUpgradeEffect(value: string, fallback: SkillUpgrade['effect']): SkillUpgrade['effect'] {
  return SKILL_UPGRADE_EFFECTS.find((effect) => effect === value) ?? fallback;
}
