import {validateEntries,makeImportedBook,vocabularySummary,sameVocabulary} from './vocabulary-import.js';
import {downloadText} from './vocabulary-guide.js';
import * as Study from './preview-study.js';
import {D,V,practiceBank,eligible,restoreStudy,convertClassicMain} from './preview-review.js';

const safeId=id=>typeof id==='string'&&id.length>0&&id.length<=150&&!['__proto__','prototype','constructor'].includes(id);
export function fullBackup(books,progress,settings,bookId,secondary,theme){return {version:1,mode:'multi-atelier-preview',exportedAt:new Date().toISOString(),bookId,books,progress,settings,secondary,theme};}
export function mainBackup(book,main){return {version:1,mode:'multi-atelier-main',exportedAt:new Date().toISOString(),book,main};}
function restoreBook(b,existing){
  if(!safeId(b?.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>48||!['A1','A2','B1','B2','C1','C2','自由'].includes(b.level)||typeof b.edition!=='string'||b.edition.length>80)throw Error('课本信息无效。');
  const known=existing.find(e=>e.id===b.id);
  if(known&&(known.supplied||['edito-b1','my-notebook'].includes(b.id))){if(!b.bank||!sameVocabulary(b.bank,known.bank))throw Error('备份中的内置词库与网站版本不一致，请使用匹配的进度文件。');return known;}
  if(!b.bank)return {id:b.id,name:b.name,series:b.name,level:b.level,edition:b.edition,status:'pending',color:'sand',subtitle:'等待导入词库。'};
  const entries=validateEntries(b.bank);return {...makeImportedBook({entries,summary:vocabularySummary(entries),filename:b.sourceFilename||''},b,b.id),remember:false};
}
function restoreSecondary(raw,book,main){
  const r={daily:null,practice:null,dailyHistory:[],practiceHistory:[],dailyAllowed:eligible(main)};if(!raw)return r;
  const validRound=(q,allowed)=>Number.isSafeInteger(q?.round)&&q.round>=1&&typeof q.launchId==='string'&&q.launchId.length>0&&/^\d{4}-\d{2}-\d{2}$/.test(q.day)&&D.validRound(q,book.bank,allowed);
  if(raw.daily){if(!validRound(raw.daily,eligible(main)))throw Error(`${book.name} 的每日检测记录无效。`);r.daily=structuredClone(raw.daily);}
  if(raw.practice){r.practice=V.restore(raw.practice,practiceBank(book));if(!r.practice)throw Error(`${book.name} 的普通检测记录无效。`);}
  if(raw.dailyStats){r.dailyStats=structuredClone(raw.dailyStats);for(const [id,c] of Object.entries(r.dailyStats))if(!book.bank.some(e=>e.id===id)||!c||!['good','bad'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0))throw Error('每日累计记录无效。');}
  if(raw.dailySerial!==undefined){if(!Number.isSafeInteger(raw.dailySerial)||raw.dailySerial<0)throw Error('每日轮次无效。');r.dailySerial=raw.dailySerial;}
  for(const mode of ['daily','practice']){const history=raw[mode+'History']||[];if(!Array.isArray(history)||history.length>20)throw Error('复习历史格式无效。');r[mode+'History']=history.map(h=>{if(mode==='daily'){if(!Array.isArray(h.allowed)||new Set(h.allowed).size!==h.allowed.length||h.allowed.some(p=>!main.order.includes(p))||!validRound(h.round,h.allowed))throw Error('每日检测历史无效。');return structuredClone(h);}const restored=V.restore(h,practiceBank(book));if(!restored)throw Error('普通检测历史无效。');return restored;});}
  return r;
}
export function readBackup(raw,existing,current){
  const data=typeof raw==='string'?JSON.parse(raw):raw;
  if(['multi-atelier-preview','multi-atelier'].includes(data?.mode)){
    if(data.mode==='multi-atelier'){if(data.version!==2)throw Error('备份版本无效。');return readBackup({...data,version:1,mode:'multi-atelier-preview'},existing,current);}
    if(data.version!==1||!Array.isArray(data.books)||!data.books.length||data.books.length>35||!data.progress||!data.settings||!['classic','right'].includes(data.settings.layout)||typeof data.settings.shuffle!=='boolean')throw Error('完整备份格式无效。');
    const ids=new Set(),saved=data.books.map(b=>{if(ids.has(b.id))throw Error('备份中存在重复课本。');ids.add(b.id);return restoreBook(b,existing);});
    const books=[...existing.filter(b=>!ids.has(b.id)),...saved],progress={...current},secondary={};
    for(const b of saved)if(b.bank){const s=restoreStudy(data.progress[b.id],b);if(!s)throw Error(`${b.name} 的主进度或词条累计记录无效。`);progress[b.id]=s;secondary[b.id]=restoreSecondary(data.secondary?.[b.id],b,s);}
    if(!books.some(b=>b.id===data.bookId))throw Error('选中的课本不存在。');
    return {books,progress,secondary,bookId:data.bookId,settings:{layout:data.settings.layout,shuffle:data.settings.shuffle},theme:['light','dark','system'].includes(data.theme)?data.theme:'light',label:'多课本完整备份'};
  }
  if(data?.mode==='multi-atelier-main'){
    if(data.version!==1)throw Error('主进度版本无效。');
    const book=restoreBook(data.book,existing),s=book.bank&&restoreStudy(data.main,book);if(!s)throw Error('课本主进度或累计记录无效。');
    return {books:existing.some(b=>b.id===book.id)?existing.map(b=>b.id===book.id?book:b):[...existing,book],progress:{...current,[book.id]:s},bookId:book.id,secondary:{[book.id]:{daily:null,practice:null}},label:`${book.name} 主进度`};
  }
  const book=existing.find(b=>b.id==='edito-b1'),main=book&&convertClassicMain(data?.mode==='atelier'?data.main:data,book);
  if(main)return {books:existing,progress:{...current,[book.id]:main},bookId:book.id,secondary:{[book.id]:{daily:null,practice:null}},label:'原 Édito B1 网站 / 插件主进度'};
  throw Error('请选择有效的网站备份、旧版网站完整备份或插件主进度文件。');
}
export function downloadJSON(data,filename){downloadText(filename,JSON.stringify(data,null,2),'application/json');}
