/** A just-enough DOM for the platform tests: elements are plain objects that record what was done to them. */
function fakeElement(tag) {
  const attrs = new Map();
  const listeners = new Map();
  const el = {
    tagName: String(tag).toUpperCase(),
    clicked: false,
    removed: false,
    children: [],
    setAttribute(k, v) { attrs.set(k, String(v)); el[k] = v; },
    getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
      if (typeof el[`on${event.type}`] === 'function') el[`on${event.type}`](event);
      return true;
    },
    click() { el.clicked = true; el.dispatchEvent({ type: 'click' }); },
    remove() { el.removed = true; },
    append(...nodes) { el.children.push(...nodes); },
  };
  return el;
}

/** → {document, created}: the document takes listeners like an element, and `created` lists every element `document.createElement` has made. */
export function fakeDocument() {
  const created = [];
  const document = Object.assign(fakeElement('#document'), {
    visibilityState: 'visible',
    createElement(tag) { const el = fakeElement(tag); created.push(el); return el; },
    body: fakeElement('body'),
  });
  return { document, created };
}
