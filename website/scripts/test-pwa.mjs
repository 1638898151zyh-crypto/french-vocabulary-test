import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {freshMulti} from '../src/multi-learning.js';
import {LAST_ACCOUNT,rememberLocalAccount,readLocalAccount} from '../src/offline-account.js';
import * as Study from '../src/preview-study.js';

test('manifest has standalone launch, stable scope and real correctly sized icons',()=>{
 const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
 assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/#/home');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){const png=readFileSync('public'+icon.src),[size]=icon.sizes.split('x').map(Number);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
 assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));assert.ok(readFileSync('index.html','utf8').includes('apple-touch-icon'));
});
function worker(){
 const handlers=new Map(),stores=new Map([['franmo-app-old',new Map()],['other-app',new Map()]]);let skipped=0,claimed=0;
 const cache={addAll:async files=>{for(const file of files)stores.get('franmo-app-test').set(new URL(file.url).pathname,new Response(file.url.endsWith('index.html')?'offline shell':'asset'));},match:async path=>stores.get('franmo-app-test').get(path)?.clone()};
 const self={location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers.set(name,fn),skipWaiting:()=>skipped++,clients:{claim:async()=>claimed++}};
 const script=readFileSync('src/service-worker.js','utf8').replace('__CACHE_VERSION__','test').replace('__PRECACHE_FILES__',JSON.stringify(['/index.html','/assets/app.js','/favicon.svg']));
 const WrappedRequest=class extends Request{constructor(url,options){super(new URL(url,'https://example.test'),options);}};
 vm.runInNewContext(script,{self,caches:{open:async key=>{if(!stores.has(key))stores.set(key,new Map());return cache;},keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key)},Request:WrappedRequest,URL,fetch:async()=>{throw Error('offline');}});
 return {handlers,stores,skipped:()=>skipped,claimed:()=>claimed,async event(name){let promise;handlers.get(name)({waitUntil:p=>promise=p});await promise;},async fetch(path,options={}){let response;handlers.get('fetch')({request:{url:new URL(path,self.location.origin).href,method:'GET',mode:'cors',...options},respondWith:r=>response=r});return response?await response:null;}};
}
test('offline shell and build assets survive navigation; private APIs, previews and writes bypass cache',async()=>{
 const w=worker();await w.event('install');assert.equal(w.skipped(),0);
 assert.equal(await (await w.fetch('/#/study',{mode:'navigate'})).text(),'offline shell');assert.equal(await (await w.fetch('/assets/app.js')).text(),'asset');
 for(const [path,options] of [['/api/multi-progress',{}],['/api/avatar/abc.png',{}],['/.netlify/identity/user',{}],['/textbooks-preview.html',{mode:'navigate'}],['https://other.test/assets/app.js',{}],['/assets/app.js',{method:'POST'}]])assert.equal(await w.fetch(path,options),null);
 await w.event('activate');assert.equal(w.claimed(),1);assert.ok(!w.stores.has('franmo-app-old'));assert.ok(w.stores.has('other-app'));
 w.handlers.get('message')({data:{type:'IGNORE'}});assert.equal(w.skipped(),0);w.handlers.get('message')({data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.skipped(),1);
});
test('production worker precaches every generated script, stylesheet and manifest icon',()=>{
 assert.ok(existsSync('dist/sw.js'),'Run npm run build before test:pwa');const sw=readFileSync('dist/sw.js','utf8');assert.ok(!sw.includes('__PRECACHE_FILES__'));const list=JSON.parse(sw.match(/const FILES=(.*);/)[1]);
 for(const file of list)assert.ok(existsSync('dist'+file),file+' is missing');
 assert.ok(list.includes('/index.html'));assert.ok(list.includes('/manifest.webmanifest'));assert.ok(list.some(file=>file.startsWith('/assets/browser-')));
 const html=readFileSync('dist/index.html','utf8');for(const path of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g))assert.ok(list.includes(path[1]));
});
test('local account selector stores display data only, rejects invalid records and clears on logout',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 rememberLocalAccount({id:'test-user',name:'Alain',email:'a@example.test',password:'never-store',token:'never-store'},storage);
 assert.deepEqual(Object.keys(JSON.parse(map.get(LAST_ACCOUNT))).sort(),['email','id','name','pictureUrl']);assert.equal(readLocalAccount(storage).id,'test-user');
 map.set(LAST_ACCOUNT,'{"id":"../../other","name":"Alain"}');assert.equal(readLocalAccount(storage),null);rememberLocalAccount(null,storage);assert.equal(map.size,0);
});

