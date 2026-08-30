import { useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import { useHealth, useJobs, useRunJob } from '@/api/hooks';
import type { HealthReport, JobRunResult } from '@/api/types';
import { ConfirmTyped } from '@/components/ConfirmTyped';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatTimestamp } from '@/lib/format';

/**
 * Jobs and health (ADMIN_SUITE_DESIGN §2.19).
 *
 * Both endpoints have existed since P8i and neither had a screen: an operator who had just
 * shortened a retention window or published content the bot ladder should pick up had to
 * wait for the next scheduled run or ssh to the box. The list is deliberately a **closed
 * list of names** rather than a name that reaches anything callable — a generic "run this"
 * would be a remote-execution surface with an admin cookie in front of it — and both jobs
 * are written to be safe to run late or twice, which is what makes offering a button safe
 * at all.
 *
 * It still asks. A typed confirmation is not about danger here but about *scale*: the
 * nightly pass prunes rows across the whole database and the weekly rebuilds every bot's
 * roster, and neither is something to set off by brushing a key.
 *
 * The health half is the dashboard's strip with room to read it: the numbers on it are the
 * ARCHITECTURE §9 budgets, and the reason they are worth a page of their own is that a
 * degraded box is diagnosed by *which* number moved.
 */
export function JobsPage(): ReactNode {
  const jobs = useJobs();
  const health = useHealth();
  const run = useRunJob();
  const [pending, setPending] = useState<string | null>(null);
  const [last, setLast] = useState<JobRunResult | null>(null);

  if (jobs.isPending) return <LoadingState label="Reading the job list" />;
  if (jobs.error) return <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />;

  const list = jobs.data?.jobs ?? [];
  const job = list.find((entry) => entry.name === pending) ?? null;

  return (
    <>
      <PageHeader
        title="Jobs &amp; health"
        description="Scheduled work an operator can run now, and the numbers that say whether the box is coping."
        actions={
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void health.refetch()}
            loading={health.isFetching}
          >
            Refresh health
          </Button>
        }
      />

      <Stack gap="lg">
        <Card withBorder>
          <Title order={4} mb={4}>
            Scheduled work
          </Title>
          <Text size="xs" c="dimmed" mb="sm">
            These run themselves on a schedule. Running one by hand is for the operator who has just
            changed something the next run would otherwise sit on — both are written to be safe run
            late or twice.
          </Text>

          {list.length === 0 ? (
            <Text size="sm" c="dimmed">
              This build exposes no jobs.
            </Text>
          ) : (
            <Table fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={160}>Job</Table.Th>
                  <Table.Th>What it does</Table.Th>
                  <Table.Th w={120} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {list.map((entry) => (
                  <Table.Tr key={entry.name}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {entry.label}
                      </Text>
                      <Code>{entry.name}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {entry.description}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Button
                        size="compact-sm"
                        variant="default"
                        leftSection={<IconPlayerPlay size={14} />}
                        onClick={() => setPending(entry.name)}
                        disabled={run.isPending}
                      >
                        Run now
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {last && (
            <Alert color="mist" variant="light" mt="md" title={`${last.job} finished`}>
              <Stack gap={4}>
                <Text size="sm">Took {last.durationMs.toLocaleString()} ms.</Text>
                {last.result != null && (
                  <Code block fz="xs">
                    {JSON.stringify(last.result, null, 2)}
                  </Code>
                )}
              </Stack>
            </Alert>
          )}
        </Card>

        <HealthCard
          report={health.data ?? null}
          pending={health.isPending}
          failed={health.error != null}
        />
      </Stack>

      <ConfirmTyped
        opened={job !== null}
        onClose={() => setPending(null)}
        title={`Run ${job?.label ?? ''} now?`}
        confirmLabel="Run it"
        phrase={job?.name ?? ''}
        loading={run.isPending}
        onConfirm={() => {
          if (!job) return;
          run.mutate(
            { name: job.name },
            {
              onSuccess: (result) => {
                setPending(null);
                setLast(result);
                notifySuccess(
                  `${job.label} finished`,
                  `Took ${result.durationMs.toLocaleString()} ms.`,
                );
              },
              onError: (error) => notifyError(`Could not run ${job.label}`, error),
            },
          );
        }}
      >
        <Text size="sm">{job?.description}</Text>
        <Text size="sm" mt="xs" c="dimmed">
          It is safe to run late or twice, so this is not dangerous — but it works across the whole
          database, so it is worth meaning to.
        </Text>
      </ConfirmTyped>
    </>
  );
}

function HealthCard({
  report,
  pending,
  failed,
}: {
  report: HealthReport | null;
  pending: boolean;
  failed: boolean;
}): ReactNode {
  if (pending) return <LoadingState label="Reading server health" />;
  if (failed || !report) {
    return (
      <Alert
        color="red"
        variant="light"
        icon={<IconAlertTriangle size={16} />}
        title="No health report"
      >
        {/* A health endpoint that cannot be reached is itself the answer, so this says so
            rather than showing an empty card that reads like a healthy one. */}
        The server did not answer `/api/health`. That is either the process being down or the proxy
        in front of it; `STATUS.sh` on the box reads the same payload.
      </Alert>
    );
  }

  const hours = Math.floor(report.uptimeSeconds / 3600);
  const minutes = Math.floor((report.uptimeSeconds % 3600) / 60);

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Server health</Title>
        <Badge color={report.status === 'healthy' ? 'mist' : 'orange'} variant="light">
          {report.status}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="md">
        <Metric
          label="Uptime"
          value={`${hours}h ${minutes}m`}
          note={formatTimestamp(report.startedAt)}
        />
        <Metric
          label="Content revision"
          value={String(report.contentRevision)}
          note={report.nodeVersion}
        />
        <Metric label="Active battles" value={String(report.activeBattles)} />
        <Metric
          label="Database"
          value={report.database.ok ? `${report.database.latencyMs} ms` : 'unreachable'}
          note={report.database.ok ? 'round trip' : undefined}
        />
        <Metric
          label="RSS"
          value={`${report.memory.rssMb} MB`}
          note={`heap ${report.memory.heapUsedMb}/${report.memory.heapTotalMb} MB`}
        />
        <Metric
          label="Event loop"
          value={`${report.eventLoop.meanMs.toFixed(1)} ms`}
          note={`p99 ${report.eventLoop.p99Ms.toFixed(1)} · max ${report.eventLoop.maxMs.toFixed(1)}`}
        />
      </SimpleGrid>
    </Card>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string | undefined;
}): ReactNode {
  return (
    <Paper withBorder p="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="lg" fw={600}>
        {value}
      </Text>
      {note && (
        <Text size="xs" c="dimmed">
          {note}
        </Text>
      )}
    </Paper>
  );
}
