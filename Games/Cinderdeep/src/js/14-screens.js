/* ============================================================
   Cinderdeep — screens and modals: title, heroes, camp, records,
   settings, help, level up, relics, forge, pause, map, summary
   ============================================================ */
const UI = {
  stack: [],
  root() { return $('ui'); },
  // open a screen or modal; opts.modal pauses play, opts.onBack runs on Esc/B
  open(el, opts = {}) {
    if (opts.replace !== false) this.clear();
    el._opts = opts;
    this.root().append(el);
    this.stack.push(el);
    if (opts.modal) { G.menu = el; $('banner').classList.remove('show'); }
    Input.gameFocus = false;
    Input.clearHeld();
    requestAnimationFrame(() => this.focusFirst(el));
    return el;
  },
  close(el) {
    el = el || this.stack[this.stack.length - 1];
    if (!el) return;
    el.remove();
    this.stack = this.stack.filter((x) => x !== el);
    if (G.menu === el) G.menu = this.stack.find((x) => x._opts && x._opts.modal) || null;
    if (!this.stack.length && G.mode === 'play') { Input.gameFocus = true; Input.clearHeld(); }
    const top = this.stack[this.stack.length - 1];
    if (top) this.focusFirst(top);
  },
  clear() { for (const el of this.stack) el.remove(); this.stack = []; G.menu = null; },
  top() { return this.stack[this.stack.length - 1]; },
  focusables(el) { return [...el.querySelectorAll('button:not([disabled]), [tabindex="0"], input, select')].filter((b) => b.offsetParent !== null); },
  focusFirst(el) {
    const f = this.focusables(el);
    const pref = el.querySelector('[data-autofocus]:not([disabled])') || f[0];
    if (pref && Input.device !== 'touch') try { pref.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  },
  nav() {
    const el = this.top(), A = Input.act;
    if (!el) return;
    if (A.back || (A.map && el._isMap)) { Sound.play('back'); if (el._opts.onBack) el._opts.onBack(); else if (el._opts.modal) this.close(el); return; }
    if (el._customNav && el._customNav(A)) return;
    const f = this.focusables(el);
    if (!f.length) return;
    let i = f.indexOf(document.activeElement);
    const step = (d) => { i = i < 0 ? 0 : (i + d + f.length) % f.length; f[i].focus(); f[i].scrollIntoView({ block: 'nearest' }); Sound.play('ui', { v: 0.5 }); };
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') {
      const ae = document.activeElement;
      // left and right (stick or d-pad) change a slider or a choice
      if ((A.navLeft || A.navRight) && Input.device === 'pad' && ae.type === 'range') { const st = +ae.step || 0.05, v = clamp(+ae.value + (A.navRight ? st : -st), +ae.min, +ae.max); ae.value = v; ae.dispatchEvent(new Event('input', { bubbles: true })); ae.dispatchEvent(new Event('change', { bubbles: true })); Sound.play('ui', { v: 0.4 }); return; }
      if ((A.navLeft || A.navRight) && Input.device === 'pad' && tag === 'SELECT') { const n = ae.options.length, i2 = clamp(ae.selectedIndex + (A.navRight ? 1 : -1), 0, n - 1); if (i2 !== ae.selectedIndex) { ae.selectedIndex = i2; ae.dispatchEvent(new Event('change', { bubbles: true })); Sound.play('ui', { v: 0.4 }); } return; }
      if (Input.pad.edge.has(12) || (Input.device === 'pad' && A.navUp)) step(-1); else if (Input.pad.edge.has(13) || (Input.device === 'pad' && A.navDown)) step(1); return;
    }
    if (A.navDown || A.navRight) step(1);
    else if (A.navUp || A.navLeft) step(-1);
    else if (Input.pad.edge.has(0) && document.activeElement && f.includes(document.activeElement)) document.activeElement.click();
  },
};
const btn = (label, onclick, cls = '', attrs = {}) => h('button', { class: 'btn ' + cls, type: 'button', onclick: (e) => { Sound.play('ui'); onclick(e); }, ...attrs }, label);
const emberChip = () => h('span', { class: 'embers', title: 'Embers' }, h('img', { alt: '', src: iconURL(miscIcon('ember'), 2) }), String(CD.save.embers || 0));

/* ---------- title ---------- */
UI.title = function () {
  setMode('title');
  startDemo();
  const save = CD.save, has = !!save.run;
  const el = h('div', { class: 'screen center title' },
    h('div', { style: { display: 'grid', gap: '6px', justifyItems: 'center', marginBottom: '6px' } },
      h('h1', { class: 'ttl' }, 'Cinderdeep'),
      h('p', { class: 'ttl-sub' }, 'Twelve floors down to the Cinder King')),
    h('div', { class: 'menu' },
      has ? btn(`Continue · ${CLASS[save.run.cls].name}, ${floorLabel(save.run.floorIdx)}`, () => continueRun(), 'primary', { 'data-autofocus': true }) : null,
      btn('New descent', () => UI.heroes(), has ? '' : 'primary', has ? {} : { 'data-autofocus': true }),
      btn('Camp · spend embers', () => UI.camp()),
      btn('Records', () => UI.records()),
      btn('Settings', () => UI.settings(() => UI.title())),
      btn('How to play', () => UI.help(() => UI.title()))),
    h('div', { class: 'row' }, emberChip()),
    h('p', { class: 'foot' }, `${save.stats.runs || 0} descents · ${save.stats.wins || 0} victories · deepest floor ${save.stats.bestFloor || 0}`),
    h('p', { class: 'foot', id: 'save-note' }, saveNote()),
  );
  UI.open(el, {});
};

function saveNote() { return CD.cloud ? 'Progress is saved to your account.' : CD.cloudTried ? 'Progress saves in this browser.' : ''; }

