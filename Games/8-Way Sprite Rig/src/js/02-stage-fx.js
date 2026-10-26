(() => {
  const R = Math.random, rand = (a, b) => a + R() * (b - a), FX = window.FX;
  let scene = "char", wx = 0, shakeOn = true, shakeAmt = 0, lightning = 0, nextBolt = 0, nextZap = 0, ghost = null, lastProp = {}, flick = 1;
  const WX = ["☼ CLEAR", "☂ RAIN", "❄ SNOW", "⚡ STORM", "≋ FOG", "🌋 ASHFALL", "✨ AURORA", "🩸 BLOOD MOON"];
  const drops = [];
  // extra particle types reuse FX's pool through a local mini-system
  const Q = [];
  const add = (o) => { if (Q.length < 1200) Q.push(o); };
  FX.scene = (s) => { scene = s; };
  FX.shake = (a) => { if (shakeOn) shakeAmt = Math.max(shakeAmt, a); };
  FX.ring = (x, y, S, col = "0,229,255") => add({ k: "ring", x, y, r: 2 * S, vr: 90 * S / 3, l: 0.45, L: 0.45, col });
  FX.print = (x, y, S) => add({ k: "print", x, y, r: 1.6 * S, l: 2.5, L: 2.5 });
  FX.coins = (x, y, S) => { for (let i = 0; i < 14; i++) add({ k: "coin", x, y, vx: rand(-60, 60), vy: rand(-140, -60), l: 1.2, L: 1.2, r: 1.4 * S, ph: R() * 6 }); FX.sfx("coin"); };
  const oldProp = FX.prop;
  FX.prop = (ctx, kind, x, y, S) => { oldProp(ctx, kind, x, y, S); if (ctx.canvas && ctx.canvas.id === "stage") lastProp[kind] = { x, y, S, t: performance.now() }; };
  const oldBeat = FX.sfx;
  const oldFrame = FX.frame;
  FX.frame = (ctx, w, h) => {
    const now = performance.now(), dt = 1 / 60;
    // motion afterimage
    if (ghost) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.09; ctx.globalCompositeOperation = "screen"; ctx.drawImage(ghost, 0, 0); ctx.restore(); }
    // god rays
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) { const x0 = w * (0.1 + i * 0.18) + Math.sin(now / 3000 + i) * 20, g = ctx.createLinearGradient(x0, 0, x0 + w * 0.3, h);
      g.addColorStop(0, "rgba(120,220,255,0.07)"); g.addColorStop(1, "rgba(120,220,255,0)"); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 40, 0); ctx.lineTo(x0 + w * 0.35 + 60, h); ctx.lineTo(x0 + w * 0.3, h); ctx.fill(); }
    // flickering torchlight / lantern pool
    for (const kind of ["torch", "lantern", "staff"]) { const p = lastProp[kind]; if (!p || now - p.t > 150) continue;
      flick += (rand(0.75, 1.15) - flick) * 0.3; const rgb = kind === "staff" ? "160,120,255" : "255,150,60", r = (kind === "staff" ? 34 : 46) * p.S * flick;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(${rgb},0.28)`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, 2 * r, 2 * r); }
    ctx.restore();
    // staff lightning arcs
    const sp = lastProp.staff;
    if (sp && now - sp.t < 150 && now > nextZap) { nextZap = now + rand(400, 1600); add({ k: "bolt", pts: boltPts(sp.x, sp.y, sp.x + rand(-60, 60) * sp.S / 3, sp.y + rand(-50, 30) * sp.S / 3), l: 0.12, L: 0.12, w: 1.5 }); FX.sfx("zap"); }
    // scene ambience
    if (scene === "tree" && R() < 0.12) add({ k: "leaf", x: w * rand(0.3, 0.7), y: h * rand(0.2, 0.5), vx: rand(-10, 10), vy: rand(10, 25), l: 4, L: 4, ph: R() * 6, r: rand(1.5, 2.6) });
    if (scene === "chest" && R() < 0.06) add({ k: "glint", x: w * rand(0.4, 0.6), y: h * rand(0.62, 0.82), l: 0.5, L: 0.5, r: rand(3, 6) });
    if (scene === "beast" && R() < 0.04) FX.emit("smoke", w * 0.5 + rand(-20, 20), h * 0.62, 2, 1.5);
    // weather
    const W = WX[wx];
    if (W.includes("RAIN") || W.includes("STORM")) for (let i = 0; i < (W.includes("STORM") ? 9 : 5); i++) drops.push({ x: rand(-40, w), y: -10, vx: 90, vy: rand(600, 800), s: 0 });
    if (W.includes("SNOW")) for (let i = 0; i < 2; i++) drops.push({ x: rand(0, w), y: -5, vx: rand(-15, 15), vy: rand(25, 50), s: 1, ph: R() * 6 });
    ctx.save();
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; if (d.s) { d.ph += dt * 2; d.x += (d.vx + Math.sin(d.ph) * 15) * dt; } else d.x += d.vx * dt; d.y += d.vy * dt;
      const floor = h * (0.7 + (i % 7) * 0.035);
      if (d.y > floor) { if (!d.s) add({ k: "splash", x: d.x, y: floor, r: 1, l: 0.25, L: 0.25 }); drops.splice(i, 1); continue; }
      if (d.s) { ctx.fillStyle = "rgba(230,245,255,0.85)"; ctx.beginPath(); ctx.arc(d.x, d.y, 1.6, 0, 6.28); ctx.fill(); }
      else { ctx.strokeStyle = "rgba(150,210,255,0.45)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * 0.02, d.y - d.vy * 0.02); ctx.stroke(); } }
    ctx.restore();
    if (W.includes("STORM") && now > nextBolt) { nextBolt = now + rand(2500, 7000); lightning = 1; const x = rand(w * 0.1, w * 0.9);
      add({ k: "bolt", pts: boltPts(x, 0, x + rand(-60, 60), h * 0.7), l: 0.25, L: 0.25, w: 3 }); setTimeout(() => FX.sfx("thunder"), rand(150, 600)); FX.shake(8); }
    // local particles
    ctx.save();
    for (let i = Q.length - 1; i >= 0; i--) { const p = Q[i]; p.l -= dt; if (p.l <= 0) { Q.splice(i, 1); continue; } const k = p.l / p.L;
      if (p.k === "ring") { p.r += p.vr * dt; ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = `rgba(${p.col},${k})`; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.32, 0, 0, 6.28); ctx.stroke(); }
      else if (p.k === "print") { ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.4, 0, 0, 6.28); ctx.fill(); }
      else if (p.k === "coin") { p.vy += 380 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.ph += dt * 14; ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = Math.sin(p.ph) > 0 ? "#ffd35c" : "#b8860b"; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * Math.abs(Math.sin(p.ph)) + 0.4, p.r, 0, 0, 6.28); ctx.fill(); }
      else if (p.k === "leaf") { p.ph += dt * 3; p.x += (p.vx + Math.sin(p.ph) * 20) * dt; p.y += p.vy * dt; ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = `rgba(${90 + 60 * Math.sin(p.ph) | 0},${160},${60},${Math.min(1, k * 2)})`; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      else if (p.k === "glint") { ctx.globalCompositeOperation = "lighter"; const s = p.r * Math.sin(k * Math.PI); ctx.strokeStyle = `rgba(255,230,150,${k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke(); }
      else if (p.k === "splash") { p.r += 18 * dt; ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = `rgba(150,210,255,${0.5 * k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.3, 0, 0, 6.28); ctx.stroke(); }
      else if (p.k === "bolt") { ctx.globalCompositeOperation = "lighter"; for (const [lw, c] of [[p.w * 4, `rgba(120,180,255,${0.25 * k})`], [p.w, `rgba(230,245,255,${k})`]]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); p.pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.stroke(); } }
    }
    ctx.restore();
    // fog
    if (W.includes("FOG") || W.includes("STORM") || W.includes("RAIN")) { ctx.save(); for (let i = 0; i < 3; i++) { const y = h * (0.55 + i * 0.12), x = ((now / (60 + i * 30)) % (w + 400)) - 200, g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.45);
      g.addColorStop(0, `rgba(170,200,215,${W.includes("FOG") ? 0.22 : 0.09})`); g.addColorStop(1, "rgba(170,200,215,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); } ctx.restore(); }
    oldFrame(ctx, w, h);
    if (lightning > 0) { ctx.fillStyle = `rgba(210,230,255,${lightning * 0.55})`; ctx.fillRect(0, 0, w, h); lightning -= 0.08; }
    // chromatic aberration on shake
    if (shakeAmt > 0.5) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.12; ctx.filter = "hue-rotate(160deg)"; ctx.drawImage(ctx.canvas, shakeAmt, 0); ctx.restore(); }
    if (!ghost) { ghost = document.createElement("canvas"); }
    if (ghost.width !== ctx.canvas.width || ghost.height !== ctx.canvas.height) { ghost.width = ctx.canvas.width; ghost.height = ctx.canvas.height; }
    ghost.getContext("2d").clearRect(0, 0, ghost.width, ghost.height); ghost.getContext("2d").drawImage(ctx.canvas, 0, 0);
    const st = ctx.canvas; shakeAmt *= 0.86; st.style.transform = shakeAmt > 0.3 ? `translate(${rand(-1, 1) * shakeAmt}px,${rand(-1, 1) * shakeAmt}px)` : "";
  };
  function boltPts(x0, y0, x1, y1) { const pts = [[x0, y0]], n = 9; for (let i = 1; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + rand(-12, 12), y0 + (y1 - y0) * t + rand(-6, 6)]); } pts.push([x1, y1]); return pts; }
  // extra sounds
  const baseSfx = FX.sfx;
  FX.sfx = (kind) => {
    baseSfx(kind);
    const ac = FX._ac && FX._ac(); if (!ac || ac.state !== "running" || !FX._on()) return; const t = ac.currentTime, out = FX._out();
    const env = (n, a, pk, d, t0 = t) => { const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(pk, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); n.connect(g).connect(out); };
    const noise = (d) => { const b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate), c = b.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = R() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; return s; };
    if (kind === "zap") { const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.15); env(o, 0.002, 0.12, 0.16); o.start(t); o.stop(t + 0.2); }
    else if (kind === "thunder") { const n = noise(2.5), f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(80, t + 2.2); n.connect(f); env(f, 0.02, 0.9, 2.4); n.start(t); }
    else if (kind === "coin") { for (let i = 0; i < 6; i++) { const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = rand(1800, 3200); env(o, 0.002, 0.06, 0.15, t + i * 0.06); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.2); } }
    else if (kind === "impact") { const o = ac.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); env(o, 0.002, 0.5, 0.3); o.start(t); o.stop(t + 0.32); const n = noise(0.15), f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2500; n.connect(f); env(f, 0.001, 0.25, 0.12); n.start(t); }
    else if (kind === "type") { const o = ac.createOscillator(); o.type = "square"; o.frequency.value = rand(1100, 1600); env(o, 0.001, 0.025, 0.025); o.start(t); o.stop(t + 0.03); }
    else if (kind === "boot") { const o = ac.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.6); env(o, 0.05, 0.15, 0.8); o.start(t); o.stop(t + 0.85); }
  };
  // ---------- page-level: boot screen, cursor trail, ripples, panel tilt, weather buttons ----------
  const lines = ["> CINDERDEEP RIG CORE v9", "> mounting skeleton solver ......... OK", "> material shaders: metal wood cloth skin ... OK", "> particle engine [1200 slots] ...... OK", "> audio synth bus ................... OK", "> 8-direction atlas baker ............ READY", "", "  >>> SYSTEM ONLINE <<<"];
  const log = document.getElementById("bootLog"), boot = document.getElementById("bootScreen"); let li = 0, ci = 0;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { boot.classList.add("done"); li = lines.length; }
  (function type() { if (li >= lines.length) { setTimeout(() => boot.classList.add("done"), 350); return; } const L = lines[li]; log.textContent += L[ci] || ""; ci++; if (ci > L.length) { log.textContent += "\n"; li++; ci = 0; setTimeout(type, 90); } else setTimeout(type, 8); })();
  boot.addEventListener("click", () => boot.classList.add("done"));
  const cv = document.getElementById("cursorFx"), cx = cv.getContext("2d"), trail = [];
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; fit(); addEventListener("resize", fit);
  addEventListener("pointermove", (e) => { trail.push({ x: e.clientX, y: e.clientY, l: 1 });
    document.querySelectorAll(".panel").forEach((p) => { const r = p.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { p.style.transform = ""; return; }
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5; p.style.transform = `perspective(1400px) rotateY(${nx * 2.5}deg) rotateX(${-ny * 2.5}deg)`; }); });
  (function loop() { cx.clearRect(0, 0, cv.width, cv.height); cx.globalCompositeOperation = "lighter";
    for (let i = trail.length - 1; i >= 0; i--) { const p = trail[i]; p.l -= 0.05; if (p.l <= 0) { trail.splice(i, 1); continue; } cx.fillStyle = `rgba(0,229,255,${p.l * 0.35})`; cx.beginPath(); cx.arc(p.x, p.y, 6 * p.l, 0, 6.28); cx.fill(); }
    requestAnimationFrame(loop); })();
  document.addEventListener("pointerdown", (e) => { const b = e.target.closest("button"); if (!b) return; const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), d = document.createElement("span");
    d.className = "ripple"; d.style.width = d.style.height = s + "px"; d.style.left = e.clientX - r.left - s / 2 + "px"; d.style.top = e.clientY - r.top - s / 2 + "px"; b.appendChild(d); setTimeout(() => d.remove(), 600); });
  document.addEventListener("keydown", (e) => { if (e.target.matches && e.target.matches("input,select,textarea")) FX.sfx("type"); });
  document.getElementById("wxBtn").addEventListener("click", (e) => { wx = (wx + 1) % WX.length; e.currentTarget.textContent = WX[wx]; drops.length = 0; });
  document.getElementById("shakeBtn").addEventListener("click", (e) => { shakeOn = !shakeOn; e.currentTarget.setAttribute("aria-pressed", shakeOn); e.currentTarget.textContent = shakeOn ? "⇋ SHAKE ON" : "⇋ SHAKE OFF"; });
  document.addEventListener("pointerdown", () => { if (!window.__booted) { window.__booted = 1; setTimeout(() => FX.sfx("boot"), 30); } }, { once: true });
})();
