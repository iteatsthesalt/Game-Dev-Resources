/* ============================================================
   Cinderdeep — Emberhold Proving Trail and the combat toolkit
   Optional per-hero progress; encounters reconstruct from milestones.
   ============================================================ */
const SG = { Z: null, objects: [], nodes: {}, dummy: null, encounter: [], tick: 0, hud: null, trial: null, drillAt: 0 };
const SG_STEPS = [
  ['A place to begin', 'Speak with Captain Rowan at the trail camp.', 'mentor'],
  ['Find your reach', 'Land three attacks on the practice dummy.', 'dummy'],
  ['Make room to breathe', 'Dodge twice beside the practice circle.', 'dummy'],
  ['Trouble in the orchard', 'Clear three raiders from the Orchard Watch.', 'orchard'],
  ['What you carry forward', 'Recover the seal and choose a trail discipline.', 'seal'],
  ['The Briar Captain', 'Follow the trail and defeat its captain. Watch his attack warnings.', 'boss'],
  ['The road is yours', 'Claim your trail reward. Try the Watch Trial or explore the Realm.', 'mentor'],
];
const sgOn = () => W.on && !W.inInst && W.Z && G.fl && G.fl.realm && G.p;
function sgBook() {
  if (!W.ch) return { stage: 0, hits: 0, dodges: 0, kills: 0, scrap: 0, paid: {}, boon: null };
  const s = W.ch.trail || (W.ch.trail = { stage: 0, hits: 0, dodges: 0, kills: 0, scrap: 0, paid: {}, boon: null, claimed: false });
  s.stage = clamp(Math.floor(s.stage || 0), 0, 6); s.scrap = clamp(Math.floor(s.scrap || 0), 0, 999); s.paid = s.paid || {}; return s;
}
function sgRemove() {
  if (SG.Z) for (const o of SG.objects) { const a = SG.Z.objs[chunkOf(Math.floor(o.x / TS), Math.floor(o.y / TS))], i = a.indexOf(o); if (i >= 0) a.splice(i, 1); }
  for (const e of SG.encounter) { e.dead = true; e.despawn = true; }
  if (SG.dummy) SG.dummy.dead = true;
  SG.objects = []; SG.encounter = []; SG.dummy = null; SG.nodes = {}; SG.trial = null;
}
function sgPlace(kind, x, y, name) { const o = { kind: 'sg', detail: kind, x, y, name }; addObj(W.Z, o); SG.objects.push(o); SG.nodes[kind] = o; return o; }
function sgSpot(x, y) {
  ensureChunks(W.Z, x, y, 1);
  for (let r = 0; r <= 80; r += 8) for (let i = 0; i < (r ? 16 : 1); i++) { const a = i / 16 * TAU, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (lwGood(px, py, 7)) return { x: px, y: py }; }
  return realmFreeSpot(x, y);
}
function sgReset(Z) {
  sgRemove(); SG.Z = Z; SG.tick = 0; SG.drillAt = W.t + 2;
  if (!sgOn()) return;
  recalcStats(G.p);
  if (Z.id !== 'meadows') return;
  const town = Z.towns.find(t => t.kind === 'capital') || Z.towns[0]; if (!town) return;
  const x = (town.x + .5) * TS, y = (town.y + town.plazaR + 2.5) * TS;
  const plan = [['mentor', -30, 30, 'Captain Rowan'], ['dummy', -62, 65, 'Practice Circle'], ['fire', 58, 78, 'Trail Camp'], ['workbench', 80, 67, 'Field Workbench'], ['board', -55, -18, 'Proving Trail Board']];
  for (const [kind, dx, dy, name] of plan) { const q = sgSpot(x + dx, y + dy); sgPlace(kind, q.x, q.y, name); }
  const oy = (town.y + town.r + 8) * TS;
  for (const [kind, dx, dy, name] of [['orchard', -40, 0, 'Orchard Watch'], ['seal', 20, 35, 'Waywatch Seal'], ['boss', 0, 190, 'Briar Crossing']]) { const q = sgSpot(x + dx, oy + dy); sgPlace(kind, q.x, q.y, name); }
  // A row of cairns makes the southward route legible without replacing terrain.
  const end = SG.nodes.orchard; for (let py = y + 140; py < end.y - 30; py += 88) { const q = sgSpot(x + 25, py); sgPlace('cairn:' + py, q.x, q.y, 'South trail'); }
  // Keep small decorative clumps out of the service stations.
  if (typeof LW !== 'undefined' && LW.Z === Z) for (const o of [...LW.objects]) if (!o.actor && !o.id && SG.objects.some(n => Math.hypot(n.x - o.x, n.y - o.y) < 20)) lwRemove(o);
  if(G.p.level<6)for(const e of G.ents)if(e.world&&!e.boss&&!e.aggro&&[SG.nodes.orchard,SG.nodes.boss].some(n=>Math.hypot(n.x-e.x,n.y-e.y)<160)){e.dead=true;e.despawn=true;}
  if (sgBook().stage === 1) sgDummy();
  if (!W.ch.track && !W.ch.wp && G.p.level <= 5) W.ch.track = 'starter';
}
hook('realmZone', sgReset);
function sgAdvance(expected) {
  const s = sgBook(); if (s.stage !== expected || expected >= 6) return false;
  s.stage++; SG.encounter = SG.encounter.filter(e => !e.dead);
  if (!s.paid[expected]) { s.paid[expected] = true; s.scrap = Math.min(999, s.scrap + (expected === 0 ? 3 : 2)); G.p.gold += expected === 0 ? 12 : 8; if (expected > 0) gainXP(6 + expected * 3); }
  Sound.play('clear', { v: .5 }); toast(SG_STEPS[s.stage][0] + ' · Journey updated', '#e3cf96');
  if (s.stage === 1) sgDummy();
  if (s.stage === 2 && SG.dummy) { SG.dummy.dead = true; SG.dummy = null; }
  if (s.stage === 3) W.ch.track = 'starter';
  if (s.stage === 6) { s.completedAt = W.t; banner('The Proving Trail is yours', 'Return to Captain Rowan for your reward', 3); }
  saveRealm(true); return true;
}

