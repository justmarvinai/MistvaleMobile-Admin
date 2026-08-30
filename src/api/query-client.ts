import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/**
 * The shared query client.
 *
 * Server is truth (CLAUDE.md), so there is no optimistic-update machinery here: every
 * mutation invalidates and re-fetches. Retries are deliberately narrow — retrying a
 * 403 or a validation failure only delays the error the operator needs to see.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            // Only transport-level failures are worth retrying; anything the API
            // answered deliberately will answer the same way again.
            return error.status === 0 && failureCount < 2;
          }
          return failureCount < 2;
        },
        staleTime: 15_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Query keys, centralised so invalidation after a mutation cannot miss a cache. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  stats: ['stats', 'overview'] as const,
  health: ['stats', 'health'] as const,
  contentOverview: ['content', 'overview'] as const,
  contentList: (path: string) => ['content', 'list', path] as const,
  contentItem: (path: string, key: string) => ['content', 'item', path, key] as const,
  diff: ['content', 'diff'] as const,
  validation: ['content', 'validation'] as const,
  revisions: ['content', 'revisions'] as const,
  playerSearch: (params: string) => ['players', 'search', params] as const,
  audit: (params: string) => ['audit', params] as const,
  player: (id: string) => ['players', 'detail', id] as const,
  arenaBots: ['arena', 'bots'] as const,
  mailBatches: ['mail', 'batches'] as const,
};

/**
 * Invalidates everything a content write can affect.
 *
 * Any draft write moves the draft count, the diff and the validation result, so these
 * always travel together — that is why this lives in one function rather than being
 * repeated in every mutation hook.
 */
export async function invalidateContent(client: QueryClient, path?: string): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.contentOverview }),
    client.invalidateQueries({ queryKey: queryKeys.diff }),
    client.invalidateQueries({ queryKey: queryKeys.validation }),
    path
      ? client.invalidateQueries({ queryKey: queryKeys.contentList(path) })
      : client.invalidateQueries({ queryKey: ['content', 'list'] }),
    client.invalidateQueries({ queryKey: ['content', 'item'] }),
  ]);
}
