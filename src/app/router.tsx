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
import { BalanceSandboxPage } from '@/features/balance/BalanceSandboxPage';
import { AuditPage } from '@/features/audit/AuditPage';
import { BattleInspectorPage } from '@/features/battles/BattleInspectorPage';
import { CampaignPage } from '@/features/campaign/CampaignPage';
import { SummonPoolsPage } from '@/features/summon/SummonPoolsPage';
import { ShopsPage } from '@/features/shop/ShopsPage';
import { MailComposerPage } from '@/features/mail/MailComposerPage';
import { TutorialScriptPage } from '@/features/tutorial/TutorialScriptPage';
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

/**
 * The balance sandbox, beside the content browser rather than inside it.
 *
 * It is about a *stage* but it is not an edit: it reads live or draft content and answers a
 * tuning question. Putting it under `/content` would make it look like another editor and
 * invite somebody to expect a Save button.
 */
const balanceRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/balance',
  component: BalanceSandboxPage,
});

/**
 * The audit log, under Live ops rather than System (gap G1).
 *
 * It is a record of what *operators* did, which is a live-ops question — "who changed
 * this" — rather than a deployment one. The publish centre's revision history is the
 * System-side view of the same events, and the two stay separate because one is about
 * content revisions and this is about people.
 */
const auditRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/audit',
  component: AuditPage,
});

/**
 * The battle inspector, under Live ops (ADMIN_SUITE_DESIGN §2.18).
 *
 * A question about a fight that already happened rather than an edit to anything, so it
 * sits beside the balance sandbox: one asks what a stage *would* do, the other what it
 * actually did.
 */
const battleInspectorRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/battles',
  component: BattleInspectorPage,
});

/**
 * The campaign, beside the content browser rather than instead of it (A2, §2.6).
 *
 * It adds the *shape* — seven stages by three difficulties, which is how a retune is
 * actually compared — and links every cell into the generic editor for the fields. A
 * second place to change a stage is a second place for it to drift.
 */
const campaignRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/campaign',
  component: CampaignPage,
});

/**
 * The summon pools, beside the browser rather than instead of it (A3, §2.8).
 *
 * Published odds are the one number a player is entitled to hold the game to, and a form
 * of raw rates cannot say whether they are a distribution, when mercy starts, or what a
 * rarity actually costs. This says all three; the fields are still edited in the browser.
 */
const summonPoolsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/summon-pools',
  component: SummonPoolsPage,
});

/**
 * The script as a script, beside the generic browser rather than instead of it.
 *
 * `/content/tutorial` still edits a step's fields; this edits the *order*, which is the
 * one thing the browser cannot do without an operator getting two numbers right by hand.
 */
/**
 * The shops, for the same reason the pools have a screen (A3, §2.9).
 *
 * A weight is relative to the other offers and a `minAccountLevel` changes which offers
 * those are, so the odds a level-29 player gets move when a level-30 offer is added —
 * which is invisible in a form of fields and is the thing an operator most needs to see.
 */
const shopsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/shops',
  component: ShopsPage,
});

const tutorialScriptRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/tutorial',
  component: TutorialScriptPage,
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
    balanceRoute,
    auditRoute,
    battleInspectorRoute,
    campaignRoute,
    summonPoolsRoute,
    shopsRoute,
    tutorialScriptRoute,
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
