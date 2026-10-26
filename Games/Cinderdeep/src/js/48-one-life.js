/* ============================================================
   Cinderdeep — one life each. Every game begins with a new
   descent, and every descent is made by a character of its own:
   a named hero or beast who keeps their talents from one descent
   to the next; levels, gear, passives and skills belong to the run.
   Death is permanent, below or above. Ten descents in one run (reaching floor 11) open the
   world above to that character.
   ============================================================ */
const REALM_DEPTH = 10;
const CHAR_NAMES = {
  hero: ['Aldric', 'Brina', 'Cass', 'Dorian', 'Edda', 'Fenn', 'Greta', 'Hale', 'Isolde', 'Jory', 'Kael', 'Lysa', 'Maren', 'Nils', 'Orla', 'Piers', 'Quill', 'Rowan', 'Sable', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Yara', 'Zeke'],
  beast: ['Ash', 'Bramble', 'Cinder', 'Dusk', 'Ember', 'Frost', 'Gale', 'Husk', 'Ivy', 'Jinx', 'Knot', 'Lumen', 'Moss', 'Nettle', 'Onyx', 'Pip', 'Rook', 'Spark', 'Thistle', 'Umber', 'Volt', 'Whisp'],
};
function charName(cls) {
  const pool = CHAR_NAMES[CLASS[cls] && CLASS[cls].beast ? 'beast' : 'hero'], used = new Set(realmStore().chars.map((c) => c.name));
  const free = pool.filter((n) => !used.has(n));
  return free.length ? rndPick(free) : `${rndPick(pool)} ${['II', 'III', 'IV', 'V'][Math.floor(Math.random() * 4)]}`;
}
const _newRealmCharLife = newRealmChar;
newRealmChar = function (cls, sheetId) {
  const ch = _newRealmCharLife(cls, sheetId);
  return Object.assign(ch, { name: charName(cls), realm: false, deep: 0, descents: 0, tree: { xp: 0, alloc: [] }, sk: { alloc: [] } });
};
const charById = (id) => (id ? realmStore().chars.find((c) => c.id === id) : null);
const charLabel = (ch) => `${ch.name || (CLASS[ch.cls] ? CLASS[ch.cls].name : 'Hero')}`;
// heroes who were already walking the Realm before this keep the world they had
function charsMigrate() {
  for (const ch of realmStore().chars) {
    if (ch.realm === undefined) ch.realm = true;
    if (!ch.name) ch.name = charName(ch.cls);
    if (!ch.tree) ch.tree = JSON.parse(JSON.stringify((CD.save.tree && CD.save.tree[ch.cls]) || { xp: 0, alloc: [] }));
    if (!ch.sk) ch.sk = { alloc: [] };
    ch.deep = ch.deep || 0; ch.descents = ch.descents || 0;
  }
  CD.save.fallen = Array.isArray(CD.save.fallen) ? CD.save.fallen : [];
}
// whose life is in play right now
function curChar() {
  if (typeof W !== 'undefined' && W.on && W.ch) return W.ch;
  if (G.run && G.run.charId) return charById(G.run.charId);
  return CD.focusChar ? charById(CD.focusChar) : null;
}

/* ---------- talents belong to the character, not the class ---------- */

/* ---------- a descent made by a character ---------- */
const _startRunLife = startRun;
startRun = function (o) {
  let ch = o.charId ? charById(o.charId) : null;
  if (!ch && !o.demo) {
    // every new game is a new character
    ch = newRealmChar(o.cls, o.sheetId); const st = realmStore(); st.chars.push(ch); st.last = st.chars.length - 1;
  }
  if (ch) CD.focusChar = ch.id;
  _startRunLife(o);
  if (!ch || !G.run) return;
  G.run.charId = ch.id; ch.descents = (ch.descents || 0) + 1;
  // every descent starts from nothing but the character's talents: levels, gear, passives and skills are the run's
  recalcStats(G.p); G.p.hp = G.p.maxHp;
  banner(charLabel(ch), `${CLASS[ch.cls] ? CLASS[ch.cls].name : ''} · descent ${ch.descents}`, 2.4);
  persist();
};
hook('saveRun', (c, run) => { if (run && run.charId) c.charId = run.charId; });
hook('loadRun', (c, run) => { if (c && c.charId && run && !run.realm) run.charId = c.charId; });
// ten descents in one run open the world
hook('onFloor', (idx) => {
  const ch = G.run && G.run.charId && !(typeof W !== 'undefined' && W.on) ? charById(G.run.charId) : null;
  if (!ch) return;
  ch.deep = Math.max(ch.deep || 0, idx);
  if (idx >= REALM_DEPTH && !ch.realm) {
    ch.realm = true;
    later(2.8, () => { banner('The world opens', `${charLabel(ch)} may now walk the Realm above`, 3.4); Sound.play('ascend'); });
  }
  persist();
});
// a life ends for good
function charFall(ch, where) {
  if (!ch || ch.fell) return;
  ch.fell = true;
  const st = realmStore(), p = G.p;
  st.chars = st.chars.filter((c) => c !== ch && c.id !== ch.id);
  const lvl = p && !p.demo ? p.level : ch.snap && ch.snap.p ? ch.snap.p.level : 1;
  CD.save.fallen.unshift({ name: charLabel(ch), cls: ch.cls, title: p && typeof ascTitle === 'function' ? ascTitle(p) : '', level: lvl, deep: (ch.deep || 0) + 1, descents: ch.descents || 0, where, date: Date.now() });
  CD.save.fallen = CD.save.fallen.slice(0, 40);
  if (CD.focusChar === ch.id) CD.focusChar = null;
  // the descent they were on cannot be continued
  if (CD.save.run && CD.save.run.charId === ch.id) CD.save.run = null;
  persist(true);
}
const _playerDieLife = playerDie;
playerDie = function () {
  const p = G.p, ch = curChar(), first = p && !p.dead;
  _playerDieLife();
  if (!first || !ch) return;
  const where = typeof W !== 'undefined' && W.on ? (W.inInst && W.inst ? W.inst.name : W.Z ? W.Z.b.name : 'the Realm') : `${G.fl.info.act.name}, floor ${G.run.floorIdx + 1}`;
  charFall(ch, where);
};
const _endRunLife = endRun;
endRun = function (won) {
  const run = G.run, ch = run && run.charId && !run.realm ? charById(run.charId) : null;
  // a character who climbs out, or walks away, lives on with their talents; the run's gains stay in the run
  if (ch && won) ch.wins = (ch.wins || 0) + 1;
  return _endRunLife(won);
};
// above, there is no waking at home
UI.realmDeath = function () {
  const last = CD.save.fallen[0];
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel' },
    h('h2', {}, 'Fallen for good'),
    h('p', {}, last ? `${last.name}${last.title ? `, ${last.title},` : ''} fell in ${last.where} at level ${last.level}. Their name is kept among the fallen.` : 'Your character has fallen.'),
    h('div', { class: 'menu', style: { width: '100%' } }, btn('Return', () => { UI.close(el); leaveRealm(true); }, 'primary', { 'data-autofocus': true }))));
  UI.open(el, { modal: true, replace: false, onBack: () => {} });
};

