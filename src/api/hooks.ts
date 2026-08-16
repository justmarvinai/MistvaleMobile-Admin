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
