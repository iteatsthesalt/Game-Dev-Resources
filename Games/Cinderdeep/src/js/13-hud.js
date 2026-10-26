/* ============================================================
   Cinderdeep — HUD (HTML over the canvas) and item cards
   ============================================================ */
const HUD = { last: {}, ghost: 1, bossGhost: 1, mmT: 0 };
const ic = (sp, s = 2) => iconURL(sp, s);
function setText(id, v) { if (HUD.last[id] !== v) { HUD.last[id] = v; $(id).textContent = v; } }
function setHTML(el, key, html) { if (HUD.last[key] !== html) { HUD.last[key] = html; el.innerHTML = html; } }
function setW(el, key, v) { const s = (v * 100).toFixed(1) + '%'; if (HUD.last[key] !== s) { HUD.last[key] = s; el.style.width = s; } }

function keyLabel(action) {
  const d = Input.device;
  if (d === 'pad') return { attack: 'RT', dash: 'A', ab1: 'LB', ab2: 'RB', use: 'X', swap: 'Y', potion: 'B', map: 'Back', pause: 'Start' }[action];
  if (d === 'touch') return '';
  return { attack: 'LMB', dash: 'Space', ab1: 'Q', ab2: 'E', use: 'F', swap: 'Tab', potion: 'R', map: 'M', pause: 'Esc' }[action];
}

