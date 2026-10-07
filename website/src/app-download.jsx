import React,{useState} from 'react';
import {Download,Smartphone,ChevronRight,Share} from 'lucide-react';
import {usePwa,installPwa} from './pwa.js';
import {isNativeApp} from './native-app.js';
import {checkNativeUpdate} from './native-updates.js';
import './pwa.css';
const apk='https://github.com/Alain-0721/french-vocabulary-test/releases/download/v1.1.5/Franmotest-1.1.5-Android.apk';
const websiteHome=(import.meta.env?.VITE_SITE_URL||'https://franmotest.pages.dev/').replace(/\/$/,'')+'/#/home';
export function AppDownload({id}){
 const pwa=usePwa(),[type,setType]=useState(isNativeApp?'android':'web'),[help,setHelp]=useState(false),[busy,setBusy]=useState(false);
 async function install(){setBusy(true);try{if(!pwa.canInstall||!await installPwa())setHelp(true);}finally{setBusy(false);}}
 return <section id={id} className="vi-panel app-download" aria-label="下载 Franmotest App" tabIndex={-1}>
  <div className="app-download-heading"><span className="pwa-icon"><Smartphone size={23}/></span><div><h2>下载 Franmotest App</h2><p>选择适合你的版本，把学习放到桌面。</p></div></div>
  <div className="app-download-tabs" role="tablist" aria-label="选择 App 版本">{[['web','网页版 App'],['android','安卓版 App']].map(([value,label])=><button role="tab" id={`${id||'settings-app'}-${value}-tab`} aria-controls={`${id||'settings-app'}-panel`} aria-selected={type===value} key={value} onClick={()=>{setType(value);setHelp(false);}}>{label}<small>{value==='web'?'手机与电脑 · PWA':'安卓手机 · APK'}</small></button>)}</div>
  <div id={`${id||'settings-app'}-panel`} className="app-download-panel" role="tabpanel" aria-labelledby={`${id||'settings-app'}-${type}-tab`}>
   {type==='web'?<><p><strong>网页版 App（PWA）</strong>：由浏览器安装到桌面，点击图标即可打开。适合 iPhone、安卓和电脑，界面随网站更新；首次联网准备词库后可离线检测。</p>{isNativeApp?<a className="dp-button" data-external="true" href={websiteHome} target="_blank" rel="noopener noreferrer"><Share size={16}/>打开网站安装网页版</a>:pwa.installed?<p className="app-download-status">网页版 App 已安装</p>:<button className="dp-button primary" disabled={busy} onClick={install}><Download size={16}/>{busy?'正在准备…':'安装网页版 App'}</button>}<small role="status">{pwa.error|| (pwa.ready?'离线词库已准备好 · 登录和云同步需要联网':'首次联网打开时准备离线词库')}</small>{help&&<div className="pwa-help"><p>iPhone / iPad：用 Safari 打开网站 → 分享 → 添加到主屏幕。</p><p>安卓：用 Chrome 打开网站 → 菜单 → 安装应用或添加到主屏幕。</p><p>电脑：用 Chrome 或 Edge 打开，点击地址栏的安装图标。</p></div>}</>:<><p><strong>安卓版 App（APK）</strong>：下载安装包后直接打开，学习界面与三本完整词库已内置，不依赖外部浏览器，首次断网也能检测。支持 Android 6.0 及以上；更新时下载新版 APK 覆盖安装。</p>{isNativeApp&&<p className="app-download-status">当前使用安卓版 · 三本课本词库已内置 · 首次断网也能学习</p>}{isNativeApp?<button className="dp-button primary" onClick={()=>{location.hash='/settings';window.scrollTo({top:0});checkNativeUpdate(true);}}><Download size={16}/>检查 App 更新</button>:<a className="dp-button primary" href={apk} target="_blank" rel="noopener noreferrer"><Download size={16}/>下载安卓版 App</a>}<small>打开下载的 APK，按安卓提示完成安装。游客记录请先导出备份，再到新版导入。</small></>}
  </div><p className="app-download-note">两种版本使用同一账号，联网后同步学习记录；游客记录各自保存在本机。</p>
 </section>;
}
export function AppDownloadShortcut(){
 if(isNativeApp)return null;
 return <button className="app-download-shortcut" onClick={()=>{const target=document.getElementById('home-app-download');target?.scrollIntoView({behavior:'smooth',block:'start'});target?.focus({preventScroll:true});}}><Smartphone size={18}/><span><strong>下载 App</strong><small>网页版 / 安卓版 · 选择你的版本</small></span><ChevronRight size={17}/></button>;
}
