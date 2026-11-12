// Phones on the local network: link events from the main process become players and poles.
// A phone's pad covers the whole canvas; its touches go through engine.screenToWorld, get a
// smoothed velocity, and fade out over 0.35 s when lifted. See CONTRACTS.md.
//
// First version, written by the spine. The link part owns this file and replaces it.
// `store` is optional and not in the contract yet: with it, every change of behaviour or
// palette (from any input) is broadcast to the phones.
import { haptic, state } from '../../shared/protocol.js';

const FADE_SECONDS = 0.35;
const VELOCITY_TAU = 0.05;

export function createPhones({ bridge, hub, engine, actions, store }) {
  const phones = new Map(); // player number → { id, color, live: Map(touch id → pole), fading: [] }

  const toWorld = (x, y) => engine.screenToWorld(x * innerWidth, y * innerHeight);
  const send = (player, msg) => { bridge.link.send(player, msg).catch(() => {}); };
  const broadcast = (msg) => { for (const player of phones.keys()) send(player, msg); };

  function join(e) {
    if (phones.has(e.player)) return;
    const p = hub.addPlayer({ kind: 'phone', name: e.name || `Phone ${e.player}`, key: `phone${e.player}` });
    phones.set(e.player, { id: p.id, color: p.color, live: new Map(), fading: [] });
  }

  function leave(e) {
    const phone = phones.get(e.player);
    if (!phone) return;
    phones.delete(e.player);
    hub.removePlayer(phone.id);
  }

  function touch(e) {
    const phone = phones.get(e.player);
    if (!phone) return;
    const down = new Set();
    for (const [id, x, y, f] of e.touches) {
      down.add(id);
      const w = toWorld(x, y);
      const power = f * 2; // f is 0..1 with 0.5 when the phone cannot tell; power is 0..2
      const pole = phone.live.get(id);
      if (pole) {
        pole.tx = w.x;
        pole.ty = w.y;
        pole.power = power;
        continue;
      }
      phone.live.set(id, { x: w.x, y: w.y, tx: w.x, ty: w.y, vx: 0, vy: 0, power, age: 0, held: true, id: `ph${e.player}.${id}`, kind: 'touch', fade: 1 });
      actions.pulse(w.x, w.y, power, phone.color);
      send(e.player, haptic(30, 0.6));
    }
    for (const [id, pole] of phone.live) {
      if (down.has(id)) continue;
      phone.live.delete(id);
      pole.held = false;
      phone.fading.push(pole);
      engine.release(pole.x, pole.y, pole.power, pole.age);
    }
  }

  function act(e) {
    const phone = phones.get(e.player);
    if (!phone) return;
    const dir = e.v || 1;
    if (e.a === 'behaviour') actions.nextBehaviour(dir);
    else if (e.a === 'palette') actions.nextPalette(dir);
    else if (e.a === 'preset') actions.nextPreset(dir);
    else if (e.a === 'surprise') actions.surprise();
    else if (e.a === 'clear') actions.clear();
    else if (e.a === 'pulse') {
      actions.pulse(0, 0, 1.5, phone.color);
      send(e.player, haptic(30, 0.6));
    }
  }

  const offLink = bridge.link.onEvent((e) => {
    if (e.type === 'join') join(e);
    else if (e.type === 'leave') leave(e);
    else if (e.type === 'touch') touch(e);
    else if (e.type === 'act') act(e);
  });
  const offScene = store?.on('scene', (scene, keys) => {
    if (keys.includes('lock') || keys.includes('palette')) broadcast(state({ behaviour: scene.lock, palette: scene.palette }));
  });

  const pub = ({ x, y, vx, vy, power, age, held, id, kind, fade }) => ({ x, y, vx, vy, power, age, held, id, kind, fade });

  return {
    update(dt) {
      const k = 1 - Math.exp(-dt / VELOCITY_TAU);
      for (const phone of phones.values()) {
        for (const p of phone.live.values()) {
          if (dt > 0) {
            p.vx += ((p.tx - p.x) / dt - p.vx) * k;
            p.vy += ((p.ty - p.y) / dt - p.vy) * k;
          }
          p.x = p.tx;
          p.y = p.ty;
          p.age += dt;
        }
        for (const p of phone.fading) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.age += dt;
          p.fade -= dt / FADE_SECONDS;
        }
        phone.fading = phone.fading.filter((p) => p.fade > 0);
        hub.setPoles(phone.id, [...phone.live.values(), ...phone.fading].map(pub));
      }
    },
    dispose() {
      offLink();
      offScene?.();
      for (const phone of phones.values()) hub.removePlayer(phone.id);
      phones.clear();
    },
  };
}
