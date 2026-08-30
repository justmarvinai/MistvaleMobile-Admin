import type { ReactNode } from 'react';
import {
  Badge,
  Card,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconActivity,
  IconCards,
  IconRobot,
  IconSparkles,
  IconSwords,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react';
import { useHealth, useStatsOverview } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import type { AuditEntry, HealthReport, StatsOverview } from '@/api/types';
import { ActivityPanel } from './ActivityPanel';
import { formatRelative, formatTimestamp } from '@/lib/format';

/**
 * Dashboard (ADMIN_SUITE_DESIGN §2.1).
 *
 * The KPI set is bounded by what the server actually exposes today: `/stats/overview`
 * plus the admin-gated `/api/health`. Battle, summon and economy panels arrive with the
 * endpoints that back them (game phases P2 and P5) rather than as empty placeholders.
 */
export function DashboardPage(): ReactNode {
  const stats = useStatsOverview();
  const health = useHealth();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live state of the Mistvale server: accounts, content and process health."
      />

      {stats.isPending ? (
        <LoadingState label="Loading stats…" />
      ) : stats.error ? (
        <ErrorState
          error={stats.error}
          title="Could not load stats"
          onRetry={() => void stats.refetch()}
        />
      ) : (
        <Stack gap="lg">
          <KpiCards stats={stats.data} />
          <ActivityPanel stats={stats.data} />

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Card>
                <Group justify="space-between" mb="sm">
                  <Text fw={600} size="sm">
                    Recent activity
                  </Text>
                  <Text size="xs" c="dimmed">
                    last {stats.data.recentAudit.length} audit entries
                  </Text>
                </Group>
                <AuditTable entries={stats.data.recentAudit} />
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Card>
                <Group justify="space-between" mb="sm">
                  <Text fw={600} size="sm">
                    Server health
                  </Text>
                  {health.data && (
                    <Badge
                      size="sm"
                      variant="light"
                      color={health.data.status === 'healthy' ? 'mist' : 'orange'}
                    >
                      {health.data.status}
                    </Badge>
                  )}
                </Group>
                {health.isPending ? (
                  <LoadingState label="Probing…" />
                ) : health.error ? (
                  <ErrorState
                    error={health.error}
                    title="Health probe failed"
                    onRetry={() => void health.refetch()}
                  />
                ) : (
                  <HealthStrip health={health.data} />
                )}
              </Card>
            </Grid.Col>
          </Grid>
        </Stack>
      )}
    </>
  );
}

function KpiCards({ stats }: { stats: StatsOverview }): ReactNode {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
      <Kpi
        label="Players"
        value={stats.players.total}
        hint={`${stats.players.activeToday} active today`}
        icon={<IconUsers size={18} />}
      />
      <Kpi
        label="Bots"
        value={stats.players.bots}
        hint="Arena ladder filler"
        icon={<IconRobot size={18} />}
      />
      <Kpi
        label="Accounts"
        value={stats.accounts.total}
        hint={`${stats.accounts.admins} admin · ${stats.accounts.banned} banned`}
        icon={<IconUserCheck size={18} />}
      />
      <Kpi
        label="Content revision"
        value={`#${stats.content.rev}`}
        hint={
          stats.content.publishedAt
            ? `published ${formatRelative(stats.content.publishedAt)}`
            : 'nothing published yet'
        }
        icon={<IconActivity size={18} />}
      />
      <Kpi
        label="Champions"
        value={stats.content.champions}
        hint="live"
        icon={<IconCards size={18} />}
      />
      <Kpi
        label="Skills"
        value={stats.content.skills}
        hint="live"
        icon={<IconSparkles size={18} />}
      />
      <Kpi
        label="Enemies"
        value={stats.content.enemies}
        hint="live"
        icon={<IconSwords size={18} />}
      />
      <Kpi
        label="Stages"
        value={stats.content.stages}
        hint="live"
        icon={<IconSwords size={18} />}
      />
    </SimpleGrid>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
}): ReactNode {
  return (
    <Paper p="md" radius="sm">
      <Group justify="space-between" wrap="nowrap" mb={4}>
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" lts={0.5}>
          {label}
        </Text>
        <Text c="mist.4">{icon}</Text>
      </Group>
      <Text fz={26} fw={700} lh={1.1} className="mv-tabular">
        {value}
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        {hint}
      </Text>
    </Paper>
  );
}

function HealthStrip({ health }: { health: HealthReport }): ReactNode {
  const rows: { label: string; value: string; warn?: boolean }[] = [
    { label: 'Uptime', value: formatDuration(health.uptimeSeconds) },
    { label: 'Node', value: health.nodeVersion },
    {
      label: 'Memory (RSS)',
      value: `${health.memory.rssMb} MB`,
      // The target box is 1 core / 4 GB; the server's own budget is well under 1 GB.
      warn: health.memory.rssMb > 900,
    },
    { label: 'Heap used', value: `${health.memory.heapUsedMb} MB` },
    {
      label: 'Event loop p99',
      value: `${health.eventLoop.p99Ms} ms`,
      warn: health.eventLoop.p99Ms > 50,
    },
    {
      label: 'Database',
      value: health.database.ok ? `ok · ${health.database.latencyMs} ms` : 'unreachable',
      warn: !health.database.ok,
    },
    { label: 'Content revision', value: `#${health.contentRevision}` },
    { label: 'Active battles', value: String(health.activeBattles) },
  ];

  return (
    <Stack gap={6}>
      {rows.map((row) => (
        <Group key={row.label} justify="space-between" wrap="nowrap">
          <Text size="sm" c="dimmed">
            {row.label}
          </Text>
          <Text size="sm" fw={500} c={row.warn ? 'orange' : undefined} className="mv-tabular">
            {row.value}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

function AuditTable({ entries }: { entries: AuditEntry[] }): ReactNode {
  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed" py="md">
        No audit entries yet. Every content edit, publish and player action lands here.
      </Text>
    );
  }

  return (
    <Table fz="sm" className="mv-tabular">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>When</Table.Th>
          <Table.Th>Actor</Table.Th>
          <Table.Th>Action</Table.Th>
          <Table.Th>Entity</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {entries.map((entry, index) => (
          <Table.Tr key={`${entry.createdAt}-${entry.action}-${index}`}>
            <Table.Td>
              <Tooltip label={formatTimestamp(entry.createdAt)} withArrow>
                <Text size="xs" c="dimmed">
                  {formatRelative(entry.createdAt)}
                </Text>
              </Tooltip>
            </Table.Td>
            <Table.Td>
              <Text size="xs">{entry.actor ?? 'system'}</Text>
            </Table.Td>
            <Table.Td>
              <Badge size="xs" variant="light" color={auditColor(entry.action)}>
                {entry.action}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="xs" ff="monospace" c="dimmed">
                {entry.entity
                  ? `${entry.entity}${entry.entityId ? `/${entry.entityId}` : ''}`
                  : '—'}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function auditColor(action: string): string {
  if (action.includes('delete') || action.includes('revert')) return 'red';
  if (action.includes('publish')) return 'mist';
  if (action.includes('create')) return 'teal';
  return 'gray';
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
