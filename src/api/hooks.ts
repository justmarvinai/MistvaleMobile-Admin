import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { ADMIN_ROUTES, type ApiError, PLAYER_API_PREFIX, request } from './client';
import { invalidateContent, queryKeys } from './query-client';
import type {
  AccountRank,
  AuditPage,
  BattleDetail,
  BattleList,
  AdminAccountState,
  ArenaBotCensus,
  ArenaLadderResult,
  MailBatchLog,
  MailSendRequest,
  MailSendResult,
  SimulateRequest,
  SimulateResponse,
  AdminGearPage,
  AdminGrantRequest,
  AdminGrantResult,
  AdminRoster,
  AdminSummonPage,
  AdminPlayerDetail,
  AdminPlayerSearch,
  AdminResetAccountResult,
  AdminResetPasswordResult,
  ContentDiff,
  ContentImportRequest,
  ContentImportResult,
  ContentItemResponse,
  ContentSnapshot,
  JobList,
  JobRunResult,
  ContentListResponse,
  ContentOverview,
  ContentValidationResult,
  HealthReport,
  LoginRequest,
  PublishResult,
  RevertResult,
  RevisionsResponse,
  SessionEnvelope,
  StatsOverview,
} from './types';

/**
 * One hook per Admin API resource.
 *
 * Mutations always invalidate rather than patching the cache: the server owns the truth
 * and a draft write changes more than the row it touched (draft count, diff, validation).
 */

// ── Auth ─────────────────────────────────────────────────────────────────────

