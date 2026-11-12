// The only way views build DOM: no HTML is ever parsed, and URLs that could run code are dropped.
const URL_PROPS = new Set(['href', 'src', 'action', 'formaction', 'poster']);
const ASCII_JUNK = /[\u0000- \u007f]/g;

function isSafeUrl(value, tag) {
  let url;
  try { url = new URL(String(value).replace(ASCII_JUNK, ''), document.baseURI); } catch { return false; }
  if (url.origin === location.origin) return true;
  if (url.protocol === 'http:' || url.protocol === 'https:') return true;
  return url.protocol === 'data:' && tag === 'img';
}

function setProp(el, tag, key, value) {
  if (key === 'style') throw new Error('h: style is blocked by the CSP; use a class');
  if (key === 'class') { el.className = value; return; }
  if (key === 'text') { el.textContent = value; return; }
  if (/^on[A-Z]/.test(key) && typeof value === 'function') { el.addEventListener(key.slice(2).toLowerCase(), value); return; }
  if (key.startsWith('aria-') || key.startsWith('data-')) {
    if (value != null) el.setAttribute(key, String(value));
    return;
  }
  if (value == null || value === false) return;
  if (URL_PROPS.has(key) && !isSafeUrl(value, tag)) { console.warn('h: dropped unsafe URL'); return; }
  el.setAttribute(key, value === true ? '' : value);
}

function append(el, child) {
  if (Array.isArray(child)) { for (const c of child) append(el, c); return; }
  if (child == null || child === false) return;
  el.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) for (const [key, value] of Object.entries(props)) setProp(el, tag, key, value);
  append(el, children);
  return el;
}

export function clear(el) { el.replaceChildren(); return el; }
