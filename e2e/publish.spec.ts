import { expect, test, type Page } from '@playwright/test';
import { discardDrafts, goTo, signIn } from './support';

/**
 * The one path the whole suite exists to serve (gap G8).
 *
 * Sign in, change something, see it in the diff, publish it, and put it back. Vitest covers
 * what every editor *computes* against stubbed responses; what none of it can cover is this
 * chain — the SPA, the Admin API, the content cache and the database, each of which can be
 * right on its own while the path through them is broken.
 *
 * It edits a **faction's lore**, deliberately. It is a plain string on an entity nothing
 * else references, so a half-finished run cannot leave the game unplayable — and the field
 * is long enough that the field-level diff has something to show.
 *
 * The run puts the box back where it found it, by publishing the original text again rather
 * than by reverting. A revert is recorded as a *new* revision anyway (the audit trail is
 * append-only), so the two leave the history in the same shape — and re-publishing the
 * original exercises the same path twice instead of a second one once.
 */

const KEY = 'emberclan';
const ENTITY = `/admin/content/factions/${KEY}`;

/** The JSON editor, which is the only textarea on an entity page. */
function editor(page: Page) {
  return page.getByLabel('Faction definition');
}

async function readDefinition(page: Page): Promise<string> {
  await expect(editor(page)).toBeVisible({ timeout: 30_000 });
  return editor(page).inputValue();
}

/**
 * Opens the publish dialog, validates inside it, writes the note and publishes.
 *
 * The dialog has its **own** validate gate, separate from the page's: the publish button
 * stays disabled until it has run, and the button's label changes with it (`Validate first`
 * → `Re-validate`). That is the safety rail working, so the step drives it rather than
 * reaching around it.
 */
async function publishFrom(page: Page, note: string): Promise<void> {
  await page.getByRole('main').getByRole('button', { name: 'Publish…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^(Validate first|Re-validate)$/ }).click();

  const confirm = dialog.getByRole('button', { name: /^Publish \d+ change/ });
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await dialog.getByLabel('What changed').fill(note);
  await confirm.click();

  await expect(page.getByRole('link', { name: /no drafts/i })).toBeVisible({ timeout: 60_000 });
}

test.describe.configure({ mode: 'serial' });

test('an edit reaches the live game through the publish flow', async ({ page }) => {
  await signIn(page);
  await discardDrafts(page);

  await page.goto(ENTITY);
  const original = await readDefinition(page);
  const parsed = JSON.parse(original) as { lore: string };
  const marked = `${parsed.lore} Marked by the smoke run.`;

  // ── The edit ────────────────────────────────────────────────────────────
  await editor(page).fill(JSON.stringify({ ...parsed, lore: marked }, null, 2));
  await page.getByRole('button', { name: 'Save draft' }).click();
  // The pending-draft indicator lives in the shell, so it is the honest signal that the
  // write reached the server rather than that a button was pressed.
  await expect(page.getByRole('link', { name: /1 draft/i })).toBeVisible({ timeout: 30_000 });

  // ── The diff ────────────────────────────────────────────────────────────
  await goTo(page, '/admin/publish', 'Publish center');
  // Field-level since C30: the diff names `lore` rather than reporting that the faction
  // changed, which is the difference between reviewing an edit and taking it on trust.
  await expect(page.getByText('lore', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(marked, { exact: false }).first()).toBeVisible();

  // ── Validate, then publish ──────────────────────────────────────────────
  // Scoped to `main`: Validate and Publish are on the top bar as well, one click from every
  // screen, so an unscoped locator is ambiguous the moment a draft exists.
  const actions = page.getByRole('main');
  await actions.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText(/no problems found/i)).toBeVisible({ timeout: 60_000 });

  await publishFrom(page, 'smoke run');

  // ── It is live ──────────────────────────────────────────────────────────
  // Read back through the API the game itself serves, not through the editor: the editor
  // would happily show a draft, and what is being asserted is that a player would see it.
  const bundle = await page.request.get('/api/content');
  expect(bundle.ok()).toBe(true);
  const body = (await bundle.json()) as { data: { factions: { key: string; lore: string }[] } };
  expect(body.data.factions.find((faction) => faction.key === KEY)?.lore).toBe(marked);

  // ── And the history says who did it ─────────────────────────────────────
  await page.getByRole('tab', { name: /revision history/i }).click();
  await expect(page.getByText('smoke run').first()).toBeVisible({ timeout: 30_000 });

  // ── Put it back ─────────────────────────────────────────────────────────
  await page.goto(ENTITY);
  await expect(editor(page)).toBeVisible({ timeout: 30_000 });
  await editor(page).fill(original);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('link', { name: /1 draft/i })).toBeVisible({ timeout: 30_000 });

  await goTo(page, '/admin/publish', 'Publish center');
  await publishFrom(page, 'smoke run: restore');

  const restored = await page.request.get('/api/content');
  const after = (await restored.json()) as { data: { factions: { key: string; lore: string }[] } };
  expect(after.data.factions.find((faction) => faction.key === KEY)?.lore).toBe(parsed.lore);
});
