(() => {
'use strict';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const $ = (id) => document.getElementById(id);
const W = 640, H = 360, TILE = 32;
const AREA_W = 1120, AREA_H = 720;
const keys = new Set();
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const normalize = (x,y) => { const l=Math.hypot(x,y)||1; return {x:x/l,y:y/l}; };

const areas = [
  {name:'PLANÍCIE DO INÍCIO',subtitle:'Uma região aberta. Aprenda a ler os movimentos dos inimigos.',ground:'#78934e',groundDark:'#607b40',accent:'#d8bd72',wall:'#50643b',kind:'plains',spawns:[['fighter',650,300],['shooter',820,470],['fighter',950,260]]},
  {name:'FLORESTA DAS SOMBRAS',subtitle:'A vegetação esconde adversários que atacam à distância.',ground:'#42694c',groundDark:'#31543d',accent:'#8cae69',wall:'#284334',kind:'forest',spawns:[['charger',550,260],['shooter',740,450],['fighter',920,320],['charger',980,520]]},
  {name:'DESFILADEIRO RUBRO',subtitle:'Inimigos mais resistentes guardam a passagem.',ground:'#a56e4e',groundDark:'#80513e',accent:'#e0a46c',wall:'#6e4036',kind:'canyon',spawns:[['fighter',530,260],['charger',720,470],['shooter',910,280],['fighter',960,520]]}
];
const obstacles = [
  [{x:260,y:170,w:75,h:56,type:'rock'},{x:430,y:490,w:90,h:64,type:'rock'},{x:690,y:180,w:54,h:72,type:'rock'},{x:880,y:530,w:110,h:55,type:'rock'}],
  [{x:230,y:190,w:90,h:100,type:'tree'},{x:420,y:430,w:100,h:110,type:'tree'},{x:630,y:150,w:90,h:100,type:'tree'},{x:860,y:390,w:105,h:110,type:'tree'},{x:980,y:170,w:70,h:90,type:'tree'}],
  [{x:250,y:180,w:95,h:70,type:'rock'},{x:420,y:480,w:115,h:80,type:'rock'},{x:680,y:160,w:100,h:80,type:'rock'},{x:860,y:460,w:110,h:90,type:'rock'}]
];
let areaIndex=0, area=areas[0], camera={x:0,y:0}, elapsed=0, lastTime=0;
let particles=[], texts=[], projectiles=[], enemyProjectiles=[], shake=0, toastTime=0;
let level=1, xp=0, defeated=0, gameOver=false;
const player={x:105,y:360,r:12,hp:100,maxHp:100,ki:100,maxKi:100,face:{x:1,y:0},walk:0,attack:0,attackCd:0,charge:0,invuln:0,dodge:0,dodgeCd:0,hurt:0};

function notify(message){$('toast').textContent=message;$('toast').classList.add('show');toastTime=2.2;}
function burst(x,y,color,count=8,power=1){
  for(let i=0;i<count;i++){const a=rand(0,Math.PI*2),s=rand(25,145)*power;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.7),max:.7,color,size:rand(2,4)});}
}
function floatText(x,y,text,color='#fff0a8'){texts.push({x,y,text,color,life:.9});}
function makeEnemy(type,x,y){
 const base={fighter:{hp:48,speed:76,damage:9,color:'#bd5d48',name:'LUTADOR',radius:13},shooter:{hp:38,speed:52,damage:7,color:'#597fc2',name:'ATIRADOR',radius:12},charger:{hp:58,speed:62,damage:13,color:'#b68b48',name:'INVESTIDOR',radius:14}}[type];
 return {...base,type,x,y,maxHp:base.hp,face:{x:-1,y:0},state:'approach',timer:rand(.3,.9),attackCd:rand(.7,1.4),walk:0,hit:0,alive:true,shot:0,dash:{x:0,y:0}};
}
let enemies=[];
function spawnArea(index){
 areaIndex=index;area=areas[index];enemies=area.spawns.map(s=>makeEnemy(s[0],s[1],s[2]));
 projectiles=[];enemyProjectiles=[];particles=[];texts=[];
 player.x= index===0?105:75; player.y=360; player.invuln=.8;
 $('modeLabel').textContent=area.name;
 notify('ÁREA: '+area.name);
}
function setMode(next){
 // The old buttons remain useful as quick resets for combat and practice.
 gameOver=false;player.hp=player.maxHp;player.ki=player.maxKi;player.charge=0;player.dodgeCd=0;
 spawnArea(next==='training'?0:0);
 if(next==='training'){enemies=[makeEnemy('fighter',520,360)];enemies[0].hp=enemies[0].maxHp=999;enemies[0].training=true;notify('Treinamento: alvo de prática');}
 $('arenaBtn').classList.toggle('active',next==='arena');$('trainBtn').classList.toggle('active',next==='training');
}
$('arenaBtn').addEventListener('click',()=>setMode('arena'));
$('trainBtn').addEventListener('click',()=>setMode('training'));

