(() => {
'use strict';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
const $ = (id) => document.getElementById(id);
const W = 640, H = 360, WORLD = 2200, FLOOR = 286;
const keys = new Set();
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);

let mode = 'arena', lastTime = 0, elapsed = 0, toastTime = 0;
let camera = 0, shake = 0, xp = 0, level = 1;
let enemies = [], projectiles = [], particles = [], floatingTexts = [];
let backgroundStars = Array.from({length: 36}, () => ({x:rand(0,W),y:rand(12,175),s:rand(1,2),p:rand(0,6)}));

const player = {
  x: 130, y: FLOOR - 52, vx: 0, vy: 0, w: 30, h: 52, face: 1,
  hp: 100, maxHp: 100, ki: 100, maxKi: 100, charge: 0,
  onGround: true, attack: 0, attackCooldown: 0, invuln: 0,
  walk: 0, hurt: 0
};

function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  toastTime = 1.8;
}
function burst(x, y, color, count, force = 1) {
  for (let i=0; i<count; i++) {
    const a = rand(0, Math.PI*2), speed = rand(.7, 3.4)*force;
    particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:rand(.22,.65),maxLife:.65,color,size:rand(1,3)});
  }
}
function floatText(x,y,text,color='#fff0a8') {
  floatingTexts.push({x,y,text,color,life:.85});
}
function makeEnemy(x, dummy=false) {
  return {
    x, y:FLOOR-(dummy?54:48), w:dummy?34:30, h:dummy?54:48,
    hp:dummy?999:65, maxHp:dummy?999:65, face:-1, speed:dummy?0:rand(42,57),
    attack:0, cooldown:rand(.55,1.1), hit:0, walk:0, alive:true, dummy
  };
}
function setMode(next) {
  mode=next; enemies=[]; projectiles=[]; particles=[]; floatingTexts=[];
  player.hp=player.maxHp; player.ki=player.maxKi; player.charge=0;
  player.x=130; player.y=FLOOR-player.h; player.vx=player.vy=0;
  player.attack=0; player.invuln=0; player.onGround=true;
  enemies.push(makeEnemy(next==='arena'?470:430,next==='training'));
  $('modeLabel').textContent=next==='arena'?'CAMPO DE BATALHA':'ÁREA DE TREINAMENTO';
  $('arenaBtn').classList.toggle('active',next==='arena');
  $('trainBtn').classList.toggle('active',next==='training');
  notify(next==='arena'?'Prepare-se para lutar!':'Treinamento iniciado');
  updateHud();
}
$('arenaBtn').addEventListener('click',()=>setMode('arena'));
$('trainBtn').addEventListener('click',()=>setMode('training'));