export function useMe(): UseQueryResult<SessionEnvelope, ApiError> {
  return useQuery<SessionEnvelope, ApiError>({
    queryKey: queryKeys.me,
    queryFn: () => request<SessionEnvelope>(ADMIN_ROUTES.auth.me),
    // An expired session should surface as a redirect, not three failed retries.
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin(): UseMutationResult<SessionEnvelope, ApiError, LoginRequest> {
  const client = useQueryClient();
  return useMutation<SessionEnvelope, ApiError, LoginRequest>({
    mutationFn: (input) =>
      request<SessionEnvelope>(ADMIN_ROUTES.auth.login, { method: 'POST', body: input }),
    onSuccess: (data) => {
      client.setQueryData(queryKeys.me, data);
    },
  });
}

export function useLogout(): UseMutationResult<{ loggedOut: boolean }, ApiError, void> {
  const client = useQueryClient();
  return useMutation<{ loggedOut: boolean }, ApiError, void>({
    mutationFn: () => request<{ loggedOut: boolean }>(ADMIN_ROUTES.auth.logout, { method: 'POST' }),
    onSuccess: () => {
      client.clear();
    },
  });
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export function useStatsOverview(): UseQueryResult<StatsOverview, ApiError> {
  return useQuery<StatsOverview, ApiError>({
    queryKey: queryKeys.stats,
    queryFn: () => request<StatsOverview>(ADMIN_ROUTES.stats.overview),
  });
}

export function useHealth(): UseQueryResult<HealthReport, ApiError> {
  return useQuery<HealthReport, ApiError>({
    queryKey: queryKeys.health,
    queryFn: () => request<HealthReport>('/health', { prefix: PLAYER_API_PREFIX }),
    // The strip is a live indicator; a minute-stale event-loop reading is useless.
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

// ── Content: overview, lists, items ──────────────────────────────────────────

export function useContentOverview(): UseQueryResult<ContentOverview, ApiError> {
  return useQuery<ContentOverview, ApiError>({
    queryKey: queryKeys.contentOverview,
    queryFn: () => request<ContentOverview>(ADMIN_ROUTES.content.overview),
  });
}

export function useContentList(path: string): UseQueryResult<ContentListResponse, ApiError> {
  return useQuery<ContentListResponse, ApiError>({
    queryKey: queryKeys.contentList(path),
    queryFn: () => request<ContentListResponse>(ADMIN_ROUTES.content.collection(path)),
  });
}

export function useContentItem(
  path: string,
  key: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<ContentItemResponse, ApiError> {
  return useQuery<ContentItemResponse, ApiError>({
    queryKey: queryKeys.contentItem(path, key),
    queryFn: () => request<ContentItemResponse>(ADMIN_ROUTES.content.item(path, key)),
    enabled: options.enabled ?? true,
  });
}

export interface SaveContentInput {
  key: string;
  data: Record<string, unknown>;
}

export function useSaveContent(
  path: string,
): UseMutationResult<{ key: string; saved: boolean }, ApiError, SaveContentInput> {
  const client = useQueryClient();
  return useMutation<{ key: string; saved: boolean }, ApiError, SaveContentInput>({
    mutationFn: ({ key, data }) =>
      request<{ key: string; saved: boolean }>(ADMIN_ROUTES.content.item(path, key), {
        method: 'PUT',
        body: { data },
      }),
    onSuccess: () => invalidateContent(client, path),
  });
}

export function useDeleteContent(
  path: string,
): UseMutationResult<{ key: string; pendingDelete: boolean }, ApiError, string> {
  const client = useQueryClient();
  return useMutation<{ key: string; pendingDelete: boolean }, ApiError, string>({
    mutationFn: (key) =>
      request<{ key: string; pendingDelete: boolean }>(ADMIN_ROUTES.content.item(path, key), {
        method: 'DELETE',
      }),
    onSuccess: () => invalidateContent(client, path),
  });
}

/** Drops one pending draft, restoring the live version in the editor. */
export function useDiscardDraft(
  path: string,
): UseMutationResult<{ key: string; discarded: boolean }, ApiError, string> {
  const client = useQueryClient();
  return useMutation<{ key: string; discarded: boolean }, ApiError, string>({
    mutationFn: (key) =>
      request<{ key: string; discarded: boolean }>(ADMIN_ROUTES.content.revertDraft(path, key), {
        method: 'POST',
      }),
    onSuccess: () => invalidateContent(client, path),
  });
}

// ── Publish center ───────────────────────────────────────────────────────────

export function useContentDiff(): UseQueryResult<ContentDiff, ApiError> {
  return useQuery<ContentDiff, ApiError>({
    queryKey: queryKeys.diff,
    queryFn: () => request<ContentDiff>(ADMIN_ROUTES.content.diff),
  });
}

/**
 * Validation is a POST, so it is a mutation rather than a query — an operator presses
 * Validate deliberately and expects that press to hit the server every time.
 */
export function useValidateContent(): UseMutationResult<ContentValidationResult, ApiError, void> {
  const client = useQueryClient();
  return useMutation<ContentValidationResult, ApiError, void>({
    mutationFn: () =>
      request<ContentValidationResult>(ADMIN_ROUTES.content.validate, { method: 'POST' }),
    onSuccess: (result) => {
      client.setQueryData(queryKeys.validation, result);
    },
  });
}

export function usePublishContent(): UseMutationResult<PublishResult, ApiError, { note: string }> {
  const client = useQueryClient();
  return useMutation<PublishResult, ApiError, { note: string }>({
    mutationFn: ({ note }) =>
      request<PublishResult>(ADMIN_ROUTES.content.publish, { method: 'POST', body: { note } }),
    onSuccess: async () => {
      // A publish moves live content, the revision list and every draft-derived view.
      await invalidateContent(client);
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.revisions }),
        client.invalidateQueries({ queryKey: queryKeys.stats }),
      ]);
      client.removeQueries({ queryKey: queryKeys.validation });
    },
  });
}

export function useRevertContent(): UseMutationResult<RevertResult, ApiError, { rev: number }> {
  const client = useQueryClient();
  return useMutation<RevertResult, ApiError, { rev: number }>({
    mutationFn: ({ rev }) =>
      request<RevertResult>(ADMIN_ROUTES.content.revert, { method: 'POST', body: { rev } }),
    onSuccess: async () => {
      await invalidateContent(client);
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.revisions }),
        client.invalidateQueries({ queryKey: queryKeys.stats }),
      ]);
    },
  });
}

