/* ============================================================
   Cinderdeep — other heroes. Everyone who has the Realm open
   right now shares it: you see the heroes in your zone walking
   around in their evolved forms, with their names, and you can
   chat and wave. Without a connection the Realm plays solo.
   ============================================================ */
const MMO = { room: null, user: null, zr: null, zone: null, want: null, unsub: [], peers: new Map(), names: Object.create(null), asked: new Set(), log: [], lastSent: 0, lastPres: '', tried: false, chatDenied: false, joining: false };
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const finite = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
async function mmoInit() {
  if (MMO.tried) return;
  MMO.tried = true;
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    const [room, user] = await Promise.all([withTimeout(window.claude.use('room'), 10000), withTimeout(window.claude.use('user'), 10000)]);
    MMO.room = room || null; MMO.user = user || null;
    if (MMO.room && W.on && W.Z) mmoJoinZone(W.Z.id);
  } catch (e) { MMO.room = null; }
}
async function mmoJoinZone(zoneId) {
  MMO.want = zoneId;
  if (!MMO.room || MMO.joining || (MMO.zone === zoneId && MMO.zr)) return;
  MMO.joining = true;
  try {
    await mmoLeaveZone();
    const zr = await withTimeout(MMO.room.join('z-' + zoneId), 10000);
    if (!zr) throw new Error('join timed out');
    MMO.zr = zr; MMO.zone = zoneId; MMO.lastPres = '';
    MMO.unsub.push(zr.onPeers((ch) => mmoSyncPeers(ch.peers), () => {}));
    MMO.unsub.push(zr.on('chat', mmoOnChat, () => {}));
    MMO.unsub.push(zr.on('emote', mmoOnEmote, () => {}));
  } catch (e) { MMO.zr = null; MMO.zone = null; }
  MMO.joining = false;
  // the hero walked on while we were joining
  if (W.on && W.Z && MMO.want && MMO.want !== MMO.zone) mmoJoinZone(MMO.want);
}
async function mmoLeaveZone() {
  for (const u of MMO.unsub) { try { u(); } catch (e) { /* gone */ } }
  MMO.unsub = [];
  const zr = MMO.zr;
  MMO.zr = null; MMO.zone = null; MMO.peers.clear();
  if (zr) { try { await zr.leave(); } catch (e) { /* gone */ } }
}
function mmoLeave() { mmoLeaveZone(); }
function mmoSyncPeers(list) {
  const seen = new Set();
  for (const q of list) {
    if (q.isMe || q.kind !== 'viewer') continue;
    const pr = q.presence || {};
    if (!Number.isFinite(pr.x) || !Number.isFinite(pr.y) || pr.z !== MMO.zone || !W.Z || pr.z !== W.Z.id) continue;
    seen.add(q.peer);
    let gh = MMO.peers.get(q.peer);
    if (!gh) { gh = { peer: q.peer, by: q.by, x: clamp(pr.x, 0, ZT * TS), y: clamp(pr.y, 0, ZT * TS), anim: 0, say: null, emote: null }; MMO.peers.set(q.peer, gh); }
    gh.pres = pr; gh.by = q.by; gh.tx = clamp(pr.x, 0, ZT * TS); gh.ty = clamp(pr.y, 0, ZT * TS); gh.seen = performance.now();
    const id = typeof q.by === 'string' && q.by ? q.by : typeof pr.uid === 'string' && pr.uid.length < 80 ? 'u:' + pr.uid : null;
    if (id && !MMO.names[id] && !MMO.asked.has(id) && MMO.user && MMO.user.profiles) { MMO.asked.add(id); MMO.user.profiles([id.replace(/^u:/, '')]).then((ps) => { const k = id.replace(/^u:/, ''), n = ps && own(ps, k) && ps[k] && typeof ps[k].name === 'string' ? cleanText(ps[k].name).slice(0, 24) : ''; MMO.names[id] = n || 'Hero'; }).catch(() => { MMO.names[id] = 'Hero'; }); }
  }
  for (const k of [...MMO.peers.keys()]) if (!seen.has(k)) MMO.peers.delete(k);
}
const mmoCount = () => [...MMO.peers.values()].filter((q) => !q.pres.inst).length;
function mmoGhosts() { return W.on && !W.inInst ? [...MMO.peers.values()].filter((q) => !q.pres.inst) : []; }
function mmoName(q) { const id = typeof q.by === 'string' && q.by ? q.by : typeof q.pres.uid === 'string' ? 'u:' + q.pres.uid : null; const n = id && MMO.names[id]; return typeof n === 'string' ? n : 'Hero'; }
// your presence: where you are and what you look like
hook('update', (dt) => {
  if (!W.on || !MMO.zr) return;
  const p = G.p, now = performance.now();
  for (const q of MMO.peers.values()) { const k = 1 - Math.exp(-10 * dt); const dx = q.tx - q.x, dy = q.ty - q.y; q.moving = Math.hypot(dx, dy) > 2; q.x += dx * k; q.y += dy * k; if (q.moving) q.anim += dt * 6; if (q.say && (q.say.t -= dt) <= 0) q.say = null; if (q.emote && (q.emote.t -= dt) <= 0) q.emote = null; }
  if (!W.Z || MMO.zone !== W.Z.id) return; // never tell one zone where you stand in another
  if (now - MMO.lastSent < 110) return;
  MMO.lastSent = now;
  const pres = {
    z: MMO.zone, x: Math.round(p.x), y: Math.round(p.y), c: p.cls, fm: p.form || null, a: ascAspect(p) || null, s: ascStage(p), lv: p.level, f: p.face < 0 ? -1 : 1, v: p.view === 'back' ? 1 : 0, t: heroTurn(p),
    m: p.mounted ? 1 : 0, inst: W.inInst ? 1 : 0, dead: p.dead ? 1 : 0, dy: W.ch && W.ch.dye ? W.ch.dye.main : null, uid: MMO.uid || null,
  };
  const s = JSON.stringify(pres);
  if (s === MMO.lastPres) return;
  MMO.lastPres = s;
  MMO.zr.presence(pres).catch(() => { MMO.lastPres = ''; MMO.lastSent = now + 1500; });
});
hook('realmZone', (Z) => { if (!MMO.tried) mmoInit(); else mmoJoinZone(Z.id); });
(async () => { try { if (window.claude && window.claude.use) { const u = await withTimeout(window.claude.use('user'), 10000); if (u && u.id) MMO.uid = await withTimeout(u.id(), 5000); } } catch (e) { /* solo */ } })();

