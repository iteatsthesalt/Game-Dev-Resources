// STUB: replaced by the real module. Matches CONTRACTS.md so the app builds.
import { createEmitter } from '../core/util.js';

export function createPointers(target, { screenToWorld, getSettings }) {
  const ev = createEmitter();
  const live = new Map();
  const onDown = (e) => {
    const r = target.getBoundingClientRect();
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
    const p = { x: w.x, y: w.y, vx: 0, vy: 0, power: 1, age: 0, held: true, id: 't' + e.pointerId, kind: 'touch' };
    live.set(e.pointerId, p);
    target.setPointerCapture?.(e.pointerId);
    ev.emit('activity');
    ev.emit('down', { x: p.x, y: p.y, power: 1, id: p.id, kind: 'touch' });
  };
  const onMove = (e) => {
    const p = live.get(e.pointerId);
    if (!p) return;
    const r = target.getBoundingClientRect();
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
    p.x = w.x; p.y = w.y;
    ev.emit('activity');
  };
  const onUp = (e) => {
    const p = live.get(e.pointerId);
    if (!p) return;
    live.delete(e.pointerId);
    ev.emit('up', { x: p.x, y: p.y, vx: 0, vy: 0, power: 1, heldFor: p.age, id: p.id });
  };
  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onUp);
  return {
    update(dt) { for (const p of live.values()) p.age += dt; },
    poles: () => [...live.values()].map((p) => ({ ...p })),
    active: () => live.size,
    clearPins() {},
    on: ev.on,
    dispose() {},
  };
}
