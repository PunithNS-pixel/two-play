const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||8000,KEY=process.env.ADMIN_KEY||'';
const DATA=process.env.DATA_DIR||path.join(__dirname,'data');
fs.mkdirSync(DATA,{recursive:true});
const SAMPLES=path.join(DATA,'samples.jsonl'),ERRORS=path.join(DATA,'errors.jsonl');
const PUB=path.join(__dirname,'public');
const STATIC={'/':'index.html','/model_rps.json':'model_rps.json','/model_cricket.json':'model_cricket.json'};
const lines=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean):[];
const authed=(req,u)=>KEY?u.searchParams.get('key')===KEY:['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function readBody(req,cb){let b='';req.on('data',c=>{b+=c;if(b.length>400000)req.destroy()});req.on('end',()=>{try{cb(JSON.parse(b))}catch{cb(null)}})}

function admin(key){
 const S=lines(SAMPLES),E=lines(ERRORS),K=key?'?key='+encodeURIComponent(key):'';
 let h=`<meta charset=utf-8><title>Arena debug</title><style>body{font:14px system-ui;background:#163a0d;color:#eaffc0;padding:20px}table{border-collapse:collapse;margin:8px 0}td,th{border:1px solid #4d7a2c;padding:4px 8px;text-align:center}.bad{background:#8a3030}img{height:56px;border-radius:6px}a{color:#c6ff4a}</style>
 <h1>Tape Arena debug</h1><p>${S.length} samples, ${E.length} logged errors. <a href="/api/export${K}">Download samples.jsonl</a></p>`;
 for(const g of ['rps','cricket']){
  const cls=g==='rps'?['rock','paper','scissors']:['1','2','3','4','5','6','7','8','9','10'],cols=[...cls,'none'];
  const P=S.filter(r=>r.game===g&&r.mode==='play'&&r.label!=null),C=S.filter(r=>r.game===g&&r.mode==='collect');
  const M={};let ok=0;
  P.forEach(r=>{const a=String(r.label),b=r.pred==null?'none':String(r.pred);M[a]=M[a]||{};M[a][b]=(M[a][b]||0)+1;if(a===b)ok++});
  const coll={};C.forEach(r=>coll[r.label]=(coll[r.label]||0)+1);
  h+=`<h2>${g}</h2><p>Confirmed rounds: ${P.length}. Read correctly: ${P.length?Math.round(100*ok/P.length):0}%. Collected frames: ${C.length} (${Object.entries(coll).map(([k,v])=>k+':'+v).join(' ')||'none'})</p>
  <p>Rows are what the player really showed, columns are what the app read.</p>
  <table><tr><th></th>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>${cls.map(a=>`<tr><th>${a}</th>${cols.map(b=>{const v=(M[a]||{})[b]||0;return `<td class="${v&&a!==b?'bad':''}">${v||''}</td>`}).join('')}</tr>`).join('')}</table>`;
  const bad=P.filter(r=>String(r.pred)!==String(r.label)).slice(-12).reverse();
  if(bad.length)h+=`<p>Latest mistakes</p><table><tr><th>showed</th><th>read</th><th>source</th><th>snapshot</th></tr>${bad.map(r=>`<tr><td>${esc(r.label)}</td><td>${esc(r.pred)}</td><td>${esc(r.src)}</td><td>${r.img?`<img src="${esc(r.img)}">`:''}</td></tr>`).join('')}</table>`}
 h+=`<h2>Errors</h2><table>${E.slice(-25).reverse().map(e=>`<tr><td>${new Date(e.ts).toISOString()}</td><td>${esc(e.kind)}</td><td>${esc(e.msg)}</td></tr>`).join('')||'<tr><td>None yet</td></tr>'}</table>`;
 return h}

const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://x');
 if(req.method==='POST'&&(u.pathname==='/api/sample'||u.pathname==='/api/log'))return readBody(req,d=>{
  if(!d){res.writeHead(400);return res.end()}
  if(u.pathname==='/api/sample'){
   const recs=(Array.isArray(d.records)?d.records:[]).slice(0,60).filter(r=>r&&['rps','cricket'].includes(r.game));
   if(recs.length)fs.appendFile(SAMPLES,recs.map(r=>JSON.stringify({...r,ts:r.ts||Date.now()})).join('\n')+'\n',()=>{})}
  else fs.appendFile(ERRORS,JSON.stringify(d)+'\n',()=>{});
  res.writeHead(204);res.end()});
 if(u.pathname==='/api/ice'){
  const ice=[{urls:'stun:stun.l.google.com:19302'}];
  if(process.env.TURN_URL)ice.push({urls:process.env.TURN_URL,username:process.env.TURN_USER,credential:process.env.TURN_PASS});
  res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(ice))}
 if(u.pathname==='/admin'||u.pathname==='/api/export'){
  if(!authed(req,u)){res.writeHead(403);return res.end('Forbidden. Set ADMIN_KEY on the server and open /admin?key=YOUR_KEY')}
  if(u.pathname==='/api/export'){res.writeHead(200,{'Content-Type':'application/x-ndjson','Content-Disposition':'attachment; filename=samples.jsonl'});
   return fs.existsSync(SAMPLES)?fs.createReadStream(SAMPLES).pipe(res):res.end()}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(admin(u.searchParams.get('key')))}
 const f=STATIC[u.pathname];
 if(!f){res.writeHead(404);return res.end('Not found')}
 fs.readFile(path.join(PUB,f),(e,d)=>{
  if(e){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':f.endsWith('.json')?'application/json':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(d)})});

const wss=new WebSocketServer({server});
const rooms=new Map(),L='ABCDEFGHJKLMNPQRSTUVWXYZ';
const code=()=>{let c;do{c=Array.from({length:4},()=>L[Math.random()*L.length|0]).join('')}while(rooms.has(c));return c};
const send=(w,o)=>w&&w.readyState===1&&w.send(JSON.stringify(o));
function leave(ws){const r=rooms.get(ws.room);if(!r)return;
 send(r.players.find(p=>p!==ws),{t:'peer-left'});rooms.delete(ws.room);ws.room=null}
wss.on('connection',ws=>{
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
  if(m.t==='create'){leave(ws);const c=code();rooms.set(c,{game:m.game,players:[ws]});ws.room=c;send(ws,{t:'created',code:c})}
  else if(m.t==='join'){const r=rooms.get(m.code);
   if(!r)return send(ws,{t:'error',msg:'No room with that code.'});
   if(r.players.length>=2)return send(ws,{t:'error',msg:'That room is full.'});
   r.players.push(ws);ws.room=m.code;
   send(ws,{t:'joined',code:m.code,game:r.game});send(r.players[0],{t:'peer-joined'})}
  else if(['signal','start','move','rematch'].includes(m.t)){const r=rooms.get(ws.room);
   if(r)r.players.filter(p=>p!==ws).forEach(p=>send(p,m))}
  else if(m.t==='leave')leave(ws)});
 ws.on('close',()=>leave(ws))});
server.listen(PORT,()=>console.log('Tape Arena running at http://localhost:'+PORT));
