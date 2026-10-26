/* ============================================================
   Cinderdeep — playable beasts: forms, bodies, evolutions,
   devouring weapons, and the side-view painters for every form
   ============================================================ */
for (const id in FORMS) FORMS[id].id = id;
const formOf = (p) => (p && p.form ? FORMS[p.form] : null);
const playerName = (p) => (p && p.form ? FORMS[p.form].name : p ? CLASS[p.cls].name : '');
const FORM_SIZE = {
  emberpup: [24, 17], cinderhound: [30, 21], cerberus: [38, 27], ashfang: [36, 25],
  mossling: [21, 18], thornback: [27, 21], treant: [30, 36], venusmaw: [30, 30],
  frostkit: [26, 18], rimefox: [32, 22], kitsune: [38, 30], snowstalker: [38, 25],
  sparkmite: [21, 16], voltbeetle: [28, 20], thunderhorn: [36, 27], stormwing: [34, 30],
  gloomling: [19, 20], shade: [24, 28], reaper: [32, 34], nightmare: [32, 30],
  pebblet: [19, 17], boulderback: [30, 23], titan: [34, 36], crystalgolem: [32, 35],
};
function setFormBody(p) {
  const F = formOf(p);
  if (!F) return;
  p.r = 4 + F.stage;
  p.fly = !!F.fly;
  p.h = FORM_SIZE[F.id][1];
}
function beastFrames(id) {
  return spr('beast:' + id, () => {
    const F = FORMS[id], [w, h] = FORM_SIZE[id];
    return crigAttach([0, 1, 2, 3].map((f) => {
      const p = new PP(w, h);
      BEAST_ART[F.fam](p, F, f);
      p.outline();
      return p.sprite(Math.floor(w / 2), h - 1);
    }), { w, h, ax: Math.floor(w / 2), ay: h - 1, atkF: 3, stepF: 1, paint: (p, f) => BEAST_ART[F.fam](p, F, f) });
  });
}
function beastFrame(p) {
  const fr = beastFrames(p.form);
  if (p.atkPose > 0 || p.leapT > 0 || p.bashT > 0) return fr[3];
  if (p.moving && p.dashT <= 0) return fr[1 + (Math.floor(p.anim) % 2)];
  return fr[0];
}
// a portrait canvas for menus
// the rig's model where it has one; the beetle, plant and shade beasts keep their sprites until it does
function formPortrait(id, size = 48, frame = 0) {
  const model = stagePortrait(id);
  if (model) return model;
  const sp = beastFrames(id)[frame], cv = mkCanvas(size, size), g = cv.getContext('2d');
  const k = Math.min(1, (size - 4) / Math.max(sp.w, sp.h));
  g.imageSmoothingEnabled = false;
  g.drawImage(sp.c, Math.round(size / 2 - (sp.w * k) / 2), Math.round(size - 2 - sp.h * k), Math.round(sp.w * k), Math.round(sp.h * k));
  return cv;
}

/* ---------- stats: the form decides the body, the line decides the gift ---------- */
hook('stats', (s, p) => {
  if (!p.beast) return;
  const F = formOf(p), c = CLASS[p.cls], el = BEAST[F.line].element;
  s.hpBase = F.hp; s.spdBase = 80 * F.spd; s.armor += F.armor - c.armor;
  if (el === 'fire') { s.fireproof = true; s.burnDur *= 1.5; }
  if (el === 'nature') s.regen += 0.6;
  if (el === 'shadow') { s.killHeal += 2; s.dodge += 0.1; }
  if (el === 'earth') { s.armor += 2; s.sturdy = true; }
  if (F.id === 'crystalgolem') s.reflect += 0.2;
  s.wDmg += p.essence || 0;
});
// frost line: chilled foes take more; storm line: every 4th hit arcs
hook('dmgMul', (e, o, p) => (p.beast && BEAST[formOf(p).line].element === 'frost' && (e.chillT > 0 || e.freezeT > 0) && o.src !== 'trap' ? 1.25 : 1));
hook('onHit', (e, dmg, o) => {
  const p = G.p;
  if (!p.beast || o.src !== 'weapon' || BEAST[formOf(p).line].element !== 'storm') return;
  p.condN = (p.condN || 0) + 1;
  if (p.condN % 4) return;
  let from = e; const hit = new Set([e]);
  for (let k = 0; k < 2; k++) {
    let best = null, bd = 80;
    for (const q of G.ents) if (!q.dead && q.type === 'enemy' && !hit.has(q) && q.spawnT <= 0) { const d = Math.hypot(q.x - from.x, q.y - from.y); if (d < bd) { bd = d; best = q; } }
    if (!best) break;
    hit.add(best); zapFx(from.x, from.y - from.h / 2, best.x, best.y - best.h / 2, '#9ff6ff');
    damageEnemy(best, Math.max(4, dmg * 0.6), { src: 'shock', noProc: true, noCrit: true, color: '#9ff6ff', silent: true });
    from = best;
  }
  Sound.play('zap', { v: 0.4, p: 1.3 });
});

