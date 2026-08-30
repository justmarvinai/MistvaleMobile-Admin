import { describe, expect, it } from 'vitest';
import { filterParams } from '@/api/hooks';

/**
 * The audit filter's query string.
 *
 * The page itself is a table and a form; what is worth pinning is the one rule in it that
 * is easy to get wrong and impossible to see: an empty box must be **absent** from the
 * query rather than present and empty. `?actor=` is a filter matching every row, and it
 * looks exactly like a filter matching none.
 */
describe('filterParams', () => {
  it('leaves an untouched filter out of the query entirely', () => {
    expect(filterParams({ limit: 50, offset: 0 })).toBe('limit=50&offset=0');
  });

  it('drops a box the operator emptied rather than sending it empty', () => {
    expect(filterParams({ actor: '', action: undefined, entity: 'account' })).toBe(
      'entity=account',
    );
  });

  it('carries every filter that is set, so they combine', () => {
    // The way an operator actually arrives: a name they are suspicious of *and* a thing
    // that went wrong.
    const params = new URLSearchParams(
      filterParams({ actor: 'marvin', action: 'player.ban', entityId: 'acct-1' }),
    );
    expect(params.get('actor')).toBe('marvin');
    expect(params.get('action')).toBe('player.ban');
    expect(params.get('entityId')).toBe('acct-1');
  });

  it('sends a zero offset rather than treating it as unset', () => {
    // `0` is falsy and the first page is the most common request there is.
    expect(filterParams({ offset: 0 })).toBe('offset=0');
  });
});
