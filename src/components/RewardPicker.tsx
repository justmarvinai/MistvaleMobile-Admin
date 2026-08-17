import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Alert,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import { useContentList } from '@/api/hooks';
import { REWARD_SCALARS, SCALAR_LABELS } from '@/api/types';

/**
 * A reward map, edited.
 *
 * Every payout in Mistvale is the same flat `{silver: 5000, sigil_gleaming: 1}` — quests,
 * missions, event milestones, calendar days, mail attachments. That shape is pleasant to
 * author and unforgiving of a typo: `sigil_gleeming` is a perfectly valid key and would
 * hand the player nothing. So this never offers a free-text key. Currencies come from the
 * closed list; items come from the live item catalogue, which is also what tells the
 * operator that the thing they meant to give actually exists.
 *
 * Shared rather than per-editor on purpose (CLAUDE.md): the mail composer is the first
 * caller, and the quest, mission, event and login-track editors at A4 are the reason it is
 * built as a primitive rather than inside the composer.
 */
export function RewardPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}): ReactNode {
  const items = useContentList('items');
  const [pending, setPending] = useState<string | null>(null);

  const catalogue = useMemo(() => {
    const entries = (items.data?.items ?? []).map((entry) => ({
      value: entry.key,
      label: String((entry.data as { name?: string }).name ?? entry.key),
    }));
    entries.sort((a, b) => a.label.localeCompare(b.label));
    return entries;
  }, [items.data]);

  const options = useMemo(
    () => [
      {
        group: 'Currencies',
        items: REWARD_SCALARS.map((key) => ({ value: key, label: SCALAR_LABELS[key] })),
      },
      { group: 'Items', items: catalogue },
    ],
    [catalogue],
  );

  const nameOf = (key: string): string =>
    SCALAR_LABELS[key as (typeof REWARD_SCALARS)[number]] ??
    catalogue.find((entry) => entry.value === key)?.label ??
    key;

  const rows = Object.entries(value);
  const taken = new Set(rows.map(([key]) => key));

  const set = (key: string, amount: number): void => onChange({ ...value, [key]: amount });
  const remove = (key: string): void => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const add = (key: string | null): void => {
    if (!key || taken.has(key)) return;
    set(key, 1);
    setPending(null);
  };

  // A key already in the map but no longer in the catalogue: an item renamed or removed
  // since this was authored. Worth saying out loud — it would pay nothing.
  const unknown = rows
    .map(([key]) => key)
    .filter(
      (key) =>
        !REWARD_SCALARS.includes(key as (typeof REWARD_SCALARS)[number]) &&
        items.isSuccess &&
        !catalogue.some((entry) => entry.value === key),
    );

  return (
    <Stack gap="xs">
      <div>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </div>

      {unknown.length > 0 && (
        <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Nothing would be paid">
          {unknown.join(', ')} {unknown.length === 1 ? 'is' : 'are'} not in the live item catalogue.
          Remove or replace {unknown.length === 1 ? 'it' : 'them'}.
        </Alert>
      )}

      {rows.length > 0 && (
        <Table withTableBorder>
          <Table.Tbody>
            {rows.map(([key, amount]) => (
              <Table.Tr key={key}>
                <Table.Td>
                  <Text size="sm">{nameOf(key)}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {key}
                  </Text>
                </Table.Td>
                <Table.Td w={160}>
                  <NumberInput
                    aria-label={`${nameOf(key)} amount`}
                    min={1}
                    value={amount}
                    onChange={(next) => set(key, typeof next === 'number' && next > 0 ? next : 1)}
                  />
                </Table.Td>
                <Table.Td w={48}>
                  <Tooltip label="Remove">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Remove ${nameOf(key)}`}
                      onClick={() => remove(key)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Group gap="xs" align="flex-end">
        <Select
          placeholder={items.isPending ? 'Reading the catalogue…' : 'Add a reward…'}
          searchable
          clearable
          disabled={items.isPending}
          data={options.map((group) => ({
            group: group.group,
            items: group.items.filter((entry) => !taken.has(entry.value)),
          }))}
          value={pending}
          onChange={setPending}
          w={280}
          aria-label="Reward to add"
        />
        <ActionIcon
          variant="light"
          size="lg"
          disabled={!pending}
          aria-label="Add reward"
          onClick={() => add(pending)}
        >
          <IconPlus size={16} />
        </ActionIcon>
      </Group>

      {rows.length === 0 && (
        <Text size="xs" c="dimmed">
          Nothing attached.
        </Text>
      )}
    </Stack>
  );
}