function updateHUD(dt) {
  const p = G.p;
  if (!p) return;
  const k = clamp(p.hp / p.maxHp, 0, 1);
  HUD.ghost = HUD.ghost > k ? Math.max(k, HUD.ghost - dt * 0.5) : k;
  setW($('hp-fill'), 'hpf', k); setW($('hp-ghost'), 'hpg', HUD.ghost);
  setW($('hp-shield'), 'hps', p.shieldHits > 0 ? 1 : 0);
  setText('hp-txt', `${Math.ceil(p.hp)} / ${p.maxHp}`);
  setText('lvl', String(p.level));
  setW($('xp-fill'), 'xpf', clamp(p.xp / xpToNext(p.level), 0, 1));
  setHTML($('res'), 'res', [
    `<span title="Gold"><img alt="" src="${ic(miscIcon('gold'))}">${p.gold}</span>`,
    `<span title="Keys"><img alt="" src="${ic(miscIcon('key'))}">${p.keys}</span>`,
    `<span title="Potions"><img alt="" src="${ic(miscIcon('potion'))}">${p.potions}/${p.stats.potMax}</span>`,
    `<span title="Embers"><img alt="" src="${ic(miscIcon('ember'))}">${G.run.embers}</span>`,
    typeof soulIcon === 'function' ? `<span title="Souls: bank them at a DMT zone" class="souls"><img alt="" src="${ic(soulIcon())}">${G.run.souls || 0}</span>` : '',
  ].join(''));
  setHTML($('floor-lbl'), 'flbl', `<b>${esc(G.fl.info.act.short)}</b> ${G.fl.info.actIdx + 1}-${G.fl.info.sub + 1}${G.run.heat ? ` · Heat ${G.run.heat}` : ''}`);
  // weapons
  const w0 = p.weapon, w1 = p.weapons[1 - p.wi];
  const slot = (w, cur) => {
    if (!w) return `<div class="slot small" title="Empty hand"></div>`;
    return `<div class="slot ${cur ? 'cur' : 'small'}" title="${esc(weaponName(w))}">${cur ? '' : `<span class="key">${esc(keyLabel('swap') || '')}</span>`}<img alt="" src="${ic(weaponIcon(w.id))}">${w.lvl ? `<span class="lv">+${w.lvl}</span>` : ''}<i class="rar" style="background:${RARITY[w.rar].color}"></i></div>`;
  };
  const second = p.beast ? `<div class="essence" title="Essence from devoured weapons: +${Math.round((p.essence || 0) * 100)}% damage">+${Math.round((p.essence || 0) * 100)}%<br>ESS</div>` : slot(w1, false);
  setHTML($('slots'), 'slots', slot(w0, true) + second + `<div class="dashes" title="Dashes">${Array.from({ length: p.stats.dashMax }, (_, i) => `<i class="${i < p.dashCharges ? '' : 'off'}"></i>`).join('')}</div>`);
  // abilities
  const ab = (a, key) => {
    if (!a) return `<div class="abil empty" title="No ability"><span class="key">${esc(key)}</span><img alt="" src="${ic(miscIcon('rune'))}"></div>`;
    const cdp = a.cd > 0 ? Math.round((a.cd / Math.max(0.01, a.max)) * 100) : 0;
    return `<div class="abil" title="${esc(ABILITY[a.id].name)}"><img alt="" src="${ic(abilityIcon(a.id))}"><i class="cd" style="--cd:${cdp}%"></i>${a.cd > 0 ? `<span class="cdn">${Math.ceil(a.cd)}</span>` : ''}<span class="key">${esc(key)}</span>${a.lvl > 1 ? `<span class="stack">${'I'.repeat(a.lvl)}</span>` : ''}</div>`;
  };
  setHTML($('abil'), 'abil', ab(p.abilities[0], keyLabel('ab1') || '') + ab(p.abilities[1], keyLabel('ab2') || '') +
    `<div class="abil" title="Potion"><img alt="" src="${ic(miscIcon('potion'))}"><span class="key">${esc(keyLabel('potion') || '')}</span><span class="stack">${p.potions}</span></div>`);
  // boss
  if (G.boss) {
    const bk = clamp(G.boss.hp / G.boss.maxHp, 0, 1);
    HUD.bossGhost = HUD.bossGhost > bk ? Math.max(bk, HUD.bossGhost - dt * 0.3) : bk;
    setW($('boss-fill'), 'bf', bk); setW($('boss-ghost'), 'bg', HUD.bossGhost);
  }
  // prompts and cards
  const t = G.mode === 'play' && !p.dead ? nearestInteract() : null;
  const pr = promptFor(t);
  const pe = $('prompt');
  if (pr && Input.device !== 'touch') { pe.hidden = false; setHTML(pe, 'prompt', `<kbd>${esc(keyLabel('use'))}</kbd>${esc(pr)}`); } else pe.hidden = true;
  const card = $('itemcard');
  if (t && t.kind === 'item' && ['weapon', 'ability', 'relic', 'tome', 'potion', 'key', 'heart'].includes(t.it.type)) { card.hidden = false; setHTML(card, 'card', itemCardHTML(t.it, true)); }
  else card.hidden = true;
  // touch buttons
  if (Input.device === 'touch') {
    const use = $('tb-use');
    use.hidden = !pr;
    if (pr) setText('tb-use', pr.length > 12 ? 'USE' : pr.split(' ')[0].toUpperCase());
    for (const [i, id] of [[0, 'tb-ab1'], [1, 'tb-ab2']]) {
      const a = p.abilities[i], el = $(id);
      const src = a ? ic(abilityIcon(a.id)) : ic(miscIcon('rune'));
      const img = el.querySelector('img'); if (img.getAttribute('src') !== src) img.src = src;
      el.style.opacity = a ? 1 : 0.4;
      el.querySelector('.cd').style.setProperty('--cd', a && a.cd > 0 ? Math.round((a.cd / a.max) * 100) + '%' : '0%');
    }
    const pimg = $('tb-pot').querySelector('img'), psrc = ic(miscIcon('potion')); if (pimg.getAttribute('src') !== psrc) pimg.src = psrc;
    setText('tb-pot-n', String(p.potions));
    const simg = $('tb-swap').querySelector('img'), ssrc = w1 ? ic(weaponIcon(w1.id)) : ic(miscIcon('swap'));
    if (simg.getAttribute('src') !== ssrc) simg.src = ssrc;
    $('tb-swap').style.opacity = w1 ? 1 : 0.4;
    $('tb-swap').hidden = !!p.beast;
  }
  HUD.mmT -= dt;
  if (HUD.mmT <= 0) { HUD.mmT = 0.15; drawMinimap($('minimap'), false); }
}

