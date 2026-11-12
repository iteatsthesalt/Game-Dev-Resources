/** Words too common to carry meaning; shared with the TF-IDF scoring in later plans. */
export const STOP_WORDS = new Set(
  ('the and for are but not you all any can had her his was one our out has have this that with from they will ' +
    'would there their what about which when your into than then them these those were been also its who how ' +
    'why more some such only over very just').split(' ')
);

const BLOCK_TAGS = 'br|p|div|li|tr|h[1-6]';
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const REPLACEMENT = '�';

function decodeCodePoint(cp) {
  return cp === 0 || (cp >= 0xd800 && cp <= 0xdfff) || cp > 0x10ffff ? REPLACEMENT : String.fromCodePoint(cp);
}

function decodeEntities(s) {
  return s.replace(/&(?:(amp|lt|gt|quot|#39|nbsp)|#(\d+)|#[xX]([0-9a-fA-F]+));/g, (m, named, dec, hex) => {
    if (named) return NAMED_ENTITIES[named];
    return decodeCodePoint(dec ? parseInt(dec, 10) : parseInt(hex, 16));
  });
}

const collapse = (s) => s.replace(/\s+/g, ' ').trim();

function plainTextWithDom(html) {
  const doc = new globalThis.DOMParser().parseFromString(html, 'text/html');
  for (const el of doc.querySelectorAll('script, style, template')) el.remove();
  const space = () => doc.createTextNode(' ');
  for (const br of doc.querySelectorAll('br')) br.before(space());
  for (const el of doc.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6')) {
    el.before(space());
    el.after(space());
  }
  return collapse(doc.body.textContent);
}

function plainTextWithRegex(html) {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), ' ')
    .replace(/<[^>]*>/g, '');
  return collapse(decodeEntities(stripped));
}

/** HTML to collapsed plain text. Uses DOMParser when present, a regex fallback otherwise. */
export function toPlainText(html) {
  if (html == null) return '';
  const s = String(html);
  return globalThis.DOMParser ? plainTextWithDom(s) : plainTextWithRegex(s);
}

/** Text up to and including the first `.`, `!` or `?` that is followed by whitespace or the end. */
export function firstSentence(text) {
  const s = String(text ?? '');
  const m = s.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return m ? m[0] : s;
}

/** Shorten to at most `max` code points, ending in an ellipsis when anything was cut. */
export function truncate(text, max) {
  const chars = Array.from(String(text ?? ''));
  if (chars.length <= max) return chars.join('');
  return chars.slice(0, Math.max(0, max - 1)).join('').trimEnd() + '…';
}

/** Lower-case letter-only words of 3+ characters, stop words removed. */
export function tokenize(text) {
  const words = String(text ?? '').toLowerCase().match(/\p{L}+/gu) ?? [];
  return words.filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}