function collides(x,y,r){
 if(x<r||y<r||x>AREA_W-r||y>AREA_H-r)return true;
 return obstacles[areaIndex].some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);
}
function moveEntity(entity,dx,dy,r){
 if(!collides(entity.x+dx,entity.y,r))entity.x+=dx;
 if(!collides(entity.x,entity.y+dy,r))entity.y+=dy;
}
function enterNextArea(){
 if(areaIndex>=areas.length-1){notify('Você chegou ao fim desta jornada!');return;}
 if(enemies.some(e=>e.alive)){notify('Derrote os inimigos antes de avançar.');player.x=AREA_W-75;return;}
 spawnArea(areaIndex+1);
}
function melee(){
 if(player.attackCd>0||gameOver)return;
 player.attack=.26;player.attackCd=.38;
 const center={x:player.x+player.face.x*27,y:player.y+player.face.y*27};
 let hit=false;
 for(const e of enemies){
  if(!e.alive)continue;
  const dx=e.x-player.x,dy=e.y-player.y,dist=Math.hypot(dx,dy);
  const dot=(dx*player.face.x+dy*player.face.y)/(dist||1);
  if(dist<57&&dot>.12){damageEnemy(e,16+(level-1)*2);hit=true;}
 }
 burst(center.x,center.y,hit?'#ffd36b':'#f4c17a',hit?9:4,.65);
}
function damageEnemy(e,amount){
 if(e.training){e.hit=.15;xp+=1;player.ki=Math.min(player.maxKi,player.ki+1);floatText(e.x,e.y-20,'+1 EXP');burst(e.x,e.y,'#ffd56c',5);return;}
 e.hp-=amount;e.hit=.18;e.state='stagger';e.timer=.12;shake=3;
 burst(e.x,e.y,e.type==='shooter'?'#91caff':'#ffc078',9,1);
 floatText(e.x,e.y-22,'-'+amount,'#fff0ad');
 if(e.hp<=0){e.alive=false;xp+=22;defeated++;player.ki=Math.min(player.maxKi,player.ki+12);burst(e.x,e.y,'#ffb45d',18,1.4);floatText(e.x,e.y-34,'+22 EXP');}
 if(xp>=level*100){xp-=level*100;level++;player.maxHp+=8;player.maxKi+=8;player.hp=player.maxHp;player.ki=player.maxKi;notify('NÍVEL '+level+' — seus atributos aumentaram!');burst(player.x,player.y,'#ffe57a',24,1.5);}
}
function launchPlayerKi(){
 const amount=Math.min(player.charge,player.ki);player.charge=0;
 if(amount<7)return;
 player.ki-=amount;
 const speed=330+amount*2.2,dir=player.face;
 projectiles.push({x:player.x+dir.x*19,y:player.y+dir.y*19,vx:dir.x*speed,vy:dir.y*speed,r:5+amount*.13,damage:Math.round(amount*.7)+10,life:2.2,phase:0});
 burst(player.x+dir.x*20,player.y+dir.y*20,'#78e8ff',14,1.1);
}
function dodge(){
 if(player.dodgeCd>0||gameOver)return;
 player.dodge=.2;player.dodgeCd=.85;player.invuln=Math.max(player.invuln,.24);
 burst(player.x,player.y,'#d9e6ee',8,.7);
}
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();
 if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
 if(!keys.has(k)){if(k==='k')melee();if(k===' '||k==='shift')dodge();}
 keys.add(k);
});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();keys.delete(k);if(k==='j'&&player.charge>0)launchPlayerKi();});
window.addEventListener('blur',()=>{keys.clear();if(player.charge>0)launchPlayerKi();});

