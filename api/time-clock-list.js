const {allow,send,readBody,fetchStore,findEmployee}=require('./_wishlib');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.ULMIPOINT_SUPABASE_URL || process.env.POLYPOINT_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

function safe(v){return String(v||'').trim();}
function normEmail(v){return safe(v).toLowerCase();}
function normalizeRole(v){
  v=safe(v).toLowerCase();
  if(['admin','administrator','leitung'].includes(v)) return 'admin';
  if(['planner','planer','planung'].includes(v)) return 'planner';
  if(['employee','mitarbeiter','ma'].includes(v)) return 'employee';
  return v;
}
function roleStore(data){
  const roles=(data&&typeof data==='object')?(data.accessRoles||data.roles||{}):{};
  return roles&&typeof roles==='object'?roles:{};
}
function employeeKeyFromEvent(e){return [e.employee?.groupKey||e.group||'', e.employeeId||'', e.employeeName||''].join('|').toLowerCase();}
function employeeKey(emp){return [emp.groupKey||emp.group||'', emp.id||'', emp.name||''].join('|').toLowerCase();}

async function verifySupabaseUser(req){
  const auth=safe(req.headers.authorization || req.headers.Authorization);
  const token=auth.replace(/^Bearer\s+/i,'');
  if(!token) throw new Error('Keine Server-Sitzung übergeben. Bitte im Hauptplaner über ☁️ Server einloggen.');
  if(!SUPABASE_URL || !SERVICE_KEY) throw new Error('Server-Umgebung fehlt: SUPABASE_URL oder SERVICE KEY.');
  const resp=await fetch(SUPABASE_URL + '/auth/v1/user', {
    method:'GET',
    headers:{'apikey':SERVICE_KEY,'Authorization':'Bearer '+token}
  });
  const txt=await resp.text();
  let user=null; try{user=txt?JSON.parse(txt):null;}catch(_){user=null}
  if(!resp.ok || !user || !user.id) throw new Error('Server-Sitzung ungültig oder abgelaufen. Bitte neu einloggen.');
  return user;
}

function assertAdminAccess(data,user){
  const email=normEmail(user.email);
  const roles=roleStore(data);
  const configured=Object.keys(roles).length;
  if(!configured) return {ok:true,email,role:'transition',configured};
  const entry=roles[email];
  const role=normalizeRole(typeof entry==='string'?entry:entry?.role);
  if(role==='admin' || role==='planner') return {ok:true,email,role,configured};
  throw new Error('Keine Admin-/Planer-Rolle für '+(email||'diese Sitzung')+'.');
}

module.exports=async function handler(req,res){
  if(allow(req,res))return;
  if(req.method!=='POST')return send(res,405,{ok:false,message:'Nur POST erlaubt.'});
  try{
    const body=await readBody(req);
    const row=await fetchStore();
    const data=row.data||{};
    const clock=data.timeClock&&typeof data.timeClock==='object'?data.timeClock:{events:[]};
    let events=Array.isArray(clock.events)?clock.events.slice():[];

    const mode=safe(body.mode||'self');
    let access='self';

    if(mode==='self'){
      const identity=safe(body.identity);
      const code=safe(body.code || body.wishCode);
      if(!identity || !code) throw new Error('Bitte zuerst einloggen.');
      const found=findEmployee(data,identity,code,body.employeeId);
      const k=employeeKey(found.emp);
      events=events.filter(e=>employeeKeyFromEvent(e)===k);
    }else{
      const user=await verifySupabaseUser(req);
      const info=assertAdminAccess(data,user);
      access='admin-session:'+info.role;
    }

    if(body.date) events=events.filter(e=>String(e.at||'').slice(0,10)===safe(body.date));
    if(body.group) events=events.filter(e=>safe(e.group).toLowerCase()===safe(body.group).toLowerCase());
    if(body.employeeName) events=events.filter(e=>safe(e.employeeName).toLowerCase().includes(safe(body.employeeName).toLowerCase()));

    const limit=Math.max(1,Math.min(500,Number(body.limit)||50));
    events=events.slice(0,limit);
    return send(res,200,{ok:true,events,locations:clock.locations||{},api:clock.api||{mode:'prepared'},access,updatedAt:clock.updatedAt||row.updated_at});
  }catch(err){
    return send(res,400,{ok:false,message:err.message||String(err)});
  }
};
