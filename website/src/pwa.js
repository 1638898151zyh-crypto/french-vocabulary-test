import {useEffect,useState} from 'react';
import {isNativeApp} from './native-app.js';
let state={supported:false,installed:false,ready:false,update:false,error:'',online:true};
const listeners=new Set();let started=false,promptEvent=null,registration=null,reloading=false;
const notify=patch=>{state={...state,...patch};for(const fn of listeners)fn(state);};
function installed(){return !!(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone);}
export function startPwa(){
 if(started||typeof window==='undefined')return;started=true;
 notify({supported:'serviceWorker' in navigator&&window.isSecureContext,installed:installed(),online:navigator.onLine!==false});
 window.addEventListener('online',()=>notify({online:true}));window.addEventListener('offline',()=>notify({online:false}));
 if(isNativeApp){notify({supported:false,installed:true,ready:true});return;}
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;notify({canInstall:true});});
 window.addEventListener('appinstalled',()=>{promptEvent=null;notify({installed:true,canInstall:false});});
 const display=window.matchMedia?.('(display-mode: standalone)');display?.addEventListener?.('change',()=>notify({installed:installed()}));
 if(!state.supported)return;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)window.location.reload();});
 navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(async result=>{
  registration=result;notify({update:!!result.waiting});
  result.addEventListener('updatefound',()=>{
   const worker=result.installing;
   worker?.addEventListener('statechange',()=>{if(worker.state==='installed')notify({update:!!navigator.serviceWorker.controller&&!!result.waiting});});
  });
  await navigator.serviceWorker.ready;notify({ready:true});
  window.addEventListener('online',()=>result.update().catch(()=>{}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine!==false)result.update().catch(()=>{});});
 }).catch(()=>notify({error:'暂时无法准备离线使用，请联网后重新打开。'}));
}
export async function installPwa(){
 if(!promptEvent)return false;const event=promptEvent;promptEvent=null;notify({canInstall:false});
 try{await event.prompt();const choice=await event.userChoice;return choice.outcome==='accepted';}catch{return false;}
}
export async function applyPwaUpdate(){
 if(!registration?.waiting)return false;
 reloading=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});return true;
}
export function usePwa(){const [value,setValue]=useState(state);useEffect(()=>{listeners.add(setValue);setValue(state);return()=>listeners.delete(setValue);},[]);return value;}
