import { makeFind } from '../model/find.js';
import { cachedJson } from './cached.js';

const ID = 'inat';
const TAGS = ['nature'];
const API = 'https://api.inaturalist.org/v1/observations';
const LICENCES = ['cc0', 'cc-by', 'cc-by-sa'];

/** 'cc-by' -> 'CC BY', 'cc0' -> 'CC0' */
const licenceName = code => code.toUpperCase().replaceAll('-', ' ');

function describe(taxon, observation) {
  const place = typeof observation.place_guess === 'string' ? observation.place_guess.trim() : '';
  const date = typeof observation.observed_on === 'string' ? observation.observed_on.trim() : '';
  const seen = [place && `seen in ${place}`, date && `on ${date}`].filter(Boolean).join(' ');
  const name = typeof taxon?.name === 'string' ? taxon.name : '';
  const text = [name, seen].filter(Boolean).join(', ');
  return text && text + '.';
}

function observationFind(observation) {
  if (!observation || typeof observation !== 'object') return null;
  const photo = (Array.isArray(observation.photos) ? observation.photos : [])
    .find(p => p && LICENCES.includes(p.license_code) && typeof p.url === 'string');
  if (!photo) return null;
  const taxon = observation.taxon ?? {};
  return makeFind({
    id: 'inat:' + observation.id,
    source: ID,
    kind: 'image',
    title: taxon.preferred_common_name || taxon.name,
    description: describe(taxon, observation),
    url: observation.uri,
    imageUrl: photo.url.replace('square', 'large'),
    author: observation.user?.login,
    attribution: photo.attribution,
    licence: licenceName(photo.license_code),
    tags: TAGS,
    why: ['iNaturalist'],
    safety: inat.safety,
    meta: { taxonId: taxon.id, published: observation.observed_on },
  });
}

function observationUrl(extra) {
  const params = new URLSearchParams({
    photos: 'true',
    quality_grade: 'research',
    photo_license: LICENCES.join(','),
    per_page: '30',
    ...extra,
  });
  return `${API}?${params}`;
}

const finds = body => (Array.isArray(body?.results) ? body.results : []).map(observationFind).filter(Boolean);
/** The shape finds() relies on: a reply without it is not cached. */
const isReply = body => Array.isArray(body?.results);

const inat = {
  id: ID,
  name: 'iNaturalist',
  tier: 'open',
  key: 'none',
  safety: 'mostly',
  rate: { perMinute: 60, concurrent: 1 },
  fate: true,
  kinds: ['image'],
  tags: TAGS,

  async random(ctx) {
    const page = 1 + Math.floor(ctx.rand() * 100);
    return finds(await ctx.http.getJson(observationUrl({ page: String(page) }), { source: ID }));
  },

  async search(q, ctx) {
    return finds(await cachedJson(ctx, ID, observationUrl({ q, page: '1' }), { accept: isReply }));
  },

  async more(find, ctx) {
    const taxonId = find?.meta?.taxonId;
    if (taxonId === undefined || taxonId === null) return [];
    return finds(await cachedJson(ctx, ID, observationUrl({ taxon_id: String(taxonId), page: '1' }), { accept: isReply }));
  },
};

export default inat;
