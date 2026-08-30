import { useState, type ReactNode } from 'react';
import { Badge, Card, Group, Pagination, SegmentedControl, Table, Tabs, Text } from '@mantine/core';
import { usePlayerGear, usePlayerRoster, usePlayerSummons } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { formatRelative } from '@/lib/format';

/**
 * What an account actually holds (ADMIN_SUITE_DESIGN §2.14).
 *
 * The page has reported holdings as three counts since the A5 slice, and the two support
 * questions an operator is actually asked — "my champion is gone" and "I never got the
 * relic" — are answered by *looking*. A count cannot look.
 *
 * **Read-only, and there is no edit button anywhere in it.** Every change to what an
 * account holds already exists as a grant, which lands in `economy_log`; a control here
 * that reached in and changed a relic would be the one mutation in the suite with no ledger
 * behind it.
 *
 * The tabs fetch lazily. A player page opened to answer "is this account banned" should not
 * pull a thousand relics on the way.
 */

const PAGE = 25;

export function HoldingsCard({ playerId }: { playerId: string }): ReactNode {
  const [tab, setTab] = useState<string | null>('champions');

  return (
    <Card withBorder padding="md">
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="champions">Roster</Tabs.Tab>
          <Tabs.Tab value="gear">Relics</Tabs.Tab>
          <Tabs.Tab value="summons">Pulls</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="champions">
          <RosterTab playerId={playerId} active={tab === 'champions'} />
        </Tabs.Panel>
        <Tabs.Panel value="gear">
          <GearTab playerId={playerId} active={tab === 'gear'} />
        </Tabs.Panel>
        <Tabs.Panel value="summons">
          <SummonsTab playerId={playerId} active={tab === 'summons'} />
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
}

function RosterTab({ playerId, active }: { playerId: string; active: boolean }): ReactNode {
  const roster = usePlayerRoster(playerId, active);
  if (roster.isPending) return <LoadingState label="Reading the roster" />;
  if (roster.error)
    return <ErrorState error={roster.error} onRetry={() => void roster.refetch()} />;

  const champions = roster.data?.champions ?? [];
  if (champions.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        This account holds no champions.
      </Text>
    );
  }

  return (
    <>
      <Text size="xs" c="dimmed" mb="xs">
        {champions.length} champions, strongest first.
      </Text>
      <Table fz="xs" striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Champion</Table.Th>
            <Table.Th ta="right">★</Table.Th>
            <Table.Th ta="right">Level</Table.Th>
            <Table.Th ta="right">Asc</Table.Th>
            <Table.Th ta="right">Awa</Table.Th>
            <Table.Th ta="right">Relics</Table.Th>
            <Table.Th ta="right">Masteries</Table.Th>
            <Table.Th>Flags</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {champions.map((champion) => (
            <Table.Tr key={champion.id}>
              <Table.Td>{champion.championKey}</Table.Td>
              <Table.Td ta="right">{champion.rank}</Table.Td>
              <Table.Td ta="right">{champion.level}</Table.Td>
              <Table.Td ta="right">{champion.ascension}</Table.Td>
              <Table.Td ta="right">{champion.awakening}</Table.Td>
              <Table.Td ta="right">{champion.relicsWorn} / 9</Table.Td>
              <Table.Td ta="right">{champion.masteries}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {champion.locked && (
                    <Badge size="xs" variant="light">
                      locked
                    </Badge>
                  )}
                  {champion.favourite && (
                    <Badge size="xs" variant="light" color="grape">
                      favourite
                    </Badge>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}

function GearTab({ playerId, active }: { playerId: string; active: boolean }): ReactNode {
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState('all');
  const gear = usePlayerGear(
    playerId,
    {
      limit: PAGE,
      offset: (page - 1) * PAGE,
      ...(scope === 'all' ? {} : { equipped: scope }),
    },
    active,
  );

  if (gear.isPending) return <LoadingState label="Reading the vault" />;
  if (gear.error) return <ErrorState error={gear.error} onRetry={() => void gear.refetch()} />;

  const total = gear.data?.total ?? 0;
  const relics = gear.data?.relics ?? [];

  return (
    <>
      <Group justify="space-between" mb="xs">
        <SegmentedControl
          size="xs"
          value={scope}
          onChange={(value) => {
            setScope(value);
            setPage(1);
          }}
          data={[
            { value: 'all', label: 'All' },
            // The loose vault is what the cap counts, so it is the question usually being
            // asked ("why can I not pick anything up").
            { value: 'false', label: 'Loose' },
            { value: 'true', label: 'Worn' },
          ]}
        />
        <Text size="xs" c="dimmed">
          {total} relics
        </Text>
      </Group>

      {relics.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nothing here.
        </Text>
      ) : (
        <>
          <Table fz="xs" striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Set</Table.Th>
                <Table.Th>Slot</Table.Th>
                <Table.Th ta="right">★</Table.Th>
                <Table.Th>Rarity</Table.Th>
                <Table.Th ta="right">+</Table.Th>
                <Table.Th>Main</Table.Th>
                <Table.Th>Substats</Table.Th>
                <Table.Th>Where</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {relics.map((relic) => (
                <Table.Tr key={relic.id}>
                  <Table.Td>{relic.setKey}</Table.Td>
                  <Table.Td>{relic.slot}</Table.Td>
                  <Table.Td ta="right">{relic.rank}</Table.Td>
                  <Table.Td>{relic.rarity}</Table.Td>
                  <Table.Td ta="right">{relic.level}</Table.Td>
                  <Table.Td>{relic.mainStat}</Table.Td>
                  <Table.Td>{relic.substats.join(' · ') || '—'}</Table.Td>
                  <Table.Td>{relic.equippedChampionId ? 'worn' : 'vault'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Pager total={total} page={page} onChange={setPage} />
        </>
      )}
    </>
  );
}

function SummonsTab({ playerId, active }: { playerId: string; active: boolean }): ReactNode {
  const [page, setPage] = useState(1);
  const summons = usePlayerSummons(playerId, { limit: PAGE, offset: (page - 1) * PAGE }, active);

  if (summons.isPending) return <LoadingState label="Reading the pull history" />;
  if (summons.error) {
    return <ErrorState error={summons.error} onRetry={() => void summons.refetch()} />;
  }

  const total = summons.data?.total ?? 0;
  const pulls = summons.data?.pulls ?? [];

  if (pulls.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        This account has never pulled.
      </Text>
    );
  }

  return (
    <>
      <Text size="xs" c="dimmed" mb="xs">
        {total} pulls, newest first.
      </Text>
      <Table fz="xs" striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>When</Table.Th>
            <Table.Th>Pool</Table.Th>
            <Table.Th>Champion</Table.Th>
            <Table.Th>Rarity</Table.Th>
            <Table.Th>Mercy</Table.Th>
            <Table.Th ta="right">Rev</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {pulls.map((pull) => (
            <Table.Tr key={pull.id}>
              <Table.Td>{formatRelative(pull.createdAt)}</Table.Td>
              <Table.Td>{pull.poolKey}</Table.Td>
              <Table.Td>{pull.championKey}</Table.Td>
              <Table.Td>{pull.rarity}</Table.Td>
              <Table.Td>
                {/* The field the support question turns on: "forty pulls and nothing" is
                    answered by whether mercy was doing anything. */}
                {pull.fromMercy ? (
                  <Badge size="xs" variant="light" color="grape">
                    mercy
                  </Badge>
                ) : (
                  <Text size="xs" c="dimmed">
                    —
                  </Text>
                )}
              </Table.Td>
              <Table.Td ta="right">{pull.contentRev}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Pager total={total} page={page} onChange={setPage} />
    </>
  );
}

function Pager({
  total,
  page,
  onChange,
}: {
  total: number;
  page: number;
  onChange: (page: number) => void;
}): ReactNode {
  const pages = Math.ceil(total / PAGE);
  if (pages <= 1) return null;
  return (
    <Group justify="center" mt="sm">
      <Pagination size="sm" value={page} onChange={onChange} total={pages} />
    </Group>
  );
}