/* ---------- map ---------- */
const ROOM_MARK = { treasure: '#ffd35c', shop: '#7de08a', shrine: '#ff6f9c', forge: '#ff9a3c', exit: '#f1e5cd', boss: '#e2434f', challenge: '#c873ff', rest: '#8ad8ff', dmt: '#ff4ad0', secret: '#9ff6ff' };
function drawMinimap(cv, big) {
  const fl = G.fl, g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const seen = fl.rooms.filter((r) => r.seen || r.visited);
  if (!seen.length) return;
  let x0 = 99, y0 = 99, x1 = 0, y1 = 0;
  for (const r of seen) { x0 = Math.min(x0, r.cx); y0 = Math.min(y0, r.cy); x1 = Math.max(x1, r.cx + r.cw); y1 = Math.max(y1, r.cy + r.ch); }
  const cs = Math.max(4, Math.floor(Math.min((W - 8) / Math.max(4, x1 - x0), (H - 8) / Math.max(3, y1 - y0), big ? 40 : 14)));
  const ox = Math.floor((W - (x1 - x0) * cs) / 2), oy = Math.floor((H - (y1 - y0) * cs) / 2);
  const gap = Math.max(1, Math.round(cs * 0.12));
  for (const r of seen) {
    const x = ox + (r.cx - x0) * cs, y = oy + (r.cy - y0) * cs, w = r.cw * cs, hh = r.ch * cs;
    g.fillStyle = r === G.room ? '#f1e5cd' : r.visited ? (r.cleared || !['combat', 'elite', 'exit'].includes(r.type) ? '#6e6168' : '#8a5a5a') : '#3a3036';
    g.fillRect(x + gap, y + gap, w - gap * 2, hh - gap * 2);
    const mark = ROOM_MARK[r.type];
    if (mark && (r.visited || r.seen)) {
      const s = Math.max(2, Math.round(cs * 0.36));
      g.fillStyle = '#120d0f'; g.fillRect(x + w / 2 - s / 2 - 1, y + hh / 2 - s / 2 - 1, s + 2, s + 2);
      g.fillStyle = mark; g.fillRect(x + w / 2 - s / 2, y + hh / 2 - s / 2, s, s);
    }
    if (r.type === 'elite' && !r.cleared) { g.fillStyle = '#ffd35c'; g.fillRect(x + w - gap - 3, y + gap + 1, 2, 2); }
  }
  // doors
  for (const d of fl.doors) {
    const a = fl.rooms[d.a], b = fl.rooms[d.b];
    if (!(a.seen || a.visited) || !(b.seen || b.visited)) continue;
    const dx = d.px / (CW * TS), dy = d.py / (CH * TS);
    const x = ox + (dx - x0) * cs, y = oy + (dy - y0) * cs;
    g.fillStyle = d.locked ? '#ffd35c' : '#9a8a82';
    if (d.dir === 'h') g.fillRect(Math.round(x - gap), Math.round(y - 1), gap * 2, 2); else g.fillRect(Math.round(x - 1), Math.round(y - gap), 2, gap * 2);
  }
  // you
  const px = ox + (G.p.x / (CW * TS) - x0) * cs, py = oy + (G.p.y / (CH * TS) - y0) * cs;
  g.fillStyle = '#ff7a3c'; g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
}

