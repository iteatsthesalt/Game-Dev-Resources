import './settings/index.js';
import './settings/about.js';
import { h } from '../dom.js';
import { getView, registerView } from '../router.js';

// Later plans add their view imports above this line.
const PLACEHOLDERS = {
  stumble: 'Stumble', feed: 'Feed', daily: 'Daily Fate', vault: 'Vault', saved: 'Saved', import: 'Import',
};

for (const [route, title] of Object.entries(PLACEHOLDERS)) {
  if (!getView(route)) registerView(route, { title, render: container => container.append(h('p', null, 'Nothing here yet.')) });
}
