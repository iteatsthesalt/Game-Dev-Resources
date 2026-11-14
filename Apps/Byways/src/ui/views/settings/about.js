import { h } from '../../dom.js';
import { APP_VERSION } from '../../../core/version.js';
import { registerSettingsSection } from './index.js';

async function readBuildId(app) {
  try {
    const response = await app.platform.transport.fetch(new URL('build.json', document.baseURI).href);
    if (!response.ok) return 'unknown';
    const { id } = await response.json();
    return typeof id === 'string' && id ? id : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function render(container, app) {
  container.append(
    h('p', null, `Version ${APP_VERSION}`),
    h('p', null, `Build ${await readBuildId(app)}`),
    h('ul', null,
      h('li', null, h('a', { href: 'https://github.com/iteatsthesalt/Game-Dev-Resources' }, 'Source code')),
      h('li', null, h('a', { href: 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/' }, 'Byways web app'))));
}

registerSettingsSection({ id: 'about', label: 'About', order: 90, render });
