import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {freshMulti,restoreMulti,migrateClassic} from '../src/multi-learning.js';
import {fresh,bookAction,currentAttempt,makeDaily,D,V} from '../src/engine.js';
import * as Study from '../src/preview-study.js';

test('production backup retains independent books, retakes, preferences and cumulative counts',()=>{
 const s=freshMulti(),b=s.books.find(b=>b.id==='edito-a2-2022'),main=s.progress[b.id];
 Study.selectPart(main,b.bank,'U2P1');const id=Study.active(main).ids[0];Study.toggle(main,id);Study.vote(main,id,'bad');Study.repeat(main,b.bank);Study.toggle(main,id);Study.vote(main,id,'good');
 s.settings={layout:'right',shuffle:true};s.theme='dark';s.bookId=b.id;
 const r=restoreMulti(JSON.stringify(s));assert.ok(r);assert.deepEqual(r.progress[b.id].stats[id],{good:1,bad:1});assert.deepEqual(r.progress['edito-b1'].stats,{});assert.deepEqual(r.settings,s.settings);assert.equal(r.bookId,b.id);assert.equal(r.theme,'dark');
});
test('invalid counters and substituted built-in banks cannot restore',()=>{
 const s=freshMulti();s.progress['edito-b1'].stats.unknown={good:2,bad:0};assert.equal(restoreMulti(s),null);
 const b=structuredClone(freshMulti());b.books[0].bank[0].zh='substitute';assert.equal(restoreMulti(b),null);
});
test('old full backup migrates main, daily and ordinary records without altering source',()=>{
 let old=fresh();for(let i=0;i<4;i++)old=bookAction(old,currentAttempt(old.main).id,'pass');old=makeDaily(old).state;
 const id=old.daily.ids[0];D.toggle(old.daily,id);D.vote(old.daily,id,'bad');old.dailyStats=structuredClone(old.daily.stats);old.dailySerial=old.daily.round;old=makeDaily(old).state;
 const before=JSON.stringify(old),s=migrateClassic(old);assert.ok(s);assert.equal(JSON.stringify(old),before);assert.equal(s.progress['edito-b1'].current,4);assert.deepEqual(s.secondary['edito-b1'].dailyStats,old.dailyStats);assert.deepEqual(s.secondary['edito-b1'].dailyHistory,old.dailyHistory);for(const key of ['ids','votes','stats','round','group'])assert.deepEqual(s.secondary['edito-b1'].practice[key],old.ordinary[key]);
});
test('cloud API isolates accounts and deployments, migrates read-only, validates origin and ETags',async()=>{
 const base=resolve('.netlify'),dir=await mkdtemp(join(base,'multi-api-test-'));assert.ok(dir.startsWith(base));
 const records=new Map();globalThis.multiApiFixture={records,user:null,seq:0};
 const mockIdentity=`export class AuthError extends Error{};export const getUser=async()=>globalThis.multiApiFixture.user;export function verifyRequestOrigin(req){if(req.headers.get('Origin')!==new URL(req.url).origin)throw new AuthError();}`;
 const mockBlobs=`function store(prefix){const f=globalThis.multiApiFixture;return {get:async k=>f.records.get(prefix+k)?.data||null,getWithMetadata:async k=>f.records.get(prefix+k)||null,setJSON:async(k,data,o)=>{k=prefix+k;const old=f.records.get(k);if(o.onlyIfNew&&old||o.onlyIfMatch&&old?.etag!==o.onlyIfMatch)return {modified:false};const etag=String(++f.seq);f.records.set(k,{data,etag});return {modified:true,etag};}}}export const getStore=o=>store('production:'+o.name+':'),getDeployStore=o=>store('preview:'+o.name+':');`;
 try{
 await build({entryPoints:['netlify/functions/multi-progress.mts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'api.mjs'),logLevel:'silent',plugins:[{name:'mock',setup(b){b.onResolve({filter:/^@netlify\/(identity|blobs)$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.endsWith('identity')?mockIdentity:mockBlobs,loader:'js'}));}}]});
 const api=(await import(pathToFileURL(join(dir,'api.mjs')))).default,context={deploy:{context:'production'}},req=(method='GET',data,etag=null,origin='https://example.test')=>new Request('https://example.test/api/multi-progress',{method,headers:{Origin:origin},...(method==='PUT'?{body:JSON.stringify({data,etag})}:{})});
 assert.equal((await api(req(),context)).status,401);globalThis.multiApiFixture.user={id:'a'};const legacy=fresh();records.set('production:edito-progress:user/a',{data:legacy,etag:'legacy'});
 const migration=await (await api(req(),context)).json();assert.equal(migration.data.mode,'multi-atelier');assert.equal(migration.etag,null);assert.equal(records.size,1);assert.deepEqual(records.get('production:edito-progress:user/a').data,legacy);
 const saved=await api(req('PUT',freshMulti()),context);assert.equal(saved.status,200);const etag=(await saved.json()).etag;assert.equal((await api(req('PUT',freshMulti()),context)).status,409);assert.equal((await api(req('PUT',freshMulti(),etag,'https://other.test'),context)).status,403);assert.equal((await api(req('PUT',{mode:'bad'},etag),context)).status,400);
 assert.equal((await api(req('PUT',freshMulti(),etag),context)).status,200);globalThis.multiApiFixture.user={id:'b'};assert.equal((await (await api(req(),context)).json()).data,null);globalThis.multiApiFixture.user={id:'a'};assert.equal((await (await api(req(),{deploy:{context:'deploy-preview'}})).json()).data,null);
 }finally{delete globalThis.multiApiFixture;await rm(dir,{recursive:true,force:true});}
});

const authMock=`export const getUser=async()=>null,getSettings=async()=>({disableSignup:false}),handleAuthCallback=async()=>null,refreshSession=async()=>null,onAuthChange=()=>()=>{},login=async()=>{},signup=async()=>({}),logout=async()=>{},requestPasswordRecovery=async()=>{},updateUser=async()=>{},acceptInvite=async()=>{};`;
const ui=await build({entryPoints:['src/site.jsx'],bundle:true,write:false,platform:'browser',format:'iife',loader:{'.css':'empty'},logLevel:'silent',plugins:[{name:'auth',setup(b){b.onResolve({filter:/^@netlify\/identity$/},()=>({path:'auth',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:authMock,loader:'js'}));}}]});
function browser(cache={}){const d=new JSDOM('<div id="root"></div>',{url:'https://example.test/#/home',pretendToBeVisual:true,runScripts:'dangerously'});d.window.structuredClone=structuredClone;d.window.scrollTo=()=>{};d.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});for(const [k,v] of Object.entries(cache))d.window.localStorage.setItem(k,v);d.window.eval(ui.outputFiles[0].text);return d;}
const wait=()=>new Promise(r=>setTimeout(r,100));
test('formal UI persists actual scores and restores them after browser reload',async()=>{
 let d=browser();try{await wait();assert.ok(d.window.document.querySelector('.dp-production'));assert.equal(d.window.document.querySelector('.dp-preview-bar'),null);d.window.location.hash='/study';await wait();const doc=d.window.document;doc.querySelector('.dp-word-trigger').click();await wait();doc.querySelector('.dp-votes .good').click();await wait();const raw=d.window.localStorage.getItem('franmo-atelier:v2:guest'),data=JSON.parse(raw).bundle;assert.equal(Object.values(data.progress['edito-b1'].stats)[0].good,1);assert.ok(restoreMulti(data));d.window.close();d=browser({'franmo-atelier:v2:guest':raw});await wait();assert.deepEqual([...d.window.document.querySelectorAll('.np-activity strong')].map(n=>n.textContent),['1','1']);}finally{d.window.close();}
});
test('old local cache migrates without changing its original contents',async()=>{
 let old=fresh();old=bookAction(old,currentAttempt(old.main).id,'pass');const raw=JSON.stringify({bundle:old,dirty:false,etag:'old-etag'}),d=browser({'edito-atelier:v1:guest':raw});try{await wait();const s=JSON.parse(d.window.localStorage.getItem('franmo-atelier:v2:guest')).bundle;assert.equal(s.progress['edito-b1'].current,1);assert.equal(d.window.localStorage.getItem('edito-atelier:v1:guest'),raw);assert.match(d.window.document.querySelector('.np-progress').textContent,/1 \/ 24 Part/);}finally{d.window.close();}
});

test('multi-book production restores user, switching cancels without logout, failed login preserves account, logout clears session',async()=>{
 const mock=`const listeners=new Set();export const getUser=async()=>window.testIdentityUser;export const refreshSession=async()=>{window.testRefreshCalls++;};export const getSettings=async()=>({disableSignup:false});export const handleAuthCallback=async()=>null;export const onAuthChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};export const login=async(email,password)=>{window.testLoginCalls++;if(password==='wrong')throw {status:401};window.testIdentityUser={id:'test-b',email,name:'Camille'};for(const fn of listeners)fn('login',window.testIdentityUser);return window.testIdentityUser;};export const logout=async()=>{window.testLogoutCalls++;window.testIdentityUser=null;for(const fn of listeners)fn('logout',null);};export const signup=async()=>({}),requestPasswordRecovery=async()=>{},updateUser=async()=>{},acceptInvite=async()=>{};`;
 const bundle=await build({entryPoints:['src/site.jsx'],bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'},plugins:[{name:'identity-fixture',setup(b){b.onResolve({filter:/^@netlify\/identity$/},()=>({path:'identity',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js'}));}}],logLevel:'silent'});
 const dom=new JSDOM('<!DOCTYPE html><div id="root"></div>',{url:'https://example.test/#/home',pretendToBeVisual:true,runScripts:'dangerously'}),w=dom.window,doc=w.document;
 w.testIdentityUser={id:'test-a',name:'Alain',email:'a@example.test'};w.testRefreshCalls=0;w.testLogoutCalls=0;w.testLoginCalls=0;w.structuredClone=structuredClone;w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.fetch=async()=>({ok:true,json:async()=>({data:null,etag:null})});
 const pause=()=>new Promise(r=>setTimeout(r,70)),click=async el=>{assert.ok(el);el.click();await pause();};
 const input=(selector,value)=>{const el=doc.querySelector(selector);assert.ok(el);Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 try{
 w.eval(bundle.outputFiles[0].text);await pause();await pause();assert.ok(w.testRefreshCalls>0);assert.ok(doc.querySelector('.ac-trigger.signed-in'));assert.equal(doc.querySelector('[role=dialog]'),null);
 await click(doc.querySelector('.ac-trigger'));assert.deepEqual([...doc.querySelectorAll('[role=menuitem]')].map(e=>e.textContent),['切换账号','设置','退出登录']);assert.ok(doc.querySelector('.ac-logout'));
 await click(doc.querySelector('[role=menuitem]'));assert.match(doc.querySelector('[role=dialog]').textContent,/切换学习账号/);assert.ok(doc.querySelector('input[type=password]'));assert.match(doc.querySelector('[role=dialog]').textContent,/默认保持登录/);assert.equal(w.testLogoutCalls,0);
 await click(doc.querySelector('.modal-close'));assert.equal(w.testIdentityUser.id,'test-a');assert.equal(w.testLogoutCalls,0);
 await click(doc.querySelector('.ac-trigger'));await click(doc.querySelector('[role=menuitem]'));input('input[type=email]','b@example.test');input('input[type=password]','wrong');await pause();doc.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();assert.match(doc.querySelector('[role=dialog]').textContent,/邮箱或密码不正确/);assert.equal(w.testIdentityUser.id,'test-a');assert.equal(w.testLogoutCalls,0);
 input('input[type=password]','valid-test-password');await pause();doc.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();await pause();assert.equal(w.testIdentityUser.id,'test-b');assert.equal(doc.querySelector('[role=dialog]'),null);assert.equal(w.testLogoutCalls,0);
 await click(doc.querySelector('.ac-trigger'));assert.match(doc.querySelector('.ac-profile').textContent,/Camille/);await click(doc.querySelectorAll('[role=menuitem]')[1]);assert.equal(w.location.hash,'#/settings');assert.equal(doc.querySelector('.ac-popover'),null);
 await click(doc.querySelector('.ac-trigger'));await click(doc.querySelector('.ac-logout'));assert.equal(w.testLogoutCalls,1);assert.equal(w.testIdentityUser,null);assert.ok(doc.querySelector('.ac-trigger.guest'));assert.equal(doc.querySelector('.ac-popover'),null);
 }finally{w.close();}
});
