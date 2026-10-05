import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {profileName,avatarUrl,saveProfile,MAX_AVATAR_BYTES} from '../src/account-profile.js';

test('nickname trims whitespace and rejects empty, long and control-character names',()=>{
 assert.equal(profileName('  学法语 🍀  '),'学法语 🍀');for(const n of ['', ' '.repeat(5),'a'.repeat(41),'a\nb'])assert.throws(()=>profileName(n));
});
test('avatars permit uploaded paths and HTTPS provider images but reject unsafe URLs',()=>{
 assert.ok(avatarUrl({pictureUrl:'/api/avatar/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp'}));assert.ok(avatarUrl({pictureUrl:'https://example.test/image.png'}));for(const u of ['javascript:alert(1)','data:image/svg+xml,example','http://example.test/avatar','//other.test/image'])assert.equal(avatarUrl({pictureUrl:u}),'');
});
test('profile changes use Identity metadata and upload only the processed avatar',async()=>{
 const calls=[],identity={updateUser:async value=>{calls.push(value);return {id:'a',name:value.data.full_name,pictureUrl:value.data.avatar_url};}},url='/api/avatar/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp',blob=new Blob(['small'],{type:'image/webp'});
 const fetcher=async(path,options)=>{assert.equal(path,'/api/avatar');assert.equal(options.body,blob);assert.equal(options.credentials,'same-origin');assert.equal(options.headers['Content-Type'],'image/webp');return {ok:true,json:async()=>({url})};};
 await saveProfile({name:' 新昵称 ',file:blob},identity,fetcher);assert.deepEqual(calls.pop(),{data:{full_name:'新昵称',avatar_url:url}});
 await saveProfile({name:'只改昵称'},identity,()=>{throw Error('must not upload');});assert.deepEqual(calls.pop(),{data:{full_name:'只改昵称'}});
 await saveProfile({name:'移除头像',picture:''},identity);assert.equal(calls.pop().data.avatar_url,'');
 await assert.rejects(saveProfile({name:'姓名',file:blob},identity,async()=>({ok:false,json:async()=>({error:'上传失败'})})),/上传失败/);assert.equal(calls.length,0);
});
test('avatar API protects uploads, sniffs image types, bounds files and isolates preview storage',async()=>{
 const base=resolve('.netlify'),dir=await mkdtemp(join(base,'avatar-test-'));assert.ok(dir.startsWith(base));globalThis.avatarFixture={user:null,records:new Map()};
 const identity=`export class AuthError extends Error{};export const getUser=async()=>globalThis.avatarFixture.user;export function verifyRequestOrigin(req){if(req.headers.get('Origin')!==new URL(req.url).origin)throw new AuthError();}`;
 const blobs=`function store(prefix){const f=globalThis.avatarFixture;return {get:async k=>f.records.get(prefix+k)||null,set:async(k,v)=>f.records.set(prefix+k,v)}};export const getStore=()=>store('production:'),getDeployStore=()=>store('preview:');`;
 try{
 await build({entryPoints:['netlify/functions/avatar.mts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'api.mjs'),logLevel:'silent',plugins:[{name:'mock',setup(b){b.onResolve({filter:/^@netlify\/(identity|blobs)$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.endsWith('identity')?identity:blobs,loader:'js'}));}}]});
 const api=(await import(pathToFileURL(join(dir,'api.mjs')))).default,ctx={deploy:{context:'production'},params:{}},png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]),request=(body=png,type='image/png',origin='https://example.test')=>new Request('https://example.test/api/avatar',{method:'POST',headers:{'Content-Type':type,Origin:origin},body});
 assert.equal((await api(request(),ctx)).status,401);globalThis.avatarFixture.user={id:'a'};
 assert.equal((await api(request(png,'image/png','https://other.test'),ctx)).status,403);assert.equal((await api(request(new Uint8Array(MAX_AVATAR_BYTES+1)),ctx)).status,413);assert.equal((await api(request(new TextEncoder().encode('<svg/>'),'image/png'),ctx)).status,415);assert.equal((await api(request(png,'image/webp'),ctx)).status,415);
 const uploaded=await api(request(),ctx);assert.equal(uploaded.status,200);const {url}=await uploaded.json();assert.match(url,/^\/api\/avatar\/[\w-]+\.png$/);globalThis.avatarFixture.user=null;const filename=url.split('/').at(-1),get=new Request('https://example.test'+url);
 const image=await api(get,{...ctx,params:{filename}});assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');assert.equal(image.headers.get('X-Content-Type-Options'),'nosniff');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),png);
 assert.equal((await api(get,{deploy:{context:'deploy-preview'},params:{filename}})).status,404);assert.equal((await api(get,{...ctx,params:{filename:'../../user/a'}})).status,404);
 }finally{delete globalThis.avatarFixture;await rm(dir,{recursive:true,force:true});}
});

test('same-account profile save updates header and sidebar without reloading or resetting learning',async()=>{
 const mock=`const listeners=new Set();export const getUser=async()=>window.testUser,refreshSession=async()=>null,getSettings=async()=>({disableSignup:false}),handleAuthCallback=async()=>null;export const onAuthChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};export const updateUser=async value=>{window.profileCalls.push(value);if(window.profileFail)throw Error('保存失败');window.testUser={...window.testUser,name:value.data.full_name,pictureUrl:value.data.avatar_url===undefined?window.testUser.pictureUrl:value.data.avatar_url};for(const fn of listeners)fn('user_updated',window.testUser);return window.testUser;};export const login=async()=>{},signup=async()=>({}),logout=async()=>{},requestPasswordRecovery=async()=>{},acceptInvite=async()=>{};`;
 const result=await build({entryPoints:['src/site.jsx'],bundle:true,platform:'browser',format:'iife',write:false,loader:{'.css':'empty'},logLevel:'silent',plugins:[{name:'auth',setup(b){b.onResolve({filter:/^@netlify\/identity$/},()=>({path:'auth',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js'}));}}]});
 const d=new JSDOM('<div id="root"></div>',{url:'https://example.test/#/settings',pretendToBeVisual:true,runScripts:'dangerously'}),w=d.window,doc=w.document;
 w.structuredClone=structuredClone;w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.testUser={id:'a',name:'Alain',email:'a@example.test',pictureUrl:'https://example.test/old.png'};w.profileCalls=[];w.reads=0;w.fetch=async(_url,options)=>{if(!options||options.method!=='PUT')w.reads++;return {ok:true,json:async()=>({data:null,etag:'test'})};};
 const pause=()=>new Promise(r=>setTimeout(r,100)),click=async el=>{assert.ok(el);el.click();await pause();},input=(value)=>{const el=doc.querySelector('[aria-label="修改昵称"]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 try{
 w.eval(result.outputFiles[0].text);await pause();await pause();await click([...doc.querySelectorAll('.np-setting-row button')][0]);assert.ok(doc.querySelector('.account-profile-editor'));const reads=w.reads,cache=w.localStorage.getItem('franmo-atelier:v2:user:a');
 input(' 新昵称 ');await pause();doc.querySelector('.account-profile-editor').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();assert.equal(w.testUser.name,'新昵称');assert.equal(w.reads,reads);assert.deepEqual(JSON.parse(w.localStorage.getItem('franmo-atelier:v2:user:a')).bundle,JSON.parse(cache).bundle);assert.match(doc.querySelector('.dp-user').textContent,/新昵称/);assert.equal(doc.querySelector('.ac-trigger img').getAttribute('src'),'https://example.test/old.png');
 await click([...doc.querySelectorAll('.account-profile-photo button')].find(x=>x.textContent==='移除头像'));doc.querySelector('.account-profile-editor').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();assert.equal(w.testUser.pictureUrl,'');assert.equal(doc.querySelector('.ac-trigger img'),null);assert.equal(doc.querySelector('.ac-trigger .ac-avatar').textContent,'新');
 w.profileFail=true;input('不应保存');await pause();doc.querySelector('.account-profile-editor').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();assert.equal(w.testUser.name,'新昵称');assert.match(doc.querySelector('[role=alert]').textContent,/保存失败/);
 }finally{w.close();}
});
