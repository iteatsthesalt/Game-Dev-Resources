import { makeFind } from '../model/find.js';
import { toPlainText } from '../util/text.js';
import { utcDate } from '../util/clock.js';
import { cachedJson, isSearchReply, searchPages } from './wikimedia.js';

const ID = 'commons';
const TAGS = ['photography'];
const SEARCH_API = 'https://commons.wikimedia.org/w/api.php';
const FEATURED_URL = 'https://en.wikipedia.org/api/rest_v1/feed/featured/';
const MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MIN_WIDTH = 400;

/** "File:Old_map.png" -> "Old map" */
const fileName = title => String(title).replace(/^File:/i, '').replace(/\.[^./]+$/, '').replaceAll('_', ' ');
const idOf = title => 'commons:' + String(title).replaceAll(' ', '_');
const credit = (...parts) => parts.filter(Boolean).join(' · ');
/** A featured feed is kept only when it holds a picture of the day; one without is asked for again. */
const hasPicture = body => typeof body?.image?.title === 'string';

function image(fields) {
  return makeFind({ source: ID, kind: 'image', tags: TAGS, ...fields });
}

const commons = {
  id: ID,
  name: 'Wikimedia Commons',
  tier: 'open',
  key: 'none',
  safety: 'mixed',
  rate: { perMinute: 10, concurrent: 1 },
  fate: false,
  kinds: ['image'],
  tags: TAGS,

  async random(ctx) {
    const day = utcDate(ctx.clock.now()).replaceAll('-', '/');
    const picture = (await cachedJson(ctx, ID, FEATURED_URL + day, { accept: hasPicture }))?.image;
    if (!picture || typeof picture.title !== 'string') return [];
    const author = toPlainText(picture.artist?.text);
    const licence = picture.license?.type;
    const find = image({
      id: idOf(picture.title),
      title: fileName(picture.title),
      description: picture.description?.text,
      url: picture.file_page,
      imageUrl: picture.thumbnail?.source,
      author,
      licence,
      attribution: credit(author, licence, 'Wikimedia Commons'),
      why: ['Wikimedia Commons: picture of the day'],
      safety: 'curated',
    });
    return find ? [find] : [];
  },

  async search(q, ctx) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: q,
      gsrlimit: '10',
      prop: 'imageinfo',
      iiprop: 'url|mime|size|extmetadata',
      iiurlwidth: '1024',
      format: 'json',
      origin: '*',
    });
    return searchPages(await cachedJson(ctx, ID, `${SEARCH_API}?${params}`, { accept: isSearchReply }))
      .map(page => {
        const info = page.imageinfo?.[0];
        const meta = info?.extmetadata ?? {};
        const licence = meta.LicenseShortName?.value;
        if (!info || !MIMES.has(info.mime) || !(info.width >= MIN_WIDTH) || !licence) return null;
        const author = toPlainText(meta.Artist?.value);
        return image({
          id: idOf(page.title),
          title: toPlainText(meta.ObjectName?.value) || fileName(page.title),
          description: toPlainText(meta.ImageDescription?.value),
          url: info.descriptionurl,
          imageUrl: info.thumburl,
          author,
          licence,
          attribution: credit(author, licence, 'Wikimedia Commons'),
          why: ['Wikimedia Commons search'],
          safety: 'mixed',
        });
      })
      .filter(Boolean);
  },

  async more() {
    return [];
  },
};

export default commons;