/* ---------- hand-painted starter stations, upright in every camera view ---------- */
const SG_ART = new Map();
function sgArt(o) {
  const kind = o.detail.startsWith('cairn:') ? 'cairn' : o.detail, stage=W.ch&&W.ch.trail?W.ch.trail.stage:0, secured=kind==='orchard'&&stage>=4||kind==='boss'&&stage>=6, key = kind+':'+secured;
  if (SG_ART.has(key)) return SG_ART.get(key); if (!rigBudgetOk(true)) return null;
  const now = performance.now(), p = new PP(48, 54), R = (x,y,w,h,c) => p.rect(x,y,w,h,c), L = (x,y,a,b,c) => p.line(x,y,a,b,c), E = (x,y,rx,ry,c) => p.ell(x,y,rx,ry,c), T = (pts,c) => p.poly(pts,c);
  if (kind === 'mentor') {
    R(17,34,5,17,'#40506b');R(27,34,5,17,'#40506b');R(15,22,20,16,'#8799a0');R(17,24,3,10,'#c9d2cf');R(16,36,18,3,'#796244');R(21,12,10,11,'#d6ab85');R(19,9,14,5,'#a8b9bd');R(18,13,16,3,'#7b8f95');R(25,7,3,5,'#d3b368');R(34,24,3,23,'#7b6041');T([[32,25],[36,15],[40,25]],'#d4e0d5');R(19,51,5,2,'#342d29');R(27,51,6,2,'#342d29');
  } else if (kind === 'dummy') {
    E(24,50,21,3,'#7e795a');E(24,49,18,2,'#b6a079');R(22,20,4,30,'#8e6741');L(8,30,39,30,'#9c7951');R(17,23,15,15,'#b9a27b');R(20,25,9,11,'#8b7556');E(24,16,7,7,'#bda779');L(20,15,28,18,'#554632');L(28,15,20,18,'#554632');R(22,9,5,2,'#d8be8f');
  } else if (kind === 'fire') {
    E(24,49,17,4,'#898378');E(24,47,12,3,'#3a3630');L(16,49,32,44,'#71533e');L(16,44,32,49,'#8b6443');T([[18,45],[24,27],[31,45]],'#e69a48');T([[22,45],[26,34],[29,45]],'#f9d585');R(5,25,3,24,'#796245');R(4,25,11,7,'#b5ac7a');R(8,26,2,5,'#f3eac5');R(6,28,6,2,'#f3eac5');
  } else if (kind === 'workbench') {
    R(7,35,34,6,'#a87948');R(10,41,4,12,'#725c40');R(35,41,4,12,'#725c40');R(11,34,26,2,'#d0a16a');R(13,27,10,7,'#687c84');R(12,26,14,3,'#a7b6b6');R(28,30,11,3,'#d3bc83');L(34,22,31,36,'#8a6441');R(32,20,8,4,'#a7b3ad');
  } else if (kind === 'board') {
    R(9,17,31,23,'#654f36');R(11,19,27,19,'#9b8156');R(12,40,4,13,'#6b553c');R(34,40,4,13,'#6b553c');R(15,23,8,11,'#d9cba4');R(27,21,7,12,'#dfd3ab');L(17,26,21,26,'#8b7956');L(17,29,21,29,'#8b7956');R(29,24,2,5,'#9e6e4a');T([[6,17],[24,9],[43,17]],'#775a3e');
  } else if (kind === 'orchard') {
    R(7,30,3,22,'#7f6644');R(37,30,3,22,'#7f6644');L(7,32,39,32,'#af8850');R(14,29,21,9,secured?'#b2c287':'#879762');R(18,31,13,3,'#ddd4a7');E(14,49,5,3,'#5f8245');E(36,50,5,3,'#65884b');
  } else if (kind === 'seal') {
    R(11,45,27,7,'#7b8278');R(15,40,19,7,'#a2a790');R(20,28,10,13,'#546b78');p.disc(25,31,6,'#9dc5b1');p.disc(25,31,3,'#e1d8a5');L(25,26,25,36,'#527e7a');L(21,31,29,31,'#527e7a');
  } else if (kind === 'boss') {
    R(5,20,6,32,'#6d6353');R(37,20,6,32,'#6d6353');R(5,17,38,6,'#8a7859');R(12,23,3,20,'#a77b46');R(15,24,12,19,secured?'#5f855e':'#8a4c3e');R(18,26,6,11,'#d3a16b');R(20,24,2,16,'#cfba86');L(4,49,13,51,'#8c9a65');L(35,50,44,48,'#8c9a65');
  } else {
    E(24,50,9,2,'#778577');E(24,47,6,3,'#8c9a85');E(24,42,4,3,'#b2b49b');R(24,35,1,6,'#8e6843');R(25,35,8,4,'#d5b571');
  }
  p.outline();const raw=p.sprite(24,52),scale=kind==='mentor'?.55:kind==='dummy'?.7:.75,w=Math.round(48*scale),hh=Math.round(54*scale),c=mkCanvas(w,hh),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(raw.c,0,0,w,hh);const sp={c,w,h:hh,ax:Math.round(24*scale),ay:Math.round(52*scale)};SG_ART.set(key,sp);RIG_BUDGET.spent+=performance.now()-now;return sp;
}
const _objSG = objSprite;
objSprite = function(o,b){return o.kind==='sg' ? sgOn() ? sgArt(o) : null : _objSG(o,b);};
const _drawSG = drawRealmObj;
drawRealmObj = function(g,o,sp,cx,cy,faded){
  if(o.kind!=='sg')return _drawSG(g,o,sp,cx,cy,faded);if(!sgOn()||!sp)return;
  shadow(g,o.x-cx,o.y-cy,o.detail==='mentor'?5:11);drawSprite(g,sp,o.x-cx,o.y-cy,false);
  if(o.detail==='fire'){drawFlame(g,o.x-cx,o.y-cy-9,.65,o.x);}
  const s=W.ch.trail,stage=s?s.stage:0,target=SG_STEPS[stage][2];
  if(o.detail===target&&Math.hypot(o.x-G.p.x,o.y-G.p.y)<180){const t=pixelText(stage===6?'REWARD':'!','#edd28a');g.drawImage(t,Math.round(o.x-cx-t.width/2),Math.round(o.y-cy-sp.ay-9));}
};
function sgDummy(){
  if(SG.dummy&&!SG.dummy.dead)return;const n=SG.nodes.dummy;if(!n)return;
  const e=spawnEnemy('skeleton',n.x,n.y,{noSpawnAnim:true,room:0});if(!e)return;
  e.sgDummy=true;e.world=false;e.rooted=true;e.noContact=true;e.def={...e.def,ai:'traildummy',name:'Practice Dummy'};e.maxHp=e.hp=9999;e.xp=e.gold=0;const sp=sgArt(n);e.frames=[sp||{c:mkCanvas(1,1),w:1,h:1,ax:0,ay:0}];e._sgArtReady=!!sp;e.h=27;SG.dummy=e;
}
AI.traildummy=function(e){e.vx=e.vy=0;e.pose=0;};

