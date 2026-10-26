// Each scenario runs inside the game page (see helpers.js for T) and returns T.done().
module.exports = [
  {
    name: 'boot: title screen and menus',
    run: async () => {
      T.check('title is open', G.mode === 'title' && UI.top(), G.mode);
      for (const k of ['heroes', 'help', 'settings', 'controls', 'steelChaos', 'camp', 'realm', 'records']) {
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
      for (const want of ['Steel & Chaos', 'DNA', 'Skill tree', 'Talent tree', 'Settings', 'Save and quit']) T.check(`pause has ${want}`, pause.some((b) => b.startsWith(want)), pause);
      UI.clear();
      UI.settings(); await T.wait(40);
      const rows = [...UI.top().querySelector('.panel').children], done = rows.findIndex((e) => /^Done/.test(e.textContent));
      T.check('Done is the last row in settings', done === rows.length - 1, rows.map((e) => e.textContent.slice(0, 30)));
      UI.clear();
      for (let i = 0; i < 3; i++) { goFloor(G.fl.idx + 1); await T.wait(50); T.sim(1); render(); }
      T.check('three floors descended', G.fl.idx === 3, G.fl.idx);
      G.p.hp = 1; hurtPlayer(999, {});
      UI.pause(); T.check('no pause menu on a fallen hero', !UI.top() || !/Paused/.test(UI.top().textContent));
      T.sim(2);
      T.check('death is final', await T.until(() => G.p.dead && G.mode === 'menu'), { dead: G.p.dead, mode: G.mode });
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
      const foe = spawnEnemy('skeleton', G.p.x + 40, G.p.y, {}), dna0 = G.p.dnaPts || 0, rnd0 = Math.random;
      foe.chaosT = true; Math.random = () => 0;
      try { killEnemy(foe); } finally { Math.random = rnd0; }
      T.check('a chaos-touched foe can leave a strand of DNA', (G.p.dnaPts || 0) === dna0 + 1, { before: dna0, after: G.p.dnaPts });
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
      T.check('the DNA rite is offered', await T.until(() => UI.top() && /DNA rite/.test(UI.top().textContent)));
      T.click(/Sacrifice/); await T.wait(300);
      T.check('sacrificed DNA raises Chaos', chaosInfo().xp > chaos0, chaosInfo());
      T.check('the next descent starts fresh', G.mode === 'play' && G.p.level === 1, G.p.level);
      saveCheckpoint(); UI.title(); await T.wait(200); continueRun(); await T.until(() => G.mode === 'play' && G.p && !fading);
      T.check('a saved descent continues', G.mode === 'play' && G.p && !G.p.dead);
      const c1 = chaosInfo().xp; G.p.dnaPts = 8; playerDie();
      T.check("a fallen character's DNA returns to the Mycelium", chaosInfo().xp === c1 + 2, { before: c1, after: chaosInfo().xp });
      return T.done();
    },
  },
  {
    name: 'realm: living world, journal, reliquary, permadeath',
    run: async () => {
      await T.realm('ranger');
      T.sim(2);
      T.check('in the Realm', W.on && W.Z && W.Z.id === 'meadows', W.Z && W.Z.id);
      T.check('scenery streams in', CD.living.details > 50, CD.living.details);
      T.check('wildlife is placed', CD.living.actors > 0, CD.living.actors);
      UI.pause(); await T.wait(40);
      const pause = T.buttons();
      for (const want of ['Journey', 'Field Journal']) T.check(`Realm pause has ${want}`, pause.some((b) => b.startsWith(want)), pause);
      UI.clear(); UI.livingJournal(); await T.wait(40); T.check('field journal opens', UI.top()); UI.clear();
      const folk = W.npcs.find((n) => n.role === 'folk' || n.role === 'guard');
      if (T.check('townsfolk are about', folk)) { T.go(folk, 8); const t = nearestInteract(); T.check('walking up to someone offers to talk', t && /^Talk/.test(promptFor(t)), t && promptFor(t)); interact(); T.check('and talking gets an answer', W.say && W.say.text, W.say); }
      const m = LW.marks.find((x) => x.detail === 'reliquary');
      if (T.check('a reliquary is near town', m)) { T.go(m, 6); interact(); T.check('the reliquary pays out once', Object.keys(W.ch.living.loot).length === 1 && G.items.length > 0); }
      for (let i = 0; i < 30; i++) { G.p.x += 40; T.sim(0.25); render(); }
      T.check('scenery stays bounded while travelling', CD.living.details < 1500, CD.living.details);
      G.p.hp = 1; hurtPlayer(999, {}); for (let i = 0; i < 30; i++) CD.sim(0.1); await T.until(() => CD.chars().alive.length === 0);
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
    name: 'effects: sparks, rings, beams, bolts and trails',
    run: async () => {
      await T.descent('storm');
      const p = G.p;
      fxSparks(p.x, p.y, '#ffffff', 12); fxRing(p.x, p.y, 60); fxAdd('rune', p.x, p.y, { r: 30, life: 1 });
      runHooks('onLevel', p); lightningStrike(p.x + 40, p.y, 1);
      p.dashT = 0.2; FX.dashAt = -99; runHooks('update'); p.dashT = 0;
      T.check('effects are made', FX.particles.length >= 3, FX.particles.length);
      render();
      const A = V3.air, n = (m) => m.count;
      T.check('sparks and glows stand in the air', n(A.dot) >= 12, n(A.dot));
      T.check('the level-up beam and the bolt stand up', n(A.beam) === 1 && A.bolts.reduce((s, m) => s + n(m), 0) === 1, { beam: n(A.beam), bolts: A.bolts.map(n) });
      burst(p.x, p.y, 10, '#c03030'); burst(p.x, p.y, 10, '#ffd08a', { glow: true }); render();
      T.check('the game\'s own particles fly in 3D, lit or glowing', A.bits.count >= 5 && A.shine.count >= 5, { bits: A.bits.count, shine: A.shine.count });
      T.check('a dash leaves an after-image', [...V3.cards.entries()].some(([id, c]) => /^ghost/.test(id) && c.mesh.visible));
      T.sim(2); render();
      T.check('and fade away', FX.particles.length === 0, FX.particles.length);
      T.check('and leave the air', V3.air.dot.count === 0 && V3.air.beam.count === 0);
      return T.done();
    },
  },
  {
    name: '3d: dungeons and the Realm in three.js, aiming',
    run: async () => {
      await T.descent('knight');
      for (let k = 0; k < 3; k++) spawnEnemy('skeleton', G.p.x + 30 + k * 12, G.p.y - 20, {}).aggro = true;
      T.sim(0.5); render();
      let st = CD.renderer.status;
      T.check('every room has a floor and walls', st.rooms === G.fl.rooms.length, st);
      T.check('hero, monsters and props stand in the scene', st.cards >= 4, st);
      T.check('torches and the hero light the scene', st.lights >= 1, st);
      const solidProps = G.fl.props.filter((pr) => V3.cards.get(pr) && V3.cards.get(pr).vox && V3.cards.get(pr).vox.visible);
      T.check('dungeon props stand as solid models', solidProps.length > 0 && st.solids >= solidProps.length, { solid: solidProps.length, st });
      // the hero stands as the sprite rig's 3D model: dressed for its class, turned to its aim, its card unseen but still casting
      render();
      const hero = CD.rigModels.groups.get(G.p), heroCard = () => V3.cards.get(G.p);
      T.check('the hero is the rig\'s 3D model, with no card behind it', hero && hero.group.visible && hero.group.children.filter((m) => m.visible).length > 40 && !(heroCard() && heroCard().mesh.visible), hero && hero.group.children.length);
      const look = CD.rigModels.look(G.p);
      T.check('dressed as a knight, sword in hand', look.head === 'helmet' && look.back === 'cape' && look.right === 'sword', look);
      G.p.aim = 0; render(); const yaw0 = hero.group.rotation.y;
      G.p.aim = Math.PI / 2; render();
      T.check('and turned to where it aims', Math.abs(hero.group.rotation.y - yaw0) > 1, [yaw0, hero.group.rotation.y]);
      CD.settings.rigModels = false; render();
      T.check('with the models off, the hero is its card again', heroCard() && heroCard().mesh.visible && !hero.group.visible);
      CD.settings.rigModels = true; render();
      // chests stand as the rig's chest, lid and all, and a mimic gives itself away no more than its sprite does
      const box = { id: 990, kind: 'chest', x: G.p.x + 30, y: G.p.y - 20, room: G.room.id, chest: 'gold', solid: true, r: 7, _el: null };
      G.fl.props.push(box); G.room.props.push(G.fl.props.length - 1); render();
      const bm = CD.rigModels.groups.get(box), shut = bm && bm.group.children.filter((m) => m.visible).length;
      T.check('a chest is the rig\'s chest model, with no card', bm && bm.group.visible && !V3.cards.get(box) && shut > 20, shut);
      box.mimic = true; render();
      T.check('a mimic looks like a chest', bm.group.children.filter((m) => m.visible).length === shut);
      G.room.props.pop(); G.fl.props.pop(); render();
      // loot floats over the floor as small solids that turn, never reaching in front of where it lies
      const t0 = G.t, loot = spawnItem({ type: 'relic', id: RELICS.find((r) => !r.acc).id }, G.p.x - 40, G.p.y + 30);
      dropPickup('gold', G.p.x + 50, G.p.y + 40, 5);
      const coin = G.picks[G.picks.length - 1];
      render();
      const lootVox = [loot, coin].map((o) => V3.cards.get(o) && V3.cards.get(o).vox), turn0 = lootVox.map((v) => v && v.rotation.y);
      G.t += 0.25; render();
      T.check('loot and pickups float as solid models', lootVox.every((v) => v && v.visible && v.geometry.attributes.position.count > 0 && v.position.y > 0), lootVox.map((v) => v && { vis: v.visible, y: v.position.y }));
      T.check('and they turn', lootVox.every((v, i) => v && v.rotation.y !== turn0[i]), turn0);
      T.check('a turning solid stays behind where it lies', lootVox.every((v, i) => v && v.position.z + [itemIcon(loot), pickSprite(coin)][i].w / 2 <= [loot, coin][i].y + 0.01), lootVox.map((v) => v && v.position.z));
      T.check('a pickup draws no empty card', !V3.cards.get(coin).mesh.visible);
      G.items.splice(G.items.indexOf(loot), 1); G.picks.splice(G.picks.indexOf(coin), 1); G.t = t0; render();
      const spA = { w: 1 }, spB = { w: 1 };
      T.check('different pictures get different models', v3SpriteId(spA) !== v3SpriteId(spB) && v3SpriteId(spA) === v3SpriteId(spA) && Number.isFinite(v3SpriteId(spB)), [v3SpriteId(spA), v3SpriteId(spB)]);
      T.check('hot colours glow by themselves in the dark', V3_SELF_GLOW.value > 0.3, V3_SELF_GLOW.value);
      const c = screenToWorld(R.cssW / 2, R.cssH / 2);
      T.check('the middle of the screen is the camera target', Math.hypot(c.x - G.cam.x, c.y - G.cam.y) < 3, c);
      const e = G.ents.find((q) => !q.dead && q.type === 'enemy');
      const q = v3Project(e.x, e.y), back = screenToWorld((q.x / R.VW) * R.cssW, (q.y / R.VH) * R.cssH);
      T.check('a point on screen and on the floor agree', Math.hypot(back.x - e.x, back.y - e.y) < 4, { e: [e.x, e.y], back });
      spawnProj({ team: 'p', x: G.p.x, y: G.p.y, ang: -1, speed: 60, dmg: 0, kind: 'fireball', color: '#ff9a4a' }); render();
      const shot = V3.cards.get('proj0');
      T.check('missiles fly upright above the floor', shot && shot.mesh.visible && shot.mesh.position.y > 0 && shot.selfLit, shot && shot.mesh.position);
      T.check('the hero\'s light throws the monsters\' shadows across the floor', CD.renderer.status.shadows >= 3, CD.renderer.status);
      G.p.stats.moons = 2; G.p.stats.bat = true; render();
      T.check('moons and the bat familiar stand up beside the hero', ['moon0', 'moon1', 'bat'].every((k) => V3.cards.get(k) && V3.cards.get(k).mesh.visible));
      G.p.stats.moons = 0; G.p.stats.bat = false;
      for (let f = 0; f < 3; f++) { goFloor(G.fl.idx + 1); await T.wait(60); T.sim(0.5); render(); }
      T.check('new floors rebuild the scene', CD.renderer.status.rooms === G.fl.rooms.length);
      await T.realm('ranger'); T.sim(1); render();
      st = CD.renderer.status;
      T.check('the Realm stands up in 3D: trees, houses, people', W.on && st.cards > 30, st);
      T.check('the dungeon is put away in the Realm', !V3.level.visible);
      T.check('distance fades into a haze', V3.scene.fog && V3.scene.fog.far > V3.scene.fog.near && V3.scene.fog.near > 0);
      W.t = Math.floor(W.t / DAY_LEN) * DAY_LEN + DAY_LEN * 0.3; render();
      const sun = CD.rigModels.groups.get(G.p).shade;
      T.check('the morning sun throws long shadows to the west', sun && sun.visible && sun.lean < -0.4, sun && sun.lean);
      W.t += DAY_LEN * 0.4; render();
      T.check('and the evening sun to the east', sun.visible && sun.lean > 0.4, sun.lean);
      // a waypoint far east: its arrow is drawn on the glass at the right edge of the screen
      W.ch.wp = { zone: W.Z.id, x: G.p.x + 2000, y: G.p.y }; W.compassT = null; render();
      const edge = V3.ug.getImageData(R.VW - 40, 0, 40, R.VH).data;
      let cyan = 0; for (let i = 0; i < edge.length; i += 4) if (edge[i] === 127 && edge[i + 1] === 232 && edge[i + 2] === 255) cyan++;
      T.check('the compass arrow for a far waypoint sits on the edge of the screen', cyan > 10, cyan);
      W.ch.wp = null; W.compassT = null;
      const cards = st.cards; render();
      T.check('still things are not repainted every frame', [...V3.cards.values()].filter((k) => k.look !== undefined).length > 10);
      const sol = CD.renderer.status, vox = [...V3.cards.values()].find((k) => k.vox && k.vox.visible);
      T.check('the Realm\'s still things are solid models, not cards', sol.solids > 10 && sol.models > 0 && sol.models <= sol.solids && vox.vox.geometry.attributes.position.count > 0 && !vox.mesh.visible, sol);
      // an overfull cache is let go between frames: the next frame starts empty, rebuilds only what it shows, and
      // never shows a solid without its shape
      for (let i = 0; V3_SOLIDS.size <= 600; i++) V3_SOLIDS.set(`pad${i}`, new THREE.BoxGeometry(1, 1, 1));
      render();
      T.check('a full model cache empties between frames, without bare solids on show', !V3_SOLIDS.has('pad0') && V3_SOLIDS.size <= CD.renderer.status.solids && [...V3.cards.values()].every((k) => !k.vox || !k.vox.visible || k.vox.geometry), V3_SOLIDS.size);
      T.check('and the frame builds its models again', CD.renderer.status.solids > 10, CD.renderer.status);
      // trees the rig has a model for stand as it, towering over the hero at their real height
      let tree = null;
      for (const L of W.Z.objs) for (const o of L) if (o.kind === 'tree' && RIGM_TREE[o.tree] && (!tree || Math.hypot(o.x - G.p.x, o.y - G.p.y) < Math.hypot(tree.x - G.p.x, tree.y - G.p.y))) tree = o;
      if (tree) {
        const home = [G.p.x, G.p.y]; G.p.x = tree.x + 30; G.p.y = tree.y + 40; G.cam.x = G.p.x; G.cam.y = G.p.y; T.sim(0.2); render();
        const tm = CD.rigModels.trees.get(tree), hero = CD.rigModels.groups.get(G.p);
        const tall = tm && tm.mesh.visible && (tm.mesh.geometry.boundingSphere.radius * tm.mesh.scale.x) > 3 * hero.group.scale.x * 21;
        T.check('a Realm tree is the rig\'s tree, towering over the hero, with no card', tall && !V3.cards.get(tree), tree.tree);
        T.check('and throws its own shadow', tm.shade.visible);
        [G.p.x, G.p.y] = home; G.cam.x = G.p.x; G.cam.y = G.p.y; T.sim(0.2); render();
      } else T.check('the Realm has trees to stand up', false);
      T.check('the Realm lights its lamps and the hero', CD.renderer.status.lights >= 1 && cards > 0);
      T.check('glow and colour are on by default', CD.renderer.status.glow === true, CD.renderer.status);
      CD.settings.glow = false; render();
      T.check('glow can be turned off', CD.renderer.status.glow === false);
      CD.settings.glow = true;
      // a playable hound is the rig's beast, as tall as its sprite
      await T.descent('emberpup'); render();
      const pup = CD.rigModels.groups.get(G.p);
      T.check('a playable hound is the rig\'s beast', pup && pup.group.visible && pup.group.children.filter((m) => m.visible).length > 40 && !V3.cards.get(G.p), pup && pup.group.children.length);
      return T.done();
    },
  },
  {
    name: 'elements: twenty-four, carried by the Mycelium',
    run: async () => {
      const fused = ELEM_IDS.filter((id) => ELEM[id].of.length === 2);
      T.check('twenty-four elements: eight primal, sixteen fused', ELEM_IDS.length === 24 && PRIMAL_IDS.length === 8 && fused.length === 16, ELEM_IDS);
      T.check('every primal is in four fusions', PRIMAL_IDS.every((q) => fused.filter((id) => ELEM[id].of.includes(q)).length === 4));
      T.check('a fusion carries the skill wheel\'s name for its pair', fused.every((id) => HYBRIDS[hybKey(...ELEM[id].of)].name === ELEM[id].name), fused.map((id) => ELEM[id].name));
      await T.descent('knight');
      G.p.maxHp = G.p.hp = 99999;
      // the veins: several elements under one floor, fused where veins meet, and the same each time it is asked
      const seen = new Set(), xs = [];
      for (let x = 0; x < 3000; x += 90) for (let y = 0; y < 3000; y += 90) { seen.add(mycElemAt(x, y)); xs.push(mycElemAt(x, y)); }
      T.check('the Mycelium runs with many elements, some of them fused', seen.size >= 6 && [...seen].some((id) => ELEM[id].of.length === 2), [...seen]);
      T.check('and they stay put', xs.every((el, i) => el === mycElemAt(Math.floor(i / 34) * 90, (i % 34) * 90)));
      // every element: born, hitting, recoloured and dying, without a fault
      let born = 0, painted = 0;
      for (const el of ELEM_IDS) {
        const e = spawnEnemy('skeleton', G.p.x + 40, G.p.y + 30, {});
        makeElemental(e, el); render();
        if (e.elem === el && e.maxHp > 0) born++;
        const sp = e.frames[0]; if (sp && elemSprite(sp, el) !== sp) painted++;
        hurtPlayer(1, { ent: e });
        killEnemy(e); T.sim(0.2);
      }
      T.check('each of the twenty-four can be born, strike and die', born === 24, born);
      T.check('each wears its own colours', painted === 24, painted);
      const m = spawnEnemy('skeleton', G.p.x + 40, G.p.y + 30, {}), arm0 = m.armor || 0;
      makeElemental(m, 'magma');
      T.check('a fused element does what both its primals do', m.fireproof === true && m.armor > arm0, { fireproof: m.fireproof, armor: m.armor });
      killEnemy(m); T.sim(0.2);
      const rich = spawnEnemy('skeleton', G.p.x + 40, G.p.y + 30, {});
      makeElemental(rich, 'luck'); G.p.gold = 50;
      hurtPlayer(1, { ent: rich });
      const picks0 = G.picks.length;
      killEnemy(rich);
      T.check('luck filches gold, and spills it when it dies', G.p.gold < 50 && G.picks.length >= picks0 + 3, { gold: G.p.gold, picks: G.picks.length - picks0 });
      // props grow up of the vein under them, and stand as solids in its colours
      const marked = G.fl.props.filter((pr) => !pr.npc && mycThingElem(pr));
      T.check('some props carry an element', marked.length > 0 && marked.every((pr) => ELEM[pr._el]), marked.length);
      // weapons that fall may carry one: their name, and their primals' gifts in the hand
      let elWeapons = 0;
      for (let i = 0; i < 40; i++) { const it = spawnItem({ type: 'weapon', w: makeWeapon('sword', 'common', G.run.rng) }, G.p.x, G.p.y + 60); if (it && it.w.el) elWeapons++; if (it) G.items.splice(G.items.indexOf(it), 1); }
      T.check('weapons fall elemental now and then', elWeapons > 0 && elWeapons < 40, elWeapons);
      const w0 = G.p.weapon, burn0 = G.p.stats.burnCh;
      G.p.weapon = G.p.weapons[G.p.wi] = { ...w0, el: 'fire' }; recalcStats(G.p);
      T.check('an elemental weapon gives its gift and its name', G.p.stats.burnCh > burn0 && itemTitle({ type: 'weapon', w: G.p.weapon }).startsWith('Ember'), { burn: G.p.stats.burnCh, title: itemTitle({ type: 'weapon', w: G.p.weapon }) });
      G.p.weapon = G.p.weapons[G.p.wi] = w0; recalcStats(G.p);
      // above, trees and stones carry the elements too
      await T.realm('ranger'); T.sim(0.5); render();
      let things = 0, grown = 0;
      for (const list of W.Z.objs) for (const o of list) { if (o.kind !== 'tree' && o.kind !== 'boulder' && o.kind !== 'rock') continue; things++; if (mycThingElem(o)) grown++; }
      T.check('trees and stones in the Realm carry elements', grown > 0 && grown < things, { grown, things });
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
      // the headless browser draws in software, where full-screen glow passes cost more than the game; the 3d scenario covers glow
      CD.settings.glow = false;
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyV', 'Space', 'KeyB', 'KeyQ', 'KeyE', 'KeyR'];
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      // the game's own work and the drawing are timed apart: CI draws in software, so drawing gets a wide margin
      const play = (secs) => {
        let sim = 0, draw = 0, draws = 0;
        for (let i = 0; i < secs * 60; i++) {
          if (i % 12 === 0) { Input.down.clear(); for (const k of keys) if (rnd() < 0.3) { Input.down.add(k); Input.edge.add(k); } }
          let t0 = performance.now(); T.sim(1 / 60); sim += performance.now() - t0;
          if (i % 4 === 0) { t0 = performance.now(); render(); draw += performance.now() - t0; draws++; }
          if (G.p.dead) { G.p.dead = false; G.p.hp = G.p.maxHp; }
        }
        Input.down.clear(); return { sim: sim / (secs * 60), draw: draw / draws };
      };
      await T.descent('samurai');
      const worst = { sim: 0, draw: 0 }, keep = (r) => { worst.sim = Math.max(worst.sim, r.sim); worst.draw = Math.max(worst.draw, r.draw); };
      for (let f = 0; f < 6; f++) { G.p.hp = G.p.maxHp; keep(play(6)); goFloor(G.fl.idx + 1); await T.wait(80); }
      await T.realm('storm');
      keep(play(25));
      T.check('the game stays cheap (ms per simulated frame)', worst.sim < 4, worst.sim.toFixed(2));
      T.check('drawing stays cheap even in software (ms per frame)', worst.draw < 120, worst.draw.toFixed(2));
      T.check('no "something went wrong" toast', !frame.errShown);
      return T.done();
    },
  },
  {
    name: 'screens: the Talent Tree in 3D',
    run: async () => {
      UI.title(); await T.wait(200);
      UI.tree('knight', {});
      await T.until(() => CD.circles().live === 1 && document.querySelector('.tree-cv'));
      await T.wait(300);
      const cv = document.querySelector('.tree-cv'), C = C3.last, st = treeStart('knight');
      T.check('the tree stands in its own 3D scene', CD.circles().nodes === TREE.nodes.length && CD.circles().edges === TREE.edges.length, CD.circles());
      const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let lit = 0; for (let i = 0; i < px.length; i += 4 * 97) if (px[i] + px[i + 1] + px[i + 2] > 90) lit++;
      T.check('and is painted into the screen', lit > 40, lit);
      T.check('the game behind it is not drawn', !!C3.live);
      // a point on the glass and the node under it agree, and the ground under the middle is the point looked at
      const p = C.project(st.id), back = C.pick(p.x, p.y);
      T.check('a node found on the glass is picked from there', back === st.id, { back, want: st.id });
      const mid = C.worldAt(C.cssW / 2, C.cssH / 2);
      T.check('the middle of the glass is the point looked at', Math.hypot(mid.x - C.view.x, mid.y - C.view.y) < 4, { mid, view: [C.view.x, C.view.y] });
      // clicking a node beside the start grows the road to it
      bankSouls('knight', 400);
      const next = TREE.nodes[st.links.find((l) => TREE.nodes[l].type !== 'start' && !talentSealed(TREE.nodes[l]))], q = C.project(next.id), r = cv.getBoundingClientRect();
      cv.setPointerCapture = () => {};
      const at = { pointerId: 7, pointerType: 'mouse', button: 0, bubbles: true, clientX: r.left + q.x, clientY: r.top + q.y };
      cv.dispatchEvent(new PointerEvent('pointerdown', at)); cv.dispatchEvent(new PointerEvent('pointerup', at));
      T.check('clicking a node on the glass allocates it', treeAlloc('knight').includes(next.id), { next: next.id, alloc: treeAlloc('knight') });
      // turning the view moves the picture but not the ground it stands on
      const before = C.project(next.id);
      C.view.yaw += 0.5; await T.wait(200);
      const after = C.project(next.id);
      T.check('turning the view moves the nodes on the glass', Math.hypot(after.x - before.x, after.y - before.y) > 20, { before, after });
      T.click(/^Done$/); await T.wait(300);
      T.check('closing the tree puts its scene away', CD.circles().live === 0, CD.circles());
      return T.done();
    },
  },
  {
    name: 'screens: the skill wheel in 3D',
    run: async () => {
      await T.descent('knight');
      G.p.skFree = 4;
      UI.skillTree(null, {});
      await T.until(() => CD.circles().live === 1 && document.querySelector('.sk-cv'));
      await T.wait(300);
      const T0 = CD.skills.tree(G.p.cls), cv = document.querySelector('.sk-cv'), C = C3.last;
      T.check('the wheel stands in its own 3D scene', CD.circles().nodes === Object.keys(T0.nodes).length && CD.circles().edges === T0.edges.length, CD.circles());
      T.check('and its arms climb toward their hearts', C.hs[C.idx['earth:heart']] > C.hs[C.idx['earth:att']] && C.hs[C.idx['earth:att']] > C.hs[C.idx.core]);
      const core = C.project(C.idx.core);
      T.check('the node under a point on the glass is picked from there', C.pick(core.x, core.y) === C.idx.core, C.pick(core.x, core.y));
      // a click on the glass takes the node there; dragging turns the wheel instead
      const r = cv.getBoundingClientRect(), p = C.project(C.idx['earth:weapon']);
      cv.setPointerCapture = () => {};
      const at = { pointerId: 5, pointerType: 'mouse', button: 0, bubbles: true, clientX: r.left + p.x, clientY: r.top + p.y };
      cv.dispatchEvent(new PointerEvent('pointerdown', at)); cv.dispatchEvent(new PointerEvent('pointerup', at)); cv.dispatchEvent(new MouseEvent('click', at));
      T.check('clicking a node on the glass takes it', G.p.sk.includes('earth:weapon'), G.p.sk);
      const yaw = C.view.yaw;
      cv.dispatchEvent(new PointerEvent('pointerdown', at)); cv.dispatchEvent(new PointerEvent('pointermove', { ...at, clientX: at.clientX + 80 })); cv.dispatchEvent(new PointerEvent('pointerup', { ...at, clientX: at.clientX + 80 }));
      cv.dispatchEvent(new MouseEvent('click', { ...at, clientX: at.clientX + 80 }));
      T.check('dragging turns the wheel without taking anything', C.view.yaw !== yaw && G.p.sk.length === 1, { yaw: C.view.yaw, sk: G.p.sk });
      T.click(/^Done$/); await T.wait(300);
      T.check('closing the wheel puts its scene away', CD.circles().live === 0, CD.circles());
      return T.done();
    },
  },
  {
    name: 'screens: the DNA circle in 3D',
    run: async () => {
      await T.descent('knight');
      G.p.dnaFree = 5; chDna(runChar()).bosses = 3;
      UI.dnaTree(null, {});
      await T.until(() => CD.circles().live === 1 && document.querySelector('.sk-cv'));
      await T.wait(300);
      const cv = document.querySelector('.sk-cv'), C = C3.last;
      T.check('the strands stand in their own 3D scene', CD.circles().nodes >= 10 && C.idx.core !== undefined, CD.circles());
      const core = C.project(C.idx.core);
      T.check('the node under a point on the glass is picked from there', C.pick(core.x, core.y) === C.idx.core, C.pick(core.x, core.y));
      // clicking a gene on the glass expresses it
      const r = cv.getBoundingClientRect(), id = ['ab:1', 'wp:1', 'acc:1'].find((q) => C.idx[q] !== undefined), p = C.project(C.idx[id]);
      cv.setPointerCapture = () => {};
      const at = { pointerId: 6, pointerType: 'mouse', button: 0, bubbles: true, clientX: r.left + p.x, clientY: r.top + p.y };
      cv.dispatchEvent(new PointerEvent('pointerdown', at)); cv.dispatchEvent(new PointerEvent('pointerup', at)); cv.dispatchEvent(new MouseEvent('click', at));
      T.check('clicking a gene on the glass expresses it', G.p.dna.length === 1, { id, dna: G.p.dna });
      // spending a point lays the circle out again, and the old scene goes
      T.check('the circle is rebuilt, not piled up', CD.circles().live === 1, CD.circles());
      T.click(/^Done$/); await T.wait(300);
      T.check('closing the circle puts its scene away', CD.circles().live === 0, CD.circles());
      return T.done();
    },
  },
];
