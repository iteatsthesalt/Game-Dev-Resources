/* ============================================================
   Cinderdeep — Steel & Chaos: resource combat, readable defenses,
   kinetic animation and a responsive procedural audio score.
   ============================================================ */
Object.assign(DEFAULT_SETTINGS,{duelTiming:'standard',duelMusic:true,duelSound:true,duelMotion:true});
const DUEL={p:null,lesson:null,hud:null,audioVoices:0,audioAt:{},musicStep:-1,musicMood:'exploration',slots:[],serial:0};
const duelOn=()=>G.mode==='play'&&G.p&&G.fl&&!G.demo;
function duelState(p=G.p){
  if(!p)return null;
  if(!p.duel)p.duel={stamina:100,chaos:35,debt:0,posture:0,regenAt:0,guard:false,guardAt:-99,parryUntil:-99,recoverUntil:0,brokenUntil:0,counter:null,wound:0,woundUntil:0,echo:null,castUntil:0,anim:'idle',animAt:0,animDur:0,heavy:false,seen:{},mastery:0,castHold:null,flaskUntil:0,hitStamp:new WeakMap(),lastChaosHit:-99};
  return p.duel;
}
function duelStyle(p=G.p){const d=WEAPON[p.weapon.id];if(d.style==='stab'||/dagger|kniv|knife|claw/.test(p.weapon.id))return'dagger';if(/staff|wand|rod|tome|orb|scepter|grimoire/.test(p.weapon.id))return'staff';if(p.cls==='knight'||/shield/.test(p.weapon.id))return'shield';return'blade';}
const duelWide=()=>CD.settings.duelTiming==='generous'?1.5:1;
function duelAnim(name,dur=.3,p=G.p){const s=duelState(p);s.anim=name;s.animAt=G.t;s.animDur=dur;}
function duelChaos(n,p=G.p){const s=duelState(p),pay=Math.min(s.debt,n);s.debt-=pay;s.chaos=clamp(s.chaos+n-pay,0,100);}
function duelSpend(n,p=G.p){const s=duelState(p);if(s.stamina+1e-6<n)return false;s.stamina=Math.max(0,s.stamina-n);s.regenAt=G.t+.48;return true;}
function duelThreat(p=G.p){return G.ents.some(e=>!e.dead&&!e.dorm&&e.type==='enemy'&&!e.sgDummy&&(e.aggro!==false||!e.world)&&Math.hypot(e.x-p.x,e.y-p.y)<155);}
function duelNotice(text,color='#d7e6ec'){const s=duelState();if(G.t-(s.noticeAt||-99)<.7)return;s.noticeAt=G.t;addText(G.p.x,G.p.y-32,text,color);}
function duelMark(id){const s=duelState();s.seen[id]=true;if(DUEL.lesson&&DUEL.lesson.active&&DUEL.lesson.want===id){DUEL.lesson.count++;duelNotice('LESSON '+Math.min(3,DUEL.lesson.count)+'/3','#aff1d0');if(DUEL.lesson.count>=3)duelLessonAdvance();}}
function duelVfx(kind,x,y,color='#b6f2ef',power=1){
  ring(x,y-7,kind==='perfect'?28:17,color,.28,kind==='perfect'?2:1);
  fxSparks(x,y,color,kind==='perfect'?24:10,power);
  if(kind==='perfect'){fxAdd('rune',x,y,{r:25,life:.65,color});fxRing(x,y,65,.28);}
  if(kind==='break'){fxAdd('impact',x,y,{z:9,r:27,life:.35,color});fxAdd('ring',x,y,{r:39,life:.45,color});}
}
/* Short, bounded, positional voices: no fetched audio or gameplay RNG. */
function duelSound(name,x=G.p&&G.p.x,y=G.p&&G.p.y){
  if(!CD.settings.duelSound||!Sound.ctx||Sound.ctx.state!=='running'||Sound.vol.sfx<=0||DUEL.audioVoices>=16)return;
  const c=Sound.ctx,now=c.currentTime;if(now-(DUEL.audioAt[name]??-99)<.065)return;DUEL.audioAt[name]=now;
  const bus=c.createGain();bus.gain.value=.65;let pan=null;
  if(c.createStereoPanner){pan=c.createStereoPanner();pan.pan.value=clamp(((x||0)-(G.p?G.p.x:0))/180,-.8,.8);bus.connect(pan);pan.connect(Sound.sfxBus);}else bus.connect(Sound.sfxBus);
  const tone=(type,a,b,d,v,delay=0)=>Sound.tone(type,a,b,d,v,.004,delay,bus);
  const hiss=(d,v,f=2800)=>{const src=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();src.buffer=Sound.noise;fl.type='bandpass';fl.frequency.value=f;fl.Q.value=1;g.gain.setValueAtTime(v,now);g.gain.exponentialRampToValueAtTime(.0001,now+d);src.connect(fl);fl.connect(g);g.connect(bus);src.start(now,.13);src.stop(now+d+.01);};
  DUEL.audioVoices++;setTimeout(()=>{bus.disconnect();if(pan)pan.disconnect();DUEL.audioVoices--;},1500);
  if(name==='parry'||name==='perfect'){hiss(.09,.1,4800);tone('triangle',name==='perfect'?1660:1120,650,.2,.13);tone('sine',2240,1800,.36,.07,.025);if(name==='perfect'){tone('sine',1320,1320,.25,.09,.06);tone('sine',1980,1980,.4,.06,.12);}}
  else if(name==='guard'){hiss(.09,.1,1000);tone('triangle',180,90,.13,.14);}
  else if(name==='break'){hiss(.3,.16,1500);tone('sawtooth',150,45,.32,.1);}
  else if(name==='dodge'){hiss(.12,.075,2200);tone('sine',400,980,.12,.045);}
  else if(name==='chaos'){tone('sine',180,720,.4,.075);tone('triangle',360,1440,.28,.035,.05);hiss(.18,.035,5000);}
  else if(name==='debt'){tone('sawtooth',110,65,.5,.055);tone('sine',330,220,.45,.08,.08);}
  else if(name==='threat'){tone('triangle',480,380,.1,.075);}
  else if(name==='crush'){tone('square',180,90,.18,.055);tone('sine',90,60,.24,.08,.06);}
  else if(name==='grab'){tone('sine',650,300,.12,.08);tone('sine',650,300,.12,.06,.14);}
  else if(name==='step'){hiss(.045,.025,900);}
  else if(name==='flask'){tone('sine',700,960,.15,.055);}
  else {tone('triangle',420,800,.18,.08);hiss(.08,.05,2200);}
}
/* New controls participate in existing rebinding and draggable touch layouts. */
KEYMAP.guard=['KeyV','ControlLeft','ControlRight'];KEYMAP.heavy=['KeyB'];
KEYMAP_DEFAULT.guard=[...KEYMAP.guard];KEYMAP_DEFAULT.heavy=[...KEYMAP.heavy];
PADMAP.guard=[10];PADMAP.heavy=[11];PADMAP_DEFAULT.guard=[10];PADMAP_DEFAULT.heavy=[11];
BIND_ACTIONS.push(['guard','Defend / tap to parry'],['heavy','Heavy attack / clash']);
for(const k of [...KEYMAP.guard,...KEYMAP.heavy])GAME_KEYS.add(k);
for(const [id,name]of[['tb-guard','GUARD'],['tb-heavy','HEAVY']]){
  const el=h('button',{id,class:'tb duel-control',type:'button','aria-label':name==='GUARD'?'Hold to defend; tap to parry':'Heavy attack'},name);$('touch').append(el);
  const c={id,name:name==='GUARD'?'Defend / parry':'Heavy attack',w:52,h:52};CTRL.push(c);CTRL_BY[id]=c;
  for(const o of ['portrait','landscape'])BASE_LAYOUT[o][id]=o==='portrait'?(name==='GUARD'?[.23,.66,1]:[.43,.70,1]):(name==='GUARD'?[.63,.72,1]:[.63,.50,1]);
  el.addEventListener('pointerdown',e=>{if(CD.ctlEdit)return;e.preventDefault();Sound.init();Input.setDevice('touch');const n=id==='tb-guard'?'guard':'heavy';Input.touch.held.add(n);Input.touch.edge.add(n);el.classList.add('down');try{el.setPointerCapture(e.pointerId);}catch(_){};});
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(evt,()=>{Input.touch.held.delete(id==='tb-guard'?'guard':'heavy');el.classList.remove('down');});
}
const _inputDuel=Input.update;
Input.update=function(){_inputDuel.call(this);const A=this.act;A.guard=this.key('guard')||this.padHeld('guard')||this.touch.held.has('guard');A.guardEdge=this.keyEdge('guard')||this.padEdge('guard')||this.touch.edge.has('guard');A.heavy=this.keyEdge('heavy')||this.padEdge('heavy')||this.touch.edge.has('heavy');A.ab1Held=this.key('ab1')||this.mouse.r||this.padHeld('ab1')||this.touch.held.has('ab1');A.ab2Held=this.key('ab2')||this.padHeld('ab2')||this.touch.held.has('ab2');};
const _clearDuel=Input.clearHeld;
Input.clearHeld=function(){_clearDuel.call(this);this.touch.held.clear();this.touch.edge.clear();for(const id of ['tb-guard','tb-heavy'])$(id).classList.remove('down');if(G.p){const s=duelState();s.guard=false;s.castHold=null;}};
window.addEventListener('blur',()=>{Input.touch.held.clear();if(G.p){const s=duelState();s.guard=false;s.castHold=null;}});
/* Attack costs are paid once at commitment, including ranged attacks. */
const _attackDuel=attack;
attack=function(p){
  if(!duelOn())return _attackDuel(p);const s=duelState(p),d=WEAPON[p.weapon.id],heavy=!!s.wantHeavy;
  if(p.dead||G.t<s.brokenUntil||G.t<s.recoverUntil||s.flaskUntil>G.t||s.guard)return false;
  const cost=heavy?27:(d.heavy||d.style==='slam')?20:duelStyle(p)==='dagger'?8:11;
  if(!duelSpend(cost,p)){p.atkCd=Math.max(.12,p.atkCd);duelNotice('RECOVER STAMINA','#cfdd98');return false;}
  s.heavy=heavy;s.attackAt=G.t;s.attackCounter=s.counter&&s.counter.until>G.t?{...s.counter}:null;s.counter=null;
  _attackDuel(p);
  if(heavy){p.atkCd=Math.max(p.atkCd,.62);if(p.swing){p.swing.heavy=true;p.swing.kb*=1.5;p.swing.reach*=1.1;}s.recoverUntil=G.t+.35;fxAdd('rune',p.x,p.y,{r:18,life:.25,color:'#f8cf96'});duelSound('counter');}
  if(s.attackCounter){s.counterStrikeUntil=G.t+.55;duelMark('counter');duelCounterAction(s.attackCounter,p);}
  duelAnim(heavy?'heavy':'strike',heavy?.55:.24,p);return true;
};
function duelCounterAction(counter,p){
  duelSound('counter');duelVfx('counter',p.x,p.y,'#b4efda');
  if(counter.kind==='back')spawnProj({team:'p',x:p.x,y:p.y-7,ang:p.aim,speed:240,dmg:weaponDamage(p)*.7,life:.8,kind:'wave',pierce:1,r:5,kb:35,color:'#b6e5ff',src:'counter'});
  if(counter.kind==='in')for(const e of G.ents)if(!e.dead&&!e.boss&&!e.sgCaptain&&e.type==='enemy'&&Math.hypot(e.x-p.x,e.y-p.y)<35)e.stunT=Math.max(e.stunT||0,.3);
}
const _fireDuel=fireWeapon;
fireWeapon=function(p,def,w,dmg,ang,echo){const s=duelState(p);let mult=1;if(duelOn()&&G.t-s.attackAt<.05){if(s.heavy)mult*=1.65;if(s.attackCounter)mult*=s.attackCounter.kind==='side'?1.55:1.3;}return _fireDuel(p,def,w,dmg*mult,ang,echo);};
/* Chaos is committed only after an ability actually succeeds. */
function duelSpellCost(a){const d=ABILITY[a.id];return clamp(Math.round(12+(d.cd||6)*1.4),16,42);}
const _castDuel=castAbility;
castAbility=function(p,slot){
  // A DNA-rearranged skill casts its partner from inside the first cast; that one is already paid for.
  if(!duelOn()||p._splicing)return _castDuel(p,slot);const s=duelState(p),a=p.abilities[slot];
  if(!a||a.cd>0||p.dead||s.guard||G.t<s.brokenUntil||G.t<s.recoverUntil||s.flaskUntil>G.t)return false;
  const cost=duelSpellCost(a);
  if(s.chaos<cost&&!s.overdraw){if(!s.castHold||s.castHold.slot!==slot)s.castHold={slot,at:G.t};duelNotice('HOLD SPELL: OVERDRAW','#c7a4ff');return false;}
  const before=G.run.stats.abilities;_castDuel(p,slot);
  if(G.run.stats.abilities===before){s.castHold=null;return false;}
  const short=Math.max(0,cost-s.chaos);s.chaos=Math.max(0,s.chaos-cost);s.debt=clamp(s.debt+short,0,100);s.castHold=null;
  {const echoed=a.cd<a.max;a.max=Math.max(.6,(a.max||a.cd)*.65);if(!echoed)a.cd=a.max;}s.castUntil=G.t+.42;duelAnim(short?'overdraw':'cast',.5,p);duelMark('cast');
  duelSound(short?'debt':'chaos');fxAdd('rune',p.x,p.y,{r:31,life:.65,color:short?'#eb8bcb':'#b99bff'});
  if(s.echo){duelReleaseEcho(s.echo,p);s.echo=null;}
  return true;
};
function duelReleaseEcho(echo,p){
  const color=echo.kind==='storm'?'#a4e4ff':echo.kind==='fang'?'#efcc98':'#cba3ff';
  fxAdd('rune',p.x,p.y,{r:40,life:.7,color});duelNotice('ECHO · '+echo.name,color);
  if(echo.kind==='storm'){const foes=G.ents.filter(e=>!e.dead&&e.type==='enemy'&&!e.sgDummy&&Math.hypot(e.x-p.x,e.y-p.y)<130).slice(0,3);for(const e of foes){damageEnemy(e,abilityDamage(16,1,p),{src:'echo',shock:true,kb:10});fxAdd('bolt',e.x,e.y,{height:75,life:.3,color});}}
  else if(echo.kind==='fang'){const a=p.aim;for(const e of G.ents)if(!e.dead&&e.type==='enemy'&&Math.hypot(e.x-p.x,e.y-p.y)<65&&Math.abs(angDiff(a,Math.atan2(e.y-p.y,e.x-p.x)))<1)damageEnemy(e,weaponDamage(p)*1.15,{src:'echo',kb:90,ang:a});fxAdd('crescent',p.x,p.y,{a,r:55,life:.25,color});}
  else for(let i=-1;i<=1;i++)spawnProj({team:'p',x:p.x,y:p.y-7,ang:p.aim+i*.22,speed:210,dmg:weaponDamage(p)*.65,life:.65,kind:'wave',pierce:1,r:6,kb:65,color,src:'echo'});
}
function duelCapture(e,proj){const s=duelState(),id=((e&&e.kind)||'')+' '+((e&&e.def.ai)||'')+' '+((proj&&proj.kind)||'');s.echo=/mage|cast|zap|light|bolt|orb|shaman/.test(id)?{kind:'storm',name:'Storm memory'}:/wolf|beast|rat|fang|spider/.test(id)?{kind:'fang',name:'Predator memory'}:{kind:'steel',name:'Steel memory'};duelMark('echo');}
/* A strike has identity; lingering collisions cannot farm perfect rewards. */
function duelSource(src){
  const p=G.p,pr=src.proj,e=src.ent;
  let x=src.x,y=src.y;
  if(pr){x=p.x-(pr.vx||0);y=p.y-(pr.vy||0);}
  else if(e){x=e.x;y=e.y;}
  else if(src.kx!=null){x=p.x-src.kx;y=p.y-(src.ky||0);}
  const explicit=src.duelKind;
  const type=explicit||(e&&e._duelStrike?e._duelStrike.kind:pr&&!pr.lob?'parry':src.sgAttack&&e&&e.sgMove%3===2?'crush':e&&['lunge','swing','strike','charge','sweep'].includes(e.st)?'parry':'hazard');
  return{e,pr,x,y,type,front:Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(angDiff(p.aim,Math.atan2(y-p.y,x-p.x)))<=Math.PI*.38,token:pr||e};
}
function duelRewardOnce(s,d){if(!d.token)return false;const stamp=d.pr?'projectile':d.e&&d.e._duelStrike?d.e._duelStrike.id:d.e&&d.e._sgAction!=null?'sg'+d.e._sgAction:Math.floor(G.t/.65);if(s.hitStamp.get(d.token)===stamp)return false;s.hitStamp.set(d.token,stamp);return true;}
function duelPosture(e,n){
  if(!e||e.dead||e.sgDummy||e.invuln)return;
  e._duelPosture=clamp((e._duelPosture||0)+n,0,100);e._duelPostureAt=G.t;
  if(e._duelPosture<100||(e._duelBreakUntil||0)>G.t)return;
  e._duelPosture=0;e._duelBreakUntil=G.t+4;e._duelFinishUntil=G.t+(e.boss||e.sgCaptain?1.8:2.4);e._sgExposed=e._duelFinishUntil;
  if(!e.boss&&!e.sgCaptain){e.stunT=Math.max(e.stunT||0,1.1);e.st='recover';e.stT=1.1;}
  duelVfx('break',e.x,e.y,'#f9cf83');addText(e.x,e.y-e.h-10,'POSTURE BROKEN','#f9cf83');duelSound('break',e.x,e.y);
}
function duelDeflect(d,perfect){
  const p=G.p,s=duelState();if(d.pr){d.pr.team='p';const a=p.aim,v=Math.max(130,Math.hypot(d.pr.vx||0,d.pr.vy||0));d.pr.vx=Math.cos(a)*v;d.pr.vy=Math.sin(a)*v;d.pr.ang=a;d.pr.hit=new Set();d.pr.src='parry';d.pr.life=Math.max(.5,d.pr.life);}
  if(d.e){d.e.contactCd=Math.max(d.e.contactCd||0,.35);duelPosture(d.e,perfect?34:17);if(d.e._duelStrike)d.e._duelStrike.hit=true;
    if(!d.e.boss&&!d.e.sgCaptain){d.e.stunT=Math.max(d.e.stunT||0,perfect?.32:.15);d.e.st='recover';d.e.stT=.38;}
  }
  if(duelRewardOnce(s,d)){duelChaos(perfect?22:9);if(perfect){s.stamina=Math.min(100,s.stamina+15);duelCapture(d.e,d.pr);s.counter={kind:'parry',until:G.t+2.5};}duelMark(perfect?'perfectParry':'parry');}
  s.parryUntil=-99;s.recoverUntil=G.t+.08;s.guard=true;duelAnim(perfect?'perfectParry':'parry',.35);duelVfx(perfect?'perfect':'parry',p.x,p.y,perfect?'#ffe4a5':'#c1e7f3');duelSound(perfect?'perfect':'parry');hitstop(perfect?.055:.025);
  return d.pr?HIT.REFLECT:HIT.BLOCK;
}
// guard, parry and dodge resolve before the native damage and relic hooks
const _hurtDuel=hurtPlayer;
hurtPlayer=function(amount,src={}){
  if(!duelOn())return _hurtDuel(amount,src);const p=G.p,s=duelState(),d=duelSource(src);
  if(p.dead||amount<=0)return HIT.NONE;
  if(CD.debug.god||p.barrierT>0||p.leapT>0||p.veilT>0||p.stoneT>0&&src.proj)return _hurtDuel(amount,src);
  if(p.dashT>0){
    if(p.iframes<=0&&G.t-s.dashAt<.085*duelWide()&&d.type!=='hazard'&&duelRewardOnce(s,d)){
      const a=Number.isFinite(d.x)?Math.atan2(d.y-p.y,d.x-p.x):p.aim,delta=angDiff(a,Math.atan2(p.dashDy,p.dashDx));
      const kind=Math.abs(delta)<Math.PI/3?'in':Math.abs(delta)>Math.PI*2/3?'back':'side';s.counter={kind,until:G.t+2.5};duelChaos(15);s.stamina=Math.min(100,s.stamina+8);duelMark('perfectDodge');duelVfx('perfect',p.x,p.y,'#b1f7de');duelSound('dodge');duelNotice('PERFECT DODGE · '+kind.toUpperCase(),'#b1f7de');
    }return HIT.NONE;
  }
  if(p.iframes>0)return HIT.NONE;
  if(d.front&&d.type==='parry'&&G.t<s.parryUntil&&G.t>=s.brokenUntil)return duelDeflect(d,G.t-s.guardAt<=.08*duelWide());
  // A timed heavy swing can clash with a committed, parryable melee strike.
  if(d.e&&d.front&&d.type==='parry'&&s.heavy&&G.t-s.attackAt>=0&&G.t-s.attackAt<.12*duelWide()&&duelRewardOnce(s,d)){
    duelPosture(d.e,24);duelChaos(12);s.recoverUntil=G.t+.22;p.swing=null;d.e.contactCd=.5;if(d.e._duelStrike)d.e._duelStrike.hit=true;
    if(!d.e.boss&&!d.e.sgCaptain){d.e.st='recover';d.e.stT=.55;d.e.stunT=.25;}
    duelMark('clash');duelAnim('clash',.32);duelVfx('perfect',p.x,p.y,'#ffd99b');duelSound('parry');hitstop(.065);return HIT.BLOCK;
  }
  if(s.guard&&d.front&&d.type!=='hazard'&&d.type!=='grab'&&G.t>=s.brokenUntil){
    const style=duelStyle(),force=clamp(amount*(d.type==='crush'?4:1.7),9,75)*(style==='shield'?.65:style==='dagger'?1.2:1);
    const ward=style==='staff'&&s.chaos>=4;if(ward)s.chaos-=4;
    s.posture=clamp(s.posture+force*.7,0,100);
    if(duelSpend(force)&&s.posture<100){
      const chip=ward?0:style==='shield'?.06:.18;const oldHp=p.hp;
      if(chip>0&&!src.duelTraining){_hurtDuel(amount*chip,{...src,duelBlocked:true});p.iframes=Math.max(p.iframes,.14);}else p.iframes=.14;
      if(d.e){d.e.contactCd=.4;if(d.e._duelStrike)d.e._duelStrike.hit=true;}
      s.wound=0;s.woundUntil=0;duelMark('guard');duelAnim('block',.2);duelVfx('guard',p.x,p.y,'#bed3df');duelSound('guard');
      // Preserve native fatal-hit handling even when chip damage kills.
      return p.hp<oldHp&&p.dead?HIT.HIT:HIT.BLOCK;
    }
    s.stamina=0;s.posture=0;s.guard=false;s.parryUntil=-99;s.brokenUntil=G.t+.85;s.flaskUntil=0;duelAnim('broken',.85);duelVfx('break',p.x,p.y,'#f78c8c');duelSound('break');duelNotice('GUARD BROKEN','#ffac9b');
  }
  const old=p.hp,result=src.duelTraining?HIT.HIT:_hurtDuel(amount,src);
  if(p.hp<old){s.wound=0;s.woundUntil=0;if(!p.dead){s.wound=Math.min((old-p.hp)*.45,p.maxHp*.22);s.woundUntil=G.t+3;}s.flaskUntil=0;s.castHold=null;s.guard=false;s.parryUntil=-99;duelAnim('hurt',.28);}
  return result;
};
const _dotDuel=hurtDot;
hurtDot=function(p,amt,color){const old=p.hp;const r=_dotDuel(p,amt,color);if(p.hp<old){const s=duelState(p);s.wound=0;s.woundUntil=0;s.flaskUntil=0;}return r;};
/* Real weapon connections drive resource recovery, counters and finishers. */
hook('dmgMul',(e,o)=>{
  if(!duelOn()||o.dot||o.src!=='weapon')return 1;const s=duelState();let m=1;
  if((e._duelFinishUntil||0)>G.t)m*=s.heavy?1.8:1.3;
  return m;
});
hook('onHit',(e,dmg,o)=>{
  if(!duelOn()||o.dot||e.sgDummy||!['weapon','ability'].includes(o.src)||!Number.isFinite(dmg))return;
  const p=G.p,s=duelState();
  if(G.t-s.lastChaosHit>.16){duelChaos(o.src==='weapon'?4:1);s.lastChaosHit=G.t;}
  if(o.src==='weapon'){
    duelPosture(e,s.heavy?22:7);
    if(s.counterStrikeUntil>G.t&&s.woundUntil>G.t&&s.wound>0){const n=Math.min(s.wound,dmg*.45);heal(p,n,true);s.wound=Math.max(0,s.wound-n);}
    if((e._duelFinishUntil||0)>G.t&&s.heavy){e._duelFinishUntil=0;duelMark('finisher');duelNotice('EXECUTION','#ffe3a1');duelVfx('perfect',e.x,e.y,'#ffd99b');duelSound('perfect',e.x,e.y);hitstop(.07);}
  }
});
hook('onKill',e=>{if(duelOn()&&!e.sgDummy&&!e.summoned)duelChaos(8);});
/* Flask healing has a readable commitment and can be interrupted. */
const _flaskDuel=drinkPotion;
drinkPotion=function(p){if(!duelOn())return _flaskDuel(p);const s=duelState(p);if(p.dead||s.flaskUntil>G.t||s.guard||p.dashT>0||G.t<s.brokenUntil||p.potions<=0||p.hp>=p.maxHp)return;s.flaskUntil=G.t+.65;s.recoverUntil=G.t+.65;duelAnim('flask',.65);duelSound('flask');};
/* Simulation update owns all timing; menus freeze actions. */
const _playerDuel=updatePlayer;
updatePlayer=function(dt){
  if(!duelOn())return _playerDuel(dt);const p=G.p,s=duelState(),A=Input.act;
  if(DUEL.p!==p){DUEL.p=p;DUEL.lesson=null;DUEL.slots=[];}
  const locked=G.t<s.brokenUntil||G.t<s.recoverUntil||s.flaskUntil>G.t;
  if(s.woundUntil<=G.t)s.wound=0;
  s.guard=!!A.guard&&!locked&&!p.dead&&p.dashT<=0&&p.leapT<=0;
  if(A.guardEdge&&s.guard){
    if(s.stamina>=6){duelSpend(6);s.guardAt=G.t;s.parryUntil=G.t+.22*duelWide();s.recoverUntil=G.t+.32;duelAnim('parryReady',.32);}else duelNotice('LOW STAMINA','#d8dba1');
  }
  // Keep guarding after the tap window; repeated taps each pay recovery and stamina.
  if(A.guard&&G.t<s.recoverUntil&&s.anim==='parryReady')s.guard=true;
  if(!A.guard&&G.t>s.parryUntil)s.guard=false;
  if(!s.guard&&G.t>=s.regenAt&&p.dashT<=0&&!locked)s.stamina=Math.min(100,s.stamina+dt*32/(1+s.debt/35));
  if(s.guard&&G.t>=s.regenAt)s.stamina=Math.min(100,s.stamina+dt*7/(1+s.debt/35));
  if(!s.guard)s.posture=Math.max(0,s.posture-dt*24);
  // Calm recovery gives non-combat characters a small starting magic reserve.
  if(!duelThreat()&&G.t-(s.attackAt||-99)>4&&s.debt===0)s.chaos=Math.max(s.chaos,Math.min(35,s.chaos+dt*3));
  const saved={attack:A.attack,dash:A.dash,ab1:A.ab1,ab2:A.ab2,mx:A.mx,my:A.my};
  const activeSwing=p.swing&&p.swing.t<p.swing.dur*.65;
  // Light strikes can cancel into a guard; heavy strikes retain their commitment.
  if(s.guard&&p.swing&&!s.heavy){p.swing=null;p.lunge=0;}
  if(locked||s.guard){A.attack=false;A.ab1=A.ab2=false;A.mx*=s.flaskUntil>G.t?.28:s.guard?.45:.4;A.my*=s.flaskUntil>G.t?.28:s.guard?.45:.4;}
  if(s.guard&&activeSwing&&s.heavy){s.guard=false;A.attack=false;}
  let chargedDash=false;
  if(A.dash){
    const cost=duelThreat()?Math.round(23*clamp(p.stats.dashCd/1.15,.65,1.3)/(1+.13*Math.max(0,p.stats.dashMax-1))):0;
    if(locked||p.dashT>0||p.leapT>0||p.bashT>0||!duelSpend(cost))A.dash=false;
    else {p.dashCharges=Math.max(1,p.dashCharges);s.guard=false;s.parryUntil=-99;chargedDash=true;}
  }
  s.wantHeavy=!!A.heavy&&!locked&&!s.guard;
  if(s.wantHeavy&&p.atkCd<=0){A.attack=true;}
  if(s.castHold){const slot=s.castHold.slot,held=A['ab'+(slot+1)+'Held'];if(!held)s.castHold=null;else if(G.t-s.castHold.at>=.65&&s.debt<60){s.overdraw=true;castAbility(p,slot);s.overdraw=false;}}
  _playerDuel(dt);s.wantHeavy=false;
  if(chargedDash&&p.dashT>0){s.dashAt=G.t;duelAnim('dodge',.22);}
  if(s.flaskUntil&&s.flaskUntil<=G.t){s.flaskUntil=0;if(!p.dead){_flaskDuel(p);s.wound=0;}}
  Object.assign(A,saved);
  if(s.animDur&&G.t-s.animAt>s.animDur){s.anim=s.guard?'guard':'idle';s.animDur=0;}
  if(s.guard&&s.anim==='idle')s.anim='guard';else if(!s.guard&&s.anim==='guard')s.anim='idle';
  if(p.dead){s.guard=false;s.flaskUntil=0;s.castHold=null;}
  duelLessonStep(dt);
};
/* Coordinated melee replaces passive contact damage with explicit attacks.
   Other enemy archetypes keep their unique AI; hazards remain un-parryable. */
