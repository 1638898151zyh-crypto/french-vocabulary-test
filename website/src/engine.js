import '../../assets/textbook-core.js';
import '../../assets/daily-core.js';
import '../../assets/vocabulary-core.js';
import bank from '../../assets/textbook-bank.json' with {type:'json'};
import ordinaryBank from '../../assets/vocabulary-bank.json' with {type:'json'};
import titles from '../../assets/part-titles.json' with {type:'json'};
import themeTitles from '../../assets/theme-titles.json' with {type:'json'};
export {bank,ordinaryBank,titles,themeTitles};
export const T=globalThis.TextbookCore,D=globalThis.DailyCore,V=globalThis.VocabCore;
export const dictionary=new Map(bank.map(e=>[e.id,e]));
export const parts=T.parts(bank);
export const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const partName=p=>p?.replace(/^U(\d+)P(\d+)$/,'U$1 · P$2')||'全书完成';
export function currentAttempt(s){return s.completed?s.attempts.at(-1):s.attempts.findLast(a=>a.part===s.order[s.current]&&!a.passReason);}
export function fresh(){return {version:1,mode:'atelier',main:T.create(bank),daily:null,dailyStats:{},dailySerial:0,dailyHistory:[],ordinary:V.create(ordinaryBank),ordinaryHistory:[],generation:crypto.randomUUID(),updatedAt:new Date().toISOString()};}
export function restoreBundle(raw){
 try{
  const s=typeof raw==='string'?JSON.parse(raw):structuredClone(raw);
  if(s?.version!==1||s.mode!=='atelier'||typeof s.generation!=='string'||typeof s.updatedAt!=='string'||!Number.isFinite(Date.parse(s.updatedAt)))return null;
  const main=T.restore(s.main,bank),ordinary=V.restore(s.ordinary,ordinaryBank);
  if(!main||!ordinary||new Set(main.attempts.map(a=>a.id)).size!==main.attempts.length)return null;
  for(const a of main.attempts)for(const [id,v] of Object.entries(a.opened))if(!a.ids.includes(id)||typeof v!=='boolean')return null;
  const allowed=D.eligible(main,bank);
  s.dailyStats=s.dailyStats||s.daily?.stats||{};s.dailySerial=s.dailySerial??s.daily?.round??0;
  if(!Number.isSafeInteger(s.dailySerial)||s.dailySerial<0)return null;
  for(const [id,c] of Object.entries(s.dailyStats))if(!dictionary.has(id)||!c||!['good','bad'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0))return null;
  if(s.daily&&!D.validRound(s.daily,bank,allowed))return null;
  if(s.daily&&(s.dailySerial!==s.daily.round||JSON.stringify(s.dailyStats)!==JSON.stringify(s.daily.stats)))return null;
  if(!Array.isArray(s.dailyHistory)||!Array.isArray(s.ordinaryHistory)||s.dailyHistory.length>20||s.ordinaryHistory.length>20)return null;
  for(const h of s.dailyHistory)if(!Array.isArray(h.allowed)||!h.allowed.every(p=>main.order.includes(p))||!D.validRound(h.round,bank,h.allowed))return null;
  for(const h of s.ordinaryHistory)if(!V.restore(h,ordinaryBank))return null;
  return {...s,main,ordinary};
 }catch{return null;}
}
export function importRecord(raw,current){
 const data=typeof raw==='string'?JSON.parse(raw):raw;
 if(data?.mode==='atelier'){const next=restoreBundle(data);if(!next)throw Error('网站进度格式无效；现有记录未改动。');return next;}
 const main=T.restore(data,bank);if(!main)throw Error('请选择有效的课本主进度或网站完整备份。');
 const next=structuredClone(current);next.main=main;next.daily=null;next.dailyHistory=[];next.dailyStats={};next.dailySerial=0;return touch(next);
}
export function touch(s){s.generation=crypto.randomUUID();s.updatedAt=new Date().toISOString();return s;}
export function makeDaily(s){
 const allowed=D.eligible(s.main,bank),problem=D.problem(bank,allowed);
 if(problem)return {state:s,problem};
 const next=structuredClone(s);
 if(next.daily){next.dailyHistory.unshift({round:next.daily,allowed:D.eligible(s.main,bank)});next.dailyHistory=next.dailyHistory.slice(0,20);}
 next.daily=D.create(bank,allowed,crypto.randomUUID(),day(),{stats:s.dailyStats,round:s.dailySerial});next.daily.stats=structuredClone(s.dailyStats);next.dailySerial=next.daily.round;return {state:touch(next),problem:null};
}
export function bookAction(s,attemptId,action,id,kind){
 const next=structuredClone(s),i=next.main.attempts.findIndex(a=>a.id===attemptId);if(i<0)return s;
 next.main.view=i;let changed=false;
 if(action==='toggle')changed=T.toggle(next.main,id);
 if(action==='vote')changed=T.vote(next.main,id,kind);
 if(action==='group'){const n=T.groups(bank,T.active(next.main)).length;if(Number.isInteger(id)&&id>=0&&id<n){T.active(next.main).group=id;changed=true;}}
 if(action==='pass')changed=T.pass(next.main,bank,kind||'manual');
 if(action==='repeat'&&T.active(next.main).part===next.main.order[next.main.current])changed=T.repeat(next.main,bank);
 if(!changed)return s;
 next.main.updatedAt=new Date().toISOString();
 if(next.daily&&!D.validRound(next.daily,bank,D.eligible(next.main,bank))){next.dailyHistory.unshift({round:next.daily,allowed:D.eligible(s.main,bank)});next.dailyHistory=next.dailyHistory.slice(0,20);next.daily=null;}
 return touch(next);
}
