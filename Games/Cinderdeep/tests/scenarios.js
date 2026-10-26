// Each scenario runs inside the game page (see helpers.js for T) and returns T.done().
module.exports = [
  {
    name: 'boot: title screen and menus',
    run: async () => {
      T.check('title is open', G.mode === 'title' && UI.top(), G.mode);
      for (const k of ['heroes', 'help', 'settings', 'controls', 'cinema', 'steelChaos', 'camp', 'realm', 'records']) {
        if (typeof UI[k] !== 'function') { T.check(`UI.${k} exists`, false); continue; }
        try { UI[k](); await T.wait(40); T.check(`UI.${k} opens`, UI.top()); } catch (e) { T.check(`UI.${k} opens`, false, e.message); }
        UI.title(); await T.wait(40);
      }
      return T.done();
    },
  },
  {
    name: 'dungeon: descent, floors, pause menu, death',
    run: async () => {
      await T.descent('knight');
      T.check('a descent is being played', G.mode === 'play' && G.p && G.run.charId, G.mode);
      T.sim(3); render();
      UI.pause(); await T.wait(40);
      const pause = T.buttons();
      T.check('Resume comes first in pause', pause[0] === 'Resume', pause);
      for (const want of ['Steel & Chaos', 'DNA', 'Skill tree', 'Talent tree', 'Settings', 'CinderFX', 'Save and quit']) T.check(`pause has ${want}`, pause.some((b) => b.startsWith(want)), pause);
      UI.clear();
      UI.settings(); await T.wait(40);
      const rows = [...UI.top().querySelector('.panel').children], done = rows.findIndex((e) => /^Done/.test(e.textContent));
      T.check('Done is the last row in settings', done === rows.length - 1, rows.map((e) => e.textContent.slice(0, 30)));
      UI.clear();
      for (let i = 0; i < 3; i++) { goFloor(G.fl.idx + 1); await T.wait(50); T.sim(1); render(); }
      T.check('three floors descended', G.fl.idx === 3, G.fl.idx);
      G.p.hp = 1; hurtPlayer(999, {});
      UI.pause(); T.check('no pause menu on a fallen hero', !UI.top() || !/Paused/.test(UI.top().textContent));
      T.sim(2); await T.wait(2200);
      T.check('death is final', G.p.dead && G.mode === 'menu', { dead: G.p.dead, mode: G.mode });
      return T.done();
    },
  },
  {
    name: 'combat: Steel & Chaos against a pack',
    run: async () => {
      await T.descent('samurai');
      const s = duelState();
      for (let k = 0; k < 4; k++) spawnEnemy('skeleton', G.p.x + 25 + k * 5, G.p.y, {}).aggro = true;
      let guarded = 0;
      for (let i = 0; i < 900 && !G.p.dead; i++) {
        const ph = i % 60; Input.down.delete('KeyJ'); Input.down.delete('KeyV');
        if (ph < 40) Input.down.add('KeyJ'); else { Input.down.add('KeyV'); if (ph === 40) Input.edge.add('KeyV'); }
        T.sim(1 / 60); if (s.guard) guarded++;
      }
      Input.down.clear();
      T.check('the pack is beaten', G.run.stats.kills >= 4, G.run.stats.kills);
      T.check('guard engages when held', guarded > 0, guarded);
      T.check('attacks spent stamina', s.stamina < 100 || G.run.stats.kills >= 4, s.stamina);
      return T.done();
    },
  },
  {
    name: 'abilities: Chaos costs, DNA rearranged skill, Echo Cast',
    run: async () => {
      await T.descent('knight');
      const p = G.p, s = duelState(p);
      // a rearranged skill casts its partner from inside the first cast; the partner is free
      p.dnaSplAb = 'fireball'; s.chaos = 100;
      const cost = duelSpellCost(p.abilities[0]), projs = G.projs.length;
      T.check('the cast goes off', castAbility(p, 0) === true);
      T.check('only the first skill costs Chaos', s.chaos === 100 - cost, { chaos: s.chaos, cost });
      T.check('the partner skill fires', G.projs.length > projs);
      // Echo Cast recharges at once, and Steel & Chaos must not undo it
      p.dnaSplAb = null; p.stats.echoCast = 1; p.abilities[0].cd = 0; s.chaos = 100; s.castUntil = s.recoverUntil = 0;
      castAbility(p, 0);
      T.check('Echo Cast recharges at once', p.abilities[0].cd <= 0.25, p.abilities[0].cd);
      // too little Chaos: the spell is held for overdraw instead of cast
      p.abilities[0].cd = 0; s.chaos = 0; s.castHold = null;
      T.check('a spell without Chaos waits', castAbility(p, 0) === false && s.castHold, s.chaos);
      return T.done();
    },
  },
  {
    name: 'progression: levels, DNA, a won descent, the DNA rite, Chaos Level',
    run: async () => {
      await T.descent('pyro');
      gainXP(400); G.combat = false; T.sim(0.3);
      for (let i = 0; i < 10 && UI.top(); i++) { const c = UI.top().querySelector('.card'); if (c) c.click(); else UI.clear(); await T.wait(60); }
      T.check('levels gained', G.p.level >= 5, G.p.level);
      T.check('levels earn DNA points', G.p.dnaPts >= 4, G.p.dnaPts);
      const took = Object.keys(CD.dna.genes()).filter((id) => CD.dna.take(id)).length;
      T.check('DNA genes can be expressed', took > 0, took);
      UI.dnaTree(null, {}); await T.wait(100); T.check('DNA circle opens', UI.top()); UI.clear();
      UI.skillTree(null, {}); await T.wait(100); T.check('skill tree opens', UI.top()); UI.clear();
      UI.tree('pyro'); await T.wait(200); T.check('talent tree opens', UI.top()); UI.clear();
      const chaos0 = chaosInfo().xp;
      G.run.won = true; G.run.floorIdx = TOTAL_FLOORS - 1; endRun(true); await T.wait(300);
      T.check('victory offers to descend again', T.click(/Descend again/), T.buttons());
      await T.wait(4000);
      T.check('the DNA rite is offered', UI.top() && /DNA rite/.test(UI.top().textContent));
      T.click(/Sacrifice/); await T.wait(300);
      T.check('sacrificed DNA raises Chaos', chaosInfo().xp > chaos0, chaosInfo());
      T.check('the next descent starts fresh', G.mode === 'play' && G.p.level === 1, G.p.level);
      saveCheckpoint(); UI.title(); await T.wait(200); continueRun(); await T.wait(1500);
      T.check('a saved descent continues', G.mode === 'play' && G.p && !G.p.dead);
      return T.done();
    },
  },
  {
    name: 'realm: living world, journal, reliquary, photo mode, permadeath',
    run: async () => {
      await T.realm('ranger');
      T.sim(2);
      T.check('in the Realm', W.on && W.Z && W.Z.id === 'meadows', W.Z && W.Z.id);
      T.check('scenery streams in', CD.living.details > 50, CD.living.details);
      T.check('wildlife is placed', CD.living.actors > 0, CD.living.actors);
      UI.pause(); await T.wait(40);
      const pause = T.buttons();
      for (const want of ['Journey', 'Field Journal', 'Turn the World']) T.check(`Realm pause has ${want}`, pause.some((b) => b.startsWith(want)), pause);
      UI.clear(); UI.livingJournal(); await T.wait(40); T.check('field journal opens', UI.top()); UI.clear();
      const m = LW.marks.find((x) => x.detail === 'reliquary');
      if (T.check('a reliquary is near town', m)) { T.go(m, 6); interact(); T.check('the reliquary pays out once', Object.keys(W.ch.living.loot).length === 1 && G.items.length > 0); }
      UI.diorama(); for (let i = 0; i < 4; i++) { dioramaTurn(1); render(); }
      T.check('photo mode turns', DIORAMA.active); CD.diorama.close();
      T.check('photo mode closes', !DIORAMA.active);
      for (let i = 0; i < 30; i++) { G.p.x += 40; T.sim(0.25); render(); }
      T.check('scenery stays bounded while travelling', CD.living.details < 1500, CD.living.details);
      G.p.hp = 1; hurtPlayer(999, {}); for (let i = 0; i < 30; i++) CD.sim(0.1); await T.wait(2500);
      T.check('death in the Realm is final', G.p.dead && CD.chars().alive.length === 0, CD.chars());
      return T.done();
    },
  },
  {
    name: 'proving trail: every stage, reward and the Watch Trial',
    run: async () => {
      await T.realm('knight');
      T.sim(0.5);
      T.go(SG.nodes.mentor); sgAdvance(0); T.sim(0.3);
      T.check('stage 1: the dummy appears', CD.proving.stage === 1 && SG.dummy);
      T.go(SG.nodes.dummy, 14); for (let i = 0; i < 3; i++) { damageEnemy(SG.dummy, 5, { src: 'weapon' }); G.t += 0.3; }
      T.check('stage 2: three hits', CD.proving.stage === 2, CD.proving.stage);
      T.go(SG.nodes.dummy, 30); runHooks('onDash', G.p); runHooks('onDash', G.p);
      T.check('stage 3: two dodges', CD.proving.stage === 3, CD.proving.stage);
      T.go(SG.nodes.orchard, 40); T.sim(0.5);
      T.check('orchard raiders arrive', SG.encounter.filter((e) => !e.dead).length === 3);
      for (const e of [...SG.encounter]) if (!e.dead) killEnemy(e);
      T.sim(0.3); T.check('stage 4: orchard cleared', CD.proving.stage === 4, CD.proving.stage);
      T.go(SG.nodes.seal); UI.provingTrail(); await T.wait(40); T.click(/Skirmisher/); UI.clear();
      T.check('stage 5: a discipline chosen', CD.proving.stage === 5 && W.ch.trail.boon === 'skirmisher');
      T.go(SG.nodes.boss, 40); T.sim(0.3);
      const cap = SG.encounter.find((e) => e.sgCaptain && !e.dead);
      if (T.check('the Briar Captain appears', cap)) { T.sim(3); killEnemy(cap); T.sim(0.5); }
      T.check('stage 6: captain beaten', CD.proving.stage === 6, CD.proving.stage);
      for (const e of G.ents) if (!e.dead && e.sgEncounter) killEnemy(e);
      G.p.pendingLevels = 0; UI.clear(); T.go(SG.nodes.mentor); UI.provingTrail(); await T.wait(40); T.click(/Claim/); UI.clear();
      T.check('reward claimed', W.ch.trail.claimed);
      G.p.pendingLevels = 0; T.sim(0.5);
      T.check('the Watch Trial starts', sgStartTrial());
      T.go(SG.nodes.boss, 40);
      for (let w = 0; w < 10; w++) { G.p.hp = G.p.maxHp; T.sim(3); for (const e of G.ents) if (!e.dead && e.sgTrial) killEnemy(e); }
      T.check('the Watch Trial finishes', !SG.trial && W.ch.trail.bestTrial > 0, W.ch.trail);
      return T.done();
    },
  },
  {
    name: 'graphics: CinderFX renders on WebGL',
    run: async () => {
      await T.descent('storm');
      for (let i = 0; i < 20; i++) { T.sim(0.05); render(); }
      const st = CD.cinema.status;
      T.check('a renderer is running', /WebGL|Canvas/.test(st.backend), st);
      cfxPreview(); for (let i = 0; i < 5; i++) render();
      T.check('the preview spawns effects', CD.cinema.status.particles > 0, CD.cinema.status);
      CD.settings.cinema = 'off'; render(); T.check('effects can be switched off', document.getElementById('cinderfx').hidden);
      CD.settings.cinema = 'cinematic';
      return T.done();
    },
  },
  {
    name: 'phone: HUD panels do not cover the buttons',
    viewport: { width: 390, height: 844 }, mobile: true,
    run: async () => {
      await T.realm('ranger');
      Input.setDevice('touch'); T.sim(0.5); updateHUD(0.016);
      const box = (el) => el && !el.hidden && el.getBoundingClientRect();
      const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const ribbon = box(document.querySelector('.lw-ribbon')), combat = box(document.querySelector('.duel-hud'));
      const buttons = ['tb-map', 'tb-pause'].map((id) => box(document.getElementById(id))).filter(Boolean);
      T.check('Map and Pause are on screen', buttons.length === 2, buttons.length);
      T.check('the Realm ribbon clears Map and Pause', !buttons.some((b) => overlap(b, ribbon)));
      T.check('the combat panel clears Map and Pause', !buttons.some((b) => overlap(b, combat)));
      return T.done();
    },
  },
  {
    name: 'soak: random play through six floors and the Realm',
    run: async () => {
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyV', 'Space', 'KeyB', 'KeyQ', 'KeyE', 'KeyR'];
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const play = (secs) => {
        const t0 = performance.now();
        for (let i = 0; i < secs * 60; i++) {
          if (i % 12 === 0) { Input.down.clear(); for (const k of keys) if (rnd() < 0.3) { Input.down.add(k); Input.edge.add(k); } }
          T.sim(1 / 60); if (i % 4 === 0) render();
          if (G.p.dead) { G.p.dead = false; G.p.hp = G.p.maxHp; }
        }
        Input.down.clear(); return (performance.now() - t0) / (secs * 60);
      };
      await T.descent('samurai');
      let worst = 0;
      for (let f = 0; f < 6; f++) { G.p.hp = G.p.maxHp; worst = Math.max(worst, play(6)); goFloor(G.fl.idx + 1); await T.wait(80); }
      await T.realm('storm');
      worst = Math.max(worst, play(25));
      T.check('frames stay cheap (ms per simulated frame)', worst < 12, worst.toFixed(2));
      T.check('no "something went wrong" toast', !frame.errShown);
      return T.done();
    },
  },
];