function jump() {
  if (player.onGround && player.hp>0) {
    player.vy=-510; player.onGround=false;
    burst(player.x, FLOOR-4, '#d6b78b', 7, .6);
  }
}
function melee() {
  if (player.attackCooldown>0 || player.hp<=0) return;
  player.attack=.28; player.attackCooldown=.38;
  let hitAny=false;
  for (const e of enemies) {
    if (!e.alive || e.dummy && mode!=='training') continue;
    const dx=e.x-player.x;
    if (Math.abs(dx)<62 && Math.abs(e.y-player.y)<55 && (Math.sign(dx)===player.face || Math.abs(dx)<18)) {
      damageEnemy(e,14+level*2); hitAny=true;
    }
  }
  if (!hitAny) burst(player.x+player.face*32,player.y-25,'#ffc66b',3,.5);
}
function damageEnemy(e, amount) {
  if (e.dummy) {
    xp+=2; player.ki=Math.min(player.maxKi,player.ki+1);
    e.hit=.13; burst(e.x,e.y-25,'#ffd66e',5,.65); floatText(e.x,e.y-65,'+2 EXP');
    return;
  }
  e.hp-=amount; e.hit=.18; e.x+=player.face*5; shake=3;
  burst(e.x,e.y-24,'#ffb36a',9,1.1); floatText(e.x,e.y-62,'-'+amount,'#ffe4a0');
  if(e.hp<=0) {
    e.alive=false; xp+=25; player.ki=Math.min(player.maxKi,player.ki+18);
    burst(e.x,e.y-20,'#ff9d50',22,1.5); floatText(e.x,e.y-75,'+25 EXP');
    notify('Adversário derrotado!');
    if(xp>=level*100) {
      xp-=level*100; level++; player.maxHp+=10; player.maxKi+=10;
      player.hp=player.maxHp; player.ki=player.maxKi;
      notify('NÍVEL '+level+' — poder aumentado!');
      burst(player.x,player.y-25,'#ffe77a',28,1.6);
    }
  }
}
function fireKi() {
  const amount=Math.min(player.charge,player.ki);
  player.charge=0;
  if(amount<8) return;
  player.ki-=amount;
  const radius=6+amount*.19;
  projectiles.push({
    x:player.x+player.face*24,y:player.y-31,
    vx:player.face*(390+amount*2.2),r:radius,
    damage:Math.round(amount*.82)+9,life:2.6,phase:rand(0,6)
  });
  burst(player.x+player.face*25,player.y-31,'#7ceaff',18,1.4);
  shake=2;
}
window.addEventListener('keydown',(event)=>{
  const key=event.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) event.preventDefault();
  if(!keys.has(key)) {
    if(key==='w'||key==='arrowup'||key===' ') jump();
    if(key==='k') melee();
  }
  keys.add(key);
});
window.addEventListener('keyup',(event)=>{
  const key=event.key.toLowerCase(); keys.delete(key);
  if(key==='j' && player.charge>0) fireKi();
});
window.addEventListener('blur',()=>{
  keys.clear();
  if(player.charge>0) fireKi();
});

function update(dt) {
  elapsed+=dt;
  player.invuln=Math.max(0,player.invuln-dt);
  player.hurt=Math.max(0,player.hurt-dt);
  player.attack=Math.max(0,player.attack-dt);
  player.attackCooldown=Math.max(0,player.attackCooldown-dt);
  player.ki=Math.min(player.maxKi,player.ki+(mode==='training'?11:4.5)*dt);

  if(player.hp>0) {
    const direction=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    const speed=keys.has('shift')?230:155;
    player.vx=direction*speed;
    if(direction) player.face=direction;
    player.x=clamp(player.x+player.vx*dt,18,WORLD-24);
    player.walk+=Math.abs(player.vx)*dt*.075;
    player.vy+=1450*dt;
    player.y+=player.vy*dt;
    if(player.y>=FLOOR-player.h){player.y=FLOOR-player.h;player.vy=0;player.onGround=true;}
    if(keys.has('j')&&player.ki>0) {
      player.charge=Math.min(player.ki,player.charge+38*dt);
      if(Math.random()<dt*22) burst(player.x+rand(-13,13),player.y-35+rand(-8,8),'#8ceaff',1,.5);
    }
  } else { player.vx=0; }

  for(const e of enemies) {
    if(!e.alive) continue;
    e.hit=Math.max(0,e.hit-dt); e.attack=Math.max(0,e.attack-dt);
    if(e.dummy) continue;
    const dx=player.x-e.x, dist=Math.abs(dx);
    e.face=Math.sign(dx)||1;
    if(dist>43) {
      e.x+=Math.sign(dx)*e.speed*dt;
      e.walk+=e.speed*dt*.075;
    } else {
      e.cooldown-=dt;
      if(e.cooldown<=0&&player.hp>0&&player.invuln<=0) {
        e.cooldown=1.35; e.attack=.34;
        player.hp=Math.max(0,player.hp-8);
        player.invuln=.58; player.hurt=.2; shake=5;
        burst(player.x,player.y-28,'#ff6868',10,1.1);
        if(player.hp<=0) { player.charge=0; keys.delete('j'); notify('Você foi derrotado — reinicie o modo.'); }
      }
    }
  }

  for(const p of projectiles) {
    p.x+=p.vx*dt; p.life-=dt; p.phase+=dt*8;
    for(const e of enemies) {
      if(!e.alive) continue;
      if(Math.abs(p.x-e.x)<p.r+e.w*.48 && Math.abs(p.y-(e.y-e.h*.5))<p.r+e.h*.5) {
        damageEnemy(e,p.damage); p.life=0; break;
      }
    }
  }
  projectiles=projectiles.filter(p=>p.life>0&&p.x>-40&&p.x<WORLD+40);
  for(const p of particles) {p.x+=p.vx*60*dt;p.y+=p.vy*60*dt;p.vy+=.12*dt*60;p.life-=dt;}
  particles=particles.filter(p=>p.life>0);
  for(const t of floatingTexts){t.y-=35*dt;t.life-=dt;}
  floatingTexts=floatingTexts.filter(t=>t.life>0);
  if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show');}
  if(mode==='arena'&&player.hp>0&&enemies.every(e=>!e.alive)) {
    enemies.push(makeEnemy(clamp(player.x+340,250,WORLD-80)));
    notify('Um novo adversário se aproxima!');
  }
  camera=clamp(player.x-W*.43,0,WORLD-W);
  updateHud();
}
function updateHud() {
  $('hpText').textContent=Math.ceil(player.hp)+' / '+player.maxHp;
  $('kiText').textContent=Math.floor(player.ki)+' / '+player.maxKi;
  $('hpBar').style.width=(player.hp/player.maxHp*100)+'%';
  $('kiBar').style.width=(player.ki/player.maxKi*100)+'%';
  $('level').textContent=level; $('xpText').textContent=xp;
  $('xpBar').style.width=(xp/(level*100)*100)+'%';
  $('enemyCount').textContent=enemies.filter(e=>e.alive&&!e.dummy).length;
  $('powerText').textContent=10+(level-1)*2;
  $('chargeText').textContent=Math.floor(player.charge)+'%';
}