export function useDiscardAllDrafts(): UseMutationResult<{ discarded: number }, ApiError, void> {
  const client = useQueryClient();
  return useMutation<{ discarded: number }, ApiError, void>({
    mutationFn: () =>
      request<{ discarded: number }>(ADMIN_ROUTES.content.discard, { method: 'POST' }),
    onSuccess: () => invalidateContent(client),
  });
}

export function useRevisions(): UseQueryResult<RevisionsResponse, ApiError> {
  return useQuery<RevisionsResponse, ApiError>({
    queryKey: queryKeys.revisions,
    queryFn: () => request<RevisionsResponse>(ADMIN_ROUTES.content.revisions),
  });
}

// ── Player management ────────────────────────────────────────────────────────

/**
 * The support desk's data layer.
 *
 * Every mutation invalidates the account it touched rather than patching the cache: a
 * ban revokes sessions, a grant moves the wallet *and* writes a ledger line, and a reset
 * changes three fields at once. Re-reading is both simpler and the only way to stay
 * honest about what the server actually did (CLAUDE.md — server is truth).
 */
export interface PlayerSearchInput {
  q: string;
  limit?: number;
  offset?: number;
  bots?: boolean;
}

export function usePlayerSearch(
  input: PlayerSearchInput,
): UseQueryResult<AdminPlayerSearch, ApiError> {
  const params = new URLSearchParams({
    q: input.q,
    limit: String(input.limit ?? 25),
    offset: String(input.offset ?? 0),
    bots: String(input.bots ?? false),
  });
  return useQuery<AdminPlayerSearch, ApiError>({
    queryKey: queryKeys.playerSearch(params.toString()),
    queryFn: () => request<AdminPlayerSearch>(`${ADMIN_ROUTES.players.search}?${params}`),
    placeholderData: (previous) => previous,
  });
}

export function usePlayer(id: string): UseQueryResult<AdminPlayerDetail, ApiError> {
  return useQuery<AdminPlayerDetail, ApiError>({
    queryKey: queryKeys.player(id),
    queryFn: () => request<AdminPlayerDetail>(ADMIN_ROUTES.players.detail(id)),
  });
}

/** Shared success handler: re-read the account, and the search behind it. */
function invalidatePlayer(client: ReturnType<typeof useQueryClient>, id: string) {
  return async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.player(id) }),
      client.invalidateQueries({ queryKey: ['players', 'search'] }),
      client.invalidateQueries({ queryKey: queryKeys.stats }),
    ]);
  };
}

export function useResetPassword(
  id: string,
): UseMutationResult<AdminResetPasswordResult, ApiError, void> {
  const client = useQueryClient();
  return useMutation<AdminResetPasswordResult, ApiError, void>({
    mutationFn: () =>
      request<AdminResetPasswordResult>(ADMIN_ROUTES.players.resetPassword(id), {
        method: 'POST',
      }),
    onSuccess: invalidatePlayer(client, id),
  });
}

export function useSetRank(
  id: string,
): UseMutationResult<AdminAccountState, ApiError, AccountRank> {
  const client = useQueryClient();
  return useMutation<AdminAccountState, ApiError, AccountRank>({
    mutationFn: (rank) =>
      request<AdminAccountState>(ADMIN_ROUTES.players.rank(id), { method: 'POST', body: { rank } }),
    onSuccess: invalidatePlayer(client, id),
  });
}

export function useSetBanned(
  id: string,
): UseMutationResult<AdminAccountState, ApiError, { banned: boolean; reason?: string }> {
  const client = useQueryClient();
  return useMutation<AdminAccountState, ApiError, { banned: boolean; reason?: string }>({
    mutationFn: (body) =>
      request<AdminAccountState>(ADMIN_ROUTES.players.ban(id), { method: 'POST', body }),
    onSuccess: invalidatePlayer(client, id),
  });
}

export function useRenamePlayer(
  id: string,
): UseMutationResult<AdminAccountState, ApiError, string> {
  const client = useQueryClient();
  return useMutation<AdminAccountState, ApiError, string>({
    mutationFn: (profileName) =>
      request<AdminAccountState>(ADMIN_ROUTES.players.profileName(id), {
        method: 'POST',
        body: { profileName },
      }),
    onSuccess: invalidatePlayer(client, id),
  });
}

