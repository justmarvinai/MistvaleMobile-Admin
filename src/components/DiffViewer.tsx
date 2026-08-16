import type { ReactNode } from 'react';
import { Accordion, Box, Group, Paper, Stack, Table, Text } from '@mantine/core';
import type { ContentDiffEntry, ContentDiffField } from '@/api/types';
import { contentTypeLabel } from '@/lib/content-registry';
import { ChangeBadge, RiskBadge } from './StateBadge';
import { EmptyState } from './QueryState';

/**
 * The publish diff (ADMIN_SUITE_DESIGN §2.17).
 *
 * Grouped by content type, then by entity, showing old → new per field with the
 * server's risk badge. This is the last screen between a draft and every player, so it
 * favours being readable over being clever: values are rendered as formatted JSON,
 * never summarised, because a summary is exactly where a mistake would hide.
 */

export function DiffViewer({ entries }: { entries: ContentDiffEntry[] }): ReactNode {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No pending changes"
        description="Everything in the database is published. Edit some content and it will show up here."
      />
    );
  }

  const grouped = groupByType(entries);

  return (
    <Stack gap="lg">
      {grouped.map(({ contentType, items }) => (
        <Box key={contentType}>
          <Group gap="xs" mb="xs">
            <Text fw={600} size="sm">
              {contentTypeLabel(contentType)}
            </Text>
            <Text size="xs" c="dimmed">
              {items.length} {items.length === 1 ? 'change' : 'changes'}
            </Text>
          </Group>

          <Accordion variant="separated" multiple chevronPosition="left">
            {items.map((entry) => (
              <Accordion.Item key={`${entry.contentType}:${entry.key}`} value={entry.key}>
                <Accordion.Control>
                  <Group gap="sm" wrap="nowrap">
                    <Text size="sm" ff="monospace">
                      {entry.key}
                    </Text>
                    <ChangeBadge change={entry.change} />
                    {entry.risk && <RiskBadge risk={entry.risk} />}
                    {entry.change === 'modified' && (
                      <Text size="xs" c="dimmed">
                        {entry.fields.length} {entry.fields.length === 1 ? 'field' : 'fields'}
                      </Text>
                    )}
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <FieldDiffTable entry={entry} />
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Box>
      ))}
    </Stack>
  );
}

function FieldDiffTable({ entry }: { entry: ContentDiffEntry }): ReactNode {
  if (entry.change === 'added') {
    return (
      <Text size="sm" c="dimmed">
        New entity — it does not exist in the live content yet, so there is nothing to compare
        against.
      </Text>
    );
  }
  if (entry.change === 'removed') {
    return (
      <Text size="sm" c="red">
        This entity will be removed from the live content at the next publish. Anything still
        referencing it will fail validation.
      </Text>
    );
  }
  if (entry.fields.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Saved without any field changing.
      </Text>
    );
  }

  return (
    <Table withTableBorder withColumnBorders fz="xs" layout="fixed">
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ width: '22%' }}>Field</Table.Th>
          <Table.Th style={{ width: '39%' }}>Live</Table.Th>
          <Table.Th style={{ width: '39%' }}>Draft</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {entry.fields.map((field) => (
          <Table.Tr key={field.path}>
            <Table.Td>
              <Text size="xs" ff="monospace" fw={600}>
                {field.path}
              </Text>
            </Table.Td>
            <Table.Td>
              <DiffValue value={field.before} tone="before" />
            </Table.Td>
            <Table.Td>
              <DiffValue value={field.after} tone="after" />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export function DiffValue({
  value,
  tone,
}: {
  value: unknown;
  tone: 'before' | 'after';
}): ReactNode {
  if (value === undefined) {
    return (
      <Text size="xs" c="dimmed" fs="italic">
        (not set)
      </Text>
    );
  }

  return (
    <Paper
      p={6}
      radius="sm"
      withBorder={false}
      bg={tone === 'before' ? 'rgba(255, 90, 90, 0.08)' : 'rgba(127, 212, 193, 0.10)'}
    >
      <Box className="mv-code" c={tone === 'before' ? 'red.3' : 'mist.3'}>
        {formatValue(value)}
      </Box>
    </Paper>
  );
}

/**
 * Renders a diff value.
 *
 * Objects are pretty-printed with sorted keys: the server compares nested objects as
 * wholes, so a re-ordered key would otherwise read as a change when nothing moved.
 */
export function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, sortedKeysReplacer, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function sortedKeysReplacer(_key: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

/** Groups diff entries by content type, preserving the server's ordering within a type. */
export function groupByType(
  entries: ContentDiffEntry[],
): { contentType: string; items: ContentDiffEntry[] }[] {
  const groups = new Map<string, ContentDiffEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.contentType);
    if (bucket) bucket.push(entry);
    else groups.set(entry.contentType, [entry]);
  }
  return [...groups.entries()]
    .map(([contentType, items]) => ({ contentType, items }))
    .sort((a, b) => contentTypeLabel(a.contentType).localeCompare(contentTypeLabel(b.contentType)));
}

/** Total field changes across a set of entries — the "37 fields changed" line. */
export function countFieldChanges(entries: ContentDiffEntry[]): number {
  return entries.reduce((total, entry) => total + entry.fields.length, 0);
}

export type { ContentDiffField };
