/* ============================================================
   Cinderdeep — CinderFX: GPU cinema, spatial upscaling and VFX
   A presentation layer only. HUD, collision and simulation stay native.
   ============================================================ */
Object.assign(DEFAULT_SETTINGS,{cinema:'cinematic',fxResolution:'adaptive',fxUpscale:'pixel',fxBloom:.6,fxGrade:.55,fxSharpen:.22,fxLens:.55,fxGrain:.12,fxReduced:false});
const CFX={canvas:null,gl:null,gl2:false,ctx:null,backend:'pending',lost:false,ready:false,programs:{},targets:[],particles:[],waves:[],frame:0,lastFrame:0,avg:16.7,adaptive:.85,adjustAt:0,lastT:0,lastExposure:-99,exposure:1,layer:null,lg:null,exposureCanvas:null,renderW:0,renderH:0,dirty:true,hitAt:-99,dashAt:-99,pulse:null,stats:{passes:0,particles:0,scale:1},motion:window.matchMedia('(prefers-reduced-motion: reduce)')};
let cfxSeed=0x6d2b79f5;
function cfxRand(){cfxSeed^=cfxSeed<<13;cfxSeed^=cfxSeed>>>17;cfxSeed^=cfxSeed<<5;return(cfxSeed>>>0)/4294967296;}
const CFX_PRESETS={performance:{particles:100,mips:1,pixels:800000,factor:.55},balanced:{particles:220,mips:2,pixels:1500000,factor:.8},cinematic:{particles:380,mips:2,pixels:2300000,factor:1}};
const cfxEnabled=()=>CD.settings.cinema!=='off';
const cfxReduced=()=>CD.settings.fxReduced||CFX.motion.matches;
function cfxConfig(){let k=CD.settings.cinema;if(!CFX_PRESETS[k])k='balanced';if(CD.settings.lowFx)k='performance';return CFX_PRESETS[k];}
function cfxPoint(x,y,z=0){if(typeof DIORAMA!=='undefined'&&DIORAMA.active&&dioramaRealm()){const p=dioramaPoint(x,y);return{x:p.x,y:p.y-z};}return{x:x-(R.ox||0),y:y-(R.oy||0)-z};}
function cfxColor(c){return typeof c==='string'&&/^#[\da-f]{6}$/i.test(c)?c:'#ffd39a';}
function cfxAdd(type,x,y,o={}){
  if(!cfxEnabled()||!Number.isFinite(x)||!Number.isFinite(y))return;
  const cap=Math.min(cfxConfig().particles,R.cssW<600?180:400);if(CFX.particles.length>=cap)CFX.particles.splice(0,Math.max(1,Math.floor(cap*.08)));
  CFX.particles.push({type,x,y,z:0,born:G.t,life:.6,color:'#ffd39a',seed:cfxRand()*1000,...o});
}
function cfxSparks(x,y,color,n=12,power=1){
  if(!cfxEnabled())return;
  if(cfxReduced())n=Math.min(4,n);if(CD.settings.lowFx)n=Math.ceil(n*.4);
  for(let i=0;i<n;i++){const a=cfxRand()*TAU,s=(20+cfxRand()*90)*power;cfxAdd('spark',x,y,{z:5,vx:Math.cos(a)*s,vy:Math.sin(a)*s*.45,vz:18+cfxRand()*55,grav:190,life:.25+cfxRand()*.45,color:cfxColor(color),size:.5+cfxRand()*.8});}
}
function cfxWave(x,y,r=75,power=1){
  if(!cfxEnabled())return;cfxAdd('ring',x,y,{r,power,life:.65,color:'#b4f6ed'});
  if(cfxReduced())return;
  CFX.waves.push({x,y,born:G.t,life:.8,r,power});if(CFX.waves.length>6)CFX.waves.shift();
}
function cfxClear(){CFX.particles=[];CFX.waves=[];CFX.pulse=null;CFX.lastExposure=-99;CFX.exposure=1;CFX.lastT=G.t;CFX.hitAt=-99;}
for(const name of ['realmZone','preFloor','runStart'])hook(name,cfxClear);
function cfxImpact(x,y,color,crit=false){
  if(!cfxEnabled())return;
  if(G.t-CFX.hitAt<(crit?.025:.065))return;CFX.hitAt=G.t;
  cfxAdd('impact',x,y,{z:8,life:crit?.3:.18,color:cfxColor(color),r:crit?19:10});cfxSparks(x,y,color,crit?18:7,crit?1.1:.6);
  if(crit){cfxWave(x,y,45,.3);CFX.pulse={x,y,born:G.t,life:.28,power:.5};}
}
hook('onHit',(e,dmg,o,crit)=>{if(!o.dot&&!e.sgDummy&&o.src!=='guard')cfxImpact(e.x,e.y-e.h*.35,o.color|| (crit?'#ffe4a1':'#c2f1ed'),crit);});
hook('onAttack',(p,def)=>{
  if(def.kind!=='melee')return;const color=def.burn?'#ffad68':def.chill?'#9de9ff':def.poison?'#b4ee8e':def.shock?'#fff3a2':'#d9f7ed';
  cfxAdd('crescent',p.x,p.y,{z:8,life:.22,a:p.aim,r:Math.min(42,(def.reach||22)*1.1),color});
});
hook('onDash',(p)=>{cfxAdd('dash',p.x,p.y,{life:.35,z:5,a:Math.atan2(p.dashDy||0,p.dashDx||1),color:'#a6e9ff'});cfxSparks(p.x,p.y,'#a6e9ff',6,.5);});
hook('update',()=>{
  const p=G.p;if(!p||p.dead||!cfxEnabled()||cfxReduced()||CD.settings.lowFx)return;
  if(p.dashT>0&&G.t-CFX.dashAt>.025){CFX.dashAt=G.t;const own=Object.hasOwn(p,'rigLazy'),old=p.rigLazy;let sp;p.rigLazy=true;try{sp=heroFrame(p);}finally{if(own)p.rigLazy=old;else delete p.rigLazy;}if(sp)cfxAdd('ghost',p.x,p.y,{z:p.z||0,life:.2,sp,flip:p.face<0,scale:p.sizeMul||1,color:'#b3e5ff'});cfxAdd('glow',p.x,p.y,{z:8,r:11,life:.22,color:'#8dd5ee'});}
});
hook('onAbility',(p,a)=>{
  const id=a&&a.id||'',col=/frost|ice|snow|blizz/.test(id)?'#8edcff':/fire|flame|meteor|ember/.test(id)?'#ffb278':/venom|poison|cloud|thorn/.test(id)?'#b4ec9b':/storm|bolt|lightning/.test(id)?'#fff3b5':'#c0a4ff';
  cfxAdd('rune',p.x,p.y,{r:30,life:.85,color:col});cfxAdd('pillar',p.x,p.y,{life:.45,r:20,height:58,color:col});cfxSparks(p.x,p.y,col,15,.8);cfxWave(p.x,p.y,65,.3);
});
hook('onHurt',()=>{if(G.p)CFX.pulse={x:G.p.x,y:G.p.y,born:G.t,life:.25,power:.25};});
hook('onKill',(e)=>{if(e.type==='ally'||e.sgDummy)return;const color=e.blood&&e.blood[0]||'#efb37b';cfxSparks(e.x,e.y,color,e.big?22:12,.8);for(let i=0;i<(CD.settings.lowFx?1:3);i++)cfxAdd('smoke',e.x,e.y,{z:5,vx:(cfxRand()-.5)*12,vy:(cfxRand()-.5)*8,vz:14+cfxRand()*12,life:.8+cfxRand()*.4,r:7+cfxRand()*5,color:'#9a9f9e'});});
hook('onLevel',(p)=>{cfxAdd('rune',p.x,p.y,{life:1.3,r:42,color:'#ffe6a8'});cfxAdd('pillar',p.x,p.y,{life:1.1,r:25,height:120,color:'#ffe4a0'});cfxSparks(p.x,p.y,'#fff2ca',26,1.2);cfxWave(p.x,p.y,100,.5);});
hook('realmBoss',(e)=>{cfxAdd('rune',e.x,e.y,{life:1.8,r:70,color:'#ffcf8b'});cfxAdd('pillar',e.x,e.y,{life:1.6,r:40,height:180,color:'#ffe4ac'});cfxSparks(e.x,e.y,'#ffd895',42,1.7);cfxWave(e.x,e.y,160,1);});
const _explodeCFX=explode;
explode=function(x,y,r,dmg,o={}){const result=_explodeCFX(x,y,r,dmg,o);if(!(typeof DIORAMA!=='undefined'&&DIORAMA.active)){cfxWave(x,y,Math.min(180,r*2),.8);cfxAdd('impact',x,y,{z:6,r:r*.7,life:.4,color:cfxColor(o.color||'#ffc18b')});cfxSparks(x,y,o.color||'#ffbb75',20,1.3);for(let i=0;i<4;i++)cfxAdd('smoke',x,y,{life:1.2,r:14+cfxRand()*14,vx:(cfxRand()-.5)*35,vy:(cfxRand()-.5)*18,vz:20+cfxRand()*20,color:'#8a8990'});}return result;};
const _lightningCFX=lightningStrike;
lightningStrike=function(x,y,dmg){const result=_lightningCFX(x,y,dmg);cfxAdd('bolt',x,y,{life:.32,height:150,color:'#d4eeff'});cfxAdd('glow',x,y,{life:.4,r:40,color:'#b4daff'});cfxWave(x,y,70,.5);return result;};

/* ---------- high-resolution transparent light and particle layer ---------- */
function cfxLayer(){
  const factor=R.cssW<600?1.5:2,w=Math.min(1800,Math.max(1,Math.round(R.VW*factor))),h=Math.min(1800,Math.max(1,Math.round(R.VH*factor)));
  if(!CFX.layer){CFX.layer=mkCanvas(w,h);CFX.lg=CFX.layer.getContext('2d');}
  if(CFX.layer.width!==w||CFX.layer.height!==h){CFX.layer.width=w;CFX.layer.height=h;}
  const g=CFX.lg;g.setTransform(w/R.VW,0,0,h/R.VH,0,0);g.clearRect(0,0,R.VW,R.VH);g.globalAlpha=1;g.globalCompositeOperation='source-over';
  const t=G.t;CFX.particles=CFX.particles.filter(q=>t-q.born<q.life&&t>=q.born);CFX.waves=CFX.waves.filter(q=>t-q.born<q.life&&t>=q.born);CFX.stats.particles=CFX.particles.length;
  cfxAtmosphere(g);
  for(const q of CFX.particles){
    const age=t-q.born,k=clamp(age/q.life,0,1),fade=Math.pow(1-k,1.4),drag=q.type==='spark'?4:0,d=drag?(1-Math.exp(-age*drag))/drag:age;
    const z=Math.max(0,(q.z||0)+(q.vz||0)*age-(q.grav||0)*age*age*.5),pt=cfxPoint(q.x+(q.vx||0)*d,q.y+(q.vy||0)*d,z),x=pt.x,y=pt.y;
    if(x<-220||y<-220||x>R.VW+220||y>R.VH+220)continue;
    g.save();g.globalAlpha=fade;g.globalCompositeOperation=q.type==='smoke'?'source-over':'lighter';g.strokeStyle=q.color;g.fillStyle=q.color;
    if(q.type==='spark'){
      const a=Math.atan2((q.vy||0)*.6-(q.vz||0)+(q.grav||0)*age,q.vx||1),len=2+Math.hypot(q.vx||0,q.vy||0)*.025*(1-k);g.lineWidth=q.size||.8;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.lineTo(x-Math.cos(a)*len,y-Math.sin(a)*len);g.stroke();g.globalAlpha=fade*.35;g.drawImage(LightTex.get(q.color,.35),x-4,y-4,8,8);
    }else if(q.type==='glow'||q.type==='smoke'){
      const r=q.r*(q.type==='smoke'?.6+k:1);g.globalAlpha=fade*(q.type==='smoke'?.13:.38);g.drawImage(LightTex.get(q.color,.25),x-r,y-r,r*2,r*2);
    }else if(q.type==='impact'){
      const r=q.r*(.4+k);g.globalAlpha=fade*.65;g.drawImage(LightTex.get(q.color,.3),x-r*2,y-r*2,r*4,r*4);g.globalAlpha=fade;g.lineWidth=1.1;
      for(let i=0;i<7;i++){const a=i*TAU/7+q.seed;g.beginPath();g.moveTo(x+Math.cos(a)*r*.2,y+Math.sin(a)*r*.2);g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);g.stroke();}
    }else if(q.type==='ring'||q.type==='rune'){
      const r=q.r*(q.type==='ring'?.15+.85*(1-Math.pow(1-k,3)):1);g.globalAlpha=fade*.7;g.lineWidth=q.type==='rune'?.8:1;g.beginPath();g.ellipse(x,y,r,r*.5,0,0,TAU);g.stroke();
      if(q.type==='rune')for(let i=0;i<8;i++){const a=i*TAU/8+(cfxReduced()?0:age*.45);g.save();g.translate(x+Math.cos(a)*r,y+Math.sin(a)*r*.5);g.rotate(a);g.strokeRect(-2,-2,4,4);g.beginPath();g.moveTo(-1,0);g.lineTo(4,0);g.stroke();g.restore();}
    }else if(q.type==='pillar'){
      const r=q.r*(1-k*.5),hh=q.height*(.5+.5*(1-k)),grad=g.createLinearGradient(x,y,x,y-hh);grad.addColorStop(0,rgbaStr(q.color,.45*fade));grad.addColorStop(1,rgbaStr(q.color,0));g.fillStyle=grad;g.globalAlpha=1;g.beginPath();g.moveTo(x-r,y);g.lineTo(x-r*.2,y-hh);g.lineTo(x+r*.2,y-hh);g.lineTo(x+r,y);g.fill();
    }else if(q.type==='crescent'){
      const a=q.a-(typeof DIORAMA!=='undefined'&&DIORAMA.active?DIORAMA.yaw:0);g.lineWidth=1.8*(1-k)+.4;g.lineCap='round';g.beginPath();g.ellipse(x,y,q.r,q.r*.7,0,a-.8+k*.8,a+.5+k*.8);g.stroke();g.lineWidth=.5;g.globalAlpha=fade*.5;g.beginPath();g.ellipse(x,y,q.r+3,q.r*.7+2,0,a-.7+k*.8,a+.4+k*.8);g.stroke();
    }else if(q.type==='dash'){
      const a=q.a-(typeof DIORAMA!=='undefined'&&DIORAMA.active?DIORAMA.yaw:0);g.lineWidth=2*(1-k);for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(x+Math.cos(a+Math.PI/2)*i*4,y+Math.sin(a+Math.PI/2)*i*4);g.lineTo(x-Math.cos(a)*(12+k*24)+i*4,y-Math.sin(a)*(12+k*24));g.stroke();}
    }else if(q.type==='ghost'){
      g.globalCompositeOperation='screen';g.globalAlpha=fade*.28;drawSprite(g,q.sp,x,y,q.flip,{alpha:fade*.28,scale:q.scale,tint:q.color,tintA:.8});
    }else if(q.type==='bolt'){
      g.lineJoin='round';g.lineCap='round';const points=[];for(let i=0;i<10;i++)points.push([x+(i===9?0:Math.sin(q.seed+i*17.1)*8),y-q.height*(1-i/9)]);
      for(const [width,alpha]of[[7,.08],[3,.28],[.8,1]]){g.lineWidth=width;g.globalAlpha=fade*alpha;g.beginPath();points.forEach(([xx,yy],i)=>i?g.lineTo(xx,yy):g.moveTo(xx,yy));g.stroke();}
    }
    g.restore();
  }
  g.globalCompositeOperation='source-over';g.globalAlpha=1;return CFX.layer;
}
function cfxAtmosphere(g){
  if(!G.p||!G.fl||G.mode!=='play'||CD.settings.lowFx)return;
  const realm=W.on&&!W.inInst&&W.Z,day=realm?daylight():0,night=realm?day<.25:true;
  // Air has a few lit flecks, rather than a noisy full-screen fog sheet.
  const color=night?'#a4d8eb':'#ffe2a5';g.save();g.globalCompositeOperation='lighter';
  for(let i=0;i<(cfxReduced()?5:16);i++){
    const a=hash2(i+71,realm?W.Z.seed:G.fl.idx||0)>>>0,px=G.p.x+(a%350)-175+Math.sin(G.t*.35+i)*9,py=G.p.y+((a>>>10)%220)-110;
    const p=cfxPoint(px,py,8+(Math.sin(G.t*.4+i)+1)*7);g.globalAlpha=(.1+.13*(Math.sin(G.t*.9+i)*.5+.5))*(night?1:.6);g.fillStyle=color;g.beginPath();g.arc(p.x,p.y,.45,0,TAU);g.fill();
  }
  if(realm&&day>.45){
    const sun=1-Math.abs(day-.75)*2;g.globalCompositeOperation='screen';
    for(let i=0;i<3;i++){const x=((G.cam.x*.09+i*157)% (R.VW+190))-95,grad=g.createLinearGradient(x,-30,x+80,R.VH);grad.addColorStop(0,'rgba(255,225,169,'+(Math.max(0,sun)*.026).toFixed(3)+')');grad.addColorStop(1,'rgba(255,225,169,0)');g.fillStyle=grad;g.globalAlpha=1;g.beginPath();g.moveTo(x,-30);g.lineTo(x+25,-30);g.lineTo(x+130,R.VH);g.lineTo(x+50,R.VH);g.fill();}
  }
  g.restore();
}