/* ---------- cards ---------- */
function weaponCardHTML(w, compare) {
  const def = WEAPON[w.id], R0 = RARITY[w.rar], p = G.p;
  const dmg = (def.dmg * R0.mul * (1 + 0.12 * (w.lvl || 0))).toFixed(1);
  const count = def.style === 'chain' ? `, chains ${def.chains}` : def.count ? ` ×${def.count}` : '';
  let delta = '';
  if (compare && p && compare !== w) {
    const a = weaponDps(w, p), b = weaponDps(compare, p), d = Math.round(((a - b) / b) * 100);
    delta = ` <span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d}% vs ${esc(WEAPON[compare.id].name)}</span>`;
  }
  return `<div class="card r-${w.rar}">
    <div class="head"><img alt="" src="${ic(weaponIcon(w.id), 3)}"><div><div class="nm">${esc(weaponName(w))}</div><div class="sub">${R0.name} · ${def.kind === 'melee' ? 'Melee' : 'Ranged'}</div></div></div>
    <ul><li>Damage <b>${dmg}${count}</b> · Speed <b>${def.rate.toFixed(1)}/s</b>${delta}</li></ul>
    <p class="desc">${esc(def.desc)}</p>
    ${w.affixes.length ? `<ul>${w.affixes.map((a) => `<li>${esc(AFFIX[a].name)}: <b>${esc(AFFIX[a].desc)}</b></li>`).join('')}</ul>` : ''}
    ${w.legend ? `<p class="desc" style="color:var(--r-legendary)">${esc(LEGEND[w.legend].desc)}</p>` : ''}
  </div>`;
}
function abilityCardHTML(id, lvl, note) {
  const a = ABILITY[id], L = AB_LEVEL[Math.min(3, lvl || 1)];
  return `<div class="card" style="--rc:var(--arcane)">
    <div class="head"><img alt="" src="${ic(abilityIcon(id), 3)}"><div><div class="nm">${esc(a.name)}</div><div class="sub">Ability · ${(a.cd * L.cd).toFixed(1)}s recharge${lvl ? ` · Level ${lvl}` : ''}</div></div></div>
    <p class="desc">${esc(a.desc)}</p>${note ? `<p class="desc"><em>${esc(note)}</em></p>` : ''}
  </div>`;
}
function relicCardHTML(id) {
  const r = RELIC[id];
  return `<div class="card r-relic"><div class="head"><img alt="" src="${ic(relicIcon(id), 3)}"><div><div class="nm">${esc(r.name)}</div><div class="sub">Relic</div></div></div><p class="desc">${esc(r.desc)}</p></div>`;
}
function skillCardHTML(sk, rank) {
  const rc = sk.rar === 'epic' ? 'epic' : sk.rar === 'rare' ? 'rare' : 'common';
  const tagCls = { fire: 'fire', frost: 'frost', venom: 'venom', storm: 'storm' }[sk.tag] || '';
  return `<div class="head"><img alt="" src="${ic(skillIcon(sk.tag), 3)}"><div><div class="nm">${esc(sk.name)}</div><div class="sub">${esc(sk.rar)} · ${esc(sk.tag)}</div></div></div>
    <p class="desc">${esc(sk.desc)}</p>
    <div class="tagrow"><span class="tag ${tagCls}">Rank ${rank + 1} of ${sk.max}</span></div>`;
}
function itemCardHTML(it, compare) {
  const p = G.p;
  let html = '';
  if (it.type === 'weapon') html = weaponCardHTML(it.w, compare ? p.weapon : null);
  else if (it.type === 'ability') { const has = p.abilities.find((a) => a && a.id === it.id); html = abilityCardHTML(it.id, has ? has.lvl + 1 : 1, has ? (has.lvl >= 3 ? 'Already mastered' : `Raises yours to level ${has.lvl + 1}`) : ''); }
  else if (it.type === 'relic') html = relicCardHTML(it.id);
  else {
    const info = { tome: ['Tome of Learning', 'Learn one new skill.'], potion: ['Health Potion', `Heals ${pct(p.stats.potHeal)} of your health. Fills a potion slot.`], key: ['Key', 'Opens locked doors and silver chests.'], heart: ['Hearty Meal', 'Heals 35% of your health now.'] }[it.type];
    html = `<div class="card"><div class="head"><img alt="" src="${ic(itemIcon(it), 3)}"><div><div class="nm">${esc(info[0])}</div><div class="sub">Supplies</div></div></div><p class="desc">${esc(info[1])}</p></div>`;
  }
  return html;
}

