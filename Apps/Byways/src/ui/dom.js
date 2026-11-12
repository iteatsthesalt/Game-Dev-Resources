// The only way views build DOM: no HTML is ever parsed, and URLs that could run code are dropped.
const URL_PROPS = new Set(['href', 'src', 'action', 'formaction', 'poster']);
const ASCII_JUNK = /[\u0000- \u007f]/g;

// Every opaque origin serializes as 'null', so 'null' never counts as the page's own origin.
function isSameOrigin(url) {
  return url.origin !== 'null' && url.origin === location.origin && (url.protocol === location.protocol || url.protocol === 'blob:');
}

function isSafeUrl(value, tag) {
  let url;
  try { url = new URL(String(value).replace(ASCII_JUNK, ''), document.baseURI); } catch { return false; }
  if (isSameOrigin(url)) return true;
  if (url.protocol === 'http:' || url.protocol === 'https:') return true;
  return url.protocol === 'data:' && tag === 'img';
}

// setAttribute lower-cases names on HTML elements, so every rule below compares the lower-cased key.
function setProp(el, tag, key, value) {
  const name = key.toLowerCase();
  if (name === 'style') throw new Error('h: style is blocked by the CSP; use a class');
  if (name === 'srcdoc') throw new Error('h: srcdoc parses HTML; build the content with h');
  if (key === 'class') { el.className = value; return; }
  if (key === 'text') { el.textContent = value; return; }
  if (/^on[A-Z]/.test(key) && typeof value === 'function') { el.addEventListener(key.slice(2).toLowerCase(), value); return; }
  if (key.startsWith('aria-') || key.startsWith('data-')) {
    if (value != null) el.setAttribute(key, String(value));
    return;
  }
  if (value == null || value === false) return;
  if (URL_PROPS.has(name) && !isSafeUrl(value, tag)) { console.warn('h: dropped unsafe URL'); return; }
  el.setAttribute(key, value === true ? '' : value);
}

// A link that opens a new browsing context never gets a handle on this window, even in older WebViews.
function addNoopener(el) {
  if (el.localName !== 'a' || el.getAttribute('target')?.toLowerCase() !== '_blank') return;
  const rel = el.getAttribute('rel') ?? '';
  if (!/(^|\s)noopener(\s|$)/i.test(rel)) el.setAttribute('rel', `${rel} noopener noreferrer`.trim());
}

function append(el, child) {
  if (Array.isArray(child)) { for (const c of child) append(el, c); return; }
  if (child == null || child === false) return;
  el.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) for (const [key, value] of Object.entries(props)) setProp(el, el.localName, key, value);
  addNoopener(el);
  append(el, children);
  return el;
}

export function clear(el) { el.replaceChildren(); return el; }