/* ---------- training dodges ---------- */
hook('onDash',(p)=>{
  if(!sgOn())return;
  const s=W.ch.trail,n=SG.nodes.dummy;
  if(W.Z.id==='meadows'&&s&&s.stage===2&&n&&Math.hypot(p.x-n.x,p.y-n.y)<100){s.dodges=Math.min(2,(s.dodges||0)+1);toast('Training dodge '+s.dodges+'/2','#a9e0d2');if(s.dodges>=2)sgAdvance(2);}
});
const _damageSG=damageEnemy;
damageEnemy=function(e,amount,o={}){
  if(e&&e.sgDummy){
    if(!sgOn()||o.dot||!['weapon','ability'].includes(o.src)||G.t-(e._sgHitAt||-99)<.18)return 0;
    e._sgHitAt=G.t;e.flash=.1;addText(e.x,e.y-35,'GOOD HIT','#e4cf91');Sound.play('hit',{v:.35});
    const s=sgBook();if(s.stage===1){s.hits=Math.min(3,(s.hits||0)+1);if(s.hits>=3)sgAdvance(1);}return 1;
  }
  return _damageSG(e,amount,o);
};
hook('stats',(s,p)=>{
  if(!W.on||!W.ch||!W.ch.trail)return;const b=W.ch.trail.boon;
  if(b==='vanguard'){s.hpAdd+=12;s.armor+=1;}
  if(b==='skirmisher'){s.spdMul+=.05;s.dashCd*=.9;}
  if(b==='channeler'){s.abDmg+=.12;s.cdMul*=.94;}
});

