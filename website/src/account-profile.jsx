import React,{useEffect,useRef,useState} from 'react';
import {updateUser} from '@netlify/identity';
import {Camera,LoaderCircle,Check} from 'lucide-react';
import {avatarUrl,prepareAvatar,profileName,uploadAvatar,saveProfile} from './account-profile.js';
import {AccountAvatar} from './account-menu.jsx';

export function AccountProfile({user,onSaved,onBusy}){
  const [name,setName]=useState(user.name||''),[draft,setDraft]=useState(null),[removed,setRemoved]=useState(false),[busy,setBusy]=useState(false),[processing,setProcessing]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const input=useRef(null),sequence=useRef(0),uploaded=useRef(null);
  const original=avatarUrl(user),preview=draft?.url||(removed?'':original);
  useEffect(()=>()=>{sequence.current++;},[]);
  useEffect(()=>()=>{if(draft?.url)URL.revokeObjectURL(draft.url);},[draft]);
  const changed=name.trim()!==(user.name||'')||!!draft||removed&&!!original;
  async function select(e){
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    const request=++sequence.current;setProcessing(true);setError('');setSuccess('');
    try{const blob=await prepareAvatar(file);if(request!==sequence.current)return;setDraft({blob,url:URL.createObjectURL(blob)});setRemoved(false);uploaded.current=null;}
    catch(err){if(request===sequence.current)setError(err.message);}
    finally{if(request===sequence.current)setProcessing(false);}
  }
  function remove(){sequence.current++;setProcessing(false);setDraft(null);setRemoved(true);uploaded.current=null;setError('');setSuccess('');}
  async function submit(e){
    e.preventDefault();if(busy||processing)return;setError('');setSuccess('');
    try{
      const clean=profileName(name);setBusy(true);onBusy?.(true);
      if(draft&&!uploaded.current)uploaded.current=await uploadAvatar(draft.blob);
      const saved=await saveProfile({name:clean,file:draft?.blob,uploaded:uploaded.current,picture:removed?'':undefined},{updateUser});
      setName(saved.name||clean);setDraft(null);setRemoved(false);uploaded.current=null;
      setSuccess('昵称和头像已保存。');onSaved?.(saved);
    }catch(err){setError(err.status===401?'登录已过期，请重新登录后保存。':err.message||'保存未完成，请稍后重试。');}
    finally{setBusy(false);onBusy?.(false);}
  }
  return <form className="account-profile-editor" onSubmit={submit}>
    <div className="account-profile-photo"><AccountAvatar user={{...user,name,pictureUrl:preview}} className="profile-photo" localPreview={!!draft}/><div><strong>圆形头像</strong><button className="button" type="button" disabled={busy||processing} onClick={()=>input.current.click()}>{processing?<LoaderCircle size={16} className="spin"/>:<Camera size={16}/>}更换头像</button>{preview&&<button className="text-link" type="button" disabled={busy} onClick={remove}>移除头像</button>}</div></div>
    <input className="profile-file" ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择头像图片" onChange={select} tabIndex={-1}/>
    <p className="profile-help">支持 JPG、PNG、WebP，最大 5 MB；自动居中裁剪。</p>
    <label>昵称<input aria-label="修改昵称" required maxLength={40} autoComplete="nickname" value={name} disabled={busy} onChange={e=>{setName(e.target.value);setSuccess('');}} placeholder="输入你的昵称"/></label>
    <p className="profile-email">{user.email}</p>
    {error&&<p className="form-message" role="alert">{error}</p>}{success&&<p className="profile-success" role="status"><Check size={16}/>{success}</p>}
    <button type="submit" className="button primary full" disabled={busy||processing||!changed}>{busy&&<LoaderCircle size={17} className="spin"/>}{busy?'正在保存…':'保存资料'}</button>
  </form>;
}
