import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {freshMulti} from '../src/multi-learning.js';
import * as Study from '../src/preview-study.js';
const fixture=`const listeners=new Set();export const getUser=async()=>null,refreshSession=async()=>{},getSettings=async()=>({disableSignup:false}),handleAuthCallback=async()=>null;export const onAuthChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};export const logout=()=>{for(const fn of listeners)fn('logout',null)};`;
const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {useMultiLearning} from './src/useMultiLearning.js';import {logout} from '@netlify/identity';window.testLogout=logout;function App(){window.learning=useMultiLearning();return React.createElement('div',null,window.learning.sync)}createRoot(document.getElementById('root')).render(React.createElement(App));`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'import.meta.env.VITE_SUPABASE_URL':'"https://project.supabase.co"','import.meta.env.VITE_SUPABASE_ANON_KEY':'"public-test-key"'},plugins:[{name:'auth-boundary',setup(b){b.onResolve({filter:/^@netlify\/identity$/},()=>({path:'auth',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:fixture,loader:'js'}));}}],logLevel:'silent'});
const pause=()=>new Promise(r=>setTimeout(r,30));
test('updating an installed App to a new auth provider preserves its account cache online until explicit logout',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://franmotest.netlify.app/',runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window;
 try{
  w.structuredClone=structuredClone;w.fetch=()=>{throw Error('No new login yet; no record request should occur.');};
  const data=freshMulti(),main=data.progress['edito-b1'],id=Study.active(main).ids[0];Study.toggle(main,id);Study.vote(main,id,'bad');
  w.localStorage.setItem('franmo-atelier:last-account:v1',JSON.stringify({id:'old-account',name:'Alain',email:'test@example.test',pictureUrl:''}));
  const key='franmo-atelier:v2:user:old-account';w.localStorage.setItem(key,JSON.stringify({bundle:data,dirty:true,etag:'original-etag'}));
  w.eval(bundle.outputFiles[0].text);
  for(let i=0;i<100&&w.learning?.sync!=='offline-account';i++)await pause();
  assert.equal(w.learning.sync,'offline-account');assert.equal(w.learning.user,null);assert.equal(w.learning.offlineAccount.id,'old-account');assert.equal(w.learning.bundle.progress['edito-b1'].stats[id].bad,1);
  w.dispatchEvent(new w.Event('online'));await pause();await pause();assert.equal(w.learning.offlineAccount.id,'old-account');
  w.learning.update(old=>({...old,theme:'dark',generation:'new-local-edit'}));await pause();await pause();
  const cached=JSON.parse(w.localStorage.getItem(key));assert.equal(cached.dirty,true);assert.equal(cached.bundle.theme,'dark');assert.equal(cached.etag,'original-etag');
  w.testLogout();await pause();assert.equal(w.learning.offlineAccount,null);assert.equal(w.learning.sync,'local');assert.equal(w.localStorage.getItem('franmo-atelier:last-account:v1'),null);
  assert.equal(JSON.parse(w.localStorage.getItem(key)).bundle.progress['edito-b1'].stats[id].bad,1);
 }finally{dom.window.close();}
});