/* ---------- paced patrols and a captain with readable attacks ---------- */
function sgSpawn(kind,x,y,level,tag){
  const q=sgSpot(x,y),e=spawnWorldMob(kind,q.x,q.y,level,{quiet:false});if(!e)return null;
  e.sgEncounter=tag;e.aggro=true;e.home={x:q.x,y:q.y};e.leash=400;e.aggroR=140;e.noContact=false;e.hp=e.maxHp=Math.max(18,Math.round(e.maxHp*.7));e.dmg*=.72;e.xp=6;e.gold=2;e.camp='trail:'+tag;
  SG.encounter.push(e);return e;
}
function sgPatrol(){
  const s=sgBook(),n=SG.nodes.orchard;if(!n||SG.encounter.some(e=>!e.dead&&e.sgEncounter==='orchard'))return;
  const count=3-(s.kills||0);for(let i=0;i<count;i++)sgSpawn(i===0?'w_mslime':'w_gobscout',n.x+(i-1)*28,n.y+18+i*11,1,'orchard');
  if(count)banner('Orchard Watch','Three raiders. Use abilities to break their guard.',2.6);
}
function sgCaptain(trial=false){
  const n=SG.nodes.boss;if(!n)return;
  const e=sgSpawn('w_gobscout',n.x,n.y+20,3,trial?'trial':'captain');if(!e)return;
  e.sgCaptain=true;e.sgTrial=trial;e.def={...e.def,ai:'trailcaptain',name:'Briar Captain'};e.scale=1.45;e.r=9;e.h=24;e.hp=e.maxHp=trial?190:155;e.dmg=10;e.spd=38;e.noContact=true;e.st='recover';e.stT=1;e.sgMove=0;e.sgAdds=false;e._sgAction=0;e.xp=20;e.gold=10;
  if(trial){e.summoned=true;e.xp=e.gold=0;}
  banner('Briar Captain','Gold warnings: step aside. Blue opening: strike.',2.8);return e;
}
AI.trailcaptain=function(e,dt,p){
  if(p.dead)return;e.stT-=dt;
  if(e.st==='charge'){
    if(!e.sgChargeHit&&Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r+5){hurtPlayer(e.dmg*1.25,{ent:e,sgAttack:true,kx:Math.cos(e.sgAng)*80,ky:Math.sin(e.sgAng)*80});e.sgChargeHit=true;}
    const hit=moveEnt(e,Math.cos(e.sgAng)*190*dt,Math.sin(e.sgAng)*190*dt);e.vx=Math.cos(e.sgAng)*190;e.vy=Math.sin(e.sgAng)*190;
    if(hit||e.stT<=0){e.st='recover';e.stT=1.1;e.pose=0;e._sgExposed=G.t+1.1;}return;
  }
  if(e.st==='windup'){e.vx=e.vy=0;e.pose=1;return;}
  if(e.stT>0){e.vx=e.vy=0;return;}
  if(Math.hypot(e.x-p.x,e.y-p.y)>105){const d=steerTo(e,p.x,p.y);walk(e,d.x,d.y,e.spd,dt);return;}
  if(e.hp<e.maxHp*.5&&!e.sgAdds){e.sgAdds=true;const a=SG.nodes.boss;for(let i=0;i<2;i++){const q=sgSpawn('w_gobscout',a.x+(i?42:-42),a.y+20,1,e.sgTrial?'trial':'captain-add');if(q&&e.sgTrial){q.sgTrial=true;q.summoned=true;q.gold=q.xp=0;}}addText(e.x,e.y-45,'TO ME!','#edc78b');}
  const action=++e._sgAction,move=e.sgMove++%3,a=Math.atan2(p.y-e.y,p.x-e.x),gen=SG.Z;
  e.sgAng=a;e.face=Math.cos(a)<0?-1:1;e.st='windup';e.stT=.8;e.pose=1;
  const live=()=>sgOn()&&SG.Z===gen&&!e.dead&&G.ents.includes(e)&&e._sgAction===action;
  if(move===1){
    telegraph({x:e.x,y:e.y,ang:a,len:150,width:17,line:true,life:.8,color:'#e6c478',fire:()=>{if(!live())return;e.st='charge';e.stT=.65;e.sgChargeHit=false;}});
  }else{
    const r=move===2?72:53,life=move===2?.95:.8;
    telegraph({x:e.x,y:e.y,ang:a,arc:move===2?Math.PI:Math.PI*.65,cone:true,r,life,color:'#e6c478',fire:()=>{
      if(!live())return;const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy),diff=Math.atan2(Math.sin(Math.atan2(dy,dx)-a),Math.cos(Math.atan2(dy,dx)-a));
      if(d<r+p.r&&Math.abs(diff)<(move===2?Math.PI/2:Math.PI*.325))hurtPlayer(e.dmg,{ent:e,sgAttack:true,kx:Math.cos(a)*80,ky:Math.sin(a)*80});
      ring(e.x,e.y,r,'#e6c478',.2,1);e.st='recover';e.stT=1.0;e.pose=0;e._sgExposed=G.t+1;
    }});
  }
};
const _hordeSG=updateHordes;
updateHordes=function(now){
  if(sgOn()&&W.Z.id==='meadows'&&SG.trial){if(W.horde)W.horde.next=Math.max(W.horde.next,now+10);return;}
  if(sgOn()&&W.Z.id==='meadows'&&G.p.level<6){const s=W.ch.trail;const target=s&&SG.nodes[SG_STEPS[s.stage][2]];if(s&&s.stage<6&&target&&Math.hypot(target.x-G.p.x,target.y-G.p.y)<230){if(W.horde)W.horde.next=Math.max(W.horde.next,now+10);return;}}
  return _hordeSG(now);
};
const _campSG=spawnCamp;
spawnCamp=function(c,st){
  if(sgOn()&&W.Z.id==='meadows'&&(SG.trial||G.p.level<6&&(!W.ch.trail||W.ch.trail.stage<6))&&[SG.nodes.orchard,SG.nodes.boss].some(n=>n&&Math.hypot(c.x*TS-n.x,c.y*TS-n.y)<170)){st.until=W.t+15;return;}
  return _campSG(c,st);
};
hook('onKill',(e)=>{
  if(!sgOn()||!e.world)return;const s=sgBook();
  if(!e.summoned&&!e.sgDummy){s.salvageKills=(s.salvageKills||0)+1;if(s.salvageKills%3===0){s.scrap=Math.min(999,s.scrap+1);addText(e.x,e.y-18,'+1 SCRAP','#d4c69b');}}
  if(W.Z.id!=='meadows')return;
  if(e.sgEncounter==='orchard'&&s.stage===3){s.kills=Math.min(3,(s.kills||0)+1);toast('Orchard Watch '+s.kills+'/3','#d9d39c');if(s.kills>=3)sgAdvance(3);else saveRealm();}
  if(e.sgCaptain&&!e.sgTrial&&s.stage===5)sgAdvance(5);
});

