/* ============================================================
   Cinderdeep — screens for the big upgrade: hero and beast
   select with Chaos Mode, class levels and the passive tree,
   a richer HUD, forge evolutions, souls and nemeses in the run
   summary, records with feats, and a new guide
   ============================================================ */
const soulIcon = () => icon('m:soul2', (p) => {
  p.disc(8, 9, 4, '#58c8f0'); p.disc(8, 8, 3, '#9ff6ff'); p.disc(7, 7, 1.3, '#ffffff');
  p.px(8, 4, '#9ff6ff'); p.px(9, 3, '#9ff6ff'); p.px(9, 2, '#58c8f0'); p.px(7, 4, '#58c8f0');
  p.px(5, 13, '#58c8f0'); p.px(11, 13, '#58c8f0'); p.px(8, 14, '#2a88c8');
});
const chaosIcon = () => icon('m:chaos2', (p) => {
  const cols = ['#ff4ad0', '#c873ff', '#58aaff', '#7dff9a', '#fff27a', '#ffb35e'];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; p.line(8, 8, Math.round(8 + Math.cos(a) * 6), Math.round(8 + Math.sin(a) * 6), cols[i]); }
  p.disc(8, 8, 2, '#ffffff');
});
const isBeastCls = (id) => !!(CLASS[id] && CLASS[id].beast);
function classPortrait(id, big) {
  if (isBeastCls(id)) { const cv = formPortrait(id, 30); cv.style.width = big ? '90px' : '60px'; cv.style.height = big ? '90px' : '60px'; return cv; }
  const c = CLASS[id], cv = mkCanvas(24, 24), sp = heroSprites(c.look, c.id).front[0];
  cv.getContext('2d').drawImage(sp.c, 12 - sp.ax, 23 - sp.ay);
  return cv;
}
function classLvlHTML(cls) {
  const L = classLevelInfo(cls);
  return `Talent Lv ${L.lvl}${L.free ? ` · ${L.free} point${L.free === 1 ? '' : 's'}` : ''}`;
}
function nemesisSummary() {
  const list = CD.save.nemeses || [];
  if (!list.length) return null;
  const souls = list.reduce((a, n) => a + n.souls, 0), top = [...list].sort((a, b) => b.chaos - a.chaos)[0];
  return `${list.length} Chaos Beast${list.length > 1 ? 's hold' : ' holds'} ${souls} of your souls. The worst is ${nemTitle(top)} (chaos ×${top.chaos}), lurking in ${ACTS[top.act % ACTS.length].name}.`;
}

/* ---------- HUD: combos, omens, evolution, beast xp ---------- */
const _updateHUD = updateHUD;
updateHUD = function (dt) {
  _updateHUD(dt);
  const p = G.p, run = G.run;
  if (!p || !run) return;
  const C = G.combo, ce = $('combo');
  if (C && C.n >= 2) {
    if (ce.hidden) ce.hidden = false;
    setText('combo-n', '×' + C.n);
    let tier = 'combo'; for (const [n, name] of COMBO_TIERS) if (C.n >= n) tier = name;
    setText('combo-t', tier);
    setW($('combo-bar'), 'cbar', clamp(C.t / comboWindow(), 0, 1));
  } else if (!ce.hidden) ce.hidden = true;
  const om = (run.omens || []).map((id) => OMEN[id]).filter(Boolean);
  setHTML($('omens'), 'omens', (run.chaos ? `<span style="color:#ff4ad0" title="Chaos Mode">Chaos</span>` : '') + om.map((o) => `<span style="color:${o.color || '#ff8ad8'}" title="${esc(o.desc)}">${esc(o.name)}</span>`).join(''));
  HUD.evoT = (HUD.evoT || 0) - dt;
  if (HUD.evoT <= 0) {
    HUD.evoT = 0.5;
    let t = '';
    const F = formOf(p);
    const st = typeof ascStage === 'function' ? ascStage(p) : 0;
    const ascTxt = st ? `${ascTitle(p)} · ${st}/${ASC_MAX}${st < ASC_MAX ? ` · next at ${ascLevelFor(p, st + 1)}` : ''}` : `Evolves at level ${ascLevelFor(p, 1)}`;
    if (F) t = p.evolvePending ? 'Ready to evolve' : `${F.stage < 3 ? `Form at ${evoLevel(F.stage)}` : 'Final form'} · ${ascTxt}`;
    else t = `${ascTxt}${p.muts && p.muts.length ? ` · ${p.muts.length} mutation${p.muts.length > 1 ? 's' : ''}` : ''}`;
    const ev = !p.beast && typeof weaponEvoInfo === 'function' ? weaponEvoInfo(p, p.weapon) : null;
    if (ev && ev.ok) t += ' · weapon can evolve at a forge';
    if (p.ascPending && typeof ascDue === 'function' && ascDue(p) > 0) t = `Evolution ready · ${t}`;
    if (p.skFree > 0) t = `${p.skFree} skill point${p.skFree === 1 ? '' : 's'} · ${t}`;
    if (p.dnaFree > 0) t = `${p.dnaFree} DNA · ${t}`;
    if (!G.demo) t = `${classLvlHTML(run.cls)} · ${t}`;
    const el = $('evo-tag');
    el.hidden = false; setText('evo-tag', t);
  }
  const xb = $('xpbar');
  if (xb.classList.contains('beast') !== !!p.beast) xb.classList.toggle('beast', !!p.beast);
  if (CD.ctlEdit) $('tb-use').hidden = false;
};

/* ---------- title ---------- */
UI.title = function () {
  setMode('title');
  startDemo();
  const save = CD.save, has = !!save.run;
  const runName = has ? (save.run.ext && save.run.ext.form && FORMS[save.run.ext.form] ? FORMS[save.run.ext.form].name : CLASS[save.run.cls] ? CLASS[save.run.cls].name : 'Hero') : '';
  const nem = nemesisSummary(), feats = Object.keys(save.feats || {}).length;
  const el = h('div', { class: 'screen center title' }, h('div', { class: 'tgrid' },
    h('div', { class: 'ttl-box', style: { display: 'grid', gap: '6px', justifyItems: 'center', marginBottom: '6px' } },
      h('h1', { class: 'ttl' }, 'Cinderdeep'),
      h('p', { class: 'ttl-sub' }, 'Twelve floors down to the Cinder King')),
    h('div', { class: 'menu' },
      has ? btn(`Continue · ${runName}, ${floorLabel(save.run.floorIdx)}${save.run.chaos ? ' · Chaos' : ''}`, () => continueRun(), 'primary', { 'data-autofocus': true }) : null,
      btn('New descent', () => UI.heroes(), has ? '' : 'primary', has ? {} : { 'data-autofocus': true }),
      btn('Passive trees', () => UI.camp('trees')),
      btn('Camp · spend embers', () => UI.camp()),
      btn('Records and feats', () => UI.records()),
      btn('Settings', () => UI.settings(() => UI.title())),
      btn('How to play', () => UI.help(() => UI.title()))),
    h('div', { class: 'row' }, emberChip()),
    nem ? h('p', { class: 'nem-note' }, nem) : null,
    h('p', { class: 'foot' }, `${save.stats.runs || 0} descents · ${save.stats.wins || 0} victories · deepest floor ${save.stats.bestFloor || 0} · ${feats} of ${FEATS.length} feats`),
    h('p', { class: 'foot', id: 'save-note' }, saveNote()),
    h('p', { class: 'foot' }, `Version ${VERSION}`),
  ));
  UI.open(el, {});
};

