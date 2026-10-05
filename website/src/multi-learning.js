import {initialBooks} from './books.js';
import * as Study from './preview-study.js';
import {readBackup} from './preview-backup.js';
import {restoreBundle} from './engine.js';

export function freshMulti(){
  return {version:2,mode:'multi-atelier',books:initialBooks,progress:Object.fromEntries(initialBooks.filter(b=>b.bank).map(b=>[b.id,Study.create(b.bank,b.level)])),secondary:{},bookId:'edito-b1',settings:{...Study.DEFAULT_SETTINGS},theme:'light',generation:crypto.randomUUID(),updatedAt:new Date().toISOString()};
}
export function touchMulti(s){return {...s,generation:crypto.randomUUID(),updatedAt:new Date().toISOString()};}
export function restoreMulti(raw){
  try{
    const s=typeof raw==='string'?JSON.parse(raw):raw;
    if(s?.version!==2||s.mode!=='multi-atelier'||typeof s.generation!=='string'||!s.generation||!Number.isFinite(Date.parse(s.updatedAt)))return null;
    const base=freshMulti(),restored=readBackup({...s,version:1,mode:'multi-atelier-preview'},initialBooks,base.progress);
    return {...restored,version:2,mode:'multi-atelier',generation:s.generation,updatedAt:s.updatedAt};
  }catch{return null;}
}
export function migrateClassic(raw){
  const old=restoreBundle(raw);if(!old)return null;
  const s=freshMulti(),converted=readBackup(old,initialBooks,s.progress);
  s.progress=converted.progress;
  s.secondary['edito-b1']={daily:old.daily,practice:old.ordinary,dailyHistory:old.dailyHistory,practiceHistory:old.ordinaryHistory,dailyAllowed:s.progress['edito-b1'].order.filter(p=>s.progress['edito-b1'].mastered[p]),dailyStats:old.dailyStats,dailySerial:old.dailySerial};
  return restoreMulti(touchMulti(s));
}