/* ---------- the roster: every living character, and the fallen ---------- */
UI.realm = function () {
  charsMigrate();
  const st = realmStore(), active = CD.save.run;
  const list = h('div', { class: 'rchars' });
  st.chars.forEach((ch, i) => {
    const tl = talentLevelOf(charTalentXp(ch)).lvl, rl = ch.snap && ch.snap.p ? ch.snap.p.level : 0;
    const cls = CLASS[ch.cls] ? CLASS[ch.cls].name : ch.cls, title = cls;
    const inRun = active && active.charId === ch.id;
    const go = inRun ? btn('Continue descent', () => continueRun(), 'primary') : btn('Descend', () => { UI.clear(); fadeTransition(() => startRun({ cls: ch.cls, sheetId: ch.sheetId, charId: ch.id })); }, ch.realm ? '' : 'primary', { disabled: !!active && !inRun });
    const up = ch.realm ? btn('Enter the Realm', () => enterRealm(i), 'primary', { 'data-autofocus': i === st.last ? true : null, disabled: inRun }) : null;
    list.append(h('div', { class: 'rchar' }, realmCharPortrait(ch), h('div', {},
      h('b', {}, `${charLabel(ch)} · ${title}`),
      h('small', { style: { display: 'block' } }, `Talent Level ${tl} · ${ch.descents || 0} descent${ch.descents === 1 ? '' : 's'} · deepest floor ${(ch.deep || 0) + 1}`),
      h('small', { style: { display: 'block' } }, ch.realm ? `The Realm is open${rl ? ` · level ${rl} above` : ''} · ${BIOME[ch.zone] ? BIOME[ch.zone].name : 'Verdant Meadows'}` : `Reach floor ${REALM_DEPTH + 1} in one descent to open the Realm`)),
      h('div', { class: 'row' }, go, up, btn('Talents', () => { CD.focusChar = ch.id; UI.tree(ch.cls, { back: () => UI.realm() }); }, 'small'),
        null)));
  });
  const fallen = CD.save.fallen.slice(0, 12).map((f) => h('li', {}, h('b', {}, f.name), ` ${f.title || (CLASS[f.cls] ? CLASS[f.cls].name : '')}, level ${f.level}, fell in ${f.where}`));
  const el = h('div', { class: 'screen dim' },
    h('div', { class: 'topbar' }, h('h2', {}, 'Your characters'), emberChip()),
    h('div', { class: 'panel wide' },
      h('p', {}, `Every game begins with a new descent. Each descent starts at level 1: levels, gear and the skill tree belong to the run. Talents placed on the tree last for everyone, always. DNA belongs to the character: at the start of each later descent they keep it, losing half their points or more, or sacrifice it to Chaos. Death is permanent, below and above. Reach floor ${REALM_DEPTH + 1} in a single descent and the Realm opens to that character.`),
      st.chars.length ? list : h('p', {}, 'No one is alive. Begin a new descent.'),
      h('div', { class: 'row' }, btn('New descent', () => UI.heroes(), st.chars.length ? '' : 'primary', st.chars.length ? {} : { 'data-autofocus': true }))),
    fallen.length ? h('div', { class: 'panel wide' }, h('h3', {}, 'The fallen'), h('ul', { class: 'fallen' }, ...fallen)) : null,
    h('div', { class: 'row' }, btn('Back', () => UI.title())));
  UI.open(el, { onBack: () => UI.title() });
};
// no one walks into the Realm without having gone down first
UI.realmNew = function () { UI.heroes(); };
// a new descent is a new character: no one else's levels on the cards
const _heroesLife = UI.heroes;
UI.heroes = function (st) { CD.focusChar = null; return _heroesLife(st); };
const _titleLife = UI.title;
UI.title = function () {
  charsMigrate();
  _titleLife();
  const el = UI.top(), menu = el && el.querySelector('.menu');
  if (!menu) return;
  const kids = [...menu.children], chars = kids.find((b) => /^Enter the Realm/.test(b.textContent)), desc = kids.find((b) => b.textContent === 'New descent');
  if (chars) { chars.textContent = `Your characters (${realmStore().chars.length})`; chars.classList.remove('primary'); chars.removeAttribute('data-autofocus'); if (desc) desc.after(chars); }
  // talents now belong to each character: find them on the roster
  for (const b of kids) if (b.textContent === 'Passive trees') b.replaceWith(btn('Talent tree', () => { CD.focusChar = null; UI.tree(null, { layer: 'shared', onClose: () => UI.title() }); }));
  if (desc && !CD.save.run) { desc.classList.add('primary'); desc.setAttribute('data-autofocus', ''); }
};
CD.chars = () => ({ alive: realmStore().chars.map((c) => ({ id: c.id, name: c.name, cls: c.cls, realm: c.realm, deep: c.deep, descents: c.descents, lvl: c.snap && c.snap.p ? c.snap.p.level : 1 })), fallen: CD.save.fallen.length });

