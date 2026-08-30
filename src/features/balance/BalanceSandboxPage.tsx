import { useMemo, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconFlask, IconInfoCircle, IconPlayerPlay } from '@tabler/icons-react';
import { useContentList, useSimulateStage } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import {
  BENCH_TIERS,
  BENCH_TIER_HINTS,
  BENCH_TIER_LABELS,
  SIMULATE_SOURCES,
  type BenchTier,
  type SimulateResult,
  type SimulateSource,
} from '@/api/types';
import { flatten, placeNames, stageOptions } from './stageOptions';

/**
 * The balance sandbox (ADMIN_SUITE_DESIGN §2.13).
 *
 * Retuning a stage was already an edit; *checking* the retune was a deploy — the only way
 * to find out what a change did was to publish it and go and play the stage. This fights it
 * instead: many runs, a named bench team, and the numbers a tuning decision is actually
 * made on.
 *
 * Three things about it are worth knowing while reading a result, and all three are said on
 * the screen rather than left in a doc:
 *
 *  - **It is the same simulation CI runs.** The game repo's `packages/sim` holds one
 *    `simulateStage` and one definition of each bench team, and both `pnpm sim` and this
 *    call it. A number here is directly comparable to a gate's.
 *  - **Draft means draft.** The pending edits are layered over live exactly as a publish
 *    would, so what is measured is the change rather than what is already published.
 *  - **It writes nothing.** No player, no roster, no content — and no audit row, because
 *    the audit log is the record of what an operator changed.
 *
 * The stage list comes from the ordinary content endpoint rather than a bespoke one: there
 * is already a place that knows how to list four hundred stages, and a second would drift.
 */

const DEFAULT_RUNS = 60;
const MAX_RUNS = 200;

export function BalanceSandboxPage(): ReactNode {
  const stages = useContentList('stages');
  const chapters = useContentList('chapters');
  const dungeons = useContentList('dungeons');
  const simulate = useSimulateStage();

  const [stageKey, setStageKey] = useState<string | null>(null);
  const [tier, setTier] = useState<BenchTier>('modest');
  const [source, setSource] = useState<SimulateSource>('live');
  const [runs, setRuns] = useState<number>(DEFAULT_RUNS);
  const [result, setResult] = useState<SimulateResult | null>(null);

  const options = useMemo(() => {
    if (!stages.data) return [];
    return stageOptions(
      stages.data.items,
      placeNames(chapters.data?.items ?? [], dungeons.data?.items ?? []),
    );
  }, [stages.data, chapters.data, dungeons.data]);

  if (stages.isPending) return <LoadingState label="Loading the stages" />;
  if (stages.error)
    return <ErrorState error={stages.error} onRetry={() => void stages.refetch()} />;

  const run = (): void => {
    if (!stageKey) return;
    simulate.mutate(
      { stageKey, tier, source, runs },
      { onSuccess: (response) => setResult(response.result) },
    );
  };

  return (
    <>
      <PageHeader
        title="Balance sandbox"
        description="Fight a stage a hundred times before anybody has to fight it once."
      />

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="md">
        <Text size="sm">
          This is the same simulation the game repo’s <code>pnpm sim</code> gates run — one{' '}
          <code>simulateStage</code> and one definition of each bench team, so a number here is
          directly comparable to a gate’s. It reads content and writes nothing: no player, no
          roster, no progress, and no audit entry.
        </Text>
        <Text size="sm" mt="xs">
          <strong>Draft</strong> layers the pending edits over live exactly as a publish would, so
          you can measure a retune before it ships. Nothing is published by running it — the{' '}
          <Link to="/publish">publish centre</Link> is still the only thing that does that.
        </Text>
      </Alert>

      <Paper withBorder p="md" mb="md">
        <Stack gap="sm">
          <Select
            label="Stage"
            placeholder="Search by chapter, difficulty or key"
            data={options}
            value={stageKey}
            onChange={setStageKey}
            searchable
            clearable
            limit={40}
            nothingFoundMessage="No stage matches that"
            description={`${flatten(options).length} stages published`}
          />

          <Group align="flex-end" gap="md" wrap="wrap">
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Team
              </Text>
              <SegmentedControl
                value={tier}
                onChange={(value) => setTier(value as BenchTier)}
                data={BENCH_TIERS.map((key) => ({ value: key, label: BENCH_TIER_LABELS[key] }))}
              />
            </Stack>

            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Content
              </Text>
              <SegmentedControl
                value={source}
                onChange={(value) => setSource(value as SimulateSource)}
                data={SIMULATE_SOURCES.map((key) => ({
                  value: key,
                  label: key === 'live' ? 'Live' : 'Draft',
                }))}
              />
            </Stack>

            <NumberInput
              label="Runs"
              value={runs}
              onChange={(value) => setRuns(typeof value === 'number' ? value : DEFAULT_RUNS)}
              min={1}
              max={MAX_RUNS}
              step={10}
              w={110}
              description={`up to ${MAX_RUNS}`}
            />

            <Button
              leftSection={<IconPlayerPlay size={16} />}
              onClick={run}
              loading={simulate.isPending}
              disabled={!stageKey}
            >
              Simulate
            </Button>
          </Group>

          <Text size="xs" c="dimmed">
            {BENCH_TIER_HINTS[tier]}
          </Text>
        </Stack>
      </Paper>

      {simulate.error && <ErrorState error={simulate.error} onRetry={run} />}

      {result && <Report result={result} />}

      {!result && !simulate.isPending && (
        <Paper withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconFlask size={32} opacity={0.4} />
            <Text c="dimmed" size="sm">
              Pick a stage and press Simulate. A run is a fraction of a millisecond — longer when
              the team loses, because a loss plays out to the turn cap — so sixty of them is a
              blink.
            </Text>
          </Stack>
        </Paper>
      )}
    </>
  );
}

