// 63-ground.js: ground textures painted by code, one for each tileset: seamless, seeded, and readable at the low
// resolution the 3D view draws at.
// Owns: Ground
// Public:
//   Ground.texture(id) -> canvas        a Ground.SIZE by Ground.SIZE canvas painted for the tileset id; the same
//                                       canvas every time. An id that names no tileset gets the default ground.
//   Ground.span(id) -> metres           how many metres of ground one texture covers (the tileset's span, else the
//                                       recipe's own)
//   Ground.color(id, out?) -> [r, g, b] the mean colour of the texture, 0 to 1, once it has been painted; before
//                                       that a near guess from the tileset's colours, so that the plain view never
//                                       paints a texture it does not show. out may be left out: a new array then.
//   Ground.pixels(id) -> Uint8ClampedArray   the painted RGBA bytes, row by row (for tests and for views that
//                                       upload bytes rather than a canvas)
//   Ground.recipe(name, {span, colors, paint})   adds a recipe: paint(img, N, colors, rand) fills img, a
//                                       Float32Array of N * N * 3 numbers (red, green, blue from 0 to 1, row by row),
//                                       so that its left edge meets its right and its top its bottom; rand() is
//                                       the seeded stream, 0 to 1
//   Ground.recipes() -> [name]
//   Ground.SIZE = 512, Ground.DEFAULT = 'flags'
// A tileset is {id, recipe, span, colors}; each of its colors ([r, g, b] or '#rrggbb') replaces one of the
// recipe's own. The recipes, and the colours each reads:
//   flags     worn flagstones with dark joints      stone, joint, wear, moss               span 6
//   cobbles   rounded cobbles with dark gaps        stone, gap, cool, warm                 span 4
//   silt      smooth mud, ripple lines, puddles     mud, ridge, trough, water, sky         span 10
// The seed is the tileset's id, so a picture is the same every time; Math.random is never used.
(function () {
  'use strict';

  const SIZE = 512, DEFAULT = 'flags';
  const floor = Math.floor, sqrt = Math.sqrt, abs = Math.abs, exp = Math.exp, max = Math.max, min = Math.min;
  const recipes = Object.create(null), order = [];
  const painted = new Map();          // id -> {rgba, mean}
  const canvases = new Map();         // id -> canvas

  Ground.SIZE = SIZE;
  Ground.DEFAULT = DEFAULT;

  // ---- seeded randomness and seamless noise ----

  function stream(seed) {             // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A lattice of random values that wraps every p cells; sampled with smooth steps, so it tiles.
  function lattice(rand, p) {
    const v = new Float32Array(p * p);
    for (let i = 0; i < v.length; i++) v[i] = rand();
    return { p, v };
  }

  function sample(L, u, w) {
    const p = L.p, x0 = floor(u), y0 = floor(w), fx = u - x0, fy = w - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const i0 = ((x0 % p) + p) % p, i1 = (i0 + 1) % p, j0 = ((y0 % p) + p) % p, j1 = (j0 + 1) % p, v = L.v;
    const a = v[j0 * p + i0], b = v[j0 * p + i1], c = v[j1 * p + i0], d = v[j1 * p + i1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  // Layers of noise at the given periods (cells across the texture), each half as strong as the one before.
  function octaves(rand, periods) { return periods.map((p) => lattice(rand, p)); }
  function fbm(layers, x, y, N) {
    let sum = 0, amp = 0.5, total = 0;
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      sum += amp * sample(L, x * L.p / N, y * L.p / N);
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  }

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, v) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };
  const mix = (a, b, t) => a + (b - a) * t;

  function rgb(v, fallback) {
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) {
      const n = parseInt(v.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    if (Array.isArray(v) && v.length >= 3) return [+v[0] || 0, +v[1] || 0, +v[2] || 0];
    return fallback.slice();
  }

  // ---- the registry ----

  Ground.recipe = function (name, spec) {
    Core.assert(typeof name === 'string' && spec && typeof spec.paint === 'function', 'Ground.recipe needs a name and {span, colors, paint}');
    recipes[name] = { span: spec.span > 0 ? spec.span : 6, colors: spec.colors || {}, paint: spec.paint };
    if (order.indexOf(name) < 0) order.push(name);
  };
  Ground.recipes = function () { return order.slice(); };

  function tilesetOf(id) { return typeof id === 'string' && Defs.has('tileset', id) ? Defs.get('tileset', id) : null; }
  function recipeOf(def) { return def && recipes[def.recipe] ? recipes[def.recipe] : recipes[DEFAULT]; }

  Ground.span = function (id) {
    const def = tilesetOf(id);
    return def && def.span > 0 ? def.span : recipeOf(def).span;
  };

  function paintOf(id) {
    const key = tilesetOf(id) ? id : '';
    let done = painted.get(key);
    if (done) return done;
    const def = tilesetOf(key), recipe = recipeOf(def), colors = {};
    for (const name of Object.keys(recipe.colors)) colors[name] = rgb(def && def.colors ? def.colors[name] : null, recipe.colors[name]);
    const N = SIZE, img = new Float32Array(N * N * 3);
    recipe.paint(img, N, colors, stream(Core.hashStr('ground:' + (key || DEFAULT))));
    const rgba = new Uint8ClampedArray(N * N * 4), mean = [0, 0, 0];
    for (let i = 0, j = 0; i < N * N; i++, j += 3) {
      rgba[i * 4] = img[j] * 255 + 0.5;
      rgba[i * 4 + 1] = img[j + 1] * 255 + 0.5;
      rgba[i * 4 + 2] = img[j + 2] * 255 + 0.5;
      rgba[i * 4 + 3] = 255;
      mean[0] += img[j]; mean[1] += img[j + 1]; mean[2] += img[j + 2];
    }
    for (let k = 0; k < 3; k++) mean[k] /= N * N;
    done = { rgba, mean };
    painted.set(key, done);
    return done;
  }

  Ground.pixels = function (id) { return paintOf(id).rgba; };

  Ground.color = function (id, out) {
    const key = tilesetOf(id) ? id : '', done = painted.get(key), o = out || [0, 0, 0];
    if (done) {
      o[0] = done.mean[0]; o[1] = done.mean[1]; o[2] = done.mean[2];
      return o;
    }
    // the recipe's first colour, darkened about as much as its joints and gaps darken the whole
    const def = tilesetOf(key), recipe = recipeOf(def), first = Object.keys(recipe.colors)[0];
    const c = rgb(def && def.colors ? def.colors[first] : null, recipe.colors[first]);
    o[0] = c[0] * 0.86; o[1] = c[1] * 0.86; o[2] = c[2] * 0.86;
    return o;
  };

  Ground.texture = function (id) {
    const key = tilesetOf(id) ? id : '';
    let canvas = canvases.get(key);
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(SIZE, SIZE);
    image.data.set(paintOf(key).rgba);
    ctx.putImageData(image, 0, 0);
    canvases.set(key, canvas);
    return canvas;
  };

  function put(img, i, r, g, b) {
    img[i] = clamp01(r);
    img[i + 1] = clamp01(g);
    img[i + 2] = clamp01(b);
  }

  // ---- flags: courses of worn rectangular slabs with dark joints ----
  // Each course is as high as the texture divided among its courses and is cut into slabs of random length,
  // shifted so that no two joints line up; a course wraps round, and the courses fill the height exactly, so
  // the texture tiles. A slab has a tone of its own, rounded and chipped corners, worn edges, a smoother
  // middle, and sometimes a crack. Moss grows in some joints.
  function paintFlags(img, N, C, rand) {
    const fine = octaves(rand, [64, 128]), mid = octaves(rand, [8, 16, 32]), mossy = octaves(rand, [4, 8]), stain = octaves(rand, [2, 4]);
    const rows = 5 + floor(rand() * 2), heights = [];
    let sum = 0;
    for (let i = 0; i < rows; i++) { heights.push(0.8 + 0.4 * rand()); sum += heights[i]; }
    const rowAt = new Int16Array(N), rowY = [], rowH = [];
    let y = 0;
    for (let i = 0; i < rows; i++) {
      const h = i === rows - 1 ? N - y : Math.round(heights[i] / sum * N);
      rowY.push(y); rowH.push(h);
      for (let k = y; k < y + h; k++) rowAt[k] = i;
      y += h;
    }
    const slabs = [], slabAt = [], shift = [];
    for (let i = 0; i < rows; i++) {
      const widths = [];
      let total = 0;
      while (total < N * 0.97) { const w = rowH[i] * (0.9 + 0.95 * rand()); widths.push(w); total += w; }
      const at = new Int16Array(N);
      let x = 0;
      for (let k = 0; k < widths.length; k++) {
        const w = k === widths.length - 1 ? N - x : Math.round(widths[k] / total * N);
        slabs.push({
          row: i, x0: x, x1: x + w, y0: rowY[i], y1: rowY[i] + rowH[i], tone: 0.88 + 0.2 * rand(), dr: (rand() - 0.5) * 0.02,
          dg: (rand() - 0.5) * 0.016, db: (rand() - 0.5) * 0.02, corner: 3 + 9 * rand(), wear: rand(), crack: rand() < 0.3,
        });
        for (let c = x; c < x + w; c++) at[c] = slabs.length - 1;
        x += w;
      }
      slabAt.push(at);
      shift.push(floor(rand() * N));
    }
    const S = C.stone, J = C.joint, Wr = C.wear, M = C.moss;
    for (let py = 0; py < N; py++) {
      const row = rowAt[py];
      for (let px = 0; px < N; px++) {
        const sx = (px + shift[row]) % N, slab = slabs[slabAt[row][sx]];
        const w = slab.x1 - slab.x0, h = slab.y1 - slab.y0, lx = sx - slab.x0, ly = py - slab.y0, r = slab.corner;
        // the distance in from the slab's rounded edge (negative: in the joint)
        const qx = abs(lx + 0.5 - w / 2) - (w / 2 - r), qy = abs(ly + 0.5 - h / 2) - (h / 2 - r);
        const outside = sqrt(max(qx, 0) * max(qx, 0) + max(qy, 0) * max(qy, 0)), edge = -(outside + min(max(qx, qy), 0) - r);
        // the joint is wider in places, and eats into the edge where the stone has chipped
        const n1 = fbm(fine, px, py, N), n2 = fbm(mid, px, py, N), jointW = 2.2 + 3 * n1 + 5 * smooth(0.66, 0.8, n1);
        const i = (py * N + px) * 3, grime = 0.84 + 0.32 * fbm(stain, px, py, N);
        if (edge < jointW) {
          const m = smooth(0.55, 0.7, fbm(mossy, px, py, N)), k = 0.75 + 0.5 * n1;
          put(img, i, mix(J[0] * k, M[0], m * 0.8), mix(J[1] * k, M[1], m * 0.8), mix(J[2] * k, M[2], m * 0.8));
          continue;
        }
        const t = slab.tone * (0.9 + 0.2 * n2) * (0.95 + 0.1 * n1) * grime;
        let red = S[0] * t + slab.dr, green = S[1] * t + slab.dg, blue = S[2] * t + slab.db;
        // a smoother, lighter middle where feet have worn it
        const worn = slab.wear * smooth(6, 30, edge) * smooth(0.35, 0.75, n2) * 0.55;
        red = mix(red, Wr[0] * t, worn); green = mix(green, Wr[1] * t, worn); blue = mix(blue, Wr[2] * t, worn);
        // rounded edges: dark where they fall away, lit on the top and left edges, shaded on the bottom and right
        const bevel = 1 - smooth(jointW, jointW + 5, edge);
        const nearest = min(lx, w - lx, ly, h - ly), lit = nearest === ly || nearest === lx ? 1 : -1;
        const shade = 1 - 0.3 * bevel + 0.12 * bevel * lit;
        put(img, i, red * shade, green * shade, blue * shade);
      }
    }
    // cracks: a short wandering dark line inside a slab, that never crosses a joint
    for (let s = 0; s < slabs.length; s++) {
      const slab = slabs[s];
      if (!slab.crack) continue;
      let x = slab.x0 + (0.25 + 0.5 * rand()) * (slab.x1 - slab.x0), cy = slab.y0 + (0.25 + 0.5 * rand()) * (slab.y1 - slab.y0);
      let dir = rand() * Math.PI * 2;
      const length = 25 + 50 * rand();
      for (let k = 0; k < length; k++) {
        dir += (rand() - 0.5) * 0.7;
        x += Math.cos(dir);
        cy += Math.sin(dir);
        if (x < slab.x0 + 6 || x > slab.x1 - 6 || cy < slab.y0 + 6 || cy > slab.y1 - 6) break;
        const px = ((floor(x) - shift[slab.row]) % N + N) % N, py = floor(cy), i = (py * N + px) * 3;
        img[i] *= 0.55; img[i + 1] *= 0.55; img[i + 2] *= 0.55;
      }
    }
  }

  // ---- cobbles: rounded stones packed in staggered rows, with dark gaps ----
  // The stones are the cells round points on a jittered grid that wraps, so the texture tiles. A stone is
  // domed: its height is worked out first, then lit from the upper left, so it reads as round at any size.
  function paintCobbles(img, N, C, rand) {
    const G = 10, cell = N / G, fine = octaves(rand, [64, 128]), dirt = octaves(rand, [16, 32]);
    const pxs = new Float32Array(G * G), pys = new Float32Array(G * G), tone = new Float32Array(G * G), warm = new Float32Array(G * G);
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const k = j * G + i, stagger = j % 2 === 0 ? 0 : 0.5;
        pxs[k] = (i + 0.5 + stagger + (rand() - 0.5) * 0.5) * cell;
        pys[k] = (j + 0.5 + (rand() - 0.5) * 0.4) * cell;
        tone[k] = 0.82 + 0.34 * rand();
        warm[k] = rand();
      }
    }
    const height = new Float32Array(N * N), owner = new Int16Array(N * N);
    for (let py = 0; py < N; py++) {
      for (let px = 0; px < N; px++) {
        const gx = floor(px / cell), gy = floor(py / cell);
        let f1 = 1e9, f2 = 1e9, best = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -2; di <= 2; di++) {
            const cj = gy + dj, ci = gx + di, wj = ((cj % G) + G) % G, wi = ((ci % G) + G) % G, k = wj * G + wi;
            // the point, moved by whole textures so that it sits near this pixel
            const qx = pxs[k] + (ci - wi) * cell, qy = pys[k] + (cj - wj) * cell, dx = qx - px, dy = qy - py;
            const d = sqrt(dx * dx + dy * dy);
            if (d < f1) { f2 = f1; f1 = d; best = k; } else if (d < f2) f2 = d;
          }
        }
        const edge = (f2 - f1) / 2, gap = 1.2 + 1.4 * fbm(fine, px, py, N);
        const body = smooth(gap, gap + cell * 0.22, edge), dome = 1 - min(1, (f1 / (cell * 0.8)) * (f1 / (cell * 0.8)));
        height[py * N + px] = body * (0.55 + 0.45 * dome);
        owner[py * N + px] = best;
      }
    }
    const S = C.stone, Gp = C.gap, cool = C.cool, wa = C.warm;
    const lx = -0.5, ly = -0.6, lz = 0.62, ll = sqrt(lx * lx + ly * ly + lz * lz);
    for (let py = 0; py < N; py++) {
      for (let px = 0; px < N; px++) {
        const at = py * N + px, h = height[at], i = at * 3, n1 = fbm(fine, px, py, N);
        const hx = height[py * N + (px + 1) % N] - height[py * N + (px + N - 1) % N];
        const hy = height[((py + 1) % N) * N + px] - height[((py + N - 1) % N) * N + px];
        const nx = -hx * 5, ny = -hy * 5, nz = 1, nl = sqrt(nx * nx + ny * ny + nz * nz);
        const lit = 0.72 + 0.5 * ((nx * lx + ny * ly + nz * lz) / (nl * ll) - 0.62);
        const k = owner[at], t = tone[k] * (0.93 + 0.14 * n1), c = warm[k];
        const sr = mix(cool[0], wa[0], c) * 0.5 + S[0] * 0.5, sg = mix(cool[1], wa[1], c) * 0.5 + S[1] * 0.5, sb = mix(cool[2], wa[2], c) * 0.5 + S[2] * 0.5;
        const d = 0.8 + 0.4 * fbm(dirt, px, py, N), into = smooth(0, 0.14, h);
        put(img, i, mix(Gp[0] * d, sr * t * lit, into), mix(Gp[1] * d, sg * t * lit, into), mix(Gp[2] * d, sb * t * lit, into));
      }
    }
  }

  // ---- silt: smooth mud with ripple lines and standing puddles ----
  // The ripples run across the texture a whole number of times, bent by seamless noise; the puddles are where a
  // broad noise rises past a level: darker wet mud round their rims, and still water in them that holds a
  // little of the sky.
  function paintSilt(img, N, C, rand) {
    const low = octaves(rand, [7, 14]), mid = octaves(rand, [8, 16, 32]), fine = octaves(rand, [64, 128]);
    const warp = octaves(rand, [4, 8]), bend = octaves(rand, [2, 4]), patch = octaves(rand, [4, 8]);
    const K = 16, mud = C.mud, ridge = C.ridge, trough = C.trough, water = C.water, sky = C.sky;
    // a ripple: a narrow crest with a steep face on one side and a long gentle back
    const profile = (r) => (r < 0.12 ? smooth(0, 0.12, r) : 1 - smooth(0.12, 0.7, r));
    // where the puddles lie: the broad noise above its own 86th hundredth is water, a rim below that is wet
    const level = new Float32Array(N * N), seen = [];
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) level[py * N + px] = fbm(low, px, py, N);
    for (let k = 0; k < level.length; k += 37) seen.push(level[k]);
    seen.sort((a, b) => a - b);
    const q = (share) => seen[Math.min(seen.length - 1, floor(seen.length * share))];
    const wetFrom = q(0.74), poolFrom = q(0.86), deepAt = q(0.97);
    for (let py = 0; py < N; py++) {
      for (let px = 0; px < N; px++) {
        const i = (py * N + px) * 3, n2 = fbm(mid, px, py, N), n1 = fbm(fine, px, py, N);
        const v = py / N * K + (fbm(warp, px, py, N) - 0.5) * 2.4 + (fbm(bend, px, py, N) - 0.5) * 1.6;
        const r = v - floor(v), h = profile(r);
        const strength = smooth(0.4, 0.62, fbm(patch, px, py, N)) * 0.85;
        const tone = 0.92 + 0.16 * n2, lift = h > 0.5 ? (h - 0.5) * 2 : 0, sink = r > 0.08 && r < 0.2 ? 1 - abs(r - 0.14) / 0.06 : 0;
        let red = mud[0] * tone, green = mud[1] * tone, blue = mud[2] * tone;
        red = mix(red, ridge[0], lift * strength); green = mix(green, ridge[1], lift * strength); blue = mix(blue, ridge[2], lift * strength);
        red = mix(red, trough[0], sink * strength); green = mix(green, trough[1], sink * strength); blue = mix(blue, trough[2], sink * strength);
        // puddles: darker wet mud round the rim, then still water that holds a little of the sky
        const m = level[py * N + px], wet = smooth(wetFrom, poolFrom, m), pool = smooth(poolFrom, poolFrom + 0.008, m);
        red *= 1 - 0.3 * wet; green *= 1 - 0.3 * wet; blue *= 1 - 0.26 * wet;
        const deep = smooth(poolFrom, deepAt, m), shine = 0.12 + 0.4 * deep + 0.1 * (n2 - 0.5);
        const wr = mix(water[0], sky[0], shine), wg = mix(water[1], sky[1], shine), wb = mix(water[2], sky[2], shine);
        red = mix(red, wr, pool); green = mix(green, wg, pool); blue = mix(blue, wb, pool);
        // a few grains of grit on the dry mud
        const grit = pool < 0.5 && n1 > 0.83 ? 0.9 : 1;
        put(img, i, red * grit, green * grit, blue * grit);
      }
    }
  }

  Ground.recipe('flags', {
    span: 6, paint: paintFlags,
    colors: { stone: [0.36, 0.37, 0.4], joint: [0.1, 0.1, 0.11], wear: [0.46, 0.46, 0.47], moss: [0.2, 0.24, 0.16] },
  });
  Ground.recipe('cobbles', {
    span: 4, paint: paintCobbles,
    colors: { stone: [0.4, 0.38, 0.36], gap: [0.11, 0.1, 0.09], cool: [0.34, 0.36, 0.4], warm: [0.44, 0.38, 0.32] },
  });
  Ground.recipe('silt', {
    span: 10, paint: paintSilt,
    colors: { mud: [0.3, 0.26, 0.2], ridge: [0.38, 0.33, 0.26], trough: [0.22, 0.19, 0.15], water: [0.12, 0.12, 0.12], sky: [0.2, 0.21, 0.23] },
  });
})();
