// What the tool must keep doing. Each scenario runs in the page through
// page.evaluate, and returns T.done(): a list of named checks.
const inPage = (fn) => async (page) => page.evaluate(fn);
module.exports = [
  {
    name: 'boot: controls built, page as written',
    run: inPage(async () => {
      T.check('the title is the tool', document.title === '8-Way Sprite Rig', document.title);
      T.check('every subject has a button', ['character', 'beast', 'dragon', 'golem', 'tree', 'chest'].every((k) => document.querySelector(`#subjectSeg [data-subject="${k}"]`)));
      T.check('the clips and looks are filled in', document.querySelectorAll('#clipSeg button').length >= 4 && document.querySelectorAll('#presetSeg button').length >= 4);
      T.check('every clip of the subject is baked', T.state().baked.length === document.querySelectorAll('#clipSeg button').length, T.state().baked);
      T.check('the markup carries no styles of its own', ['cellInspector', 'cellInspectReadout', 'lookTools', 'morphFields', 'up100Modal', 'up100Grid', 'up100Search'].every((id) => !document.getElementById(id).hasAttribute('style')));
      T.check('the boot screen is out of the way', document.getElementById('bootScreen').classList.contains('done'));
      return T.done();
    }),
  },
  {
    name: 'subjects: every subject in every view and map',
    run: inPage(async () => {
      for (const sub of ['character', 'beast', 'dragon', 'golem', 'tree', 'chest']) {
        await T.press(`#subjectSeg [data-subject="${sub}"]`);
        T.check(`${sub} is on the bench`, T.state().subject === sub, T.state());
        for (const m of ['sprite3d', 'mesh3d', 'split3d', 'voxel3d', 'normlit']) await T.press(`[data-rmode="${m}"]`);
        for (const c of ['normal', 'depth', 'spec', 'emissive', 'pbr']) await T.press(`[data-chan="${c}"]`);
        const clips = [...document.querySelectorAll('#clipSeg button')].map((b) => b.dataset.clip);
        for (const c of clips) await T.press(`#clipSeg [data-clip="${c}"]`);
        T.check(`${sub}: every clip baked`, clips.every((c) => T.state().baked.includes(c)), T.state().baked);
      }
      return T.done();
    }),
  },
  {
    name: 'playground: walk, mount, dash, time of day, metronome',
    run: inPage(async () => {
      await T.press('#subjectSeg [data-subject="character"]');
      await T.press('modePlay');
      T.check('the playground is on', T.state().mode === 'play');
      const p0 = T.state().player;
      T.key('keydown', 'd'); await T.wait(500); T.key('keyup', 'd');
      const p1 = T.state().player;
      T.check('the keys walk you', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 3, { p0, p1 });
      T.key('keydown', 'm');
      T.check('M mounts the wolf', T.state().mount === true);
      T.key('keydown', ' ', { shiftKey: true });
      T.check('Shift+Space dashes', T.state().dash > 0, T.state());
      const p2 = T.state().player; await T.wait(400); const p3 = T.state().player;
      T.check('a dash carries you', Math.hypot(p3.x - p2.x, p3.z - p2.z) > 5, { p2, p3 });
      for (let i = 0; i < 3; i++) await T.press('todBtn');
      T.check('time of day turns to the abyss', T.state().tod === 3 && /Abyss/.test(document.getElementById('todBtn').textContent));
      await T.press('metroBtn');
      T.check('the metronome is on', T.state().metro === true);
      await T.press('modeTurn');
      return T.done();
    }),
  },
  {
    name: 'export: the JSON contract follows the bench',
    run: inPage(async () => {
      const el = document.getElementById('elev'); el.value = 40; el.dispatchEvent(new Event('input', { bubbles: true }));
      await T.until(() => JSON.parse(window.SpriteRig.exportJson()).meta.cameraElevationDeg === 40, 3000);
      const J = JSON.parse(window.SpriteRig.exportJson());
      T.check('the pitch baked at is the pitch reported', J.meta.cameraElevationDeg === 40, J.meta.cameraElevationDeg);
      T.check('every clip and frame is listed', Object.keys(J.clips).length === T.state().baked.length && J.frames.length > 100, J.frames.length);
      T.check('frames carry their sockets', J.frames.every((f) => f.sockets && Object.keys(f.sockets).length));
      const headHeight = async (sub) => {
        await T.press(`#subjectSeg [data-subject="${sub}"]`);
        const E = JSON.parse(window.SpriteRig.exportJson()), f = E.frames.find((q) => q.clip === 'idle' && q.dir === 0 && q.frame === 0);
        return E.meta.anchor.y - f.sockets.head.y;
      };
      const man = await headHeight('character'), golem = await headHeight('golem');
      T.check('the Golem\'s sockets grow with its body', Math.abs(golem / man - 1.12) < 0.03, { man, golem });
      await T.press('#subjectSeg [data-subject="character"]');
      return T.done();
    }),
  },
  {
    name: 'reload: big direction and frame counts are remembered',
    run: async (page, open) => {
      await page.evaluate(async () => {
        const d = document.getElementById('dirs'), f = document.getElementById('frames');
        d.value = '32'; d.dispatchEvent(new Event('change', { bubbles: true }));
        f.value = '16'; f.dispatchEvent(new Event('change', { bubbles: true }));
        await T.press('#clipSeg button');
      });
      await open();
      return page.evaluate(() => { T.check('32 directions and 16 frames survive a reload', T.state().N === 32 && T.state().FR === 16, T.state()); return T.done(); });
    },
  },
  {
    name: 'model: the three.js view of every subject',
    run: inPage(async () => {
      await T.press('[data-rmode="mesh3d"]');
      for (const [sub, least] of [['character', 10], ['beast', 20], ['dragon', 30], ['golem', 10], ['tree', 5], ['chest', 16]]) {
        await T.press(`#subjectSeg [data-subject="${sub}"]`);
        await T.until(() => T.state().preview && T.state().preview.parts >= least, 3000);
        const p = T.state().preview;
        T.check(`${sub} is built in three.js`, p.gl && p.parts >= least, p);
      }
      // the picture stands where the rig projects it: the character's torso is drawn, the air beside it is not
      await T.press('#subjectSeg [data-subject="character"]');
      await T.wait(150);
      const { cx, cy, S } = T.state().preview, gl = window.Preview3D.canvas, k = window.devicePixelRatio || 1;
      const cv = document.createElement('canvas'); cv.width = gl.width; cv.height = gl.height;
      const g = cv.getContext('2d'); g.drawImage(gl, 0, 0);
      const alpha = (x, y) => g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data[3];
      T.check('the torso is in the picture', alpha(cx, cy - 20 * S) > 200, alpha(cx, cy - 20 * S));
      T.check('the air beside it is clear', alpha(cx + 20 * S, cy - 20 * S) === 0, alpha(cx + 20 * S, cy - 20 * S));
      await T.press('[data-rmode="sprite3d"]');
      return T.done();
    }),
  },
  {
    name: 'upgrades: the list opens, filters and closes',
    run: inPage(async () => {
      await T.press('up100Btn');
      T.check('a hundred upgrades', document.querySelectorAll('#up100Grid > div').length === 100);
      const q = document.getElementById('up100Search'); q.value = 'mount'; q.dispatchEvent(new Event('input', { bubbles: true }));
      T.check('the filter narrows it', document.querySelectorAll('#up100Grid > div').length >= 1 && document.querySelectorAll('#up100Grid > div').length < 100);
      await T.press('up100Close');
      T.check('it closes', document.getElementById('up100Modal').hidden);
      return T.done();
    }),
  },
];
