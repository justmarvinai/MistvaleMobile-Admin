import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Code,
  Collapse,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconFilterOff, IconHistory } from '@tabler/icons-react';
import { useAudit, type AuditFilter } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { DiffValue } from '@/components/DiffViewer';
import type { AuditLogEntry } from '@/api/types';

/**
 * The audit log (ADMIN_SUITE_DESIGN §2.17, gap G1).
 *
 * Every administrative mutation has recorded who, what and both sides of the change since
 * the game repo's P1 — and until now the suite could see ten of them, on the dashboard.
 * Ten is enough to notice that *something* happened. It is no use at all for the question
 * the log exists to answer, which only ever comes up on a bad day: what happened to this
 * thing, and who did it.
 *
 * Two things about the shape are deliberate. The filters **combine**, because an operator
 * arrives here from one of two directions — a name they are suspicious of, or an entity
 * that has gone wrong — and usually both at once by the second attempt. And a row is
 * **collapsed to its sentence** with before/after behind a chevron: a log where every row
 * is a JSON dump is one nobody scrolls, and the sentence is what an operator scans for.
 */

const PAGE_SIZE = 50;

export function AuditPage(): ReactNode {
  const [filter, setFilter] = useState<AuditFilter>({ limit: PAGE_SIZE, offset: 0 });
  const audit = useAudit(filter);

  // Narrowing anything resets to the first page. Keeping the offset would land an operator
  // on page four of a three-page result and look like an empty log.
  const narrow = (patch: Partial<AuditFilter>): void =>
    setFilter((current) => ({ ...current, ...patch, offset: 0 }));

  const actions = useMemo(
    () => (audit.data?.actions ?? []).map((value) => ({ value, label: value })),
    [audit.data?.actions],
  );
  const entities = useMemo(
    () => (audit.data?.entities ?? []).map((value) => ({ value, label: value })),
    [audit.data?.entities],
  );

  if (audit.isPending && !audit.data) return <LoadingState label="Reading the audit log" />;
  if (audit.error) return <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />;

  const data = audit.data;
  const offset = filter.offset ?? 0;
  const limit = filter.limit ?? PAGE_SIZE;
  const total = data?.total ?? 0;
  const shown = data?.entries.length ?? 0;
  const filtered = Boolean(
    filter.actor || filter.action || filter.entity || filter.entityId || filter.from || filter.to,
  );

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who changed what, and what it looked like on either side."
      />

      <Paper withBorder p="md" mb="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            label="Actor"
            placeholder="marvin"
            description="Matches part of the name"
            value={filter.actor ?? ''}
            onChange={(event) => narrow({ actor: event.currentTarget.value })}
            w={180}
          />
          <Select
            label="Action"
            placeholder="Any"
            data={actions}
            value={filter.action ?? null}
            onChange={(value) => narrow({ action: value ?? undefined })}
            searchable
            clearable
            w={200}
          />
          <Select
            label="Entity"
            placeholder="Any"
            data={entities}
            value={filter.entity ?? null}
            onChange={(value) => narrow({ entity: value ?? undefined })}
            clearable
            w={160}
          />
          <TextInput
            label="Entity id"
            placeholder="Exact"
            value={filter.entityId ?? ''}
            onChange={(event) => narrow({ entityId: event.currentTarget.value })}
            w={220}
          />
          <TextInput
            label="From"
            type="date"
            value={(filter.from ?? '').slice(0, 10)}
            onChange={(event) => narrow({ from: startOfDay(event.currentTarget.value) })}
            w={150}
          />
          <TextInput
            label="To"
            type="date"
            value={(filter.to ?? '').slice(0, 10)}
            onChange={(event) => narrow({ to: endOfDay(event.currentTarget.value) })}
            w={150}
          />
          <Button
            variant="subtle"
            leftSection={<IconFilterOff size={16} />}
            onClick={() => setFilter({ limit: PAGE_SIZE, offset: 0 })}
            disabled={!filtered}
          >
            Clear
          </Button>
        </Group>
      </Paper>

      {shown === 0 ? (
        <Paper withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconHistory size={32} opacity={0.4} />
            <Text c="dimmed" size="sm">
              {filtered
                ? 'Nothing in the log matches that. Widen the filter, or clear it.'
                : 'The log is empty. Every administrative change writes to it, so this means none has been made yet.'}
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Paper withBorder>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40} />
                <Table.Th w={180}>When</Table.Th>
                <Table.Th w={180}>Actor</Table.Th>
                <Table.Th w={200}>Action</Table.Th>
                <Table.Th>Subject</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data?.entries.map((entry) => (
                <Row key={entry.id} entry={entry} onPickEntity={narrow} />
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Group justify="space-between" mt="md">
        <Text size="sm" c="dimmed">
          {/* The count is of *matches*, not of the page: "3 changes to this stage" and
              "3 of 400" are different answers and a page cannot say which. */}
          {shown === 0
            ? `No entries${filtered ? ' match' : ''}`
            : `${offset + 1}–${offset + shown} of ${total}`}
        </Text>
        <Group gap="xs">
          <Button
            variant="default"
            size="xs"
            disabled={offset === 0}
            onClick={() => setFilter((c) => ({ ...c, offset: Math.max(0, offset - limit) }))}
          >
            Previous
          </Button>
          <Button
            variant="default"
            size="xs"
            disabled={offset + shown >= total}
            onClick={() => setFilter((c) => ({ ...c, offset: offset + limit }))}
          >
            Next
          </Button>
        </Group>
      </Group>
    </>
  );
}

/**
 * One entry: a sentence, with the two sides of the change behind a chevron.
 *
 * The subject is a **button** rather than text, because "what else happened to this
 * thing" is the second question every time the first one is asked, and making it a click
 * is the difference between a log and a search box somebody has to retype into.
 */
function Row({
  entry,
  onPickEntity,
}: {
  entry: AuditLogEntry;
  onPickEntity: (patch: Partial<AuditFilter>) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const hasDetail = entry.before !== null || entry.after !== null;

  return (
    <>
      <Table.Tr>
        <Table.Td>
          {hasDetail && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? 'Hide what changed' : 'Show what changed'}
            >
              {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </ActionIcon>
          )}
        </Table.Td>
        <Table.Td>
          <Text size="xs">{new Date(entry.createdAt).toLocaleString()}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{entry.actor}</Text>
        </Table.Td>
        <Table.Td>
          <Badge variant="light" size="sm">
            {entry.action}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap={6}>
            <Text size="xs" c="dimmed">
              {entry.entity}
            </Text>
            {entry.entityId && (
              <Code
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  onPickEntity({ entity: entry.entity, entityId: entry.entityId ?? undefined })
                }
                title="Show everything that happened to this"
              >
                {entry.entityId}
              </Code>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>
      {hasDetail && (
        <Table.Tr>
          <Table.Td colSpan={5} p={0} style={{ borderTop: 'none' }}>
            <Collapse in={open}>
              <Box p="sm">
                <Group align="flex-start" gap="md" grow>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      Before
                    </Text>
                    <DiffValue value={entry.before ?? undefined} tone="before" />
                  </Stack>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      After
                    </Text>
                    <DiffValue value={entry.after ?? undefined} tone="after" />
                  </Stack>
                </Group>
              </Box>
            </Collapse>
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

/**
 * A date input gives a day; the API wants an instant.
 *
 * Both ends are widened to the whole day, because an operator filtering "the 3rd to the
 * 5th" means those days inclusive — a naive midnight-to-midnight range silently drops
 * everything that happened on the last one.
 */
function startOfDay(day: string): string | undefined {
  return day ? new Date(`${day}T00:00:00.000Z`).toISOString() : undefined;
}

function endOfDay(day: string): string | undefined {
  return day ? new Date(`${day}T23:59:59.999Z`).toISOString() : undefined;
}
