import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconDownload, IconFileUpload, IconUpload } from '@tabler/icons-react';
import { useExportContent, useImportContent } from '@/api/hooks';
import type { ContentSnapshotFile } from '@/api/types';
import { contentTypeLabel } from '@/lib/content-registry';
import { notifyError, notifySuccess } from '@/lib/notify';
import { mergeFiles, readSnapshot, snapshotFilename } from './readSnapshot';

/**
 * Content export and import (ADMIN_SUITE_DESIGN §2.17).
 *
 * It lives inside the publish center rather than beside it, and that placement is the
 * design: §2.17 asks that an import "shows dry-run diff first", and an import **writes
 * drafts** — so the dry run is the Pending changes tab one click away, with the same
 * field-level diff, the same validation and the same publish button every other edit goes
 * through. A second review path here would be a second thing to trust.
 *
 * The download is the other half and matters more than the backup does: the database is
 * content's source of truth, which means the whole game's balance and copy lives somewhere
 * `git log` cannot see. This is how an operator with no shell on the box takes an evening
 * of retuning and commits it.
 */
export function SnapshotPanel(): ReactNode {
  const exportContent = useExportContent();
  const importContent = useImportContent();
  const fileInput = useRef<HTMLInputElement>(null);

  const [staged, setStaged] = useState<ContentSnapshotFile[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    drafted: { type: string; count: number }[];
    total: number;
    unchanged: number;
    unknownTypes: string[];
  } | null>(null);

  const download = (): void => {
    exportContent.mutate(undefined, {
      onSuccess: (snapshot) => {
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = snapshotFilename(snapshot.summary.rev);
        anchor.click();
        URL.revokeObjectURL(url);
        notifySuccess(
          `Exported revision ${snapshot.summary.rev}`,
          `${snapshot.summary.total} entities across ${snapshot.summary.types.length} content types.`,
        );
      },
      onError: (error) => notifyError('Could not export the content', error),
    });
  };

  const stage = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = [...(event.target.files ?? [])];
    // Cleared straight away so the same file can be picked twice running — a browser fires
    // no change event for an identical selection, which reads as a broken button.
    event.target.value = '';
    if (files.length === 0) return;

    setResult(null);
    const read: ContentSnapshotFile[][] = [];
    const refused: string[] = [];
    for (const file of files) {
      const outcome = readSnapshot(file.name, await file.text());
      if (outcome.ok) read.push(outcome.files);
      else refused.push(outcome.reason);
    }

    const merged = mergeFiles([staged, ...read]);
    setStaged(merged);
    setSkipped(refused);
    setChosen(new Set(merged.map((entry) => entry.type)));
  };

  const send = (): void => {
    const files = staged.filter((file) => chosen.has(file.type));
    if (files.length === 0) return;
    importContent.mutate(
      { files, only: files.map((file) => file.type) },
      {
        onSuccess: (outcome) => {
          setResult(outcome);
          setStaged([]);
          setChosen(new Set());
          notifySuccess(
            outcome.total === 0
              ? 'Nothing to change'
              : `${outcome.total} ${outcome.total === 1 ? 'draft' : 'drafts'} written`,
            outcome.total === 0
              ? 'Every entity in that snapshot already matches the live content.'
              : 'Review them under Pending changes, then publish.',
          );
        },
        onError: (error) => notifyError('Could not import the snapshot', error),
      },
    );
  };

  const stagedTotal = staged
    .filter((file) => chosen.has(file.type))
    .reduce((sum, file) => sum + file.entities.length, 0);

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            <Title order={4}>Export</Title>
            <Text size="sm" c="dimmed" maw={620}>
              The live content as one JSON document, at the revision it stands at now. Commit it
              into the game repo and <code>git diff</code> says what an evening of retuning changed
              — in the words the content uses, next to the code that reads it.
            </Text>
          </div>
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={download}
            loading={exportContent.isPending}
          >
            Download snapshot
          </Button>
        </Group>
      </Paper>

      <Paper withBorder p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <div>
              <Title order={4}>Import</Title>
              <Text size="sm" c="dimmed" maw={620}>
                Loads a snapshot back in <strong>as drafts</strong>. Nothing reaches a player until
                you publish, so the dry run is the Pending changes tab beside this one. A whole
                snapshot document or the game repo’s per-type files (<code>stage.json</code>,{' '}
                <code>champion.json</code>) both work.
              </Text>
            </div>
            <Button
              variant="default"
              leftSection={<IconFileUpload size={16} />}
              onClick={() => fileInput.current?.click()}
            >
              Choose files…
            </Button>
          </Group>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            multiple
            hidden
            aria-label="Snapshot files"
            onChange={(event) => {
              void stage(event);
            }}
          />

          {skipped.length > 0 && (
            <Alert
              color="yellow"
              variant="light"
              icon={<IconAlertTriangle size={16} />}
              title={`${skipped.length} ${skipped.length === 1 ? 'file' : 'files'} skipped`}
            >
              <Stack gap={4}>
                {skipped.map((reason) => (
                  <Text key={reason} size="sm">
                    {reason}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}

          {staged.length > 0 && (
            <>
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={44} />
                    <Table.Th>Content type</Table.Th>
                    <Table.Th w={120} ta="right">
                      Entities
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {staged.map((file) => (
                    <Table.Tr key={file.type}>
                      <Table.Td>
                        <Checkbox
                          checked={chosen.has(file.type)}
                          aria-label={contentTypeLabel(file.type)}
                          onChange={(event) => {
                            const next = new Set(chosen);
                            if (event.currentTarget.checked) next.add(file.type);
                            else next.delete(file.type);
                            setChosen(next);
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Text size="sm">{contentTypeLabel(file.type)}</Text>
                          <Text size="xs" c="dimmed">
                            {file.type}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">{file.entities.length}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {stagedTotal} {stagedTotal === 1 ? 'entity' : 'entities'} from {chosen.size}{' '}
                  {chosen.size === 1 ? 'type' : 'types'}. Anything already identical to live is
                  skipped, so the diff stays about what actually changed.
                </Text>
                <Group gap="sm">
                  <Button
                    variant="subtle"
                    onClick={() => {
                      setStaged([]);
                      setChosen(new Set());
                      setSkipped([]);
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    color="mist"
                    leftSection={<IconUpload size={16} />}
                    onClick={send}
                    loading={importContent.isPending}
                    disabled={stagedTotal === 0}
                  >
                    Import as drafts
                  </Button>
                </Group>
              </Group>
            </>
          )}

          {result && <ImportResult result={result} />}
        </Stack>
      </Paper>
    </Stack>
  );
}

function ImportResult({
  result,
}: {
  result: {
    drafted: { type: string; count: number }[];
    total: number;
    unchanged: number;
    unknownTypes: string[];
  };
}): ReactNode {
  return (
    <Stack gap="sm">
      {result.unknownTypes.length > 0 && (
        <Alert
          color="yellow"
          variant="light"
          icon={<IconAlertTriangle size={16} />}
          title="Content types this build does not know"
        >
          <Text size="sm">
            {result.unknownTypes.join(', ')} — nothing was imported for{' '}
            {result.unknownTypes.length === 1 ? 'it' : 'them'}. That snapshot was probably taken
            from a newer build of the game.
          </Text>
        </Alert>
      )}

      <Alert color={result.total > 0 ? 'mist' : 'gray'} variant="light">
        <Stack gap={6}>
          <Text size="sm">
            {result.total > 0
              ? `${result.total} ${result.total === 1 ? 'draft' : 'drafts'} written. Review them under Pending changes, then publish.`
              : 'No drafts written — every entity already matched the live content.'}
            {result.unchanged > 0 &&
              ` ${result.unchanged} ${result.unchanged === 1 ? 'entity was' : 'entities were'} already identical and skipped.`}
          </Text>
          {result.drafted.length > 0 && (
            <Group gap="xs">
              {result.drafted.map((entry) => (
                <Badge key={entry.type} variant="light" size="sm">
                  {contentTypeLabel(entry.type)} · {entry.count}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
      </Alert>
    </Stack>
  );
}
