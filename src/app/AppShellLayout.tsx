import { useEffect, type ReactNode } from 'react';
import { AppShell, Burger, Group, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * The guarded shell: sidebar navigation, the persistent draft/publish bar, and the page.
 *
 * Also where a session that dies mid-use is caught. The route guard only runs on
 * navigation, so without this an operator whose session expired would sit on a screen of
 * failing panels; instead the first auth failure from any query bounces them to login.
 */
export function AppShellLayout(): ReactNode {
  const [opened, { toggle }] = useDisclosure();
  useAuthFailureRedirect();

  return (
    <AppShell
      header={{ height: 52 }}
      navbar={{ width: 232, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <TopBar />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <AppShell.Section grow component={ScrollArea}>
          <Sidebar onNavigate={opened ? toggle : undefined} />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

/** Watches the query cache and redirects to login the moment a session stops working. */
function useAuthFailureRedirect(): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    const isAuthFailure = (error: unknown): boolean =>
      error instanceof ApiError && error.isAuthFailure;

    const bounce = (): void => {
      // Clearing first stops the stale cache from flashing back after the redirect.
      queryClient.clear();
      void navigate({ to: '/login', search: { redirect: href } });
    };

    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && isAuthFailure(event.query.state.error)) bounce();
    });
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && isAuthFailure(event.mutation?.state.error)) bounce();
    });

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient, navigate, href]);
}