/* ---------- evolution ---------- */
const evoLevel = (stage) => (stage === 1 ? 5 : 12) - (CD.save.meta.bond || 0) - (G.p && typeof evoShift === 'function' ? evoShift(G.p) : 0);
function nextForms(p) {
  const F = formOf(p);
  if (!F || F.stage >= 3) return [];
  const n = BEAST[F.line].stages[F.stage];
  return Array.isArray(n) ? n : [n];
}
function checkEvolve(p) {
  const F = formOf(p);
  if (F && F.stage < 3 && p.level >= evoLevel(F.stage)) p.evolvePending = true;
}
hook('onLevel', (p) => { if (p.beast) checkEvolve(p); });
hook('loadRun', (c, run, p) => {
  const x = c.ext || {};
  if (p.beast && x.form && FORMS[x.form]) { p.form = x.form; p.weapon.id = FORMS[x.form].weapon; }
  p.essence = x.essence || 0;
  if (p.beast) { setFormBody(p); checkEvolve(p); }
});
hook('saveRun', (c, run, p) => { c.ext = { ...(c.ext || {}), form: p.form, essence: p.essence || 0 }; });
hook('update', (dt) => {
  const p = G.p;
  if (!p) return;
  if (p.atkPose > 0) p.atkPose -= dt;
  if (p.evolvePending && !G.combat && !UI.top() && !p.dead && G.mode === 'play') UI.evolve();
});
function evolveTo(p, id) {
  const F = FORMS[id], old = formOf(p);
  p.form = id; p.evolvePending = false;
  p.weapon.id = F.weapon;
  let i = p.abilities.findIndex((a) => a && a.id === old.ability);
  if (i < 0) i = p.abilities[1] ? 0 : 1;
  const prev = p.abilities[i];
  const dup = p.abilities.findIndex((a, j) => a && j !== i && a.id === F.ability);
  if (dup >= 0) { p.abilities[dup] = null; p.gold += 30; }
  p.abilities[i] = { id: F.ability, lvl: prev ? prev.lvl : 1, cd: 0, max: 1 };
  setFormBody(p);
  if (typeof setAscBody === 'function') setAscBody(p); // keep the evolved size
  recalcStats(p);
  if (typeof onEvolution === 'function') onEvolution(p, 'evolve', id);
  heal(p, Math.round(p.maxHp * 0.3), true);
  G.slowmo = Math.max(G.slowmo, 0.5); shake(9); hitstop(0.08);
  ring(p.x, p.y - 10, 60, F.c2, 0.8, 3); ring(p.x, p.y - 10, 34, '#ffffff', 0.5, 2);
  burst(p.x, p.y - 10, 50, [F.c1, F.c2, F.acc, '#ffffff'], { smax: 170, glow: true, vz: 140 });
  flashLight(p.x, p.y - 10, 140, F.c2, 0.7);
  for (const e of G.ents) if (!e.dead && e.type === 'enemy' && Math.hypot(e.x - p.x, e.y - p.y) < 70) { e.kx += (e.x - p.x) * 6; e.ky += (e.y - p.y) * 6; }
  banner(F.name, `${old.name} evolved`, 2.8);
  Sound.play('evolve');
  const fs = CD.save.fs; fs.evolutions = (fs.evolutions || 0) + 1; if (F.stage === 3) fs.finals = (fs.finals || 0) + 1;
  CD.save.seen = CD.save.seen || {}; CD.save.seen['f:' + id] = 1;
  checkEvolve(p);
  persist();
}

/* ---------- devouring: beasts eat weapons for power ---------- */
const DEVOUR_ESS = { common: 0.04, uncommon: 0.06, rare: 0.09, epic: 0.13, legendary: 0.2, evolved: 0.25, natural: 0.03 };
function devourWeapon(p, w) {
  const ess = DEVOUR_ESS[w.rar] || 0.04, nw = p.weapon;
  p.essence = (p.essence || 0) + ess;
  const gained = [];
  const a = (w.affixes || []).find((x) => !nw.affixes.includes(x));
  if (a && nw.affixes.length < 6) { nw.affixes.push(a); gained.push(AFFIX[a].name); }
  if (w.legend && !nw.legend) { nw.legend = w.legend; gained.push(LEGEND[w.legend].name); }
  recalcStats(p);
  const F = formOf(p);
  Sound.play('devour');
  burst(p.x, p.y - 8, 18, [RARITY[w.rar].color, '#ffffff', F.c2], { smax: 90, glow: true });
  addText(p.x, p.y - 26, `+${Math.round(ess * 100)}% ESSENCE`, RARITY[w.rar].color, 1);
  toast(`Devoured ${weaponName(w)}${gained.length ? ` · gained ${gained.join(', ')}` : ''}`, RARITY[w.rar].color);
  const fs = CD.save.fs; fs.devoured = (fs.devoured || 0) + 1;
}
const _itemCardHTML = itemCardHTML;
itemCardHTML = function (it, compare) {
  const p = G.p;
  if (!p || !p.beast || it.type !== 'weapon') return _itemCardHTML(it, compare);
  const w = it.w, ess = DEVOUR_ESS[w.rar] || 0.04, a = (w.affixes || []).find((x) => !p.weapon.affixes.includes(x));
  return `<div class="card r-${w.rar}"><div class="head"><img alt="" src="${iconURL(weaponIcon(w.id), 3)}"><div><div class="nm">${esc(weaponName(w))}</div><div class="sub">${RARITY[w.rar].name} · food</div></div></div>
    <p class="desc">Devour it: <em>+${Math.round(ess * 100)}% damage</em> for good${a ? `, and your ${esc(WEAPON[p.weapon.id].name)} gains <em>${esc(AFFIX[a].name)}</em> (${esc(AFFIX[a].desc)})` : ''}${w.legend && !p.weapon.legend ? `, plus the <em>${esc(LEGEND[w.legend].name)}</em> legend` : ''}.</p>
    <p class="desc">Essence so far: +${Math.round((p.essence || 0) * 100)}%</p></div>`;
};

