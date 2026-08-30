import type { ReactNode } from 'react';
import { Badge, Box, Group, NavLink, Stack, Text } from '@mantine/core';
import {
  IconAdjustments,
  IconBinaryTree,
  IconBuildingStore,
  IconCalendarMonth,
  IconCards,
  IconDatabase,
  IconFlask,
  IconGauge,
  IconHeartbeat,
  IconHistory,
  IconListCheck,
  IconMap,
  IconRocket,
  IconRoute,
  IconSparkles,
  IconStairsDown,
  IconMail,
  IconSwords,
  IconUsers,
} from '@tabler/icons-react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useContentOverview } from '@/api/hooks';
import { CONTENT_TYPE_LIST } from '@/lib/content-registry';
import { ContentTypeLink } from '@/components/nav';
import type { ContentType } from '@/api/types';

/**
 * Sidebar navigation (ADMIN_SUITE_DESIGN §1).
 *
 * The Content group is generated from the content registry rather than listed by hand,
 * so a new content family on the server appears here as soon as its registry mirror
 * entry lands — "add more stuff" stays the cheap operation.
 */

const TYPE_ICONS: Partial<Record<ContentType, typeof IconCards>> = {
  champion: IconCards,
  skill: IconSparkles,
  enemy: IconSwords,
  gameConfig: IconAdjustments,
};