function duelEligible(e){return !e.dead&&!e.dorm&&e.type==='enemy'&&!e.sgDummy&&!e.boss&&!e.sgCaptain&&e.def.ai==='melee'&&(!e.world||e.aggro!==false);}
const _aiMeleeDuel=AI.melee;
AI.melee=function(e,dt,p){
  if(!duelOn()||!duelEligible(e))return _aiMeleeDuel(e,dt,p);
  e.noContact=true;if(e._duelInterrupted){e._duelInterrupted=false;e._duelStrike=null;e.st='recover';e.stT=.5;}
  if(e.st==='windup'&&e._duelStrike){
    e.stT-=dt;e.pose=1;e.vx=e.vy=0;
    if(e.stT<=0){e.st='duelStrike';e.stT=.16;e.pose=2;duelAnimEnemy(e,'strike');}
    return;
  }
  if(e.st==='duelStrike'&&e._duelStrike){
    const a=e._duelStrike;e.stT-=dt;e.pose=2;
    if(!a.hit){a.hit=true;const d=Math.hypot(p.x-e.x,p.y-e.y),aa=Math.atan2(p.y-e.y,p.x-e.x);
      if(d<(e.def.reach||24)+p.r+12&&Math.abs(angDiff(a.ang,aa))<(a.kind==='grab'?.65:1.1))hurtPlayer(e.dmg*(a.kind==='crush'?1.4:1),{ent:e,duelKind:a.kind,kx:Math.cos(a.ang)*90,ky:Math.sin(a.ang)*90});
      duelSound(a.kind==='parry'?'counter':a.kind,e.x,e.y);
    }
    if(e.stT<=0){e.st='recover';e.stT=a.kind==='crush'?.8:.55;e.pose=0;}
    return;
  }
  if(e.st==='recover'){e.stT-=dt;e.pose=0;e.vx=e.vy=0;if(e.stT<=0){e.st='chase';e._duelStrike=null;}return;}
  e.atkCd-=dt;const d=Math.hypot(e.x-p.x,e.y-p.y);
  const engaged=G.ents.filter(q=>q!==e&&duelEligible(q)&&q._duelStrike&&['windup','duelStrike'].includes(q.st)&&Math.hypot(q.x-p.x,q.y-p.y)<110).length;
  if(d<(e.def.reach||24)+21&&e.atkCd<=0&&engaged<(p.level<4?1:2)&&lineOfSight(G.fl,e.x,e.y,p.x,p.y)){
    const n=e._duelN=(e._duelN||0)+1;const kind=n%5===0?'grab':n%3===0?'crush':'parry';
    e._duelStrike={id:++DUEL.serial,kind,ang:Math.atan2(p.y-e.y,p.x-e.x),hit:false};e.st='windup';e.stT=kind==='parry'?.52:.8;e.atkCd=1.25;e.face=p.x>=e.x?1:-1;duelSound(kind==='parry'?'threat':kind,e.x,e.y);return;
  }
  const dir=steerTo(e,p.x,p.y);if(engaged&&(d<70)){const a=Math.atan2(e.y-p.y,e.x-p.x)+.6;walk(e,Math.cos(a),Math.sin(a),e.spd*.45,dt);}else walk(e,dir.x,dir.y,e.spd,dt);
};
function duelAnimEnemy(e,name){e._duelAnim=name;e._duelAnimAt=G.t;}
/* The Briar Captain becomes a three-beat boss exchange. Parry the last beat
   for the long opening; earlier beats preserve the sequence. */
