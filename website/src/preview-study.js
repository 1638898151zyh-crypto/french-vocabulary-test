import '../../assets/textbook-core.js';

// Flexible study is local to the design preview. Production/plugin progress is untouched.
export const key=globalThis.TextbookCore.key;
export const parts=globalThis.TextbookCore.parts;
export const active=s=>s.attempts[s.view];
export const masteredCount=s=>Object.keys(s.mastered).length;

function sourceGroups(bank,part){
  const groups=new Map();
  for(const entry of bank)if(key(entry)===part){if(!groups.has(entry.group))groups.set(entry.group,[]);groups.get(entry.group).push(entry.id);}
  return [...groups.values()];
}
function shuffle(ids,rng){
  const result=[...ids];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function newAttempt(s,bank,part,options={}){
  const ids=sourceGroups(bank,part).flatMap(ids=>options.shuffle?shuffle(ids,options.rng||Math.random):ids);
  return {id:crypto.randomUUID(),part,round:s.attempts.filter(a=>a.part===part).length+1,group:0,ids,opened:{},votes:{},passReason:null,shuffled:!!options.shuffle};
}
function sync(s){s.current=masteredCount(s);s.completed=s.current===s.order.length;return s;}
export function create(bank,level='B1',options={}){
  const s={version:2,mode:'preview-study',level,order:parts(bank).map(p=>p.key),current:0,completed:false,view:0,round:1,mastered:{},stats:{},attempts:[]};
  if(!s.order.length)throw Error('无法检测空词库。');
  s.attempts.push(newAttempt(s,bank,s.order[0],options));return s;
}
export function groups(bank,attempt){
  const dictionary=new Map(bank.map(e=>[e.id,e])),grouped=new Map();
  for(const id of attempt.ids){const entry=dictionary.get(id);if(!entry)continue;if(!grouped.has(entry.group))grouped.set(entry.group,{label:entry.group,ids:[]});grouped.get(entry.group).ids.push(id);}
  return [...grouped.values()];
}
export function toggle(s,id){const a=active(s);if(!a.ids.includes(id))return false;a.opened[id]=!a.opened[id];return true;}
export function perfect(s){const a=active(s);return a.ids.length>0&&a.ids.every(id=>a.votes[id]==='good');}
export function vote(s,id,kind){
  const a=active(s);
  if(!a.ids.includes(id)||!a.opened[id]||!['good','bad'].includes(kind)||a.votes[id]===kind)return false;
  const old=a.votes[id],counts=s.stats[id]||{good:0,bad:0};
  if(counts[kind]>=Number.MAX_SAFE_INTEGER||old&&counts[old]<1)return false;
  s.stats[id]={...counts,[kind]:counts[kind]+1};if(old)s.stats[id][old]--;
  a.votes[id]=kind;
  if(a.passReason==='automatic'&&s.mastered[a.part]?.attemptId===a.id&&!perfect(s)){delete s.mastered[a.part];a.passReason=null;sync(s);}
  return true;
}
export function selectPart(s,bank,part,options={}){
  if(!s.order.includes(part))return false;
  const current=active(s);if(current.part===part&&!current.passReason)return false;
  const latest=s.attempts.findLastIndex(a=>a.part===part);
  if(latest>=0&&!s.attempts[latest].passReason)s.view=latest;
  else{s.attempts.push(newAttempt(s,bank,part,options));s.view=s.attempts.length-1;s.round=s.attempts.length;}
  return true;
}
export function repeat(s,bank,options={}){
  s.attempts.push(newAttempt(s,bank,active(s).part,options));s.view=s.attempts.length-1;s.round=s.attempts.length;return true;
}
export function pass(s,bank,reason='manual',options={}){
  const a=active(s);if(a.passReason||!['manual','automatic'].includes(reason)||reason==='automatic'&&!perfect(s))return false;
  a.passReason=reason;
  if(!s.mastered[a.part])s.mastered[a.part]={attemptId:a.id,reason,at:new Date().toISOString()};
  sync(s);
  const start=s.order.indexOf(a.part);
  for(let step=1;step<=s.order.length;step++){
    const next=s.order[(start+step)%s.order.length];
    if(!s.mastered[next]){selectPart(s,bank,next,options);break;}
  }
  return true;
}
export function partStatistics(s,bank,part){
  const entries=bank.filter(e=>key(e)===part).map(e=>({...e,good:s.stats[e.id]?.good||0,bad:s.stats[e.id]?.bad||0}));
  return {entries,good:entries.reduce((n,e)=>n+e.good,0),bad:entries.reduce((n,e)=>n+e.bad,0),judged:entries.filter(e=>e.good+e.bad>0).length,rounds:s.attempts.filter(a=>a.part===part).length};
}

export const DEFAULT_SETTINGS=Object.freeze({layout:'classic',shuffle:false});
export const SETTINGS_KEY='atelier:design-settings:v1';
export function loadSettings(storage){try{const s=JSON.parse(storage.getItem(SETTINGS_KEY));return {layout:s?.layout==='right'?'right':'classic',shuffle:s?.shuffle===true};}catch{return {...DEFAULT_SETTINGS};}}
export function saveSettings(storage,settings){storage.setItem(SETTINGS_KEY,JSON.stringify({layout:settings.layout==='right'?'right':'classic',shuffle:settings.shuffle===true}));}
