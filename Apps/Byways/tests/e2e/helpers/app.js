const FIRST_RUN = '[data-firstrun]';
const ROUTED_HEADING = '#app .view > h1';

// Boot is asynchronous: wait for Welcome or the routed view before looking at either.
export async function skipFirstRun(page) {
  await page.locator(`${FIRST_RUN}, ${ROUTED_HEADING}`).first().waitFor({ state: 'visible' });
  const firstRun = page.locator(FIRST_RUN);
  while (await firstRun.isVisible()) {
    await firstRun.getByRole('button', { name: 'Skip' }).click();
    await firstRun.waitFor({ state: 'hidden' });
  }
}

export async function gotoApp(page, hash = '#/stumble') {
  await page.goto('./' + hash);
  await skipFirstRun(page);
  await page.locator(ROUTED_HEADING).waitFor({ state: 'visible' });
}
