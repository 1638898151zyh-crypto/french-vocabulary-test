import '../../assets/daily-core.js';
import '../../assets/vocabulary-core.js';
import ordinaryBank from '../../assets/vocabulary-bank.json' with {type:'json'};
import * as Study from './preview-study.js';

export const D=globalThis.DailyCore,V=globalThis.VocabCore;
export const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const eligible=main=>main.order.filter(p=>main.mastered[p]);
export const practiceBank=book=>book.id==='edito-b1'?ordinaryBank:book.bank?.filter(e=>Number(e.unite)===1&&[1,2].includes(Number(e.partie)))||[];
export function createPractice(book){try{return V.create(practiceBank(book));}catch{return null;}}
export function createDaily(book,main,previous=null){
  const allowed=eligible(main),problem=D.problem(book.bank,allowed);
  return problem?{problem,round:null}:{problem:null,round:D.create(book.bank,allowed,crypto.randomUUID(),day(),previous)};
}
export function reviewGroups(quiz,mode){return Array.from({length:5},(_,i)=>({label:mode==='daily'?quiz.themes[i]:`第 ${i+1} 组`,ids:quiz.ids.slice(i*10,i*10+10),part:mode==='daily'?quiz.parts[i]:null}));}
export function validDaily(quiz,book,main){return !quiz||D.validRound(quiz,book.bank,eligible(main));}
export function reviewAction(quiz,mode,action,id,kind,book){
  if(!quiz)return null;const next=structuredClone(quiz),core=mode==='daily'?D:V;
  if(action==='toggle')return core.toggle(next,id)?next:quiz;
  if(action==='vote')return core.vote(next,id,kind)?next:quiz;
  if(action==='group'&&Number.isInteger(id)&&id>=0&&id<5){next.group=id;return next;}
  if(action==='repeat')return mode==='daily'?{...next,round:next.round+1,launchId:crypto.randomUUID(),opened:{},votes:{},group:0}:V.restart(next,practiceBank(book),false);
  if(action==='next'&&mode==='practice')return V.restart(next,practiceBank(book),true);
  return quiz;
}

export function restoreStudy(raw,book){
  try{
    const s=structuredClone(raw),order=Study.parts(book.bank).map(p=>p.key),dictionary=new Map(book.bank.map(e=>[e.id,e]));
    if(s?.version!==2||s.mode!=='preview-study'||s.level!==book.level||JSON.stringify(s.order)!==JSON.stringify(order)||!Array.isArray(s.attempts)||!s.attempts.length||s.attempts.length>2000||!Number.isInteger(s.view)||s.view<0||s.view>=s.attempts.length||!s.stats||!s.mastered)throw Error();
    const attemptIds=new Set(),rounds={},voteCounts={};
    for(const a of s.attempts){
      if(typeof a.id!=='string'||!a.id||attemptIds.has(a.id)||!order.includes(a.part)||!Array.isArray(a.ids)||typeof a.shuffled!=='boolean'||![null,'manual','automatic'].includes(a.passReason)||!a.opened||!a.votes)throw Error();
      attemptIds.add(a.id);rounds[a.part]=(rounds[a.part]||0)+1;if(a.round!==rounds[a.part])throw Error();
      const expected=book.bank.filter(e=>Study.key(e)===a.part).map(e=>e.id);
      if(a.ids.length!==expected.length||new Set(a.ids).size!==expected.length||a.ids.some(id=>!expected.includes(id)))throw Error();
      const groups=Study.groups(book.bank,a);
      if(!Number.isInteger(a.group)||a.group<0||a.group>=groups.length||JSON.stringify(groups.flatMap(g=>g.ids))!==JSON.stringify(a.ids))throw Error();
      if(!a.shuffled&&JSON.stringify(expected)!==JSON.stringify(a.ids))throw Error();
      for(const [id,open] of Object.entries(a.opened))if(!a.ids.includes(id)||typeof open!=='boolean')throw Error();
      for(const [id,vote] of Object.entries(a.votes)){if(!a.ids.includes(id)||!['good','bad'].includes(vote))throw Error();voteCounts[id]||={good:0,bad:0};voteCounts[id][vote]++;}
    }
    for(const [id,c] of Object.entries(s.stats))if(!dictionary.has(id)||!c||!['good','bad'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0&&(c[k]>=(voteCounts[id]?.[k]||0))))throw Error();
    for(const id of Object.keys(voteCounts))if(!s.stats[id])throw Error();
    for(const [part,m] of Object.entries(s.mastered)){const a=s.attempts.find(a=>a.id===m?.attemptId&&a.part===part);if(!a||!['manual','automatic'].includes(m.reason)||a.passReason!==m.reason||m.reason==='automatic'&&a.ids.some(id=>a.votes[id]!=='good'))throw Error();}
    if(s.current!==Object.keys(s.mastered).length||s.completed!==(s.current===order.length))throw Error();
    return s;
  }catch{return null;}
}

export function convertClassicMain(raw,book){
  if(book.id!=='edito-b1')return null;
  const old=globalThis.TextbookCore.restore(raw,book.bank);if(!old)return null;
  const s=Study.create(book.bank,book.level),rounds={};
  s.attempts=old.attempts.map(a=>({...a,round:rounds[a.part]=(rounds[a.part]||0)+1,shuffled:false}));
  s.view=old.view;s.stats=old.stats;s.mastered=Object.fromEntries(Object.entries(old.mastered).filter(([p])=>old.order.slice(0,old.current).includes(p)));
  s.current=Object.keys(s.mastered).length;s.completed=s.current===s.order.length;s.round=s.attempts.length;
  return restoreStudy(s,book);
}
