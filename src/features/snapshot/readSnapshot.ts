import type { ContentSnapshotFile } from '@/api/types';

/**
 * Reading a dropped file as a content snapshot (ADMIN_SUITE_DESIGN §2.17).
 *
 * Pure, and separate from the panel that uses it, because the interesting part is not the
 * upload — it is that an operator has **two** documents they might reasonably drop here
 * and only one of them says what it is.
 *
 * `GET /admin/api/content/export` hands back the whole game as one object with a `files`
 * array, and every file inside it names its own content type. But `pnpm content:export`
 * writes the same content as one file *per type* — `stage.json`, `champion.json` — each a
 * bare array of entities with the type only in the filename. That directory is what lives
 * in the game repo, so it is what somebody restoring from git actually has to hand, and a
 * reader that refused it would refuse the commonest case.
 *
 * So both are accepted and the filename is the type when the document cannot say. What is
 * *not* accepted is a guess: a bare array with no usable filename is refused by name
 * rather than imported under a type nobody chose.
 */

export interface ReadOk {
  ok: true;
  files: ContentSnapshotFile[];
  /** Where the type came from, so the panel can say so before anything is sent. */
  source: 'document' | 'filename';
  entities: number;
}

export interface ReadFailure {
  ok: false;
  reason: string;
}

export type ReadResult = ReadOk | ReadFailure;

/** `stage.json` → `stage`; `2026-08-30-stage.json` → `stage`. */
export function typeFromFilename(filename: string): string {
  const stem = (filename.split(/[\\/]/).pop() ?? filename).replace(/\.json$/i, '');
  // A dated or prefixed export keeps the type last, which is how every tool that writes
  // one names it. Nothing here validates the type against the registry: the server does
  // that, and it names what it did not recognise rather than dropping it.
  const tail = stem.split('-').pop() ?? stem;
  return tail.trim();
}

function isEntity(value: unknown): value is { key: string; data: Record<string, unknown> } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as { key?: unknown; data?: unknown };
  return (
    typeof entry.key === 'string' &&
    entry.key.length > 0 &&
    Boolean(entry.data) &&
    typeof entry.data === 'object' &&
    !Array.isArray(entry.data)
  );
}

function readFiles(value: unknown): ContentSnapshotFile[] | null {
  if (!Array.isArray(value)) return null;
  const files: ContentSnapshotFile[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const file = entry as { type?: unknown; entities?: unknown };
    if (typeof file.type !== 'string' || !file.type) return null;
    if (!Array.isArray(file.entities) || !file.entities.every(isEntity)) return null;
    files.push({ type: file.type, entities: file.entities });
  }
  return files;
}

export function readSnapshot(filename: string, text: string): ReadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: `${filename} is not valid JSON.` };
  }

  const count = (files: ContentSnapshotFile[]): number =>
    files.reduce((sum, file) => sum + file.entities.length, 0);

  // The whole-game document, as the API hands it back.
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'files' in parsed) {
    const files = readFiles((parsed as { files: unknown }).files);
    if (!files) return { ok: false, reason: `${filename} has a "files" list this cannot read.` };
    if (files.length === 0) return { ok: false, reason: `${filename} carries no content.` };
    return { ok: true, files, source: 'document', entities: count(files) };
  }

  // One type's file, as `pnpm content:export` writes it.
  if (Array.isArray(parsed)) {
    const type = typeFromFilename(filename);
    if (!type || type === 'manifest') {
      return {
        ok: false,
        reason:
          `${filename} is a list of entities and its name does not say which content ` +
          `type they are. Rename it after the type — stage.json, champion.json — or ` +
          `use the whole-snapshot document.`,
      };
    }
    if (parsed.length === 0) return { ok: false, reason: `${filename} carries no content.` };
    if (!parsed.every(isEntity)) {
      return {
        ok: false,
        reason: `${filename} holds something other than { key, data } entries.`,
      };
    }
    const files: ContentSnapshotFile[] = [
      { type, entities: parsed as ContentSnapshotFile['entities'] },
    ];
    return { ok: true, files, source: 'filename', entities: count(files) };
  }

  return {
    ok: false,
    reason: `${filename} is neither a snapshot document nor a list of entities.`,
  };
}

/** Merges several read files into one bundle, later files winning on a repeated type. */
export function mergeFiles(reads: ContentSnapshotFile[][]): ContentSnapshotFile[] {
  const byType = new Map<string, ContentSnapshotFile['entities']>();
  for (const files of reads) {
    for (const file of files) {
      const existing = byType.get(file.type) ?? [];
      // Keyed rather than concatenated: dropping `stage.json` twice must not offer to
      // import 758 stages, and the second copy is the one the operator meant.
      const merged = new Map(existing.map((entity) => [entity.key, entity]));
      for (const entity of file.entities) merged.set(entity.key, entity);
      byType.set(file.type, [...merged.values()]);
    }
  }
  return [...byType.entries()].map(([type, entities]) => ({ type, entities }));
}

/** The name a downloaded snapshot is saved under. */
export function snapshotFilename(rev: number): string {
  return `mistvale-content-rev${rev}.json`;
}