/* ---------- hero and beast select ---------- */
UI.heroes = function (st = {}) {
  const save = CD.save;
  const owned = (id) => save.unlocks.classes.includes(id);
  let sel = st.sel || (save.lastClass && CLASS[save.lastClass] ? save.lastClass : 'knight');
  let tab = st.tab || (isBeastCls(sel) ? 'beasts' : 'heroes');
  let chaos = st.chaos ?? !!save.lastChaos;
  let heat = st.heat ?? Math.min(save.lastHeat || 0, save.heatUnlocked || 0);
  let lookSheet = st.look ?? (save.lastSheet || '');
  const playable = (id) => owned(id) || chaos;
  const list = () => CLASSES.filter((c) => !!c.beast === (tab === 'beasts'));
  if (isBeastCls(sel) !== (tab === 'beasts')) sel = (list().find((c) => owned(c.id)) || list()[0]).id;
  const state = () => ({ sel, tab, chaos, heat, look: lookSheet });
  const grid = h('div', { class: 'heroes compact' });
  const detail = h('div', { class: 'panel wide', style: { gap: '12px' } });
  const sheetBox = h('div', { style: { width: 'min(100%, 980px)', display: 'grid' } }, sheetDrop(() => UI.heroes(state())));
  const go = btn('Begin the descent', () => begin(), 'primary');
  const begin = () => {
    if (!playable(sel)) return;
    save.lastClass = sel; save.lastHeat = heat; save.lastSheet = lookSheet; save.lastChaos = chaos;
    const seedIn = $('seed-in'), seed = seedIn && seedIn.value.trim() ? seedIn.value.trim() : null;
    UI.clear();
    fadeTransition(() => startRun({ cls: sel, heat, seed, sheetId: isBeastCls(sel) ? null : lookSheet || null, chaos }));
  };
  const tabs = h('div', { class: 'herotabs', role: 'tablist' });
  const drawTabs = () => {
    tabs.innerHTML = '';
    for (const [id, label] of [['heroes', `Heroes (${CLASSES.filter((c) => !c.beast).length})`], ['beasts', `Beasts (${BEASTS.length})`]]) {
      tabs.append(btn(label, () => { if (tab === id) return; tab = id; sel = (list().find((c) => owned(c.id)) || list()[0]).id; draw(); }, 'small', { role: 'tab', 'aria-selected': tab === id ? 'true' : 'false' }));
    }
  };
  const portrait = (id, px) => { const cv = classPortrait(id, true); cv.style.width = px + 'px'; cv.style.height = px + 'px'; return cv; };
  const draw = () => {
    drawTabs();
    grid.innerHTML = '';
    for (const c of list()) {
      const ok = owned(c.id);
      const card = h('button', { class: `hero ${sel === c.id ? 'sel' : ''} ${ok || chaos ? '' : 'locked'}`, type: 'button', 'aria-pressed': sel === c.id ? 'true' : 'false', 'data-autofocus': sel === c.id ? true : null, title: c.blurb,
        onclick: () => { Sound.play('ui'); sel = c.id; draw(); } },
        portrait(c.id, 72), h('b', {}, c.name), h('span', { class: 'clv' }, classLvlHTML(c.id)),
        ok ? null : h('span', { class: 'lock' }, chaos ? 'Chaos Mode' : `${c.cost} embers`));
      grid.append(card);
    }
    const c = CLASS[sel], L = classLevelInfo(sel);
    const w = makeWeapon(c.weapon, c.beast ? 'natural' : 'common', new RNG(1));
    const wc = h('div', { html: weaponCardHTML(w) }), ac = h('div', { html: abilityCardHTML(c.ability, 1) });
    const evo = h('div', { class: 'evostrip' });
    if (c.beast) {
      const B = BEAST[c.id], fig = (id, lvl) => h('figure', {}, (() => { const cv = formPortrait(id, 42); cv.style.width = '84px'; cv.style.height = '84px'; return cv; })(), h('figcaption', {}, FORMS[id].name, h('br'), h('small', { style: { color: 'var(--bone-3)' } }, lvl)));
      const shift = (save.meta.bond || 0) + (treeHas(sel, 'primal') ? 2 : 0);
      const [s1, s2, s3] = B.stages;
      evo.append(fig(s1, 'Start'), h('span', { class: 'arrow' }, '›'), fig(s2, `Level ${5 - shift}`), h('span', { class: 'arrow' }, '›'),
        h('div', { class: 'or' }, fig(s3[0], `Level ${12 - shift}`), h('i', {}, 'or'), fig(s3[1], `Level ${12 - shift}`)));
    } else {
      // every five levels it evolves into whatever its skill and talent trees make of it
      const P0 = PATH[skNative(sel)];
      evo.append(h('figure', {}, portrait(sel, 64), h('figcaption', {}, c.name)), h('span', { class: 'arrow' }, '›'),
        h('figure', {}, (() => { const cv = portrait(sel, 64); cv.style.filter = `drop-shadow(0 0 6px ${P0.col})`; return cv; })(), h('figcaption', {}, `Evolves every 5 levels`, h('br'), h('small', { style: { color: P0.col } }, `Born to ${P0.name.toLowerCase()} · 8 paths, 28 hybrids`))));
    }
    detail.innerHTML = '';
    detail.append(
      h('div', { class: 'hero-head' }, portrait(sel, 120),
        h('div', {}, h('h3', {}, c.name), h('p', {}, c.blurb),
          h('div', { class: 'meta' }, `${c.hp} health · ${WEAPON[c.weapon].name} · ${ABILITY[c.ability].name}${c.beast ? ` · ${BEAST[sel].element}` : ''}`),
          h('p', {}, h('b', { style: { color: 'var(--ember-2)', fontWeight: 400 } }, `${c.passive.name}: `), c.passive.desc))),
      evo,
      h('div', { class: 'duo' }, wc.firstElementChild, ac.firstElementChild),
      h('div', { class: 'duo', style: { alignItems: 'center' } },
        h('div', { class: 'lvlbar' }, h('span', {}, `Everyone's Talent Level `, h('b', { style: { color: '#9ff6ff', fontWeight: 400 } }, String(L.lvl)), L.free ? h('span', { style: { color: 'var(--gold)' } }, ` · ${L.free} point${L.free === 1 ? '' : 's'} to spend`) : null),
          h('i', {}, h('em', { style: { width: `${Math.round((L.into / L.need) * 100)}%` } })),
          h('small', {}, L.lvl >= MAX_CLASS_LEVEL ? 'Mastered' : `${L.into} / ${L.need} souls to level ${L.lvl + 1} · bank souls at DMT zones`)),
        h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn(L.free ? `Talent tree · ${L.free} to spend` : 'Talent tree', () => UI.tree(sel, { layer: 'shared', onClose: () => UI.heroes(state()) }), L.free ? 'small primary' : 'small'))));
    go.disabled = !playable(sel);
    go.textContent = playable(sel) ? `Descend as the ${c.name}${chaos ? ' · Chaos' : ''}` : `Locked · ${c.cost} embers in camp`;
    lookField.hidden = !!c.beast;
    sheetBox.hidden = !!c.beast;
  };
  const heatSel = h('select', { id: 'heat-sel', onchange: (e) => { heat = +e.target.value; } },
    ...Array.from({ length: (save.heatUnlocked || 0) + 1 }, (_, i) => h('option', { value: i, selected: i === heat ? true : null }, i === 0 ? 'Heat 0 · normal' : `Heat ${i} · ${HEAT[i]}`)));
  const sheets = save.sheets || [];
  const lookSel = h('select', { id: 'look-sel', onchange: (e) => { lookSheet = e.target.value; } },
    h('option', { value: '' }, 'The hero’s own look'), ...sheets.map((s) => h('option', { value: s.id, selected: s.id === lookSheet ? true : null }, `Sheet: ${s.name}`)));
  const lookField = h('label', { class: 'field' }, 'Look', lookSel);
  const chaosBox = h('label', { class: 'chaos-toggle' }, h('input', { type: 'checkbox', id: 'chaos-in', checked: chaos ? true : null, onchange: (e) => { chaos = e.target.checked; Sound.play(chaos ? 'chaos' : 'ui'); draw(); } }), h('img', { alt: '', src: iconURL(chaosIcon(), 2), style: { width: '24px', height: '24px', imageRendering: 'pixelated' } }), 'Chaos Mode');
  const nem = nemesisSummary();
  draw();
  const el = h('div', { class: 'screen dim' },
    h('div', { class: 'topbar' }, h('h2', {}, 'Choose who descends'), emberChip()),
    tabs, grid, detail,
    h('div', { class: 'panel wide', style: { gap: '10px' } },
      h('div', { class: 'row', style: { justifyContent: 'flex-start', alignItems: 'center' } }, chaosBox,
        h('span', { class: 'foot', style: { textAlign: 'left', flex: '1 1 260px' } }, 'Two omens on every floor, more elites, better luck, and every locked hero and beast is playable. Embers pay 75%.')),
      nem ? h('p', { class: 'nem-note', style: { textAlign: 'left' } }, nem) : null,
      h('div', { class: 'opts', style: { justifyContent: 'flex-start' } },
        (save.heatUnlocked || 0) > 0 ? h('label', { class: 'field' }, 'Heat', heatSel) : h('span', { class: 'foot' }, 'Win a run to unlock Heat.'),
        lookField,
        h('label', { class: 'field' }, 'Seed (optional)', h('input', { id: 'seed-in', type: 'text', maxlength: 24, placeholder: 'random', autocomplete: 'off', spellcheck: 'false' })),
        btn('Today’s seed', () => { const d = new Date(); $('seed-in').value = `daily-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; toast('Everyone who plays today gets the same floors'); }, 'small'))),
    sheetBox,
    h('div', { class: 'stickybar' }, btn('Back', () => UI.title()), go),
  );
  UI.open(el, { onBack: () => UI.title() });
};

/* ---------- camp ---------- */
UI.camp = function (tab = 'upgrades') {
  const save = CD.save;
  const tabs = [['upgrades', 'Upgrades'], ['heroes', 'Heroes'], ['beasts', 'Beasts'], ['trees', 'Talent trees'], ['armory', 'Armory'], ['library', 'Library']];
  const body = h('div', { class: 'grid-up' });
  const spend = (cost, fn) => { if ((save.embers || 0) < cost) { Sound.play('deny'); toast('Not enough embers'); return; } save.embers -= cost; fn(); Sound.play('buy'); persist(); UI.camp(tab); };
  const buyBtn = (label, cost, fn) => btn(h('span', {}, `${label} `, h('span', { class: 'cost' }, `${cost}`)), () => spend(cost, fn), 'small', { disabled: (save.embers || 0) < cost ? true : null });
  if (tab === 'upgrades') for (const m of META) {
    const r = save.meta[m.id] || 0, max = m.costs.length, cost = m.costs[r];
    body.append(h('div', { class: `up ${r >= max ? 'owned' : ''}` },
      h('img', { alt: '', src: iconURL(metaIcon(m.id), 3) }),
      h('b', {}, m.name), h('small', {}, `${m.desc}${max > 1 ? ' per rank' : ''}`),
      h('div', { class: 'pips' }, ...Array.from({ length: max }, (_, i) => h('i', { class: i < r ? 'on' : '' }))),
      r >= max ? h('small', {}, 'Complete') : buyBtn('Buy', cost, () => { save.meta[m.id] = r + 1; })));
  }
  if (tab === 'heroes') for (const c of CLASSES.filter((x) => !x.beast)) {
    const own = save.unlocks.classes.includes(c.id);
    body.append(h('div', { class: `up ${own ? 'owned' : ''}` }, classPortrait(c.id), h('b', {}, c.name), h('small', {}, `${c.passive.name}: ${c.passive.desc}`), h('small', {}, `Starts with ${WEAPON[c.weapon].name} and ${ABILITY[c.ability].name}`),
      own ? h('small', {}, `Ready · ${classLvlHTML(c.id)}`) : buyBtn('Unlock', c.cost, () => save.unlocks.classes.push(c.id))));
  }
  if (tab === 'beasts') for (const B of BEASTS) {
    const own = save.unlocks.classes.includes(B.id), [s1, s2, s3] = B.stages;
    const cv = formPortrait(B.id, 30);
    body.append(h('div', { class: `up ${own ? 'owned' : ''}` }, cv, h('b', {}, B.name), h('small', {}, `${B.passive.name}: ${B.passive.desc}`),
      h('small', {}, `${FORMS[s1].name} › ${FORMS[s2].name} › ${FORMS[s3[0]].name} or ${FORMS[s3[1]].name}`),
      own ? h('small', {}, `Ready · ${classLvlHTML(B.id)}`) : buyBtn('Unlock', B.cost, () => save.unlocks.classes.push(B.id))));
  }
  if (tab === 'trees') {
    // the shared layer, then every living character's own
    const card = (cls, ch, label) => {
      CD.focusChar = ch ? ch.id : null;
      const prev = CD.treeLayer; CD.treeLayer = ch ? 'own' : 'shared';
      const L = classLevelInfo(cls); CD.treeLayer = prev;
      body.append(h('div', { class: 'up', style: { '--rc': L.free ? (ch ? PATH[skNative(cls)].col : '#ffc65a') : 'var(--soot-4)' } }, classPortrait(cls), h('b', {}, `${label} · Talent Lv ${L.lvl}`),
        h('small', {}, `${L.spent} allocated${L.free ? ` · ${L.free} to spend` : ''}`),
        h('small', {}, L.lvl >= MAX_CLASS_LEVEL ? 'Mastered' : `${L.into} / ${L.need} souls to the next level`),
        btn(L.free ? 'Spend points' : 'Open tree', () => { CD.focusChar = ch ? ch.id : null; UI.tree(cls, { layer: ch ? 'own' : 'shared', onClose: () => UI.camp('trees') }); }, L.free ? 'small primary' : 'small')));
    };
    card(save.lastClass && CLASS[save.lastClass] ? save.lastClass : 'knight', null, "Everyone's points");
    for (const ch of realmStore().chars) card(ch.cls, ch, `${charLabel(ch)} the ${CLASS[ch.cls] ? CLASS[ch.cls].name : ch.cls}`);
    CD.focusChar = null;
  }
  if (tab === 'armory') for (const w of WEAPONS.filter((x) => !x.start && x.cost)) {
    const own = save.unlocks.weapons.includes(w.id), evo = EVOLVE_FROM[w.id];
    body.append(h('div', { class: `up ${own ? 'owned' : ''}` }, h('img', { alt: '', src: iconURL(weaponIcon(w.id), 3) }), h('b', {}, w.name), h('small', {}, w.desc),
      h('small', {}, `${w.kind === 'melee' ? 'Melee' : 'Ranged'} · ${w.dmg} damage · ${w.rate}/s${evo ? ` · evolves into ${WEAPON[evo].name}` : ''}`),
      own ? h('small', {}, 'In the deep now') : buyBtn('Unlock', w.cost, () => save.unlocks.weapons.push(w.id))));
  }
  if (tab === 'library') for (const a of ABILITIES.filter((x) => !x.start && x.cost)) {
    const own = save.unlocks.abilities.includes(a.id);
    body.append(h('div', { class: `up ${own ? 'owned' : ''}` }, h('img', { alt: '', src: iconURL(abilityIcon(a.id), 3) }), h('b', {}, a.name), h('small', {}, a.desc), h('small', {}, `${a.cd}s recharge`),
      own ? h('small', {}, 'In the deep now') : buyBtn('Unlock', a.cost, () => save.unlocks.abilities.push(a.id))));
  }
  const notes = {
    upgrades: 'Embers you carry out of the deep buy lasting strength.',
    heroes: 'Every hero is yours from the start. Each new descent makes a new character of the one you pick.',
    beasts: 'Beasts are monsters you play. They evolve twice, choose a final form, and devour weapons instead of wielding them.',
    trees: 'One talent tree, with a start on its rim for every hero and beast and pure chaos at its heart. Banked souls raise everyone\'s Talent Level and the banking character\'s own. Whatever anyone places works for everyone, for good.',
    armory: 'Unlocked weapons start turning up in chests and shops. Take one to +3 with its matching relic and evolve it at a forge.',
    library: 'Unlocked abilities start turning up in chests and shops.',
  };
  const el = h('div', { class: 'screen dim' },
    h('div', { class: 'topbar' }, h('h2', {}, 'The Camp'), emberChip()),
    h('p', { class: 'notice' }, notes[tab]),
    h('div', { class: 'tabs', role: 'tablist' }, ...tabs.map(([id, label]) => btn(label, () => UI.camp(id), 'small', { role: 'tab', 'aria-selected': id === tab ? 'true' : 'false', 'data-autofocus': id === tab ? true : null }))),
    body,
    h('div', { class: 'row' }, btn('Back', () => UI.title())));
  UI.open(el, { onBack: () => UI.title() });
};

/* ---------- records ---------- */
const _records = UI.records;
UI.records = function () {
  _records();
  const el = UI.top(), panel = el && el.querySelector('.panel');
  if (!panel) return;
  const save = CD.save, F = save.fs || {};
  const stat = (k, v) => h('div', {}, k, h('b', {}, String(v)));
  const extra = [];
  const levels = [stat('Everyone', `Lv ${talentLevelOf(talentShared().xp).lvl}`), stat('Chaos Level', String(chaosLevel())), ...realmStore().chars.map((ch) => stat(`${charLabel(ch)} (${CLASS[ch.cls] ? CLASS[ch.cls].name : ch.cls})`, `Lv ${talentLevelOf(charTalentXp(ch)).lvl}`))];
  extra.push(h('h3', {}, 'Souls'), h('div', { class: 'statgrid' }, stat('Souls banked', F.soulsBanked || 0), stat('Souls reclaimed', F.soulsReclaimed || 0), stat('Chaos Beasts slain', F.nemesesSlain || 0), stat('DMT zones found', F.dmtFound || 0), stat('Mycelial bond', F.mycBond || 0), stat('Secrets found', F.secrets || 0), stat('Best combo', F.maxCombo || 0)));
  extra.push(h('h3', {}, 'Talent levels'), h('div', { class: 'statgrid' }, ...levels));
  if ((save.fallen || []).length) extra.push(h('h3', {}, `The fallen (${save.fallen.length})`), h('p', {}, save.fallen.slice(0, 10).map((f) => `${f.name}, ${CLASS[f.cls] ? CLASS[f.cls].name : f.cls}, level ${f.level}`).join(' · ')));
  const nems = save.nemeses || [];
  extra.push(h('h3', {}, `Chaos Beasts (${nems.length})`), nems.length
    ? h('div', { class: 'nem-list' }, ...[...nems].sort((a, b) => b.chaos - a.chaos).map((n) => h('div', {}, h('span', {}, h('b', {}, nemTitle(n)), h('br'), `${ACTS[n.act % ACTS.length].name}${n.muts.length ? ` · ${n.muts.map((m) => NEM_MUTS[m].name).join(', ')}` : ''}`), h('span', {}, `Chaos ×${n.chaos} · ${n.souls} souls`))))
    : h('p', {}, 'None. Nothing in the deep is holding your souls.'));
  const forms = Object.keys(FORMS).filter((id) => (save.seen || {})['f:' + id]);
  if (forms.length) extra.push(h('h3', {}, `Evolutions seen (${forms.length} of ${Object.keys(FORMS).filter((id) => FORMS[id].stage > 1).length})`), h('div', { class: 'chips' }, ...forms.map((id) => h('span', { class: 'chip' }, (() => { const cv = formPortrait(id, 30); cv.style.width = '30px'; cv.style.height = '30px'; return cv; })(), FORMS[id].name))));
  const got = save.feats || {};
  extra.push(h('h3', {}, `Feats (${Object.keys(got).length} of ${FEATS.length})`), h('div', { class: 'feats' }, ...FEATS.map((f) => h('div', { class: `feat ${got[f.id] ? 'got' : ''}` }, h('b', {}, f.name), h('em', {}, `+${f.embers}`), h('small', {}, f.desc)))));
  const anchor = [...panel.querySelectorAll('h3')].find((x) => x.textContent === 'Bosses');
  for (const x of extra) panel.insertBefore(x, anchor || null);
  el.scrollTop = 0;
};

/* ---------- pause and build ---------- */
// Modules add their own pause entries here instead of rewrapping UI.pause.
// make(el, p, run) returns a button, or null to leave the entry out this time;
// entries are shown in order. Registering an id again replaces that entry.
const PAUSE_ITEMS = [];
function pauseItem(id, order, make) {
  const i = PAUSE_ITEMS.findIndex((it) => it.id === id), it = { id, order, make };
  if (i >= 0) PAUSE_ITEMS[i] = it; else PAUSE_ITEMS.push(it);
}
// the first line under "Paused"; the Realm says where you are instead
let pauseWhere = (p, run) => `${playerName(p)} · level ${p.level} · ${floorLabel(G.fl.idx)} · ${fmtTime(run.t)} · seed ${run.seedText}${run.chaos ? ' · Chaos Mode' : ''}`;
UI.pause = function () {
  if (G.mode !== 'play' || UI.top() || (G.p && G.p.dead)) return; // the fall has to be faced
  Sound.play('ui', { p: 0.7 });
  const p = G.p, run = G.run, L = classLevelInfo(run.cls);
  const menu = h('div', { class: 'menu', style: { width: '100%' } });
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel' },
    h('h2', {}, 'Paused'),
    h('p', {}, pauseWhere(p, run)),
    h('p', {}, `Carrying ${run.souls || 0} souls · Talent Level ${L.lvl}${L.free ? ` · ${L.free} point${L.free === 1 ? '' : 's'} to spend` : ''}`),
    menu));
  for (const it of [...PAUSE_ITEMS].sort((a, b) => a.order - b.order)) { const b = it.make(el, p, run); if (b) menu.append(b); }
  UI.open(el, { modal: true, replace: false });
};
pauseItem('resume', 10, (el) => btn('Resume', () => UI.close(el), 'primary', { 'data-autofocus': true }));
pauseItem('map', 60, (el) => btn('Map', () => { UI.close(el); UI.map(); }));
pauseItem('build', 70, (el) => btn('Your build', () => { UI.close(el); UI.build(); }));
pauseItem('talents', 80, (el, p, run) => { const L = classLevelInfo(run.cls); return btn(L.free ? `Talent tree · ${L.free} to spend` : 'Talent tree', () => { UI.close(el); UI.tree(run.cls, { inRun: true }); }); });
pauseItem('settings', 100, () => btn('Settings', () => UI.settings()));
pauseItem('help', 110, () => btn('How to play', () => UI.help()));
pauseItem('savequit', 120, () => btn('Save and quit', () => { saveCheckpoint(); UI.clear(); setMode('title'); UI.title(); toast('Saved at the start of this floor'); }));
pauseItem('abandon', 125, (el, p, run) => btn('Abandon this run', () => UI.confirm('Abandon the run?', `You keep the embers you have gathered so far.${run.souls ? ` The ${run.souls} souls you carry will be lost to the deep.` : ''}`, 'Abandon', () => { UI.clear(); endRun(false); })));
const _build = UI.build;
UI.build = function () {
  _build();
  const el = UI.top(), panel = el && el.querySelector('.panel');
  if (!panel) return;
  const p = G.p, run = G.run, F = formOf(p), extra = [];
  panel.querySelector('h2').textContent = playerName(p);
  const lines = [];
  if (F) lines.push(`${F.name}, stage ${F.stage} of 3${F.stage < 3 ? ` · evolves at level ${evoLevel(F.stage)}` : ''}`, `Essence: +${Math.round((p.essence || 0) * 100)}% damage from devoured weapons`);
  const st = ascStage(p);
  lines.push(st ? `${ascTitle(p)}, evolution ${st} of ${ASC_MAX}${st < ASC_MAX ? ` · next at level ${ascLevelFor(p, st + 1)}` : ''}` : `First evolution at level ${ascLevelFor(p, 1)}`);
  if (run.chaos) lines.push('Chaos Mode');
  extra.push(h('h3', {}, 'Growth'), h('p', {}, lines.join(' · ')));
  if (st) {
    extra.push(h('div', { class: 'chips' }, ...p.asc.map((id, i) => h('span', { class: 'chip', style: { '--rc': ASPECT[id].c1 }, title: ASPECT[id].pickTxt }, `${i + 1}. ${ASPECT[id].titles[i]} (${ASPECT[id].name}${p.ascAtt && p.ascAtt[i] === 0 ? ', half' : ''})`))));
    const perks = ascPerksOf(p);
    if (perks.length) extra.push(h('div', { class: 'chips' }, ...perks.map((q) => h('span', { class: 'chip', style: { '--rc': ASPECT[q.a].glow } }, `★ ${q.txt}`))));
  }
  if (p.muts && p.muts.length) extra.push(h('h3', {}, 'Mutations'), h('div', { class: 'chips' }, ...p.muts.map((m) => h('span', { class: 'chip', style: { '--rc': '#ff4ad0' }, title: PLAYER_MUTS[m].desc }, h('img', { alt: '', src: iconURL(chaosIcon(), 2) }), `${PLAYER_MUTS[m].name}: ${PLAYER_MUTS[m].desc}`))));
  const majors = treeAlloc(run.cls).map((id) => TREE.nodes[id]).filter((n) => n && n.def);
  extra.push(h('h3', {}, `Talent tree · Talent Level ${classLevelInfo(run.cls).lvl}`), majors.length ? h('div', { class: 'chips' }, ...majors.map((n) => h('span', { class: 'chip', style: { '--rc': n.type === 'keystone' ? '#ff4ad0' : SECTORS[n.sector] ? SECTORS[n.sector].color : '#ffffff' }, title: nodeDesc(n) }, nodeName(n)))) : h('p', {}, 'No notables yet. Bank souls at a DMT zone to earn talent points.'));
  const anchor = [...panel.querySelectorAll('h3')].find((x) => x.textContent === 'Numbers');
  for (const x of extra) panel.insertBefore(x, anchor || null);
};

/* ---------- the forge: tempering, reforging, evolving ---------- */
UI.forge = function () {
  const p = G.p;
  const el = h('div', { class: 'modal' });
  const draw = () => {
    const w = p.weapon, natural = w.rar === 'natural';
    const up = Math.round((45 + 35 * (w.lvl || 0) + 8 * G.fl.idx) * p.stats.shopMul), re = Math.round((30 + 10 * G.fl.idx) * p.stats.shopMul);
    const ev = typeof weaponEvoInfo === 'function' ? weaponEvoInfo(p, w) : null;
    const pay = (cost, fn) => { if (p.gold < cost) { Sound.play('deny'); toast('Not enough gold'); return; } p.gold -= cost; fn(); redraw(); };
    let evoBox = null;
    if (ev) {
      const R0 = RELIC[ev.relic];
      evoBox = h('div', { class: 'card r-evolved' },
        h('div', { class: 'head' }, h('img', { alt: '', src: iconURL(weaponIcon(ev.id), 3) }), h('div', {}, h('div', { class: 'nm' }, ev.def.name), h('div', { class: 'sub' }, 'Evolution'))),
        h('p', { class: 'desc' }, ev.def.desc),
        h('ul', {}, h('li', {}, `${ev.hasLvl ? '✓' : '✗'} Temper ${WEAPON[w.id].name} to +${ev.need} `, h('b', {}, `(now +${w.lvl || 0})`)), h('li', {}, `${ev.hasRelic ? '✓' : '✗'} Hold the `, h('b', {}, R0 ? R0.name : ev.relic), ' relic')),
        btn(ev.ok ? `Evolve into ${ev.def.name}` : 'Not ready to evolve', () => { if (evolveWeapon(p, w)) redraw(); }, ev.ok ? 'primary' : 'small', { disabled: ev.ok ? null : true }));
    }
    return h('div', { class: 'panel' },
      h('h2', {}, 'The Forge'), h('p', {}, natural ? 'The smith eyes your claws and shrugs. Gold is gold.' : 'The smith works on whatever is in your hand. Gold only, no favors.'),
      h('div', { html: weaponCardHTML(w) }),
      evoBox,
      h('div', { class: 'menu', style: { width: '100%' } },
        btn(h('span', {}, `Temper to +${(w.lvl || 0) + 1} (+12% damage) · `, h('span', { class: 'cost' }, `${up}g`)), () => { if ((w.lvl || 0) >= 5) { toast('It cannot take more'); return; } pay(up, () => { w.lvl = (w.lvl || 0) + 1; Sound.play('slam', { p: 1.6, v: 0.6 }); burst(p.x, p.y - 10, 12, ['#ffd08a', '#ff7a2a'], { glow: true, smax: 80 }); recalcStats(p); }); }, ev && ev.ok ? '' : 'primary', { 'data-autofocus': ev && ev.ok ? null : true, disabled: (w.lvl || 0) >= 5 ? true : null }),
        w.rar !== 'common' && !natural ? btn(h('span', {}, 'Reforge its traits · ', h('span', { class: 'cost' }, `${re}g`)), () => pay(re, () => { const nw = makeWeapon(w.id, w.rar, G.run.rng); w.affixes = nw.affixes; if (w.rar !== 'evolved') w.legend = nw.legend; recalcStats(p); Sound.play('slam', { p: 1.3, v: 0.5 }); })) : null,
        p.weapons[1] && !p.beast ? btn('Work on your other weapon', () => { swapWeapon(p); redraw(); }) : null,
        btn('Leave', () => UI.close(el))));
  };
  const redraw = () => { el.innerHTML = ''; el.append(draw()); UI.focusFirst(el); };
  el.append(draw());
  UI.open(el, { modal: true, replace: false });
};

/* ---------- the end of a run ---------- */
hook('runStart', (run) => { run.t0 = Date.now(); const F = CD.save.fs; if (run.cls && !run.realm) { F.played = F.played || []; if (!F.played.includes(run.cls)) F.played.push(run.cls); } });
UI.runSummary = function (won) {
  const again = G.run && G.run.charId && typeof charById === 'function' ? charById(G.run.charId) : null;
  const run = G.run, p = G.p, save = CD.save;
  setMode('menu');
  const stat = (k, v) => h('div', {}, k, h('b', {}, String(v)));
  const fell = !won && CD.save.fallen && CD.save.fallen[0] && Date.now() - CD.save.fallen[0].date < 60000 ? CD.save.fallen[0] : null;
  const L = classLevelInfo(run.cls), who = again ? `${charLabel(again)} the ${CLASS[run.cls].name}` : fell ? `${fell.name} the ${CLASS[run.cls].name}` : p ? playerName(p) : CLASS[run.cls].name;
  const ev = run.nemEvent, snap = run.nemEventSnap;
  let soulText = null;
  if (won && run.wonSouls) soulText = h('p', {}, `You carried ${run.wonSouls} souls out of the deep. They are banked.`);
  else if (ev && snap) {
    const where = ACTS[snap.act % ACTS.length].name;
    if (ev.type === 'born') soulText = h('p', { class: 'nem-note' }, `${snap.title} devoured your ${ev.souls} souls and became a Chaos Beast. It waits in ${where}. Kill it to take them back.`);
    else if (ev.type === 'grew') soulText = h('p', { class: 'nem-note' }, `${snap.title} killed you again. Its chaos doubled to ×${snap.chaos}${ev.mut ? ` and it grew ${NEM_MUTS[ev.mut].name}: it ${NEM_MUTS[ev.mut].desc}` : ''}. It now holds ${snap.souls} of your souls.`);
    else if (ev.type === 'fed') soulText = h('p', { class: 'nem-note' }, `${snap.title} swallowed the ${ev.souls} souls you carried. It now holds ${snap.souls}.`);
  } else if (!won) soulText = h('p', {}, 'You carried no souls, so nothing fed on you.');
  const newFeats = run.t0 ? FEATS.filter((f) => (save.feats || {})[f.id] >= run.t0) : [];
  const el = h('div', { class: 'screen dim center' },
    h('div', { class: 'lv-head' }, h('b', { style: { color: won ? 'var(--gold)' : 'var(--bone)' } }, won ? 'Victory' : 'You fell'), h('small', {}, won ? `The ${who} climbs out of the deep` : `${who} · ${floorLabel(run.floorIdx)} · level ${p ? p.level : 1}`)),
    h('div', { class: 'panel sum wide' },
      h('div', { class: 'statgrid' }, stat('Time', fmtTime(run.t)), stat('Floor', run.floorIdx + 1), stat('Foes slain', run.stats.kills), stat('Bosses', run.stats.bosses), stat('Damage dealt', Math.round(run.stats.dmgDealt)), stat('Damage taken', Math.round(run.stats.dmgTaken)), stat('Gold found', run.stats.gold), stat('Rooms cleared', run.stats.cleared), stat('Best combo', (G.combo && G.combo.max) || 0), stat('Souls banked', run.soulsBanked || 0), stat('Chaos Beasts slain', run.nemKilled || 0), stat('Mode', run.chaos ? 'Chaos' : run.heat ? `Heat ${run.heat}` : 'Normal')),
      h('div', { class: 'row' }, h('span', { class: 'embers' }, h('img', { alt: '', src: iconURL(miscIcon('ember'), 2) }), `+${run.emberTotal} embers`), h('span', { class: 'foot' }, `You now hold ${save.embers}`)),
      h('h3', {}, 'Souls'), soulText,
      h('div', { class: 'tree-lvl' }, h('span', {}, `${typeof talentLabel === 'function' ? talentLabel(run.cls) : CLASS[run.cls].name} · Talent Level `, h('b', {}, String(L.lvl))), h('i', {}, h('em', { style: { width: `${Math.round((L.into / L.need) * 100)}%` } })), h('small', {}, `${L.into} / ${L.need} souls to level ${L.lvl + 1}${L.free ? ` · ${L.free} point${L.free === 1 ? '' : 's'} to spend` : ''}`)),
      newFeats.length ? h('h3', {}, 'New feats') : null,
      newFeats.length ? h('div', { class: 'feats' }, ...newFeats.map((f) => h('div', { class: 'feat got' }, h('b', {}, f.name), h('em', {}, `+${f.embers}`), h('small', {}, f.desc)))) : null,
      won && run.heat < MAX_HEAT ? h('p', {}, `Heat ${Math.min(MAX_HEAT, run.heat + 1)} is unlocked. Harder descents pay 10% more embers per level.`) : null),
    h('div', { class: 'menu' },
      btn(again ? `Descend again with ${charLabel(again)}` : `New descent as a ${CLASS[run.cls].name}`, () => { UI.clear(); fadeTransition(() => startRun({ cls: run.cls, heat: run.heat, sheetId: run.sheetId, chaos: run.chaos, charId: again ? again.id : undefined })); }, 'primary', { 'data-autofocus': true }),
      btn(L.free ? `Talent tree · ${L.free} to spend` : 'Talent tree', () => UI.tree(run.cls, { onClose: () => UI.runSummary(won) })),
      btn('Choose another', () => UI.heroes({ sel: run.cls, chaos: !!run.chaos })),
      btn('Camp', () => UI.camp()),
      btn('Title', () => UI.title())));
  UI.open(el, {});
};

/* ---------- how to play ---------- */
UI.help = function (back) {
  const k = (keys, what) => h('div', {}, ...keys.map((x) => h('kbd', {}, x)), ' ', what);
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel wide' },
    h('h2', {}, 'How to play'),
    h('p', {}, 'Fight down through four regions of three floors each. Every room you enter seals until its monsters fall. Find the stairs, beat the boss on every third floor, and claim a relic from its altar. When you die, the run ends but the embers you gathered stay with you for the camp.'),
    h('h3', {}, 'Characters'),
    h('p', {}, 'Every hero and beast is yours from the start. Each new descent makes a named character. A descent starts at level 1: levels, gear, the passives you pick and your skill tree belong to that run. Death is permanent, below and above. Reach floor 11 in a single descent and the Realm above opens to that character.'),
    h('h3', {}, 'Three circles'),
    h('p', {}, 'Your growth lives in three circles of mycelium. The Talent Tree is one tree for everyone, and whatever is placed on it lasts for good. Each playable\'s Skill Tree belongs to a single descent. DNA belongs to the character: it is spent on their skill, weapons and accessories, and on anything they have held before.'),
    h('h3', {}, 'Skill trees and evolution'),
    h('p', {}, 'Every level is a skill point for your playable\'s own skill tree: eight paths (fire, frost, storm, venom, shadow, earth, chaos and luck) that change your weapon, your ability and the accessory you wear. Every five levels you evolve. The paths you walk, here and in your talents, decide the form: one strong path makes a pure form, two make a hybrid.'),
    h('h3', {}, 'Souls, DMT zones and the talent tree'),
    h('p', {}, 'Everything you kill can drop souls. They are not safe in your pockets. Most floors hide a DMT zone behind a false wall: walk along the walls, and when the air starts to sparkle, step closer. Inside, deposit your souls at the well, or commune with the Mycelium. Banked souls raise two Talent Levels: everyone\'s, whose points can start from any hero or beast, and your character\'s own, whose points start from theirs. Every passive placed on the tree works for every character in every descent, and stays after its owner falls.'),
    h('p', {}, 'Every hero and beast has a start on the rim of the talent tree. Four roads of its own (weapon, ability, nature and element) run inward from it, woven into its neighbours\' roads, so you can go along the rim or toward the middle. Attribute passives give Strength, Dexterity or Intelligence: click a taken one to switch. Keystones bend the rules, and where kin meet, their element roads flow into a confluence. The middle is pure chaos: its passives roll anew every descent, and its inner bands stay sealed until the Chaos Level opens them.'),
    h('h3', {}, 'DNA'),
    h('p', {}, 'Every level also earns a DNA point. Spend it on your skill (ranks, recharge, a second skill), your weapons (edge, speed, traits, a weapon for the other hand) or your accessories. Your DNA remembers every weapon, trait, skill and accessory you have held, and you can spend DNA on any of them. Bosses leave you a skill of theirs, and slaying them opens new strands: one boss lets you rearrange weapons into new ones, two bosses skills, three bosses accessories. If your character lives to make another descent, choose: keep your DNA but lose half your points or more, or sacrifice all of it to raise the Chaos Level.'),
    h('h3', {}, 'Chaos Beasts'),
    h('p', {}, 'Die while carrying souls and whatever killed you eats them. It becomes a Level 1 Chaos Beast with a name and a grudge, and it waits for you in that region on a later descent. Kill it to get every soul back, plus interest. If it kills you again, its chaos doubles and it mutates.'),
    h('h3', {}, 'Beasts and evolution'),
    h('p', {}, 'Beasts are playable monsters. They evolve at level 5 and again at level 12, where you choose one of two final forms. They cannot hold weapons, so walking over a weapon devours it for permanent damage and sometimes its traits. Heroes awaken at level 10 instead.'),
    h('p', {}, 'Weapons evolve too: temper one to +3 at a forge while holding its matching relic, and the smith will turn it into something far worse for your enemies.'),
    h('h3', {}, 'Omens, combos and chaos'),
    h('p', {}, 'Some floors fall under an omen: blood moons, darkness, giants, gold rushes and worse. Kills in quick succession build a combo. Kegs explode, traps fire both ways, chests can bite, and a Chaos Shrine will do something to you. Chaos Mode turns all of it up and lets you try locked characters.'),
    h('h3', {}, 'Steel and Chaos'),
    h('p', {}, 'Attacks, dodges near enemies and guarding spend stamina, which comes back when you stop. Abilities spend Chaos, earned by landing hits, killing and defending well; hold an ability you cannot afford to overdraw into debt. Hold guard to block toward your aim, tap it as a blow lands to parry, and dodge through a strike at the last moment for a counter. Watch the cue over a foe: a cross can be parried, a diamond must be dodged, a circle is a grab. Break a foe\'s posture, then land a heavy blow for an execution. The full manual is in the pause menu.'),
    h('h3', {}, 'In 3D'),
    h('p', {}, 'Everything is drawn in 3D: dungeon walls stand up and the Realm\'s land stretches away under its trees and towns, while torches, lamps, lava and spells light the dark. Walls on the near side of a room stay low so they never hide you, and trees and roofs fade when you walk behind them.'),
    h('h3', {}, 'The living Realm'),
    h('p', {}, 'Townsfolk keep routines and shelter from the weather, guards defend the roads, wildlife scatters and regroups, and creatures hear your footsteps. Follow a blue wisp to a wayfarer\'s reliquary, and keep a Field Journal of what you find. In Emberhold, Captain Rowan runs the Proving Trail: a first quest with a practice dummy, a Briar Captain, a trail discipline and combat lessons.'),
    h('h3', {}, 'Keyboard and mouse'),
    h('div', { class: 'keys' }, k(['up', 'left', 'down', 'right'].map((a) => keyName(KEYMAP[a][0])), 'move'), k(['Mouse'], 'aim'), k(['Click'], 'attack (hold to keep swinging)'), k([keyName(KEYMAP.dash[0])], 'dash through danger'), k([keyName(KEYMAP.ab1[0]), keyName(KEYMAP.ab2[0])], 'abilities (right click works for the first)'), k([keyName(KEYMAP.use[0])], 'pick up, open, buy, talk'), k([keyName(KEYMAP.swap[0])], 'swap weapons (or the wheel)'), k([keyName(KEYMAP.potion[0])], 'drink a potion'), k(KEYMAP.guard.slice(0, 2).map(keyName), 'guard (tap to parry)'), k([keyName(KEYMAP.heavy[0])], 'heavy attack'), k([keyName(KEYMAP.map[0])], 'map'), k([keyName(KEYMAP.pause[0])], 'pause')),
    h('p', {}, 'No mouse? Arrows move, J attacks, K dashes, U and I are abilities, L interacts. Your aim snaps to the nearest foe.'),
    h('h3', {}, 'Gamepad'),
    h('div', { class: 'keys' }, k(['L stick'], 'move'), k(['R stick'], 'aim (and attack)'), ...[['attack', 'attack'], ['dash', 'dash'], ['ab1', 'ability 1'], ['ab2', 'ability 2'], ['use', 'interact'], ['swap', 'swap weapon'], ['potion', 'potion'], ['guard', 'guard / parry'], ['heavy', 'heavy attack'], ['pause', 'pause'], ['map', 'map']].map(([a, what]) => k([(PADMAP[a] || []).map(padGlyph).join(' / ') || '—'], what))),
    h('p', {}, 'Xbox, PlayStation, Nintendo and most Bluetooth controllers work. Change any button, the dead zone and rumble in Controls.'),
    h('h3', {}, 'Touch'),
    h('p', {}, 'Touch anywhere on the left to move. Hold the right stick to attack; drag it to aim or just hold it to hit the nearest foe. Buttons around it dash and cast. A USE button appears when something can be picked up. Every button can be moved, resized and restyled in Controls, and the game plays in landscape too.'),
    h('h3', {}, 'Tips'),
    h('div', { class: 'keys' },
      h('div', {}, 'Dashing makes you untouchable for a moment.'),
      h('div', {}, 'Melee swings cut small missiles out of the air.'),
      h('div', {}, 'Red markers on the floor show where an attack will land.'),
      h('div', {}, 'Bank souls before a boss. Bosses can become Chaos Beasts too.'),
      h('div', {}, 'Keys open treasure rooms and silver chests.'),
      h('div', {}, 'Level ups and evolutions wait until a room is clear.')),
    h('div', { class: 'row' }, btn('Got it', () => back ? back() : UI.close(), 'primary', { 'data-autofocus': true }))));
  UI.open(el, { modal: G.mode === 'play', replace: G.mode !== 'play', onBack: () => (back ? back() : UI.close()) });
};