export function Sidebar({ onNavigate }: { onNavigate?: () => void }): ReactNode {
  const overview = useContentOverview();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const draftsByType = new Map(
    (overview.data?.types ?? []).map((entry) => [entry.contentType, entry.drafts]),
  );

  return (
    <Stack gap="xs">
      <NavLink
        component={Link}
        to="/"
        onClick={onNavigate}
        active={pathname === '/'}
        label="Dashboard"
        leftSection={<IconGauge size={16} />}
      />

      <SectionLabel icon={<IconDatabase size={12} />}>Content</SectionLabel>
      <Box>
        {CONTENT_TYPE_LIST.map((info) => {
          const drafts = draftsByType.get(info.type) ?? 0;
          const Icon = TYPE_ICONS[info.type];
          return (
            <NavLink
              key={info.type}
              component={ContentTypeLink}
              typePath={info.path}
              onClick={onNavigate}
              active={pathname.startsWith(`/content/${info.path}`)}
              label={info.label}
              leftSection={Icon ? <Icon size={16} /> : undefined}
              rightSection={
                drafts > 0 ? (
                  <Badge size="xs" color="yellow" variant="light" circle>
                    {drafts}
                  </Badge>
                ) : undefined
              }
            />
          );
        })}
      </Box>

      {/* Beside the generated Content list rather than in it: the registry entry points
          at the generic browser, and this is the same type seen as a script. */}
      <NavLink
        component={Link}
        to="/tutorial"
        onClick={onNavigate}
        active={pathname.startsWith('/tutorial')}
        label="Tutorial script"
        leftSection={<IconRoute size={16} />}
      />

      <SectionLabel icon={<IconUsers size={12} />}>Live ops</SectionLabel>
      <Box>
        <NavLink
          component={Link}
          to="/players"
          onClick={onNavigate}
          active={pathname.startsWith('/players')}
          label="Players"
          leftSection={<IconUsers size={16} />}
        />
        <NavLink
          component={Link}
          to="/arena/bots"
          onClick={onNavigate}
          active={pathname.startsWith('/arena')}
          label="Arena bots"
          leftSection={<IconSwords size={16} />}
        />
        <NavLink
          component={Link}
          to="/mail"
          onClick={onNavigate}
          active={pathname.startsWith('/mail')}
          label="Mail"
          leftSection={<IconMail size={16} />}
        />
        {/* The campaign as a grid: a reviewing view over generated content, which is
            what the seed makes it. Every cell links into the generic editor. */}
        <NavLink
          component={Link}
          to="/campaign"
          onClick={onNavigate}
          active={pathname.startsWith('/campaign')}
          label="Campaign"
          leftSection={<IconMap size={16} />}
        />
        {/* Published odds are player-trust critical, so what they *mean* gets a screen of
            its own; the fields stay in the generic browser. */}
        <NavLink
          component={Link}
          to="/summon-pools"
          onClick={onNavigate}
          active={pathname.startsWith('/summon-pools')}
          label="Summon pools"
          leftSection={<IconSparkles size={16} />}
        />
        {/* The same argument as the pools next door: a weight is relative and a level gate
            changes what it is relative to, and no field-by-field view can say either. */}
        <NavLink
          component={Link}
          to="/shops"
          onClick={onNavigate}
          active={pathname.startsWith('/shops')}
          label="Shops"
          leftSection={<IconBuildingStore size={16} />}
        />
        {/* A keep's floors are ordinary stages, so the browser can show them and cannot
            show the descent they add up to. */}
        <NavLink
          component={Link}
          to="/depths"
          onClick={onNavigate}
          active={pathname.startsWith('/depths')}
          label="The Depths"
          leftSection={<IconStairsDown size={16} />}
        />
        {/* Forty-eight nodes whose effects are a nested union: the browser shows the shape,
            this says the meaning — and whether the board can be spent to the last pick. */}
        <NavLink
          component={Link}
          to="/masteries"
          onClick={onNavigate}
          active={pathname.startsWith('/masteries')}
          label="Mastery board"
          leftSection={<IconBinaryTree size={16} />}
        />
        {/* Quests, the Path and events are one goal DSL wearing three names, so they are
            one screen: what is a player asked to do, and what does it pay. */}
        <NavLink
          component={Link}
          to="/errands"
          onClick={onNavigate}
          active={pathname.startsWith('/errands')}
          label="Errands"
          leftSection={<IconListCheck size={16} />}
        />
        {/* Thirty days in an array is a JSON blob three screens tall; in the game it is a
            grid, and so is it here. */}
        <NavLink
          component={Link}
          to="/schedule"
          onClick={onNavigate}
          active={pathname.startsWith('/schedule')}
          label="Calendar & news"
          leftSection={<IconCalendarMonth size={16} />}
        />
        {/* Live ops rather than Content: it is about a stage, but it is a question rather
            than an edit, and nothing on it saves anything. */}
        <NavLink
          component={Link}
          to="/balance"
          onClick={onNavigate}
          active={pathname.startsWith('/balance')}
          label="Balance sandbox"
          leftSection={<IconFlask size={16} />}
        />
        {/* Both endpoints have existed since P8i with nothing in front of them: the only
            way to run a job early was to ssh to the box. */}
        <NavLink
          component={Link}
          to="/jobs"
          onClick={onNavigate}
          active={pathname.startsWith('/jobs')}
          label="Jobs & health"
          leftSection={<IconHeartbeat size={16} />}
        />
        {/* Live ops rather than System: the revision history in the publish centre is
            about content revisions, and this is about people. */}
        <NavLink
          component={Link}
          to="/audit"
          onClick={onNavigate}
          active={pathname.startsWith('/audit')}
          label="Audit log"
          leftSection={<IconHistory size={16} />}
        />
        {/* Beside the sandbox: one asks what a stage would do, the other what it did. */}
        <NavLink
          component={Link}
          to="/battles"
          onClick={onNavigate}
          active={pathname.startsWith('/battles')}
          label="Battle inspector"
          leftSection={<IconSwords size={16} />}
        />
      </Box>

      <SectionLabel icon={<IconRocket size={12} />}>System</SectionLabel>
      <Box>
        <NavLink
          component={Link}
          to="/publish"
          onClick={onNavigate}
          active={pathname.startsWith('/publish')}
          label="Publish center"
          leftSection={<IconRocket size={16} />}
          rightSection={
            overview.data && overview.data.draftCount > 0 ? (
              <Badge size="xs" color="yellow" variant="light" circle>
                {overview.data.draftCount}
              </Badge>
            ) : undefined
          }
        />
      </Box>
    </Stack>
  );
}

function SectionLabel({ children, icon }: { children: ReactNode; icon: ReactNode }): ReactNode {
  return (
    <Group gap={6} px="xs" pt="sm" wrap="nowrap">
      <Box c="dimmed">{icon}</Box>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={0.6}>
        {children}
      </Text>
    </Group>
  );
}
