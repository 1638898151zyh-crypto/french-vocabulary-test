import {useCallback,useEffect,useRef,useState} from 'react';
import {getUser,getSettings,handleAuthCallback,onAuthChange,refreshSession} from '@netlify/identity';
import {freshMulti as fresh,restoreMulti as restoreBundle,migrateClassic,touchMulti} from './multi-learning.js';
import {rememberIdentitySession,restoreIdentitySession} from './identity-session';
const prefix='franmo-atelier:v2:';
function readCache(key){try{let raw=localStorage.getItem(key);if(!raw){const legacy=JSON.parse(localStorage.getItem(key.replace(prefix,'edito-atelier:v1:'))||'null');if(!legacy)return null;const migrated=migrateClassic(legacy.bundle);const theme=localStorage.getItem('edito-theme');if(migrated&&['light','dark','system'].includes(theme))migrated.theme=theme;return migrated?{bundle:migrated,dirty:true,etag:null}:{corrupt:true};}const data=JSON.parse(raw);return {...data,bundle:restoreBundle(data.bundle),corrupt:!restoreBundle(data.bundle)};}catch{return {corrupt:true};}}
export function useMultiLearning(enabled=true){
 const [bundle,setBundle]=useState(()=>enabled?readCache(prefix+'guest')?.bundle||fresh():fresh());
 const [user,setUser]=useState(null),[settings,setSettings]=useState(null),[sync,setSync]=useState('loading'),[message,setMessage]=useState(''),[authCallback,setAuthCallback]=useState(null);
 const scope=useRef(prefix+'guest'),ready=useRef(false),etag=useRef(null),clean=useRef(null),current=useRef(bundle),uid=useRef(null),writing=useRef(false),blocked=useRef(false),generation=useRef(0),storageBroken=useRef(false);
 current.current=bundle;
 const cache=useCallback((data,dirty)=>{
  if(storageBroken.current)return false;
  try{localStorage.setItem(scope.current,JSON.stringify({bundle:data,dirty,etag:etag.current}));return true;}catch{setSync('memory');return false;}
 },[]);
 const load=useCallback(async nextUser=>{
  const turn=++generation.current;ready.current=false;blocked.current=false;uid.current=nextUser?.id||null;setUser(nextUser);
  scope.current=prefix+(nextUser?'user:'+nextUser.id:'guest');
  const local=readCache(scope.current);storageBroken.current=!!local?.corrupt;
  let data=local?.bundle||fresh();etag.current=local?.etag||null;clean.current=local?.dirty?null:data.generation;
  setSync(nextUser?'loading':'local');
  if(local?.corrupt)setMessage('原本机记录无法读取，已保留原文件。请导入有效备份；当前记录仅暂存。');
  if(nextUser){
   try{
    const response=await fetch('/api/multi-progress',{credentials:'same-origin'});if(!response.ok)throw Error('暂时无法读取云端记录');
    const cloud=await response.json();if(turn!==generation.current)return;
    if(cloud.data){
     const restored=restoreBundle(cloud.data);if(!restored)throw Error('云端记录校验失败');
     if(local?.dirty&&local.bundle&&local.etag!==cloud.etag){blocked.current=true;setSync('conflict');setMessage('另一台设备已更新。请先导出本机备份，再读取云端记录。');}
     else if(local?.dirty&&local.bundle){etag.current=cloud.etag;setSync('pending');}
     else{data=restored;etag.current=cloud.etag;clean.current=data.generation;setSync('cloud');storageBroken.current=false;}
    }else{etag.current=null;clean.current=null;setSync('pending');}
   }catch{if(turn!==generation.current)return;setSync('offline');setMessage('云端暂时不可用，继续使用本机记录。');}
  }
  if(turn!==generation.current)return;current.current=data;ready.current=true;setBundle(data);
 },[]);
 const saveCloud=useCallback(async()=>{
  if(!ready.current||!uid.current||blocked.current||writing.current||clean.current===current.current.generation)return;
  writing.current=true;const owner=uid.current,data=current.current,base=etag.current;
  setSync('saving');
  try{
   const response=await fetch('/api/multi-progress',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,etag:base})});
   if(owner!==uid.current)return;
   if(response.status===409){blocked.current=true;setSync('conflict');setMessage('另一台设备已更新。请导出本机备份，再读取云端记录。');return;}
   if(!response.ok)throw Error('同步未完成');
   const result=await response.json();etag.current=result.etag;clean.current=data.generation;
   cache(current.current,clean.current!==current.current.generation);setSync('cloud');
  }catch{if(owner===uid.current){setSync('offline');setMessage('暂时无法同步，记录保存在本机；可稍后重试。');}}
  finally{writing.current=false;if(owner!==uid.current&&uid.current)setTimeout(saveCloud,0);}
 },[cache]);
 useEffect(()=>{
  if(!enabled)return;
  let alive=true;
  (async()=>{
   try{const result=/(access_token|confirmation_token|recovery_token|invite_token|email_change_token)=/.test(location.hash)?await handleAuthCallback():null;if(result&&alive)setAuthCallback(result);}catch{if(alive)setMessage('账号验证链接未生效，请重新获取验证邮件。');}
   const restored=await restoreIdentitySession({getUser,refreshSession});if(alive)await load(restored);
   try{const config=await getSettings();if(alive)setSettings(config);}catch{if(alive)setSettings(false);}
  })();
  const unsubscribe=onAuthChange((_event,next)=>{if(next)rememberIdentitySession();if(alive){if((next?.id||null)!==uid.current)load(next);else if(next)setUser(next);}});
  return()=>{alive=false;unsubscribe();};
 },[load,enabled]);
 useEffect(()=>{
  if(!enabled||!ready.current)return;
  const dirty=clean.current!==bundle.generation;
  const saved=cache(bundle,dirty);
  if(!user)setSync(saved?'local':'memory');
  if(user&&dirty&&!blocked.current){const timer=setTimeout(saveCloud,650);return()=>clearTimeout(timer);}
 },[bundle,user,cache,saveCloud,enabled]);
 // If an edit arrives during a request, serialize the newer snapshot after it completes.
 useEffect(()=>{if(enabled&&sync==='cloud'&&clean.current!==current.current.generation){const timer=setTimeout(saveCloud,100);return()=>clearTimeout(timer);}},[sync,bundle,saveCloud,enabled]);
 const update=useCallback(fn=>setBundle(old=>fn(old)),[]);
 const adopt=useCallback(data=>{storageBroken.current=false;blocked.current=false;clean.current=null;setBundle(data);},[]);
 const pull=useCallback(async()=>{
  if(!user)return;const response=await fetch('/api/multi-progress',{credentials:'same-origin'});if(!response.ok)throw Error('读取云端失败');
  const cloud=await response.json(),data=restoreBundle(cloud.data);if(!data)throw Error('云端尚无有效记录');
  etag.current=cloud.etag;clean.current=data.generation;blocked.current=false;storageBroken.current=false;setBundle(data);setSync('cloud');setMessage('已读取最新云端记录。');
 },[user]);
 return {bundle,update,adopt,user,settings,sync,message,setMessage,saveCloud,pull,authCallback,setAuthCallback,guest:()=>readCache(prefix+'guest')?.bundle};
}

export function useLearningSlice(learning,key,initialize,enabled){
 const [local,setLocal]=useState(initialize);
 const set=useCallback(value=>{if(!enabled){setLocal(value);return;}learning.update(old=>{const next=typeof value==='function'?value(old[key]):value;return next===old[key]?old:touchMulti({...old,[key]:next});});},[enabled,learning.update,key]);
 return [enabled?learning.bundle[key]:local,set];
}