function enemyAttack(e,dt){
 const dx=player.x-e.x,dy=player.y-e.y,dist=Math.hypot(dx,dy)||1;
 e.face={x:dx/dist,y:dy/dist};
 if(e.state==='stagger'){e.timer-=dt;if(e.timer<=0)e.state='approach';return;}
 if(e.type==='fighter'){
  if(e.state==='windup'){
   e.timer-=dt;if(e.timer<=0){e.state='recover';e.timer=.5;burst(e.x+e.face.x*25,e.y+e.face.y*25,'#ffb16b',9);if(dist<62&&player.invuln<=0)hurtPlayer(e.damage);}
  }else if(e.state==='recover'){e.timer-=dt;if(e.timer<=0)e.state='approach';}
  else if(dist<49&&e.attackCd<=0){e.state='windup';e.timer=.48;e.attackCd=1.25;}
  else if(dist>37){moveEntity(e,e.face.x*e.speed*dt,e.face.y*e.speed*dt,e.radius);e.walk+=dt*7;}
 }else if(e.type==='shooter'){
  if(e.state==='shoot'){
   e.timer-=dt;if(e.timer<=0){e.state='approach';const d=normalize(dx,dy);enemyProjectiles.push({x:e.x+d.x*18,y:e.y+d.y*18,vx:d.x*185,vy:d.y*185,r:6,damage:e.damage,life:3});burst(e.x+d.x*18,e.y+d.y*18,'#9bd4ff',7);}
  }else{
   if(dist<170){moveEntity(e,-e.face.x*e.speed*.65*dt,-e.face.y*e.speed*.65*dt,e.radius);}
   else if(dist>255){moveEntity(e,e.face.x*e.speed*.7*dt,e.face.y*e.speed*.7*dt,e.radius);}
   if(e.attackCd<=0&&dist<360){e.state='shoot';e.timer=.55;e.attackCd=1.8;}
  }
 }else if(e.type==='charger'){
  if(e.state==='telegraph'){
   e.timer-=dt;if(e.timer<=0){e.state='dash';e.timer=.28;e.dash={...e.face};burst(e.x,e.y,'#ffd17b',12,1);}
  }else if(e.state==='dash'){
   moveEntity(e,e.dash.x*310*dt,e.dash.y*310*dt,e.radius);
   if(dist<32&&player.invuln<=0)hurtPlayer(e.damage);
   e.timer-=dt;if(e.timer<=0){e.state='recover';e.timer=.7;}
  }else if(e.state==='recover'){e.timer-=dt;if(e.timer<=0)e.state='approach';}
  else if(dist<245&&e.attackCd<=0){e.state='telegraph';e.timer=.72;e.attackCd=2.1;}
  else if(dist>70){moveEntity(e,e.face.x*e.speed*dt,e.face.y*e.speed*dt,e.radius);e.walk+=dt*6;}
 }
}
function hurtPlayer(amount){
 if(player.invuln>0||gameOver)return;
 player.hp=Math.max(0,player.hp-amount);player.invuln=.65;player.hurt=.2;shake=5;
 burst(player.x,player.y,'#ff6868',12,1);floatText(player.x,player.y-25,'-'+amount,'#ff9b91');
 if(player.hp<=0){gameOver=true;player.charge=0;notify('Você foi derrotado. Use Combate para recomeçar.');}
}
function update(dt){
 elapsed+=dt;
 player.attack=Math.max(0,player.attack-dt);player.attackCd=Math.max(0,player.attackCd-dt);
 player.invuln=Math.max(0,player.invuln-dt);player.hurt=Math.max(0,player.hurt-dt);
 player.dodge=Math.max(0,player.dodge-dt);player.dodgeCd=Math.max(0,player.dodgeCd-dt);
 player.ki=Math.min(player.maxKi,player.ki+(areaIndex===0?5:3.5)*dt);
 if(!gameOver){
  let ix=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
  let iy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
  const input=normalize(ix,iy),moving=ix!==0||iy!==0;
  if(moving){player.face={...input};player.walk+=dt*(player.dodge>0?18:10);}
  const speed=player.dodge>0?440:keys.has('shift')?185:135;
  if(moving)moveEntity(player,input.x*speed*dt,input.y*speed*dt,player.r);
  if(keys.has('j')&&player.ki>0){player.charge=Math.min(player.ki,player.charge+42*dt);if(Math.random()<dt*18)burst(player.x+rand(-10,10),player.y+rand(-10,10),'#82eaff',1,.4);}
  for(const e of enemies){if(!e.alive)continue;e.attackCd-=dt;e.hit=Math.max(0,e.hit-dt);enemyAttack(e,dt);}
 }
 for(const p of projectiles){
  p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.phase+=dt*8;
  for(const e of enemies){if(!e.alive)continue;if(Math.hypot(p.x-e.x,p.y-e.y)<p.r+e.radius){damageEnemy(e,p.damage);p.life=0;break;}}
 }
 projectiles=projectiles.filter(p=>p.life>0);
 for(const p of enemyProjectiles){
  p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
  if(Math.hypot(p.x-player.x,p.y-player.y)<p.r+player.r){hurtPlayer(p.damage);p.life=0;}
 }
 enemyProjectiles=enemyProjectiles.filter(p=>p.life>0);
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.1,dt);p.vy*=Math.pow(.1,dt);p.life-=dt;}
 particles=particles.filter(p=>p.life>0);
 for(const t of texts){t.y-=28*dt;t.life-=dt;}texts=texts.filter(t=>t.life>0);
 if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show');}
 // Exit is unlocked only after the area's enemies are defeated.
 if(areaIndex<areas.length-1&&player.x>AREA_W-45&&Math.abs(player.y-360)<90){
  if(enemies.every(e=>!e.alive))enterNextArea();
  else player.x=AREA_W-55;
 }
 camera.x=clamp(player.x-W/2,0,AREA_W-W);camera.y=clamp(player.y-H/2,0,AREA_H-H);
 updateHud();
}
function updateHud(){
 $('hpText').textContent=Math.ceil(player.hp)+' / '+player.maxHp;$('kiText').textContent=Math.floor(player.ki)+' / '+player.maxKi;
 $('hpBar').style.width=(player.hp/player.maxHp*100)+'%';$('kiBar').style.width=(player.ki/player.maxKi*100)+'%';
 $('level').textContent=level;$('xpText').textContent=xp;$('xpBar').style.width=(xp/(level*100)*100)+'%';
 $('enemyCount').textContent=enemies.filter(e=>e.alive&&!e.training).length;$('powerText').textContent=10+(level-1)*2;
}

