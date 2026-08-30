import { useMemo, useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  Code,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSearch, IconSwords } from '@tabler/icons-react';
import { useBattle, useBattles } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import type { BattleDetail } from '@/api/types';
import { actorsOf, asEvents, filterTurns, turnsOf, typesOf } from './eventLog';

/**
 * The battle inspector (ADMIN_SUITE_DESIGN §2.18).
 *
 * The debugging tool for "that fight felt wrong". It works at all because a battle **is**
 * its event log: the engine is deterministic given a seed, the server keeps the whole log
 * on the row, and the game client only ever renders it. So what is on this screen is what
 * the player saw — not a reconstruction, which could differ in exactly the case somebody
 * is asking about.
 *
 * The viewer adds nothing to the record. It groups the log into the engine's own turns and
 * filters it; it does not interpret an event, because two operators looking at one battle
 * have to see the same fight.
 */
export function BattleInspectorPage(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const battles = useBattles({ limit: 25, ...(mode ? { mode } : {}) });
  const battle = useBattle(selected);

  const modes = useMemo(
    () => [...new Set((battles.data?.battles ?? []).map((row) => row.mode))].sort(),
    [battles.data],
  );

  return (
    <>
      <PageHeader
        title="Battle inspector"
        description="What actually happened in a fight, turn by turn, from the log the player saw."
      />

      <Paper withBorder p="md" mb="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            label="Battle id"
            placeholder="Paste one from a report"
            value={pasted}
            onChange={(event) => setPasted(event.currentTarget.value)}
            w={340}
          />
          <Button
            leftSection={<IconSearch size={16} />}
            onClick={() => setSelected(pasted.trim() || null)}
            disabled={pasted.trim().length === 0}
          >
            Open
          </Button>
          <Select
            label="Or pick from recent"
            placeholder="Any mode"
            data={modes.map((value) => ({ value, label: value }))}
            value={mode}
            onChange={setMode}
            clearable
            w={180}
          />
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card>
          <Text fw={600} size="sm" mb="sm">
            Recent battles
          </Text>
          {battles.isPending ? (
            <LoadingState label="Loading" />
          ) : battles.error ? (
            <ErrorState error={battles.error} onRetry={() => void battles.refetch()} />
          ) : battles.data.battles.length === 0 ? (
            <Text size="sm" c="dimmed">
              No battles yet. Every fight in the game writes a row here as it starts.
            </Text>
          ) : (
            <ScrollArea h={420}>
              <Table highlightOnHover fz="xs">
                <Table.Tbody>
                  {battles.data.battles.map((row) => (
                    <Table.Tr
                      key={row.id}
                      onClick={() => setSelected(row.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Table.Td>
                        <Text size="xs">{row.profileName ?? '—'}</Text>
                        <Text size="xs" c="dimmed">
                          {row.mode} · {row.stageKey}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Badge
                          size="sm"
                          variant="light"
                          color={row.outcome === 'victory' ? 'mist' : row.outcome ? 'red' : 'gray'}
                        >
                          {row.outcome ?? row.status}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {row.turns} turns
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>

        <Card>
          {!selected ? (
            <Stack align="center" gap="xs" py="xl">
              <IconSwords size={32} opacity={0.4} />
              <Text c="dimmed" size="sm" ta="center">
                Pick a battle, or paste an id from a report. What you get is the engine&rsquo;s own
                log — the same record the player&rsquo;s screen was drawn from.
              </Text>
            </Stack>
          ) : battle.isPending ? (
            <LoadingState label="Reading the log" />
          ) : battle.error ? (
            <ErrorState error={battle.error} onRetry={() => void battle.refetch()} />
          ) : (
            <BattleView battle={battle.data} />
          )}
        </Card>
      </SimpleGrid>
    </>
  );
}

function BattleView({ battle }: { battle: BattleDetail }): ReactNode {
  const [actor, setActor] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);

  const events = useMemo(() => asEvents(battle.events), [battle.events]);
  const turns = useMemo(() => turnsOf(events), [events]);
  const shown = useMemo(
    () => filterTurns(turns, { ...(actor ? { actor } : {}), ...(type ? { type } : {}) }),
    [turns, actor, type],
  );

  const name = (side: string, slot: number): string => {
    const list = side === 'ally' ? battle.allies : battle.enemies;
    return list.find((unit) => unit.slot === slot)?.name ?? `${side}:${slot}`;
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Text fw={600} size="sm">
            {battle.mode} · {battle.stageKey}
          </Text>
          <Text size="xs" c="dimmed">
            {battle.profileName ?? 'unknown warden'} · {battle.turns} turns ·{' '}
            {battle.outcome ?? battle.status}
          </Text>
        </div>
        <Group gap="xs">
          {/* The seed is on the screen because with it the fight is reproducible exactly,
              which is the difference between investigating a report and guessing at it. */}
          <Badge variant="light" size="sm">
            seed {battle.seed}
          </Badge>
          <Badge variant="light" size="sm" color="gray">
            rev #{battle.contentRev}
          </Badge>
        </Group>
      </Group>

      <SimpleGrid cols={2} spacing="xs">
        <Side title="Party" units={battle.allies} />
        <Side title="Against" units={battle.enemies} />
      </SimpleGrid>

      <Group gap="xs">
        <Select
          size="xs"
          placeholder="Any unit"
          data={actorsOf(events).map((value) => {
            const [side, slot] = value.split(':');
            return { value, label: name(side ?? '', Number(slot)) };
          })}
          value={actor}
          onChange={setActor}
          clearable
          w={180}
        />
        <Select
          size="xs"
          placeholder="Any event"
          data={typesOf(events).map((value) => ({ value, label: value }))}
          value={type}
          onChange={setType}
          clearable
          w={180}
        />
        <Text size="xs" c="dimmed">
          {shown.reduce((total, turn) => total + turn.events.length, 0)} of {events.length} events
        </Text>
      </Group>

      {events.length === 0 ? (
        <Text size="sm" c="dimmed">
          This battle has no log. A fight that never started, or one the nightly prune has already
          been over.
        </Text>
      ) : (
        <ScrollArea h={380}>
          <Stack gap={4}>
            {shown.map((turn) => (
              <div key={`${turn.turn}-${turn.events.length}`}>
                <Text size="xs" c="dimmed" fw={600} mb={2}>
                  {turn.turn === 0 ? 'Setup' : `Turn ${turn.turn}`}
                </Text>
                {turn.events.map((event, index) => (
                  <Code key={index} block fz={10} mb={2}>
                    {JSON.stringify(event)}
                  </Code>
                ))}
              </div>
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
}

function Side({ title, units }: { title: string; units: BattleDetail['allies'] }): ReactNode {
  return (
    <Paper withBorder p="xs">
      <Text size="xs" c="dimmed" mb={4}>
        {title}
      </Text>
      {units.length === 0 ? (
        <Text size="xs" c="dimmed">
          — none recorded
        </Text>
      ) : (
        units.map((unit) => (
          <Text key={`${unit.side}:${unit.slot}`} size="xs">
            {unit.slot + 1}. {unit.name}
          </Text>
        ))
      )}
    </Paper>
  );
}