const _captainDuel=AI.trailcaptain;
AI.trailcaptain=function(e,dt,p){
  if(!duelOn())return _captainDuel(e,dt,p);e.noContact=true;
  if(!e._duelBoss){e._duelBoss={phase:'rest',t:.9,beat:0,cycle:0};e._sgAction++;e.st='recover';}
  const b=e._duelBoss;b.t-=dt;e.vx=e.vy=0;
  if(b.phase==='rest'){
    e.st='recover';e.pose=0;if(b.t>0)return;
    if(Math.hypot(e.x-p.x,e.y-p.y)>65){const d=steerTo(e,p.x,p.y);walk(e,d.x,d.y,e.spd,dt);return;}
    b.phase='windup';b.t=.7;b.beat=0;b.cycle++;e._sgExposed=0;
  }
  if(b.phase==='windup'){
    e.st='windup';e.pose=1;
    if(!b.prepared){const kind=b.beat===2?(b.cycle%3===0?'grab':b.cycle%3===2?'crush':'parry'):'parry';e._duelStrike={id:++DUEL.serial,kind,ang:Math.atan2(p.y-e.y,p.x-e.x),hit:false};b.prepared=true;duelSound(kind==='parry'?'threat':kind,e.x,e.y);}
    if(b.t>0)return;
    e.st='strike';e.pose=2;const a=e._duelStrike;const d=Math.hypot(e.x-p.x,e.y-p.y);
    if(d<65+p.r&&Math.abs(angDiff(a.ang,Math.atan2(p.y-e.y,p.x-e.x)))<1.15)hurtPlayer(e.dmg*(a.kind==='crush'?1.4:1),{ent:e,duelKind:a.kind,sgAttack:true,kx:Math.cos(a.ang)*80,ky:Math.sin(a.ang)*80});
    ring(e.x,e.y,56,a.kind==='parry'?'#c6e5ff':a.kind==='grab'?'#d8a5ed':'#ffb083',.22,1);
    b.phase='between';b.t=.22;return;
  }
  if(b.phase==='between'&&b.t<=0){b.beat++;b.prepared=false;if(b.beat<3){b.phase='windup';b.t=b.beat===2?.8:.48;}else{b.phase='rest';b.t=1.35;e.st='recover';e._sgExposed=G.t+1.35;e._duelStrike=null;}}
  if(e.hp<e.maxHp*.5&&!e.sgAdds){e.sgAdds=true;for(let i=0;i<2;i++){const q=sgSpawn('w_gobscout',e.x+(i?40:-40),e.y+24,1,'captain-add');if(q&&e.sgTrial){q.sgTrial=true;q.summoned=true;q.gold=q.xp=0;}}}
};
/* Precision on the final beat converts the next recovery to a major opening. */
const _deflectBossDuel=duelDeflect;
duelDeflect=function(d,perfect){const result=_deflectBossDuel(d,perfect);if(perfect&&d.e&&(d.e.boss||d.e.sgCaptain)){const b=d.e._duelBoss;if(b&&b.beat===2){b.finalParry=true;}else if(!b&&['recover','rest','idle'].includes(d.e.st))d.e._duelFinishUntil=G.t+1.4;}return result;};
hook('update',dt=>{
  if(!duelOn())return;
  for(const e of G.ents){
    if(e._duelPosture&&G.t-(e._duelPostureAt||0)>2.8)e._duelPosture=Math.max(0,e._duelPosture-dt*14);
    const b=e._duelBoss;if(b&&b.finalParry&&b.phase==='rest'){b.t=Math.max(b.t,1.9);b.finalParry=false;e._duelFinishUntil=G.t+1.9;}
  }
  duelAudioStep(dt);
});
/* Procedural animation: crouch, anticipatory lean, recoil, casting lift,
   flask reach and guard-break stagger are evaluated from simulation time. */