/* ---------- drawing other heroes ---------- */
function ghostBody(q) {
  const pr = q.pres, cls = own(CLASS, pr.c) ? pr.c : 'knight', st = clamp(finite(pr.s) | 0, 0, ASC_MAX), a = own(ASPECT, pr.a) ? pr.a : null;
  const dyeLook = typeof pr.dy === 'string' ? (DYE_LIST.find((d) => d.main === pr.dy) || null) : null;
  const fake = { cls, look: dyeLook ? { ...CLASS[cls].look, ...dyeLook } : CLASS[cls].look, beast: !!CLASS[cls].beast, form: own(FORMS, pr.fm) ? pr.fm : CLASS[cls].beast ? cls : null, asc: a ? Array(st).fill(a) : [], ascAtt: [], view: pr.v ? 'back' : 'front', turn: Number.isInteger(pr.t) && pr.t >= 0 && pr.t <= 4 ? pr.t : pr.v ? 4 : 0, rigLazy: true, face: pr.f || 1, moving: q.moving, anim: q.anim, dashT: 0, atkPose: 0, leapT: 0, bashT: 0, aim: 0, dyeKey: pr.dy || '' };
  return heroFrame(fake);
}
const DYES_BY_MAIN = {
  ember: { main: '#b33a2a', cloth: '#6e1f1a', trim: '#f2b53c' }, royal: { main: '#3a5e9a', cloth: '#22385e', trim: '#ffd35c' }, forest: { main: '#4f7a3a', cloth: '#2f4d24', trim: '#c8a070' },
  night: { main: '#2c2a34', cloth: '#18161e', trim: '#c873ff' }, bone: { main: '#e8e0d0', cloth: '#a89880', trim: '#c8902a' }, rose: { main: '#c8508a', cloth: '#7a2a5a', trim: '#ffe0f0' }, steel: { main: '#8fa3b8', cloth: '#55677c', trim: '#2f5fa8' },
};
const DYE_LIST = Object.values(DYES_BY_MAIN);
function drawGhostPlayer(g, q, cx, cy) {
  let sp;
  try { sp = ghostBody(q); } catch (e) { return; }
  const x = q.x - cx, y = q.y - cy;
  shadow(g, x, y, 6);
  if (q.pres.m) drawSprite(g, mountFrames()[q.moving ? 1 + (Math.floor(q.anim * 0.7) % 2) : 0], x, y + 2, (q.pres.f || 1) < 0, {});
  const bob = q.emote && q.emote.e === 'dance' ? Math.abs(Math.sin(G.t * 10)) * 3 : 0;
  drawSprite(g, sp, x, y - (q.pres.m ? 9 : 0) - bob, (q.pres.f || 1) < 0, { alpha: q.pres.dead ? 0.4 : 1, outline: '#2a5aa8' });
  const name = mmoName(q).toUpperCase().slice(0, 16), t = pixelText(`${name} ${clamp(finite(q.pres.lv) | 0, 0, 999)}`, '#9ad0ff');
  const top = y - sp.h - (q.pres.m ? 9 : 0) - 4;
  g.globalAlpha = 0.85; g.fillStyle = '#0b0709'; g.fillRect(Math.round(x - t.width / 2) - 2, Math.round(top) - 1, t.width + 4, t.height + 2); g.globalAlpha = 1;
  g.drawImage(t, Math.round(x - t.width / 2), Math.round(top));
  const bubble = q.say || (q.emote && own(EMOTES, q.emote.e) ? { text: EMOTES[q.emote.e] } : null);
  if (bubble) {
    const bt = speechText(bubble.text), by = top - bt.height - 6;
    g.fillStyle = 'rgba(244,236,216,0.95)'; g.fillRect(Math.round(x - bt.width / 2) - 3, Math.round(by) - 2, bt.width + 6, bt.height + 4); g.fillRect(Math.round(x) - 1, Math.round(by + bt.height + 2), 3, 2);
    g.drawImage(bt, Math.round(x - bt.width / 2), Math.round(by));
  }
}

