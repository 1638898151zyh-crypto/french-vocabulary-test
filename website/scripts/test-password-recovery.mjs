import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const user={id:'11111111-1111-1111-1111-111111111111',email:'test@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{full_name:'Alain'}};
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),token=encode({alg:'HS256'})+'.'+encode({sub:user.id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test';
const output=await build({stdin:{contents:`import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {AccountModal} from './src/account-modal.jsx';import {onAuthChange} from './src/supabase-identity.js';function App(){const [user,setUser]=useState(null),[open,setOpen]=useState(true),[authCallback,setAuthCallback]=useState(null);useEffect(()=>onAuthChange((_,u)=>setUser(u)),[]);return open?<AccountModal learning={{user,settings:{disableSignup:false},authCallback,setAuthCallback,setMessage:m=>window.doneMessage=m}} close={()=>{window.closed=true;setOpen(false)}}/>:<p>已完成</p>;}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'},alias:{'@netlify/identity':'./src/supabase-identity.js'},define:{'import.meta.env.VITE_SUPABASE_URL':'"https://project.supabase.co"','import.meta.env.VITE_SUPABASE_ANON_KEY':'"public-test-key"','import.meta.env.VITE_SITE_URL':'"https://franmotest.pages.dev/"','import.meta.env.VITE_ACCOUNT_MIGRATED':'"true"','import.meta.env.VITE_NATIVE_APP':'"false"'},logLevel:'silent'});
const pause=()=>new Promise(r=>setTimeout(r,30));
function browser(){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://franmotest.pages.dev/',runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window,calls=[];
 w.Headers=Headers;w.Request=Request;w.Response=Response;w.fetch=async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url,method:options.method,body});
  if(url.includes('/recover'))return Response.json({});
  if(url.endsWith('/verify'))return body.token==='123456'?Response.json({access_token:token,refresh_token:'refresh',expires_in:3600,token_type:'bearer',user}):Response.json({code:'otp_expired',message:'bad OTP'},{status:403,headers:{'x-supabase-api-version':'2024-01-01'}});
  if(url.endsWith('/user'))return body?.password==='same-password'?Response.json({code:'same_password',message:'same'},{status:422,headers:{'x-supabase-api-version':'2024-01-01'}}):Response.json(user);
  return Response.json({});
 };w.eval(output.outputFiles[0].text);return {dom,w,calls};
}
async function fill(w,selector,value){const input=w.document.querySelector(selector);assert.ok(input,selector);Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new w.Event('input',{bubbles:true}));await pause();}
async function submit(w){w.document.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();await pause();}
test('recovery keeps the reset form through auth changes, rejects bad codes and mismatched passwords, and accepts the original password',async()=>{
 const {dom,w,calls}=browser();try{
  await pause();[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('忘记密码')).click();await pause();
  assert.match(w.document.body.textContent,/发送验证码/);await fill(w,'input[type=email]',user.email);await submit(w);
  assert.equal(calls.filter(c=>c.url.includes('/recover')).length,1);assert.equal(w.document.querySelector('input[type=password]'),null);
  assert.ok([...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('秒后可重发')).disabled);
  await fill(w,'.recovery-code','000000');await submit(w);assert.match(w.document.body.textContent,/验证码不正确或已过期/);assert.equal(w.document.querySelector('input[type=password]'),null);
  await fill(w,'.recovery-code','123456');await submit(w);assert.equal(w.document.querySelectorAll('input[type=password]').length,2);assert.ok(!w.document.body.textContent.includes('我的学习账号'));
  await fill(w,'input[type=password]','same-password');await fill(w,'label:last-of-type input','different-password');await submit(w);assert.match(w.document.body.textContent,/两次输入的新密码不一致/);assert.equal(calls.filter(c=>c.url.endsWith('/user')&&c.method==='PUT').length,0);
  await fill(w,'label:last-of-type input','same-password');await submit(w);assert.equal(w.closed,true);assert.match(w.doneMessage,/密码已确认/);
  assert.deepEqual(calls.filter(c=>c.url.endsWith('/user')&&c.method==='PUT').map(c=>c.body.password),['same-password']);
 }finally{dom.window.close();}
});