/* New articulated clips are baked lazily through the existing rig budget. */
Object.assign(RIG_CLIPS,{duelguard:4,duelparry:5,duelcast:6,duelheavy:6,duelbroken:5,duelflask:5});
const _skelDuel=rigSkel;
rigSkel=function(clip,t){
  if(!clip.startsWith('duel'))return _skelDuel(clip,t);
  const S=_skelDuel('idle',0),w=Math.sin(t*Math.PI);let hy=19,lean=.8;
  if(clip==='duelbroken'){hy=17.5;lean=-2.5*w;}
  else if(clip==='duelheavy'){hy=19-1.3*w;lean=Math.sin(t*TAU)*2.5;}
  else if(clip==='duelcast'){hy=20+w;lean=-1;}
  else if(clip==='duelparry'){hy=18.7;lean=-1.5*w;}
  S.hy=hy;S.lean=lean;S.breath=0;
  for(const [side,sx]of[['L',-1],['R',1]]){
    const hp=[sx*3.6,hy,0],kn=v3(hp,rigBone(.2,10)),ft=v3(kn,rigBone(-.24,10)),sh=[sx*5,hy+10,1];
    let upper=-.55,fore=1.65;
    if(clip==='duelparry'){upper=-.7-w*.6;fore=1.7-w*.3;}
    if(clip==='duelcast'){upper=-2.2*w;fore=.6;}
    if(clip==='duelheavy'){upper=-1.7+2.8*t;fore=.65;}
    if(clip==='duelbroken'){upper=-.5;fore=.35;}
    if(clip==='duelflask'){upper=side==='L'?-.8:-1.4;fore=side==='L'?1.2:-1.2;}
    const el=v3(sh,rigBone(upper,7)),ha=v3(el,rigBone(upper+fore,7));
    Object.assign(S.j,{['hp'+side]:hp,['kn'+side]:kn,['ft'+side]:ft,['sh'+side]:sh,['el'+side]:el,['ha'+side]:ha});
  }
  return S;
};
const _clipDuel=rigClipOf;
rigClipOf=function(p){
  if(!duelOn()||p!==G.p||p.dead||!CD.settings.duelMotion)return _clipDuel(p);
  const s=duelState(p),a=s.anim;let clip=s.guard?'duelguard':null;
  if(['parry','perfectParry','parryReady','block'].includes(a))clip='duelparry';
  else if(['cast','overdraw'].includes(a))clip='duelcast';
  else if(a==='heavy')clip='duelheavy';else if(['broken','clash'].includes(a))clip='duelbroken';else if(a==='flask')clip='duelflask';
  if(!clip)return _clipDuel(p);const n=RIG_CLIPS[clip],f=clip==='duelguard'?Math.floor(G.t*3)%n:Math.min(n-1,Math.floor(clamp((G.t-s.animAt)/(s.animDur||.3),0,.999)*n));return[clip,f];
};