/* ---------- field supplies and repeatable end-of-trail challenges ---------- */
function sgSafe(){return sgOn()&&!G.p.dead&&!G.combat&&!G.ents.some(e=>!e.dead&&e.type!=='ally'&&!e.sgDummy&&e.aggro&&Math.hypot(e.x-G.p.x,e.y-G.p.y)<140);}
function sgCraft(id){
  if(!sgSafe())return false;const s=sgBook(),p=G.p,recipes={flask:[2,8],ration:[3,10],ward:[4,15],temper:[5,25]},cost=recipes[id];
  if(!cost||s.scrap<cost[0]||p.gold<cost[1])return false;
  if(id==='flask'&&p.potions>=p.stats.potMax||id==='temper'&&(p.weapon.lvl||0)>=2||id==='ward'&&p.shieldHits>0)return false;
  s.scrap-=cost[0];p.gold-=cost[1];
  if(id==='flask')p.potions=Math.min(p.stats.potMax,p.potions+1);
  if(id==='ration'){heal(p,p.maxHp*.35);p.restedT=Math.max(p.restedT||0,300);recalcStats(p);}
  if(id==='ward')p.shieldHits=Math.max(p.shieldHits||0,1);
  if(id==='temper'){p.weapon.lvl=(p.weapon.lvl||0)+1;recalcStats(p);}
  Sound.play('buy');saveRealm(true);return true;
}
function sgRest(){
  if(!sgSafe())return false;const s=sgBook(),p=G.p,n=SG.nodes.fire,orchard=SG.nodes.orchard,secured=s.stage>=4&&orchard&&Math.hypot(orchard.x-p.x,orchard.y-p.y)<55;
  if(!(secured||inSettlement(p.x/TS,p.y/TS)||n&&Math.hypot(n.x-p.x,n.y-p.y)<40)||(s.restUntil||0)>W.t||p.hp>=p.maxHp&&p.potions>=p.stats.potMax)return false;
  s.restUntil=W.t+180;heal(p,p.maxHp*.4);p.potions=Math.min(p.stats.potMax,p.potions+1);Sound.play('heal');saveRealm(true);return true;
}
function sgSalvage(w){
  if(!sgSafe()||!w||w===G.p.weapon||!G.p.weapons.includes(w)||['natural','evolved','legendary'].includes(w.rar))return false;
  const s=sgBook(),value=({common:2,uncommon:3,rare:5,epic:8})[w.rar]||2;
  G.p.weapons=G.p.weapons.filter(q=>q!==w);G.p.wi=G.p.weapons.indexOf(G.p.weapon);s.scrap=Math.min(999,s.scrap+value);recalcStats(G.p);Sound.play('buy');saveRealm(true);return true;
}
UI.fieldWorkbench=function(){
  if(!sgOn())return;svcModal('Trail Camp & Workbench','Rest, prepare supplies, and put spare equipment to use.',(redraw)=>{
    const s=sgBook(),p=G.p,menu=h('div',{class:'menu',style:{width:'100%'}}),safe=sgSafe();
    menu.append(h('p',{},`${s.scrap} scrap · ${p.gold} gold · flasks ${p.potions}/${p.stats.potMax}`));
    if(!safe)menu.append(h('p',{},'Finish the fight before using the workbench.'));
    const choice=(label,id,sc,gold,blocked=false)=>menu.append(btn(`${label} · ${sc} scrap + ${gold}g`,()=>{if(sgCraft(id))redraw();else toast('You need the supplies and a quiet moment.');},'',{disabled:!safe||blocked||s.scrap<sc||p.gold<gold}));
    menu.append(btn((s.restUntil||0)>W.t?'Camp rest recovers in '+Math.ceil(s.restUntil-W.t)+'s':'Rest at a safe camp · heal 40% + one flask',()=>{if(sgRest())redraw();else toast('Rest in town, at Trail Camp, or at the reclaimed Orchard Watch.');},'primary',{disabled:!safe||(s.restUntil||0)>W.t||p.hp>=p.maxHp&&p.potions>=p.stats.potMax}));
    choice('Refill one flask','flask',2,8,p.potions>=p.stats.potMax);choice('Trail meal · heal 35%, Rested for 5 min','ration',3,10);choice('Protective ward · block one hit','ward',4,15,p.shieldHits>0);choice('Temper held weapon +1 (field cap +2)','temper',5,25,(p.weapon.lvl||0)>=2);
    const spare=p.weapons.find(w=>w!==p.weapon&&!['natural','evolved','legendary'].includes(w.rar));
    if(spare)menu.append(btn('Salvage '+weaponName(spare),()=>UI.confirm('Salvage '+weaponName(spare)+'?','Your spare weapon is consumed. Its materials become field supplies. Your equipped weapon stays in hand.','Salvage',()=>{if(sgSalvage(spare))redraw();}), '',{disabled:!safe}));
    return [menu];
  });
};
function sgStartTrial(){
  if(!sgSafe()||W.Z.id!=='meadows'||sgBook().stage<6||SG.trial)return false;
  SG.trial={wave:0,state:'travel',started:0,next:0};W.ch.track='starter';toast('Watch Trial ready · follow the compass to Briar Crossing','#e1c786');return true;
}
function sgTrialStep(){
  const t=SG.trial,n=SG.nodes.boss;if(!t||!n)return;
  const d=Math.hypot(G.p.x-n.x,G.p.y-n.y);
  if(G.p.dead||t.state!=='travel'&&d>380){SG.trial=null;for(const e of SG.encounter)if(e.sgTrial){e.dead=true;e.despawn=true;}toast('Watch Trial ended. You can try again.');return;}
  if(t.state==='travel'){if(d>125)return;t.started=G.t;t.state='between';t.next=G.t;}
  if(t.state==='fight'&&!SG.encounter.some(e=>e.sgTrial&&!e.dead)){t.state='between';t.next=G.t+2.5;}
  if(t.state!=='between'||G.t<t.next)return;
  if(t.wave>=3){
    const s=sgBook(),seconds=Math.round((G.t-t.started)*10)/10;s.bestTrial=s.bestTrial?Math.min(s.bestTrial,seconds):seconds;
    if(s.trialDay!==realmDay()){s.trialDay=realmDay();s.scrap=Math.min(999,s.scrap+5);G.p.gold+=30;toast('Watch Trial complete · +5 scrap, +30 gold','#d8de9f');}else toast('Watch Trial complete · best '+s.bestTrial+'s','#d8de9f');
    SG.trial=null;Sound.play('clear');saveRealm(true);return;
  }
  t.wave++;t.state='fight';banner('Watch Trial · wave '+t.wave+'/3',t.wave===3?'Break the captain’s guard.':'Keep moving. Use the recovery windows.',2);
  if(t.wave===3)sgCaptain(true);
  else for(let i=0;i<(t.wave===1?2:3);i++){const e=sgSpawn(t.wave===2&&i===2?'w_gobsling':'w_gobscout',n.x+(i-1)*35,n.y+30,Math.min(4,2+t.wave),'trial');if(e){e.sgTrial=true;e.summoned=true;e.gold=e.xp=0;}}
}
function sgClaim(){
  if(!sgOn())return false;const s=sgBook(),n=SG.nodes.mentor;if(s.stage!==6||s.claimed||W.Z.id!=='meadows'||!n||Math.hypot(n.x-G.p.x,n.y-G.p.y)>55)return false;
  s.claimed=true;s.scrap=Math.min(999,s.scrap+6);G.p.gold+=50;gainXP(30);
  if(!W.ch.home&&SG.nodes.fire)W.ch.home={zone:'meadows',x:SG.nodes.fire.x,y:SG.nodes.fire.y+12,name:'Trail Camp'};
  if((G.p.weapon.lvl||0)<2){G.p.weapon.lvl=(G.p.weapon.lvl||0)+1;recalcStats(G.p);}else s.scrap=Math.min(999,s.scrap+4);
  Sound.play('levelup');saveRealm(true);return true;
}
function sgChoose(boon){
  if(!sgOn()||!['vanguard','skirmisher','channeler'].includes(boon))return false;
  const s=sgBook(),n=SG.nodes.seal;if(s.stage!==4||s.boon||W.Z.id!=='meadows'||!n||Math.hypot(n.x-G.p.x,n.y-G.p.y)>55)return false;s.boon=boon;recalcStats(G.p);return sgAdvance(4);
}

