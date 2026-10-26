/* ============================================================
   Cinderdeep — the three circles are mycelium. Their links are
   drawn as hyphae: bowed a little, each its own way, with light
   running along whatever has been grown.
   ============================================================ */
function mycHypha(g, x1, y1, x2, y2, seed, o = {}) {
  const dx = x2 - x1, dy = y2 - y1, k = (hashU(seed, 7, 3) - 0.5) * 0.36;
  const cx = (x1 + x2) / 2 - dy * k, cy = (y1 + y2) / 2 + dx * k;
  g.strokeStyle = o.lit ? o.col : o.dimCol || 'rgba(200,190,170,0.16)';
  g.lineWidth = o.width || 1.5;
  g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke();
  if (!o.lit || !o.col || o.col[0] !== '#') return;
  // a bead of light carried along it
  const u = ((o.t || 0) * (0.25 + hashU(seed, 9, 1) * 0.35) + hashU(seed, 5, 2)) % 1, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgbaStr(o.col, 0.9);
  g.beginPath(); g.arc(a * x1 + b * cx + c * x2, a * y1 + b * cy + c * y2, (o.width || 1.5) * 0.9 + 0.8, 0, TAU); g.fill();
  g.globalCompositeOperation = 'source-over';
}

