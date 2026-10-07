import React from 'react';
import {RefreshCw,Download,ArrowRight} from 'lucide-react';
import {isNativeApp} from './native-app.js';
import {useNativeUpdate,checkNativeUpdate,installNativeUpdate} from './native-updates.js';
import './native-update.css';
const busy=s=>['checking','downloading','permission','installing'].includes(s.phase);
const label=s=>s.phase==='downloading'?`下载中 ${s.progress}%`:s.phase==='permission'?'等待允许安装':s.phase==='installing'?'等待安装确认':s.phase==='ready'?'继续安装':'下载并更新';
export function NativeUpdateBanner(){
 const s=useNativeUpdate();if(!isNativeApp||!s.available)return null;
 return <section className="native-update-banner" aria-label="安卓 App 更新提示"><RefreshCw size={19}/><div><strong>Franmotest {s.latestVersion} 可更新</strong><small role="status">{s.phase==='available'?'新版已准备好，更新后继续学习':s.message}</small></div><button className="dp-button primary" disabled={busy(s)||navigator.onLine===false&&s.phase!=='ready'} onClick={installNativeUpdate}>{label(s)}<ArrowRight size={14}/></button>{s.phase==='downloading'&&<progress value={s.progress} max={100} aria-label="更新下载进度"/>}</section>;
}
export function NativeUpdateSettings(){
 const s=useNativeUpdate();if(!isNativeApp)return null;
 return <section className="vi-panel native-update-settings" aria-label="安卓版 App 检查更新"><h2><RefreshCw size={20}/>App 更新</h2><p>当前版本 {s.currentVersion||'读取中…'}{s.available?` · 最新版本 ${s.latestVersion}`:''}</p><p role="status">{s.message}</p>{s.available&&s.notes&&<p className="native-update-notes">{s.notes}</p>}<div className="vi-actions"><button className="dp-button" disabled={busy(s)||navigator.onLine===false} onClick={()=>checkNativeUpdate(true)}><RefreshCw size={16}/>{s.phase==='checking'?'正在检查…':'检查更新'}</button>{s.available&&<button className="dp-button primary" disabled={busy(s)||navigator.onLine===false&&s.phase!=='ready'} onClick={installNativeUpdate}><Download size={16}/>{label(s)}</button>}</div>{s.phase==='downloading'&&<progress value={s.progress} max={100} aria-label="更新下载进度"/>}<small>打开 App 时联网自动检查。下载完成后由安卓确认覆盖安装，学习记录会保留；首次可能需要允许 Franmotest 安装应用。</small></section>;
}
