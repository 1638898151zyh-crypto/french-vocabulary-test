import React,{useState} from 'react';
import {WifiOff,RefreshCw} from 'lucide-react';
import {usePwa,applyPwaUpdate} from './pwa.js';
import './pwa.css';
export function PwaStatus(){
 const pwa=usePwa(),[error,setError]=useState('');
 if(pwa.online&&!pwa.update)return null;
 async function update(){if(!confirm('已保存的学习记录会保留。若其他窗口也在检测，请先保存并关闭。现在更新并重新打开？'))return;try{if(!await applyPwaUpdate())setError('新版本暂时无法启用，请联网后重新打开。');}catch{setError('更新未完成，请稍后重试。');}}
 return <div className="pwa-status" role="status">{!pwa.online?<><WifiOff size={16}/><span>当前离线 · 检测记录保存在本机，联网后再同步</span></>:<><RefreshCw size={16}/><span>Franmotest 有新版本</span><button className="dp-button" onClick={update}>更新并重新打开</button></>}{error&&<span>{error}</span>}</div>;
}
