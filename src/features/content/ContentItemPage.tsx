import { useMemo, type ReactNode } from 'react';
import { useContentItem, useContentList } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { contentTypeByPath } from '@/lib/content-registry';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { NotFoundPage } from '@/features/shell/NotFoundPage';
import { ChampionEditor } from '@/features/champions/ChampionEditor';
import { SkillComposer } from '@/features/skills/SkillComposer';
import { GenericEntityEditor } from './GenericEntityEditor';
import { templateFor } from './templates';

/**
 * Resolves one entity and hands it to the right editor.
 *
 * Champions and skills have purpose-built forms; every other type gets the structured
 * JSON editor, which is still complete — the Admin API is generic over the registry, so
 * a type without a bespoke editor is fully editable, just less guided.
 */
export function ContentItemPage({
  typePath,
  entityKey,
  isCreate,
  duplicateOf,
}: {
  typePath: string;
  entityKey: string;
  isCreate: boolean;
  duplicateOf?: string;
}): ReactNode {
  const info = contentTypeByPath(typePath);

  const existing = useContentItem(typePath, entityKey, { enabled: Boolean(info) && !isCreate });
  const source = useContentItem(typePath, duplicateOf ?? '', {
    enabled: Boolean(info) && isCreate && Boolean(duplicateOf),
  });
  // The key-collision check in the create modal only sees the list it was opened with;
  // re-reading it here keeps a stale tab from silently overwriting a real entity.
  const list = useContentList(typePath);

  const initialData = useMemo<Record<string, unknown> | undefined>(() => {
    if (!info) return undefined;
    if (!isCreate) return existing.data?.data;
    if (duplicateOf) {
      const copied = source.data?.data;
      // A duplicate keeps every value but takes the new key, and its name is marked so
      // two identically-named entities never go live by accident.
      return copied ? { ...copied, key: entityKey, name: copiedName(copied) } : undefined;
    }
    return templateFor(info.type, entityKey);
  }, [info, isCreate, duplicateOf, existing.data, source.data, entityKey]);

  if (!info) {
    return (
      <NotFoundPage
        title="Unknown content type"
        description={`There is no content type at “${typePath}”.`}
      />
    );
  }

  const pending = isCreate ? (duplicateOf ? source.isPending : false) : existing.isPending;
  const error = isCreate ? (duplicateOf ? source.error : null) : existing.error;

  if (pending || list.isPending) return <LoadingState label={`Loading ${entityKey}…`} />;

  if (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      return (
        <NotFoundPage
          title={`No ${info.label.toLowerCase().replace(/s$/, '')} named “${entityKey}”`}
          description="It may have been deleted, or the key may be misspelled."
        />
      );
    }
    return (
      <ErrorState
        error={error}
        title={`Could not load ${entityKey}`}
        onRetry={() => void (isCreate ? source.refetch() : existing.refetch())}
      />
    );
  }

  const alreadyExists = isCreate && (list.data?.items ?? []).some((item) => item.key === entityKey);

  if (!initialData) {
    return (
      <ErrorState
        error={new Error('The server returned no data for this entity.')}
        title={`Could not load ${entityKey}`}
      />
    );
  }

  const common = {
    typePath,
    entityKey,
    initialData,
    isCreate,
    keyConflict: alreadyExists,
    liveData: existing.data?.live ?? null,
    hasDraft: existing.data?.hasDraft ?? false,
    pendingDelete: existing.data?.pendingDelete ?? false,
  };

  if (info.type === 'champion') return <ChampionEditor {...common} />;
  if (info.type === 'skill') return <SkillComposer {...common} />;
  return <GenericEntityEditor {...common} contentTypeLabel={info.label} />;
}

/** Editor props every content editor receives, whatever type it edits. */
export interface EntityEditorProps {
  typePath: string;
  entityKey: string;
  initialData: Record<string, unknown>;
  isCreate: boolean;
  /** True when a create would overwrite an entity that appeared since the modal opened. */
  keyConflict: boolean;
  liveData: Record<string, unknown> | null;
  hasDraft: boolean;
  pendingDelete: boolean;
}

function copiedName(data: Record<string, unknown>): unknown {
  const name = data.name;
  return typeof name === 'string' ? `${name} (copy)` : name;
}