/* ---------- the evolution screen ---------- */
UI.evolve = function () {
  const p = G.p, F = formOf(p), opts = nextForms(p);
  p.evolvePending = false;
  if (!opts.length) return;
  Sound.play('evolveStart');
  const cv = h('canvas', { width: 160, height: 96, class: 'evo-cv' });
  const wrap = h('div', { class: 'choices evo-choices' });
  let chosen = null, t0 = performance.now();
  const el = h('div', { class: 'modal evo' }, h('div', { class: 'evo-wrap' },
    h('div', { class: 'lv-head' }, h('b', {}, 'Evolution'), h('small', {}, opts.length > 1 ? `${F.name} can become one of two things` : `${F.name} is changing`)),
    cv, wrap));
  opts.forEach((id, i) => {
    const N = FORMS[id], W = WEAPON[N.weapon], A = ABILITY[N.ability];
    const card = h('button', { class: 'card r-evolved', type: 'button', 'data-autofocus': i === 0 ? true : null, onclick: () => { if (chosen) return; chosen = id; UI.close(el); evolveTo(p, id); } });
    const pic = formPortrait(id, 72);
    card.append(h('div', { class: 'head' }, pic, h('div', {}, h('div', { class: 'nm' }, N.name), h('div', { class: 'sub' }, `Stage ${N.stage} · ${N.hp} health${N.fly ? ' · flies' : ''}`))),
      h('p', { class: 'desc' }, N.blurb || ''),
      h('ul', {}, h('li', {}, 'Attack ', h('b', {}, W.name), ` · ${W.desc}`), h('li', {}, 'Ability ', h('b', {}, A.name), ` · ${A.desc}`)),
      h('span', { class: 'pick' }, opts.length > 1 ? 'Choose this path' : 'Evolve'));
    wrap.append(card);
  });
  // flashing silhouettes, old and new, faster and faster
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const oldSp = beastFrames(F.id)[0], news = opts.map((id) => beastFrames(id)[0]);
  const draw = () => {
    if (!el.isConnected) return;
    const t = (performance.now() - t0) / 1000;
    g.clearRect(0, 0, 160, 96);
    const gr = g.createRadialGradient(80, 60, 4, 80, 60, 70); gr.addColorStop(0, rgbaStr(F.c2, 0.45)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 160, 96);
    const period = Math.max(0.07, 0.45 - t * 0.12), phase = Math.floor(t / period) % 2;
    const showNew = t > 2.6 ? 1 : phase;
    const sp = showNew ? news[Math.floor(t / (period * 2)) % news.length] : oldSp;
    const k = Math.min(2.6, 84 / Math.max(sp.w, sp.h));
    const x = 80 - (sp.w * k) / 2, y = 90 - sp.h * k;
    g.drawImage(t > 2.6 ? sp.c : silhouette(sp, showNew ? '#ffffff' : '#ffe8c8'), Math.round(x), Math.round(y), Math.round(sp.w * k), Math.round(sp.h * k));
    for (let i = 0; i < 6; i++) { const a = t * 3 + i, r = 30 + Math.sin(t * 2 + i) * 10; g.fillStyle = i % 2 ? F.c2 : '#ffffff'; g.fillRect(Math.round(80 + Math.cos(a) * r), Math.round(56 + Math.sin(a) * r * 0.5), 2, 2); }
    requestAnimationFrame(draw);
  };
  draw();
  UI.open(el, { modal: true, replace: false, onBack: () => {} });
};

/* ============================================================
   Beast painters. Everything faces right; frames are
   idle, step A, step B, attack.
   ============================================================ */
