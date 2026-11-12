const FIRST_RUN = '[data-firstrun]';
const ROUTED_HEADING = '#app .view > h1';

// Boot is asynchronous: wait for Welcome or the routed view before looking at either.
export async function skipFirstRun(page) {
  await page.locator(`${FIRST_RUN}, ${ROUTED_HEADING}`).first().waitFor({ state: 'visible' });
  const firstRun = page.locator(FIRST_RUN);
  while (await firstRun.isVisible()) {
    // Wait for the clicked section itself to go away: a later step may replace it at once,
    // and the re-resolving locator would then match that new, visible section.
    const clicked = await firstRun.first().elementHandle();
    await firstRun.first().getByRole('button', { name: 'Skip' }).click();
    await clicked.waitForElementState('hidden');
  }
}

export async function gotoApp(page, hash = '#/stumble') {
  await page.goto('./' + hash);
  await skipFirstRun(page);
  await page.locator(ROUTED_HEADING).waitFor({ state: 'visible' });
}
