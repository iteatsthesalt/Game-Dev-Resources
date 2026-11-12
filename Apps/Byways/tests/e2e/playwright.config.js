import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const appRoot = fileURLToPath(new URL('../..', import.meta.url));
const baseURL = 'http://localhost:4321/Game-Dev-Resources/byways/';
export default defineConfig({
  testDir: '.', testMatch: '**/*.spec.js', retries: 0, forbidOnly: !!process.env.CI, reporter: 'list',
  use: { baseURL, trace: 'off', serviceWorkers: 'block' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node tools/serve.js --root dist/pwa --base /Game-Dev-Resources/byways/ --port 4321', cwd: appRoot, url: baseURL, reuseExistingServer: !process.env.CI },
});