const R2 = Math.round;
const BEAST_ART = {
  /* ---- hounds: emberpup, cinderhound, hellmaw cerberus, ashfang ---- */
  hound(p, F, f) {
    const W = p.w, H = p.h, st = F.stage, k = st === 1 ? 1 : st === 2 ? 1.3 : 1.6;
    const lean = F.id === 'ashfang', multi = F.id === 'cerberus';
    const gy = H - 2, legH = R2((lean ? 5.4 : 4) * k * 0.8), bRy = (lean ? 2.4 : 2.9) * k, bRx = (lean ? 6.2 : 5.6) * k;
    const bx = R2(W / 2 - 2 * k), by = gy - legH - bRy + 1;
    const step = f === 1 ? 1 : f === 2 ? -1 : 0, lunge = f === 3 ? R2(2 * k) : 0;
    const lw = Math.max(1, R2(k * 0.9));
    const leg = (x, off, col) => { const y0 = R2(by + bRy * 0.3); p.rect(R2(x + off), y0, lw, gy - y0, col); p.rect(R2(x + off), gy, lw + 1, 1, F.c3); };
    rigOrient(p, 'side'); rigPart(p, 'leg:f'); leg(bx - bRx * 0.55, -step, F.c3); leg(bx + bRx * 0.5 + lunge * 0.5, step, F.c3);
    // a tail of flame
    rigPart(p, 'tail'); const tn = R2(4 * k), tx0 = bx - bRx + 1, ty0 = by - bRy * 0.3;
    for (let i = 0; i < tn; i++) p.disc(tx0 - i * 0.9, ty0 - i * 0.95 - Math.sin((i + f) * 1.3) * 0.7, Math.max(0.6, (1 - i / tn) * 1.5 * k), i % 2 ? F.c2 : F.acc);
    rigPart(p, 'body'); p.ball(bx, by, bRx, bRy, F.c1, 0.3, -0.3);
    p.ell(bx + 1, by + bRy * 0.55, bRx * 0.6, bRy * 0.3, shade(F.c1, 0.18));
    rigPart(p, 'leg:n'); leg(bx - bRx * 0.3, step, shade(F.c1, -0.15)); leg(bx + bRx * 0.75 + lunge * 0.5, -step, shade(F.c1, -0.15));
    rigPart(p, 'body'); if (st >= 2) for (let i = 0; i < R2(bRx * 1.3); i += 2) { const x = bx - bRx * 0.7 + i, h2 = 1 + ((i / 2 + f) % 3 === 0 ? 1 : 0) + (lean ? 1 : 0); p.rect(R2(x), R2(by - bRy - h2 + 1), 1, h2, (i / 2) % 2 ? F.c2 : F.acc); }
    const head = (hx, hy, dark) => {
      const c = dark ? shade(F.c1, -0.22) : F.c1, r = 2.6 * k;
      p.poly([[hx - r * 0.7, hy - r * 0.4], [hx - r * 0.25, hy - r * 1.75], [hx + r * 0.3, hy - r * 0.45]], F.c3);
      p.ball(hx, hy, r, r * 0.9, c, 0.3, -0.25);
      const sx = hx + r * 0.55, sy = hy + r * 0.05, sw = R2(r * 1.1) + 1, sh = Math.max(2, R2(r * 0.6));
      p.rect(R2(sx), R2(sy), sw, sh, shade(c, 0.12));
      p.px(R2(sx) + sw, R2(sy), F.c3);
      if (f === 3) { p.rect(R2(sx), R2(sy) + sh, sw, 1, '#2a0808'); p.px(R2(sx) + 1, R2(sy) + sh + 1, '#ffffff'); p.px(R2(sx) + sw - 1, R2(sy) + sh + 1, '#ffffff'); }
      p.px(R2(hx + r * 0.2), R2(hy - r * 0.3), F.eye);
      if (k >= 1.3) p.px(R2(hx + r * 0.2) + 1, R2(hy - r * 0.3), F.eye);
    };
    rigPart(p, 'head'); const hx = bx + bRx * 0.95 + lunge, hy = by - bRy * 0.95;
    if (multi) { head(hx - 4, hy - 5, true); head(hx + 1, hy + 1.5, true); }
    head(hx, hy - (multi ? 1.5 : 0), false);
  },

  /* ---- plants: mossling, thornback, elder treant, venus maw ---- */
  plant(p, F, f) {
    const W = p.w, H = p.h, gy = H - 2, step = f === 1 ? 1 : f === 2 ? -1 : 0;
    if (F.id === 'mossling' || F.id === 'thornback') {
      if (F.id === 'thornback') rigOrient(p, 'side'); else rigOrient(p, 'front', 1.1);
      const big = F.id === 'thornback', cx = R2(W / 2) - (big ? 1 : 0), rx = big ? 8 : 5, ry = big ? 5 : 4.5, cy = gy - ry - 1;
      // feet
      rigPart(p, 'leg'); p.rect(cx - R2(rx * 0.6) + step, gy - 1, 2, 2, F.c3); p.rect(cx + R2(rx * 0.4) - step, gy - 1, 2, 2, F.c3);
      rigPart(p, 'body'); 
      if (!big) {
        p.poly([[cx - 1, cy - ry + 1], [cx - 6, cy - ry - 4 + (f === 3 ? -1 : 0)], [cx - 3, cy - ry + 1]], F.c2);
        p.poly([[cx + 1, cy - ry + 1], [cx + 5, cy - ry - 5], [cx + 3, cy - ry + 1]], shade(F.c2, -0.1));
        p.disc(cx + 5, cy - ry - 5, 1.2, F.acc);
      }
      p.ball(cx, cy, rx, ry, F.c1, 0.3, -0.3);
      if (big) for (let i = 0; i < 6; i++) { const x = cx - rx + 2 + i * 2.4, y = cy - ry * (1 - Math.abs(i - 2.5) / 6) + 1; p.poly([[x - 1, y], [x + 0.5, y - 3 - (i % 2)], [x + 1.5, y]], F.acc); }
      // face toward the right
      const ex = cx + (big ? rx - 1 : 1), ey = cy - 1;
      rigPart(p, 'head'); if (big) { p.ball(cx + rx, cy + 1, 3.4, 3, F.c2, 0.3, -0.25); p.px(cx + rx + 1, cy, F.eye); p.px(cx + rx + 2, cy, F.eye); if (f === 3) p.rect(cx + rx + 1, cy + 2, 3, 1, '#1a0a0a'); }
      else { rigPart(p, 'face'); p.rect(ex - 2, ey - 1, 2, 2, '#ffffff'); p.rect(ex + 1, ey - 1, 2, 2, '#ffffff'); p.px(ex - 1, ey, F.eye); p.px(ex + 2, ey, F.eye); if (f === 3) p.disc(ex + 1, ey + 3, 1.2, '#2a1a0a'); else p.rect(ex - 1, ey + 2, 3, 1, F.c3); }
      return;
    }
    if (F.id === 'treant') {
      const cx = R2(W / 2) - 1, top = 4;
      // roots
      rigOrient(p, 'front', 0.9); rigPart(p, 'leg'); for (let i = -1; i <= 1; i++) p.line(cx + i * 3, gy - 6, cx + i * 5 + (i ? step * i : step), gy, F.c3);
      rigPart(p, 'body'); p.rect(cx - 4, 14, 9, gy - 18, F.c1); p.rect(cx - 4, 14, 2, gy - 18, shade(F.c1, 0.18)); p.rect(cx + 3, 14, 2, gy - 18, shade(F.c1, -0.25));
      for (let y = 17; y < gy - 5; y += 4) p.px(cx - 1 + (y % 3), y, F.c3);
      // branch arms
      rigPart(p, 'arm'); rigRoot(p, cx - 4, 19); rigRoot(p, cx + 4, 19); const up = f === 3 ? -8 : step;
      p.line(cx - 4, 19, cx - 10, 15 + up, F.c1); p.line(cx - 10, 15 + up, cx - 12, 11 + up, F.c1); p.disc(cx - 12, 11 + up, 2.4, F.c2);
      p.line(cx + 4, 19, cx + 10, 16 - up * 0.5, F.c1); p.line(cx + 10, 16 - up * 0.5, cx + 12, 12 - up, F.c1); p.disc(cx + 12, 12 - up, 2.4, F.c2);
      // crown
      rigPart(p, 'head'); for (const [dx, dy, r] of [[0, 8, 7], [-6, 10, 5], [6, 10, 5], [-3, 5, 5], [4, 4, 5], [0, top + 2, 4]]) p.ball(cx + dx, dy, r, r * 0.85, dx < 0 ? shade(F.c2, -0.08) : F.c2, 0.3, -0.3);
      p.px(cx + 2, 6, F.acc); p.px(cx - 5, 9, F.acc); p.px(cx + 6, 11, F.acc);
      // face in the bark
      rigPart(p, 'face'); p.rect(cx, 17, 2, 2, '#1a0e06'); p.rect(cx + 3, 17, 2, 2, '#1a0e06'); p.px(cx + 1, 17, F.eye); p.px(cx + 4, 17, F.eye);
      p.rect(cx + 1, 21, 3, f === 3 ? 2 : 1, '#1a0e06');
      return;
    }
    // venus maw
    rigOrient(p, 'side');
    const bx = R2(W / 2) - 3;
    p.ell(bx, gy - 1, 7, 2, F.c3);
    p.poly([[bx - 8, gy - 1], [bx - 3, gy - 6], [bx - 1, gy - 1]], F.c1); p.poly([[bx + 1, gy - 1], [bx + 6, gy - 7 + step], [bx + 8, gy - 1]], shade(F.c1, -0.1));
    rigPart(p, 'head'); const sway = f === 1 ? -1 : f === 2 ? 1 : 0, hx = bx + 6 + (f === 3 ? 3 : sway), hy = 10;
    for (let i = 0; i <= 10; i++) { const t = i / 10; p.disc(lerp(bx, hx - 2, t) + Math.sin(t * 3) * 2, lerp(gy - 3, hy + 5, t), 1.4, i % 3 ? F.c3 : F.c1); }
    const open = f === 3 ? 6 : 2.5;
    p.poly([[hx - 7, hy], [hx + 5, hy - open - 3], [hx + 9, hy - 1]], F.c1);
    p.poly([[hx - 7, hy + 1], [hx + 9, hy + 1 + open], [hx + 5, hy + open + 4]], shade(F.c1, -0.12));
    p.poly([[hx - 5, hy], [hx + 5, hy - open], [hx + 7, hy]], F.c2); p.poly([[hx - 5, hy + 1], [hx + 7, hy + 1], [hx + 5, hy + open + 1]], shade(F.c2, -0.15));
    for (let i = 0; i < 4; i++) { p.px(hx - 3 + i * 3, hy - open * (0.2 + i * 0.18) - 1, F.acc); p.px(hx - 3 + i * 3, hy + 2 + open * (0.2 + i * 0.18), F.acc); }
    p.px(hx - 4, hy - 2, F.eye);
  },

  /* ---- foxes: frostkit, rimefox, glacier kitsune, snowstalker ---- */
  fox(p, F, f) {
    const W = p.w, H = p.h, st = F.stage, k = st === 1 ? 1 : st === 2 ? 1.25 : 1.55;
    const cat = F.id === 'snowstalker', nine = F.id === 'kitsune';
    const gy = H - 2, legH = R2((cat ? 3.6 : nine ? 5 : 4) * k * 0.85), bRy = (cat ? 3.2 : 2.5) * k, bRx = (cat ? 7.4 : 5.2) * k;
    const bx = R2(W / 2 - (cat ? 0 : 1.5) * k), by = gy - legH - bRy + 1;
    const step = f === 1 ? 1 : f === 2 ? -1 : 0, lunge = f === 3 ? R2(2 * k) : 0, lw = Math.max(1, R2(k * 0.85));
    const leg = (x, off, col) => { const y0 = R2(by + bRy * 0.3); p.rect(R2(x + off), y0, lw, gy - y0, col); p.px(R2(x + off) + lw, gy, col); };
    rigOrient(p, 'side'); rigPart(p, 'leg:f'); leg(bx - bRx * 0.55, -step, F.c3); leg(bx + bRx * 0.5 + lunge * 0.5, step, F.c3);
    // tails
    rigPart(p, 'tail'); const tail = (ang, len, w) => {
      const tx = bx - bRx + 1, ty = by - 1;
      for (let i = 0; i <= len; i++) { const t = i / len, x = tx - Math.cos(ang) * i * 1.1, y = ty - Math.sin(ang) * i * 1.1 - Math.sin(t * 3 + f) * 0.6; p.disc(x, y, Math.max(0.8, w * Math.sin(Math.min(1, t * 1.6 + 0.25) * Math.PI * 0.85)), t > 0.75 ? F.c2 : cat && R2(i) % 3 === 0 ? F.acc : F.c1); }
    };
    // the kitsune's tails fan out to both sides when it faces you
    if (nine) for (let i = 0; i < 5; i++) { rigPart(p, i === 2 ? 'tail' : i % 2 ? 'tail:n' : 'tail:f'); tail(0.25 + i * 0.32, 8 * k * 0.8, 1.6 * k); }
    else tail(cat ? 0.15 : 0.6, (cat ? 9 : 5.5) * k, (cat ? 1.4 : 1.9) * k);
    rigPart(p, 'body'); p.ball(bx, by, bRx, bRy, F.c1, 0.3, -0.3);
    p.ell(bx + 1, by + bRy * 0.55, bRx * 0.6, bRy * 0.3, shade(F.c2, -0.05));
    if (cat) for (let i = 0; i < 5; i++) p.px(R2(bx - bRx * 0.6 + i * 2.6), R2(by - bRy * 0.3 + (i % 2)), F.acc);
    if (F.id === 'rimefox' || nine) for (let i = 0; i < 3; i++) { const x = R2(bx - 3 + i * 3); p.line(x, R2(by - bRy), x + 1, R2(by - bRy - 2 - (i % 2)), F.acc); }
    rigPart(p, 'leg:n'); leg(bx - bRx * 0.3, step, shade(F.c1, -0.12)); leg(bx + bRx * 0.75 + lunge * 0.5, -step, shade(F.c1, -0.12));
    // head
    rigPart(p, 'head'); const r = (cat ? 3 : 2.4) * k, hx = bx + bRx * 0.95 + lunge, hy = by - bRy * (cat ? 0.6 : 0.95);
    const ear = (x) => p.poly([[x - r * 0.5, hy - r * 0.5], [x - r * 0.1, hy - r * (cat ? 1.4 : 2.1)], [x + r * 0.35, hy - r * 0.55]], cat ? F.c1 : shade(F.c1, -0.15));
    rigPart(p, 'head:f'); ear(hx - r * 0.35); rigPart(p, 'head:n'); if (!cat) ear(hx + r * 0.3);
    rigPart(p, 'head');
    p.ball(hx, hy, r, r * 0.88, F.c1, 0.3, -0.25);
    const sx = hx + r * 0.5, sy = hy + r * 0.1;
    p.poly([[sx, sy - r * 0.35], [sx + r * (cat ? 0.9 : 1.4), sy + r * 0.2], [sx, sy + r * 0.55]], shade(F.c2, -0.04));
    p.px(R2(sx + r * (cat ? 0.9 : 1.4)), R2(sy + r * 0.2), F.c3);
    if (f === 3) { p.line(R2(sx), R2(sy + r * 0.5), R2(sx + r), R2(sy + r * 0.6), '#2a0a10'); }
    p.px(R2(hx + r * 0.25), R2(hy - r * 0.2), F.eye); if (k > 1.2) p.px(R2(hx + r * 0.25) + 1, R2(hy - r * 0.2), F.eye);
    rigPart(p, 'body'); if (nine) for (let i = 0; i < 3; i++) p.disc(bx - bRx - 4 + i * 6, 3 + (i + f) % 2, 1.2, F.acc);
  },

  /* ---- beetles: sparkmite, voltbeetle, thunderhorn, stormwing ---- */
  beetle(p, F, f) {
    const W = p.w, H = p.h, st = F.stage, gy = H - 2, step = f === 1 ? 1 : f === 2 ? -1 : 0;
    if (F.id === 'stormwing') {
      rigOrient(p, 'side');
      const cx = R2(W / 2) - 2, cy = 14;
      // wings flap with the frame
      const up = f % 2 === 0;
      // far wing, then near wing, both rooted on the thorax
      rigPart(p, 'wing:f'); p.poly([[cx, cy - 2], [cx - 9, up ? cy - 13 : cy - 5], [cx - 13, up ? cy - 10 : cy - 2], [cx - 3, cy]], shade(F.acc, -0.15), 170);
      rigPart(p, 'wing:n'); p.poly([[cx + 1, cy - 2], [cx - 4, up ? cy - 15 : cy - 7], [cx - 9, up ? cy - 13 : cy - 3], [cx - 1, cy]], F.acc, 200);
      p.line(cx, cy - 2, cx - 6, up ? cy - 13 : cy - 5, '#ffffff', 200);
      // abdomen with stinger, thorax, head
      rigPart(p, 'body'); for (let i = 0; i < 4; i++) p.ball(cx - 4 - i * 2.6, cy + 2 + i * 1.2, 3.2 - i * 0.4, 2.6 - i * 0.3, i % 2 ? F.c2 : F.c1, 0.3, -0.3);
      p.line(cx - 14, cy + 6, cx - 17, cy + 8 + (f === 3 ? -2 : 0), '#ffffff');
      p.ball(cx + 1, cy, 3.4, 3, F.c1, 0.3, -0.3); rigPart(p, 'head'); p.ball(cx + 5, cy - 1, 2.6, 2.4, F.c3, 0.3, -0.3);
      p.px(cx + 6, cy - 2, F.eye); p.px(cx + 7, cy - 2, F.eye);
      p.line(cx + 6, cy - 3, cx + 9, cy - 7, F.c3); p.px(cx + 9, cy - 8, F.c2);
      rigPart(p, 'leg'); for (let i = 0; i < 3; i++) p.line(cx - 1 + i * 2, cy + 2, cx - 2 + i * 2 + step, cy + 6, F.c3);
      return;
    }
    rigOrient(p, 'side'); rigPart(p, 'leg:f'); const k = st === 1 ? 1 : st === 2 ? 1.3 : 1.65, horn = F.id === 'thunderhorn';
    const rx = 6 * k, ry = 4 * k, cx = R2(W / 2 - 1.5 * k), cy = gy - ry - R2(1.5 * k);
    for (let i = 0; i < 3; i++) {
      const lx = cx - rx * 0.5 + i * rx * 0.5, o = (i % 2 ? step : -step);
      p.line(R2(lx), R2(cy + ry * 0.5), R2(lx + o - 1), gy, F.c3);
    }
    rigPart(p, 'body'); p.ball(cx, cy, rx, ry, F.c1, 0.4, -0.35);
    p.line(R2(cx - rx * 0.1), R2(cy - ry + 1), R2(cx - rx * 0.1), R2(cy + ry - 1), shade(F.c1, -0.35));
    // lightning on the shell
    const zx = cx - rx * 0.55, zy = cy - ry * 0.5;
    p.line(R2(zx), R2(zy), R2(zx + 2 * k), R2(zy + 1.5 * k), F.c2); p.line(R2(zx + 2 * k), R2(zy + 1.5 * k), R2(zx + 1 * k), R2(zy + 2 * k), F.c2); p.line(R2(zx + 1 * k), R2(zy + 2 * k), R2(zx + 3.2 * k), R2(zy + 3.4 * k), F.c2);
    for (let i = 0; i < 3; i++) p.px(R2(cx + i * 2 * k - 2), R2(cy - ry * 0.6 + (i % 2)), shade(F.c1, 0.4));
    rigPart(p, 'leg:n'); for (let i = 0; i < 3; i++) { const lx = cx - rx * 0.3 + i * rx * 0.45, o = (i % 2 ? -step : step); p.line(R2(lx), R2(cy + ry * 0.6), R2(lx + o + 1), gy, shade(F.c3, 0.15)); }
    rigPart(p, 'head'); const hx = cx + rx * 0.95 + (f === 3 ? 2 : 0), hy = cy + ry * 0.15, hr = 2.4 * k;
    p.ball(hx, hy, hr, hr * 0.9, F.c3, 0.3, -0.25);
    p.px(R2(hx + hr * 0.3), R2(hy - hr * 0.3), F.eye); if (k > 1.2) p.px(R2(hx + hr * 0.3) + 1, R2(hy - hr * 0.3), F.eye);
    if (horn) {
      const hb = f === 3 ? -2 : 0;
      p.poly([[hx + hr * 0.2, hy - hr * 0.6], [hx + hr * 3.2, hy - hr * 2.4 + hb], [hx + hr * 2.4, hy - hr * 1.2 + hb * 0.5], [hx + hr * 0.9, hy]], F.acc);
      p.px(R2(hx + hr * 3.2), R2(hy - hr * 2.4 + hb), F.c2);
    } else {
      const op = f === 3 ? 1.5 : 0.5;
      p.line(R2(hx + hr * 0.6), R2(hy - op), R2(hx + hr * 1.6), R2(hy - op - 1), F.c3); p.line(R2(hx + hr * 0.6), R2(hy + op + 1), R2(hx + hr * 1.6), R2(hy + op + 2), F.c3);
    }
    p.line(R2(hx), R2(hy - hr), R2(hx + hr * 1.4), R2(hy - hr * 2.4), F.c3); p.px(R2(hx + hr * 1.4), R2(hy - hr * 2.4) - 1, F.c2);
  },

  /* ---- shades: gloomling, shade, void reaper, nightmare (all float) ---- */
  shade(p, F, f) {
    const W = p.w, H = p.h, cx = R2(W / 2), wob = f === 1 ? 1 : f === 2 ? -1 : 0;
    rigOrient(p, 'front', { depth: 0.9, float: true });
    if (F.id === 'gloomling') {
      const cy = 8;
      rigPart(p, 'tail'); for (let i = 0; i < 6; i++) p.disc(cx - 1 + Math.sin(i * 1.3 + f) * 1.5 - i * 0.6, cy + 6 + i * 1.4, Math.max(0.6, 3.2 - i * 0.55), i % 2 ? F.c3 : F.c1);
      rigPart(p, 'body'); p.ball(cx, cy, 6, 5.5, F.c1, 0.35, -0.3);
      p.px(cx - 3, cy - 3, F.c2); p.px(cx - 2, cy - 4, F.c2);
      rigPart(p, 'face'); p.rect(cx, cy - 1, 2, 3, F.eye); p.rect(cx + 3, cy - 1, 2, 3, F.eye); p.px(cx + 1, cy, '#1a1214'); p.px(cx + 4, cy, '#1a1214');
      if (f === 3) p.rect(cx + 1, cy + 3, 3, 1, '#ff6f9c');
      return;
    }
    if (F.id === 'shade') {
      const top = 3, bot = H - 4;
      rigPart(p, 'body'); p.poly([[cx, top], [cx + 6, top + 6], [cx + 7, bot - 6], [cx + 4 + wob, bot], [cx - 1, bot - 3], [cx - 4 - wob, bot], [cx - 7, bot - 6], [cx - 6, top + 6]], F.c1, 230);
      rigPart(p, 'head'); p.poly([[cx, top + 1], [cx + 4, top + 6], [cx - 4, top + 6]], F.c2);
      rigPart(p, 'face'); p.ell(cx + 1, top + 8, 3.6, 3, '#05030a');
      p.px(cx + 1, top + 8, F.eye); p.px(cx + 3, top + 8, F.eye);
      rigPart(p, 'arm'); const arm = f === 3 ? -4 : 0;
      p.line(cx + 6, top + 12, cx + 10, top + 15 + arm, F.c2); p.line(cx - 6, top + 12, cx - 9, top + 16, F.c3);
      return;
    }
    if (F.id === 'reaper') {
      const top = 4, bot = H - 3;
      // scythe behind/in front
      rigPart(p, 'gear'); const sa = f === 3 ? -1 : 0;
      p.line(cx + 9, bot - 2, cx + 6 + sa * 4, top - 1, F.acc);
      p.line(cx + 10, bot - 2, cx + 7 + sa * 4, top - 1, shade(F.acc, -0.3));
      for (let i = 0; i < 10; i++) { const x = cx + 6 + sa * 4 - i * 1.2, y = top - 1 + Math.sin(i / 9 * 2.6) * 4; p.px(x, y, F.c2); p.px(x, y + 1, '#ffffff'); }
      rigPart(p, 'body'); p.poly([[cx, top], [cx + 7, top + 7], [cx + 8, bot - 5], [cx + 5 + wob, bot], [cx + 1, bot - 2], [cx - 3, bot], [cx - 7 - wob, bot - 1], [cx - 8, top + 9]], F.c1, 240);
      rigPart(p, 'head'); p.poly([[cx, top], [cx + 5, top + 5], [cx + 4, top + 10], [cx - 3, top + 10], [cx - 4, top + 5]], shade(F.c1, 0.12));
      rigPart(p, 'face'); p.ell(cx + 1, top + 7, 3, 2.6, '#020104'); p.px(cx + 1, top + 7, F.eye); p.px(cx + 3, top + 7, F.eye);
      rigPart(p, 'body'); p.rect(cx + 6, top + 14 + sa * 3, 3, 2, '#d8d0bc');
      return;
    }
    // nightmare: a mass of dark with too many eyes
    const cy = H / 2 - 1;
    rigPart(p, 'leg'); for (let i = 0; i < 7; i++) { const x = cx - 9 + i * 3, y = H - 4; p.line(x, cy + 4, x + Math.sin(i + f) * 2, y + (i % 2), F.c3); }
    rigPart(p, 'body'); p.ball(cx, cy, 11, 8.5, F.c1, 0.25, -0.3);
    for (let i = 0; i < 6; i++) { const a = -2.6 + i * 0.5; p.px(cx + Math.cos(a) * 11, cy + Math.sin(a) * 8 - 1, F.c2); p.px(cx + Math.cos(a) * 12, cy + Math.sin(a) * 9 - 2 - (i + f) % 2, F.c2); }
    const eyes = [[4, -2, 1.6], [-2, -3, 1.2], [7, 2, 1.1], [0, 2, 1.4], [-6, 0, 1], [3, 5, 0.9]];
    rigPart(p, 'face'); for (const [ex, ey, er] of eyes) { p.disc(cx + ex, cy + ey, er + 0.6, '#ffffff'); p.disc(cx + ex + 0.4, cy + ey, er * 0.55, f === 3 ? F.acc : F.eye); }
  },

  /* ---- golems: pebblet, boulderback, mountain titan, crystal golem ---- */
  golem(p, F, f) {
    const W = p.w, H = p.h, gy = H - 2, step = f === 1 ? 1 : f === 2 ? -1 : 0;
    if (F.id === 'pebblet') {
      rigOrient(p, 'front', 1.1);
      const cx = R2(W / 2), cy = gy - 6;
      rigPart(p, 'leg'); p.rect(cx - 4 + step, gy - 2, 3, 3, F.c3); p.rect(cx + 2 - step, gy - 2, 3, 3, F.c3);
      rigPart(p, 'body'); p.ball(cx, cy, 6.2, 5.2, F.c1, 0.35, -0.35);
      p.line(cx - 3, cy - 2, cx - 1, cy + 1, F.c3); p.line(cx + 1, cy + 2, cx + 3, cy + 1, F.c3);
      p.rect(cx - 2, cy - 6, 4, 1, F.acc); p.px(cx - 1, cy - 7, F.acc); p.px(cx + 1, cy - 7, shade(F.acc, 0.2));
      rigPart(p, 'face'); p.px(cx + 2, cy - 1, F.eye); p.px(cx + 4, cy - 1, F.eye);
      rigPart(p, 'body'); if (f === 3) { p.rect(cx + 5, cy, 3, 3, F.c1); p.px(cx + 7, cy + 1, F.c2); }
      return;
    }
    if (F.id === 'boulderback') {
      rigOrient(p, 'side');
      const cx = R2(W / 2) - 2, cy = gy - 10;
      for (let i = 0; i < 4; i++) { const lx = cx - 7 + i * 4.5, o = i % 2 ? step : -step; rigPart(p, i % 2 ? 'leg:n' : 'leg:f'); p.rect(lx + o, gy - 4, 3, 5, F.c3); }
      rigPart(p, 'body'); p.ell(cx, gy - 5, 10, 3, F.c3);
      p.ball(cx, cy, 10, 7.5, F.c1, 0.35, -0.35);
      p.line(cx - 6, cy - 3, cx - 2, cy + 2, shade(F.c1, -0.3)); p.line(cx + 2, cy - 5, cx + 5, cy, shade(F.c1, -0.3));
      p.rect(cx - 4, cy - 8, 6, 1, F.acc); p.px(cx - 3, cy - 9, F.acc); p.px(cx, cy - 9, F.acc);
      rigPart(p, 'head'); const hx = cx + 11 + (f === 3 ? 2 : 0), hy = gy - 6;
      p.ball(hx, hy, 3.6, 3, F.c2, 0.3, -0.25); p.px(hx + 1, hy - 1, F.eye); p.px(hx + 2, hy - 1, F.eye);
      if (f === 3) p.rect(hx + 1, hy + 1, 3, 1, '#2a2418');
      return;
    }
    // humanoid golems
    rigOrient(p, 'front', 1.1);
    const crys = F.id === 'crystalgolem', cx = R2(W / 2) - 1, hip = gy - 9;
    rigPart(p, 'leg'); p.rect(cx - 6 + step, hip, 5, gy - hip + 1, F.c3); p.rect(cx + 2 - step, hip, 5, gy - hip + 1, shade(F.c3, 0.12));
    rigPart(p, 'body'); p.poly([[cx - 10, hip - 14], [cx + 11, hip - 14], [cx + 9, hip + 1], [cx - 8, hip + 1]], F.c1);
    p.rect(cx - 10, hip - 14, 3, 14, shade(F.c1, 0.15)); p.rect(cx + 8, hip - 14, 3, 14, shade(F.c1, -0.25));
    if (!crys) { p.line(cx - 4, hip - 10, cx, hip - 5, F.c3); p.line(cx, hip - 5, cx + 4, hip - 8, F.c3); p.disc(cx + 1, hip - 8, 2, F.eye); p.px(cx + 1, hip - 8, '#ffffff'); }
    else for (let i = 0; i < 4; i++) p.line(cx - 6 + i * 4, hip - 12, cx - 4 + i * 4, hip - 3, shade(F.c2, -0.2));
    // head
    rigPart(p, 'head'); p.rect(cx - 3, hip - 20, 8, 6, shade(F.c1, 0.05)); p.rect(cx - 3, hip - 20, 8, 1, shade(F.c1, 0.3));
    rigPart(p, 'face'); p.px(cx + 2, hip - 18, F.eye); p.px(cx + 4, hip - 18, F.eye);
    // arms: the near arm punches on attack
    rigPart(p, 'arm'); const punch = f === 3;
    p.rect(cx - 13, hip - 13 + step, 4, 12, shade(F.c1, -0.1)); p.rect(cx - 14, hip - 2 + step, 5, 4, F.c3);
    if (punch) { p.rect(cx + 10, hip - 12, 9, 4, F.c1); p.rect(cx + 18, hip - 13, 4, 6, F.c3); }
    else { p.rect(cx + 10, hip - 13 - step, 4, 12, F.c1); p.rect(cx + 10, hip - 2 - step, 5, 4, F.c3); }
    rigPart(p, 'body'); 
    if (crys) {
      const shard = (x, y, hgt, lean) => { p.poly([[x - 2, y], [x + lean, y - hgt], [x + 2, y]], F.c2); p.line(x, y - 1, x + lean * 0.8, y - hgt + 1, '#ffffff'); };
      shard(cx - 8, hip - 14, 7, -2); shard(cx - 4, hip - 14, 9, 0); shard(cx + 7, hip - 14, 8, 2); shard(cx + 1, hip - 20, 6, 1);
      p.px(cx - 9, hip - 7, F.acc); p.px(cx + 5, hip - 4, F.acc);
    } else { p.rect(cx - 2, hip - 22, 2, 2, F.acc); p.rect(cx + 3, hip - 21, 2, 1, F.acc); }
  },
};