/* ---------- GPU post-processing: bright pass, two bloom scales, final film ---------- */
const CFX_VS='attribute vec2 a; varying vec2 v; void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
const CFX_BRIGHT=`uniform sampler2D scene;uniform sampler2D fx;uniform vec2 crop;
vec2 sourceUV(vec2 uv){return vec2(uv.x*crop.x,1.-(1.-uv.y)*crop.y);}
void main(){vec2 uv=sourceUV(v);vec4 f=texture2D(fx,uv);vec3 c=texture2D(scene,uv).rgb;float lum=max(c.r,max(c.g,c.b));vec3 b=c*smoothstep(.81,.99,lum)*.22+f.rgb*f.a*1.25;gl_FragColor=vec4(b,1.);}`;
const CFX_BLUR=`uniform sampler2D image;uniform vec2 stepUV;
void main(){vec3 c=texture2D(image,v).rgb*.227027;c+=(texture2D(image,v+stepUV*1.384615).rgb+texture2D(image,v-stepUV*1.384615).rgb)*.316216;c+=(texture2D(image,v+stepUV*3.230769).rgb+texture2D(image,v-stepUV*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}`;
const CFX_COMPOSE=`uniform sampler2D scene;uniform sampler2D fx;uniform sampler2D bloomNear;uniform sampler2D bloomWide;
uniform vec2 crop;uniform vec2 sceneStep;uniform vec2 outputSize;uniform vec3 tint;uniform vec4 waves[6];uniform vec3 pulse;
uniform float exposure;uniform float bloom;uniform float grade;uniform float sharpen;uniform float lens;uniform float grain;uniform float clock;uniform float reduced;
vec2 sourceUV(vec2 uv){return vec2(uv.x*crop.x,1.-(1.-uv.y)*crop.y);}
vec3 colorAt(vec2 uv){return texture2D(scene,sourceUV(clamp(uv,vec2(0.),vec2(1.)))).rgb;}
vec3 film(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
 vec2 uv=v;float aspect=outputSize.x/outputSize.y;
 if(reduced<.5)for(int i=0;i<6;i++){vec2 d=(uv-waves[i].xy)*vec2(aspect,1.);float dist=length(d),ring=exp(-pow((dist-waves[i].z)/.018,2.));uv+=normalize(d+vec2(.00001))*ring*waves[i].w*.0038*vec2(1./aspect,1.)*lens;}
 vec3 c=colorAt(uv);vec3 a=colorAt(uv+vec2(sceneStep.x,0.)),b=colorAt(uv-vec2(sceneStep.x,0.)),d=colorAt(uv+vec2(0.,sceneStep.y)),e=colorAt(uv-vec2(0.,sceneStep.y));
 vec3 lo=min(c,min(min(a,b),min(d,e))),hi=max(c,max(max(a,b),max(d,e)));c=clamp(c+(c*4.-a-b-d-e)*sharpen*.21,lo,hi);
 if(reduced<.5&&pulse.z>.005){vec2 delta=(uv-pulse.xy)*pulse.z*lens*1.1/outputSize; c.r=colorAt(uv+delta).r;c.b=colorAt(uv-delta).b;}
 vec4 f=texture2D(fx,sourceUV(uv));c=c*(1.-f.a)+f.rgb*f.a;
 vec3 glow=texture2D(bloomNear,uv).rgb*.6+texture2D(bloomWide,uv).rgb*.7;
 vec3 streak=texture2D(bloomWide,uv+vec2(.035,0.)).rgb+texture2D(bloomWide,uv-vec2(.035,0.)).rgb;
 vec3 raw=c*exposure+glow*bloom+streak*bloom*lens*.085;
 vec3 mapped=pow(film(pow(max(raw,vec3(0.)),vec3(2.2))*1.05),vec3(1./2.2));c=mix(raw,mapped,grade*.38);
 float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.+grade*.12);c*=mix(vec3(1.),tint,grade);c=(c-.5)*(1.+grade*.04)+.5;
 vec2 q=v*(1.-v);float vignette=clamp(pow(q.x*q.y*16.,.22),0.,1.);c*=mix(1.,.82+.18*vignette,grade);
 if(reduced<.5)c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+clock*.35)*43758.5453)-.5)*grain*.018;
 c+=pulse.z*lens*.012*exp(-length((v-pulse.xy)*vec2(aspect,1.))*4.);
 gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;
function cfxProgram(source){
  const gl=CFX.gl,is2=CFX.gl2,vertex=is2?'#version 300 es\nin vec2 a;out vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}':CFX_VS;
  const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT).precision?'highp':'mediump';
  const fragment=(is2?'#version 300 es\nprecision '+precision+' float;in vec2 v;out vec4 outputColor;\n#define texture2D texture\n#define gl_FragColor outputColor\n':'precision '+precision+' float;varying vec2 v;\n')+source;
  const compile=(type,code)=>{const sh=gl.createShader(type);gl.shaderSource(sh,code);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw Error(msg);}return sh;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  return{p,u:new Map()};
}
function cfxTexture(){const gl=CFX.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function cfxTarget(w,h){const gl=CFX.gl,t=cfxTexture(),f=gl.createFramebuffer();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Bloom target unavailable');return{t,f,w,h};}
function cfxUniform(p,name,type,...args){let u=p.u.get(name);if(u===undefined){u=CFX.gl.getUniformLocation(p.p,name);p.u.set(name,u);}if(u!==null)CFX.gl[type](u,...args);}
function cfxBind(t,unit){const gl=CFX.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
function cfxPass(p,target){const gl=CFX.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.f:null);gl.viewport(0,0,target?target.w:CFX.canvas.width,target?target.h:CFX.canvas.height);gl.useProgram(p.p);gl.bindBuffer(gl.ARRAY_BUFFER,CFX.quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);CFX.stats.passes++;}
function cfxDraw(){CFX.gl.drawArrays(CFX.gl.TRIANGLES,0,6);}
function cfxCanvas(){
  const c=document.createElement('canvas');c.id='cinderfx';c.setAttribute('aria-hidden','true');Object.assign(c.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',display:'block'});R.screen.after(c);return c;
}
function cfxInit(){
  if(!R.screen||CFX.ready||CFX.lost)return;
  if(!CFX.canvas)CFX.canvas=cfxCanvas();
  const c=CFX.canvas;
  try{
    const opts={alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'};
    const gl=c.getContext('webgl2',opts)||c.getContext('webgl',opts);if(!gl)throw Error('WebGL is unavailable');CFX.gl=gl;CFX.gl2=typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext;
    CFX.maxTexture=gl.getParameter(gl.MAX_TEXTURE_SIZE);CFX.programs={bright:cfxProgram(CFX_BRIGHT),blur:cfxProgram(CFX_BLUR),compose:cfxProgram(CFX_COMPOSE)};
    CFX.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,CFX.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    CFX.scene=cfxTexture();CFX.emission=cfxTexture();CFX.targets=[];CFX.renderW=0;CFX.renderH=0;gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);CFX.backend=CFX.gl2?'WebGL 2':'WebGL';CFX.ready=true;CFX.dirty=true;
    if(!c._cfxEvents){c._cfxEvents=true;c.addEventListener('webglcontextlost',e=>{e.preventDefault();CFX.lost=true;CFX.ready=false;c.hidden=true;CFX.backend='Graphics paused · original renderer';});c.addEventListener('webglcontextrestored',()=>{CFX.lost=false;CFX.ready=false;cfxInit();});}
  }catch(e){cfxFallback();}
}
function cfxFallback(){
  if(CFX.backend==='Canvas 2D')return;
  if(CFX.gl&&!CFX.lost){const g=CFX.gl;for(const p of Object.values(CFX.programs))g.deleteProgram(p.p);for(const t of CFX.targets){g.deleteTexture(t.t);g.deleteFramebuffer(t.f);}if(CFX.scene)g.deleteTexture(CFX.scene);if(CFX.emission)g.deleteTexture(CFX.emission);if(CFX.quad)g.deleteBuffer(CFX.quad);}
  CFX.programs={};if(CFX.canvas)CFX.canvas.remove();CFX.canvas=cfxCanvas();CFX.gl=null;CFX.ctx=CFX.canvas.getContext('2d');CFX.backend='Canvas 2D';CFX.ready=true;CFX.lost=false;CFX.targets=[];CFX.renderW=0;CFX.renderH=0;
}
function cfxSize(){
  const preset=cfxConfig(),mode=CD.settings.fxResolution||'adaptive',scale=mode==='native'?1:mode==='quality'?.85:mode==='balanced'?.7:mode==='performance'?.55:CFX.adaptive;
  const maxPixels=Math.min(preset.pixels,R.cssW<600?1250000:2600000),fit=Math.min(1,Math.sqrt(maxPixels/(R.screen.width*R.screen.height))),ratio=scale*fit,w=Math.max(1,Math.round(R.screen.width*ratio)),h=Math.max(1,Math.round(R.screen.height*ratio));
  CFX.stats.scale=ratio;
  if(CFX.canvas.width!==w||CFX.canvas.height!==h){CFX.canvas.width=w;CFX.canvas.height=h;CFX.dirty=true;}
  CFX.canvas.style.imageRendering=CD.settings.fxUpscale==='pixel'?'pixelated':'auto';
  if(!CFX.gl)return;
  if(!CFX.dirty&&CFX.renderW===w&&CFX.renderH===h)return;
  const gl=CFX.gl;for(const t of CFX.targets){gl.deleteTexture(t.t);gl.deleteFramebuffer(t.f);}CFX.targets=[];
  const bw=Math.max(8,Math.min(700,Math.round(w*.42))),bh=Math.max(8,Math.round(h*bw/w));
  CFX.targets.push(cfxTarget(bw,bh),cfxTarget(bw,bh),cfxTarget(Math.max(4,bw>>1),Math.max(4,bh>>1)),cfxTarget(Math.max(4,bw>>1),Math.max(4,bh>>1)));
  CFX.renderW=w;CFX.renderH=h;CFX.dirty=false;
}
function cfxExposure(){
  if(G.t-CFX.lastExposure<1&&G.t>=CFX.lastExposure)return; // reading pixels back stalls the GPU, so sample once a secondCFX.lastExposure=G.t;
  if(!CFX.exposureCanvas)CFX.exposureCanvas=mkCanvas(12,8);
  try{const g=CFX.exposureCanvas.getContext('2d',{willReadFrequently:true});g.drawImage(R.low,0,0,12,8);const d=g.getImageData(0,0,12,8).data;let lum=0;for(let i=0;i<d.length;i+=4)lum+=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255;lum/=96;const target=clamp(1.02+(.28-lum)*.28,.94,1.1);CFX.exposure=lerp(CFX.exposure,target,.18);}catch(e){CFX.exposure=1;}
}
function cfxGrade(){
  if(W.on&&!W.inInst&&W.Z){const id=W.Z.id;if(/caldera|ash/.test(id))return[1.045,.99,.955];if(/glacier|frost|tundra|alpine/.test(id))return[.96,1.01,1.065];if(/void|spore|fey/.test(id))return[1.025,.97,1.055];if(daylight()<.25)return[.95,.995,1.065];return[1.025,1.015,.975];}
  return G.fl&&G.fl.actIdx===2?[.96,1.01,1.055]:G.fl&&G.fl.actIdx===3?[1.05,.98,.95]:[1.02,1.0,.985];
}
function cfxGPU(){
  const gl=CFX.gl,p=CFX.programs,T=CFX.targets,crop=[R.screen.width/(R.VW*R.scale),R.screen.height/(R.VH*R.scale)],layer=cfxLayer();CFX.stats.passes=0;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  cfxBind(CFX.scene,0);const filter=CD.settings.fxUpscale==='pixel'?gl.NEAREST:gl.LINEAR;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,R.low);
  cfxBind(CFX.emission,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,layer);
  cfxPass(p.bright,T[0]);cfxBind(CFX.scene,0);cfxBind(CFX.emission,1);cfxUniform(p.bright,'scene','uniform1i',0);cfxUniform(p.bright,'fx','uniform1i',1);cfxUniform(p.bright,'crop','uniform2f',...crop);cfxDraw();
  const blur=(src,dest,dx,dy)=>{cfxPass(p.blur,dest);cfxBind(src.t,0);cfxUniform(p.blur,'image','uniform1i',0);cfxUniform(p.blur,'stepUV','uniform2f',dx/src.w,dy/src.h);cfxDraw();};
  blur(T[0],T[1],1,0);blur(T[1],T[0],0,1);
  const wide=cfxConfig().mips>1; if(wide){blur(T[0],T[2],2,0);blur(T[2],T[3],0,2);blur(T[3],T[2],2,0);}
  cfxPass(p.compose,null);cfxBind(CFX.scene,0);cfxBind(CFX.emission,1);cfxBind(T[0].t,2);cfxBind((wide?T[2]:T[0]).t,3);
  for(const [name,unit]of[['scene',0],['fx',1],['bloomNear',2],['bloomWide',3]])cfxUniform(p.compose,name,'uniform1i',unit);
  cfxUniform(p.compose,'crop','uniform2f',...crop);cfxUniform(p.compose,'sceneStep','uniform2f',1/(R.VW*crop[0]),1/(R.VH*crop[1]));cfxUniform(p.compose,'outputSize','uniform2f',CFX.canvas.width,CFX.canvas.height);cfxUniform(p.compose,'tint','uniform3f',...cfxGrade());
  cfxUniform(p.compose,'exposure','uniform1f',CFX.exposure);cfxUniform(p.compose,'bloom','uniform1f',clamp(+CD.settings.fxBloom||0,0,1)*cfxConfig().factor);cfxUniform(p.compose,'grade','uniform1f',clamp(+CD.settings.fxGrade||0,0,1));cfxUniform(p.compose,'sharpen','uniform1f',clamp(+CD.settings.fxSharpen||0,0,1));cfxUniform(p.compose,'lens','uniform1f',clamp(+CD.settings.fxLens||0,0,1));cfxUniform(p.compose,'grain','uniform1f',CD.settings.lowFx?0:clamp(+CD.settings.fxGrain||0,0,1));cfxUniform(p.compose,'clock','uniform1f',G.t);cfxUniform(p.compose,'reduced','uniform1f',cfxReduced()?1:0);
  const waves=new Float32Array(24),sw=R.screen.width/R.scale,sh=R.screen.height/R.scale;
  if(!cfxReduced())CFX.waves.forEach((q,i)=>{const v=cfxPoint(q.x,q.y),k=clamp((G.t-q.born)/q.life,0,1);waves.set([v.x/sw,1-v.y/sh,q.r/sh*(.15+.85*k),Math.pow(1-k,2)*q.power],i*4);});cfxUniform(p.compose,'waves[0]','uniform4fv',waves);
  let pulse=[.5,.5,0];if(!cfxReduced()&&CFX.pulse){const q=CFX.pulse,k=clamp((G.t-q.born)/q.life,0,1),v=cfxPoint(q.x,q.y);pulse=[v.x/sw,1-v.y/sh,q.power*(1-k)];}cfxUniform(p.compose,'pulse','uniform3f',...pulse);cfxDraw();
}
function cfxCPU(){
  const g=CFX.ctx,w=CFX.canvas.width,h=CFX.canvas.height,layer=cfxLayer();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=CD.settings.fxUpscale!=='pixel';
  const grade=clamp(+CD.settings.fxGrade||0,0,1);g.filter='saturate('+(1+grade*.12)+') contrast('+(1+grade*.04)+') brightness('+CFX.exposure+')';g.drawImage(R.low,0,0,R.screen.width/R.scale,R.screen.height/R.scale,0,0,w,h);g.filter='none';
  g.save();g.globalCompositeOperation='screen';g.globalAlpha=(+CD.settings.fxBloom||0)*.5;g.filter='blur('+Math.max(2,w/200)+'px)';g.drawImage(layer,0,0,w,h);g.restore();g.drawImage(layer,0,0,w,h);
  const v=g.createRadialGradient(w/2,h/2,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.7);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,'+(grade*.15)+')');g.fillStyle=v;g.fillRect(0,0,w,h);CFX.stats.passes=1;
}
function cfxAdaptive(now){
  const gap=CFX.lastFrame?now-CFX.lastFrame:16.7;CFX.lastFrame=now;if(gap<5||gap>100||UI.top()||DIORAMA.active)return;
  CFX.avg=CFX.avg*.97+gap*.03;
  if(CD.settings.fxResolution!=='adaptive'||now-CFX.adjustAt<4000)return;
  if(CFX.avg>24&&CFX.adaptive>.55){CFX.adaptive=Math.max(.55,CFX.adaptive-.1);CFX.adjustAt=now;CFX.dirty=true;}
  else if(CFX.avg<18&&CFX.adaptive<1){CFX.adaptive=Math.min(1,CFX.adaptive+.05);CFX.adjustAt=now;CFX.dirty=true;}
}
CFX.adaptive=1;
const _blitCFX=blit;
blit=function(){
  _blitCFX();if(!cfxEnabled()){if(CFX.canvas)CFX.canvas.hidden=true;CFX.stats.passes=0;CFX.stats.particles=0;return;}if(CFX.lost)return;
  try{cfxInit();if(!CFX.ready)return;cfxAdaptive(performance.now());cfxSize();cfxExposure();CFX.canvas.hidden=false;if(CFX.gl)cfxGPU();else cfxCPU();}
  catch(e){try{cfxFallback();cfxSize();cfxCPU();}catch(err){if(CFX.canvas)CFX.canvas.hidden=true;CFX.backend='Original renderer';CFX.ready=false;}}
};
const _resizeCFX=resize;
resize=function(){_resizeCFX();CFX.dirty=true;};

/* ---------- graphics controls and an effect preview with no gameplay damage ---------- */
function cfxPreview(){
  if(!G.p)return;if(G.mode==='play')UI.clear();else{UI.title();cfxClear();}const x=G.p.x,y=G.p.y;
  cfxAdd('rune',x,y,{r:48,life:2,color:'#9ee9ef'});cfxAdd('pillar',x,y,{r:28,height:120,life:1.7,color:'#a0e5ff'});
  cfxAdd('bolt',x+38,y-15,{height:170,life:.6,color:'#c6eaff'});cfxAdd('impact',x+38,y-15,{z:8,r:28,life:.5,color:'#a4deff'});
  cfxAdd('rune',x-42,y+8,{r:25,life:1.5,color:'#ffcf91'});cfxSparks(x-42,y+8,'#ffc888',32,1.1);cfxSparks(x+38,y-15,'#c9eaff',25,1.2);cfxWave(x,y,120,.9);CFX.pulse={x,y,born:G.t,life:.4,power:.55};
}
UI.cinema=function(){
  const S=CD.settings,save=()=>{CD.save.settings={...S};persist();CFX.dirty=true;},close=()=>UI.close(el);
  const select=(label,key,items)=>h('label',{class:'set-row'},label,h('select',{'aria-label':label,value:S[key],onchange:e=>{S[key]=e.target.value;save();const preview=el.querySelector('[data-fx-preview]');if(preview)preview.disabled=S.cinema==='off';}},...items.map(([v,text])=>h('option',{value:v,selected:S[key]===v},text))));
  const range=(label,key)=>h('label',{class:'set-row'},label,h('input',{type:'range',min:0,max:1,step:.05,value:S[key]??0,'aria-label':label,oninput:e=>{S[key]=+e.target.value;save();}}));
  const el=h('div',{class:'modal'},h('div',{class:'panel wide cfx-panel'},
    h('p',{style:{fontSize:'12px',letterSpacing:'.16em',color:'#91c7cd'}},'CINDERFX · CINEMATIC PRESENTATION'),h('h2',{},'Light. Motion. Impact.'),
    h('p',{},'Luminous combat, soft light bloom, two-scale glare, filmic color, atmospheric shafts, and impact distortion. The interface stays crisp.'),
    select('Effects preset','cinema',[['off','Original · effects off'],['performance','Performance · light bloom'],['balanced','Balanced · full lighting'],['cinematic','Cinematic · richest effects']]),
    select('Effects resolution','fxResolution',[['adaptive','Adaptive · balances detail and frame time'],['native','Native · highest resolution'],['quality','Quality · 85%'],['balanced','Balanced · 70%'],['performance','Performance · 55%']]),
    select('Spatial upscaling','fxUpscale',[['pixel','Pixel crisp · preserve the original art'],['smooth','Smooth & sharp · softer edges']]),
    h('p',{style:{fontSize:'14px',color:'#b4bfbb'}},'Resolution controls the cinematic layer. Spatial upscaling and sharpening work in the browser; NVIDIA DLSS and AI frame generation are not available in this HTML edition.'),
    range('Bloom & luminous glare','fxBloom'),range('Filmic color grade','fxGrade'),range('Edge sharpening','fxSharpen'),range('Lens effects & shockwaves','fxLens'),range('Fine film grain','fxGrain'),
    h('label',{class:'set-row'},'Reduced motion · no distortion or chromatic pulses',h('input',{type:'checkbox',checked:S.fxReduced,'aria-label':'Reduced motion',onchange:e=>{S.fxReduced=e.target.checked;save();}})),
    h('p',{style:{fontSize:'14px',color:'#a7c8be'}},'Renderer: '+CFX.backend+' · Current effects resolution: '+Math.round(CFX.stats.scale*100)+'%. Fewer effects in Settings also lowers this pipeline’s workload.'),
    h('div',{class:'row'},btn('Preview effects in the world',cfxPreview,'primary',{disabled:S.cinema==='off','data-fx-preview':''}),btn('Done',close))));
  UI.open(el,{modal:G.mode==='play',replace:false,onBack:close});
};
document.head.append(h('style',{},'#ui .cfx-panel{width:min(760px,100%);min-width:0;overflow-x:hidden}#ui .cfx-panel h2{font-size:clamp(30px,5vw,46px);line-height:1.08;overflow-wrap:break-word}#ui .cfx-panel p{min-width:0;white-space:normal;overflow-wrap:break-word}#ui .cfx-panel .set-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:10px;min-width:0}#ui .cfx-panel select,#ui .cfx-panel input[type=range]{width:100%;max-width:100%;min-width:0;font-size:16px}#ui .cfx-panel input[type=checkbox]{justify-self:end}#ui .cfx-panel .row{flex-wrap:wrap}#ui .cfx-panel .row .btn{flex:1 1 160px;min-width:0;white-space:normal;text-align:center}@media(max-width:600px){#ui .cfx-panel .set-row{grid-template-columns:minmax(0,1fr);gap:7px}#ui .cfx-panel input[type=checkbox]{justify-self:start}#ui .cfx-panel .row .btn{flex-basis:100%}}'));
settingsRow('cinema',10,()=>btn('CinderFX · Cinema & upscaling',()=>UI.cinema(),'primary'),true);
pauseItem('cinema',150,()=>btn('CinderFX · Cinema & upscaling',()=>UI.cinema()));
CD.cinema={open:()=>UI.cinema(),preview:cfxPreview,get status(){return{backend:CFX.backend,profile:CD.settings.cinema,resolution:Math.round(CFX.stats.scale*100),upscaling:CD.settings.fxUpscale,particles:CFX.stats.particles,passes:CFX.stats.passes,reduced:!!cfxReduced()};}};

