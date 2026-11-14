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

// One tag, quote-aware so a `>` or `<style>` inside an attribute value does not end it. Raw-text elements (group 2)
// also capture their body (group 3), which is left alone, so markup written inside them is never touched.
// Each character after `<x` has exactly one way to match, so input with no closing `>` cannot backtrack.
const MARKUP =
  /(<(script|style|textarea|title|xmp|iframe|noembed|noframes)\b(?:"[^"]*"|'[^']*'|[^>"'])*>)([\s\S]*?(?:<\/\2\s*>|$))|(<[a-z](?:"[^"]*"|'[^']*'|[^>"'])*>)/gi;
const STYLE_ATTR = /("[^"]*"|'[^']*')|([\s/])style(?=\s*=)/gi;

/**
 * Chromium checks every parsed `style` attribute against the page's style-src CSP, even in an inert document, and
 * logs a violation for each. Rename the attribute (tags only, never text) so parsing is silent; the text is unchanged.
 * Exported for tests only.
 */
export function renameStyleAttributes(html) {
  const rename = (tag) => tag.replace(STYLE_ATTR, (m, quoted, pre) => quoted ?? `${pre}data-style`);
  return html.replace(MARKUP, (m, rawOpen, name, rawBody, tag) => (rawOpen ? rename(rawOpen) + rawBody : rename(tag)));
}

function plainTextWithDom(html) {
  // Parse into a <template>'s inert content: <style> blocks log no CSP violation there, and nothing is dropped from
  // the input beforehand. Style attributes do log one, hence renameStyleAttributes.
  const template = globalThis.document.createElement('template');
  template.setHTMLUnsafe(renameStyleAttributes(html)); // the fragment stays inert and detached; it is only read
  const root = template.content;
  for (const el of root.querySelectorAll('script, style, template, title')) el.remove();
  const space = () => root.ownerDocument.createTextNode(' ');
  for (const br of root.querySelectorAll('br')) br.before(space());
  for (const el of root.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6')) {
    el.before(space());
    el.after(space());
  }
  return collapse(root.textContent);
}

function plainTextWithRegex(html) {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), ' ')
    .replace(/<[^>]*>/g, '');
  return collapse(decodeEntities(stripped));
}

/** Longest input read, in UTF-16 units; callers keep 400 code points at most, so the rest is never shown. */
export const MAX_HTML_LENGTH = 20000;

/** HTML to collapsed plain text. Uses an inert <template> when the browser can fill one from a string, a regex fallback otherwise. */
export function toPlainText(html) {
  if (html == null) return '';
  const s = String(html).slice(0, MAX_HTML_LENGTH);
  return globalThis.document && globalThis.HTMLTemplateElement?.prototype.setHTMLUnsafe
    ? plainTextWithDom(s)
    : plainTextWithRegex(s);
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
