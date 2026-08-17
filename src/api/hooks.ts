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
  AdminAccountState,
  ArenaBotCensus,
  ArenaLadderResult,
  MailBatchLog,
  MailSendRequest,
  MailSendResult,
  AdminGrantRequest,
  AdminGrantResult,
  AdminPlayerDetail,
  AdminPlayerSearch,
  AdminResetAccountResult,
  AdminResetPasswordResult,
  ContentDiff,
  ContentItemResponse,
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