/**
 * What the run said.
 *
 * The win rate first because it is the question, the turn figures second because they are
 * how it was won, and the team last — but always present, because a win rate without the
 * team that produced it is a number nobody can act on.
 */
function Report({ result }: { result: SimulateResult }): ReactNode {
  const pct = Math.round(result.winRate * 100);
  const starPct =
    result.winsWithinStarLimit === null ? null : Math.round(result.winsWithinStarLimit * 100);

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Group justify="space-between" align="flex-start" mb="sm" wrap="wrap">
          <div>
            <Title order={4}>{result.stageLabel}</Title>
            <Text size="xs" c="dimmed">
              <code>{result.stageKey}</code>
            </Text>
          </div>
          <Group gap="xs">
            <Badge variant="light" color={result.source === 'draft' ? 'orange' : 'blue'}>
              {result.source === 'draft' ? 'Draft content' : 'Live content'}
            </Badge>
            <Badge variant="light">{BENCH_TIER_LABELS[result.tier]} team</Badge>
            <Badge variant="light" color="gray">
              {result.runs} runs
            </Badge>
          </Group>
        </Group>

        <Text size="sm" fw={500} mb={4}>
          Won {result.wins} of {result.runs} — {pct}%
        </Text>
        <Progress value={pct} color={winColour(pct)} size="lg" mb="md" />

        <Table withRowBorders={false}>
          <Table.Tbody>
            <Row
              label="Average turns"
              hint="Winning runs only — a loss runs to the cap and would drag the mean toward it."
              value={result.averageTurns === null ? '—' : result.averageTurns.toLocaleString()}
            />
            <Row
              label="Median turns"
              hint="The middle winning run, which a long tail cannot move."
              value={result.medianTurns === null ? '—' : result.medianTurns.toLocaleString()}
            />
            {result.starTurnLimit !== null && (
              <Row
                label={`Three-star limit (${result.starTurnLimit} turns)`}
                hint="Share of all runs that finished inside it — losses count against, because a run that did not finish did not finish quickly."
                value={starPct === null ? '—' : `${starPct}%`}
              />
            )}
            <Row
              label="Cost"
              hint="Wall clock on the game server, per run."
              value={`${result.msPerRun.toFixed(2)} ms`}
            />
          </Table.Tbody>
        </Table>
      </Paper>

      <Paper withBorder p="md">
        <Title order={5} mb="xs">
          The team that fought it
        </Title>
        <Text size="xs" c="dimmed" mb="sm">
          Picked by key rather than by strength, deliberately: a benchmark whose baseline drifts
          when a champion is retuned cannot be compared to yesterday’s answer.
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Champion</Table.Th>
              <Table.Th>Level</Table.Th>
              <Table.Th>Rank</Table.Th>
              <Table.Th>Ascension</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {result.team.map((member) => (
              <Table.Tr key={member.championKey}>
                <Table.Td>
                  {member.name}{' '}
                  <Text component="span" size="xs" c="dimmed">
                    ({member.championKey})
                  </Text>
                </Table.Td>
                <Table.Td>{member.level}</Table.Td>
                <Table.Td>★{member.rank}</Table.Td>
                <Table.Td>{member.ascension}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

function Row({ label, hint, value }: { label: string; hint: string; value: string }): ReactNode {
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm">{label}</Text>
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" fw={600}>
          {value}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * The bar's colour, and it is a reading rather than a decoration.
 *
 * There is no universally right win rate — an entry stage should be near-certain and a
 * warlord should not — so the bands are deliberately wide and only flag the two ends that
 * are wrong whatever the stage is: nobody clears it, or everybody does without trying.
 */
function winColour(pct: number): string {
  if (pct < 25) return 'red';
  if (pct < 60) return 'orange';
  return 'teal';
}
