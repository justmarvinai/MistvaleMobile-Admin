import { useMemo, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconCalendarMonth, IconNews } from '@tabler/icons-react';
import { useContentList } from '@/api/hooks';
import { ContentItemLink } from '@/components/nav';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { rewardLines, type RewardsLike } from './goalText';

/**
 * The login calendar and the news board (ADMIN_SUITE_DESIGN §2.11).
 *
 * A track is one entity carrying thirty days in an array, so the browser shows it as a
 * JSON blob three screens tall and an operator asking "what does day 21 pay" has to count
 * array elements. It is a grid here, which is what it is in the game.
 *
 * A news post's window is the other half: `startsAt`/`endsAt` are ISO strings and an empty
 * one means *unbounded*, which read literally looks like a post that never shows. Whether a
 * post is live right now is a fact about the clock, so it is computed and stated.
 */

interface TrackDay {
  day: number;
  rewards?: RewardsLike;
  grants?: { champions?: string[]; choices?: string[]; relics?: unknown[] };
}

interface TrackLike {
  key: string;
  name: string;
  description?: string;
  track?: string;
  active?: boolean;
  days?: TrackDay[];
}

interface NewsLike {
  key: string;
  title: string;
  body?: string;
  active?: boolean;
  pinned?: boolean;
  startsAt?: string;
  endsAt?: string;
  sortOrder?: number;
}

