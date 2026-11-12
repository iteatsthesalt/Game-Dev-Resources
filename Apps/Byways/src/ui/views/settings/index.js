import { h } from '../../dom.js';
import { registerView } from '../../router.js';

const sections = new Map();

/** A later registration with the same id replaces the earlier one. */
export function registerSettingsSection({ id, label, order, render }) {
  sections.set(id, { id, label, order, render });
}

export function listSettingsSections() {
  return [...sections.values()].sort((a, b) => a.order - b.order);
}

async function renderSettings(container, app, params = {}) {
  const section = sections.get(params.id);
  if (!section) {
    container.append(h('ul', null, ...listSettingsSections().map(s =>
      h('li', null, h('a', { href: `#/settings/${encodeURIComponent(s.id)}` }, s.label)))));
    return;
  }
  const body = h('div');
  container.append(h('h2', null, section.label), h('a', { href: '#/settings' }, 'All settings'), body);
  await section.render(body, app);
}

registerView('settings', { title: 'Settings', render: renderSettings });
