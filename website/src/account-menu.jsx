import React,{useEffect,useId,useRef,useState} from 'react';
import {UserRound,UsersRound,Settings,LogOut,LogIn,ChevronDown,LoaderCircle} from 'lucide-react';
import './account-menu.css';
import {avatarUrl} from './account-profile.js';

export function AccountAvatar({user,className='',localPreview=false}){
 const [failed,setFailed]=useState('');
 const url=localPreview&&user?.pictureUrl?.startsWith('blob:')?user.pictureUrl:avatarUrl(user);
 const name=user?.name||user?.email||'学习者';
 return <span className={`ac-avatar ${className}`} aria-hidden="true">{url&&failed!==url?<img src={url} alt="" onError={()=>setFailed(url)}/>:Array.from(name)[0].toUpperCase()}</span>;
}

export function AccountMenu({user,loading=false,onLogin,onSwitch,onSettings,onLogout,demo=false}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const root=useRef(null),trigger=useRef(null),id=useId();
  useEffect(()=>{setOpen(false);setError('');},[user?.id]);
  useEffect(()=>{
    if(!open)return;
    root.current?.querySelector('[role=menuitem]')?.focus();
    const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    const keyboard=e=>{
      if(e.key==='Escape'){setOpen(false);trigger.current?.focus();e.stopPropagation();}
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
        const items=[...root.current.querySelectorAll('[role=menuitem]')].filter(b=>!b.disabled),index=items.indexOf(document.activeElement);if(!items.length)return;
        e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
      }
      if(e.key==='Tab')setOpen(false);
    };
    document.addEventListener('pointerdown',outside);root.current?.addEventListener('keydown',keyboard);
    return ()=>{document.removeEventListener('pointerdown',outside);root.current?.removeEventListener('keydown',keyboard);};
  },[open]);
  function choose(action){setOpen(false);action();}
  async function signOut(){setBusy(true);setError('');try{await onLogout();setOpen(false);}catch(e){setError(e?.message||'退出未完成，请重试。');}finally{setBusy(false);}}
  const name=user?.name||user?.email||'学习者';
  return <div className="ac-account" ref={root}><button ref={trigger} className={`ac-trigger ${user?'signed-in':'guest'}`} type="button" disabled={loading} aria-label={loading?'正在恢复登录':user?'打开账号菜单':demo?'体验账号菜单':'登录账号'} aria-expanded={user?open:undefined} aria-haspopup={user?'menu':undefined} aria-controls={user&&open?id:undefined} onClick={()=>user?setOpen(v=>!v):onLogin()}>{loading?<LoaderCircle size={18} className="ac-spin"/>:user?<><AccountAvatar user={user}/><ChevronDown size={13}/></>:<><LogIn size={17}/><span>{demo?'体验登录':'登录'}</span></>}</button>
    {open&&user&&<div className="ac-popover" id={id} role="menu" aria-label="账号菜单"><div className="ac-profile"><AccountAvatar user={user} className="large"/><div><strong>{name}</strong><small>{demo?'演示账号 · 本地预览':user.email||'已登录'}</small></div></div><button role="menuitem" disabled={busy} onClick={()=>choose(onSwitch)}><UsersRound size={19}/><span>切换账号</span></button><button role="menuitem" disabled={busy} onClick={()=>choose(onSettings)}><Settings size={19}/><span>设置</span></button><div className="ac-divider"/><button role="menuitem" className="ac-logout" disabled={busy} onClick={signOut}>{busy?<LoaderCircle size={19} className="ac-spin"/>:<LogOut size={19}/>}<span>{busy?'正在退出…':'退出登录'}</span></button>{error&&<p className="ac-error" role="alert">{error}</p>}</div>}
  </div>;
}