const _drawPlayerDuel=drawPlayer;
drawPlayer=function(g,p,cx,cy){
  if(!duelOn()||p.dead||!CD.settings.duelMotion)return _drawPlayerDuel(g,p,cx,cy);
  const s=duelState(p),k=s.animDur?clamp((G.t-s.animAt)/s.animDur,0,1):0,w=Math.sin(k*Math.PI),x=p.x-cx,y=p.y-cy;
  let lean=0,sx=1,sy=1,lift=0;
  if(s.guard){lean=-.07*p.face;sy=.95;}
  if(['parry','perfectParry','block','parryReady'].includes(s.anim)){lean=-.16*p.face*w;sy=1-.07*w;}
  if(s.anim==='dodge'){lean=.23*p.dashDx*w;sy=1-.22*w;sx=1+.12*w;}
  if(s.anim==='heavy'){lean=.16*p.face*Math.sin(k*TAU);sy=1-.1*w;}
  if(['cast','overdraw'].includes(s.anim)){lift=3*w;lean=-.08*p.face*w;}
  if(s.anim==='flask'){lean=-.1*p.face*w;}
  if(['broken','hurt','clash'].includes(s.anim)){lean=-.2*p.face*w;sy=1-.12*w;}
  g.save();g.translate(x,y-lift);g.rotate(lean);g.scale(sx,sy);g.translate(-x,-y);_drawPlayerDuel(g,p,cx,cy);g.restore();
  if(s.guard){g.save();g.strokeStyle=duelStyle(p)==='staff'?'#c5a4ff':'#b7d8e6';g.lineWidth=2;g.beginPath();g.ellipse(x,y-8,17,12,0,p.aim-.95,p.aim+.95);g.stroke();g.restore();}
  if(s.flaskUntil>G.t){g.fillStyle='#e9828c';g.fillRect(x+p.face*4,y-15,3,5);g.fillStyle='#ffe8bb';g.fillRect(x+p.face*4,y-16,3,1);}
};
const _heldDuel=drawHeld;
drawHeld=function(g,p,x,y){const s=duelState(p);if(!duelOn()||!s.guard)return _heldDuel(g,p,x,y);const aim=p.aim,sw=p.swing;try{p.aim=aim-.6*p.face;p.swing=null;_heldDuel(g,p,x+Math.cos(aim)*2,y-2);}finally{p.aim=aim;p.swing=sw;}};
hook('entOverlay',(g,e,x,y)=>{
  if(!duelOn()||e.dead||e.sgDummy)return;const a=e._duelStrike;
  if(a&&['windup','aim','strike','duelStrike'].includes(e.st)){
    const color=a.kind==='parry'?'#c5ecff':a.kind==='crush'?'#ffb286':'#e6b2ff';const yy=y-e.h-9;
    g.save();g.strokeStyle=color;g.fillStyle=color;g.lineWidth=1;
    if(a.kind==='parry'){g.beginPath();g.moveTo(x-4,yy+4);g.lineTo(x+4,yy-4);g.moveTo(x-4,yy-4);g.lineTo(x+4,yy+4);g.stroke();}
    else if(a.kind==='crush'){g.beginPath();g.moveTo(x,yy-5);g.lineTo(x+5,yy);g.lineTo(x,yy+5);g.lineTo(x-5,yy);g.closePath();g.stroke();g.fillRect(x-1,yy-2,2,4);}
    else{g.beginPath();g.arc(x,yy,4,0,TAU);g.stroke();g.beginPath();g.moveTo(x-6,yy);g.lineTo(x-2,yy);g.moveTo(x+2,yy);g.lineTo(x+6,yy);g.stroke();}
    if(e._duelBoss){g.font='5px sans-serif';g.textAlign='center';g.fillText((e._duelBoss.beat+1)+'/3',x,yy-8);}
    g.restore();
  }
  if(e._duelPosture>0||(e._duelFinishUntil||0)>G.t){g.fillStyle='#24313c';g.fillRect(x-13,y-e.h-4,26,2);g.fillStyle=(e._duelFinishUntil||0)>G.t?'#ffe4a3':'#e1bd80';g.fillRect(x-13,y-e.h-4,(e._duelFinishUntil||0)>G.t?26:26*e._duelPosture/100,2);}
});
/* A layered score follows threat, posture breaks, low health and Chaos.
   New stems use the existing song's scale and sixteenth-note clock. */
