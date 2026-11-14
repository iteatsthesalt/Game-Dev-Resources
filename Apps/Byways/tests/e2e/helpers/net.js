import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from '../../fixtures/routes.js';

const HTTP_DIR = fileURLToPath(new URL('../../fixtures/http/', import.meta.url));
const APP_HOST = 'localhost:4321';
const TYPES = { '.json': 'application/json', '.xml': 'application/xml', '.html': 'text/html', '.txt': 'text/plain' };
const states = new WeakMap();

function stateOf(page) {
  if (!states.has(page)) states.set(page, { unmocked: [], problems: [] });
  return states.get(page);
}

function lowerKeys(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
}

function responseFor(entry) {
  const headers = { 'access-control-allow-origin': '*' };
  let body = entry.body ?? '';
  if (entry.file !== undefined) {
    body = readFileSync(HTTP_DIR + entry.file);
    headers['content-type'] = TYPES[extname(entry.file)] ?? 'application/octet-stream';
  } else if (entry.json !== undefined) {
    body = JSON.stringify(entry.json);
    headers['content-type'] = 'application/json';
  }
  return { status: entry.status ?? 200, headers: { ...headers, ...lowerKeys(entry.headers) }, body };
}

function fulfil(route, entry) {
  const request = route.request();
  if (request.method() === 'OPTIONS') {
    return route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': '*',
        'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? '*',
      },
    });
  }
  return route.fulfill(responseFor(entry));
}

const isExternal = url => /^https?:$/.test(url.protocol) && url.host !== APP_HOST;

export async function mockNet(page, { overrides = [] } = {}) {
  const fresh = !states.has(page);
  const state = stateOf(page);
  if (fresh) {
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      const url = msg.location().url;
      state.problems.push(`console: ${msg.text()}${url ? ` (${url})` : ''}`);
    });
    page.on('pageerror', error => state.problems.push(`pageerror: ${error.message}`));
    await page.route(isExternal, route => {
      const url = route.request().url();
      const entry = routes.find(r => r.match.test(url));
      if (entry) return fulfil(route, entry);
      state.unmocked.push(url);
      return route.abort('blockedbyclient');
    });
  }
  if (overrides.length) {
    await page.route(isExternal, route => {
      const entry = overrides.find(o => o.match.test(route.request().url()));
      return entry ? fulfil(route, entry) : route.fallback();
    });
  }
}

export function unmocked(page) {
  return [...stateOf(page).unmocked];
}

export function pageProblems(page, { ignore = [] } = {}) {
  return stateOf(page).problems.filter(problem => !ignore.some(pattern => pattern.test(problem)));
}

export const test = base.extend({
  ignoreProblems: [[], { option: true }],
  page: async ({ page, ignoreProblems }, use) => {
    await mockNet(page);
    await use(page);
    expect(unmocked(page)).toEqual([]);
    expect(pageProblems(page, { ignore: ignoreProblems })).toEqual([]);
  },
});
export { expect };
