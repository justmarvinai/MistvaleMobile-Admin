import { useMemo } from 'react';
import { useContentList } from '@/api/hooks';
import type { ContentListItem } from '@/api/types';

export interface ContentOption {
  value: string;
  label: string;
  /** The full draft-over-live entity, for editors that need more than a label. */
  data: Record<string, unknown> | undefined;
}

/**
 * Options for a picker over another content type.
 *
 * Pickers always list the *draft* state, so a champion can be pointed at a skill created
 * in the same editing session — both go live together at the next publish.
 */
export function useContentOptions(typePath: string): {
  options: ContentOption[];
  byKey: Map<string, ContentOption>;
  isPending: boolean;
  error: unknown;
} {
  const list = useContentList(typePath);

  const options = useMemo(() => (list.data?.items ?? []).map(toOption), [list.data]);
  const byKey = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);

  return { options, byKey, isPending: list.isPending, error: list.error };
}

function toOption(item: ContentListItem): ContentOption {
  const name = item.data?.name;
  const label = typeof name === 'string' && name.length > 0 ? `${name} · ${item.key}` : item.key;
  return { value: item.key, label, data: item.data };
}