/* ---------- the journey is playable from the world, keyboard or touch ---------- */
UI.provingTrail=function(){
  if(!sgOn())return;
  const s=sgBook(),step=SG_STEPS[s.stage],close=()=>UI.close(el),menu=h('div',{class:'menu',style:{width:'100%'}});
  const progress=s.stage===1?`${s.hits||0}/3 hits`:s.stage===2?`${s.dodges||0}/2 dodges`:s.stage===3?`${s.kills||0}/3 raiders`:s.stage===6?s.claimed?'Reward claimed':'Reward waiting':'';
  menu.append(h('p',{},step[1]+(progress?' · '+progress:'')));
  if(W.Z.id!=='meadows')menu.append(h('p',{},'The Proving Trail begins in Verdant Meadows. Your field workbench is available in every settlement.'));
  if(s.stage===0&&W.Z.id==='meadows')menu.append(btn('Accept Rowan’s proving trail',()=>{sgAdvance(0);UI.close(el);},'primary',{disabled:!SG.nodes.mentor||Math.hypot(SG.nodes.mentor.x-G.p.x,SG.nodes.mentor.y-G.p.y)>55}));
  if(s.stage===4&&W.Z.id==='meadows'){
    const seal=SG.nodes.seal,near=seal&&Math.hypot(seal.x-G.p.x,seal.y-G.p.y)<55;
    menu.append(h('p',{},near?'The Waywatch Seal carries one lasting discipline. Choose one:':'Reach the Waywatch Seal to choose your lasting discipline.'));
    if(near)for(const [id,title,desc]of[['vanguard','Vanguard','+12 maximum health, +1 armor'],['skirmisher','Skirmisher','+5% movement speed, 10% faster dash recovery'],['channeler','Channeler','+12% ability damage, 6% faster cooldowns']])menu.append(btn(title+' · '+desc,()=>{if(sgChoose(id))UI.close(el);},'primary'));
  }
  if(s.stage===6&&!s.claimed)menu.append(btn('Claim trail reward · 50g, 6 scrap, weapon temper',()=>{if(sgClaim()){UI.close(el);UI.provingTrail();}},'primary',{disabled:W.Z.id!=='meadows'||!SG.nodes.mentor||Math.hypot(SG.nodes.mentor.x-G.p.x,SG.nodes.mentor.y-G.p.y)>55}));
  menu.append(btn('Track this journey',()=>{W.ch.track='starter';W.ch.wp=null;saveRealm();UI.close(el);toast('Proving Trail tracked','#e8d29b');}));
  menu.append(btn('Open camp & field workbench',()=>{UI.close(el);UI.fieldWorkbench();}));
  if(s.stage>=6&&W.Z.id==='meadows')menu.append(btn(SG.trial?'Watch Trial in progress':'Begin the Watch Trial · 3 waves',()=>{if(sgStartTrial())UI.close(el);},'',{disabled:!!SG.trial||!sgSafe()}));
  const el=h('div',{class:'modal'},h('div',{class:'panel'},h('p',{style:{letterSpacing:'.15em',fontSize:'12px',color:'#b7bd8d'}},'EMBERHOLD · FIRST CHAPTER'),h('h2',{},'The Proving Trail'),h('h3',{},step[0]),menu,
    h('div',{style:{display:'flex',gap:'5px',margin:'18px 0'}},...SG_STEPS.slice(0,6).map((q,i)=>h('div',{style:{flex:'1',height:'5px',background:i<s.stage?'#c7cb8a':i===s.stage?'#e5b56f':'#48473d',borderRadius:'3px'}}))),
    h('p',{},'Combat: guard, parry and dodge enemy strikes, and break their posture for an opening. Rowan teaches the rest at the practice circle.'),
    h('p',{},'Supplies: every third world kill yields scrap. Spare weapons can be salvaged at the workbench. Rest is available in safe settlements.'),
    h('p',{},s.boon?'Discipline: '+s.boon+(s.bestTrial?' · Best Watch Trial: '+s.bestTrial+'s':''):'A lasting discipline waits beyond the Orchard Watch.'),
    h('div',{class:'row'},btn('Back to the Realm',close,'primary'))));
  UI.open(el,{modal:true,replace:false,onBack:close});
};
// Rowan, the dummy, the camp, the workbench and the trail's places
interactable({
  near(p,best){
    if(!sgOn())return best;
    let bd=best?14:32;
    for(const o of SG.objects){if(o.detail.startsWith('cairn:'))continue;const d=Math.hypot(o.x-p.x,o.y-p.y);if(d<bd){bd=d;best={kind:'proving',o};}}
    return best;
  },
  prompt:(t)=>t.kind!=='proving'?null:t.o.detail==='fire'?'Rest at Trail Camp':t.o.detail==='workbench'?'Use the field workbench':t.o.detail==='dummy'?'Read the practice drill':'Explore '+t.o.name,
  use(t){if(t.kind!=='proving'||!sgOn())return false;sgUse(t.o);return true;},
});
function sgUse(o){
  if(['fire','workbench'].includes(o.detail)||o.detail==='orchard'&&sgBook().stage>=4)return UI.fieldWorkbench();
  if(o.detail==='dummy'&&sgBook().stage<1){toast('Captain Rowan is waiting beside the practice circle.');return;}
  if(o.detail==='dummy'&&sgBook().stage===1){sgDummy();toast('Face the dummy, then attack. Three good hits will do.','#e4cf91');return;}
  UI.provingTrail();
}
const _targetSG=trackedTarget;
trackedTarget=function(){
  if(sgOn()&&W.ch.track==='starter'&&!W.ch.wp&&W.Z.id==='meadows'){
    const s=W.ch.trail,stage=s?s.stage:0,n=SG.trial?SG.nodes.boss:SG.nodes[SG_STEPS[stage][2]];
    if(n)return{x:n.x,y:n.y,label:SG.trial?'Watch Trial':SG_STEPS[stage][0],quest:true};
  }return _targetSG();
};
pauseItem('journey',30,(el)=>sgOn()?btn('Journey · Proving Trail',()=>{UI.close(el);UI.provingTrail();}):null);
const _shopSG=UI.realmShop;
UI.realmShop=function(role,n){_shopSG(role,n);if(!sgOn()||!['smith','general','tentshop','inn'].includes(role))return;const panel=UI.top()&&UI.top().querySelector('.panel');if(panel)panel.append(btn('Trail supplies & salvage',()=>UI.fieldWorkbench()));};

