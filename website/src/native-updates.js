import {useSyncExternalStore} from 'react';
import {isNativeApp} from './native-app.js';
const empty=Object.freeze({phase:'idle',available:false,currentVersion:'',message:'联网后可以检查更新',progress:0});
let state=empty;
const subscribers=new Set();
function readBridge(){try{const text=globalThis.FranmotestNative?.getAppUpdateState?.();return text?JSON.parse(text):empty;}catch{return empty;}}
function receive(event){if(!event.detail||typeof event.detail.phase!=='string')return;state=event.detail;for(const fn of subscribers)fn();}
if(isNativeApp){state=readBridge();window.addEventListener('franmotest:app-update',receive);}
const subscribe=fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);};
export const useNativeUpdate=()=>useSyncExternalStore(subscribe,()=>state,()=>empty);
export function checkNativeUpdate(manual=true){globalThis.FranmotestNative?.checkForUpdate?.(manual);}
export function installNativeUpdate(){globalThis.FranmotestNative?.installUpdate?.();}
export function startNativeUpdates(){
 if(!isNativeApp)return;
 const check=()=>{if(navigator.onLine!==false)checkNativeUpdate(false);};
 check();window.addEventListener('online',check);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
}
