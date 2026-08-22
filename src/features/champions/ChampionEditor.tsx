import { useMemo, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Grid,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useSaveContent } from '@/api/hooks';
import { ELEMENTS, RARITIES, ROLES, STATS } from '@/api/types';
import { humanizeKey } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';
import { EditorShell } from '@/features/content/EditorShell';
import type { EntityEditorProps } from '@/features/content/ContentItemPage';
import { useContentOptions } from '@/features/content/useContentOptions';
import {
  BASE_RANKS_BY_RARITY,
  championFormSchema,
  defaultBaseRank,
  EXPECTED_SKILLS_BY_RARITY,
  toChampionForm,
  type ChampionFormValues,
} from './schema';
import { SkillSlotList } from './SkillSlotList';

/**
 * Champion editor (ADMIN_SUITE_DESIGN §2.2).
 *
 * Four tabs mirroring how champions are actually authored: who they are, how strong they
 * are, what they do, and how they behave in the collection. Faction, asset and skill
 * references are pickers over live content rather than free text — a typo there is a
 * publish-blocking referential error, so it should be impossible to type one.
 */
export function ChampionEditor({
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

  const factions = useContentOptions('factions');
  const assets = useContentOptions('assets');
  const skills = useContentOptions('skills');

  const defaults = useMemo(() => toChampionForm(initialData, entityKey), [initialData, entityKey]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ChampionFormValues>({
    resolver: zodResolver(championFormSchema),
    defaultValues: defaults,
    mode: 'onBlur',
  });

  const values = watch();

  const onSubmit = handleSubmit((form) => {
    save.mutate(
      { key: entityKey, data: form },
      {
        onSuccess: () => {
          notifySuccess('Draft saved', `${form.name} will go live at the next publish.`);
          reset(form);
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
  });

  const expectedSkills = EXPECTED_SKILLS_BY_RARITY[values.rarity] ?? 1;
  const kitWarning =
    !values.isFood && values.skills.length > 0 && values.skills.length < expectedSkills
      ? `${values.rarity} champions usually have at least ${expectedSkills} skills; this one has ${values.skills.length}. The server publishes this as a warning, not an error.`
      : undefined;

  return (
    <EditorShell
      typePath={typePath}
      entityKey={entityKey}
      title={values.name || entityKey}
      description={values.title || 'Champion'}
      dirty={isDirty || isCreate}
      saving={save.isPending}
      saveError={save.error}
      onSave={() => void onSubmit()}
      onReset={() => reset(defaults)}
      isCreate={isCreate}
      keyConflict={keyConflict}
      hasDraft={hasDraft}
      pendingDelete={pendingDelete}
    >
      <form onSubmit={onSubmit} noValidate>
        <Tabs defaultValue="identity" keepMounted={false}>
          <Tabs.List mb="lg">
            <Tabs.Tab value="identity">Identity</Tabs.Tab>
            <Tabs.Tab value="stats">Base stats</Tabs.Tab>
            <Tabs.Tab
              value="skills"
              rightSection={
                <Badge
                  size="xs"
                  variant="light"
                  color={values.skills.length === 0 ? 'red' : 'gray'}
                >
                  {values.skills.length}
                </Badge>
              }
            >
              Skills &amp; aura
            </Tabs.Tab>
            <Tabs.Tab value="collection">Collection</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="identity">
            <Stack gap="md">
              <Grid gutter="md">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Key"
                    description="Permanent — seeds, assets and player data reference it."
                    value={entityKey}
                    readOnly
                    disabled
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Name"
                    placeholder="Anuria"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Title"
                    description="The epithet shown under the name."
                    placeholder="Warden of the Ember Gate"
                    error={errors.title?.message}
                    {...register('title')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="factionKey"
                    render={({ field, fieldState }) => (
                      <Select
                        label="Faction"
                        placeholder={factions.isPending ? 'Loading…' : 'Pick a faction'}
                        data={factions.options}
                        value={field.value || null}
                        onChange={(next) => field.onChange(next ?? '')}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                        searchable
                        nothingFoundMessage="No factions — create one first."
                        disabled={factions.isPending}
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>

              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <EnumSelect
                  control={control}
                  name="element"
                  label="Element"
                  options={ELEMENTS}
                  description="Ember beats Verdant beats Tide beats Ember. Mist sits outside the wheel."
                />
                <EnumSelect
                  control={control}
                  name="rarity"
                  label="Rarity"
                  options={RARITIES}
                  onPicked={(rarity) => {
                    // The bands do not overlap across every pair, so a rarity change can
                    // strand the called star outside its own band — publish would refuse
                    // it, and the operator never typed the number that broke it.
                    const allowed = BASE_RANKS_BY_RARITY[rarity] ?? [];
                    if (!allowed.includes(values.baseRank)) {
                      setValue('baseRank', defaultBaseRank(rarity), { shouldDirty: true });
                    }
                  }}
                />
                <EnumSelect
                  control={control}
                  name="role"
                  label="Role"
                  options={ROLES}
                  description="Drives AI defaults and roster filters."
                />
              </SimpleGrid>

              {/* The star this champion is *called* at, which is the only part of its star
                  track an editor gets a say in. How far it can climb is the rarity's
                  ceiling and belongs to nobody's form. */}
              <Controller
                control={control}
                name="baseRank"
                render={({ field, fieldState }) => {
                  const allowed = BASE_RANKS_BY_RARITY[values.rarity] ?? [1];
                  return (
                    <Select
                      label="Called at"
                      description={
                        allowed.length > 1
                          ? `A ${values.rarity} champion is summoned at one of these. It can be raised from here to the ceiling its rarity allows.`
                          : `Every ${values.rarity} champion is summoned at ★${allowed[0]}. Change the rarity to change this.`
                      }
                      data={allowed.map((rank) => ({ value: String(rank), label: `★${rank}` }))}
                      value={String(field.value)}
                      onChange={(next) => next && field.onChange(Number(next))}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                      disabled={allowed.length < 2}
                      allowDeselect={false}
                      w={{ base: '100%', sm: 220 }}
                    />
                  );
                }}
              />

              <Controller
                control={control}
                name="assetKey"
                render={({ field, fieldState }) => (
                  <Select
                    label="Sprite asset"
                    description="From the asset registry. Publish rejects a champion pointing at an asset that does not exist."
                    placeholder={assets.isPending ? 'Loading…' : 'Pick an asset'}
                    data={assets.options}
                    value={field.value || null}
                    onChange={(next) => field.onChange(next ?? '')}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    searchable
                    nothingFoundMessage="No assets — register one first."
                    disabled={assets.isPending}
                    maw={480}
                  />
                )}
              />

              <Textarea
                label="Lore"
                description="Shown on the champion page. Max 2000 characters."
                autosize
                minRows={4}
                maxRows={12}
                error={errors.lore?.message}
                {...register('lore')}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="stats">
            <Stack gap="md">
              <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
                <Text size="xs">
                  Base stats are the values at ★6 / level 60 / ascension 6. Every lower tier is
                  derived from these by the server — there is nothing to fill in per level.
                </Text>
              </Alert>

              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                <StatInput
                  control={control}
                  name="baseStats.hp"
                  label="HP"
                  min={100}
                  max={60_000}
                  step={100}
                />
                <StatInput
                  control={control}
                  name="baseStats.atk"
                  label="ATK"
                  min={10}
                  max={5_000}
                  step={10}
                />
                <StatInput
                  control={control}
                  name="baseStats.def"
                  label="DEF"
                  min={10}
                  max={5_000}
                  step={10}
                />
                <StatInput
                  control={control}
                  name="baseStats.spd"
                  label="SPD"
                  min={50}
                  max={200}
                  step={1}
                  hint="Turn meter per tick = SPD × the tempo constant."
                />
                <StatInput
                  control={control}
                  name="baseStats.critRate"
                  label="C. RATE %"
                  min={0}
                  max={100}
                  step={1}
                />
                <StatInput
                  control={control}
                  name="baseStats.critDmg"
                  label="C. DMG %"
                  min={0}
                  max={300}
                  step={5}
                />
                <StatInput
                  control={control}
                  name="baseStats.res"
                  label="RES"
                  min={0}
                  max={300}
                  step={5}
                  hint="Flat points, not a percentage — weighed against attacker ACC."
                />
                <StatInput
                  control={control}
                  name="baseStats.acc"
                  label="ACC"
                  min={0}
                  max={300}
                  step={5}
                />
              </SimpleGrid>

              <Text size="xs" c="dimmed">
                Total offensive weight (ATK × C.RATE × C.DMG) and effective HP (HP × DEF) are what
                the balance sandbox compares; it arrives with the engine in game phase P2.
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="skills">
            <Stack gap="lg">
              {errors.skills?.message && (
                <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
                  <Text size="sm">{errors.skills.message}</Text>
                </Alert>
              )}
              {kitWarning && (
                <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
                  <Text size="sm">{kitWarning}</Text>
                </Alert>
              )}

              <Controller
                control={control}
                name="skills"
                render={({ field }) => (
                  <SkillSlotList
                    value={field.value}
                    onChange={field.onChange}
                    options={skills.options}
                    loading={skills.isPending}
                  />
                )}
              />

              <Controller
                control={control}
                name="aura"
                render={({ field }) => <AuraEditor value={field.value} onChange={field.onChange} />}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="collection">
            <Stack gap="md" maw={560}>
              <Controller
                control={control}
                name="summonable"
                render={({ field }) => (
                  <Switch
                    label="Summonable"
                    description="Appears in summon pools. Turn off for reward-only or story champions."
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={control}
                name="starter"
                render={({ field }) => (
                  <Switch
                    label="Starter"
                    description="Offered in the new-account starter choice."
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={control}
                name="isFood"
                render={({ field }) => (
                  <Switch
                    label="Food unit"
                    description="Excluded from the Chronicle's completion count and from kit-depth warnings."
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />

              <Group grow align="flex-start">
                <Controller
                  control={control}
                  name="balanceVersion"
                  render={({ field, fieldState }) => (
                    <NumberInput
                      label="Balance version"
                      description="Bump when stats change so the Chronicle can flag the champion as updated."
                      value={field.value}
                      onChange={(next) => field.onChange(toInt(next, field.value))}
                      min={1}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="sortOrder"
                  render={({ field, fieldState }) => (
                    <NumberInput
                      label="Sort order"
                      description="Ordering hint for lists, in-game and here."
                      value={field.value}
                      onChange={(next) => field.onChange(toInt(next, field.value))}
                      min={0}
                      max={9999}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </form>
    </EditorShell>
  );
}

/** A Select bound to one of the shared string-enum fields. */
function EnumSelect({
  control,
  name,
  label,
  options,
  description,
  onPicked,
}: {
  control: ReturnType<typeof useForm<ChampionFormValues>>['control'];
  name: 'element' | 'rarity' | 'role';
  label: string;
  options: readonly string[];
  description?: string;
  /** Runs after the field takes the new value, for a sibling that depends on it. */
  onPicked?: (value: string) => void;
}): ReactNode {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          label={label}
          description={description}
          data={options.map((option) => ({ value: option, label: humanizeKey(option) }))}
          value={field.value}
          onChange={(next) => {
            if (!next) return;
            field.onChange(next);
            onPicked?.(next);
          }}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
          allowDeselect={false}
        />
      )}
    />
  );
}

function StatInput({
  control,
  name,
  label,
  min,
  max,
  step,
  hint,
}: {
  control: ReturnType<typeof useForm<ChampionFormValues>>['control'];
  name: `baseStats.${keyof ChampionFormValues['baseStats']}`;
  label: string;
  min: number;
  max: number;
  step: number;
  hint?: string;
}): ReactNode {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Tooltip label={hint} disabled={!hint} withArrow multiline w={260}>
          <NumberInput
            label={label}
            value={field.value}
            onChange={(next) => field.onChange(toInt(next, field.value))}
            onBlur={field.onBlur}
            min={min}
            max={max}
            step={step}
            clampBehavior="strict"
            decimalScale={0}
            error={fieldState.error?.message}
            description={`${min}–${max}`}
          />
        </Tooltip>
      )}
    />
  );
}

function AuraEditor({
  value,
  onChange,
}: {
  value: ChampionFormValues['aura'];
  onChange: (next: ChampionFormValues['aura']) => void;
}): ReactNode {
  return (
    <Stack gap="sm">
      <Switch
        label="Has an aura"
        description="One team-wide bonus, active only while this champion leads the team."
        checked={value !== null}
        onChange={(event) =>
          onChange(
            event.currentTarget.checked
              ? { stat: 'hp', value: 20, scope: 'all', area: 'any' }
              : null,
          )
        }
      />

      {value !== null && (
        <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
          <Select
            label="Stat"
            data={STATS.map((stat) => ({ value: stat, label: humanizeKey(stat) }))}
            value={value.stat}
            onChange={(next) => next && onChange({ ...value, stat: asStat(next, value.stat) })}
            allowDeselect={false}
          />
          <NumberInput
            label="Value"
            description="Percent for ratio stats, flat points for ACC/RES."
            value={value.value}
            onChange={(next) => onChange({ ...value, value: toNumber(next, value.value) })}
            min={1}
            max={100}
            clampBehavior="strict"
          />
          <Select
            label="Scope"
            description="Who it applies to."
            data={[
              { value: 'all', label: 'All allies' },
              { value: 'element', label: 'Same element' },
              { value: 'faction', label: 'Same faction' },
            ]}
            value={value.scope}
            onChange={(next) => next && onChange({ ...value, scope: asScope(next, value.scope) })}
            allowDeselect={false}
          />
          <Select
            label="Area"
            description="Which modes it counts in."
            data={[
              { value: 'any', label: 'Everywhere' },
              { value: 'campaign', label: 'Campaign' },
              { value: 'arena', label: 'Arena' },
              { value: 'depths', label: 'The Depths' },
            ]}
            value={value.area}
            onChange={(next) => next && onChange({ ...value, area: asArea(next, value.area) })}
            allowDeselect={false}
          />
        </SimpleGrid>
      )}
    </Stack>
  );
}

/** Mantine's NumberInput yields a string mid-edit; keep the last good value until it parses. */
function toInt(next: string | number, fallback: number): number {
  const parsed = typeof next === 'number' ? next : Number.parseInt(next, 10);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toNumber(next: string | number, fallback: number): number {
  const parsed = typeof next === 'number' ? next : Number.parseFloat(next);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type AuraValue = NonNullable<ChampionFormValues['aura']>;

function asStat(value: string, fallback: AuraValue['stat']): AuraValue['stat'] {
  return STATS.find((stat) => stat === value) ?? fallback;
}

function asScope(value: string, fallback: AuraValue['scope']): AuraValue['scope'] {
  return value === 'all' || value === 'element' || value === 'faction' ? value : fallback;
}

function asArea(value: string, fallback: AuraValue['area']): AuraValue['area'] {
  return value === 'any' || value === 'campaign' || value === 'arena' || value === 'depths'
    ? value
    : fallback;
}
