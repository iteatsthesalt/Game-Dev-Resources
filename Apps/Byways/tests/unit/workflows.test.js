import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wf = name => readFileSync(new URL(`../../../../.github/workflows/${name}`, import.meta.url), 'utf8');
test('byways.yml runs the web job on Byways changes', () => {
  const y = wf('byways.yml');
  for (const s of ["paths: ['Apps/Byways/**', '.github/workflows/byways.yml']", 'runs-on: ubuntu-24.04', 'working-directory: Apps/Byways',
    'actions/checkout@v7', 'actions/setup-node@v4', 'node-version: 22', 'run: npm ci', 'run: npm test',
    'run: npx playwright install --with-deps chromium', 'run: npm run e2e', 'actions/upload-artifact@v7',
    'Apps/Byways/dist/chrome', 'Apps/Byways/dist/firefox']) assert.ok(y.includes(s), s);
  assert.equal((y.match(/paths:/g) || []).length, 2);
});
test('pages.yml builds, assembles _site and deploys', () => {
  const y = wf('pages.yml');
  for (const s of ['branches: [main]', 'workflow_dispatch:', 'contents: read', 'node tools/build.js --target pwa',
    'cp shells/pwa/landing/index.html "$RUNNER_TEMP/_site/index.html"', 'cp -R dist/pwa/. "$RUNNER_TEMP/_site/byways/"',
    'actions/configure-pages@v6', 'actions/upload-pages-artifact@v5', 'path: ${{ runner.temp }}/_site',
    'pages: write', 'id-token: write', 'name: github-pages', 'url: ${{ steps.deployment.outputs.page_url }}', 'group: pages', 'actions/deploy-pages@v5']) assert.ok(y.includes(s), s);
  assert.equal(y.includes('schedule:'), false);
  assert.doesNotMatch(y, /\{[^}\n]*\$\{\{/);
});
