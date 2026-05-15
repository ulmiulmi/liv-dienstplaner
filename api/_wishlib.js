const STORE_ID = process.env.POLYPOINT_STORE_ID || 'default';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.POLYPOINT_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

function send(res,status,data){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(data));
}
function allow(req,res){
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){ send(res,200,{ok:true}); return true; }
  return false;
}
async function readBody(req){
  if(req.body && typeof req.body==='object') return req.body;
  const chunks=[]; for await (const c of req) chunks.push(Buffer.from(c));
  const raw=Buffer.concat(chunks).toString('utf8');
  try{return raw?JSON.parse(raw):{};}catch(_){return {};}
}
function assertEnv(){
  if(!SUPABASE_URL || !SERVICE_KEY) throw new Error('Server nicht eingerichtet: SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.');
}
async function supabase(path,opt={}){
  assertEnv();
  const headers=Object.assign({apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY},opt.headers||{});
  const resp=await fetch(SUPABASE_URL+path,Object.assign({},opt,{headers}));
  const txt=await resp.text(); let data=null; try{data=txt?JSON.parse(txt):null;}catch(_){data=txt;}
  if(!resp.ok) throw new Error((data&&data.message)||(data&&data.msg)||String(data||('HTTP '+resp.status)));
  return data;
}
async function fetchStore(){
  const rows=await supabase('/rest/v1/planer_store?id=eq.'+encodeURIComponent(STORE_ID)+'&select=id,data,updated_at',{method:'GET'});
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row || !row.data) throw new Error('Kein Serverstand gefunden.');
  return row;
}
async function saveStore(data){
  const now=new Date().toISOString();
  await supabase('/rest/v1/planer_store',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:STORE_ID,data,updated_at:now})});
  return {id:STORE_ID,data,updated_at:now};
}
function parse(v){ if(!v || typeof v!=='string') return null; try{return JSON.parse(v);}catch(_){return null;} }
function normEmail(v){return String(v||'').trim().toLowerCase();}
function normCode(v){return String(v||'').trim().replace(/\s+/g,'').toUpperCase();}
function normText(v){return String(v||'').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ');}
function safe(v){return String(v||'').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
function groupFrom(key,obj){
  const raw=String(obj?.planerGroupName||obj?.groupName||key||'').replace(/^polypoint_/,'').replace(/_/g,' ');
  if(/azoren/i.test(raw))return 'Azoren'; if(/bali/i.test(raw))return 'Bali'; if(/capri/i.test(raw))return 'Capri'; if(/delos/i.test(raw))return 'Delos'; if(/nacht/i.test(raw))return 'Nachtwache'; if(/pikett/i.test(raw))return 'Haus-Pikett'; if(/haus.*dienst|hausdienst/i.test(raw))return 'Haus-Dienstplan';
  return raw.trim()||'Allgemein';
}
function groupKey(v){return normText(v||'allgemein');}
function empEmails(e){
  const a=[]; ['email','mail','loginEmail','portalEmail','wunschEmail'].forEach(k=>{if(e&&e[k])a.push(normEmail(e[k]));});
  if(Array.isArray(e?.emails)) e.emails.forEach(x=>a.push(normEmail(x)));
  return [...new Set(a.filter(Boolean))];
}
function allEmployees(data){
  const out=[]; const items=data?.items||{};
  Object.entries(items).forEach(([key,val])=>{
    const st=parse(val); if(!st||!Array.isArray(st.employees))return;
    const group=groupFrom(key,st);
    st.employees.forEach(e=>{
      if(!e || e.active===false) return;
      const name=String(e.name||'').trim(); if(!name)return;
      out.push({id:String(e.id||name),name,group,groupKey:groupKey(group),sourceKey:key,emails:empEmails(e),wishCode:String(e.wishCode||e.portalCode||e.wunschCode||'')});
    });
  });
  return out;
}
function findEmployee(data,identity,code,employeeId){
  const idn=normText(identity), em=normEmail(identity), c=normCode(code);
  let matches=allEmployees(data).filter(e=>normCode(e.wishCode)===c && ((em&&e.emails.includes(em)) || (idn&&(normText(e.name)===idn || normText(e.name).includes(idn) || idn.includes(normText(e.name))))));
  if(employeeId) matches=matches.filter(e=>String(e.id)===String(employeeId));
  if(matches.length!==1) throw new Error(matches.length>1?'Mehrere Treffer gefunden. Bitte E-Mail statt Name verwenden.':'Kein Mitarbeiter mit diesem Namen/E-Mail und Wunsch-Code gefunden.');
  const emp=Object.assign({},matches[0]); delete emp.wishCode; delete emp.sourceKey;
  return {emp, sourceKey:matches[0].sourceKey};
}
function stateFor(data,emp){
  const items=data?.items||{};
  for(const [key,val] of Object.entries(items)){
    const st=parse(val); if(!st||!Array.isArray(st.employees))continue;
    const group=groupFrom(key,st);
    const has=st.employees.some(e=>String(e.id||e.name)===String(emp.id)||normText(e.name)===normText(emp.name));
    if(has && groupKey(group)===emp.groupKey) return st;
  }
  return null;
}
function activeCodes(st){
  const s=new Set(); const needs=st?.standardNeeds||{};
  Object.entries(needs).forEach(([d,arr])=>{ if(d&&d[0]==='_')return; if(!Array.isArray(arr))return; arr.forEach(c=>{c=normCode(c); if(c)s.add(c);}); });
  return s;
}
function dutyLabel(d){
  const code=String(d?.code||'').trim(); const name=String(d?.name||'').trim(); const time=[d?.start,d?.end].filter(Boolean).join('–');
  return code+(name?' · '+name:'')+(time?' · '+time:'');
}
function wishOptionsForEmployee(data,emp){
  const st=stateFor(data,emp); const active=activeCodes(st); const map=new Map();
  (Array.isArray(st?.duties)?st.duties:[]).forEach(d=>{const code=normCode(d.code); if(!code)return; if(active.has(code))map.set(code,[code,dutyLabel(d)]);});
  [['FER','Ferien'],['SCH','Schule'],['WB','Weiterbildung'],['KF','Kompensation / frei']].forEach(o=>{if(!map.has(o[0]))map.set(o[0],o);});
  return [['','egal / kein Wunsch'],['FR','Wunsch frei / frei gewünscht'],['NO','nicht verfügbar']].concat([...map.values()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'de'))).concat([['OTHER','anderer Wunsch / siehe Kommentar']]);
}
function empKey(emp){return 'emp_'+[emp.groupKey||emp.group,emp.id,emp.name].filter(Boolean).map(safe).join('__');}
function wishStore(data){ if(!data.wishes||typeof data.wishes!=='object')data.wishes={version:'13.0.226f-api',people:{}}; if(!data.wishes.people)data.wishes.people={}; return data.wishes; }
function getWishes(data,emp,monthKey){ const ws=wishStore(data); return JSON.parse(JSON.stringify(ws.people?.[empKey(emp)]?.months?.[monthKey]?.days||{})); }
function setWishes(data,emp,monthKey,days,identity,action){
  const ws=wishStore(data); const key=empKey(emp); const [y,m]=String(monthKey).split('-').map(Number);
  if(!ws.people[key])ws.people[key]={employeeId:emp.id,employeeName:emp.name,group:emp.group,months:{}};
  Object.assign(ws.people[key],{employeeId:emp.id,employeeName:emp.name,email:normEmail(identity),group:emp.group,groupKey:emp.groupKey,updatedAt:new Date().toISOString(),keyMode:'employee'});
  ws.people[key].months[monthKey]={year:y,month:m,days:days||{},group:emp.group,updatedAt:new Date().toISOString(),savedBy:{id:'code:'+emp.id,email:normEmail(identity),name:emp.name}};
  ws.version='13.0.226f-api'; ws.updatedAt=new Date().toISOString();
}
function dateStr(y,m,d){return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function personalPlan(data,emp,monthKey,wishes,wishOptions){
  const st=stateFor(data,emp); const [y,m]=String(monthKey).split('-').map(Number); const days=[]; if(!st||!y||!m)return {days,rows:[],planned:0,info:'Kein persönlicher Plan gefunden.'};
  const duties=Array.isArray(st.duties)?st.duties:[]; const rows=[]; let planned=0; const max=new Date(y,m,0).getDate();
  for(let d=1;d<=max;d++){
    const date=dateStr(y,m,d); const dow=new Date(y,m-1,d).getDay();
    const entry=(st.plan||{})[date+'__'+emp.id] || (st.plan||{})[date+'__'+emp.name] || null;
    const code=String(entry?.code||'').trim(); const def=duties.find(x=>String(x.code||'').trim()===code);
    const label=code ? code+(def?.name?' · '+def.name:'')+((def?.start&&def?.end)?' · '+def.start+'–'+def.end:'') : 'frei / leer';
    const wish=wishes?.[date]?.type ? ((wishOptions||[]).find(o=>o[0]===wishes[date].type)?.[1]||wishes[date].type) : '';
    const obj={day:d,date,dow:['So','Mo','Di','Mi','Do','Fr','Sa'][dow],weekend:dow===0||dow===6,hasDuty:!!code&&code!=='FR',code,label,wish};
    days.push(obj); if(code){rows.push(obj); if(code!=='FR')planned++;}
  }
  return {days,rows,planned,info:'Persönlicher Dienstplan: '+emp.name+' · '+emp.group+' · '+monthKey};
}
function wishDeadlineWeeks(data){let w=Number(data?.wishSettings?.deadlineWeeks); if(!Number.isFinite(w))w=6; return Math.max(0,Math.min(26,Math.round(w)));}
function publicPayload(row,emp,identity,monthKey){
  const data=row.data; const wishes=getWishes(data,emp,monthKey); const opts=wishOptionsForEmployee(data,emp);
  return {ok:true,employee:emp,identity:normEmail(identity)||identity,monthKey,wishDeadlineWeeks:wishDeadlineWeeks(data),wishOptions:opts,wishes,personalPlan:personalPlan(data,emp,monthKey,wishes,opts),updatedAt:row.updated_at||new Date().toISOString()};
}
module.exports={allow,send,readBody,fetchStore,saveStore,findEmployee,publicPayload,setWishes};
