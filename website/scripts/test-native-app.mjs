import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {readFileSync,existsSync} from 'node:fs';
import {readBackup} from '../src/preview-backup.js';
import {freshMulti} from '../src/multi-learning.js';
const auth='export const getUser=async()=>null,refreshSession=async()=>{},getSettings=async()=>({disableSignup:false}),handleAuthCallback=async()=>null,onAuthChange=()=>()=>{},login=async()=>{},signup=async()=>({}),logout=async()=>{},requestPasswordRecovery=async()=>{},updateUser=async()=>{},acceptInvite=async()=>{};';
const ui=await build({entryPoints:['src/site.jsx'],bundle:true,write:false,format:'iife',platform:'browser',define:{'import.meta.env.PROD':'true','import.meta.env.VITE_NATIVE_APP':'"true"'},loader:{'.css':'empty'},logLevel:'silent',plugins:[{name:'identity-fixture',setup(b){b.onResolve({filter:/^@netlify\/identity$/},()=>({path:'identity',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:auth,loader:'js'}));}}]});
const pause=()=>new Promise(r=>setTimeout(r,100));
function app(saved){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://franmotest.netlify.app/#/home',runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window;
 w.structuredClone=structuredClone;w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 Object.defineProperty(w.navigator,'onLine',{value:false});
 w.workerCalls=0;Object.defineProperty(w.navigator,'serviceWorker',{value:{register(){w.workerCalls++;throw Error('Native app must not use a worker');}}});
 w.saves=[];w.externals=[];w.FranmotestNative={saveText:(...args)=>w.saves.push(args),setDark(){},openExternal:url=>w.externals.push(url)};
 w.fetch=async()=>{throw Error('offline');};
 if(saved)w.localStorage.setItem('franmo-atelier:v2:guest',saved);
 w.eval(ui.outputFiles[0].text);return {dom,w};
}
test('fresh offline APK opens home, loads all three full banks, switches books and never registers a website worker',async()=>{
 const {dom,w}=app();try{await pause();assert.match(w.document.body.textContent,/三本课本词库已内置/);assert.match(w.document.body.textContent,/首次断网也能学习/);assert.equal(w.workerCalls,0);
 w.document.querySelector('.dp-switch').click();await pause();
 const buttons=[...w.document.querySelectorAll('.dp-switch-menu button')];for(const name of ['Édito B1','Inspire A1','Édito A2'])assert.ok(buttons.some(b=>b.textContent.includes(name)));
 buttons.find(b=>b.textContent.includes('Inspire A1')).click();await pause();w.location.hash='/study';await pause();assert.match(w.document.body.textContent,/Inspire A1/);assert.ok(w.document.querySelector('.dp-word-trigger'));assert.equal(w.externals.length,0);
 }finally{dom.window.close();}
});
test('native word votes survive restart, and full backup uses a real save bridge with restorable records',async()=>{
 const first=app();let saved;try{await pause();first.w.location.hash='/study';await pause();first.w.document.querySelector('.dp-word-trigger').click();await pause();first.w.document.querySelector('.dp-votes .good').click();await pause();saved=first.w.localStorage.getItem('franmo-atelier:v2:guest');assert.equal(Object.values(JSON.parse(saved).bundle.progress['edito-b1'].stats)[0].good,1);}finally{first.dom.window.close();}
 const {dom,w}=app(saved);try{await pause();assert.deepEqual([...w.document.querySelectorAll('.np-activity strong')].map(n=>n.textContent),['1','1']);w.location.hash='/settings';await pause();const exportButton=[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('完整备份'));assert.ok(exportButton);exportButton.click();await pause();assert.equal(w.saves.length,1);assert.equal(w.saves[0][2],'application/json');const initial=freshMulti(),backup=readBackup(w.saves[0][1],initial.books,initial.progress);assert.equal(Object.values(backup.progress['edito-b1'].stats)[0].good,1);assert.equal(w.externals.length,0);
 }finally{dom.window.close();}
});
test('Android back closes the active dialog before leaving the learning screen',async()=>{
 const {dom,w}=app();try{await pause();w.location.hash='/books';await pause();[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('一键导入词库')).click();await pause();assert.ok(w.document.querySelector('[aria-modal=true]'));assert.equal(w.franmotestBack(),true);await pause();assert.equal(w.document.querySelector('[aria-modal=true]'),null);assert.equal(w.franmotestBack(),false);}finally{dom.window.close();}
});
test('native distribution includes only local scripts and styles and excludes the website service worker',()=>{
 assert.ok(existsSync('dist-android/index.html'),'Build android mode first');assert.ok(!existsSync('dist-android/sw.js'));
 const html=readFileSync('dist-android/index.html','utf8');for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g))assert.ok(existsSync('dist-android'+match[1]));assert.ok(!/https?:\/\//.test(html));
});