function duelAudioStep(dt){
  const p=G.p,s=duelState();const danger=duelThreat(),boss=G.ents.some(e=>!e.dead&&(e.boss||e.sgCaptain)&&Math.hypot(e.x-p.x,e.y-p.y)<220);
  DUEL.musicMood=p.hp/p.maxHp<.3?'last stand':boss?'duel':danger?'combat':s.chaos>=70?'chaos':'exploration';
  if(p.moving&&p.dashT<=0&&G.t-(s.stepAt||0)>.25){s.stepAt=G.t;duelSound('step');}
}
const _musicTickDuel=Music.tick;
Music.tick=function(){
  _musicTickDuel.call(this);if(!duelOn()||UI.top()||!CD.settings.duelMusic||!this.c||this.c.state!=='running'||!this.song||Sound.vol.music<=0)return;
  const step=this.step;if(step===DUEL.musicStep)return;DUEL.musicStep=step;
  const t=Math.max(this.c.currentTime+.015,(this.nextT||this.c.currentTime)+.005),S=this.song,s=duelState(),m=DUEL.musicMood,root=this.deg(S,0),n=step%16;
  if(['combat','duel','last stand'].includes(m)){
    if(n%4===0)this.drum('taiko',t,m==='duel'?.075:.045);
    if(n%2===0)this.inst('bass',root-12+(n%8===6?7:0),t,.16,.035);
    if(m==='duel'&&n%4===2)this.drum('shaker',t,.022);
  }
  if(m==='last stand'&&(n===0||n===2))this.drum('kick',t,.07);
  if(s.chaos>=65&&n%8===0)this.inst('choir',this.deg(S,n===0?7:9),t,1.1,.025);
  if(s.debt>0&&n%8===4)this.v('sine',this.note(root-12)*1.015,t,.4,.016,.03,.3);
};
/* Rowan's optional six-step live sparring curriculum. The practice attacker
   has no loot, does not damage health, and cannot complete steps by waiting. */
