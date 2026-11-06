const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const W=7000,NF=1800,NB=10,PORT=process.env.PORT||3000;
const R=s=>9+Math.min(s.segs.length,250)*0.035,rnd=(a,b)=>a+Math.random()*(b-a);
const names=['Viper','Cobra','Mamba','Python','Naga','Slick','Boa','Rattle','Zippy','Fang','Coil','Nox'];
const srv=http.createServer((q,r)=>fs.readFile(path.join(__dirname,'index.html'),(e,d)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(d)}));
const wss=new WebSocketServer({server:srv});
let snakes=[],foods=[],nid=1;
const food=()=>({x:rnd(40,W-40),y:rnd(40,W-40),h:rnd(0,360)|0,v:Math.random()<.15?3:1});
for(let i=0;i<NF;i++)foods.push(food());
function mk(o){const a=rnd(0,6.28),px=rnd(300,W-300),py=rnd(300,W-300),
s=Object.assign({id:nid++,segs:[],ang:a,tgt:a,grow:0,boost:false,bt:0,tt:0,dead:false},o);
for(let k=0;k<12;k++)s.segs.push({x:px-Math.cos(a)*k*6,y:py-Math.sin(a)*k*6});return s}
const addBot=i=>snakes.push(mk({bot:true,name:names[i%names.length],hue:(i*37+20)%360,bi:i}));
for(let i=0;i<NB;i++)addBot(i);
const send=(ws,m)=>{if(ws.readyState===1)ws.send(JSON.stringify(m))};
function kill(s){
for(let k=0;k<s.segs.length;k+=2){const g=s.segs[k];foods.push({x:g.x+rnd(-6,6),y:g.y+rnd(-6,6),h:s.hue,v:3})}
s.dead=true;snakes=snakes.filter(o=>o!==s);
if(s.ws)send(s.ws,{t:'dead',len:s.segs.length});else setTimeout(()=>addBot(s.bi),2000)}
const wrap=d=>{while(d>Math.PI)d-=6.2832;while(d<-Math.PI)d+=6.2832;return d};
function step(s,dt){
if(s.dead)return;const hd=s.segs[0];
if(s.bot){s.tt-=dt;if(s.tt<=0){s.tt=rnd(.25,.6);let bd=1e9,bf=null;
for(const f of foods){const d=(f.x-hd.x)**2+(f.y-hd.y)**2;if(d<bd&&d<360000){bd=d;bf=f}}
s.tgt=bf?Math.atan2(bf.y-hd.y,bf.x-hd.x):s.tgt+rnd(-.8,.8);
for(const o of snakes){if(o===s)continue;for(let k=0;k<o.segs.length;k+=3){const g=o.segs[k];if((g.x-hd.x)**2+(g.y-hd.y)**2<5000){s.tgt=Math.atan2(hd.y-g.y,hd.x-g.x);break}}}
s.boost=!!(bf&&bd<9000&&s.segs.length>25&&Math.random()<.3)}}
const m=4.2*dt;s.ang+=Math.max(-m,Math.min(m,wrap(s.tgt-s.ang)));
if(s.boost&&s.segs.length>12){s.bt+=dt;if(s.bt>.1){s.bt=0;const t=s.segs.pop();foods.push({x:t.x,y:t.y,h:s.hue,v:1})}}else s.boost=false;
const sp=s.boost?300:160;hd.x+=Math.cos(s.ang)*sp*dt;hd.y+=Math.sin(s.ang)*sp*dt;
const gap=R(s)*0.6;
for(let i=1;i<s.segs.length;i++){const a=s.segs[i-1],b=s.segs[i],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d>gap){b.x+=dx/d*(d-gap);b.y+=dy/d*(d-gap)}}
if(s.grow>=1){s.grow--;const t=s.segs[s.segs.length-1];s.segs.push({x:t.x,y:t.y})}
const r=R(s);
for(let i=foods.length-1;i>=0;i--){const f=foods[i],d=Math.hypot(f.x-hd.x,f.y-hd.y);
if(d<r+30){f.x+=(hd.x-f.x)*.25;f.y+=(hd.y-f.y)*.25}
if(d<r+5){s.grow+=f.v*.35;foods.splice(i,1)}}
let sx=0,sy=0;if(hd.x<0)sx=W;else if(hd.x>W)sx=-W;if(hd.y<0)sy=W;else if(hd.y>W)sy=-W;
if(sx||sy)for(const g of s.segs){g.x+=sx;g.y+=sy}
for(const o of snakes){if(o===s)continue;const ro=R(o);
for(const g of o.segs)if((g.x-hd.x)**2+(g.y-hd.y)**2<((r+ro)*.7)**2)return kill(s)}}
const flat=segs=>{const a=[];for(const g of segs)a.push(g.x|0,g.y|0);return a};
function bc(){
const lb=snakes.slice().sort((a,b)=>b.segs.length-a.segs.length).slice(0,5).map(s=>[s.name,s.segs.length]);
for(const p of snakes){if(!p.ws)continue;const h=p.segs[0],sn=[],f=[];
for(const s of snakes){if(s===p)continue;const g=s.segs[0];
if(Math.abs(g.x-h.x)<1600&&Math.abs(g.y-h.y)<1600)sn.push([s.id,s.name,s.hue,s.boost?1:0,flat(s.segs)])}
for(const o of foods)if(Math.abs(o.x-h.x)<900&&Math.abs(o.y-h.y)<900)f.push([o.x|0,o.y|0,o.h|0,o.v]);
send(p.ws,{t:'s',me:flat(p.segs),hue:p.hue,bo:p.boost?1:0,sn,f,lb,n:wss.clients.size})}}
wss.on('connection',ws=>{
ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch(e){return}
const mine=snakes.find(s=>s.ws===ws);
if(m.t==='join'&&!mine){const name=String(m.name||'Player').replace(/[<>&"']/g,'').slice(0,12)||'Player';
snakes.push(mk({ws,name,hue:(Number(m.hue)||0)%360}))}
else if(m.t==='in'&&mine&&typeof m.a==='number'){mine.tgt=m.a;mine.boost=!!m.b&&mine.segs.length>12}});
ws.on('close',()=>{const s=snakes.find(o=>o.ws===ws);if(s)snakes=snakes.filter(o=>o!==s)})});
let tick=0;
setInterval(()=>{for(const s of snakes.slice())step(s,1/30);
while(foods.length<NF)foods.push(food());if(foods.length>NF+1500)foods.splice(0,300);
if(++tick%2===0)bc()},33);
srv.listen(PORT,'0.0.0.0',()=>console.log('Snake Zone running on port '+PORT));
