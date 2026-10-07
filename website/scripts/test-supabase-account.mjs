import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const user={id:'11111111-1111-1111-1111-111111111111',email:'test@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{full_name:'Alain'},app_metadata:{legacy_user_id:'old-account'}};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test-signature';
const bundle=await build({entryPoints:['src/supabase-identity.js'],bundle:true,write:false,format:'iife',globalName:'Identity',platform:'browser',define:{
 'import.meta.env.VITE_SUPABASE_URL':'"https://project.supabase.co"','import.meta.env.VITE_SUPABASE_ANON_KEY':'"public-test-key"','import.meta.env.VITE_SITE_URL':'"https://franmotest.pages.dev/"'
},logLevel:'silent'});
function browser(saved){
 const dom=new JSDOM('',{url:'https://franmotest.pages.dev/',runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window,calls=[];
 w.Headers=Headers;w.Request=Request;w.Response=Response;
 w.fetch=async(url,options={})=>{
  calls.push({url,options});assert.equal(new URL(url).hostname,'project.supabase.co');
  if(url.includes('/token')){
   const body=JSON.parse(options.body);
   if(body.password==='wrong')return Response.json({code:'invalid_credentials',message:'Invalid login credentials'},{status:400,headers:{'x-supabase-api-version':'2024-01-01'}});
   return Response.json({access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user});
  }
  if(url.endsWith('/user')){
   assert.equal(new Headers(options.headers).get('Authorization'),'Bearer '+token);
   return Response.json(options.method==='PUT'?{...user,user_metadata:{...user.user_metadata,...JSON.parse(options.body).data}}:user);
  }
  if(url.includes('/logout'))return new Response(null,{status:204});
  return Response.json(url.endsWith('/settings')?{disable_signup:false}:{});
 };
 if(saved)w.localStorage.setItem('franmotest:supabase-session:v1',saved);
 w.eval(bundle.outputFiles[0].text+'\nwindow.Identity=Identity;');return {dom,w,calls};
}
test('real Supabase SDK remembers sessions, verifies restored accounts, preserves failed switches, edits profile and clears logout',async()=>{
 const first=browser();let next;
 try{
  const identity=first.w.Identity;
  assert.equal(await identity.getUser(),null);
  const events=[],stop=identity.onAuthChange((event,value)=>events.push([event,value?.id]));
  const account=await identity.login(user.email,'test-password');assert.equal(account.id,'old-account');assert.equal(account.authId,user.id);
  await assert.rejects(identity.login(user.email,'wrong'),error=>error.status===401);
  assert.equal((await identity.getUser()).id,'old-account');
  const saved=first.w.localStorage.getItem('franmotest:supabase-session:v1');assert.ok(saved);assert.ok(!saved.includes('test-password'));
  const profile=await identity.updateUser({data:{full_name:'Camille'}});assert.equal(profile.name,'Camille');
  await identity.requestPasswordRecovery(user.email);
  const recovery=first.calls.find(c=>c.url.includes('/recover'));assert.equal(new URL(recovery.url).searchParams.get('redirect_to'),'https://franmotest.pages.dev/');
  assert.equal((await identity.getSettings()).disableSignup,false);
  next=browser(saved);assert.equal((await next.w.Identity.refreshSession()).id,'old-account');assert.equal((await next.w.Identity.getUser()).id,'old-account');
  await identity.logout();assert.equal(await identity.getUser(),null);assert.equal(first.w.localStorage.getItem('franmotest:supabase-session:v1'),null);
  assert.ok(events.some(([event])=>event==='logout'));stop();
 }finally{first.dom.window.close();next?.dom.window.close();}
});
test('recovery callback verifies the session, opens password reset and removes tokens from the URL',async()=>{
 const {dom,w}=browser();try{
  w.location.hash='access_token='+token+'&refresh_token=test-refresh&type=recovery';
  const result=await w.Identity.handleAuthCallback();assert.equal(result.type,'recovery');assert.equal(result.user.id,'old-account');assert.equal(w.location.hash,'#/home');
  assert.equal((await w.Identity.getUser()).authId,user.id);await w.Identity.logout();
 }finally{dom.window.close();}
});
