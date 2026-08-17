import { type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Alert,
  Anchor,
  Badge,
  Card,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft } from '@tabler/icons-react';
import { usePlayer } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { formatRelative, formatTimestamp } from '@/lib/format';
import type { AdminPlayerDetail } from '@/api/types';
import { RankBadge, StatusBadge } from './badges';
import { PlayerActions } from './PlayerActions';

/**
 * One account, everything an operator needs about it (ADMIN_SUITE_DESIGN §2.14).
 *
 * Holdings are counts rather than contents on purpose: the question that brings an
 * operator here is "does this account have what it should", and 143 relics answers it
 * before a list of 143 relics does. The drill-in views arrive with A5 proper.
 */
export function PlayerDetailPage({ playerId }: { playerId: string }): ReactNode {
  const player = usePlayer(playerId);

  if (player.isPending) return <LoadingState label="Loading account…" />;
  if (player.error) {
    return (
      <ErrorState
        error={player.error}
        title="Could not load that account"
        onRetry={() => void player.refetch()}
      />
    );
  }

  const { account, player: profile } = player.data;

  return (
    <>
      <PageHeader
        title={account.accountName}
        description={`Profile “${profile.profileName}” · joined ${formatTimestamp(profile.createdAt)}`}
      />

      <Group mb="md" gap="xs">
        <Anchor component={Link} to="/players" size="sm">
          <Group gap={4}>
            <IconArrowLeft size={14} />
            All players
          </Group>
        </Anchor>
      </Group>

      <Stack gap="lg">
        <Group gap="xs">
          <RankBadge rank={account.rank} />
          <StatusBadge status={account.status} />
          {profile.isBot && (
            <Badge size="sm" variant="outline" color="gray">
              bot
            </Badge>
          )}
          {account.forcePasswordChange && (
            <Badge size="sm" variant="light" color="yellow">
              must change password
            </Badge>
          )}
        </Group>

        {account.status === 'banned' && (
          <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Banned">
            {account.banReason ?? 'No reason recorded.'}
          </Alert>
        )}

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <Stack gap="lg">
              <Wallet detail={player.data} />
              <ProgressCard detail={player.data} />
              <SessionsCard detail={player.data} />
              <LedgerCard detail={player.data} />
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 5 }}>
            <PlayerActions detail={player.data} />
          </Grid.Col>
        </Grid>
      </Stack>
    </>
  );
}

function Wallet({ detail }: { detail: AdminPlayerDetail }): ReactNode {
  const { player, holdings } = detail;
  return (
    <Card withBorder padding="md">
      <Title order={5} mb="sm">
        Profile
      </Title>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Stat label="Level" value={player.level} />
        <Stat label="Energy" value={`${player.energy} / ${player.energyCap}`} />
        <Stat label="Silver" value={player.silver.toLocaleString()} />
        <Stat label="Crystals" value={player.crystals.toLocaleString()} />
        <Stat label="Valor" value={player.valorMedals.toLocaleString()} />
        <Stat label="Champions" value={`${holdings.champions} / ${player.rosterCapacity}`} />
        <Stat label="Relics" value={holdings.gear} />
        <Stat label="Item stacks" value={holdings.itemStacks} />
      </SimpleGrid>
    </Card>
  );
}

function ProgressCard({ detail }: { detail: AdminPlayerDetail }): ReactNode {
  const floors = Object.entries(detail.progress.deepestFloors).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return (
    <Card withBorder padding="md">
      <Title order={5} mb="sm">
        Progress
      </Title>
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mb={floors.length > 0 ? 'md' : 0}>
        <Stat label="Stages cleared" value={detail.progress.stagesCleared} />
        <Stat label="Stars" value={detail.progress.stars} />
        <Stat label="Total clears" value={detail.progress.totalClears} />
      </SimpleGrid>
      {floors.length > 0 && (
        <Group gap="xs">
          {floors.map(([dungeon, floor]) => (
            <Badge key={dungeon} size="sm" variant="light" color="gray">
              {dungeon} · floor {floor}
            </Badge>
          ))}
        </Group>
      )}
    </Card>
  );
}

function SessionsCard({ detail }: { detail: AdminPlayerDetail }): ReactNode {
  return (
    <Card withBorder padding="md">
      <Title order={5} mb="sm">
        Sessions ({detail.sessions.length})
      </Title>
      {detail.sessions.length === 0 ? (
        <Text size="sm" c="dimmed">
          Not signed in anywhere.
        </Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Last seen</Table.Th>
              <Table.Th>From</Table.Th>
              <Table.Th>Client</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {detail.sessions.map((session) => (
              <Table.Tr key={session.id}>
                <Table.Td>
                  <Text size="sm">{formatRelative(session.lastSeenAt)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {session.ip ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {session.userAgent ?? '—'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Card>
  );
}

function LedgerCard({ detail }: { detail: AdminPlayerDetail }): ReactNode {
  return (
    <Card withBorder padding="md">
      <Title order={5} mb="sm">
        Recent economy
      </Title>
      {detail.economy.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nothing has moved yet.
        </Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>When</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th>Change</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {detail.economy.map((entry, index) => (
              <Table.Tr key={`${entry.createdAt}-${index}`}>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatRelative(entry.createdAt)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {entry.source}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {Object.entries(entry.deltas).map(([key, value]) => (
                      <Badge
                        key={key}
                        size="xs"
                        variant="light"
                        color={value < 0 ? 'red' : 'green'}
                      >
                        {value > 0 ? '+' : ''}
                        {value.toLocaleString()} {key}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }): ReactNode {
  return (
    <Paper p="xs" withBorder>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text size="lg" fw={600}>
        {value}
      </Text>
    </Paper>
  );
}