/* ---------- hero select ---------- */
UI.heroes = function () {
  const save = CD.save;
  let sel = save.lastClass && save.unlocks.classes.includes(save.lastClass) ? save.lastClass : 'knight';
  let heat = Math.min(save.lastHeat || 0, save.heatUnlocked || 0);
  let lookSheet = save.lastSheet || '';
  const grid = h('div', { class: 'heroes' });
  const detail = h('div', { class: 'detail' });
  const go = btn('Begin the descent', () => begin(), 'primary');
  const begin = () => {
    if (!save.unlocks.classes.includes(sel)) return;
    save.lastClass = sel; save.lastHeat = heat; save.lastSheet = lookSheet;
    const seedIn = $('seed-in'), seed = seedIn && seedIn.value.trim() ? seedIn.value.trim() : null;
    UI.clear();
    fadeTransition(() => startRun({ cls: sel, heat, seed, sheetId: lookSheet || null }));
  };
  const draw = () => {
    grid.innerHTML = '';
    for (const c of CLASSES) {
      const unlocked = save.unlocks.classes.includes(c.id);
      const cv = mkCanvas(24, 24), g = cv.getContext('2d');
      const sp = heroSprites(c.look, c.id).front[0];
      g.drawImage(sp.c, 12 - sp.ax, 23 - sp.ay);
      const card = h('button', { class: `hero ${sel === c.id ? 'sel' : ''} ${unlocked ? '' : 'locked'}`, type: 'button', 'aria-pressed': sel === c.id ? 'true' : 'false', 'data-autofocus': sel === c.id ? true : null,
        onclick: () => { Sound.play('ui'); sel = c.id; draw(); } },
        cv, h('b', {}, c.name), h('small', {}, c.blurb),
        h('span', { class: 'stats' }, `${c.hp} health`, ` · ${WEAPON[c.weapon].name}`),
        unlocked ? null : h('span', { class: 'lock' }, `Unlock in camp · ${c.cost} embers`));
      grid.append(card);
    }
    const c = CLASS[sel], unlocked = save.unlocks.classes.includes(sel);
    detail.innerHTML = '';
    const w = makeWeapon(c.weapon, 'common', new RNG(1));
    const pas = h('div', { class: 'card', style: { '--rc': 'var(--ember-2)' } }, h('div', { class: 'head' }, h('img', { alt: '', src: iconURL(miscIcon('heat'), 3) }), h('div', {}, h('div', { class: 'nm' }, c.passive.name), h('div', { class: 'sub' }, `${c.name} passive`))), h('p', { class: 'desc' }, c.passive.desc));
    const wc = h('div', { html: weaponCardHTML(w) });
    const ac = h('div', { html: abilityCardHTML(c.ability, 1) });
    detail.append(h('div', { style: { display: 'grid', gap: '10px' } }, wc.firstElementChild, pas), ac.firstElementChild);
    go.disabled = !unlocked;
    go.textContent = unlocked ? `Descend as the ${c.name}` : `Locked · unlock in camp`;
  };
  draw();
  const heatSel = h('select', { id: 'heat-sel', onchange: (e) => { heat = +e.target.value; } },
    ...Array.from({ length: (save.heatUnlocked || 0) + 1 }, (_, i) => h('option', { value: i, selected: i === heat ? true : null }, i === 0 ? 'Heat 0 · normal' : `Heat ${i} · ${HEAT[i]}`)));
  const sheets = save.sheets || [];
  const lookSel = h('select', { id: 'look-sel', onchange: (e) => { lookSheet = e.target.value; } },
    h('option', { value: '' }, 'The hero’s own look'), ...sheets.map((s) => h('option', { value: s.id, selected: s.id === lookSheet ? true : null }, `Sheet: ${s.name}`)));
  const el = h('div', { class: 'screen dim' },
    h('div', { class: 'topbar' }, h('h2', {}, 'Choose a hero'), emberChip()),
    grid, detail,
    h('div', { class: 'opts' },
      (save.heatUnlocked || 0) > 0 ? h('label', { class: 'field' }, 'Heat', heatSel) : h('span', { class: 'foot' }, 'Win a run to unlock Heat, harder descents that pay more embers.'),
      h('label', { class: 'field' }, 'Look', lookSel),
      h('label', { class: 'field' }, 'Seed (optional)', h('input', { id: 'seed-in', type: 'text', maxlength: 24, placeholder: 'random', autocomplete: 'off', spellcheck: 'false' })),
      btn('Today’s seed', () => { const d = new Date(); $('seed-in').value = `daily-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; toast('Everyone who plays today gets the same floors'); }, 'small')),
    sheetDrop(() => UI.heroes()),
    h('div', { class: 'row' }, btn('Back', () => UI.title()), go),
  );
  UI.open(el, { onBack: () => UI.title() });
};

/* ---------- camp: permanent upgrades and unlocks ---------- */
UI.camp = function (tab = 'upgrades') {
  const save = CD.save;
  const tabs = [['upgrades', 'Upgrades'], ['heroes', 'Heroes'], ['armory', 'Armory'], ['library', 'Library']];
  const body = h('div', { class: 'grid-up' });
  const spend = (cost, fn) => { if ((save.embers || 0) < cost) { Sound.play('deny'); toast('Not enough embers'); return; } save.embers -= cost; fn(); Sound.play('buy'); persist(); UI.camp(tab); };
  if (tab === 'upgrades') for (const m of META) {
    const r = save.meta[m.id] || 0, max = m.costs.length, cost = m.costs[r];
    body.append(h('div', { class: `up ${r >= max ? 'owned' : ''}` },
      h('img', { alt: '', src: iconURL(metaIcon(m.id), 3) }),
      h('b', {}, m.name), h('small', {}, `${m.desc}${max > 1 ? ` per rank` : ''}`),
      h('div', { class: 'pips' }, ...Array.from({ length: max }, (_, i) => h('i', { class: i < r ? 'on' : '' }))),
      r >= max ? h('small', {}, 'Complete') : btn(h('span', {}, 'Buy ', h('span', { class: 'cost' }, `${cost}`)), () => spend(cost, () => { save.meta[m.id] = r + 1; }), 'small', { disabled: (save.embers || 0) < cost ? true : null })));
  }
  if (tab === 'heroes') for (const c of CLASSES) {
    const own = save.unlocks.classes.includes(c.id);
    const cv = mkCanvas(24, 24), sp = heroSprites(c.look, c.id).front[0]; cv.getContext('2d').drawImage(sp.c, 12 - sp.ax, 23 - sp.ay);
    body.append(h('div', { class: `up ${own ? 'owned' : ''}` }, cv, h('b', {}, c.name), h('small', {}, `${c.passive.name}: ${c.passive.desc}`), h('small', {}, `Starts with ${WEAPON[c.weapon].name} and ${ABILITY[c.ability].name}`),
      own ? h('small', {}, 'Ready') : btn(h('span', {}, 'Unlock ', h('span', { class: 'cost' }, `${c.cost}`)), () => spend(c.cost, () => save.unlocks.classes.push(c.id)), 'small', { disabled: (save.embers || 0) < c.cost ? true : null })));
  }
  if (tab === 'armory') for (const w of WEAPONS.filter((x) => !x.start)) {
    const own = save.unlocks.weapons.includes(w.id);
    body.append(h('div', { class: `up ${own ? 'owned' : ''}` }, h('img', { alt: '', src: iconURL(weaponIcon(w.id), 3) }), h('b', {}, w.name), h('small', {}, w.desc), h('small', {}, `${w.kind === 'melee' ? 'Melee' : 'Ranged'} · ${w.dmg} damage · ${w.rate}/s`),
      own ? h('small', {}, 'In the deep now') : btn(h('span', {}, 'Unlock ', h('span', { class: 'cost' }, `${w.cost}`)), () => spend(w.cost, () => save.unlocks.weapons.push(w.id)), 'small', { disabled: (save.embers || 0) < w.cost ? true : null })));
  }
  if (tab === 'library') for (const a of ABILITIES.filter((x) => !x.start && x.cost)) {
    const own = save.unlocks.abilities.includes(a.id);
    body.append(h('div', { class: `up ${own ? 'owned' : ''}` }, h('img', { alt: '', src: iconURL(abilityIcon(a.id), 3) }), h('b', {}, a.name), h('small', {}, a.desc), h('small', {}, `${a.cd}s recharge`),
      own ? h('small', {}, 'In the deep now') : btn(h('span', {}, 'Unlock ', h('span', { class: 'cost' }, `${a.cost}`)), () => spend(a.cost, () => save.unlocks.abilities.push(a.id)), 'small', { disabled: (save.embers || 0) < a.cost ? true : null })));
  }
  const el = h('div', { class: 'screen dim' },
    h('div', { class: 'topbar' }, h('h2', {}, 'The Camp'), emberChip()),
    h('p', { class: 'notice' }, 'Embers you carry out of the deep buy lasting strength. Unlocked weapons and abilities start turning up in chests and shops.'),
    h('div', { class: 'tabs', role: 'tablist' }, ...tabs.map(([id, label]) => btn(label, () => UI.camp(id), 'small', { role: 'tab', 'aria-selected': id === tab ? 'true' : 'false', 'data-autofocus': id === tab ? true : null }))),
    body,
    h('div', { class: 'row' }, btn('Back', () => UI.title())));
  UI.open(el, { onBack: () => UI.title() });
};
function metaIcon(id) {
  return { vigor: miscIcon('heart'), might: skillIcon('offense'), swiftness: skillIcon('utility'), flask: miscIcon('potion'), purse: miscIcon('gold'), insight: pickupIconXP(), reroll: miscIcon('swap'), keen: relicIcon('glasseye'), pull: miscIcon('ember'), keys: miscIcon('key'), map: relicIcon('lantern'), revive: relicIcon('phoenix') }[id] || miscIcon('rune');
}
function pickupIconXP() { return icon('m:xp', (p) => { p.px(8, 2, '#d8f6ff'); p.rect(6, 4, 5, 7, '#5ac8f0'); p.rect(7, 11, 3, 2, '#2a88c8'); p.px(6, 5, '#ffffff'); }); }

/* ---------- records ---------- */
UI.records = function () {
  const s = CD.save.stats || {}, codex = CD.save.codex || {};
  const best = Object.entries(CD.save.wonWith || {});
  const stat = (k, v) => h('div', {}, k, h('b', {}, String(v)));
  const beasts = h('div', { class: 'chips' }, ...Object.keys(ENEMIES).filter((k) => !ENEMIES[k].ally && !ENEMIES[k].world).map((k) => {
    const n = codex[k] || 0, d = ENEMIES[k];
    const cv = mkCanvas(22, 22), sp = monsterFrames(d.sprite, { tint: d.tint, small: d.small })[0];
    const g = cv.getContext('2d'); if (n) g.drawImage(sp.c, Math.round(11 - sp.ax * Math.min(1, 20 / sp.w)), Math.round(21 - sp.ay * Math.min(1, 20 / sp.h)), sp.w * Math.min(1, 20 / sp.w), sp.h * Math.min(1, 20 / sp.h)); else { g.drawImage(silhouette(sp, '#3a3036'), Math.round(11 - sp.ax * Math.min(1, 20 / sp.w)), Math.round(21 - sp.ay * Math.min(1, 20 / sp.h)), sp.w * Math.min(1, 20 / sp.w), sp.h * Math.min(1, 20 / sp.h)); }
    cv.style.width = '28px'; cv.style.height = '28px'; cv.style.imageRendering = 'pixelated';
    return h('span', { class: 'chip', title: n ? `${d.name}: ${n} slain` : 'Not yet met' }, cv, n ? d.name : '???', n ? h('em', {}, String(n)) : null);
  }));
  const bosses = h('div', { class: 'chips' }, ...Object.entries(BOSSES).map(([k, b]) => h('span', { class: 'chip' }, h('img', { alt: '', src: iconURL(miscIcon('skull'), 2) }), (s.bossKills || {})[k] ? b.name : '???', (s.bossKills || {})[k] ? h('em', {}, String(s.bossKills[k])) : null)));
  const hist = (CD.save.history || []).map((r) => h('div', {}, `${CLASS[r.cls] ? CLASS[r.cls].name : r.cls} · ${r.won ? 'Victory' : `fell on floor ${r.floor}`}${r.heat ? ` · Heat ${r.heat}` : ''}`, h('b', {}, `Lv ${r.level} · ${r.kills} kills · ${fmtTime(r.time)} · +${r.embers}`)));
  const el = h('div', { class: 'screen dim' },
    h('div', { class: 'topbar' }, h('h2', {}, 'Records'), emberChip()),
    h('div', { class: 'panel wide' },
      h('h3', {}, 'Totals'),
      h('div', { class: 'statgrid' }, stat('Descents', s.runs || 0), stat('Victories', s.wins || 0), stat('Deaths', s.deaths || 0), stat('Deepest floor', s.bestFloor || 0), stat('Foes slain', s.kills || 0), stat('Embers earned', s.embersEarned || 0), stat('Heat unlocked', CD.save.heatUnlocked || 0)),
      best.length ? h('p', {}, 'Victories: ' + best.map(([c, hh]) => `${CLASS[c].name} (heat ${hh - 1})`).join(', ')) : null,
      h('h3', {}, 'Bosses'), bosses,
      h('h3', {}, 'Bestiary'), beasts,
      h('h3', {}, 'Recent descents'), hist.length ? h('div', { class: 'statgrid', style: { gridTemplateColumns: '1fr' } }, ...hist) : h('p', {}, 'No descents yet.')),
    h('div', { class: 'row' }, btn('Back', () => UI.title())));
  UI.open(el, { onBack: () => UI.title() });
};

/* ---------- settings ---------- */
// Modules add their own settings here instead of rewrapping UI.settings.
// make(back) returns a node or null; 'top' entries sit under the heading,
// the rest above the Done row, each group in order. Registering an id again replaces it.
const SETTINGS_ROWS = [];
function settingsRow(id, order, make, top = false) {
  const i = SETTINGS_ROWS.findIndex((r) => r.id === id), r = { id, order, make, top };
  if (i >= 0) SETTINGS_ROWS[i] = r; else SETTINGS_ROWS.push(r);
}
const settingsRows = (top, back) => SETTINGS_ROWS.filter((r) => r.top === top).sort((a, b) => a.order - b.order).map((r) => r.make(back)).filter(Boolean);
UI.settings = function (back) {
  const S = CD.settings;
  const save = () => { CD.save.settings = { ...S }; persist(); Sound.vol.sfx = S.sfx; Sound.vol.music = S.music; Sound.setVolumes(); };
  const range = (id, label, key) => h('label', { class: 'set-row' }, label, h('input', { id, type: 'range', min: 0, max: 1, step: 0.05, value: S[key], oninput: (e) => { S[key] = +e.target.value; save(); } }));
  const check = (id, label, key) => h('label', { class: 'set-row' }, label, h('input', { id, type: 'checkbox', checked: S[key] ? true : null, onchange: (e) => { S[key] = e.target.checked; save(); } }));
  const zoom = h('select', { id: 'set-zoom', onchange: (e) => { S.zoom = +e.target.value; save(); resize(); } }, ...[[1.25, 'Close'], [1, 'Normal'], [0.8, 'Far']].map(([v, l]) => h('option', { value: v, selected: S.zoom === v ? true : null }, l)));
  const shakeSel = h('select', { id: 'set-shake', onchange: (e) => { S.shake = +e.target.value; save(); } }, ...[[1, 'Full'], [0.5, 'Gentle'], [0, 'Off']].map(([v, l]) => h('option', { value: v, selected: S.shake === v ? true : null }, l)));
  let confirmReset = false;
  const reset = btn('Erase all progress', () => {
    if (!confirmReset) { confirmReset = true; reset.textContent = 'Press again to erase everything'; return; }
    CD.save = defaultSave(); CD.save.settings = { ...S }; persist(true); toast('Progress erased'); UI.title();
  }, 'small');
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel' },
    h('h2', {}, 'Settings'),
    ...settingsRows(true, back),
    range('set-music', 'Music', 'music'), range('set-sfx', 'Sound effects', 'sfx'),
    h('label', { class: 'set-row' }, 'Screen shake', shakeSel),
    h('label', { class: 'set-row' }, 'Camera', zoom),
    check('set-bright', 'Brighter dungeon', 'bright'),
    check('set-lowfx', 'Fewer effects (faster)', 'lowFx'),
    check('set-turn8', 'Rigged heroes: eight directions, full walk cycles', 'turn8'),
    check('set-rigworld', 'Rigged world: creatures turn and walk, trees and things move', 'rigWorld'),
    check('set-autofire', 'Gamepad: right stick also attacks', 'padAutoFire'),
    ...settingsRows(false, back),
    h('div', { class: 'row' }, btn('Done', () => back ? back() : UI.close(), 'primary', { 'data-autofocus': true }), reset)));
  UI.open(el, { modal: G.mode === 'play', replace: G.mode !== 'play', onBack: () => (back ? back() : UI.close()) });
};

/* ---------- help ---------- */
UI.help = function (back) {
  const k = (keys, what) => h('div', {}, ...keys.map((x) => h('kbd', {}, x)), ' ', what);
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel wide' },
    h('h2', {}, 'How to play'),
    h('p', {}, 'Fight down through four regions of three floors each. Every room you enter seals until its monsters fall. Find the stairs, beat the boss on every third floor, and claim a relic from its altar. When you die, the run ends but the embers you gathered stay with you for the camp.'),
    h('h3', {}, 'Keyboard and mouse'),
    h('div', { class: 'keys' }, k(['W', 'A', 'S', 'D'], 'move'), k(['Mouse'], 'aim'), k(['Click'], 'attack (hold to keep swinging)'), k(['Space'], 'dash through danger'), k(['Q', 'E'], 'abilities (right click works for Q)'), k(['F'], 'pick up, open, buy, talk'), k(['Tab'], 'swap weapons (or the wheel)'), k(['R'], 'drink a potion'), k(['M'], 'map'), k(['Esc'], 'pause')),
    h('p', {}, 'No mouse? Arrows move, J attacks, K dashes, U and I are abilities, L interacts. Your aim snaps to the nearest foe.'),
    h('h3', {}, 'Gamepad'),
    h('div', { class: 'keys' }, k(['L stick'], 'move'), k(['R stick'], 'aim (and attack)'), k(['RT'], 'attack'), k(['A'], 'dash'), k(['LB', 'RB'], 'abilities'), k(['X'], 'interact'), k(['Y'], 'swap weapon'), k(['B'], 'potion'), k(['Start'], 'pause'), k(['Back'], 'map')),
    h('h3', {}, 'Touch'),
    h('p', {}, 'Left stick moves. Hold the right stick to attack; drag it to aim or just hold it to hit the nearest foe. Buttons above it dash and cast. A USE button appears when something can be picked up.'),
    h('h3', {}, 'Tips'),
    h('div', { class: 'keys' },
      h('div', {}, 'Dashing makes you untouchable for a moment.'),
      h('div', {}, 'Melee swings cut small missiles out of the air.'),
      h('div', {}, 'Red markers on the floor show where an attack will land.'),
      h('div', {}, 'Ember Knights block hits from the front.'),
      h('div', {}, 'Keys open treasure rooms and silver chests.'),
      h('div', {}, 'Level ups wait until a room is clear.')),
    h('div', { class: 'row' }, btn('Got it', () => back ? back() : UI.close(), 'primary', { 'data-autofocus': true }))));
  UI.open(el, { modal: G.mode === 'play', replace: G.mode !== 'play', onBack: () => (back ? back() : UI.close()) });
};

/* ---------- pause, map, build ---------- */
UI.map = function () {
  if (UI.top()) return;
  const cv = h('canvas', { width: 360, height: 300 });
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel wide' },
    h('h2', {}, floorLabel(G.fl.idx)),
    h('div', { class: 'mapwrap' }, cv,
      h('div', { class: 'legend' }, ...[['You', '#ff7a3c'], ['Treasure', ROOM_MARK.treasure], ['Shop', ROOM_MARK.shop], ['Shrine', ROOM_MARK.shrine], ['Forge', ROOM_MARK.forge], ['Stairs', ROOM_MARK.exit], ['Boss', ROOM_MARK.boss], ['Challenge', ROOM_MARK.challenge], ['Fountain', ROOM_MARK.rest], ['DMT zone', ROOM_MARK.dmt], ['Secret', ROOM_MARK.secret], ['Uncleared', '#8a5a5a']].map(([l, c]) => h('span', {}, h('i', { style: { background: c } }), l)))),
    h('div', { class: 'row' }, btn('Close', () => UI.close(el), 'primary', { 'data-autofocus': true }))));
  el._isMap = true;
  UI.open(el, { modal: true, replace: false });
  drawMinimap(cv, true);
};
UI.build = function () {
  const p = G.p, s = p.stats;
  const skills = Object.entries(p.skills).filter(([id]) => SKILL[id]);
  const chips = (arr) => h('div', { class: 'chips' }, ...arr);
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel wide' },
    h('h2', {}, 'Your build'),
    h('div', { class: 'build' },
      h('div', { html: weaponCardHTML(p.weapon) }),
      p.weapons[1 - p.wi] ? h('div', { html: weaponCardHTML(p.weapons[1 - p.wi]) }) : null,
      ...p.abilities.filter(Boolean).map((a) => h('div', { html: abilityCardHTML(a.id, a.lvl) }))),
    h('h3', {}, `Skills (${skills.length})`),
    skills.length ? chips(skills.map(([id, r]) => h('span', { class: 'chip', title: SKILL[id].desc }, h('img', { alt: '', src: iconURL(skillIcon(SKILL[id].tag), 2) }), SKILL[id].name, h('em', {}, `×${r}`)))) : h('p', {}, 'None yet. Level up to learn skills.'),
    h('h3', {}, `Relics (${p.relics.length})`),
    p.relics.length ? chips(p.relics.map((id) => h('span', { class: 'chip', style: { '--rc': 'var(--r-relic)' }, title: RELIC[id].desc }, h('img', { alt: '', src: iconURL(relicIcon(id), 2) }), RELIC[id].name))) : h('p', {}, 'None yet. Bosses, treasure rooms and shops hold them.'),
    h('h3', {}, 'Numbers'),
    h('div', { class: 'statgrid' },
      ...[['Health', `${Math.ceil(p.hp)} / ${p.maxHp}`], ['Damage', pct(s.dmgMul)], ['Attack speed', pct(s.atkSpd)], ['Crit chance', pct(s.crit)], ['Crit damage', pct(s.critMul)], ['Armor', s.armor], ['Move speed', Math.round(s.spd)], ['Dashes', s.dashMax], ['Ability recharge', pct(s.cdMul)], ['Ability damage', pct(s.abDmg)], ['Lifesteal', pct(s.lifesteal)], ['Dodge', pct(s.dodge)], ['Burn / Poison', `${pct(s.burnCh)} / ${pct(s.poisonCh)}`], ['Chill / Shock', `${pct(s.chillCh)} / ${pct(s.shockCh)}`], ['Gold / XP bonus', `${pct(s.goldMul)} / ${pct(s.xpMul)}`], ['Foes slain', G.run.stats.kills]].map(([k, v]) => h('div', {}, k, h('b', {}, String(v))))),
    h('div', { class: 'row' }, btn('Close', () => UI.close(el), 'primary', { 'data-autofocus': true }))));
  UI.open(el, { modal: true, replace: false });
};
UI.confirm = function (title, text, yes, onYes) {
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel' }, h('h2', {}, title), h('p', {}, text),
    h('div', { class: 'row' }, btn('Cancel', () => UI.close(el), '', { 'data-autofocus': true }), btn(yes, () => { UI.close(el); onYes(); }, 'primary'))));
  UI.open(el, { modal: true, replace: false });
};

/* ---------- level up ---------- */
UI.levelUp = function (rarities, title) {
  const p = G.p;
  if (UI.top() && UI.top()._levelUp) return;
  const fromShrine = !!rarities;
  const choices = skillChoices(rarities);
  const wrap = h('div', { class: 'choices' });
  const done = (sk) => {
    learnSkill(sk.id);
    if (!fromShrine) p.pendingLevels = Math.max(0, p.pendingLevels - 1);
    UI.close(el);
  };
  const fill = (list) => {
    wrap.innerHTML = '';
    list.forEach((sk, i) => {
      const card = h('button', { class: `card r-${sk.rar === 'epic' ? 'epic' : sk.rar === 'rare' ? 'rare' : 'common'}`, type: 'button', 'data-autofocus': i === 0 ? true : null, onclick: () => done(sk) });
      card.innerHTML = skillCardHTML(sk, p.skills[sk.id] || 0) + `<span class="pick">${Input.device === 'kbm' ? `Press ${i + 1} or click` : 'Choose'}</span>`;
      wrap.append(card);
    });
    if (!list.length) wrap.append(h('p', {}, 'You have mastered every skill.'), btn('Take 50 gold instead', () => { p.gold += 50; p.pendingLevels = Math.max(0, p.pendingLevels - 1); UI.close(el); }, 'primary'));
  };
  fill(choices);
  const reroll = btn(`Reroll (${p.rerolls})`, () => { if (p.rerolls <= 0) return; p.rerolls--; reroll.textContent = `Reroll (${p.rerolls})`; reroll.disabled = p.rerolls <= 0; fill(skillChoices(rarities)); UI.focusFirst(el); }, 'small', { disabled: p.rerolls <= 0 ? true : null });
  const el = h('div', { class: 'modal' }, h('div', { style: { display: 'grid', gap: '16px', justifyItems: 'center', width: 'min(100%, 980px)' } },
    h('div', { class: 'lv-head' }, h('b', {}, fromShrine ? 'A Gift' : `Level ${p.level - p.pendingLevels + 1}`), h('small', {}, title || 'Choose a skill')),
    wrap, h('div', { class: 'row' }, reroll)));
  el._levelUp = true;
  el.addEventListener('keydown', (e) => { const n = +e.key; if (n >= 1 && n <= 3 && wrap.children[n - 1] && wrap.children[n - 1].tagName === 'BUTTON') wrap.children[n - 1].click(); });
  UI.open(el, { modal: true, replace: false, onBack: () => {} });
};

/* ---------- relic choice after a boss ---------- */
UI.relicChoice = function () {
  const rng = G.run.rng, picks = [];
  for (let k = 0; k < 3; k++) { const id = randomRelic(rng, picks); if (id) picks.push(id); }
  if (!picks.length) { G.p.gold += 100; toast('+100 gold'); return; }
  const wrap = h('div', { class: 'choices' });
  const el = h('div', { class: 'modal' }, h('div', { style: { display: 'grid', gap: '16px', justifyItems: 'center', width: 'min(100%, 980px)' } },
    h('div', { class: 'lv-head' }, h('b', {}, 'Choose a Relic'), h('small', {}, 'It stays with you until the end of the run')), wrap));
  picks.forEach((id, i) => {
    const card = h('button', { class: 'card r-relic', type: 'button', 'data-autofocus': i === 0 ? true : null, onclick: () => { UI.close(el); gainRelic(G.p, id); } });
    card.innerHTML = relicCardHTML(id).replace(/^<div class="card r-relic">/, '').replace(/<\/div>$/, '');
    wrap.append(card);
  });
  UI.open(el, { modal: true, replace: false, onBack: () => {} });
};

/* ---------- ability replacement ---------- */
UI.replaceAbility = function (it, onTake) {
  const p = G.p;
  const wrap = h('div', { class: 'choices' });
  const el = h('div', { class: 'modal' }, h('div', { style: { display: 'grid', gap: '16px', justifyItems: 'center', width: 'min(100%, 980px)' } },
    h('div', { class: 'lv-head' }, h('b', {}, ABILITY[it.id].name), h('small', {}, 'Forget one ability to learn it')), wrap,
    h('div', { class: 'row' }, btn('Leave it', () => UI.close(el), '', { 'data-autofocus': true }))));
  p.abilities.forEach((a, i) => {
    const card = h('button', { class: 'card', type: 'button', style: { '--rc': 'var(--arcane)' }, onclick: () => {
      if (it.shop && it.refund) { if (p.gold < it.price) { toast('Not enough gold'); return; } p.gold -= it.price; }
      onTake(); p.abilities[i] = { id: it.id, lvl: 1, cd: 0, max: 1 };
      spawnItem({ type: 'ability', id: a.id }, p.x, p.y + 10);
      Sound.play('magic'); UI.close(el);
    } });
    card.innerHTML = abilityCardHTML(a.id, a.lvl, `Replace with ${ABILITY[it.id].name}`).replace(/^<div class="card"[^>]*>/, '').replace(/<\/div>$/, '');
    wrap.append(card);
  });
  UI.open(el, { modal: true, replace: false });
};

/* ---------- the forge ---------- */
UI.forge = function () {
  const p = G.p;
  const draw = () => {
    const w = p.weapon;
    const up = Math.round((45 + 35 * (w.lvl || 0) + 8 * G.fl.idx) * p.stats.shopMul), re = Math.round((30 + 10 * G.fl.idx) * p.stats.shopMul);
    const panel = h('div', { class: 'panel' },
      h('h2', {}, 'The Forge'), h('p', {}, 'The smith works on whatever is in your hand. Gold only, no favors.'),
      h('div', { html: weaponCardHTML(w) }),
      h('div', { class: 'menu', style: { width: '100%' } },
        btn(h('span', {}, `Temper to +${(w.lvl || 0) + 1} (+12% damage) · `, h('span', { class: 'cost' }, `${up}g`)), () => { if ((w.lvl || 0) >= 5) { toast('It cannot take more'); return; } if (p.gold < up) { Sound.play('deny'); toast('Not enough gold'); return; } p.gold -= up; w.lvl = (w.lvl || 0) + 1; Sound.play('slam', { p: 1.6, v: 0.6 }); burst(p.x, p.y - 10, 12, ['#ffd08a', '#ff7a2a'], { glow: true, smax: 80 }); redraw(); }, 'primary', { 'data-autofocus': true, disabled: (w.lvl || 0) >= 5 ? true : null }),
        w.rar !== 'common' ? btn(h('span', {}, 'Reforge its traits · ', h('span', { class: 'cost' }, `${re}g`)), () => { if (p.gold < re) { Sound.play('deny'); toast('Not enough gold'); return; } p.gold -= re; const nw = makeWeapon(w.id, w.rar, G.run.rng); w.affixes = nw.affixes; w.legend = nw.legend; recalcStats(p); Sound.play('slam', { p: 1.3, v: 0.5 }); redraw(); }) : null,
        p.weapons[1] ? btn('Work on your other weapon', () => { swapWeapon(p); redraw(); }) : null,
        btn('Leave', () => UI.close(el))));
    return panel;
  };
  const el = h('div', { class: 'modal' });
  const redraw = () => { el.innerHTML = ''; el.append(draw()); UI.focusFirst(el); };
  el.append(draw());
  UI.open(el, { modal: true, replace: false });
};

/* ---------- final stairs ---------- */
UI.finalChoice = function () {
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel' },
    h('h2', {}, 'The Cinder King is dead'),
    h('p', {}, 'Climb out with your victory, or keep going down. The deep loops back to the Ossuary, twice as cruel, and every floor pays more embers.'),
    h('div', { class: 'menu', style: { width: '100%' } },
      btn('Climb out victorious', () => { UI.close(el); endRun(true); }, 'primary', { 'data-autofocus': true }),
      btn('Descend endlessly', () => { UI.close(el); G.run.endless = true; G.run.won = false; CD.save.stats.wins = (CD.save.stats.wins || 0) + 1; CD.save.heatUnlocked = Math.max(CD.save.heatUnlocked || 0, Math.min(MAX_HEAT, G.run.heat + 1)); persist(); fadeTransition(() => goFloor(G.run.floorIdx + 1)); }))));
  UI.open(el, { modal: true, replace: false });
};

/* ---------- end of run ---------- */
UI.runSummary = function (won) {
  const run = G.run, p = G.p;
  setMode('menu');
  const stat = (k, v) => h('div', {}, k, h('b', {}, String(v)));
  const el = h('div', { class: 'screen dim center' },
    h('div', { class: 'lv-head' }, h('b', { style: { color: won ? 'var(--gold)' : 'var(--bone)' } }, won ? 'Victory' : 'You fell'), h('small', {}, won ? `The ${CLASS[run.cls].name} climbs out of the deep` : `${CLASS[run.cls].name} · ${floorLabel(run.floorIdx)} · level ${p ? p.level : 1}`)),
    h('div', { class: 'panel sum' },
      h('div', { class: 'statgrid' }, stat('Time', fmtTime(run.t)), stat('Floor', run.floorIdx + 1), stat('Foes slain', run.stats.kills), stat('Bosses', run.stats.bosses), stat('Damage dealt', Math.round(run.stats.dmgDealt)), stat('Damage taken', Math.round(run.stats.dmgTaken)), stat('Gold found', run.stats.gold), stat('Rooms cleared', run.stats.cleared)),
      h('div', { class: 'row' }, h('span', { class: 'embers' }, h('img', { alt: '', src: iconURL(miscIcon('ember'), 2) }), `+${run.emberTotal} embers`), h('span', { class: 'foot' }, `You now hold ${CD.save.embers}`)),
      won && run.heat < MAX_HEAT ? h('p', {}, `Heat ${Math.min(MAX_HEAT, run.heat + 1)} is unlocked. Harder descents pay 10% more embers per level.`) : null),
    h('div', { class: 'menu' },
      btn('Descend again', () => { UI.clear(); fadeTransition(() => startRun({ cls: run.cls, heat: run.heat, sheetId: run.sheetId })); }, 'primary', { 'data-autofocus': true }),
      btn('Camp', () => UI.camp()),
      btn('Title', () => UI.title())));
  UI.open(el, {});
};

/* ---------- character sheets ---------- */
const SHEET_ORDERS = {
  dlru: { name: 'Down, Left, Right, Up', rows: { down: 0, left: 1, right: 2, up: 3 } },
  uldr: { name: 'Up, Left, Down, Right (LPC)', rows: { up: 0, left: 1, down: 2, right: 3 } },
  dulr: { name: 'Down, Up, Left, Right', rows: { down: 0, up: 1, left: 2, right: 3 } },
  drul: { name: 'Down, Right, Up, Left', rows: { down: 0, right: 1, up: 2, left: 3 } },
};
function guessLayout(w, h0) {
  if (w === 832 && h0 === 1344) return { cols: 13, rows: 21, order: 'uldr', rowOffset: 8, frames: [1, 2, 3, 4, 5, 6, 7, 8] };
  const r = w / h0;
  if (Math.abs(r - 0.75) < 0.05) return { cols: 3, rows: 4, order: 'dlru', rowOffset: 0 };
  if (Math.abs(r - 1) < 0.05 && w >= 64) return { cols: 4, rows: 4, order: 'dlru', rowOffset: 0 };
  if (Math.abs(r - 3) < 0.1) return { cols: 3, rows: 1, order: 'dlru', rowOffset: 0 };
  if (Math.abs(r - 4) < 0.1) return { cols: 4, rows: 1, order: 'dlru', rowOffset: 0 };
  return { cols: 1, rows: 1, order: 'dlru', rowOffset: 0 };
}
function loadSheet(s) {
  if (!s || !s.data) return null;
  const img = new Image();
  const sheet = { ...s, img, ready: false, frames: {} };
  img.onload = () => { sheet.ready = true; };
  img.src = s.data;
  return sheet;
}
function sheetFrame(sheet, p, fi) {
  if (!sheet || !sheet.ready) { const set = heroSprites(p.look, p.cls + (p.dyeKey ? ':' + p.dyeKey : '')); return set[p.view][fi]; }
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
  const dir = Math.abs(ca) > Math.abs(sa) * 1.1 ? (ca > 0 ? 'right' : 'left') : sa > 0 ? 'down' : 'up';
  const rows = sheet.rows || 1, cols = sheet.cols || 1;
  const order = SHEET_ORDERS[sheet.order] || SHEET_ORDERS.dlru;
  let row = rows >= 4 ? (sheet.rowOffset || 0) + order.rows[dir] : 0;
  row = clamp(row, 0, rows - 1);
  const frameList = sheet.framesList || (cols === 3 ? [1, 0, 1, 2] : Array.from({ length: cols }, (_, i) => i));
  let col;
  if (fi === 0) col = cols === 3 ? 1 : frameList[0];
  else col = frameList[Math.floor(p.anim * 1.2) % frameList.length];
  const key = row * 100 + col;
  if (sheet.frames[key]) return sheet.frames[key];
  const fw = sheet.img.naturalWidth / cols, fh = sheet.img.naturalHeight / rows;
  const target = 26, sc = Math.min(1, target / fh, 30 / fw);
  const c = mkCanvas(Math.max(1, Math.round(fw * sc)), Math.max(1, Math.round(fh * sc))), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(sheet.img, col * fw, row * fh, fw, fh, 0, 0, c.width, c.height);
  // trim empty rows at the bottom so feet sit on the ground
  let bottom = c.height - 1;
  try { const d = g.getImageData(0, 0, c.width, c.height).data; outer: for (; bottom > 0; bottom--) { for (let x = 0; x < c.width; x++) if (d[(bottom * c.width + x) * 4 + 3] > 20) break outer; } } catch (e) { /* tainted canvas: keep as is */ }
  const sp = makeSprite(c, c.width / 2, bottom);
  sp.noFlip = rows >= 4;
  sheet.frames[key] = sp;
  return sp;
}
function sheetDrop(onDone) {
  const prev = mkCanvas(32, 32);
  const status = h('small', {}, 'PNG sprite sheets: a single image, a 3×4 or 4×4 walk sheet, or an LPC sheet. Drop one here or choose a file.');
  const cfg = h('div', { class: 'sheet-cfg', hidden: true });
  let cur = null, timer = 0;
  const input = h('input', { type: 'file', accept: 'image/png,image/gif,image/webp,image/jpeg', id: 'sheet-file', style: { display: 'none' }, onchange: (e) => e.target.files[0] && readFile(e.target.files[0]) });
  const box = h('div', { class: 'drop' }, prev, h('div', {}, h('b', {}, 'Play as your own character'), status, cfg,
    h('div', { class: 'row', style: { justifyContent: 'flex-start', marginTop: '6px' } }, btn('Choose a sheet', () => input.click(), 'small'), input)));
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('over'); });
  box.addEventListener('dragleave', () => box.classList.remove('over'));
  box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) readFile(f); });
  const animate = () => {
    if (!cur || !box.isConnected) return;
    const g = prev.getContext('2d'); g.clearRect(0, 0, 32, 32);
    const fake = { aim: Math.PI / 2, anim: (performance.now() / 200), view: 'front', look: CLASS.knight.look, cls: 'knight' };
    const dirs = [Math.PI / 2, Math.PI, 0, -Math.PI / 2];
    fake.aim = dirs[Math.floor(performance.now() / 1600) % 4];
    const sp = sheetFrame(cur, fake, 1);
    if (sp) g.drawImage(sp.c, Math.round(16 - sp.ax), Math.round(30 - sp.ay));
    timer = requestAnimationFrame(animate);
  };
  const readFile = (file) => {
    if (!/^image\//.test(file.type)) { status.textContent = 'That file is not an image.'; return; }
    if (file.size > 4 * 1024 * 1024) { status.textContent = 'That image is over 4 MB. Try a smaller sheet.'; return; }
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const L = guessLayout(img.naturalWidth, img.naturalHeight);
        // shrink big sheets so they fit in a save
        let data = fr.result;
        const maxW = 1024;
        if (img.naturalWidth > maxW || data.length > 600000) {
          const k = Math.min(1, maxW / img.naturalWidth);
          const c = mkCanvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k)), g = c.getContext('2d');
          g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height); data = c.toDataURL('image/png');
        }
        const s = { id: 'sh' + Date.now().toString(36), name: file.name.replace(/\.[a-z]+$/i, '').slice(0, 24) || 'Hero', data, cols: L.cols, rows: L.rows, order: L.order, rowOffset: L.rowOffset, framesList: L.frames || null };
        cur = loadSheet(s);
        showCfg(s);
        status.textContent = `Read ${img.naturalWidth}×${img.naturalHeight}. It looks like ${L.cols} × ${L.rows} frames. Adjust if the preview walks oddly.`;
        cancelAnimationFrame(timer); animate();
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };
  const showCfg = (s) => {
    cfg.hidden = false; cfg.innerHTML = '';
    const num = (id, label, key, max) => h('label', { class: 'field' }, label, h('input', { id, type: 'number', min: 1, max, value: s[key], onchange: (e) => { s[key] = clamp(+e.target.value || 1, 1, max); s.framesList = null; cur = loadSheet(s); } }));
    cfg.append(
      h('label', { class: 'field' }, 'Name', h('input', { id: 'sheet-name', type: 'text', value: s.name, maxlength: 24, onchange: (e) => { s.name = e.target.value.slice(0, 24) || 'Hero'; } })),
      num('sheet-cols', 'Columns', 'cols', 32), num('sheet-rows', 'Rows', 'rows', 64),
      h('label', { class: 'field' }, 'Row order', h('select', { id: 'sheet-order', onchange: (e) => { s.order = e.target.value; cur = loadSheet(s); } }, ...Object.entries(SHEET_ORDERS).map(([k, v]) => h('option', { value: k, selected: s.order === k ? true : null }, v.name)))),
      btn('Save this hero', () => {
        const save = CD.save;
        save.sheets = (save.sheets || []).filter((x) => x.id !== s.id);
        save.sheets.unshift({ id: s.id, name: s.name, data: s.data, cols: s.cols, rows: s.rows, order: s.order, rowOffset: s.rowOffset, framesList: s.framesList });
        save.sheets = save.sheets.slice(0, 4);
        save.lastSheet = s.id;
        persist(); toast(`${s.name} is ready. Pick it under Look.`);
        cancelAnimationFrame(timer);
        onDone && onDone();
      }, 'small primary'));
  };
  return box;
}

