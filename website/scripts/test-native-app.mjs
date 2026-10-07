import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {readFileSync,existsSync} from 'node:fs';
import {readBackup} from '../src/preview-backup.js';
import {freshMulti} from '../src/multi-learning.js';
import * as Study from '../src/preview-study.js';
const auth='export const getUser=async()=>null,refreshSession=async()=>{},getSettings=async()=>({disableSignup:false}),handleAuthCallback=async()=>null,onAuthChange=()=>()=>{},login=async()=>{},signup=async()=>({}),logout=async()=>{},requestPasswordRecovery=async()=>{},updateUser=async()=>{},acceptInvite=async()=>{};';
const ui=await build({entryPoints:['src/site.jsx'],bundle:true,write:false,format:'iife',platform:'browser',define:{'import.meta.env.PROD':'true','import.meta.env.VITE_NATIVE_APP':'"true"'},loader:{'.css':'empty'},logLevel:'silent',plugins:[{name:'identity-fixture',setup(b){b.onResolve({filter:/^@netlify\/identity$/},()=>({path:'identity',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:auth,loader:'js'}));}}]});
const pause=()=>new Promise(r=>setTimeout(r,100));
function app(saved,{online=false}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://franmotest.netlify.app/#/home',runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window;
 w.structuredClone=structuredClone;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 Object.defineProperty(w.navigator,'onLine',{value:online,configurable:true});
 w.workerCalls=0;Object.defineProperty(w.navigator,'serviceWorker',{value:{register(){w.workerCalls++;throw Error('Native app must not use a worker');}}});
 w.saves=[];w.externals=[];w.updateChecks=[];w.updateInstalls=0;w.FranmotestNative={saveText:(...args)=>w.saves.push(args),setDark(){},openExternal:url=>w.externals.push(url),getAppUpdateState:()=>JSON.stringify({phase:'idle',available:false,currentVersion:'1.1.1',currentCode:4,progress:0,message:'联网后可以检查更新'}),checkForUpdate:manual=>w.updateChecks.push(manual),installUpdate:()=>w.updateInstalls++};
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
test('compact study updates scores when votes change, preserves votes on sorting and advances groups before Part mastery',async()=>{
 const {dom,w}=app();try{await pause();w.location.hash='/study';await pause();const d=w.document;
 assert.ok(!d.body.textContent.includes('布局与乱序设置'));assert.ok(!d.querySelector('.study-tools').textContent.includes('卡片布局'));
 const firstId=d.querySelector('.study-word-row').dataset.wordId;d.querySelector('.dp-word-trigger').click();await pause();d.querySelector('.dp-votes .good').click();await pause();assert.match(d.querySelector('.study-live-score').textContent,/✔ 1.*✘ 0.*100%/);
 d.querySelector('.dp-votes .bad').click();await pause();assert.match(d.querySelector('.study-live-score').textContent,/✔ 0.*✘ 1.*0%/);
 const order=d.querySelector('[aria-label="切换词汇顺序"]');order.value='random';order.dispatchEvent(new w.Event('change',{bubbles:true}));await pause();let bundle=JSON.parse(w.localStorage.getItem('franmo-atelier:v2:guest')).bundle;const s=bundle.progress['edito-b1'];assert.equal(Study.active(s).shuffled,true);assert.equal(Study.active(s).votes[firstId],'bad');assert.equal(s.stats[firstId].bad,1);
 d.querySelector('.dp-quiz-actions .primary').click();await pause();bundle=JSON.parse(w.localStorage.getItem('franmo-atelier:v2:guest')).bundle;assert.equal(Study.active(bundle.progress['edito-b1']).group,1);assert.equal(bundle.progress['edito-b1'].current,0);
 const tabs=d.querySelectorAll('.dp-group-tabs button');tabs[tabs.length-1].click();await pause();assert.match(d.querySelector('.dp-quiz-actions .primary').textContent,/本部分过关/);
 }finally{dom.window.close();}
});
test('native home omits download shortcut while settings keep the app choices',async()=>{const {dom,w}=app();try{await pause();const d=w.document;assert.equal(d.querySelector('.app-download-shortcut'),null);assert.equal(d.documentElement.dataset.nativeApp,'true');const tabs=d.querySelectorAll('.app-download-tabs button');assert.equal(tabs.length,2);assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert.match(d.querySelector('.app-download-panel button').textContent,/检查 App 更新/);tabs[0].click();await pause();assert.match(d.querySelector('.app-download-panel').textContent,/由浏览器安装到桌面/);assert.match(d.querySelector('.app-download-panel').textContent,/首次联网准备词库/);}finally{dom.window.close();}});
test('native update checks on launch, presents homepage update and settings controls, shows progress without changing records',async()=>{
 const {dom,w}=app(null,{online:true});try{await pause();for(let i=0;i<20&&!w.localStorage.getItem('franmo-atelier:v2:guest');i++)await pause();const d=w.document;assert.deepEqual(w.updateChecks,[false]);assert.equal(d.querySelector('.native-update-banner'),null);const before=JSON.parse(w.localStorage.getItem('franmo-atelier:v2:guest')).bundle.progress;
 const update={phase:'available',available:true,currentVersion:'1.1.1',currentCode:4,latestVersion:'1.1.2',progress:0,message:'发现新版本，可下载更新',notes:'更新说明'};
 w.dispatchEvent(new w.CustomEvent('franmotest:app-update',{detail:update}));await pause();assert.match(d.querySelector('.native-update-banner').textContent,/1.1.2.*更新 App/);d.querySelector('.native-update-banner button').click();assert.equal(w.updateInstalls,1);assert.equal(w.externals.length,0);
 w.location.hash='/settings';await pause();const panel=d.querySelector('.native-update-settings');assert.match(panel.textContent,/当前版本 1.1.1/);panel.querySelector('button').click();assert.deepEqual(w.updateChecks,[false,true]);
 w.dispatchEvent(new w.CustomEvent('franmotest:app-update',{detail:{...update,phase:'downloading',progress:50,message:'正在下载更新 50%'}}));await pause();assert.equal(d.querySelector('.native-update-settings progress').value,50);assert.ok([...d.querySelectorAll('.native-update-settings button')].every(b=>b.disabled));
 w.dispatchEvent(new w.CustomEvent('franmotest:app-update',{detail:{...update,phase:'error',message:'更新未完成，请稍后重试'}}));await pause();assert.match(d.querySelector('.native-update-settings').textContent,/更新未完成/);assert.ok(!d.querySelector('.native-update-settings button').disabled);assert.deepEqual(JSON.parse(w.localStorage.getItem('franmo-atelier:v2:guest')).bundle.progress,before);
 }finally{dom.window.close();}
});