export function useGrant(
  id: string,
): UseMutationResult<AdminGrantResult, ApiError, AdminGrantRequest> {
  const client = useQueryClient();
  return useMutation<AdminGrantResult, ApiError, AdminGrantRequest>({
    mutationFn: (body) =>
      request<AdminGrantResult>(ADMIN_ROUTES.players.grant(id), { method: 'POST', body }),
    onSuccess: invalidatePlayer(client, id),
  });
}

/**
 * Returns an account to a fresh start.
 *
 * Invalidates the whole player cache rather than the one account: a reset moves the
 * wallet, the holdings, the progress *and* the sessions at once, and the search behind it
 * shows a level that has just changed.
 */
export function useResetAccount(
  id: string,
): UseMutationResult<AdminResetAccountResult, ApiError, void> {
  const client = useQueryClient();
  return useMutation<AdminResetAccountResult, ApiError, void>({
    mutationFn: () =>
      request<AdminResetAccountResult>(ADMIN_ROUTES.players.reset(id), { method: 'POST' }),
    onSuccess: invalidatePlayer(client, id),
  });
}

export function useRevokeSessions(
  id: string,
): UseMutationResult<{ revoked: number }, ApiError, void> {
  const client = useQueryClient();
  return useMutation<{ revoked: number }, ApiError, void>({
    mutationFn: () =>
      request<{ revoked: number }>(ADMIN_ROUTES.players.sessions(id), { method: 'DELETE' }),
    onSuccess: invalidatePlayer(client, id),
  });
}

// ── The Arena's bot ladder ───────────────────────────────────────────────────

/**
 * The ladder, from the operator's side.
 *
 * Three calls and no fourth. What each band *is* — how many bots, at what rating,
 * holding what — is `arena.botBands` in the game-config editor, because it is content
 * and content is data. These only report and apply.
 */
export function useArenaBotCensus(): UseQueryResult<ArenaBotCensus, ApiError> {
  return useQuery<ArenaBotCensus, ApiError>({
    queryKey: queryKeys.arenaBots,
    queryFn: () => request<ArenaBotCensus>(ADMIN_ROUTES.bots.census),
  });
}

/** Both ladder actions answer identically and invalidate the same things. */
function useLadderAction(path: string): UseMutationResult<ArenaLadderResult, ApiError, void> {
  const client = useQueryClient();
  return useMutation<ArenaLadderResult, ApiError, void>({
    mutationFn: () => request<ArenaLadderResult>(path, { method: 'POST' }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.arenaBots }),
        // Creating or removing bots moves the account totals on the dashboard.
        client.invalidateQueries({ queryKey: queryKeys.stats }),
        client.invalidateQueries({ queryKey: ['players', 'search'] }),
      ]);
    },
  });
}

export function useSeedArenaBots(): UseMutationResult<ArenaLadderResult, ApiError, void> {
  return useLadderAction(ADMIN_ROUTES.bots.seed);
}

export function useRefreshArenaBots(): UseMutationResult<ArenaLadderResult, ApiError, void> {
  return useLadderAction(ADMIN_ROUTES.bots.refresh);
}

/**
 * The mail composer.
 *
 * The log is invalidated on a send rather than refetched on a timer: a batch's claim stats
 * only move when a player opens something, and an operator watching them move is watching
 * a number that will be different in an hour whatever this page does.
 */
export function useMailBatches(): UseQueryResult<MailBatchLog, ApiError> {
  return useQuery<MailBatchLog, ApiError>({
    queryKey: queryKeys.mailBatches,
    queryFn: () => request<MailBatchLog>(ADMIN_ROUTES.mail.log),
  });
}

export function useSendMail(): UseMutationResult<MailSendResult, ApiError, MailSendRequest> {
  const client = useQueryClient();
  return useMutation<MailSendResult, ApiError, MailSendRequest>({
    mutationFn: (body) => request<MailSendResult>(ADMIN_ROUTES.mail.send, { method: 'POST', body }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.mailBatches });
    },
  });
}