const DUEL_LESSONS=[['guard','Hold your guard toward Rowan’s strike.','parry'],['parry','Tap guard before the strike lands.','parry'],['dodge','Evade the crushing diamond attack.','crush'],['cast','Spend Chaos on a spell. Hold a spell to overdraw if needed.','parry'],['perfectParry','Mastery: tap guard at the instant of impact.','parry'],['perfectDodge','Mastery: dodge as the strike reaches you.','parry']];
function duelStartLesson(mastery=false){
  if(!sgOn()||W.Z.id!=='meadows'||!SG.nodes.dummy||Math.hypot(G.p.x-SG.nodes.dummy.x,G.p.y-SG.nodes.dummy.y)>110)return false;
  const s=duelState();if(duelThreat()){toast('Clear nearby threats before sparring.');return false;}
  DUEL.lesson={active:true,index:mastery?4:0,want:mastery?'perfectParry':'guard',count:0,next:G.t+1,attack:null,zone:W.Z,origin:{x:G.p.x,y:G.p.y},best:mastery};s.chaos=Math.max(35,s.chaos);UI.clear();return true;
}
function duelLessonAdvance(){
  const l=DUEL.lesson;if(!l)return;duelState().mastery|=1<<l.index;l.index++;l.count=0;l.attack=null;l.next=G.t+1;
  if(l.index>=DUEL_LESSONS.length){l.active=false;duelNotice('ROWAN’S MASTERY COMPLETE','#ffe3a0');duelSound('perfect');if(W.ch){W.ch.warbook={mastery:duelState().mastery};saveRealm(true);}return;}l.want=DUEL_LESSONS[l.index][0];
}
function duelLessonStep(dt){
  const l=DUEL.lesson;if(!l||!l.active)return;
  if(!sgOn()||W.Z!==l.zone||G.p.dead||Math.hypot(G.p.x-l.origin.x,G.p.y-l.origin.y)>120||duelThreat()){l.active=false;duelNotice('SPARRING ENDED');return;}
  const s=duelState(),n=SG.nodes.dummy;
  if(l.want==='cast'){if(!G.p.abilities.some(Boolean)){duelNotice('EQUIP A SPELL TO CONTINUE','#cba6ff');}return;}
  if(!l.attack&&G.t>=l.next){const a=Math.atan2(G.p.y-n.y,G.p.x-n.x);l.attack={at:G.t+.85,x:G.p.x,y:G.p.y,kind:DUEL_LESSONS[l.index][2],id:++DUEL.serial,ang:a};duelSound(l.attack.kind==='parry'?'threat':'crush',n.x,n.y);}
  if(l.attack&&G.t>=l.attack.at){
    const a=l.attack;l.attack=null;l.next=G.t+1.9;
    const dist=Math.hypot(G.p.x-a.x,G.p.y-a.y);
    if(dist>20){if(l.want==='dodge'&&G.t-(s.dashAt||-99)<.6)duelMark('dodge');else duelNotice('SAFE · WAIT FOR THE STRIKE','#bfe5d2');return;}
    const mock={x:n.x,y:n.y,kind:'training',def:{ai:'melee'},type:'enemy',st:'strike',_duelStrike:{kind:a.kind,id:a.id},contactCd:0,sgDummy:true};
    const oldHp=G.p.hp,oldI=G.p.iframes,oldPot=G.p.potions;const oldW=s.wound;const oldWUntil=s.woundUntil;
    // Practice uses the exact defense resolver; all incoming damage is intercepted.
    s.training=true;const result=hurtPlayer(8,{ent:mock,duelKind:a.kind,duelTraining:true});s.training=false;
    G.p.hp=oldHp;G.p.potions=oldPot;s.wound=oldW;s.woundUntil=oldWUntil;if(result===HIT.HIT){G.p.iframes=oldI;duelNotice('TRY AGAIN · READ THE CUE','#e6bbac');}
    if(result===HIT.NONE&&G.p.dashT>0&&l.want==='dodge')duelMark('dodge');
    if(l.want==='parry'&&s.anim==='perfectParry'&&result===HIT.BLOCK)duelMark('parry');
  }
}
// Training cannot trigger death/revive hooks, chip, or actual damage.

