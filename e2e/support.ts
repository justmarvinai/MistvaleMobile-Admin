import { expect, type Page } from '@playwright/test';

/**
 * Shared steps for the Admin smoke run.
 *
 * Everything here is expressed in what an operator *does* rather than in selectors, for the
 * reason the game repo learned twice (C12c, C18): a UI change that renames a button breaks
 * a suite `pnpm verify` cannot see, and the cheapest insurance is that every spec presses
 * things through one function.
 */

export function credentials(): { account: string; password: string } {
  const account = process.env.E2E_ADMIN_ACCOUNT;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!account || !password) {
    // Stated rather than skipped: a smoke run that silently passes because it was not
    // configured is the worst of both worlds — green, and covering nothing.
    throw new Error(
      'Set E2E_ADMIN_ACCOUNT and E2E_ADMIN_PASSWORD. The suite cannot mint its own admin: ' +
        "there is no self-serve promotion, so the first one is made with the game repo's " +
        'SET_RANK.sh.',
    );
  }
  return { account, password };
}

/** Signs in and waits for the shell, which is the first thing every spec needs. */
export async function signIn(page: Page): Promise<void> {
  const { account, password } = credentials();
  await page.goto('/admin/');
  await page.getByLabel('Account name').fill(account);
  // Exact by default rather than after it breaks: the game repo's own login screen grew
  // a **Show password** button in C18 and made `getByLabel('Password')` ambiguous in
  // twenty-four places across eighteen specs. This screen has no such button today.
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 30_000 });
  // The sign-in lands on `/admin/login?redirect=…` and the router replaces the URL a beat
  // later; reading the sidebar before that settles destroys the execution context mid-call.
  // Waiting for a *link* rather than the heading is what makes it deterministic — the
  // heading renders before the navigation does.
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForURL(/\/admin\/?$/, { timeout: 30_000 });
}

/**
 * Opens a screen by its route and waits for the page's own heading.
 *
 * By URL rather than by clicking the sidebar, and both halves of that are deliberate. A
 * sidebar label is **not unique** — `Summon pools` and `Shops` each appear twice, once as a
 * content type in the browser and once as the purpose-built screen — and a label carries its
 * own count badge, so `Publish center` renders as `Publish center1` the moment a draft
 * exists. Matching on either would be a locator that works until content changes under it.
 *
 * That the links themselves are clickable is worth asserting too, and it is: that is what
 * `navigation.spec.ts` is for. Here the point is to get to a screen, not to test the way in.
 */
export async function goTo(page: Page, path: string, heading: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Discards every pending draft, so a spec starts from a known state.
 *
 * Publish is the one action in the suite that changes the live game, and a run that
 * inherited somebody else's half-finished edit would publish it too.
 */
export async function discardDrafts(page: Page): Promise<void> {
  await goTo(page, '/admin/publish', 'Publish center');
  const discard = page.getByRole('button', { name: /discard all drafts/i });
  if (!(await discard.isVisible().catch(() => false))) return;
  await discard.click();
  // Scoped to the dialog: the page behind it has its own inputs, and a `fill` that landed on
  // one of those would leave the confirmation locked and time out on the click instead of
  // saying what went wrong.
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('discard all drafts');
  await dialog.getByRole('button', { name: 'Discard all' }).click();
  await expect(discard).toBeHidden({ timeout: 30_000 });
}
