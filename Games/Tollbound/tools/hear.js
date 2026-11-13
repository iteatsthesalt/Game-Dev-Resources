#!/usr/bin/env node
// tools/hear.js: renders a sound effect of the game in headless Chromium, writes it as a 16-bit WAV file for a
// person to listen to, and prints its numbers for a person who cannot.
//   node tools/hear.js <effect id> [options]    one effect
//   node tools/hear.js --all [options]          every defined effect, each to its own file, and a table
//   node tools/hear.js --list                   the ids of the defined effects
// Options:
//   --out .build/hear/<id>.wav   where the file goes (one effect); with --all, the folder (.build/hear)
//   --seconds 3                  how much to render (default: the effect's length + 0.5)
//   --room                       through the reverb, as the effect sounds in the game (dry by default)
//   --pitch 1, --level 1         opts for the effect, as Sound.sfx takes them
//   --seed n                     another of the effect's random variations (each seed gives the same samples)
// A relative path is taken from the game folder, not the current one. It reads the dev build in .build/, so
// run "npm run build:dev" first. Rendering goes through Sound.render: mono, 48 kHz, at the effect's own level
// (before the volume settings and the limiter).
// The numbers: peak, the largest sample (0.98 or more clips); rms, the root mean square over the length; length,
// the seconds until the sound stays 40 dB under its peak. gap, cap and crowd come from the definition: a crowd
// effect may fire many times a second, and should be quieter and shorter than the rare ones.
// Exits 1 when an effect is silent (peak under 0.001), clips, or holds a sample that is not a number; and with
// --all also when a crowd effect is as loud (rms) or as long as the median of the effects that are not.
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, '.build', 'Tollbound.html');
const RATE = 48000, CLIP = 0.98, SILENT = 0.001;

function options(argv) {
  const opt = { ids: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { opt.ids.push(a); continue; }
    const name = a.slice(2), next = argv[i + 1];
    if (['all', 'list', 'room'].includes(name)) opt[name] = true;
    else if (next !== undefined && !next.startsWith('--')) { opt[name] = next; i++; }
    else throw new Error(`${a} needs a value`);
  }
  return opt;
}

// A 16-bit PCM WAV file of one channel.
function wav(int16, rate) {
  const data = Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength), head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8, 'ascii');
  head.write('fmt ', 12, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);        // PCM
  head.writeUInt16LE(1, 22);        // one channel
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

// Runs in the page: renders one effect and hands back its numbers and its samples as 16-bit, in base64.
async function renderInPage(args) {
  const { id, seconds, opts } = args, Sound = window.TB.Sound;
  const info = Sound.info(id);
  if (!info) return { id, error: 'no effect is defined as "' + id + '"' };
  const secs = seconds > 0 ? seconds : info.length + 0.5;
  const data = await Sound.render(id, opts, secs);
  if (!data) return { id, error: 'this browser has no WebAudio' };
  let peak = 0, bad = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!Number.isFinite(v)) bad++;
    else if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  let last = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (Math.abs(data[i]) > peak * 0.01) { last = i + 1; break; }
  }
  let sum = 0;
  for (let i = 0; i < last; i++) if (Number.isFinite(data[i])) sum += data[i] * data[i];
  const pcm = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const v = Number.isFinite(data[i]) ? Math.max(-1, Math.min(1, data[i])) : 0;
    pcm[i] = Math.round(v * 32767);
  }
  const bytes = new Uint8Array(pcm.buffer);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return {
    id, info, seconds: secs, samples: data.length, peak, bad, length: last / opts.rate, rms: last > 0 ? Math.sqrt(sum / last) : 0, pcm: btoa(text),
  };
}

function judge(r) {
  if (r.error) return r.error;
  if (r.bad > 0) return `${r.bad} samples are not numbers`;
  if (r.peak < SILENT) return 'silent';
  if (r.peak >= CLIP) return 'clips';
  return '';
}

function median(list) {
  const s = list.slice().sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
}

function row(cells, widths) { return cells.map((c, i) => String(c).padEnd(widths[i])).join('  ').trimEnd(); }

async function main() {
  const opt = options(process.argv.slice(2));
  if (!opt.all && !opt.list && opt.ids.length !== 1) {
    console.error('usage: node tools/hear.js <effect id> [--out file.wav] [--seconds 3] [--room] [--pitch 1] [--level 1] [--seed n]\n' +
      '       node tools/hear.js --all [--out folder] [--room]\n       node tools/hear.js --list');
    return 2;
  }
  if (!fs.existsSync(PAGE)) throw new Error(`there is no page at ${path.relative(process.cwd(), PAGE)}. Run: npm run build:dev`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('file://' + PAGE);
    await page.waitForFunction(() => window.TB && window.TB.ready, null, { timeout: 15000 });
    const ids = await page.evaluate(() => (window.TB.Sound && typeof window.TB.Sound.list === 'function' ? window.TB.Sound.list() : null));
    if (!ids) throw new Error('this build has no sound engine (TB.Sound.list)');
    if (opt.list) {
      console.log(ids.join('\n'));
      return 0;
    }
    const wanted = opt.all ? ids : opt.ids;
    const opts = { rate: RATE, room: !!opt.room };
    for (const name of ['pitch', 'level', 'seed']) if (opt[name] !== undefined) opts[name] = Number(opt[name]);
    const seconds = opt.seconds !== undefined ? Number(opt.seconds) : 0;
    const results = [];
    for (const id of wanted) {
      const r = await page.evaluate(renderInPage, { id, seconds, opts });
      if (!r.error) {
        const file = path.resolve(ROOT, opt.all ? path.join(opt.out || '.build/hear', `${id}.wav`) : opt.out || path.join('.build/hear', `${id}.wav`));
        const raw = Buffer.from(r.pcm, 'base64');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, wav(new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2), RATE));
        r.file = path.relative(ROOT, file);
      }
      delete r.pcm;
      results.push(r);
    }
    const widths = [14, 6, 6, 4, 7, 8, 8, 0];
    console.log(row(['effect', 'crowd', 'gap', 'cap', 'peak', 'rms', 'length', 'verdict'], widths));
    let failed = 0;
    for (const r of results) {
      const fault = judge(r);
      if (fault) failed++;
      if (r.error) { console.log(row([r.id, '', '', '', '', '', '', fault], widths)); continue; }
      console.log(row([r.id, r.info.crowd ? 'yes' : '', r.info.gap, r.info.cap, r.peak.toFixed(3), r.rms.toFixed(4), r.length.toFixed(2) + ' s',
        fault || 'ok  ' + r.file], widths));
    }
    if (opt.all) {
      const rare = results.filter((r) => !r.error && !r.info.crowd), crowd = results.filter((r) => !r.error && r.info.crowd);
      const loud = median(rare.map((r) => r.rms)), long = median(rare.map((r) => r.length));
      const over = crowd.filter((r) => !(r.rms < loud && r.length < long));
      console.log(`\nthe rare effects: median rms ${loud.toFixed(4)}, median length ${long.toFixed(2)} s; ` +
        (over.length ? `louder or longer crowd effects: ${over.map((r) => r.id).join(', ')}` : 'every crowd effect is quieter and shorter'));
      if (over.length) failed++;
    }
    for (const e of errors.slice(0, 8)) console.log('page: ' + e);
    return failed || errors.length ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().then((code) => process.exit(code), (e) => { console.error('hear: ' + (e.message || e)); process.exit(1); });