/**
 * A filter object as a query string, shared by every filtered list in the suite.
 *
 * The one rule in it is easy to get wrong and impossible to see once it is: an empty box
 * must be **absent** from the query rather than present and empty. `?actor=` is a filter
 * matching every row and it looks exactly like a filter matching none. The check is
 * explicit rather than a truthiness test, because `offset=0` is the most common request
 * there is and `0` is falsy.
 */

/**
 * The audit log (gap G1).
 *
 * A plain query keyed on the whole filter string, so going back to a filter an operator
 * had a moment ago is instant and going forward is one request. `placeholderData` keeps
 * the previous page on screen while the next one loads, which is what stops a table from
 * blinking to empty every time somebody types another letter into the actor box.
 */
export interface AuditFilter {
  actor?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export function filterParams(filter: object): string {
  const params = new URLSearchParams();
  // Empty is *absent*, not an empty match: `?actor=` would otherwise be a filter that
  // matches everything and looks like a filter that matches nothing.
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === '' || value === null) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export function useAudit(filter: AuditFilter): UseQueryResult<AuditPage, ApiError> {
  const params = filterParams(filter);
  return useQuery<AuditPage, ApiError>({
    queryKey: queryKeys.audit(params),
    queryFn: () => request<AuditPage>(`${ADMIN_ROUTES.audit.list}${params ? `?${params}` : ''}`),
    placeholderData: (previous) => previous,
  });
}

/**
 * The battle inspector (ADMIN_SUITE_DESIGN §2.18).
 *
 * A finished battle never changes, so the detail query is given a long stale time: an
 * operator stepping through a log should not have it re-fetched under them because the
 * window regained focus.
 */
export interface BattleFilter {
  playerId?: string;
  mode?: string;
  limit?: number;
  offset?: number;
}

export function useBattles(filter: BattleFilter): UseQueryResult<BattleList, ApiError> {
  const params = filterParams(filter);
  return useQuery<BattleList, ApiError>({
    queryKey: queryKeys.battles(params),
    queryFn: () => request<BattleList>(`${ADMIN_ROUTES.battles.list}${params ? `?${params}` : ''}`),
    placeholderData: (previous) => previous,
  });
}

export function useBattle(id: string | null): UseQueryResult<BattleDetail, ApiError> {
  return useQuery<BattleDetail, ApiError>({
    queryKey: queryKeys.battle(id ?? ''),
    queryFn: () => request<BattleDetail>(ADMIN_ROUTES.battles.detail(id as string)),
    enabled: Boolean(id),
    staleTime: Infinity,
  });
}

/**
 * The balance sandbox.
 *
 * A **mutation** rather than a query, and that is the honest shape: it is a POST an
 * operator triggers, its cost is a tenth of a second of the game server's CPU, and it must
 * not be re-run because a component remounted or a window regained focus. It caches
 * nothing and invalidates nothing, because it changes nothing.
 */
export function useSimulateStage(): UseMutationResult<SimulateResponse, ApiError, SimulateRequest> {
  return useMutation<SimulateResponse, ApiError, SimulateRequest>({
    mutationFn: (body) =>
      request<SimulateResponse>(ADMIN_ROUTES.simulate.stage, { method: 'POST', body }),
  });
}

/**
 * Content snapshots (ADMIN_SUITE_DESIGN §2.16).
 *
 * The export is a **mutation** even though it is a GET, and deliberately: an operator
 * presses Download and gets the content as it stands at that moment. A query would cache
 * a megabyte of the whole game for every operator who visited the page and hand back a
 * fifteen-minute-old copy on the press after that — which for a document whose only job
 * is to be a record of a particular revision is the one thing it must not do.
 */
export function useExportContent(): UseMutationResult<ContentSnapshot, ApiError, void> {
  return useMutation<ContentSnapshot, ApiError, void>({
    mutationFn: () => request<ContentSnapshot>(ADMIN_ROUTES.snapshot.export),
  });
}

/**
 * Loading a snapshot back in.
 *
 * Invalidates the content caches on success because the import has written drafts: the
 * draft counts, the publish diff and the validation result have all moved, and an
 * operator's next stop is the publish center reading exactly those.
 */
export function useImportContent(): UseMutationResult<
  ContentImportResult,
  ApiError,
  ContentImportRequest
> {
  const client = useQueryClient();
  return useMutation<ContentImportResult, ApiError, ContentImportRequest>({
    mutationFn: (body) =>
      request<ContentImportResult>(ADMIN_ROUTES.snapshot.import, { method: 'POST', body }),
    onSuccess: () => invalidateContent(client),
  });
}

/**
 * Scheduled work, run on demand (ADMIN_SUITE_DESIGN §2.19).
 *
 * The list is a query and running one is a mutation, which is the honest split: the names
 * are a closed list that only changes with a deploy, and a run is a side effect an operator
 * chose. It invalidates the dashboard rather than the job list, because what a run changes
 * is the *game* — a prune moves the counters, a ladder rebuild moves the bots — and the
 * list of names is exactly what it does not touch.
 */
export function useJobs(): UseQueryResult<JobList, ApiError> {
  return useQuery<JobList, ApiError>({
    queryKey: queryKeys.jobs,
    queryFn: () => request<JobList>(ADMIN_ROUTES.jobs.list),
    staleTime: Infinity,
  });
}

export function useRunJob(): UseMutationResult<JobRunResult, ApiError, { name: string }> {
  const client = useQueryClient();
  return useMutation<JobRunResult, ApiError, { name: string }>({
    mutationFn: ({ name }) =>
      request<JobRunResult>(ADMIN_ROUTES.jobs.run(name), { method: 'POST' }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.stats }),
        client.invalidateQueries({ queryKey: queryKeys.health }),
        client.invalidateQueries({ queryKey: queryKeys.arenaBots }),
      ]);
    },
  });
}