/* ---------- chat and emotes ---------- */
const EMOTES = { wave: 'waves', cheer: 'cheers!', dance: 'dances', bow: 'bows', laugh: 'ha ha!', help: 'help!' };
// printable text only: no control, format, bidi, tag or private-use characters, no piles of combining marks
const cleanText = (s) => {
  let marks = 0;
  return [...String(s || '')].filter((ch) => {
    const c = ch.codePointAt(0);
    if (c < 32 || (c >= 0xd800 && c <= 0xdfff) || (c >= 127 && c < 160) || c === 0xad || c === 0x61c || c === 0x180e || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x206f) || c === 0xfeff || (c >= 0xfff9 && c <= 0xfffb) || (c >= 0xe000 && c <= 0xf8ff) || (c >= 0xe0000 && c <= 0xe007f) || c >= 0xf0000) return false;
    const combining = (c >= 0x300 && c <= 0x36f) || (c >= 0xfe00 && c <= 0xfe0f) || (c >= 0x1ab0 && c <= 0x1aff) || (c >= 0x20d0 && c <= 0x20ff);
    if (combining) { marks++; return marks <= 2; }
    marks = 0; return true;
  }).slice(0, 120).join('').trim();
};
function mmoOnChat(m) {
  const text = cleanText(m.data && m.data.t);
  if (!text) return;
  const nm = typeof m.by === 'string' ? MMO.names[m.by] : null, who = m.isMe ? 'You' : typeof nm === 'string' ? nm : 'Hero';
  chatLog(who, text, m.isMe);
  if (!m.isMe) { const q = MMO.peers.get(m.peer); if (q) q.say = { text, t: 4.5 }; }
  else W.mySay = { text, t: 4.5 };
}
function mmoOnEmote(m) {
  const e = m.data && own(EMOTES, m.data.e) ? m.data.e : null;
  if (!e) return;
  if (m.isMe) { W.mySay = { text: EMOTES[e], t: 3 }; return; }
  const q = MMO.peers.get(m.peer);
  if (q) q.emote = { e, t: 3 };
}
function chatLog(who, text, me) {
  const box = $('chatlog');
  if (!box) return;
  const row = h('div', { class: me ? 'me' : '' }, h('b', {}, who + ': '), h('span', {}, ''));
  row.querySelector('span').textContent = text;
  box.append(row);
  while (box.children.length > 6) box.firstChild.remove();
  setTimeout(() => row.classList.add('old'), 9000);
  setTimeout(() => row.remove(), 10500);
}
async function mmoSay(text) {
  text = cleanText(text);
  if (!text) return;
  if (text.startsWith('/')) { const e = text.slice(1).toLowerCase(); if (EMOTES[e]) return mmoEmote(e); }
  if (!MMO.zr) { chatLog('You', text, true); W.mySay = { text, t: 4 }; toast('No one else is here right now', '#9ad0ff'); return; }
  try { await MMO.zr.emit('chat', { t: text }); }
  catch (e) { if (e && e.code === 'not_permitted' && !MMO.chatDenied) { MMO.chatDenied = true; toast('Chat is not open to you on this page. You can still wave.', '#9ad0ff'); } W.mySay = { text, t: 4 }; }
}
async function mmoEmote(e) {
  if (!EMOTES[e]) return;
  W.mySay = { text: EMOTES[e], t: 3 };
  if (MMO.zr) { try { await MMO.zr.emit('emote', { e }); } catch (err) { /* local only */ } }
}
hook('renderGlass', (g) => {
  if (!W.on || W.inInst || !W.mySay) return;
  const p = G.p, sp = heroFrame(p), t = speechText(W.mySay.text), q = v3Project(p.x, p.y);
  const x = Math.round(q.x), y = Math.round(q.y - sp.h - (p.mounted ? 9 : 0) - 6 - t.height);
  g.fillStyle = 'rgba(244,236,216,0.95)'; g.fillRect(x - t.width / 2 - 3, y - 2, t.width + 6, t.height + 4); g.fillRect(x - 1, y + t.height + 2, 3, 2);
  g.drawImage(t, x - t.width / 2, y);
});
hook('update', (dt) => { if (W.mySay && (W.mySay.t -= dt) <= 0) W.mySay = null; });
UI.chat = function () {
  if (!W.on || UI.top()) return;
  const inp = h('input', { type: 'text', maxlength: '120', placeholder: 'Say something, or /wave /cheer /dance /bow', 'aria-label': 'Chat message', class: 'chatin' });
  const send = () => { const v = inp.value; UI.close(el); mmoSay(v); };
  const el = h('div', { class: 'modal chatmodal' }, h('div', { class: 'panel' },
    h('h2', {}, MMO.zr ? `Chat · ${mmoCount()} other hero${mmoCount() === 1 ? '' : 'es'} in this land` : 'Chat'),
    inp,
    h('div', { class: 'row' }, ...Object.keys(EMOTES).map((e) => btn(e, () => { UI.close(el); mmoEmote(e); }, 'small'))),
    h('div', { class: 'row' }, btn('Send', send, 'primary'), btn('Close', () => UI.close(el)))));
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); if (e.key === 'Escape') UI.close(el); });
  UI.open(el, { modal: true, replace: false });
  setTimeout(() => { try { inp.focus(); } catch (e) { /* touch */ } }, 30);
};
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !W.on || UI.top() || G.mode !== 'play') return;
  const t = e.target && e.target.tagName;
  if (t === 'INPUT' || t === 'TEXTAREA') return;
  e.preventDefault();
  UI.chat();
});
pauseItem('chat', 85, (el) => (W.on ? btn(MMO.zr ? `Chat and emotes · ${mmoCount()} here` : 'Chat and emotes', () => { UI.close(el); UI.chat(); }) : null));

