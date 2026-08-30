import { describe, expect, it } from 'vitest';
import { mergeFiles, readSnapshot, snapshotFilename, typeFromFilename } from './readSnapshot';

const ENTITY = { key: 'testers', data: { key: 'testers', name: 'Testers' } };

describe('readSnapshot', () => {
  it('reads the whole-game document the API hands back', () => {
    const result = readSnapshot(
      'mistvale-content-rev30.json',
      JSON.stringify({ summary: { rev: 30 }, files: [{ type: 'faction', entities: [ENTITY] }] }),
    );
    expect(result).toMatchObject({ ok: true, source: 'document', entities: 1 });
    expect(result.ok && result.files[0]?.type).toBe('faction');
  });

  it('reads one type’s file, taking the type from its name', () => {
    const result = readSnapshot('faction.json', JSON.stringify([ENTITY]));
    expect(result).toMatchObject({ ok: true, source: 'filename', entities: 1 });
    expect(result.ok && result.files[0]?.type).toBe('faction');
  });

  it('refuses a bare list whose name cannot say what it is', () => {
    // The manifest is the file most likely to be dropped by mistake — it sits in the same
    // directory and is the only one that is not content.
    const result = readSnapshot('manifest.json', JSON.stringify([ENTITY]));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('does not say which content type');
  });

  it('refuses a list of things that are not entities', () => {
    const result = readSnapshot('faction.json', JSON.stringify([{ name: 'no key' }]));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('{ key, data }');
  });

  it('refuses an entity whose data is not an object', () => {
    const result = readSnapshot('faction.json', JSON.stringify([{ key: 'a', data: 'nope' }]));
    expect(result.ok).toBe(false);
  });

  it('refuses an empty file rather than importing nothing', () => {
    expect(readSnapshot('faction.json', '[]').ok).toBe(false);
    expect(readSnapshot('snap.json', JSON.stringify({ files: [] })).ok).toBe(false);
  });

  it('refuses text that is not JSON, and JSON that is not a snapshot', () => {
    expect(readSnapshot('faction.json', 'not json at all').ok).toBe(false);
    expect(readSnapshot('faction.json', '"a string"').ok).toBe(false);
    expect(readSnapshot('faction.json', '42').ok).toBe(false);
  });

  it('refuses a document whose files do not name their type', () => {
    const result = readSnapshot('snap.json', JSON.stringify({ files: [{ entities: [ENTITY] }] }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('files');
  });
});

describe('typeFromFilename', () => {
  it('takes the stem, and the last segment of a dated export', () => {
    expect(typeFromFilename('stage.json')).toBe('stage');
    expect(typeFromFilename('/tmp/content/champion.JSON')).toBe('champion');
    expect(typeFromFilename('2026-08-30-summonPool.json')).toBe('summonPool');
  });
});

describe('mergeFiles', () => {
  it('merges by type and key, so the same file dropped twice imports once', () => {
    const file = [{ type: 'faction', entities: [ENTITY] }];
    expect(mergeFiles([file, file])).toEqual([{ type: 'faction', entities: [ENTITY] }]);
  });

  it('lets a later drop replace an entity of the same key', () => {
    const merged = mergeFiles([
      [{ type: 'faction', entities: [ENTITY] }],
      [{ type: 'faction', entities: [{ key: 'testers', data: { name: 'Renamed' } }] }],
    ]);
    expect(merged[0]?.entities).toEqual([{ key: 'testers', data: { name: 'Renamed' } }]);
  });

  it('keeps separate types apart', () => {
    const merged = mergeFiles([
      [{ type: 'faction', entities: [ENTITY] }],
      [{ type: 'item', entities: [{ key: 'brew', data: {} }] }],
    ]);
    expect(merged.map((file) => file.type)).toEqual(['faction', 'item']);
  });
});

describe('snapshotFilename', () => {
  it('names the revision, because that is what a restore needs to know', () => {
    expect(snapshotFilename(30)).toBe('mistvale-content-rev30.json');
  });
});
