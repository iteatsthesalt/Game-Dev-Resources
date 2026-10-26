// ---------- FX: particles, post-processing glow and synthesized sound for the stage ----------
window.FX = (() => {
  const P = [], R = Math.random; let last = performance.now(), on = true, ac = null, master = null, amb = null, crackT = 0, torchSeen = 0;
  const rand = (a, b) => a + R() * (b - a);
  const T = {
    ember: { life: [0.6, 1.4], vx: [-12, 12], vy: [-55, -25], g: -10, size: [1.5, 3], col: (k) => `rgba(255,${150 + 100 * k | 0},${40 + 60 * k | 0},${k})`, add: 1 },
    smoke: { life: [1.2, 2.2], vx: [-6, 6], vy: [-22, -12], g: -2, size: [3, 6], grow: 8, col: (k) => `rgba(120,130,140,${0.18 * k})` },
    magic: { life: [0.7, 1.3], vx: [-20, 20], vy: [-30, 10], g: 0, size: [1, 2.6], swirl: 1, col: (k) => `rgba(${170 + 60 * k | 0},150,255,${k})`, add: 1 },
    dust: { life: [0.4, 0.8], vx: [-30, 30], vy: [-18, -4], g: 30, size: [2, 4], grow: 6, col: (k) => `rgba(150,170,185,${0.35 * k})` },
    spark: { life: [0.2, 0.5], vx: [-120, 120], vy: [-110, 30], g: 260, size: [1, 2], col: (k) => `rgba(200,250,255,${k})`, add: 1, streak: 1 },
    mote: { life: [3, 6], vx: [-4, 4], vy: [-6, -1], g: 0, size: [0.8, 1.8], col: (k) => `rgba(0,229,255,${0.5 * Math.sin(k * Math.PI)})`, add: 1 },
  };
  function emit(type, x, y, n = 1, s = 1) {
    if (P.length > 900) return; const t = T[type];
    for (let i = 0; i < n; i++) { const l = rand(...t.life); P.push({ t, x: x + rand(-2, 2) * s, y, vx: rand(...t.vx) * s / 3, vy: rand(...t.vy) * s / 3, l, L: l, r: rand(...t.size) * s / 2, ph: R() * 6 }); }
  }
  // props call this while drawing on the live stage (never during baking)
  function prop(ctx, kind, x, y, S) {
    if (!ctx.canvas || ctx.canvas.id !== "stage") return;
    if (kind === "torch") { if (R() < 0.7) emit("ember", x, y, 1, S); if (R() < 0.25) emit("smoke", x, y - 2 * S, 1, S); torchSeen = performance.now(); }
    else if (kind === "lantern") { if (R() < 0.2) emit("ember", x, y, 1, S * 0.6); torchSeen = performance.now(); }
    else if (kind === "staff") { if (R() < 0.8) emit("magic", x + rand(-3, 3) * S, y + rand(-3, 3) * S, 1, S); }
  }
  function frame(ctx, w, h) {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (R() < 0.35) P.push({ t: T.mote, x: R() * w, y: R() * h, vx: rand(-4, 4), vy: rand(-6, -1), l: 5, L: 5, r: rand(0.8, 1.8), ph: 0 });
    // bloom: blurred additive copy of the lit scene
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.2; ctx.filter = "blur(7px)";
    ctx.drawImage(ctx.canvas, 0, 0); ctx.restore();
    ctx.save();
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i], t = p.t; p.l -= dt; if (p.l <= 0) { P.splice(i, 1); continue; }
      p.vy += t.g * dt; if (t.swirl) { p.ph += dt * 5; p.vx += Math.cos(p.ph) * 40 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (t.grow) p.r += t.grow * dt;
      const k = p.l / p.L; ctx.globalCompositeOperation = t.add ? "lighter" : "source-over"; ctx.fillStyle = ctx.strokeStyle = t.col(k);
      if (t.streak) { ctx.lineWidth = p.r; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
    }
    ctx.restore();
    // vignette + chromatic edge + scanlines
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.65)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,229,255,0.025)"; for (let y = (now / 40) % 3; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    // torch crackle while a flame is on screen
    if (now - torchSeen < 200 && now > crackT) { crackT = now + rand(60, 260); sfx("crackle"); }
  }
  // ---------- synthesized sound ----------
  function audio() {
    if (ac) return ac; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    master = ac.createGain(); master.gain.value = on ? 0.5 : 0; master.connect(ac.destination);
    // ambient drone: two detuned saws through a slow lowpass
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 320; amb = ac.createGain(); amb.gain.value = 0.05;
    for (const hz of [55, 55.4, 82.5]) { const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz; o.connect(f); o.start(); }
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg).connect(f.frequency); lfo.start();
    f.connect(amb).connect(master); return ac;
  }
  function noise(dur) { const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; return s; }
  function env(node, t0, a, peak, dur) { const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); node.connect(g).connect(master); return g; }
  function sfx(kind) {
    if (!on || !ac || ac.state !== "running") return; const t = ac.currentTime;
    if (kind === "click") { const o = ac.createOscillator(); o.type = "square"; o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.06); env(o, t, 0.002, 0.08, 0.08); o.start(t); o.stop(t + 0.1);
      const o2 = ac.createOscillator(); o2.type = "sine"; o2.frequency.value = 2400; env(o2, t + 0.03, 0.002, 0.05, 0.12); o2.start(t + 0.03); o2.stop(t + 0.16); }
    else if (kind === "hover") { const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = 3200; env(o, t, 0.002, 0.02, 0.04); o.start(t); o.stop(t + 0.05); }
    else if (kind === "tick") { const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = 900 + R() * 200; env(o, t, 0.001, 0.03, 0.03); o.start(t); o.stop(t + 0.04); }
    else if (kind === "step") { const n = noise(0.12), f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500 + R() * 200; n.connect(f); env(f, t, 0.003, 0.35, 0.11); n.start(t);
      const o = ac.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.08); env(o, t, 0.002, 0.25, 0.09); o.start(t); o.stop(t + 0.1); }
    else if (kind === "swoosh") { const n = noise(0.35), f = ac.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3500, t + 0.18); f.frequency.exponentialRampToValueAtTime(800, t + 0.32); n.connect(f); env(f, t, 0.05, 0.5, 0.33); n.start(t); }
    else if (kind === "crackle") { const n = noise(0.03), f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1800; n.connect(f); env(f, t, 0.001, 0.06 + R() * 0.08, 0.03); n.start(t); }
    else if (kind === "bake") { for (let i = 0; i < 4; i++) { const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = [523, 659, 784, 1047][i]; env(o, t + i * 0.05, 0.005, 0.07, 0.25); o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.3); } }
  }
  const btn = () => document.getElementById("sfxToggle");
  document.addEventListener("pointerdown", (e) => { const a = audio(); if (a && a.state !== "running") a.resume(); if (e.target.closest("button") && e.target.id !== "sfxToggle") sfx("click"); }, true);
  document.addEventListener("pointerover", (e) => { if (e.target.closest && e.target.closest("button")) sfx("hover"); });
  document.addEventListener("input", (e) => { if (e.target.type === "range") sfx("tick"); else sfx("click"); });
  document.addEventListener("click", (e) => { if (e.target.id !== "sfxToggle") return; on = !on; btn().setAttribute("aria-pressed", on); btn().textContent = on ? "♪ SFX ON" : "♪ SFX OFF"; if (master) master.gain.value = on ? 0.5 : 0; });
  return { emit, prop, frame, sfx, _ac: () => ac, _on: () => on, _out: () => master };
})();