/* Save only scalar resources and learned skills; never transient entity refs. */
hook('saveRun',(c,run,p)=>{const s=duelState(p);c.steelChaos={v:1,stamina:s.stamina,chaos:s.chaos,debt:s.debt,posture:s.posture,mastery:s.mastery,seen:{...s.seen},echo:s.echo?{...s.echo}:null};});
hook('loadRun',(c,run,p)=>{const s=duelState(p),q=c.steelChaos;if(!q)return;s.stamina=clamp(Number(q.stamina)||0,0,100);s.chaos=clamp(Number(q.chaos)||0,0,100);s.debt=clamp(Number(q.debt)||0,0,100);s.posture=clamp(Number(q.posture)||0,0,100);s.mastery=(Number(q.mastery)||0)&63;s.seen=q.seen&&typeof q.seen==='object'?{...q.seen}:{};s.echo=q.echo&&['steel','fang','storm'].includes(q.echo.kind)?{kind:q.echo.kind,name:String(q.echo.name).slice(0,40)}:null;});
/* Readable HUD and a field manual, including exact resource costs. */
function duelHud(){
  if(!DUEL.hud||!DUEL.hud.isConnected){DUEL.hud=h('div',{class:'duel-hud'},h('button',{type:'button',onclick:()=>UI.steelChaos(),'aria-label':'Open Steel and Chaos combat manual'},'STEEL & CHAOS'),h('div',{class:'duel-meter stamina'},h('i',{}),h('span',{})),h('div',{class:'duel-meter chaos'},h('i',{}),h('span',{})),h('small',{}),h('div',{class:'duel-prompt','aria-live':'polite'}));$('hud').append(DUEL.hud);}
  DUEL.hud.hidden=!duelOn();if(!duelOn())return;
  const s=duelState(),bars=DUEL.hud.querySelectorAll('.duel-meter');bars[0].querySelector('i').style.width=s.stamina+'%';bars[0].querySelector('span').textContent='STAMINA '+Math.ceil(s.stamina)+' / 100';bars[1].querySelector('i').style.width=s.chaos+'%';bars[1].querySelector('span').textContent='CHAOS '+Math.floor(s.chaos)+' / 100'+(s.debt>0?' · DEBT '+Math.ceil(s.debt):'');
  DUEL.hud.querySelector('small').textContent=(s.guard?'DEFENDING · ':'')+(s.brokenUntil>G.t?'GUARD BROKEN':s.counter&&s.counter.until>G.t?'COUNTER · '+s.counter.kind.toUpperCase():s.echo?'ECHO · '+s.echo.name:'Posture '+Math.ceil(s.posture)+'%')+(s.wound>0?' · recoverable '+Math.ceil(s.wound):'');
  const l=DUEL.lesson;DUEL.hud.querySelector('.duel-prompt').textContent=l&&l.active?'Rowan '+(l.index+1)+'/6 · '+l.count+'/3 · '+DUEL_LESSONS[l.index][1]:s.castHold?'Hold spell to overdraw · '+Math.round(clamp((G.t-s.castHold.at)/.65,0,1)*100)+'%':'';
}
const _hudDuel=updateHUD;
updateHUD=function(dt){_hudDuel(dt);duelHud();$('app').classList.toggle('steel-chaos',!!duelOn());if(duelOn()){
  const s=duelState();for(const id of ['tb-dash']){$(id).classList.toggle('duel-empty',duelThreat()&&s.stamina<23);$(id).setAttribute('aria-label','Dodge · stamina cost');}
  for(const [i,el]of [...$('abil').querySelectorAll('.abil')].entries()){const a=G.p.abilities[i];if(!a)continue;let cost=el.querySelector('.duel-cost');if(!cost){cost=h('span',{class:'duel-cost'});el.append(cost);}cost.textContent=duelSpellCost(a);el.classList.toggle('duel-empty',s.chaos<duelSpellCost(a));el.title=ABILITY[a.id].name+' · '+duelSpellCost(a)+' Chaos';}
  const dash=$('tb-dash');const cd=dash.querySelector('.cd');if(cd)cd.style.transform='scaleY(0)';
  for(const [i,id]of [[0,'tb-ab1'],[1,'tb-ab2']]){const a=G.p.abilities[i];$(id).classList.toggle('duel-empty',!!a&&s.chaos<duelSpellCost(a));}
}};
UI.steelChaos=function(){
  const p=G.p,s=p&&duelState(p),panel=h('div',{class:'panel duel-panel'},h('h2',{},'Steel & Chaos'),h('p',{class:'eyebrow'},'READ · COMMIT · DEFLECT · UNLEASH'));
  panel.append(h('p',{},'Health is survival. Stamina powers attacks and defense. Chaos fuels spells; earn it through hits, kills and precise defense. Walking is free. Traversal dodges are free when no enemy is nearby. Dash-charge relics reduce stamina cost; faster dash recovery also improves efficiency.'));
  const rows=[['Attack','J / mouse · light: 8–20 stamina'],['Heavy / clash','B · 27 stamina · timed heavy can clash with a strike'],['Dodge','Space / Shift · 23 base stamina near enemies'],['Defend / parry','Hold V or Ctrl to guard toward aim; tap to parry (6 stamina)'],['Perfect timing','80 ms dodge/parry window; ordinary parry window 220 ms'],['Magic','Q / E or right mouse · '+(p?p.abilities.map(a=>a?ABILITY[a.id].name+': '+duelSpellCost(a)+' Chaos':'empty slot').join(' / '):'16–42 Chaos')],['Overdraw','Hold an underfunded spell for 0.65 s. Debt slows stamina recovery; earn Chaos to repay it. Debt capped at 100; no further overdraw at 60+.'],['Healing','R · 0.65 s flask commitment; damage interrupts before a flask is spent.'],['Enemy cues','Cross + metallic note: parryable. Diamond + low warning: crushing. Open circle + double note: grab.'],['Counters','Inward dodge: interrupt. Side dodge: stronger flanking strike. Back dodge: ranged Chaos slash.'],['Posture','Heavy attacks and parries break posture. Use a heavy during the gold opening for an execution bonus.'],['Echo / wounds','Perfect parries store one enemy echo for your next spell. Counters recover a portion of recent wounds before they fade.']];
  const table=h('div',{class:'duel-guide'});for(const [a,b]of rows)table.append(h('b',{},a),h('span',{},b));panel.append(table);
  panel.append(h('p',{},'Weapon defenses: shield reduces guard cost and chip damage; daggers spend less on attacks but more on blocks; staves spend 4 Chaos to ward a blocked hit. Blades balance all defenses. Bosses keep their attack sequence through early parries.'));
  if(s)panel.append(h('p',{},'Mastery lessons '+Array.from({length:6},(_,i)=>s.mastery>>i&1).reduce((a,b)=>a+b,0)+'/6 · Score: '+DUEL.musicMood));
  const setting=(name,key)=>h('label',{class:'set-row'},name,h('input',{type:'checkbox',checked:CD.settings[key],onchange:e=>{CD.settings[key]=e.target.checked;CD.save.settings={...CD.settings};persist();}}));
  panel.append(h('label',{class:'set-row'},'Timing assistance',h('select',{value:CD.settings.duelTiming,onchange:e=>{CD.settings.duelTiming=e.target.value;CD.save.settings={...CD.settings};persist();}},h('option',{value:'standard'},'Standard'),h('option',{value:'generous'},'Generous · 50% wider'))),setting('Reactive music layers','duelMusic'),setting('Combat sound cues','duelSound'),setting('Combat body animation','duelMotion'));
  const near=sgOn()&&W.Z.id==='meadows'&&SG.nodes.dummy&&Math.hypot(p.x-SG.nodes.dummy.x,p.y-SG.nodes.dummy.y)<110;
  if(sgOn()){panel.append(btn('Train with Rowan · six live lessons',()=>{if(!duelStartLesson())toast('Reach the practice circle near Captain Rowan, away from enemies.');},'primary',{disabled:!near}));panel.append(btn('Optional mastery duel · perfect timing',()=>duelStartLesson(true),'',{disabled:!near}));}
  if(DUEL.lesson&&DUEL.lesson.active)panel.append(btn('End sparring',()=>{DUEL.lesson.active=false;UI.close(el);}));
  panel.prepend(btn('Close manual',()=>UI.close(el),'',{'data-autofocus':true}));panel.append(btn('Back',()=>UI.close(el)));const el=h('div',{class:'modal'},panel);UI.open(el,{modal:G.mode==='play',replace:false,onBack:()=>UI.close(el)});return el;
};
pauseItem('combat',20,()=>btn('Steel & Chaos · Combat & training',()=>UI.steelChaos()));
settingsRow('combat',40,()=>btn('Steel & Chaos · Combat, sound & music',()=>UI.steelChaos()));
const _journeyDuel=UI.provingTrail;
UI.provingTrail=function(){_journeyDuel();const panel=UI.top()&&UI.top().querySelector('.panel');if(panel)panel.append(btn('Rowan’s combat lessons & mastery',()=>UI.steelChaos()));};
hook('renderTop',(g,cx,cy)=>{const l=DUEL.lesson;if(!l||!l.active||!l.attack)return;const a=l.attack,q=fxPoint(a.x,a.y),k=clamp((a.at-G.t)/.85,0,1);g.save();g.strokeStyle=a.kind==='crush'?'#ffb286':'#c5ecff';g.lineWidth=1;g.beginPath();g.ellipse(q.x,q.y,20,12,0,0,TAU);g.stroke();g.beginPath();g.ellipse(q.x,q.y,20*k,12*k,0,0,TAU);g.stroke();g.font='6px sans-serif';g.textAlign='center';g.fillStyle=g.strokeStyle;g.fillText(a.kind==='crush'?'◇ DODGE':'× DEFLECT',q.x,q.y-30);g.restore();});
document.head.append(h('style',{},'.steel-chaos .dashes{display:none}.duel-cost{position:absolute;right:3px;bottom:3px;color:#e6ccff;background:#21172ccc;padding:1px 3px;font:10px sans-serif}.duel-control{font-size:10px!important;touch-action:none}.duel-empty{filter:saturate(.3);opacity:.55!important}.duel-hud{position:absolute;left:10px;top:164px;width:235px;max-width:58vw;padding:7px 9px;background:linear-gradient(120deg,rgba(12,21,28,.94),rgba(25,29,43,.88));border:1px solid #5b6472;border-left:2px solid #c8ad77;border-radius:5px;font:10px/1.4 sans-serif;color:#dce9ed;pointer-events:auto}.duel-hud>button{background:none;border:0;padding:0;margin:0 0 5px;min-height:0;color:#e6d1a4;font:10px sans-serif;letter-spacing:1.5px;cursor:pointer}.duel-meter{position:relative;height:17px;margin:3px 0;background:#17212a;border:1px solid #526069;overflow:hidden}.duel-meter>i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#47764b,#badb86)}.duel-meter.chaos>i{background:linear-gradient(90deg,#5d378d,#bd94ef)}.duel-meter>span{position:relative;display:block;text-align:center;font-size:9px;line-height:15px;color:#fff;text-shadow:0 1px 2px #000}.duel-hud small{font-size:9px;color:#d5cab7}.duel-prompt{margin-top:4px;color:#c4f1e0;font-size:10px}.duel-guide{display:grid;grid-template-columns:120px minmax(0,1fr);gap:9px 14px;font:14px/1.5 sans-serif}.duel-guide b{color:#d8c39d}#ui .duel-panel{width:min(780px,100%);min-width:0;max-height:calc(100dvh - 32px);overflow:auto}#ui .duel-panel .duel-guide{font-size:14px;line-height:1.5}#ui .duel-panel .duel-guide span{font-size:inherit}#ui .duel-panel h2{font-size:clamp(30px,6vw,46px)}#ui .duel-panel p,#ui .duel-panel span{overflow-wrap:anywhere}#ui .duel-panel .btn{white-space:normal}#ui .duel-panel .set-row{gap:10px}#ui .duel-panel select{max-width:55%;min-width:0}.sg-hud{top:282px!important}@media(max-width:600px){.duel-hud{top:238px;width:170px;max-width:48vw;padding:4px 6px}.duel-hud>button{margin-bottom:2px;font-size:9px}.duel-meter{height:12px;margin:2px 0}.duel-meter>span{font-size:8px;line-height:10px}.duel-hud small{display:none}.sg-hud{top:318px!important}.duel-guide{grid-template-columns:minmax(0,1fr);gap:4px;font-size:13px}.duel-guide span{margin-bottom:8px}#ui .duel-panel .set-row{font-size:13px}#ui .duel-panel select{font-size:14px}}'));
CD.combat={open:()=>UI.steelChaos(),train:duelStartLesson,get status(){const s=G.p&&duelState();return s?{health:G.p.hp,stamina:s.stamina,chaos:s.chaos,debt:s.debt,posture:s.posture,guard:s.guard,animation:s.anim,echo:s.echo,counter:s.counter,music:DUEL.musicMood,mastery:s.mastery}:null;}};

