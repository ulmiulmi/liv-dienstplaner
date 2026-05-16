const {allow,send,readBody,fetchStore,saveStore,findEmployee}=require('./_wishlib');

function safe(v){return String(v||'').trim();}
function slug(v){return safe(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'default';}
function timeText(iso){try{return new Intl.DateTimeFormat('de-CH',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Zurich'}).format(new Date(iso));}catch(_){return iso;}}
function ensureClock(data){
  if(!data.timeClock || typeof data.timeClock!=='object') data.timeClock={version:'1.0',locations:{},events:[],api:{mode:'prepared',provider:null}};
  if(!data.timeClock.locations || typeof data.timeClock.locations!=='object') data.timeClock.locations={};
  if(!Array.isArray(data.timeClock.events)) data.timeClock.events=[];
  if(!data.timeClock.api || typeof data.timeClock.api!=='object') data.timeClock.api={mode:'prepared',provider:null};
  return data.timeClock;
}
function parseToken(raw,source){
  let token=safe(raw);
  let locationId='default';
  let locationLabel='ULMIPOINT Stempelstelle';
  try{
    const u=new URL(token);
    const st=u.searchParams.get('stamp') || u.searchParams.get('qr') || '';
    if(st) token=st;
  }catch(_){}
  const upper=token.toUpperCase();
  if(upper.startsWith('ULMIPOINT:STAMP:')){
    const parts=token.split(':');
    locationId=slug(parts[2]||'default');
    locationLabel=safe(parts.slice(3).join(' ')) || ('Stempelstelle '+locationId);
  }else if(upper.startsWith('NFC:')){
    locationId=slug(token.slice(4)||'nfc');
    locationLabel='NFC-Tag '+token.slice(4);
  }else if(source==='nfc'){
    locationId='nfc_'+slug(token);
    locationLabel='NFC-Tag';
    token='NFC:'+token;
  }else if(token){
    locationId=slug(token);
    locationLabel='QR-Stempelstelle '+locationId;
  }
  return {token,locationId,locationLabel};
}
function employeeClockKey(emp){return [emp.groupKey||emp.group||'', emp.id||'', emp.name||''].join('|').toLowerCase();}
function decideAction(events,emp){
  const k=employeeClockKey(emp);
  const last=(events||[]).find(e=>employeeClockKey(e.employee||e)===k);
  if(!last || last.action==='gehen') return {action:'kommen',actionLabel:'Kommen'};
  if(last.action==='kommen' || last.action==='pause_ende') return {action:'gehen',actionLabel:'Gehen'};
  if(last.action==='pause_start') return {action:'pause_ende',actionLabel:'Pause Ende'};
  return {action:'kommen',actionLabel:'Kommen'};
}

module.exports=async function handler(req,res){
  if(allow(req,res))return;
  if(req.method!=='POST')return send(res,405,{ok:false,message:'Nur POST erlaubt.'});
  try{
    const body=await readBody(req);
    const identity=safe(body.identity);
    const code=safe(body.code || body.wishCode);
    if(!identity || !code) throw new Error('Bitte zuerst im Wunschportal einloggen.');
    const row=await fetchStore();
    const data=row.data||{};
    const found=findEmployee(data,identity,code,body.employeeId);
    const emp=found.emp;
    const clock=ensureClock(data);

    const parsed=parseToken(body.token || body.raw, safe(body.source||'qr'));
    if(!parsed.token) throw new Error('Kein QR-/NFC-Code übergeben.');

    if(!clock.locations[parsed.locationId]){
      clock.locations[parsed.locationId]={id:parsed.locationId,label:parsed.locationLabel,createdAt:new Date().toISOString(),source:'auto'};
    }

    const now=new Date().toISOString();
    const act=safe(body.action)==='auto' || !body.action ? decideAction(clock.events,emp) : {action:slug(body.action),actionLabel:safe(body.action)};
    const event={
      id:'tc_'+now.replace(/[:.]/g,'-')+'_'+Math.random().toString(36).slice(2,8),
      at:now,
      timeText:timeText(now),
      employee:{id:emp.id,name:emp.name,group:emp.group,groupKey:emp.groupKey},
      employeeId:emp.id,
      employeeName:emp.name,
      group:emp.group,
      action:act.action,
      actionLabel:act.actionLabel,
      source:safe(body.source||'qr'),
      token:parsed.token,
      raw:safe(body.raw||body.token),
      locationId:parsed.locationId,
      locationLabel:clock.locations[parsed.locationId]?.label || parsed.locationLabel,
      client:safe(body.client||'app'),
      api:{status:'open',provider:null,sentAt:null,response:null,externalId:null},
      audit:{identity:identity,ip:req.headers['x-forwarded-for']||req.socket?.remoteAddress||'',userAgent:req.headers['user-agent']||''}
    };

    clock.events=[event].concat(clock.events||[]).slice(0,5000);
    clock.updatedAt=now;

    data.activity=[{
      id:'act_'+event.id,
      at:now,
      action:'Zeiterfassung '+event.actionLabel,
      user:{id:'code:'+emp.id,name:emp.name,email:identity},
      area:'Zeiterfassung',
      group:emp.group,
      employeeName:emp.name,
      note:event.source+' · '+event.locationLabel+' · API-Status offen'
    }].concat(Array.isArray(data.activity)?data.activity:[]).slice(0,80);

    await saveStore(data);
    return send(res,200,{ok:true,event,apiPrepared:true,updatedAt:now});
  }catch(err){
    return send(res,400,{ok:false,message:err.message||String(err)});
  }
};