/**
 * The holdings drill-ins (ADMIN_SUITE_DESIGN §2.14).
 *
 * All three are queries and none of them has a mutation beside it, deliberately: every
 * change to what an account holds already exists as a *grant*, which lands in
 * `economy_log`. An editor that reached in and changed a relic's substats would be the one
 * mutation in the suite with no ledger behind it.
 *
 * `enabled` on each, because the drill-ins live behind tabs and a player page should not
 * fetch a thousand relics to show the account summary.
 */
export function usePlayerRoster(
  id: string,
  enabled: boolean,
): UseQueryResult<AdminRoster, ApiError> {
  return useQuery<AdminRoster, ApiError>({
    queryKey: queryKeys.playerRoster(id),
    queryFn: () => request<AdminRoster>(ADMIN_ROUTES.players.champions(id)),
    enabled: enabled && id !== '',
  });
}

export function usePlayerGear(
  id: string,
  filter: { limit?: number; offset?: number; equipped?: string },
  enabled: boolean,
): UseQueryResult<AdminGearPage, ApiError> {
  const params = filterParams(filter);
  return useQuery<AdminGearPage, ApiError>({
    queryKey: queryKeys.playerGear(id, params),
    queryFn: () =>
      request<AdminGearPage>(`${ADMIN_ROUTES.players.gear(id)}${params ? `?${params}` : ''}`),
    enabled: enabled && id !== '',
    placeholderData: (previous) => previous,
  });
}

export function usePlayerSummons(
  id: string,
  filter: { limit?: number; offset?: number },
  enabled: boolean,
): UseQueryResult<AdminSummonPage, ApiError> {
  const params = filterParams(filter);
  return useQuery<AdminSummonPage, ApiError>({
    queryKey: queryKeys.playerSummons(id, params),
    queryFn: () =>
      request<AdminSummonPage>(`${ADMIN_ROUTES.players.summons(id)}${params ? `?${params}` : ''}`),
    enabled: enabled && id !== '',
    placeholderData: (previous) => previous,
  });
}
