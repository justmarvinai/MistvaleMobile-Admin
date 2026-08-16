import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Code, JsonInput, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useSaveContent } from '@/api/hooks';
import { notifyError, notifySuccess } from '@/lib/notify';
import { deepEqual } from '@/lib/format';
import { EditorShell } from './EditorShell';
import type { EntityEditorProps } from './ContentItemPage';

/**
 * Structured editor for content types without a bespoke form.
 *
 * Deliberately a JSON editor rather than a generated form: the server owns the schema
 * and validates every write field by field, so a JSON document plus the server's own
 * error messages is honest and complete. A generated form would have to guess at the
 * schema and would quietly drift from it — worse than no form at all.
 *
 * Every type reachable here is still fully editable; the bespoke editors exist because
 * champions and skills are edited constantly, not because the others are second-class.
 */
export function GenericEntityEditor({
  typePath,
  entityKey,
  initialData,
  isCreate,
  keyConflict,
  hasDraft,
  pendingDelete,
  contentTypeLabel,
}: EntityEditorProps & { contentTypeLabel: string }): ReactNode {
  const save = useSaveContent(typePath);
  const navigate = useNavigate();

  const initialText = useMemo(() => JSON.stringify(initialData, null, 2), [initialData]);
  const [text, setText] = useState(initialText);

  const parsed = useMemo(() => parseJson(text), [text]);
  const dirty = !parsed.ok || !deepEqual(parsed.value, initialData);

  const submit = (): void => {
    if (!parsed.ok) return;
    save.mutate(
      { key: entityKey, data: parsed.value },
      {
        onSuccess: () => {
          notifySuccess('Draft saved', `${entityKey} will go live at the next publish.`);
          if (isCreate) {
            // Drop the create flags so a refresh re-reads the entity from the server
            // instead of re-seeding the template over the operator's saved work.
            void navigate({
              to: '/content/$typePath/$key',
              params: { typePath, key: entityKey },
              search: {},
              replace: true,
            });
          }
        },
        onError: (error) => notifyError('Could not save', error),
      },
    );
  };

  const name = typeof initialData.name === 'string' ? initialData.name : entityKey;

  return (
    <EditorShell
      typePath={typePath}
      entityKey={entityKey}
      title={name}
      description={`${singular(contentTypeLabel)} — edited as JSON, validated field by field by the server.`}
      dirty={dirty}
      saving={save.isPending}
      saveError={save.error}
      onSave={submit}
      onReset={() => setText(initialText)}
      isCreate={isCreate}
      keyConflict={keyConflict}
      hasDraft={hasDraft}
      pendingDelete={pendingDelete}
    >
      <Stack gap="sm">
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
          <Text size="xs">
            The <Code>key</Code> field is set from the URL on save, so renaming it here has no
            effect — keys are permanent. Everything else is validated against the server&apos;s
            schema when you save; field-level problems come back with the exact path.
          </Text>
        </Alert>

        <JsonInput
          label={`${singular(contentTypeLabel)} definition`}
          description="Formatted JSON. The server rejects anything its schema does not accept."
          value={text}
          onChange={setText}
          validationError={parsed.ok ? undefined : parsed.error}
          formatOnBlur
          autosize
          minRows={20}
          maxRows={48}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
        />
      </Stack>
    </EditorShell>
  );
}

type ParseResult = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

function parseJson(text: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: 'A content entity must be a JSON object.' };
  }
  return { ok: true, value: { ...value } };
}

function singular(label: string): string {
  if (label.endsWith('ies')) return `${label.slice(0, -3)}y`;
  if (label.endsWith('s')) return label.slice(0, -1);
  return label;
}
