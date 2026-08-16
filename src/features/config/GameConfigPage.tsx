import { useMemo, useState, type ReactNode } from 'react';
import {
  Accordion,
  Badge,
  Box,
  Button,
  Group,
  JsonInput,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconDeviceFloppy, IconRotate } from '@tabler/icons-react';
import { useContentList, useSaveContent } from '@/api/hooks';
import type { ContentListItem, GameConfigEntry, GameConfigValue } from '@/api/types';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryState';
import { humanizeKey, deepEqual } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';

/**
 * Game config editor (ADMIN_SUITE_DESIGN §2.12) — the game's control room.
 *
 * Every tunable constant lives in `game_config` rather than in code, so this screen is
 * how balance changes happen: edit, save as draft, publish. No deploy.
 *
 * Controls are chosen from the *live value's* type rather than from a schema, because
 * the server stores `value` as an open union (number | string | boolean | object |
 * array). Changing a constant's type is not something an operator should be able to do
 * by accident, so each control edits within the type the value already has.
 */
export function GameConfigPage(): ReactNode {
  const list = useContentList('config');
  const save = useSaveContent('config');

  /** Edited values by config key; absent means untouched. */
  const [edits, setEdits] = useState<Record<string, GameConfigValue>>({});
  const [savingKeys, setSavingKeys] = useState<ReadonlySet<string>>(new Set());

  const entries = useMemo(() => toConfigEntries(list.data?.items ?? []), [list.data]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, GameConfigEntry[]>();
    for (const entry of entries) {
      const bucket = byGroup.get(entry.group);
      if (bucket) bucket.push(entry);
      else byGroup.set(entry.group, [entry]);
    }
    for (const bucket of byGroup.values()) bucket.sort((a, b) => a.key.localeCompare(b.key));
    return [...byGroup.entries()]
      .map(([group, items]) => ({ group, items }))
      .sort((a, b) => a.group.localeCompare(b.group));
  }, [entries]);

  const dirtyKeys = useMemo(
    () =>
      entries
        .filter((entry) => entry.key in edits && !deepEqual(edits[entry.key], entry.value))
        .map((entry) => entry.key),
    [entries, edits],
  );

  const saveOne = (entry: GameConfigEntry, value: GameConfigValue): void => {
    setSavingKeys((current) => new Set(current).add(entry.key));
    save.mutate(
      { key: entry.key, data: { ...entry, value } },
      {
        onSuccess: () => {
          setEdits((current) => {
            const next = { ...current };
            delete next[entry.key];
            return next;
          });
        },
        onError: (error) => notifyError(`Could not save ${entry.key}`, error),
        onSettled: () =>
          setSavingKeys((current) => {
            const next = new Set(current);
            next.delete(entry.key);
            return next;
          }),
      },
    );
  };

  const saveAll = (): void => {
    const pending = entries.filter((entry) => dirtyKeys.includes(entry.key));
    if (pending.length === 0) return;
    for (const entry of pending) {
      const value = edits[entry.key];
      if (value !== undefined) saveOne(entry, value);
    }
    notifySuccess(
      `Saving ${pending.length} ${pending.length === 1 ? 'constant' : 'constants'}`,
      'They go live at the next publish.',
    );
  };

  return (
    <>
      <PageHeader
        title="Game config"
        description="Every tunable constant. Changes are drafts until you publish — balance never needs a deploy."
        actions={
          <Group gap="sm">
            {dirtyKeys.length > 0 && (
              <Button
                variant="default"
                leftSection={<IconRotate size={16} />}
                onClick={() => setEdits({})}
              >
                Revert {dirtyKeys.length}
              </Button>
            )}
            <Button
              color="mist"
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={saveAll}
              disabled={dirtyKeys.length === 0}
              loading={savingKeys.size > 0}
            >
              Save {dirtyKeys.length > 0 ? `${dirtyKeys.length} ` : ''}drafts
            </Button>
          </Group>
        }
      />

      {list.isPending ? (
        <LoadingState label="Loading constants…" />
      ) : list.error ? (
        <ErrorState
          error={list.error}
          title="Could not load game config"
          onRetry={() => void list.refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No constants yet"
          description="Seed the game config on the server (pnpm seed) and they will appear here."
        />
      ) : (
        <Accordion variant="separated" multiple defaultValue={groups.map((group) => group.group)}>
          {groups.map(({ group, items }) => {
            const dirtyInGroup = items.filter((entry) => dirtyKeys.includes(entry.key)).length;
            return (
              <Accordion.Item key={group} value={group}>
                <Accordion.Control>
                  <Group gap="sm">
                    <Text fw={600} size="sm" tt="capitalize">
                      {humanizeKey(group)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {items.length} {items.length === 1 ? 'constant' : 'constants'}
                    </Text>
                    {dirtyInGroup > 0 && (
                      <Badge size="xs" color="orange" variant="light">
                        {dirtyInGroup} unsaved
                      </Badge>
                    )}
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="lg" pt="xs">
                    {items.map((entry) => (
                      <ConfigField
                        key={entry.key}
                        entry={entry}
                        value={
                          entry.key in edits ? (edits[entry.key] as GameConfigValue) : entry.value
                        }
                        dirty={dirtyKeys.includes(entry.key)}
                        saving={savingKeys.has(entry.key)}
                        state={stateOf(list.data?.items ?? [], entry.key)}
                        onChange={(value) =>
                          setEdits((current) => ({ ...current, [entry.key]: value }))
                        }
                        onRevert={() =>
                          setEdits((current) => {
                            const next = { ...current };
                            delete next[entry.key];
                            return next;
                          })
                        }
                      />
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </>
  );
}

function ConfigField({
  entry,
  value,
  dirty,
  saving,
  state,
  onChange,
  onRevert,
}: {
  entry: GameConfigEntry;
  value: GameConfigValue;
  dirty: boolean;
  saving: boolean;
  state: string | undefined;
  onChange: (value: GameConfigValue) => void;
  onRevert: () => void;
}): ReactNode {
  const label = (
    <Group gap={6} wrap="nowrap">
      <Text size="sm" fw={500}>
        {entry.label}
      </Text>
      <Tooltip label="The constant's key, as the server and seeds reference it" withArrow>
        <Text size="xs" c="dimmed" ff="monospace">
          {entry.key}
        </Text>
      </Tooltip>
      {state === 'draft' && (
        <Badge size="xs" color="yellow" variant="light">
          draft
        </Badge>
      )}
      {dirty && (
        <Badge size="xs" color="orange" variant="dot">
          unsaved
        </Badge>
      )}
      {dirty && (
        <Button size="compact-xs" variant="subtle" color="gray" onClick={onRevert}>
          revert
        </Button>
      )}
    </Group>
  );

  const description = entry.help || undefined;
  const common = { label, description, disabled: saving };

  if (typeof value === 'boolean') {
    return (
      <Box>
        <Switch
          {...common}
          checked={value}
          onChange={(event) => onChange(event.currentTarget.checked)}
          labelPosition="right"
        />
      </Box>
    );
  }

  if (typeof value === 'number') {
    return (
      <NumberInput
        {...common}
        value={value}
        onChange={(next) => {
          // Mantine hands back a string while the field is mid-edit (e.g. "1."); keeping
          // the previous number until it parses stops the field fighting the typist.
          const parsed = typeof next === 'number' ? next : Number.parseFloat(next);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        // Constants range from 0.05 (variance) to 1_000_000 (silver caps); a decimal
        // step would be wrong for most and an integer step wrong for the rest, so the
        // step follows the value's own scale.
        step={stepFor(value)}
        decimalScale={Number.isInteger(value) ? 0 : 4}
        maw={320}
        allowNegative
      />
    );
  }

  if (typeof value === 'string') {
    return (
      <TextInput
        {...common}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        maw={480}
      />
    );
  }

  return (
    <JsonInput
      {...common}
      value={JSON.stringify(value, null, 2)}
      onChange={(text) => {
        try {
          const parsed: unknown = JSON.parse(text);
          if (typeof parsed === 'object' && parsed !== null) onChange(parsed as GameConfigValue);
        } catch {
          // Invalid JSON is shown by `validationError`; the last valid value stands
          // until the operator finishes typing a parseable one.
        }
      }}
      validationError="Invalid JSON — the last valid value is kept until this parses."
      formatOnBlur
      autosize
      minRows={3}
      maxRows={16}
      styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
    />
  );
}

function stepFor(value: number): number {
  const magnitude = Math.abs(value);
  if (!Number.isInteger(value)) return magnitude < 1 ? 0.01 : 0.1;
  if (magnitude >= 10_000) return 100;
  if (magnitude >= 1_000) return 10;
  return 1;
}

/** Reads the config rows out of the generic content list response. */
function toConfigEntries(items: ContentListItem[]): GameConfigEntry[] {
  const entries: GameConfigEntry[] = [];
  for (const item of items) {
    const data = item.data;
    if (!data) continue;
    const { value, group, label, help } = data;
    if (value === undefined) continue;
    entries.push({
      key: item.key,
      value: value as GameConfigValue,
      group: typeof group === 'string' && group ? group : 'misc',
      label: typeof label === 'string' && label ? label : humanizeKey(item.key),
      help: typeof help === 'string' ? help : '',
    });
  }
  return entries;
}

function stateOf(items: ContentListItem[], key: string): string | undefined {
  return items.find((item) => item.key === key)?.state;
}
