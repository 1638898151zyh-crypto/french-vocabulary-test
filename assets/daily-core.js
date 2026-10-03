(() => {
'use strict';
const MAIN_KEY='french-vocabulary-test:edito-b1:main:textbook:v1';
const DAILY_KEY='french-vocabulary-test:edito-b1:secondary:daily:v1';
function eligible(raw,bank){
 const main=TextbookCore.restore(raw,bank);if(!main)return [];
 // A rolled-back main checkpoint is an upper bound even if later pass history remains.
 return main.order.slice(0,main.current).filter(p=>main.mastered[p]);
}
function shuffle(xs,rng=Math.random){const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function themeKey(e){return TextbookCore.key(e)+'::'+String(e.group||'').trim();}
function themes(bank,part){const map=new Map();for(const e of bank){if(TextbookCore.key(e)!==part||!String(e.group||'').trim())continue;const key=themeKey(e);if(!map.has(key))map.set(key,{key,label:String(e.group).trim(),ids:[]});map.get(key).ids.push(e.id);}return [...map.values()].filter(t=>t.ids.length>=10);}
function problem(bank,allowed){
 if(allowed.length<4)return '需要至少过关 4 个 Part 才能生成完整的 5 组。请继续“课本单词检测”，或导入已有主进度记录。';
 const latest=themes(bank,allowed.at(-1));
 if(latest.length<2&&!latest.some(t=>t.ids.length>=20))return `${allowed.at(-1)} 的主题词数不足以生成两组各10个不同词条。需要两个至少10词的主题，或一个至少20词的主题；不会跨主题拼凑。`;
 for(const part of allowed.slice(-3,-1))if(!themes(bank,part).length)return `${part} 尚无至少10词的单一主题，无法按规则生成完整五组；不会跨主题或未过关 Part 补词。`;
 if(!allowed.slice(0,-3).some(part=>themes(bank,part).length))return '其余已过关 Part 尚无至少10词的主题，无法生成第5组。';
 return null;
}
function select(bank,allowed,rng=Math.random){
 if(problem(bank,allowed))return null;
 const latest=allowed.at(-1),second=allowed.at(-2),third=allowed.at(-3),older=allowed.slice(0,-3).filter(p=>themes(bank,p).length);
 const pick=xs=>xs[Math.floor(rng()*xs.length)],other=pick(older),latestThemes=themes(bank,latest);
 // Prefer two distinct themes; a single theme needs 20 unique entries to supply both groups.
 const firstTwo=latestThemes.length>=2?shuffle(latestThemes,rng).slice(0,2):[pick(latestThemes.filter(t=>t.ids.length>=20))];
 const chosen=[firstTwo[0],firstTwo[1]||firstTwo[0],pick(themes(bank,second)),pick(themes(bank,third)),pick(themes(bank,other))];
 const firstPool=shuffle(chosen[0].ids,rng),groups=chosen.map((t,i)=>i===0?firstPool.slice(0,10):i===1&&t.key===chosen[0].key?firstPool.slice(10,20):shuffle(t.ids,rng).slice(0,10));
 return {parts:[latest,latest,second,third,other],themeKeys:chosen.map(t=>t.key),themes:chosen.map(t=>t.label),ids:groups.flat()};
}
function validRound(s,bank,allowed){
 if(!s||s.mode!=='daily'||s.version!==1||!Array.isArray(s.ids)||s.ids.length!==50||new Set(s.ids).size!==50||!Array.isArray(s.parts)||s.parts.length!==5||!Array.isArray(s.themeKeys)||s.themeKeys.length!==5||!Array.isArray(s.themes)||s.themes.length!==5||!s.opened||!s.votes||!s.stats||!Number.isInteger(s.group)||s.group<0||s.group>4)return false;
 const map=new Map(bank.map(e=>[e.id,e])),last=allowed.slice(-3);
 if(last.length!==3||s.parts[0]!==last[2]||s.parts[1]!==last[2]||s.parts[2]!==last[1]||s.parts[3]!==last[0]||!allowed.slice(0,-3).includes(s.parts[4]))return false;
 if(s.ids.some((id,i)=>{const e=map.get(id),g=Math.floor(i/10);return !e||TextbookCore.key(e)!==s.parts[g]||themeKey(e)!==s.themeKeys[g]||String(e.group).trim()!==s.themes[g];}))return false;
 for(const [id,v] of Object.entries(s.opened))if(!s.ids.includes(id)||typeof v!=='boolean')return false;
 for(const [id,v] of Object.entries(s.votes))if(!s.ids.includes(id)||!['good','bad'].includes(v)||!s.stats[id]||s.stats[id][v]<1)return false;
 for(const [id,c] of Object.entries(s.stats))if(!map.has(id)||!Number.isSafeInteger(c.good)||!Number.isSafeInteger(c.bad)||c.good<0||c.bad<0)return false;
 return true;
}
function create(bank,allowed,launchId,day,previous=null,rng=Math.random){
 const sample=select(bank,allowed,rng);if(!sample)return null;
 const map=new Map(bank.map(e=>[e.id,e])),stats={};
 for(const [id,c] of Object.entries(previous?.stats||{}))if(map.has(id)&&allowed.includes(TextbookCore.key(map.get(id)))&&Number.isSafeInteger(c.good)&&Number.isSafeInteger(c.bad)&&c.good>=0&&c.bad>=0)stats[id]={...c};
 return {version:1,mode:'daily',launchId,day,round:(Number.isSafeInteger(previous?.round)?previous.round:0)+1,...sample,group:0,opened:{},votes:{},stats};
}
function toggle(s,id){if(!s?.ids.includes(id))return false;s.opened[id]=!s.opened[id];return true;}
function vote(s,id,kind){if(!s?.ids.includes(id)||!s.opened[id]||!['good','bad'].includes(kind)||s.votes[id]===kind)return false;const c=s.stats[id]||{good:0,bad:0},old=s.votes[id];if(c[kind]>=Number.MAX_SAFE_INTEGER||old&&c[old]<1)return false;s.stats[id]={...c,[kind]:c[kind]+1};if(old)s.stats[id][old]--;s.votes[id]=kind;return true;}
function totals(s){const vs=s.ids.map(id=>s.votes[id]);return {opened:s.ids.filter(id=>s.opened[id]).length,done:vs.filter(Boolean).length,good:vs.filter(v=>v==='good').length,bad:vs.filter(v=>v==='bad').length};}
globalThis.DailyCore=Object.freeze({MAIN_KEY,DAILY_KEY,eligible,themeKey,themes,problem,select,validRound,create,toggle,vote,totals});
})();