export function SchedulePage(): ReactNode {
  const tracks = useContentList('login-tracks');
  const news = useContentList('news');

  const trackList = useMemo(
    () =>
      (tracks.data?.items ?? [])
        .map((item) => item.data as unknown as TrackLike)
        .sort((a, b) => (a.days?.length ?? 0) - (b.days?.length ?? 0)),
    [tracks.data],
  );
  const newsList = useMemo(
    () =>
      (news.data?.items ?? [])
        .map((item) => item.data as unknown as NewsLike)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [news.data],
  );

  if (tracks.isPending || news.isPending) return <LoadingState label="Reading the schedule" />;
  const failure = tracks.error ?? news.error;
  if (failure) {
    return (
      <ErrorState
        error={failure}
        onRetry={() => {
          void tracks.refetch();
          void news.refetch();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Calendar &amp; news"
        description="The login tracks as grids, and every post with the window it runs in."
      />

      <Tabs defaultValue="calendar" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="calendar" leftSection={<IconCalendarMonth size={14} />}>
            Login tracks
          </Tabs.Tab>
          <Tabs.Tab value="news" leftSection={<IconNews size={14} />}>
            News
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="calendar">
          {trackList.length === 0 ? (
            <Paper withBorder p="xl">
              <Text c="dimmed" size="sm" ta="center">
                No login tracks are published.
              </Text>
            </Paper>
          ) : (
            <Stack gap="md">
              {trackList.map((track) => (
                <TrackGrid key={track.key} track={track} />
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="news">
          {newsList.length === 0 ? (
            <Paper withBorder p="xl">
              <Text c="dimmed" size="sm" ta="center">
                No news posts are published.
              </Text>
            </Paper>
          ) : (
            <Stack gap="md">
              {newsList.map((post) => (
                <NewsRow key={post.key} post={post} />
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function TrackGrid({ track }: { track: TrackLike }): ReactNode {
  const days = [...(track.days ?? [])].sort((a, b) => a.day - b.day);
  const missing: number[] = [];
  for (let expected = 1; expected <= days.length; expected += 1) {
    if (!days.some((day) => day.day === expected)) missing.push(expected);
  }
  const empty = days.filter(
    (day) =>
      rewardLines(day.rewards).length === 0 &&
      (day.grants?.champions?.length ?? 0) === 0 &&
      (day.grants?.choices?.length ?? 0) === 0 &&
      (day.grants?.relics?.length ?? 0) === 0,
  );

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm" align="flex-start">
        <div>
          <Title order={4}>{track.name}</Title>
          <Text size="xs" c="dimmed" maw={640}>
            {track.description}
          </Text>
        </div>
        <Group gap="xs">
          {track.active === false && (
            <Badge size="sm" color="gray" variant="light">
              off
            </Badge>
          )}
          <Badge size="sm" variant="light">
            {days.length} days
          </Badge>
          {track.track && (
            <Badge size="sm" variant="light">
              {track.track}
            </Badge>
          )}
          <Text
            component={ContentItemLink}
            typePath="login-tracks"
            entityKey={track.key}
            size="xs"
            c="mist"
          >
            edit
          </Text>
        </Group>
      </Group>

      {(missing.length > 0 || empty.length > 0) && (
        <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light" mb="sm">
          <Stack gap={4}>
            {missing.length > 0 && (
              <Text size="sm">
                {/* A track pays day N on the Nth claim, so a missing number is a day that
                    pays nothing to somebody who turned up for it. */}
                Days {missing.join(', ')} are not in the list.
              </Text>
            )}
            {empty.length > 0 && (
              <Text size="sm">{empty.map((day) => day.day).join(', ')} pay nothing at all.</Text>
            )}
          </Stack>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 3, sm: 5, md: 7, lg: 10 }} spacing="xs">
        {days.map((day) => {
          const lines = rewardLines(day.rewards);
          const choices = day.grants?.choices ?? [];
          const champions = day.grants?.champions ?? [];
          return (
            <Paper key={day.day} withBorder p={6} radius="sm">
              <Group justify="space-between" gap={2} mb={2}>
                <Text size="xs" fw={700}>
                  {day.day}
                </Text>
                {choices.length > 0 && (
                  <Badge size="xs" variant="light" color="grape">
                    pick
                  </Badge>
                )}
              </Group>
              <Stack gap={0}>
                {lines.map((line) => (
                  <Text key={line} size="10px" c="dimmed" lh={1.3}>
                    {line}
                  </Text>
                ))}
                {champions.map((champion) => (
                  <Text key={champion} size="10px" c="teal" lh={1.3}>
                    {champion}
                  </Text>
                ))}
                {choices.length > 0 && (
                  <Text size="10px" c="grape" lh={1.3}>
                    {choices.length} to choose from
                  </Text>
                )}
                {lines.length === 0 && champions.length === 0 && choices.length === 0 && (
                  <Text size="10px" c="red" lh={1.3}>
                    nothing
                  </Text>
                )}
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>
    </Card>
  );
}

/**
 * A post's window, in words.
 *
 * An empty bound means *unbounded* — a post with neither runs forever once it is on — and
 * reading that literally as "no dates, so it never shows" is the mistake this sentence
 * exists to prevent. Whether it is showing *now* is a fact about the clock, so it is stated
 * rather than left to be worked out from two ISO strings.
 */
export function windowSentence(
  post: { startsAt?: string; endsAt?: string },
  now = new Date(),
): string {
  const from = post.startsAt ? new Date(post.startsAt) : null;
  const to = post.endsAt ? new Date(post.endsAt) : null;
  const bad = (value: Date | null): boolean => value !== null && Number.isNaN(value.getTime());
  if (bad(from) || bad(to)) return 'One of the dates is not a timestamp the server can read.';

  if (from && to && from.getTime() >= to.getTime()) {
    return 'The window ends before it starts — it can never show.';
  }
  if (!from && !to) return 'No window: it shows for as long as it is switched on.';

  const live = (!from || from.getTime() <= now.getTime()) && (!to || to.getTime() > now.getTime());
  const bounds = `${from ? from.toISOString().slice(0, 16).replace('T', ' ') : 'always'} → ${
    to ? to.toISOString().slice(0, 16).replace('T', ' ') : 'always'
  }`;
  if (live) return `Showing now · ${bounds}`;
  if (from && from.getTime() > now.getTime()) return `Not yet · ${bounds}`;
  return `Finished · ${bounds}`;
}

function NewsRow({ post }: { post: NewsLike }): ReactNode {
  const sentence = windowSentence(post);
  const trouble = sentence.includes('never show') || sentence.includes('cannot');
  return (
    <Card withBorder>
      <Group justify="space-between" align="flex-start" mb={4}>
        <Title order={5}>{post.title}</Title>
        <Group gap="xs">
          {post.pinned && (
            <Badge size="sm" variant="light" color="grape">
              pinned
            </Badge>
          )}
          <Badge size="sm" variant="light" color={post.active === false ? 'gray' : 'teal'}>
            {post.active === false ? 'off' : 'on'}
          </Badge>
          <Text component={ContentItemLink} typePath="news" entityKey={post.key} size="xs" c="mist">
            edit
          </Text>
        </Group>
      </Group>
      <Text size="xs" c={trouble ? 'red' : 'dimmed'} mb="xs">
        {sentence}
      </Text>
      <Paper withBorder p="sm" bg="dark.8">
        <Text size="xs" style={{ whiteSpace: 'pre-wrap' }} lineClamp={8}>
          {post.body}
        </Text>
      </Paper>
    </Card>
  );
}
