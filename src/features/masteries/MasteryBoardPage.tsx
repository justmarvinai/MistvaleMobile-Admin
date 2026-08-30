import { useMemo, type ReactNode } from 'react';
import { Alert, Badge, Card, Grid, Group, Paper, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconBinaryTree } from '@tabler/icons-react';
import { useContentList } from '@/api/hooks';
import { ContentItemLink } from '@/components/nav';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import {
  MASTERY_MAX_TIER,
  MASTERY_MIN_TIER,
  MAX_TREES,
  PICKS_BY_TIER,
  TOTAL_PICKS,
  board,
  boardProblems,
  effectSentence,
  type MasteryNodeLike,
} from './masteryBoard';

/**
 * The mastery board (ADMIN_SUITE_DESIGN §2.12).
 *
 * Forty-eight nodes in the generic browser are forty-eight rows in key order, and two
 * things that decide whether the content works are invisible there: **what a node does** —
 * the effect is a discriminated union nested inside an array, so a JSON form shows
 * `{"type":"stat","stat":"atk","flat":40}` where the operator is thinking "+40 attack" —
 * and **whether the board can be spent**.
 *
 * A reviewing view rather than a canvas, deliberately. §2.12 asked for a node canvas with
 * connectivity validation, and the connectivity turned out not to exist: Mistvale's board
 * has no prerequisite edges between nodes at all. The gating is arithmetic — a tier opens
 * on picks spent below it, at most two trees open, and each tier has a hard allowance — so
 * a canvas would draw lines that are not in the data. The tiers, the counts and the two
 * ways a board can be authored into a wall are what the data actually says.
 */
export function MasteryBoardPage(): ReactNode {
  const list = useContentList('masteries');

  const nodes = useMemo(
    () =>
      (list.data?.items ?? [])
        .map((item) => item.data as unknown as MasteryNodeLike)
        .filter((node) => node && typeof node.tree === 'string' && typeof node.tier === 'number'),
    [list.data],
  );

  const trees = useMemo(() => board(nodes), [nodes]);
  const problems = useMemo(() => boardProblems(nodes), [nodes]);

  if (list.isPending) return <LoadingState label="Loading the board" />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <>
      <PageHeader
        title="Mastery board"
        description="Three trees, six tiers, and what every node actually does."
      />

      {nodes.length === 0 ? (
        <Paper withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconBinaryTree size={32} opacity={0.4} />
            <Text c="dimmed" size="sm">
              No masteries are published.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="md">
          {problems.length > 0 && (
            <Alert
              icon={<IconAlertTriangle size={16} />}
              color="red"
              variant="light"
              title={`${problems.length} ${problems.length === 1 ? 'problem' : 'problems'} publish will refuse`}
            >
              <Stack gap={4}>
                {problems.map((problem) => (
                  <Text key={`${problem.tree ?? 'board'}-${problem.tier ?? 0}`} size="sm">
                    {problem.tree ? <strong>{problem.tree}</strong> : <strong>The board</strong>} —{' '}
                    {problem.message}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}

          <Paper withBorder p="md">
            <Text size="sm" c="dimmed">
              A champion spends <strong>{TOTAL_PICKS}</strong> picks across at most{' '}
              <strong>{MAX_TREES}</strong> trees, with a hard allowance per tier —{' '}
              {PICKS_BY_TIER.slice(MASTERY_MIN_TIER, MASTERY_MAX_TIER + 1)
                .map((picks, index) => `${picks} at tier ${index + MASTERY_MIN_TIER}`)
                .join(', ')}
              . A tier opens once enough has been spent below it, counted across the whole build
              rather than per tree, which is what keeps a two-tree build possible.
            </Text>
          </Paper>

          <Grid gutter="md">
            {trees.map((tree) => (
              <Grid.Col key={tree.tree} span={{ base: 12, lg: 4 }}>
                <Card withBorder h="100%">
                  <Group justify="space-between" mb="sm">
                    <Title order={4}>{tree.label}</Title>
                    <Badge variant="light" size="sm">
                      {tree.total} nodes
                    </Badge>
                  </Group>
                  <Stack gap="sm">
                    {tree.tiers.map((cell) => (
                      <div key={cell.tier}>
                        <Group gap={6} mb={4}>
                          <Text size="xs" fw={600} c="dimmed">
                            Tier {cell.tier}
                          </Text>
                          <Text size="xs" c={cell.nodes.length === 0 ? 'red' : 'dimmed'}>
                            {cell.nodes.length} · {PICKS_BY_TIER[cell.tier] ?? 0} pick
                            {(PICKS_BY_TIER[cell.tier] ?? 0) === 1 ? '' : 's'} allowed
                          </Text>
                        </Group>
                        <Stack gap={4}>
                          {cell.nodes.map((node) => (
                            <NodeRow key={node.key} node={node} />
                          ))}
                          {cell.nodes.length === 0 && (
                            <Text size="xs" c="red">
                              Nothing published — a dead end.
                            </Text>
                          )}
                        </Stack>
                      </div>
                    ))}
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Stack>
      )}
    </>
  );
}

function NodeRow({ node }: { node: MasteryNodeLike }): ReactNode {
  const sentences = (node.effects ?? []).map(effectSentence);
  return (
    <Paper withBorder p={6} radius="sm">
      <Group justify="space-between" gap={6} wrap="nowrap" align="flex-start">
        <div style={{ minWidth: 0 }}>
          <Tooltip label={node.description || node.key} withArrow multiline w={280}>
            <Text size="xs" fw={500}>
              {node.name}
            </Text>
          </Tooltip>
          <Stack gap={0}>
            {sentences.map((sentence) => (
              <Text key={sentence} size="xs" c="dimmed">
                {sentence}
              </Text>
            ))}
          </Stack>
        </div>
        <Text
          component={ContentItemLink}
          typePath="masteries"
          entityKey={node.key}
          size="xs"
          c="mist"
          style={{ whiteSpace: 'nowrap' }}
        >
          edit
        </Text>
      </Group>
    </Paper>
  );
}
