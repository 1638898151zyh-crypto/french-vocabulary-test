import {supabaseClient,normalizeUser,backendConfigured} from './supabase-client.js';
const checked=result=>{
 if(result.error){
  const error=result.error;
  if(error.code==='invalid_credentials')throw Object.assign(Error('邮箱或密码不正确，请重新输入。'),{status:401});
  if(error.code==='email_not_confirmed')throw Error('请先通过邮箱验证，再登录。');
  if(error.code==='over_email_send_rate_limit')throw Error('邮件发送过于频繁，请稍后再试。');
  throw error;
 }
 return result.data;
};
const redirect=()=>import.meta.env.VITE_SITE_URL||location.origin+'/';
export async function getUser(){
 const {session}=checked(await supabaseClient().auth.getSession());if(!session)return null;
 return normalizeUser(checked(await supabaseClient().auth.getUser()).user);
}
export async function refreshSession(){
 const client=supabaseClient(),{session}=checked(await client.auth.getSession());
 if(!session)return null;
 // getSession automatically renews an expiring session; getUser verifies it online.
 return normalizeUser(checked(await client.auth.getUser()).user);
}
export async function getSettings(){
 const url=import.meta.env.VITE_SUPABASE_URL+'/auth/v1/settings';
 const response=await fetch(url,{headers:{apikey:import.meta.env.VITE_SUPABASE_ANON_KEY}});
 if(!response.ok)throw Error('账号服务暂时不可用。');
 const settings=await response.json();return {disableSignup:settings.disable_signup===true};
}
export function onAuthChange(listener){
 if(!backendConfigured)return ()=>{};
 const {data}=supabaseClient().auth.onAuthStateChange((event,session)=>{
  // Supabase holds its session lock during callbacks. Never make API calls in that lock.
  queueMicrotask(()=>listener(event==='SIGNED_OUT'?'logout':event,normalizeUser(session?.user)));
 });
 return ()=>data.subscription.unsubscribe();
}
export async function login(email,password){return normalizeUser(checked(await supabaseClient().auth.signInWithPassword({email,password})).user);}
export async function signup(email,password,data){return normalizeUser(checked(await supabaseClient().auth.signUp({email,password,options:{data,emailRedirectTo:redirect()}})).user);}
export async function logout(){checked(await supabaseClient().auth.signOut({scope:'local'}));}
export async function requestPasswordRecovery(email){checked(await supabaseClient().auth.resetPasswordForEmail(email,{redirectTo:redirect()}));}
export async function updateUser({data,password}){return normalizeUser(checked(await supabaseClient().auth.updateUser({...data&&{data},...password&&{password}})).user);}
export async function acceptInvite(_token,password){return updateUser({password});}
export async function handleAuthCallback(){
 const params=new URLSearchParams(location.hash.slice(1));
 if(params.has('error'))throw Error(params.get('error_description')||'验证链接未生效。');
 const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');
 if(!access_token||!refresh_token)return null;
 const {user}=checked(await supabaseClient().auth.setSession({access_token,refresh_token}));
 history.replaceState(null,'',location.pathname+location.search+'#/home');
 return {type:params.get('type')==='recovery'||params.get('type')==='invite'?'recovery':'confirmation',user:normalizeUser(user)};
}