function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function drawWorld(){
 const ox=-camera.x,oy=-camera.y;
 rect(0,0,W,H,area.ground);
 // checker-like grass/earth texture stays aligned to world coordinates
 const startX=Math.floor(camera.x/TILE)*TILE,startY=Math.floor(camera.y/TILE)*TILE;
 for(let y=startY;y<camera.y+H+TILE;y+=TILE)for(let x=startX;x<camera.x+W+TILE;x+=TILE){
  const seed=((x/TILE*17+y/TILE*31+areaIndex*13)%11);
  if(seed===0)rect(x+ox+7,y+oy+9,3,2,area.groundDark);
  else if(seed===3)rect(x+ox+19,y+oy+22,2,3,area.accent);
  else if(seed===6)rect(x+ox+3,y+oy+26,5,2,area.groundDark);
 }
 // perimeter cliffs / boundaries
 rect(0,0,W,18,area.wall);rect(0,H-18,W,18,area.wall);
 if(areaIndex===0)rect(W-18,0,18,H,area.wall);
 // decorative path toward the next area
 for(let i=0;i<12;i++)rect(AREA_W-130+i*10+ox,340+oy,8,40,area.accent);
 // area-specific decoration
 for(let i=0;i<10;i++){
  const x=((i*127+93)%AREA_W)+ox,y=((i*191+57)%AREA_H)+oy;
  if(area.kind==='forest'){drawTree(x,y,area.wall);}
  else if(area.kind==='canyon'){rect(x,y,18,9,'#87543e');rect(x+4,y-4,10,6,'#bd8059');}
  else {rect(x,y,12,5,'#a6a06a');rect(x+3,y-3,6,4,'#b7b17a');}
 }
 // obstacles
 for(const o of obstacles[areaIndex]){
  const x=o.x+ox,y=o.y+oy;
  if(o.type==='tree')drawTree(x+o.w/2,y+o.h/2,area.wall,o.w*.55);
  else {ctx.fillStyle='#0003';ctx.beginPath();ctx.ellipse(x+o.w/2,y+o.h-2,o.w*.53,8,0,0,Math.PI*2);ctx.fill();rect(x+7,y+8,o.w-14,o.h-13,'#5d6253');rect(x+14,y+2,o.w-28,o.h-8,'#858575');rect(x+18,y+4,12,4,'#a6a18c');}
 }
 // gate
 if(areaIndex<areas.length-1){
  const gx=AREA_W-55+ox,gy=360+oy;
  ctx.strokeStyle='#ffe3a0';ctx.lineWidth=3;ctx.strokeRect(gx-14,gy-34,28,68);
  ctx.fillStyle='#d9f2ff22';ctx.fillRect(gx-12,gy-32,24,64);
  ctx.fillStyle='#ffe1a0';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('SAÍDA',gx,gy-44);
 }
}
function drawTree(x,y,color,size=1){
 ctx.fillStyle='#0003';ctx.beginPath();ctx.ellipse(x,y+14*size,22*size,8*size,0,0,Math.PI*2);ctx.fill();
 rect(x-5*size,y-2*size,10*size,25*size,'#654b37');
 ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y-8*size,20*size,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#4f8052';ctx.beginPath();ctx.arc(x-9*size,y-13*size,11*size,0,Math.PI*2);ctx.fill();
}
function drawShadow(x,y,r){ctx.fillStyle='#14201855';ctx.beginPath();ctx.ellipse(x,y+r*.8,r*1.25,r*.48,0,0,Math.PI*2);ctx.fill();}
function drawPlayer(){
 const x=player.x-camera.x,y=player.y-camera.y,face=player.face;
 ctx.save();ctx.translate(x,y);
 drawShadow(0,3,player.r);
 if(player.charge>0){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.13;ctx.fillStyle='#64e5ff';ctx.beginPath();ctx.ellipse(0,0,23+player.charge*.12,27+player.charge*.12,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
 if(player.invuln>0&&Math.floor(elapsed*18)%2===0)ctx.globalAlpha=.42;
 const bob=Math.sin(player.walk*2)*((keys.has('a')||keys.has('d')||keys.has('w')||keys.has('s'))?2:0);
 // top-down body: hair at top, face and torso oriented toward facing vector
 ctx.translate(0,bob);
 ctx.fillStyle='#263b70';ctx.beginPath();ctx.ellipse(0,5,11,13,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#e56c2c';ctx.beginPath();ctx.ellipse(0,-1,12,11,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#f3bd8f';ctx.beginPath();ctx.arc(face.x*4,face.y*4-5,7,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#1d2030';ctx.beginPath();ctx.arc(-5,-12,7,0,Math.PI*2);ctx.arc(2,-14,8,0,Math.PI*2);ctx.arc(8,-9,5,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#f4d15e';ctx.fillRect(-9,3,18,3);
 // directional gloves / active punch
 if(player.attack>0){ctx.strokeStyle='#ffe28a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(face.x*8,face.y*8);ctx.lineTo(face.x*29,face.y*29);ctx.stroke();}
 ctx.restore();
}
function drawEnemy(e){
 const x=e.x-camera.x,y=e.y-camera.y;
 ctx.save();ctx.translate(x,y);drawShadow(0,4,e.radius);
 if(e.hit>0)ctx.globalAlpha=.55;
 const c=e.type==='fighter'?'#bc5c4c':e.type==='shooter'?'#5279b8':'#b68b43';
 ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(0,1,e.radius,e.radius*1.15,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=e.type==='shooter'?'#c7e2fa':'#e8b18b';ctx.beginPath();ctx.arc(0,-7,7,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#29212b';ctx.beginPath();ctx.arc(-4,-12,5,0,Math.PI*2);ctx.arc(3,-13,5,0,Math.PI*2);ctx.fill();
 // type marker
 if(e.type==='shooter'){ctx.fillStyle='#d8f3ff';ctx.fillRect(-3,10,6,5);}
 if(e.type==='charger'){ctx.fillStyle='#ffe29a';ctx.beginPath();ctx.moveTo(-8,-11);ctx.lineTo(-14,-21);ctx.lineTo(-3,-15);ctx.fill();ctx.beginPath();ctx.moveTo(8,-11);ctx.lineTo(14,-21);ctx.lineTo(3,-15);ctx.fill();}
 ctx.restore();
 // health bar
 rect(x-16,y-e.radius-19,32,4,'#1b2430');rect(x-15,y-e.radius-18,30*(e.hp/e.maxHp),2,'#ed7866');
 // Telegraphs: red ring for melee, lane for charger, blue ring for ranged attack
 if(e.state==='windup'||e.state==='telegraph'||e.state==='shoot'){
  ctx.save();ctx.globalAlpha=.3+.25*Math.sin(elapsed*20);ctx.strokeStyle=e.type==='shooter'?'#8bdcff':'#ff6c5f';ctx.lineWidth=2;
  if(e.type==='charger'){ctx.translate(x,y);ctx.rotate(Math.atan2(e.face.y,e.face.x));ctx.fillStyle='#ff665522';ctx.fillRect(0,-12,115,24);ctx.strokeRect(0,-12,115,24);}
  else{ctx.beginPath();ctx.arc(x,y,e.type==='shooter'?24:34,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
}
function drawProjectiles(list,color){
 for(const p of list){const x=p.x-camera.x,y=p.y-camera.y;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.22;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,p.r*2.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,p.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();ctx.restore();}
}
function draw(){
 ctx.save();
 if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake,shake));shake=Math.max(0,shake-25/60);}
 drawWorld();
 for(const e of enemies)if(e.alive)drawEnemy(e);
 drawProjectiles(projectiles,'#79eaff');drawProjectiles(enemyProjectiles,'#ff9b6d');
 drawPlayer();
 for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);rect(p.x-camera.x,p.y-camera.y,p.size,p.size,p.color);}ctx.globalAlpha=1;
 for(const t of texts){ctx.globalAlpha=clamp(t.life,0,1);ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillStyle='#29212b';ctx.fillText(t.text,t.x-camera.x+1,t.y-camera.y+1);ctx.fillStyle=t.color;ctx.fillText(t.text,t.x-camera.x,t.y-camera.y);}ctx.globalAlpha=1;
 // Ki charge meter and dodge cooldown cue
 if(player.charge>0){const x=235,y=H-20;rect(x-2,y-2,174,8,'#142235');rect(x,y,170*player.charge/player.maxKi,4,'#66dfff');ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillStyle='#e8faff';ctx.fillText('CARREGANDO KI',320,y-5);}
 if(player.dodgeCd>0){rect(12,H-12,52,3,'#172638');rect(12,H-12,52*(1-player.dodgeCd/.85),3,'#ffe09a');}
 if(gameOver){ctx.fillStyle='#0c1526bb';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.font='bold 25px monospace';ctx.fillStyle='#ffd58b';ctx.fillText('DERROTADO',W/2,H/2);ctx.font='10px monospace';ctx.fillStyle='#fff';ctx.fillText('Clique em Combate para tentar novamente',W/2,H/2+22);}
 ctx.restore();
}
function frame(time){const dt=lastTime?Math.min((time-lastTime)/1000,.033):0;lastTime=time;update(dt);draw();requestAnimationFrame(frame);}
spawnArea(0);updateHud();requestAnimationFrame(frame);
})();