document.head.append(h('style',{},'.sg-hud{position:absolute;top:116px;left:10px;max-width:240px;padding:8px 10px;background:rgba(21,29,27,.85);border-left:2px solid #c6b57c;border-radius:3px;color:#e5d7b2;font:11px/1.4 sans-serif;pointer-events:auto}.sg-hud button{background:transparent;border:0;color:#efcf86;font:inherit;padding:0;cursor:pointer;text-align:left;min-height:0;box-shadow:none;clip-path:none}.sg-hud small{display:block;color:#b8c5a3}@media(max-width:600px){.sg-hud{top:195px;max-width:210px;font-size:10px;padding:6px 8px}}'));
function sgHud(){
  if(!SG.hud||!SG.hud.isConnected){SG.hud=h('div',{class:'sg-hud'},btn('Journey',()=>UI.provingTrail()),h('small',{}));$('hud').append(SG.hud);}
  SG.hud.hidden=!sgOn();if(!sgOn())return;
  const s=W.ch.trail,stage=s?s.stage:0,step=SG_STEPS[stage],trial=SG.trial;
  SG.hud.querySelector('button').textContent=W.Z.id==='meadows'?(trial?'Watch Trial · '+(trial.wave?trial.wave+'/3':'follow the trail'):step[0]+'  ›'):'Expedition supplies  ›';
  SG.hud.querySelector('small').textContent=trial?(trial.state==='travel'?'Reach Briar Crossing':'Wave '+trial.wave+' · '+Math.floor(G.t-trial.started)+'s'):(W.Z.id==='meadows'&&stage===1?(s.hits||0)+'/3 practice hits':W.Z.id==='meadows'&&stage===2?(s.dodges||0)+'/2 training dodges':W.Z.id==='meadows'&&stage===3?(s.kills||0)+'/3 raiders':(s?s.scrap:0)+' scrap · Field workbench');
  sgBossHud();
}
document.head.append(h('style',{},'.sg-boss{position:absolute;top:48px;left:50%;transform:translateX(-50%);width:260px;max-width:43%;padding:7px 10px;background:rgba(31,23,24,.9);border:1px solid #9d7956;border-radius:4px;color:#f1d4a0;text-align:center;font:11px/1.35 sans-serif;pointer-events:none}.sg-boss div{height:5px;background:#3d3332;margin:5px 0}.sg-boss i{display:block;height:5px;background:#ce775d}.sg-boss small{color:#c7cbb2}@media(max-width:600px){.sg-boss{top:273px;max-width:70%;font-size:10px}}'));
function sgBossHud(){
  if(!SG.bossHud||!SG.bossHud.isConnected){SG.bossHud=h('div',{class:'sg-boss'},h('strong',{},'BRIAR CAPTAIN'),h('div',{},h('i',{})),h('small',{}));$('hud').append(SG.bossHud);}
  const e=SG.encounter.find(q=>q.sgCaptain&&!q.dead&&Math.hypot(q.x-G.p.x,q.y-G.p.y)<260);
  SG.bossHud.hidden=!sgOn()||!e;if(!e)return;
  SG.bossHud.querySelector('i').style.width=clamp(e.hp/e.maxHp*100,0,100)+'%';
  SG.bossHud.querySelector('small').textContent=(e._sgExposed||0)>G.t?'Opening · strike now':e.st==='windup'?'Attack warning · make space':e.st==='charge'?'Charging · get to the side':'Watch his windup';
}
hook('update',dt=>{
  if(!sgOn()){if(SG.hud)SG.hud.hidden=true;if(SG.bossHud)SG.bossHud.hidden=true;return;}
  if(SG.Z!==W.Z)sgReset(W.Z);
  if(W.Z.id==='meadows'){
    const s=W.ch.trail;
    if(s){
      if(s.stage===1&&(!SG.dummy||SG.dummy.dead))sgDummy();
      if(SG.dummy&&!SG.dummy._sgArtReady){const sp=sgArt(SG.nodes.dummy);if(sp){SG.dummy.frames=[sp];SG.dummy._sgArtReady=true;}}
      if(s.stage===2&&W.t>SG.drillAt&&Math.hypot(G.p.x-SG.nodes.dummy.x,G.p.y-SG.nodes.dummy.y)<105){SG.drillAt=W.t+3;telegraph({x:G.p.x,y:G.p.y,r:25,life:.9,color:'#8bd4c9',team:'p'});}
      if(s.stage===3&&Math.hypot(G.p.x-SG.nodes.orchard.x,G.p.y-SG.nodes.orchard.y)<145)sgPatrol();
      if(s.stage===5&&!SG.encounter.some(e=>e.sgCaptain&&!e.sgTrial&&!e.dead)&&Math.hypot(G.p.x-SG.nodes.boss.x,G.p.y-SG.nodes.boss.y)<145)sgCaptain();
    }
    sgTrialStep();
  }
  SG.tick-=dt;if(SG.tick<=0){SG.tick=.2;sgHud();}
});
CD.proving={open:()=>UI.provingTrail(),get stage(){return W.ch&&W.ch.trail?W.ch.trail.stage:0;}};

