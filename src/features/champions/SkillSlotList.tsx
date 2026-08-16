import { useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconPlus, IconX } from '@tabler/icons-react';
import { ContentItemLink } from '@/components/nav';
import type { ContentOption } from '@/features/content/useContentOptions';

/**
 * The champion's ordered skill slots.
 *
 * Order is meaningful: A1 first, passive last (`championDefSchema.skills`), and the
 * engine reads the list positionally — so reordering is a first-class action here rather
 * than something to do by retyping keys.
 */

const SLOT_LABELS = ['A1', 'A2', 'A3', 'A4', 'Passive'] as const;
const MAX_SLOTS = 5;

export function SkillSlotList({
  value,
  onChange,
  options,
  loading,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: ContentOption[];
  loading: boolean;
}): ReactNode {
  const [adding, setAdding] = useState(false);

  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    onChange(next);
  };

  const remaining = options.filter((option) => !value.includes(option.value));

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <div>
          <Text size="sm" fw={500}>
            Skills
          </Text>
          <Text size="xs" c="dimmed">
            Ordered: A1 first, the passive last. Up to five.
          </Text>
        </div>
        <Badge size="sm" variant="light" color={value.length === 0 ? 'red' : 'gray'}>
          {value.length}/{MAX_SLOTS}
        </Badge>
      </Group>

      {value.length === 0 ? (
        <Paper p="md" bg="dark.8">
          <Text size="sm" c="dimmed">
            No skills yet. A champion needs at least one — add its A1 first.
          </Text>
        </Paper>
      ) : (
        <Stack gap={6}>
          {value.map((skillKey, index) => {
            const option = options.find((candidate) => candidate.value === skillKey);
            const slotName = declaredSlot(option);
            return (
              <Paper key={`${skillKey}-${index}`} p="xs" bg="dark.8">
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Badge size="sm" variant="filled" color="mist" w={64}>
                      {SLOT_LABELS[index] ?? `#${index + 1}`}
                    </Badge>
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Anchor
                        component={ContentItemLink}
                        typePath="skills"
                        entityKey={skillKey}
                        size="sm"
                        truncate
                      >
                        {option?.data?.name && typeof option.data.name === 'string'
                          ? option.data.name
                          : skillKey}
                      </Anchor>
                      <Group gap={6}>
                        <Text size="xs" c="dimmed" ff="monospace">
                          {skillKey}
                        </Text>
                        {slotName && slotName !== expectedSlot(index) && (
                          <Tooltip
                            label={`This skill declares slot “${slotName}”, but sits in position ${SLOT_LABELS[index] ?? index + 1}. The engine reads the champion's order, so check this is deliberate.`}
                            withArrow
                            multiline
                            w={280}
                          >
                            <Badge size="xs" color="orange" variant="light">
                              slot {slotName}
                            </Badge>
                          </Tooltip>
                        )}
                        {!option && !loading && (
                          <Tooltip
                            label="No skill with this key exists. Publish validation will reject the champion."
                            withArrow
                          >
                            <Badge size="xs" color="red" variant="light">
                              missing
                            </Badge>
                          </Tooltip>
                        )}
                      </Group>
                    </Stack>
                  </Group>

                  <Group gap={2} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Move ${skillKey} up`}
                    >
                      <IconArrowUp size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      disabled={index === value.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Move ${skillKey} down`}
                    >
                      <IconArrowDown size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => onChange(value.filter((_, position) => position !== index))}
                      aria-label={`Remove ${skillKey}`}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}

      {adding ? (
        <Select
          label="Add a skill"
          placeholder={loading ? 'Loading skills…' : 'Search the skills library'}
          data={remaining}
          searchable
          autoFocus
          disabled={loading}
          nothingFoundMessage="No matching skill. Create it in the skills library first."
          value={null}
          onChange={(next) => {
            if (next) onChange([...value, next]);
            setAdding(false);
          }}
          onBlur={() => setAdding(false)}
          maw={480}
        />
      ) : (
        <Button
          variant="light"
          color="mist"
          size="compact-sm"
          leftSection={<IconPlus size={14} />}
          onClick={() => setAdding(true)}
          disabled={value.length >= MAX_SLOTS}
          w="fit-content"
        >
          {value.length >= MAX_SLOTS ? 'All five slots filled' : 'Add skill'}
        </Button>
      )}
    </Stack>
  );
}

function declaredSlot(option: ContentOption | undefined): string | undefined {
  const slot = option?.data?.slot;
  return typeof slot === 'string' ? slot : undefined;
}

function expectedSlot(index: number): string {
  return ['a1', 'a2', 'a3', 'a4', 'passive'][index] ?? '';
}
