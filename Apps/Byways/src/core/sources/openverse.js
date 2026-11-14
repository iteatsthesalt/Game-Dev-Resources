import { makeFind } from '../model/find.js';
import { NetError } from '../net/errors.js';
import { hash64 } from '../util/hash.js';
import { cachedJson } from './cached.js';

const ID = 'openverse';
const TAGS = ['photography'];
const API = 'https://api.openverse.org/v1';
const KEY_NAME = 'src:openverse';
const WORDS = ['moss', 'lighthouse', 'fox', 'mushroom', 'tram', 'kite', 'owl', 'fern', 'lantern', 'harbour'];
const MAX_PAGE = 5;
const EARLY_MS = 60e3;

/**
 * Tokens live in memory only: per ctx.secrets object, then per client id and a hash of the secret (so a changed
 * secret gets a fresh token and the secret itself is never a key). `kept` holds {token, expiresAt}; `pending` holds
 * the one token request in flight for a key, so concurrent calls share it.
 */
const states = new WeakMap();

const NO_TOKEN = Symbol('no token');
const text = value => (typeof value === 'string' ? value.trim() : '');

function stateOf(secrets) {
  if (!states.has(secrets)) states.set(secrets, { kept: new Map(), pending: new Map() });
  return states.get(secrets);
}

/** {clientId, clientSecret, key}, or null when the secret is missing or unusable. Never logs the secret. */
async function credentialsOf(ctx) {
  const raw = await ctx.secrets.get(KEY_NAME);
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('Openverse credentials are not valid JSON');
    return null;
  }
  const clientId = text(parsed?.clientId);
  const clientSecret = text(parsed?.clientSecret);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, key: clientId + ':' + hash64(clientSecret) };
}

async function requestToken(ctx, { clientId, clientSecret, key }, state) {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const reply = await ctx.http.getJson(`${API}/auth_tokens/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    source: ID,
  });
  const token = reply?.access_token;
  if (typeof token !== 'string' || !token) return null;
  const lifetime = reply.expires_in;
  // A lifetime that is missing or no longer than the early margin is good for this call only.
  if (Number.isFinite(lifetime) && lifetime > EARLY_MS / 1000) {
    state.kept.set(key, { token, expiresAt: ctx.clock.now() + lifetime * 1000 - EARLY_MS });
  }
  return token;
}

/** A bearer token for these credentials: the kept one, the one already being requested, or a new one. */
async function tokenFor(ctx, credentials) {
  const state = stateOf(ctx.secrets);
  const kept = state.kept.get(credentials.key);
  if (kept && kept.expiresAt > ctx.clock.now()) return kept.token;
  if (!state.pending.has(credentials.key)) {
    const request = requestToken(ctx, credentials, state).finally(() => state.pending.delete(credentials.key));
    state.pending.set(credentials.key, request);
  }
  return state.pending.get(credentials.key);
}

/** The shape finds() relies on: a search or related reply without it is not cached. */
const isReply = body => Array.isArray(body?.results);

/**
 * GET JSON from the API with a bearer token. `cache` keeps the response for a day (the token is fetched only on
 * a miss). A reply to the token request without a token gives null. A 401 drops the kept token, then rethrows.
 */
async function getJson(ctx, credentials, url, cache) {
  const headers = async () => {
    const token = await tokenFor(ctx, credentials);
    if (!token) throw NO_TOKEN;
    return { Authorization: `Bearer ${token}` };
  };
  try {
    return cache ? await cachedJson(ctx, ID, url, { headers, accept: isReply }) : await ctx.http.getJson(url, { source: ID, headers: await headers() });
  } catch (error) {
    if (error === NO_TOKEN) return null;
    if (error instanceof NetError && error.kind === 'http' && error.status === 401) stateOf(ctx.secrets).kept.delete(credentials.key);
    throw error;
  }
}

function licenceOf(item) {
  const license = text(item.license).toLowerCase();
  if (!license) return undefined;
  if (license === 'cc0') return 'CC0 1.0';
  if (license === 'pdm') return 'Public Domain Mark 1.0';
  return 'CC ' + license.toUpperCase() + (item.license_version ? ' ' + item.license_version : '');
}

function image(item) {
  if (!item || typeof item !== 'object' || item.mature === true) return null;
  if (typeof item.id !== 'string' && typeof item.id !== 'number') return null;
  return makeFind({
    id: 'ov:' + item.id,
    source: ID,
    kind: 'image',
    title: item.title,
    url: item.foreign_landing_url,
    imageUrl: item.thumbnail || item.url,
    author: item.creator,
    attribution: item.attribution,
    licence: licenceOf(item),
    tags: TAGS,
    why: ['Openverse'],
    safety: openverse.safety,
    meta: { ovId: String(item.id) },
  });
}

const finds = body => (Array.isArray(body?.results) ? body.results : []).map(image).filter(Boolean);

function searchUrl(q, page) {
  const params = new URLSearchParams({ q, mature: 'false', page_size: '20' });
  if (page !== undefined) params.set('page', String(page));
  return `${API}/images/?${params}`;
}

const openverse = {
  id: ID,
  name: 'Openverse',
  tier: 'open',
  key: 'required',
  keyName: KEY_NAME,
  safety: 'mostly',
  rate: { perMinute: 20, concurrent: 1 },
  fate: false,
  kinds: ['image', 'audio'],
  tags: TAGS,

  async random(ctx) {
    const credentials = await credentialsOf(ctx);
    if (!credentials) return [];
    const word = WORDS[Math.floor(ctx.rand() * WORDS.length)];
    const page = 1 + Math.floor(ctx.rand() * MAX_PAGE);
    return finds(await getJson(ctx, credentials, searchUrl(word, page), false));
  },

  async search(q, ctx) {
    const credentials = await credentialsOf(ctx);
    if (!credentials) return [];
    return finds(await getJson(ctx, credentials, searchUrl(q), true));
  },

  async more(find, ctx) {
    const credentials = await credentialsOf(ctx);
    if (!credentials) return [];
    const ovId = find?.meta?.ovId;
    if (typeof ovId !== 'string' || !ovId) return [];
    return finds(await getJson(ctx, credentials, `${API}/images/${encodeURIComponent(ovId)}/related/`, true));
  },
};

export default openverse;
