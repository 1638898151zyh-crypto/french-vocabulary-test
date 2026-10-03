(() => {
'use strict';
const key=e=>`U${Number(e.unite)}P${Number(e.partie)}`;
function parts(bank){
 const result=[];
 for(const e of bank){if(!result.some(p=>p.key===key(e)))result.push({key:key(e),unit:Number(e.unite),part:Number(e.partie),title:e.partie_title});}
 return result.sort((a,b)=>a.unit-b.unit||a.part-b.part);
}
// One complete textbook topic per group, in first-source occurrence order.
function groups(bank,a){
 const map=new Map(),included=new Set(a.ids);
 for(const e of bank){if(key(e)!==a.part||!included.has(e.id))continue;const label=String(e.group||'').trim();if(!map.has(label))map.set(label,{label,ids:[]});map.get(label).ids.push(e.id);}
 return [...map.values()];
}
function attempt(bank,index,round){const p=parts(bank)[index];return {id:crypto.randomUUID(),part:p.key,round,group:0,grouping:'theme',ids:bank.filter(e=>key(e)===p.key).map(e=>e.id),opened:{},votes:{},passReason:null};}
function create(bank,stats={}){return {version:1,mode:'textbook',level:'B1',current:0,view:0,completed:false,round:1,stats:structuredClone(stats),mastered:{},processedCommands:[],attempts:[attempt(bank,0,1)]};}
const active=s=>s.attempts[s.view];
function totals(s){const a=active(s),vs=a.ids.map(id=>a.votes[id]);return {done:vs.filter(Boolean).length,good:vs.filter(v=>v==='good').length,bad:vs.filter(v=>v==='bad').length,total:a.ids.length};}
function toggle(s,id){const a=active(s);if(!a.ids.includes(id))return false;a.opened[id]=!a.opened[id];return true;}
function perfect(s){const t=totals(s);return t.total>0&&t.done===t.total&&t.good===t.total;}
function vote(s,id,kind){
 const a=active(s);if(!a.ids.includes(id)||!a.opened[id]||!['good','bad'].includes(kind)||a.votes[id]===kind)return false;
 const old=a.votes[id],counts=s.stats[id]||{good:0,bad:0};
 if(counts[kind]>=Number.MAX_SAFE_INTEGER||old&&counts[old]<1)return false;
 s.stats[id]={...counts,[kind]:counts[kind]+1};if(old)s.stats[id][old]--;
 a.votes[id]=kind;
 // Editing an automatic pass invalidates that pass, but retains later attempts and history.
 if(a.passReason==='automatic'&&!perfect(s)){
  const p=s.mastered[a.part];if(p?.attemptId===a.id){delete s.mastered[a.part];s.current=Math.min(s.current,partsFromStateIndex(s,a));s.completed=false;}
  a.passReason=null;
 }
 return true;
}
function partsFromStateIndex(s,a){return s.order.indexOf(a.part);}
function ensureOrder(s,bank){s.order=parts(bank).map(p=>p.key);return s;}
function pass(s,bank,reason='manual',requestId=null){
 if(requestId&&(s.processedCommands||[]).includes(requestId))return false;
 const a=active(s),order=parts(bank),index=order.findIndex(p=>p.key===a.part);
 if(index!==s.current||s.completed||!['manual','automatic'].includes(reason)||reason==='automatic'&&!perfect(s))return false;
 if(!s.mastered[a.part])s.mastered[a.part]={attemptId:a.id,reason,at:new Date().toISOString()};
 a.passReason=s.mastered[a.part].reason;
 if(requestId){s.processedCommands||=[];s.processedCommands.push(requestId);}
 let next=index+1;while(next<order.length&&s.mastered[order[next].key])next++;
 s.current=next;
 if(next===order.length){s.completed=true;return true;}
 const resume=s.attempts.findLastIndex(x=>x.part===order[next].key&&!x.passReason);
 if(resume>=0)s.view=resume;
 else {s.round++;s.attempts.push(attempt(bank,next,s.round));s.view=s.attempts.length-1;}
 return true;
}
function repeat(s,bank){if(s.completed)return false;s.round++;s.attempts.push(attempt(bank,s.current,s.round));s.view=s.attempts.length-1;return true;}
function restore(raw,bank){
 try{
 const s=typeof raw==='string'?JSON.parse(raw):structuredClone(raw),order=parts(bank).map(p=>p.key),known=new Map(bank.map(e=>[e.id,e]));
 if(!s||s.version!==1||s.mode!=='textbook'||s.level!=='B1'||!Number.isInteger(s.current)||s.current<0||s.current>order.length||s.completed!==(s.current===order.length)||!Number.isInteger(s.view)||!Array.isArray(s.attempts)||!s.attempts.length||s.view<0||s.view>=s.attempts.length||!Number.isSafeInteger(s.round)||s.round<1||!s.stats||!s.mastered)return null;
 if(s.processedCommands&&(!Array.isArray(s.processedCommands)||s.processedCommands.some(id=>typeof id!=='string')||new Set(s.processedCommands).size!==s.processedCommands.length))return null;
 for(const a of s.attempts){
 const expected=bank.filter(e=>key(e)===a.part).map(e=>e.id);
 if(typeof a.id!=='string'||!expected.length||!Array.isArray(a.ids)||a.ids.join('|')!==expected.join('|')||!Number.isInteger(a.group)||a.group<0||a.group>=(a.grouping==='theme'?groups(bank,a).length:Math.ceil(expected.length/10))||!a.opened||!a.votes||!Number.isSafeInteger(a.round)||a.round<1||![null,'manual','automatic'].includes(a.passReason))return null;
 if(a.grouping!==undefined&&a.grouping!=='theme')return null;
 if(a.grouping!=='theme'){const anchor=expected[a.group*10];a.group=groups(bank,a).findIndex(g=>g.ids.includes(anchor));a.grouping='theme';}
 for(const [id,k] of Object.entries(a.votes))if(!a.ids.includes(id)||!['good','bad'].includes(k)||!s.stats[id]||s.stats[id][k]<1)return null;
 }
 for(const [id,c] of Object.entries(s.stats))if(!known.has(id)||!Number.isSafeInteger(c.good)||!Number.isSafeInteger(c.bad)||c.good<0||c.bad<0)return null;
 const voteCounts={};for(const a of s.attempts)for(const [id,k] of Object.entries(a.votes)){voteCounts[id]||={good:0,bad:0};voteCounts[id][k]++;}
 for(const [id,c] of Object.entries(voteCounts))if(s.stats[id].good<c.good||s.stats[id].bad<c.bad)return null;
 for(let i=0;i<s.current;i++)if(!s.mastered[order[i]])return null;
 for(const [p,m] of Object.entries(s.mastered)){
 const a=s.attempts.find(a=>a.id===m.attemptId&&a.part===p);
 if(!a||!['manual','automatic'].includes(m.reason)||a.passReason!==m.reason||m.reason==='automatic'&&a.ids.some(id=>a.votes[id]!=='good'))return null;
 }
 return ensureOrder(s,bank);
 }catch{return null;}
}
globalThis.TextbookCore=Object.freeze({key,parts,groups,create:(b,stats)=>ensureOrder(create(b,stats),b),active,totals,toggle,vote,perfect,pass,repeat,restore});
})();
