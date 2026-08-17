import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { ADMIN_ROUTES, ApiError, request } from '@/api/client';
import { createQueryClient, queryKeys } from '@/api/query-client';
import type { SessionEnvelope } from '@/api/types';
import { AppShellLayout } from './AppShellLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ContentTypePage } from '@/features/content/ContentTypePage';
import { ContentItemPage } from '@/features/content/ContentItemPage';
import { PublishCenterPage } from '@/features/publish/PublishCenterPage';
import { PlayerSearchPage } from '@/features/players/PlayerSearchPage';
import { PlayerDetailPage } from '@/features/players/PlayerDetailPage';
import { BotLadderPage } from '@/features/arena/BotLadderPage';
import { MailComposerPage } from '@/features/mail/MailComposerPage';
import { NotFoundPage } from '@/features/shell/NotFoundPage';

/**
 * The route tree and the router instance.
 *
 * Code-based rather than file-based routing: the tree is small and mostly parameterised
 * by content type, so one explicit file is easier to follow than a generated one.
 *
 * Route components read params/search here and pass them down as props, which keeps the
 * screens plain components — testable without a router, and free of route-id strings
 * that would silently rot if the tree moved.
 *
 * Auth is enforced in a pathless layout route's `beforeLoad`. Because it runs before any
 * child loads, no guarded screen ever renders for an unauthenticated operator — the
 * server re-checks rank on every request regardless (ADMIN_ARCHITECTURE §5).
 */

export interface RouterContext {
  queryClient: ReturnType<typeof createQueryClient>;
}

/**
 * Module-scope, not per-render: `Register` below has to name a concrete router type for
 * `<Link to="…">` to be typed anywhere in the app, and that cannot come from a factory's
 * inferred return type.
 */
export const queryClient = createQueryClient();

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: () => <NotFoundPage />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: function LoginRoute() {
    const { redirect: redirectTo } = loginRoute.useSearch();
    return <LoginPage redirectTo={redirectTo} />;
  },
});

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  beforeLoad: async ({ context, location }) => {
    try {
      // `ensureQueryData` both guards and warms the cache, so the shell's account
      // display does not trigger a second round-trip.
      await context.queryClient.ensureQueryData({
        queryKey: queryKeys.me,
        queryFn: () => request<SessionEnvelope>(ADMIN_ROUTES.auth.me),
        retry: false,
      });
    } catch (error) {
      if (error instanceof ApiError && (error.isAuthFailure || error.code === 'FORBIDDEN')) {
        throw redirect({ to: '/login', search: { redirect: location.href } });
      }
      // A server that is down is not an auth problem; surface the error rather than
      // bouncing the operator to a login form that will also fail.
      throw error;
    }
  },
  component: AppShellLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/',
  component: DashboardPage,
});

/** `/content/champions`, `/content/config`, … — one route for all twelve types. */
const contentTypeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/content/$typePath',
  component: function ContentTypeRoute() {
    const { typePath } = contentTypeRoute.useParams();
    return <ContentTypePage typePath={typePath} />;
  },
});

const contentItemRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/content/$typePath/$key',
  validateSearch: (search: Record<string, unknown>): { create?: boolean; from?: string } => ({
    create: search.create === true || search.create === 'true' ? true : undefined,
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: function ContentItemRoute() {
    const { typePath, key } = contentItemRoute.useParams();
    const { create, from } = contentItemRoute.useSearch();
    return (
      <ContentItemPage
        // Remounting on key change resets every form to the new entity's values;
        // without it a stale draft could bleed from one entity's editor into another's.
        key={`${typePath}/${key}`}
        typePath={typePath}
        entityKey={key}
        isCreate={create ?? false}
        duplicateOf={from}
      />
    );
  },
});

const playersRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/players',
  component: PlayerSearchPage,
});

const playerDetailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/players/$playerId',
  component: function PlayerDetailRoute() {
    const { playerId } = playerDetailRoute.useParams();
    // Remounting on id change resets the action forms; a ban reason typed for one
    // account must never survive into another's dialog.
    return <PlayerDetailPage key={playerId} playerId={playerId} />;
  },
});

const arenaBotsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/arena/bots',
  component: BotLadderPage,
});

const mailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/mail',
  component: MailComposerPage,
});

const publishRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/publish',
  component: PublishCenterPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authedRoute.addChildren([
    dashboardRoute,
    contentTypeRoute,
    contentItemRoute,
    playersRoute,
    playerDetailRoute,
    arenaBotsRoute,
    mailRoute,
    publishRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  // The suite is served from `play.pathlands.cc/admin` (Vite `base`), so every route
  // sits under that prefix in dev and production alike.
  basepath: '/admin',
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
