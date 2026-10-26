/* ============================================================
   Cinderdeep — utilities: math, seeded RNG, DOM, storage
   ============================================================ */
'use strict';
const CD = (window.CD = window.CD || {});
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const approach = (v, t, s) => (v < t ? Math.min(t, v + s) : Math.max(t, v - s));
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

function hashStr(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 ^ h1) >>> 0;
}
function hash2(a, b) {
  let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ (b >>> 0);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
const hashU = (a, b, c = 0) => hash2(hash2(a | 0, b | 0), c | 0) / 4294967296;

class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  weighted(list, w = (x) => x.w) {
    let tot = 0; for (const x of list) tot += Math.max(0, w(x));
    let r = this.next() * tot;
    for (const x of list) { r -= Math.max(0, w(x)); if (r <= 0) return x; }
    return list[list.length - 1];
  }
}
// throwaway randomness for particles and juice (never affects the run)
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (v[sk] == null) continue; if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (s) => { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pct = (v) => `${Math.round(v * 100)}%`;

/* ---------- storage that never throws ---------- */
const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

function withTimeout(p, ms, fallback = null) {
  return Promise.race([p, new Promise((res) => setTimeout(() => res(fallback), ms))]).catch(() => fallback);
}
Object.assign(CD, { clamp, lerp, dist, RNG, hashStr, h, LS });

/* ---------- hooks: later modules plug behaviour into the core loop ---------- */
const HOOKS = {
  dmgMul: [], onHit: [], onKill: [], preHurt: [], onHurt: [], onRoomClear: [], onRoomEnter: [], preFloor: [], onFloor: [],
  update: [], stats: [], spawned: [], projSpawn: [], projHit: [], deathSave: [], potion: [], bossStart: [], saveRun: [], loadRun: [], entOverlay: [], shopStock: [], death: [], renderFloor: [], onDash: [], onAbility: [], onAttack: [], onLevel: [], furnish: [], renderWorld: [], renderTop: [], hud: [], idle: [], runEnd: [], runStart: [],
};
const hook = (name, fn) => { HOOKS[name].push(fn); };
function runHooks(name, a, b, c, d) { const L = HOOKS[name]; for (let i = 0; i < L.length; i++) { try { L[i](a, b, c, d); } catch (e) { console.error('hook ' + name, e); } } }

