// 90-game.js: the game itself: its states (the title, the Household, the Lantern, the vigil, the results), the save of
// the Household and when it is written, the frame loop with its fixed 60 Hz steps, and the stand-ins that keep the
// game whole before the real screens, input and scene exist.
// Owns: Game
// Public:
//   Game.boot() -> Promise           called once by 99-boot.js: makes the view on #view (?view=2d or ?view=gl asks
//                                 for one), fits it to the window, reads the save (Store, SaveData.KEY), ends a vigil
//                                 the page left unfinished (Char.abandoned), opens the title and starts the frame
//                                 loop. The promise is kept once the save is read, so TB.ready means it is.
//   Game.start(cfg) -> S | null   starts a vigil and closes every screen. A cfg {mode, zone, seed, char, account}
//                                 that names a zone goes to Sim.create. Without a zone (Game.start() alone) the
//                                 run is Sim.debugScene(200, seed). Either way the seed is cfg.seed, else ?seed=,
//                                 else random; a cfg without one is copied and given it, and the run's cfg
//                                 (S.cfg.seed) tells which. null, and a toast, when the build has no simulation.
//                                 A run whose cfg.char is the character the save has away (Char.begin made the cfg:
//                                 Game.vigil does) is that character's vigil: at every toll, and when the page is
//                                 hidden, Char.checkpoint keeps what it earned and the save is written; when it ends
//                                 Char.end applies the end and the save is written before the results open (a run
//                                 ended by hand, with no S.result, ends as one left unfinished: Char.abandoned).
//   Game.title()                  drops the run and shows the title
//   Game.household()              the state 'household' and its screen: choose a standing character, or make one
//   Game.lantern(uid?) -> char | null   the state 'lantern' and its screen, with that character (else the save's
//                                 active one) made active; with no such character, the Household
//   Game.vigil(zone?, seed?) -> S | null   the active character goes down into a district ('dial' unless named):
//                                 Char.begin, the save written, Game.start. null when it cannot (no character, a
//                                 vigil under way, no such zone).
//   Game.make(classId, name, bells?) -> char | null   Char.create on the save; the new character is active
//   Game.write() -> Promise<boolean>   writes the save through Store (save.rev + 1)
//   Game.exportText() -> text     SaveData.encode of the save
//   Game.importText(text) -> {ok, errors, notes}   SaveData.decode; a sound save replaces the save held, and is
//                                 written (rev + 1: the one field an export then import changes). A vigil under
//                                 way in it ends as one left unfinished (Char.abandoned). Refused while a vigil is
//                                 under way here.
//   Game.command(cmd) -> boolean  Sim.command(S, cmd) on the run, followed by the notice 'command'. Menus send
//                                 their commands this way, so that the readers of S.events hear of what a
//                                 command emitted. false without a run.
//   Game.sim(seconds, opts) -> n  advances the run by whole steps without drawing, for tests, and returns how
//                                 many steps ran. opts {bot, policy}: with bot, and 28-bot.js in the build, the
//                                 input is Bot.input(S, policy) and offers go to Bot.choose(S, offer); otherwise
//                                 the input is Sim.NO_INPUT and every offer takes its first option. It stops
//                                 early when the run ends. Open screens and a hidden page do not hold it back.
//   Game.S                        the run, or null. A value.
//   Game.state                    'title' | 'household' | 'lantern' | 'run' | 'results'. A value.
//   Game.save                     the save of the Household (16-savedata.js), or null before the boot has read it.
//                                 Screens change it through Char and the packages' functions, then Game.write().
//   Game.char                     the save's active character, or null. A value.
//   Game.report                   what the end of the last character's vigil did (Char.end's report), or null
//   Game.debug                    {fps, steps, stepMs, drawMs, worstMs}, renewed twice a second: frames and
//                                 simulation steps a second, the mean time of one step and of one draw, and the
//                                 longest frame, in ms. ?fps=1 shows them in a corner of the screen.
//   Game.ROOMS                    the screens the Lantern offers, when they are registered, in this order: 'plan',
//                                 'finds', 'voices', 'bellframe', 'register', 'bequests'. Each is opened with
//                                 {char}: the active character.
//   Game.VERSION
//
// A frame: its time is added up and spent in steps of 1/60 s. A step runs as soon as any time is owed, so
// after a frame the simulation stands where the frame is or up to one step ahead of it, never behind. At most
// 4 steps run in a frame and what is then still owed is dropped, so a slow device slows the game down and
// never piles work up. The input is sampled once for each step, so a press that one sample reports reaches
// exactly one step: Input.sample() when 52-input.js is in the build, else the keys W A S D and the arrows as
// a move vector. No step runs while a screen that pauses is open, while S.phase is 'offer' (whoever shows the
// offer resolves it with Game.command), while the page is hidden, or once the run has ended.
// Then the frame is drawn: Scene.draw(S, alpha) when 68-scene.js is in the build and there is a run, else the
// stand-in: the plain ground with discs for the player, enemies, shots and pickups. alpha, above 0 and up to
// 1, says where the frame lies between the last two steps: a thing is drawn at px + (x - px) * alpha (py
// likewise), from where it stood before the last step (0) to where it stands now (1). On a 60 Hz screen each
// frame is one step and alpha is 1: the picture is the simulation as it stands. On a faster screen the frames
// in between show the way there, so movement is even on any screen and nothing is guessed ahead.
//
// The save. Read once at boot: no save yet gives SaveData.blank(); one that cannot be read is set aside under
// SaveData.KEY + '.unread' (nothing is lost) and the Household starts afresh, with a toast. It is written when a
// character is made or chosen, when a vigil begins, at every toll of a character's vigil and when the page is hidden
// during one (Char.checkpoint), when the vigil ends (Char.end), and whenever a screen calls Game.write(). A
// character's vigil dropped before its end (the title, the Household or another run started over it) ends as one
// the page left unfinished: Char.checkpoint, then Char.abandoned.
//
// Notices this file posts with Plat.emit, for files that load before it (Plat.on(name, fn) hears them):
//   'boot'    (view)              once, in Game.boot, when the view exists and before the title opens: the
//                                 moment for a module to set itself up, since nothing runs while files load
//   'state'   (state, before)     the game changed state
//   'step'    (S, live)           after every simulation step; live is false inside Game.sim. The ring
//                                 S.events holds what that step did (S.eventCount events from S.eventStart
//                                 on, see 20-sim.js) until the next step or command. A frame may hold up to
//                                 4 steps, so whoever reads events reads them here and not once a frame.
//   'command' (S, live, cmd)      after a command sent with Game.command (live), or by Game.sim to resolve an
//                                 offer (not live). S.events holds what the command emitted.
//   'frame'   (S, alpha, dt)      once a frame, after drawing; S is null while there is no run
//   'resize'  (cssW, cssH, dpr)   the view was fitted to a new size
//   'save'    (save, why)         the save was changed and is being written: why is 'made', 'chosen', 'vigil',
//                                 'toll', 'hidden', 'end', 'unfinished', 'import' or 'write' (Game.write)
//
// Stand-ins: the screens 'title', 'household', 'lantern', 'save-text' and 'results' are registered at boot only when
// no other file has registered those ids, so a real screen replaces one by registering first.
//   'household'   the standing characters, each a control that opens the Lantern with it; a new character: a name
//                 field, the classes it may take (Char.classes) and the control that makes it (focus starts there while
//                 nobody stands), ringing the heaviest hung bells, as many as the ringing places; the Register, which
//                 only lists the dead and what killed them (a dead character cannot be chosen); "Save text"; back.
//   'lantern'     opened with {char}: its name, class, level and experience, the coin and Hum of the Household, its
//                 mourning; a control for each of Game.ROOMS that is registered; "Go down to the Dial" (focus starts
//                 on it), Game.vigil; "The Household".
//   'save-text'   the save as text (Game.exportText), and a field whose text "Read it in" gives to Game.importText.
//   'results'     opened with {S, result, report}: report is Char.end's for a character's vigil, else null.
(function () {
  'use strict';

  const DT = Core.DT;
  const MAX_STEPS = 4;          // simulation steps in one frame, at most
  const MAX_GAP = 0.25;         // seconds one frame may add: a stall is not caught up
  const OWED = 1e-9;            // seconds: less frame time than this is rounding, and no reason for a step
  const DEBUG_ENEMIES = 200;
  const MAX_DISCS = 2048;       // room in the stand-in's buffer: more than the caps of all pools together
  // Screens tick at these rates but report each frame a hair early or late. Taking the nominal time when a
  // frame is within SNAP seconds of it keeps the steps even: one a frame at 60 Hz, one every other at 120 Hz.
  const RATES = [1 / 60, 1 / 120, 1 / 144, 1 / 90, 1 / 30], SNAP = 0.0002;
  const VIEWS = { '2d': '2D view', gl: '3D view' };
  const STORAGE = { saved: 'saves in this browser', memory: 'nothing is saved here', error: 'a save has failed' };
  const OUTCOMES = {
    left: 'You rang down and left by the lychgate.',
    spared: 'Tolled-for, you reached the lychgate in time. You live; your haul is lost.',
    died: 'You fell, and joined the dead of the district.',
  };
  const ROOMS = Object.freeze(['plan', 'finds', 'voices', 'bellframe', 'register', 'bequests']);
  const ROOM_NAMES = { plan: 'The Plan', finds: 'Finds', voices: 'Voices', bellframe: 'The Bellframe', register: 'The Register', bequests: 'Bequests' };
  const FIRST_ZONE = 'dial';

  let state = 'title', S = null, view = null, booted = false, visible = true, broken = false;
  let save = null, report = null, lastToll = 0;
  let acc = 0;                               // seconds of frame time not yet spent on steps; after a frame it is
                                             // 0 or less: how far the simulation stands ahead of the frame
  let fitW = 0, fitH = 0, fitDpr = 0;        // what the view was last fitted to
  let discs = null, readout = null;
  let span = 0, frames = 0, stepped = 0, stepTime = 0, drawTime = 0, worst = 0;   // the half second being measured

  Game.VERSION = '0.2.0';
  Game.ROOMS = ROOMS;
  Game.debug = { fps: 0, steps: 0, stepMs: 0, drawMs: 0, worstMs: 0 };
  Object.defineProperty(Game, 'S', { enumerable: true, get: function () { return S; } });
  Object.defineProperty(Game, 'state', { enumerable: true, get: function () { return state; } });
  Object.defineProperty(Game, 'save', { enumerable: true, get: function () { return save; } });
  Object.defineProperty(Game, 'report', { enumerable: true, get: function () { return report; } });
  Object.defineProperty(Game, 'char', {
    enumerable: true,
    get: function () { return save !== null && save.active !== null && typeof Char.find === 'function' ? Char.find(save, save.active) : null; },
  });

  function setState(next) {
    const before = state;
    if (next === before) return;
    state = next;
    Plat.emit('state', next, before);
  }

  // ---- the save ----

  const household = () => typeof SaveData.blank === 'function' && typeof Char.create === 'function';

  function written(why) {
    if (save === null || typeof Store.write !== 'function') return Promise.resolve(false);
    save.rev++;
    Plat.emit('save', save, why);
    return Store.write(SaveData.KEY, save);
  }

  Game.write = function () { return written('write'); };

  async function readSave() {
    if (!household()) return;
    let raw = null;
    try { raw = await Store.read(SaveData.KEY); } catch (e) { raw = null; }
    if (raw === null) { save = SaveData.blank(); return; }
    const got = SaveData.read(raw);
    if (got.save === null) {
      await Store.write(SaveData.KEY + '.unread', raw);   // kept, so that nothing is lost
      save = SaveData.blank();
      UI.toast('The save could not be read, and was set aside. The Household begins afresh.', 9000);
      return;
    }
    save = got.save;
    const left = typeof Char.abandoned === 'function' ? Char.abandoned(save) : null;
    if (left !== null) {
      await written('unfinished');
      UI.toast(left.name + '’s last vigil was left unfinished. ' + left.name + ' lives, and its haul is lost.', 7000);
    }
  }

  // is the run the vigil of the character the save has away?
  function ownRun(run) {
    return run !== null && save !== null && save.away !== null && run.cfg && run.cfg.char && run.cfg.char.uid === save.away.char;
  }

  // a character's vigil dropped before its end ends as one the page left unfinished
  function dropRun() {
    if (ownRun(S) && S.phase !== 'ended') {
      Char.checkpoint(save, S);
      report = Char.abandoned(save);
      written('unfinished');
    }
  }

  // after each step of a character's vigil: a toll is a checkpoint
  function heard(run) {
    if (run.toll === lastToll || !ownRun(run)) return;
    lastToll = run.toll;
    Char.checkpoint(save, run);
    written('toll');
  }

  // ---- input until 52-input.js arrives: W A S D and the arrows ----

  const keys = {   // by KeyboardEvent.code: true while the key is down
    KeyW: false, KeyA: false, KeyS: false, KeyD: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
  };
  const keyFrame = { mx: 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false };

  function releaseKeys() { for (const code in keys) keys[code] = false; }

  function wireKeys() {
    window.addEventListener('keydown', function (e) {
      if (keys[e.code] === false && !e.altKey && !e.ctrlKey && !e.metaKey && UI.top() === null) keys[e.code] = true;
    });
    window.addEventListener('keyup', function (e) { if (keys[e.code] === true) keys[e.code] = false; });
    window.addEventListener('blur', releaseKeys);
  }

  function keyInput() {
    let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    if (mx && my) {
      mx *= Math.SQRT1_2;
      my *= Math.SQRT1_2;
    }
    keyFrame.mx = mx;
    keyFrame.my = my;
    return keyFrame;
  }

  function sampleInput() { return typeof Input.sample === 'function' ? Input.sample() : keyInput(); }

  // ---- drawing until 68-scene.js arrives: discs on the plain ground ----

  const cam = { x: 0, y: 0, zoom: 1 };

  // Adds one disc for each live entry of a pool and returns the new count. A disc lies between where its
  // entity stood before the last step (px, py) and where it stands now, alpha of the way along.
  function addPool(n, pool, alpha, radius, r, g, b) {
    if (!pool || !pool.items) return n;
    const items = pool.items, stride = Gfx.DISC_STRIDE;
    for (let i = 0; i < pool.n && n < MAX_DISCS; i++) {
      const e = items[i], o = n * stride;
      if (e.alive === false) continue;   // killed in the last step, and still in its place until the next
      n++;
      discs[o] = e.px + (e.x - e.px) * alpha;
      discs[o + 1] = e.py + (e.y - e.py) * alpha;
      discs[o + 2] = e.r > 0 ? e.r : radius;
      discs[o + 3] = r;
      discs[o + 4] = g;
      discs[o + 5] = b;
      discs[o + 6] = 1;
    }
    return n;
  }

  function standIn(alpha) {
    const p = S ? S.player : null;
    cam.x = p ? p.px + (p.x - p.px) * alpha : 0;
    cam.y = p ? p.py + (p.y - p.py) * alpha : 0;
    view.begin(cam, null);
    if (S) {
      let n = addPool(0, S.pickups, alpha, 0.15, 0.44, 0.7, 0.65);
      n = addPool(n, S.enemies, alpha, 0.4, 0.66, 0.26, 0.22);
      n = addPool(n, S.shots, alpha, 0.12, 0.94, 0.79, 0.47);
      if (p && n < MAX_DISCS) {
        const o = n++ * Gfx.DISC_STRIDE;
        discs[o] = cam.x;
        discs[o + 1] = cam.y;
        discs[o + 2] = p.r > 0 ? p.r : 0.4;
        discs[o + 3] = 0.925;
        discs[o + 4] = 0.906;
        discs[o + 5] = 0.855;
        discs[o + 6] = p.alive === false ? 0.35 : 1;
      }
      view.discs(discs, n);
    }
    view.end(null);
  }

  // ---- the view and the numbers ----

  function fit() {
    const canvas = view.canvas, w = canvas.clientWidth, h = canvas.clientHeight, dpr = Plat.dpr();
    if (!w || !h || (w === fitW && h === fitH && dpr === fitDpr)) return;
    fitW = w;
    fitH = h;
    fitDpr = dpr;
    view.resize(w, h, dpr);
    Plat.emit('resize', w, h, dpr);
  }

  function account(dt, steps, stepMs, drawMs) {
    span += dt;
    frames++;
    stepped += steps;
    stepTime += stepMs;
    drawTime += drawMs;
    if (dt * 1000 > worst) worst = dt * 1000;
    if (span < 0.5) return;
    const d = Game.debug;
    d.fps = frames / span;
    d.steps = stepped / span;
    d.stepMs = stepped ? stepTime / stepped : 0;
    d.drawMs = drawTime / frames;
    d.worstMs = worst;
    span = frames = stepped = stepTime = drawTime = worst = 0;
    fit();   // also catches a change no resize event told of, such as a move to a screen with other pixels
    if (!readout) return;
    const hud = document.getElementById('hud');
    if (!readout.isConnected && hud) hud.appendChild(readout);   // whoever rebuilt the layer dropped it
    readout.textContent = 'fps ' + d.fps.toFixed(0) + '  steps ' + d.steps.toFixed(0) + '  step ' + d.stepMs.toFixed(2) +
      ' ms  draw ' + d.drawMs.toFixed(2) + ' ms  worst ' + d.worstMs.toFixed(0) + ' ms  ' + view.name;
  }

  // ---- the frame ----

  function finish() {
    report = null;
    if (ownRun(S)) {
      if (S.result) {
        report = Char.end(save, S);
        written('end');
      } else {                                     // ended by hand, without the simulation's end: as one left unfinished
        Char.checkpoint(save, S);
        report = Char.abandoned(save);
        written('unfinished');
      }
    }
    setState('results');
    UI.clear();
    UI.open('results', { S: S, result: S.result || null, report: report });
  }

  function tick(dt) {
    const t0 = Plat.now();
    let steps = 0;
    if (state === 'run' && S && visible && S.phase === 'play' && !UI.pausing()) {
      for (let i = 0; i < RATES.length; i++) {
        if (Math.abs(dt - RATES[i]) < SNAP) dt = RATES[i];
      }
      acc += dt < MAX_GAP ? dt : MAX_GAP;
      while (acc > OWED && steps < MAX_STEPS && S.phase === 'play' && !UI.pausing()) {
        Sim.step(S, sampleInput());
        acc -= DT;
        steps++;
        heard(S);
        Plat.emit('step', S, true);
      }
      if (acc > 0) acc = 0;   // more was owed than one frame may run, or the run stopped: the rest is dropped
    }
    if (state === 'run' && S && S.phase === 'ended') finish();
    const t1 = Plat.now(), alpha = 1 + acc / DT;   // acc is above -DT and at most 0
    if (S && typeof Scene.draw === 'function') Scene.draw(S, alpha); else standIn(alpha);
    const t2 = Plat.now();
    Plat.emit('frame', S, alpha, dt);
    account(dt, steps, t1 - t0, t2 - t1);
  }

  function frame(now, dt) {
    try {
      tick(dt);
    } catch (err) {
      if (!broken) {
        broken = true;
        UI.toast('The game hit an error: ' + (err && err.message ? err.message : String(err)), 12000);
      }
      throw err;   // the console and the tests must see it too
    }
  }

  // ---- the stand-in screens ----

  function buildLine() {
    return 'Build ' + Game.VERSION + ' · ' + (VIEWS[view.name] || view.name) + ' · ' + (STORAGE[Store.status] || Store.status);
  }

  let stopWatching = null;   // takes the open title off Store.onStatus again

  const titleScreen = {
    back: false,
    open: function () {
      const build = UI.h('p', { class: 'ui-note' }, buildLine());
      stopWatching = Store.onStatus(function () { build.textContent = buildLine(); });
      const go = household() ? UI.button('The Household', function () { Game.household(); }, { class: 'primary', dataset: { focus: '' } })
        : UI.button('Begin vigil', function () { Game.start(); }, { class: 'primary', dataset: { focus: '' } });
      return UI.h('div', { class: 'ui-stack game-title' },
        UI.h('h1', { class: 'ui-title' }, 'Tollbound'),
        UI.h('div', { class: 'ui-rule' }),
        UI.h('p', { class: 'ui-sub' }, 'The bells are dumb, and every toll wakes the dead. Keep the vigil; leave by a lychgate.'),
        go,
        typeof Settings.open === 'function' ? UI.button('Settings', function () { Settings.open(); }, { class: 'second' }) : null,
        build);
    },
    close: function () {
      if (stopWatching) stopWatching();
      stopWatching = null;
    },
  };

  function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0)), rest = s % 60;
    return Math.floor(s / 60) + ':' + (rest < 10 ? '0' : '') + rest;
  }

  const className = (id) => (Defs.has('class', id) ? Defs.get('class', id).name : id);
  const zoneName = (id) => (Defs.has('zone', id) ? Defs.get('zone', id).name : id);

  // what killed a character, in words: the body whose attack it was, or the kind of harm
  function killer(cause) {
    if (typeof cause.attack === 'string') {
      const bodies = Defs.all('enemy').concat(Defs.all('boss'));
      for (let i = 0; i < bodies.length; i++) {
        const own = bodies[i].attacks.some((a) => (typeof a === 'string' ? a : a.id) === cause.attack);
        if (own) return bodies[i].name;
      }
    }
    return cause.kind === 'drag' ? 'the press of the dead' : cause.kind === 'swell' ? 'a Swell of the dead' : 'a Blow of the dead';
  }

  function charLine(c) { return className(c.class) + ', level ' + c.level; }

  // the bells a new character rings until a screen lets the player choose: the heaviest hung, as many as the places
  function heaviestBells() {
    const frame = save.account.frame;
    const hung = frame.bells.filter(function (b) { return b.pit !== null; }).sort(function (a, b) { return b.weight - a.weight || a.uid - b.uid; });
    return hung.slice(0, frame.places).map(function (b) { return b.uid; });
  }

  const householdScreen = {
    back: function () { Game.title(); },
    open: function () {
      const living = save.chars.map(function (c) {
        return UI.button(c.name + ' — ' + charLine(c), function () { Game.lantern(c.uid); }, { class: 'game-pick', dataset: { char: String(c.uid) } });
      });
      const field = UI.h('input', { type: 'text', class: 'game-field', maxlength: '24', value: 'Ringer ' + (save.chars.length + save.register.length + 1), 'aria-label': 'Name', dataset: { field: 'name' } });
      const classes = Char.classes(save);
      let chosen = classes.length > 0 ? classes[0] : null;
      const make = function () {
        const made = chosen === null ? null : Game.make(chosen, field.value, heaviestBells());
        if (made === null) UI.toast('A name of 1 to 24 letters is needed.');
        else Game.lantern(made.uid);
      };
      field.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); make(); } });
      const pick = classes.length > 1 ? UI.h('div', { class: 'ui-row' }, classes.map(function (id) {
        const b = UI.button(className(id), function () {
          chosen = id;
          for (const other of b.parentNode.children) other.classList.toggle('primary', other === b);
        }, { class: id === chosen ? 'primary' : 'second', dataset: { class: id } });
        return b;
      })) : null;
      const dead = save.register.map(function (d) {
        const how = d.how === 'retired' ? 'retired, and recast as a bell'
          : (d.cause ? 'killed by ' + killer(d.cause) : 'died') + ' in ' + zoneName(d.zone) + ' after ' + d.toll + (d.toll === 1 ? ' toll' : ' tolls');
        return UI.h('li', { class: 'game-dead', dataset: { char: String(d.uid) } }, d.name + ', ' + className(d.class) + ' of level ' + d.level + ': ' + how);
      });
      return UI.h('div', { class: 'ui-panel ui-stack game-household' },
        UI.h('h2', { class: 'ui-heading' }, 'The Household'),
        UI.h('p', { class: 'ui-sub' }, living.length ? 'Choose who goes down tonight.' : 'Nobody stands in the Household yet.'),
        living.length ? UI.h('div', { class: 'ui-stack game-list' }, living) : null,
        UI.h('div', { class: 'ui-stack game-make' },
          UI.h('label', { class: 'ui-note' }, 'A new character'),
          field, pick,
          UI.button('Make ' + (classes.length === 1 ? 'a ' + className(classes[0]) : 'the character'), make,
            { class: living.length ? 'second' : 'primary', dataset: Object.assign({ make: '' }, living.length ? {} : { focus: '' }) })),
        dead.length ? UI.h('div', { class: 'ui-stack' }, UI.h('p', { class: 'ui-note' }, 'The Register'), UI.h('ul', { class: 'game-register' }, dead)) : null,
        UI.h('div', { class: 'ui-row' },
          UI.button('Save text', function () { UI.open('save-text'); }, { class: 'second' }),
          UI.button('Back', function () { Game.title(); }, { class: 'second' })));
    },
  };

  const lanternScreen = {
    back: function () { Game.household(); },
    open: function (args) {
      const c = (args && args.char) || Game.char;
      if (!c) return UI.h('div', { class: 'ui-panel' }, UI.button('The Household', function () { Game.household(); }, { class: 'primary' }));
      const need = Char.need(c), xp = need === Infinity ? 'the most there is' : Math.floor(c.xp) + ' of ' + need + ' to the next';
      const rooms = ROOMS.filter(function (id) { return UI.has(id); }).map(function (id) {
        return UI.button(ROOM_NAMES[id], function () { UI.open(id, { char: Game.char }); }, { class: 'second', dataset: { room: id } });
      });
      const grief = Char.mourning(c);
      return UI.h('div', { class: 'ui-panel ui-stack game-lantern', dataset: { char: String(c.uid) } },
        UI.h('p', { class: 'ui-note' }, 'The Lantern'),
        UI.h('h2', { class: 'ui-heading' }, c.name),
        UI.h('p', { class: 'ui-sub' }, charLine(c) + ' · ' + xp),
        UI.h('p', { class: 'game-tally' }, 'Coin ' + Math.floor(save.account.coin) + '  ·  Hum ' + Math.floor(save.account.hum) + '  ·  Tolls heard ' + c.tolls +
          (grief ? '  ·  in ' + grief + ' mourning' : '')),
        rooms.length ? UI.h('div', { class: 'ui-row' }, rooms) : null,
        UI.button('Go down to ' + zoneName(FIRST_ZONE).replace(/^The /, 'the '), function () { Game.vigil(FIRST_ZONE); }, { class: 'primary', dataset: { focus: '', vigil: FIRST_ZONE } }),
        UI.button('The Household', function () { Game.household(); }, { class: 'second' }));
    },
  };

  const saveTextScreen = {
    open: function () {
      const out = UI.h('textarea', { class: 'game-text', readonly: true, rows: '4', 'aria-label': 'The save, as text', dataset: { field: 'export' } });
      out.value = Game.exportText();
      const into = UI.h('textarea', { class: 'game-text', rows: '4', 'aria-label': 'A save to read', placeholder: 'Paste a save here', dataset: { field: 'import' } });
      const said = UI.h('p', { class: 'ui-note', role: 'status' }, '');
      return UI.h('div', { class: 'ui-panel ui-stack game-save-text' },
        UI.h('h2', { class: 'ui-heading' }, 'Save text'),
        UI.h('p', { class: 'ui-sub' }, 'Keep this text somewhere safe: it is the whole Household.'),
        out,
        into,
        said,
        UI.h('div', { class: 'ui-row' },
          UI.button('Read it in', function () {
            const got = Game.importText(into.value);
            if (!got.ok) {
              said.textContent = 'It could not be read: ' + got.errors.slice(0, 3).join('; ');
              return;
            }
            UI.toast('The Household was read in.');
            if (state === 'household') Game.household(); else UI.back();   // the Household under it shows the save read
          }, { class: 'second', dataset: { read: '' } }),
          UI.button('Back', function () { UI.back(); }, { class: 'primary', dataset: { focus: '' } })));
    },
  };

  const resultsScreen = {
    back: false,
    open: function (args) {
      const run = (args && args.S) || {}, result = (args && args.result) || {}, rep = args && args.report;
      // the totals of the result where the simulation gives them, else what the run itself says
      const pick = function (name, other) { return typeof result[name] === 'number' ? result[name] : run[other]; };
      const tolls = pick('tolls', 'toll'), kills = pick('kills', 'kills');
      let tally = 'Time ' + clock(pick('time', 't'));
      if (typeof tolls === 'number') tally += '  ·  Tolls ' + tolls;
      if (typeof kills === 'number') tally += '  ·  Laid ' + kills;
      const way = rep && rep.death === null ? UI.button('Back to the Lantern', function () { Game.lantern(rep.char); }, { class: 'primary', dataset: { focus: '' } })
        : rep ? UI.button('To the Household', function () { Game.household(); }, { class: 'primary', dataset: { focus: '' } })
          : UI.button('Back to the title', function () { Game.title(); }, { class: 'primary', dataset: { focus: '' } });
      return UI.h('div', { class: 'ui-panel ui-stack game-results' },
        UI.h('h2', { class: 'ui-heading' }, 'The vigil is over'),
        UI.h('p', { class: 'ui-sub' }, OUTCOMES[result.outcome] || 'The night closes over the district.'),
        UI.h('p', { class: 'game-tally' }, tally),
        way);
    },
  };

  // ---- starting, ending, and running without the screen ----

  function seedOf(cfg) {
    if (cfg && cfg.seed !== undefined && cfg.seed !== null) return cfg.seed;
    const asked = Plat.query('seed');
    if (asked) return /^\d+$/.test(asked) ? Number(asked) >>> 0 : Core.hashStr(asked);
    return (Math.random() * 4294967296) >>> 0;
  }

  Game.start = function (cfg) {
    const real = !!(cfg && cfg.zone) && typeof Sim.create === 'function';
    if (!real && typeof Sim.debugScene !== 'function') {
      UI.toast('This build has no simulation yet.');
      return null;
    }
    const seed = seedOf(cfg), mine = cfg && cfg.char && save !== null && save.away !== null && cfg.char.uid === save.away.char;
    if (!mine) dropRun();
    // Sim.create keeps the cfg it is given, so a cfg that brought its seed goes in as it is
    S = !real ? Sim.debugScene(DEBUG_ENEMIES, seed) : Sim.create(cfg.seed === seed ? cfg : Object.assign({}, cfg, { seed: seed }));
    acc = 0;
    lastToll = S.toll;
    releaseKeys();
    UI.clear();
    setState('run');
    return S;
  };

  // leaves the run (a character's vigil left before its end ends unfinished) and shows a screen of no run
  function away(next, screen, args) {
    dropRun();
    S = null;
    acc = 0;
    UI.clear();
    setState(next);
    UI.open(screen, args);
  }

  Game.title = function () { away('title', 'title'); };

  Game.household = function () {
    if (save === null) { Game.title(); return; }
    away('household', 'household');
  };

  Game.lantern = function (uid) {
    const c = save === null ? null : Char.find(save, uid === undefined || uid === null ? save.active : uid);
    if (c === null) { Game.household(); return null; }
    if (save.active !== c.uid) { save.active = c.uid; written('chosen'); }
    away('lantern', 'lantern', { char: c });
    return c;
  };

  Game.make = function (classId, name, bells) {
    if (save === null) return null;
    const c = Char.create(save, classId, name, bells || []);
    if (c === null) return null;
    save.active = c.uid;
    written('made');
    return c;
  };

  Game.vigil = function (zone, seed) {
    const c = Game.char;
    if (c === null) return null;
    if (ownRun(S) && S.phase !== 'ended') dropRun();
    const cfg = Char.begin(save, c.uid, zone || FIRST_ZONE, seedOf(seed === undefined ? null : { seed: seed }));
    if (cfg === null) return null;
    written('vigil');
    return Game.start(cfg);
  };

  Game.exportText = function () { return save === null ? '' : SaveData.encode(save); };

  Game.importText = function (text) {
    if (save === null) return { ok: false, errors: ['this build keeps no Household'], notes: [] };
    if (ownRun(S) && S.phase !== 'ended') return { ok: false, errors: ['a vigil is under way'], notes: [] };
    const got = SaveData.decode(text);
    if (got.save === null) return { ok: false, errors: got.errors, notes: got.notes };
    save = got.save;
    // a save taken in the middle of a vigil: that vigil cannot go on here, so it ends as one left unfinished
    if (save.away !== null && Char.abandoned(save) !== null) got.notes.push('the vigil under way in it ended as one left unfinished');
    written('import');
    return { ok: true, errors: [], notes: got.notes };
  };

  // A command empties S.events and may emit new ones, as a step does: the notice lets their readers know.
  function command(cmd, live) {
    const done = Sim.command(S, cmd);
    Plat.emit('command', S, live, cmd);
    return done;
  }

  Game.command = function (cmd) { return S && typeof Sim.command === 'function' ? command(cmd, true) : false; };

  // Resolves the offers that stand in the way of the next step. False when one would not go away.
  function resolveOffers(bot) {
    for (let tries = 0; tries < 64 && S.phase === 'offer'; tries++) {
      const pick = bot && typeof Bot.choose === 'function' ? Bot.choose(S, S.offer) : 0;
      command(pick && typeof pick === 'object' ? pick : { type: 'pick', index: typeof pick === 'number' ? pick : 0 }, false);
    }
    return S.phase !== 'offer';
  }

  Game.sim = function (seconds, opts) {
    if (!S || state !== 'run' || typeof Sim.step !== 'function') return 0;
    const want = Math.round(seconds * Core.HZ), bot = !!(opts && opts.bot) && typeof Bot.input === 'function';
    const policy = opts ? opts.policy : undefined;
    let done = 0;
    while (done < want && S.phase !== 'ended') {
      if (S.phase === 'offer' && !resolveOffers(bot)) break;
      if (S.phase !== 'play') break;
      Sim.step(S, bot ? Bot.input(S, policy) : Sim.NO_INPUT);
      done++;
      heard(S);
      Plat.emit('step', S, false);
    }
    if (S.phase === 'ended') finish();
    return done;
  };

  Game.boot = function () {
    if (booted) return Promise.resolve();
    booted = true;
    const canvas = document.getElementById('view');
    Core.assert(canvas, 'the page has no #view canvas');
    view = Gfx.create(canvas, Plat.query('view') || 'gl');
    discs = new Float32Array(MAX_DISCS * Gfx.DISC_STRIDE);
    fit();
    Plat.onResize(fit);
    visible = document.visibilityState !== 'hidden';
    Plat.onVisibility(function (shown) {
      visible = shown;
      if (shown) return;
      releaseKeys();
      if (ownRun(S) && S.phase !== 'ended') {      // the page may not come back: keep what was earned
        Char.checkpoint(save, S);
        written('hidden');
      }
    });
    if (typeof Input.sample !== 'function') wireKeys();
    Plat.emit('boot', view);
    if (!UI.has('title')) UI.screen('title', titleScreen);
    if (!UI.has('household')) UI.screen('household', householdScreen);
    if (!UI.has('lantern')) UI.screen('lantern', lanternScreen);
    if (!UI.has('save-text')) UI.screen('save-text', saveTextScreen);
    if (!UI.has('results')) UI.screen('results', resultsScreen);
    if (Plat.query('fps') === '1') readout = UI.h('div', { class: 'game-fps', 'aria-hidden': 'true' });
    return readSave().then(function () {
      UI.open('title');
      Plat.loop(frame);
    });
  };
})();
