import type { ReactNode } from 'react';
import { Badge, Box, Group, NavLink, Stack, Text } from '@mantine/core';
import {
  IconAdjustments,
  IconCards,
  IconDatabase,
  IconGauge,
  IconRocket,
  IconRoute,
  IconSparkles,
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
