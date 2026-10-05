import React,{useState} from 'react';
import {Smartphone,Download,WifiOff,RefreshCw,Share,ChevronDown} from 'lucide-react';
import {usePwa,installPwa,applyPwaUpdate} from './pwa.js';
import './pwa.css';

export function PwaInstall({compact=false}){
 const pwa=usePwa(),[help,setHelp]=useState(false),[busy,setBusy]=useState(false);
 async function install(){if(!pwa.canInstall){setHelp(v=>!v);return;}setBusy(true);try{if(!await installPwa())setHelp(true);}finally{setBusy(false);}}
 return <section className={`vi-panel pwa-install ${compact?'compact':''}`} aria-label="安装 Franmo 应用"><span className="pwa-icon"><Smartphone size={24}/></span><div className="pwa-install-copy"><h2>{pwa.installed?'Franmo 已安装':'把 Franmo 放到桌面'}</h2><p>{pwa.installed?'随时打开，继续你的法语学习。':'从手机或电脑桌面直接打开，没网络也能继续检测。'}</p><small role="status">{pwa.error|| (pwa.ready?'离线词库已准备好 · 登录和云同步需要联网':pwa.supported?'首次联网打开时准备离线词库':'请使用支持安装的浏览器打开')}</small></div>{!pwa.installed&&<button className="dp-button primary" disabled={busy} onClick={install}>{pwa.canInstall?<Download size={16}/>:<Smartphone size={16}/>} {pwa.canInstall?'安装应用':'安装到桌面'}</button>}<button className="dp-text-button" aria-expanded={help} onClick={()=>setHelp(!help)}>安装说明<ChevronDown size={14}/></button>{help&&<div className="pwa-help"><p><strong>iPhone / iPad</strong>：用 Safari 打开网站，点“分享”<Share size={14}/>，选择“添加到主屏幕”，再点“添加”。</p><p><strong>安卓</strong>：用 Chrome 打开网站，点击“安装应用”；也可在浏览器菜单选择“安装应用”或“添加到主屏幕”。</p><p><strong>电脑</strong>：用 Chrome 或 Edge 打开，点击地址栏的安装图标。</p><p>首次请保持联网，等显示“离线词库已准备好”后再离线使用。安装后如未看到原游客记录，可先从浏览器导出完整备份，再到应用中导入。</p></div>}</section>;
}
export function PwaStatus(){
 const pwa=usePwa(),[error,setError]=useState('');
 if(pwa.online&&!pwa.update)return null;
 async function update(){if(!confirm('已保存的学习记录会保留。若其他窗口也在检测，请先保存并关闭。现在更新并重新打开？'))return;try{if(!await applyPwaUpdate())setError('新版本暂时无法启用，请联网后重新打开。');}catch{setError('更新未完成，请稍后重试。');}}
 return <div className="pwa-status" role="status">{!pwa.online?<><WifiOff size={16}/><span>当前离线 · 检测记录保存在本机，联网后再同步</span></>:<><RefreshCw size={16}/><span>Franmo 有新版本</span><button className="dp-button" onClick={update}>更新并重新打开</button></>}{error&&<span>{error}</span>}</div>;
}