const auth=`export const getUser=async()=>{window.authReads++;return window.testIdentity;},refreshSession=async()=>{window.authReads++;},getSettings=async()=>({disableSignup:false}),handleAuthCallback=async()=>null,onAuthChange=()=>()=>{},login=async()=>{},signup=async()=>({}),logout=async()=>{},requestPasswordRecovery=async()=>{},updateUser=async()=>{},acceptInvite=async()=>{};`;
const ui=await build({entryPoints:['src/site.jsx'],bundle:true,write:false,format:'iife',platform:'browser',define:{'import.meta.env.PROD':'false'},loader:{'.css':'empty'},logLevel:'silent',plugins:[{name:'identity-fixture',setup(b){b.onResolve({filter:/^@netlify\/identity$/},()=>({path:'identity',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:auth,loader:'js'}));}}]});
const pause=(ms=100)=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForLocalAccount(w){
 const deadline=Date.now()+2000;
 while(Date.now()<deadline){if(w.document.querySelector('.dp-user')?.textContent.includes('离线账号记录'))return;await pause(25);}
 assert.fail('The offline account did not finish rendering within 2 seconds');
}
function offlineBrowser(withAccount=true){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/#/home',runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window;
 w.structuredClone=structuredClone;w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});Object.defineProperty(w.navigator,'onLine',{configurable:true,value:false});
 w.testIdentity={id:'test-user',name:'Alain',email:'a@example.test'};w.authReads=0;w.requests=[];
 const own=freshMulti(),bank=own.books.find(book=>book.id==='edito-b1').bank,state=own.progress['edito-b1'],id=Study.active(state).ids[0];Study.toggle(state,id);Study.vote(state,id,'good');
 w.cloud=structuredClone(own);w.cloudEtag='old-etag';
 w.fetch=async(url,options={})=>{w.requests.push({url,options});return {ok:true,status:200,json:async()=>options.method==='PUT'?{etag:'saved-etag'}:{data:w.cloud,etag:w.cloudEtag}};};
 const guest=JSON.stringify({bundle:freshMulti(),dirty:false,etag:null});w.localStorage.setItem('franmo-atelier:v2:guest',guest);
 if(withAccount){rememberLocalAccount(w.testIdentity,w.localStorage);w.localStorage.setItem('franmo-atelier:v2:user:test-user',JSON.stringify({bundle:own,dirty:false,etag:'old-etag'}));}
 w.eval(ui.outputFiles[0].text);return {dom,w,guest};
}
async function voteAgain(w){w.location.hash='/study';await pause();const doc=w.document;if(doc.querySelector('.dp-word-trigger').getAttribute('aria-expanded')!=='true')doc.querySelector('.dp-word-trigger').click();await pause();doc.querySelector('.dp-votes .bad').click();await pause();}
test('offline restart restores local account scores without authentication or network calls; edits remain in its scope',async()=>{
 const {dom,w,guest}=offlineBrowser();try{await waitForLocalAccount(w);assert.equal(w.authReads,0);assert.equal(w.requests.length,0);assert.match(w.document.querySelector('.dp-user').textContent,/Alain.*离线账号记录/);assert.deepEqual([...w.document.querySelectorAll('.np-activity strong')].map(n=>n.textContent),['1','1']);
 await voteAgain(w);const saved=JSON.parse(w.localStorage.getItem('franmo-atelier:v2:user:test-user'));assert.ok(saved.dirty);assert.equal(Object.values(saved.bundle.progress['edito-b1'].stats)[0].bad,1);assert.equal(w.localStorage.getItem('franmo-atelier:v2:guest'),guest);assert.equal(w.requests.length,0);
 w.document.querySelector('.ac-trigger').click();await pause();assert.match(w.document.querySelector('.ac-profile').textContent,/需联网验证/);w.document.querySelector('.ac-logout').click();await pause();assert.equal(w.localStorage.getItem(LAST_ACCOUNT),null);assert.ok(w.localStorage.getItem('franmo-atelier:v2:user:test-user'));assert.ok(w.document.querySelector('.ac-trigger.guest'));
 }finally{dom.window.close();}
});
test('reconnection authenticates and checks ETag before uploading local edits',async()=>{
 const {dom,w}=offlineBrowser();try{await pause();await voteAgain(w);Object.defineProperty(w.navigator,'onLine',{value:true,configurable:true});w.dispatchEvent(new w.Event('online'));await pause(1000);assert.ok(w.authReads>=2);assert.equal(w.requests[0].options.method,undefined);assert.equal(w.requests[1].options.method,'PUT');assert.equal(JSON.parse(w.requests[1].options.body).etag,'old-etag');assert.equal(JSON.parse(w.localStorage.getItem('franmo-atelier:v2:user:test-user')).dirty,false);
 }finally{dom.window.close();}
});
test('reconnection preserves dirty offline work when another device changed the cloud record',async()=>{
 const {dom,w}=offlineBrowser();try{await pause();await voteAgain(w);w.cloudEtag='another-device';Object.defineProperty(w.navigator,'onLine',{value:true,configurable:true});w.dispatchEvent(new w.Event('online'));await pause(900);assert.match(w.document.querySelector('.dp-user').textContent,/同步冲突/);assert.ok(!w.requests.some(request=>request.options.method==='PUT'));assert.equal(Object.values(JSON.parse(w.localStorage.getItem('franmo-atelier:v2:user:test-user')).bundle.progress['edito-b1'].stats)[0].bad,1);
 }finally{dom.window.close();}
});
test('offline guest can reconnect and regain the login form without reloading or losing local work',async()=>{
 const {dom,w}=offlineBrowser(false);try{await pause();assert.equal(w.authReads,0);Object.defineProperty(w.navigator,'onLine',{value:true,configurable:true});w.dispatchEvent(new w.Event('online'));await pause();w.document.querySelector('.ac-trigger').click();await pause();assert.ok(w.document.querySelector('input[type=email]'));
 }finally{dom.window.close();}
});