function pixelRect(x,y,w,h,color) {ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function polygon(points,color) {
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
  ctx.closePath();ctx.fill();
}
function drawBackground() {
  const sky=ctx.createLinearGradient(0,0,0,FLOOR);
  sky.addColorStop(0,'#172b52');sky.addColorStop(.58,'#527b9a');sky.addColorStop(1,'#e6a76c');
  pixelRect(0,0,W,H,'#172b52');ctx.fillStyle=sky;ctx.fillRect(0,0,W,FLOOR);
  // distant sun and atmospheric glow
  ctx.globalAlpha=.24;ctx.fillStyle='#ffd58a';ctx.beginPath();ctx.arc(500-camera*.035,118,48,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle='#ffe2a2';ctx.beginPath();ctx.arc(500-camera*.035,118,21,0,Math.PI*2);ctx.fill();
  for(const s of backgroundStars){const x=(s.x-camera*.08+W*2)%(W+20)-10;ctx.globalAlpha=.35+Math.sin(elapsed*1.5+s.p)*.25;pixelRect(x,s.y,s.s,s.s,'#e8f3ff');}
  ctx.globalAlpha=1;
  // layered mountains
  polygon([[-30,224],[45,150],[92,198],[160,128],[240,210],[318,151],[398,207],[470,143],[555,211],[640,160],[680,230]],'#526c78');
  polygon([[-20,232],[70,183],[128,218],[222,169],[295,229],[382,181],[465,225],[555,176],[660,230]],'#354f5d');
  polygon([[0,242],[70,220],[145,240],[225,210],[320,244],[420,215],[510,241],[590,212],[660,244]],'#263f4c');
  // plateau and ground
  pixelRect(0,246,W,40,'#ad835b');pixelRect(0,246,W,4,'#e4b77a');
  for(let i=0;i<28;i++){const x=((i*43-camera*.55)%W+W)%W;pixelRect(x,254+(i%4)*6,rand(7,16),2,i%2?'#966e50':'#c29466');}
  pixelRect(0,FLOOR,W,H-FLOOR,'#68483d');pixelRect(0,FLOOR,W,5,'#e4b16d');
  for(let i=0;i<34;i++){const x=((i*37-camera)%W+W)%W;pixelRect(x,FLOOR+12+(i%5)*9,rand(5,12),2,'#8b5e49');}
  // rocks and sparse grass
  for(let i=0;i<8;i++){const x=((i*113-camera*.72)%760+760)%760-40;pixelRect(x,FLOOR-9,18,8,'#79604d');pixelRect(x+4,FLOOR-14,10,6,'#92765a');}
}
function drawAura(x,y,r,color,phase=elapsed) {
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<3;i++){
    ctx.globalAlpha=.12-i*.025;ctx.strokeStyle=color;ctx.lineWidth=2+i;
    ctx.beginPath();ctx.ellipse(x,y, r+i*5+Math.sin(phase*5+i)*3,r*1.45+i*5,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
}
function drawFighter(entity,isPlayer=false) {
  const x=Math.round(entity.x-camera), y=Math.round(entity.y);
  const face=entity.face||1;
  const moving=Math.abs(entity.vx||0)>10 || (!isPlayer&&!entity.dummy&&entity.walk>0);
  const phase=entity.walk||0;
  const bob=entity.onGround===false?0:Math.sin(phase*2)* (moving?2.1:1);
  const stride=moving?Math.sin(phase*2.3)*5:0;
  const attacking=(entity.attack||0)>0;
  const charging=isPlayer&&player.charge>0;
  ctx.save();ctx.translate(x,y+bob);ctx.scale(face,1);
  if(isPlayer&&player.invuln>0&&Math.floor(elapsed*18)%2===0)ctx.globalAlpha=.45;
  if(entity.hit>0||isPlayer&&player.hurt>0)ctx.globalAlpha=.6;
  if(charging)drawAura(0,-30,18+player.charge*.12,'#62dfff');
  // ground shadow
  ctx.globalAlpha*=.75;ctx.fillStyle='#17212c';ctx.beginPath();ctx.ellipse(0,3,20,5,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // legs with running / idle poses
  const pants=isPlayer?'#263c67':'#343b4c', boots=isPlayer?'#e6b64d':'#c2a17b';
  pixelRect(-12,31+stride*.25,10,15,pants);pixelRect(3,31-stride*.25,10,15,pants);
  pixelRect(-14+stride*.3,44+stride*.25,13,6,boots);pixelRect(1-stride*.3,44-stride*.25,14,6,boots);
  pixelRect(-13,30,25,4,isPlayer?'#f0c34d':'#a8a0a0');
  // torso, gi and belt
  pixelRect(-14,8,28,27,isPlayer?'#e66a27':'#9e493e');
  pixelRect(-17,12,7,18,isPlayer?'#f0a044':'#7b3436');
  pixelRect(10,12,7,18,isPlayer?'#f0a044':'#7b3436');
  pixelRect(-14,31,28,5,isPlayer?'#263d73':'#d2c2a3');
  pixelRect(-3,31,7,5,isPlayer?'#f4cb61':'#9e493e');
  pixelRect(-4,13,8,19,isPlayer?'#f38a35':'#b95b4b');
  // arms; attacking arm extends into a punch
  if(attacking){
    pixelRect(9,13,13,7,isPlayer?'#efbd8b':'#c99a76');
    pixelRect(19,12,8,9,isPlayer?'#f4c69a':'#d1a17d');
  } else {
    const armSwing=moving?Math.sin(phase*2.3)*3:0;
    pixelRect(-20,14+armSwing,7,16,isPlayer?'#e9b98e':'#c99a76');
    pixelRect(13,14-armSwing,7,16,isPlayer?'#e9b98e':'#c99a76');
    pixelRect(-21,27+armSwing,8,7,isPlayer?'#f0c39b':'#d2a17f');
    pixelRect(14,27-armSwing,8,7,isPlayer?'#f0c39b':'#d2a17f');
  }
  // neck, face, hair silhouette
  pixelRect(-5,3,10,8,'#d99f78');pixelRect(-12,-13,24,20,isPlayer?'#e7b48d':'#bd8d70');
  pixelRect(-13,-17,26,9,isPlayer?'#202332':'#4b2c2c');
  pixelRect(-15,-12,8,9,isPlayer?'#202332':'#4b2c2c');
  pixelRect(-10,-22,8,9,isPlayer?'#202332':'#4b2c2c');
  pixelRect(0,-24,8,11,isPlayer?'#202332':'#4b2c2c');
  pixelRect(8,-18,8,10,isPlayer?'#202332':'#4b2c2c');
  pixelRect(7,-8,5,3,'#29212a');pixelRect(1,-7,4,2,'#29212a');
  pixelRect(11,-1,3,2,'#7b443b');
  if(isPlayer){pixelRect(-14,4,28,3,'#f5d05d');}
  ctx.restore();
}
function draw() {
  ctx.save();
  if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake,shake));shake=Math.max(0,shake-22/60);}
  drawBackground();
  // drifting dust motes
  for(let i=0;i<12;i++){const x=((i*61-elapsed*13-camera*.3)%W+W)%W;ctx.globalAlpha=.2;pixelRect(x,230+(i*17)%45,2,2,'#ffe0a5');}
  ctx.globalAlpha=1;
  for(const e of enemies){
    if(!e.alive)continue;
    drawFighter(e,false);
    if(!e.dummy){
      const bx=e.x-camera-18,by=e.y-e.h-19;
      pixelRect(bx,by,36,5,'#241f2c');pixelRect(bx+1,by+1,34*(e.hp/e.maxHp),3,'#f16c5b');
    } else {
      pixelRect(e.x-camera-12,e.y-e.h-13,24,4,'#29222a');
      pixelRect(e.x-camera-11,e.y-e.h-12,22,2,'#ffd56a');
    }
  }
  drawFighter(player,true);
  // ki projectiles with trails
  for(const p of projectiles){
    const x=p.x-camera;
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=3;i>=0;i--){ctx.globalAlpha=.08+i*.035;ctx.fillStyle='#54dfff';ctx.beginPath();ctx.arc(x-p.vx/Math.abs(p.vx)*i*7,p.y,p.r*(1+i*.12),0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;ctx.fillStyle='#7ceaff';ctx.beginPath();ctx.arc(x,p.y,p.r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#eaffff';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-p.r*.25,p.y-p.r*.25,p.r*.28,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  for(const p of particles){ctx.globalAlpha=clamp(p.life/p.maxLife,0,1);pixelRect(p.x-camera,p.y,p.size,p.size,p.color);}
  ctx.globalAlpha=1;
  for(const t of floatingTexts){ctx.globalAlpha=clamp(t.life,0,1);ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillStyle='#30212a';ctx.fillText(t.text,t.x-camera+1,t.y+1);ctx.fillStyle=t.color;ctx.fillText(t.text,t.x-camera,t.y);}
  ctx.globalAlpha=1;
  if(player.charge>0){
    const width=170,x=(W-width)/2,y=H-24;
    pixelRect(x-2,y-2,width+4,9,'#17283c');pixelRect(x,y,width,5,'#32485c');
    pixelRect(x,y,width*player.charge/player.maxKi,5,'#63dfff');
    ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillStyle='#e8faff';ctx.fillText('CONCENTRANDO KI',W/2,y-5);
  }
  if(player.hp<=0){
    ctx.fillStyle='#101725aa';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';ctx.font='bold 25px monospace';ctx.fillStyle='#ffcf83';ctx.fillText('DERROTADO',W/2,H/2);
    ctx.font='10px monospace';ctx.fillStyle='#fff';ctx.fillText('Troque de modo para recomeçar',W/2,H/2+22);
  }
  ctx.restore();
}
function frame(time) {
  const dt=lastTime?Math.min((time-lastTime)/1000,.033):0;
  lastTime=time;update(dt);draw();requestAnimationFrame(frame);
}
setMode('arena');
requestAnimationFrame(frame);
})();